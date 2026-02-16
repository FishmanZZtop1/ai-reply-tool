import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'

type LemonPayload = {
  meta?: {
    event_name?: string
    custom_data?: {
      user_id?: string
      plan_code?: string
    }
  }
  data?: {
    id?: string
    attributes?: Record<string, unknown>
  }
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

function getVariantId(payload: LemonPayload) {
  const attributes = payload.data?.attributes || {}

  const directVariant = attributes['variant_id']
  if (directVariant) {
    return String(directVariant)
  }

  const firstOrderItem = attributes['first_order_item'] as Record<string, unknown> | undefined
  if (firstOrderItem?.variant_id) {
    return String(firstOrderItem.variant_id)
  }

  return ''
}

async function resolvePlan(admin: ReturnType<typeof createAdminClient>, planCode: string, variantId: string) {
  if (planCode) {
    const { data } = await admin
      .from('plans')
      .select('plan_code, plan_type, credits_delta, lemon_variant_id')
      .eq('plan_code', planCode)
      .maybeSingle()

    if (data) return data
  }

  if (variantId) {
    const { data } = await admin
      .from('plans')
      .select('plan_code, plan_type, credits_delta, lemon_variant_id')
      .eq('lemon_variant_id', variantId)
      .maybeSingle()

    if (data) return data
  }

  return null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  try {
    const webhookSecret = Deno.env.get('LEMON_WEBHOOK_SECRET')
    if (!webhookSecret) {
      return errorResponse('LEMON_WEBHOOK_SECRET missing.', 500, 'missing_env')
    }

    const signature = request.headers.get('X-Signature') || request.headers.get('x-signature') || ''
    if (!signature) {
      return errorResponse('Missing signature.', 401, 'invalid_signature')
    }

    const rawBody = await request.text()
    const isValidSignature = await verifySignature(rawBody, signature, webhookSecret)

    if (!isValidSignature) {
      return errorResponse('Invalid signature.', 401, 'invalid_signature')
    }

    const payload = JSON.parse(rawBody) as LemonPayload
    const eventName = payload.meta?.event_name || 'unknown'
    const payloadDataId = payload.data?.id || crypto.randomUUID()
    const eventId = `${eventName}:${payloadDataId}`

    const admin = createAdminClient()

    const { error: eventInsertError } = await admin
      .from('lemon_events')
      .insert({
        event_id: eventId,
        event_name: eventName,
        payload,
      })

    if (eventInsertError?.code === '23505') {
      return jsonResponse({ ok: true, duplicate: true })
    }

    if (eventInsertError) {
      return errorResponse(eventInsertError.message, 500, 'event_persist_error')
    }

    const userId = payload.meta?.custom_data?.user_id || ''
    const planCode = payload.meta?.custom_data?.plan_code || ''
    const variantId = getVariantId(payload)

    if (!userId) {
      return jsonResponse({ ok: true, skipped: 'missing_user_id' })
    }

    const plan = await resolvePlan(admin, planCode, variantId)
    if (!plan) {
      return jsonResponse({ ok: true, skipped: 'plan_not_found' })
    }

    const attributes = payload.data?.attributes || {}
    const subscriptionId = String(attributes['subscription_id'] || payload.data?.id || '')
    const renewsAt = (attributes['renews_at'] || attributes['ends_at'] || null) as string | null

    if (plan.plan_type === 'credit_pack' && (eventName === 'order_created' || eventName === 'subscription_payment_success')) {
      await admin.rpc('add_credits', {
        p_user_id: userId,
        p_amount: plan.credits_delta,
        p_reason: `lemon_${eventName}`,
        p_metadata: {
          event_id: eventId,
          plan_code: plan.plan_code,
          lemon_variant_id: plan.lemon_variant_id,
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

    const isSubscriptionEvent = eventName.startsWith('subscription_') || (eventName === 'order_created' && plan.plan_type !== 'credit_pack')

    if (isSubscriptionEvent) {
      const status = plan.plan_type === 'lifetime'
        ? 'lifetime'
        : String(attributes['status'] || 'active')

      await admin
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          plan_code: plan.plan_code,
          lemon_subscription_id: subscriptionId || `${userId}:${plan.plan_code}`,
          status,
          current_period_end: renewsAt,
        }, { onConflict: 'lemon_subscription_id' })

      await admin
        .from('wallets')
        .update({
          tier: plan.plan_type === 'lifetime' ? 'elite' : 'pro',
          subscription_status: status,
          subscription_expires_at: renewsAt,
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

      if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
        await admin
          .from('wallets')
          .update({
            tier: 'free',
            subscription_status: eventName === 'subscription_cancelled' ? 'cancelled' : 'expired',
          })
          .eq('user_id', userId)

        await admin.rpc('refresh_timed_credits', {
          p_user_id: userId,
        })
      }

      return jsonResponse({ ok: true, mode: 'subscription_or_lifetime' })
    }

    return jsonResponse({ ok: true, skipped: 'no_action_for_event' })
  } catch (error) {
    return errorResponse(error.message || 'Unexpected error.', 500, 'internal_error')
  }
})
