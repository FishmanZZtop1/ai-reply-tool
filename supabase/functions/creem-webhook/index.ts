import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'

type CreemPayload = {
  id?: string
  eventType?: string
  event_type?: string
  object?: Record<string, unknown>
}

const CREEM_PRODUCT_ENV_BY_PLAN: Record<string, string> = {
  credit_pack_starter: 'CREEM_PRODUCT_ID_CREDIT_PACK_STARTER',
  monthly_pro_auto: 'CREEM_PRODUCT_ID_MONTHLY_PRO_AUTO',
  monthly_pro_once: 'CREEM_PRODUCT_ID_MONTHLY_PRO_ONCE',
  lifetime_pro: 'CREEM_PRODUCT_ID_LIFETIME_PRO',
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function secureCompare(a: string, b: string) {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return mismatch === 0
}

function normalizeSignature(rawSignature: string) {
  const signature = rawSignature.trim().toLowerCase()
  if (!signature) return ''

  if (signature.includes('v1=')) {
    const segment = signature
      .split(',')
      .map((part) => part.trim())
      .find((part) => part.startsWith('v1='))
    if (segment) {
      return segment.replace(/^v1=/, '').trim()
    }
  }

  return signature.replace(/^sha256=/, '').trim()
}

async function verifySignature(rawBody: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  return secureCompare(toHex(digest), signature)
}

function asObject(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function getMetadata(payloadObject: Record<string, unknown>) {
  const directMetadata = asObject(payloadObject.metadata)
  if (Object.keys(directMetadata).length) {
    return directMetadata
  }

  const checkoutMetadata = asObject(asObject(payloadObject.checkout).metadata)
  if (Object.keys(checkoutMetadata).length) {
    return checkoutMetadata
  }

  const subscriptionMetadata = asObject(asObject(payloadObject.subscription).metadata)
  if (Object.keys(subscriptionMetadata).length) {
    return subscriptionMetadata
  }

  return {}
}

function getProductId(payloadObject: Record<string, unknown>) {
  const direct = asString(payloadObject.product_id)
  if (direct) return direct

  const productObject = asObject(payloadObject.product)
  const productObjectId = asString(productObject.id)
  if (productObjectId) return productObjectId

  const checkoutObject = asObject(payloadObject.checkout)
  const checkoutProductId = asString(checkoutObject.product_id)
  if (checkoutProductId) return checkoutProductId

  const checkoutProductObjectId = asString(asObject(checkoutObject.product).id)
  if (checkoutProductObjectId) return checkoutProductObjectId

  return ''
}

function resolvePlanCodeByProductId(productId: string) {
  if (!productId) return ''

  for (const [planCode, envName] of Object.entries(CREEM_PRODUCT_ENV_BY_PLAN)) {
    if ((Deno.env.get(envName) || '') === productId) {
      return planCode
    }
  }

  return ''
}

function getSubscriptionSnapshot(eventType: string, payloadObject: Record<string, unknown>) {
  const subscriptionObject = eventType.startsWith('subscription.')
    ? payloadObject
    : asObject(payloadObject.subscription)

  const id = asString(subscriptionObject.id)
    || asString(payloadObject.subscription_id)
    || asString(asObject(payloadObject.subscription).id)

  const status = asString(subscriptionObject.status) || 'active'
  const currentPeriodEnd = asString(subscriptionObject.current_period_end)
    || asString(subscriptionObject.current_period_end_at)
    || asString(subscriptionObject.expires_at)
    || null

  return { id, status, currentPeriodEnd }
}

async function resolvePlan(
  admin: ReturnType<typeof createAdminClient>,
  planCode: string,
  productId: string,
) {
  const fallbackPlanCode = resolvePlanCodeByProductId(productId)
  const lookupPlanCode = planCode || fallbackPlanCode

  if (!lookupPlanCode) {
    return null
  }

  const { data } = await admin
    .from('plans')
    .select('plan_code, plan_type, credits_delta')
    .eq('plan_code', lookupPlanCode)
    .maybeSingle()

  return data || null
}

async function upsertSubscription(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  planCode: string,
  status: string,
  currentPeriodEnd: string | null,
) {
  const { data: existingSubscription } = await admin
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_code', planCode)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingSubscription?.id) {
    await admin
      .from('user_subscriptions')
      .update({
        status,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSubscription.id)
    return
  }

  await admin
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_code: planCode,
      status,
      current_period_end: currentPeriodEnd,
    })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  try {
    const webhookSecret = Deno.env.get('CREEM_WEBHOOK_SECRET')
    if (!webhookSecret) {
      return errorResponse('CREEM_WEBHOOK_SECRET missing.', 500, 'missing_env')
    }

    const signatureHeader = request.headers.get('creem-signature')
      || request.headers.get('Creem-Signature')
      || request.headers.get('x-creem-signature')
      || ''
    const signature = normalizeSignature(signatureHeader)

    if (!signature) {
      return errorResponse('Missing signature.', 401, 'invalid_signature')
    }

    const rawBody = await request.text()
    const isValidSignature = await verifySignature(rawBody, signature, webhookSecret)
    if (!isValidSignature) {
      return errorResponse('Invalid signature.', 401, 'invalid_signature')
    }

    const payload = JSON.parse(rawBody) as CreemPayload
    const eventType = payload.eventType || payload.event_type || 'unknown'
    const eventId = payload.id || `${eventType}:${crypto.randomUUID()}`
    const payloadObject = asObject(payload.object)

    const admin = createAdminClient()
    const eventRateKey = `creem_event:${eventId}`
    const { data: insertedEventRows, error: eventPersistError } = await admin
      .from('request_limits')
      .insert({
        rate_key: eventRateKey,
        window_started_at: new Date().toISOString(),
        request_count: 1,
      }, { onConflict: 'rate_key', ignoreDuplicates: true })
      .select('rate_key')

    if (eventPersistError) {
      const code = String(eventPersistError.code || '')
      const message = String(eventPersistError.message || '').toLowerCase()
      if (code === '23505' || message.includes('duplicate key value')) {
        return jsonResponse({ ok: true, duplicate: true })
      }
      return errorResponse(eventPersistError.message, 500, 'event_persist_error')
    }

    if (!insertedEventRows?.length) {
      return jsonResponse({ ok: true, duplicate: true })
    }

    const metadata = getMetadata(payloadObject)
    const userId = asString(metadata.user_id)
    const metadataPlanCode = asString(metadata.plan_code)
    const productId = getProductId(payloadObject)
    const plan = await resolvePlan(admin, metadataPlanCode, productId)

    if (!userId) {
      return jsonResponse({ ok: true, skipped: 'missing_user_id' })
    }

    if (!plan) {
      return jsonResponse({ ok: true, skipped: 'plan_not_found' })
    }

    const activationEvents = new Set([
      'checkout.completed',
      'subscription.active',
      'subscription.paid',
      'subscription.trialing',
    ])

    const deactivationEvents = new Set([
      'subscription.canceled',
      'subscription.expired',
      'subscription.unpaid',
      'subscription.paused',
    ])

    if (plan.plan_type === 'credit_pack' && eventType === 'checkout.completed') {
      await admin.rpc('add_credits', {
        p_user_id: userId,
        p_amount: plan.credits_delta,
        p_reason: 'creem_checkout_completed',
        p_metadata: {
          event_id: eventId,
          event_type: eventType,
          plan_code: plan.plan_code,
          product_id: productId,
          credit_bucket: 'permanent',
        },
      })

      await admin
        .from('marketing_contacts')
        .upsert({
          user_id: userId,
          paid_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      return jsonResponse({ ok: true, mode: 'credit_pack' })
    }

    if (activationEvents.has(eventType) && plan.plan_type !== 'credit_pack') {
      const subscriptionSnapshot = getSubscriptionSnapshot(eventType, payloadObject)
      const isLifetime = plan.plan_type === 'lifetime'
      const subscriptionStatus = isLifetime
        ? 'lifetime'
        : (subscriptionSnapshot.status || 'active')

      await upsertSubscription(
        admin,
        userId,
        plan.plan_code,
        subscriptionStatus,
        subscriptionSnapshot.currentPeriodEnd,
      )

      await admin
        .from('wallets')
        .update({
          tier: isLifetime ? 'elite' : 'pro',
          subscription_status: subscriptionStatus,
          subscription_expires_at: subscriptionSnapshot.currentPeriodEnd,
        })
        .eq('user_id', userId)

      await admin.rpc('refresh_timed_credits', {
        p_user_id: userId,
      })

      await admin
        .from('marketing_contacts')
        .upsert({
          user_id: userId,
          paid_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      return jsonResponse({ ok: true, mode: 'subscription_or_lifetime' })
    }

    if (deactivationEvents.has(eventType) && plan.plan_type === 'subscription') {
      const statusMap: Record<string, string> = {
        'subscription.canceled': 'cancelled',
        'subscription.expired': 'expired',
        'subscription.unpaid': 'past_due',
        'subscription.paused': 'paused',
      }

      await admin
        .from('user_subscriptions')
        .update({
          status: statusMap[eventType] || 'inactive',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('plan_code', plan.plan_code)

      await admin
        .from('wallets')
        .update({
          tier: 'free',
          subscription_status: statusMap[eventType] || 'inactive',
        })
        .eq('user_id', userId)

      await admin.rpc('refresh_timed_credits', {
        p_user_id: userId,
      })

      return jsonResponse({ ok: true, mode: 'subscription_deactivated' })
    }

    return jsonResponse({ ok: true, skipped: 'no_action_for_event' })
  } catch (error) {
    return errorResponse(error.message || 'Unexpected error.', 500, 'internal_error')
  }
})
