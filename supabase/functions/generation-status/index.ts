import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'

function normalizeQueryValue(value: string | null, maxLength = 96) {
  if (!value) {
    return ''
  }

  return String(value)
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .slice(0, maxLength)
}

function parseReplies(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }

  return value
    .map((reply) => (typeof reply === 'string' ? reply.trim() : ''))
    .filter(Boolean)
}

function asObject(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

async function sha256(input: string) {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function deterministicRequestId(userId: string, idempotencyKey: string) {
  const hex = await sha256(`${userId}:${idempotencyKey}`)
  const base = hex.slice(0, 32)
  return `${base.slice(0, 8)}-${base.slice(8, 12)}-4${base.slice(13, 16)}-a${base.slice(17, 20)}-${base.slice(20, 32)}`
}

async function getWalletSnapshot(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { error: refreshError } = await admin.rpc('refresh_timed_credits', {
    p_user_id: userId,
  })

  if (refreshError) {
    throw new Error(`wallet_refresh_failed:${refreshError.message}`)
  }

  const { data: wallet, error: walletError } = await admin
    .from('wallets')
    .select('timed_credits,permanent_credits')
    .eq('user_id', userId)
    .maybeSingle()

  if (walletError) {
    throw new Error(`wallet_fetch_failed:${walletError.message}`)
  }

  const timedCredits = Number(wallet?.timed_credits ?? 0)
  const permanentCredits = Number(wallet?.permanent_credits ?? 0)

  return {
    timed_credits: timedCredits,
    permanent_credits: permanentCredits,
    total_credits: timedCredits + permanentCredits,
  }
}

async function findGenerationChargeLedger(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  requestId: string,
) {
  return admin
    .from('credit_ledger')
    .select('id,metadata')
    .eq('user_id', userId)
    .eq('reason', 'reply_generation')
    .contains('metadata', { request_id: requestId })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}

async function findGenerationRefundLedger(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  requestId: string,
) {
  return admin
    .from('credit_ledger')
    .select('id,metadata')
    .eq('user_id', userId)
    .eq('reason', 'generation_refund')
    .contains('metadata', { request_id: requestId })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'GET') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  try {
    const user = await requireUser(request)
    const admin = createAdminClient()

    const url = new URL(request.url)
    const requestIdQuery = normalizeQueryValue(url.searchParams.get('request_id'), 64)
    const idempotencyKey = normalizeQueryValue(url.searchParams.get('idempotency_key'))

    if (!requestIdQuery && !idempotencyKey) {
      return errorResponse('request_id or idempotency_key is required.', 400, 'validation_error')
    }

    const requestId = requestIdQuery || await deterministicRequestId(user.id, idempotencyKey)

    const { data: eventRow, error: eventError } = await admin
      .from('generation_events')
      .select('request_id,status,language,model,latency_ms,created_at')
      .eq('user_id', user.id)
      .eq('request_id', requestId)
      .maybeSingle()

    if (eventError) {
      return errorResponse(eventError.message, 500, 'db_error')
    }

    if (!eventRow) {
      return errorResponse('Generation request not found.', 404, 'not_found')
    }

    if (eventRow.status === 'running') {
      return jsonResponse({
        request_id: requestId,
        idempotency_key: idempotencyKey || null,
        status: 'running',
        created_at: eventRow.created_at,
      })
    }

    if (eventRow.status !== 'success') {
      const { data: refundRow } = await findGenerationRefundLedger(admin, user.id, requestId)
      const refundMetadata = asObject(refundRow?.metadata)

      return jsonResponse({
        request_id: requestId,
        idempotency_key: idempotencyKey || null,
        status: 'failed',
        code: String(refundMetadata.error_code || eventRow.status || 'generation_failed'),
        error: String(refundMetadata.error_message || 'Generation failed.'),
        refund_applied: Boolean(refundRow?.id),
      })
    }

    const { data: chargeRow } = await findGenerationChargeLedger(admin, user.id, requestId)
    const chargeMetadata = asObject(chargeRow?.metadata)
    const replies = parseReplies(chargeMetadata.replies)

    if (!replies.length) {
      return jsonResponse({
        request_id: requestId,
        idempotency_key: idempotencyKey || null,
        status: 'running',
      })
    }

    const wallet = await getWalletSnapshot(admin, user.id)

    return jsonResponse({
      request_id: requestId,
      idempotency_key: idempotencyKey || null,
      status: 'success',
      replies,
      credits_charged: Number(chargeMetadata.credits_charged ?? 100),
      remaining_timed_credits: wallet.timed_credits,
      remaining_permanent_credits: wallet.permanent_credits,
      remaining_credits: wallet.total_credits,
      language: String(chargeMetadata.language || eventRow.language || 'auto'),
    })
  } catch (error) {
    if (error.message === 'unauthorized') {
      return errorResponse('Authentication required.', 401, 'auth_required')
    }

    if (String(error.message || '').startsWith('wallet_refresh_failed:')) {
      return errorResponse(error.message.replace('wallet_refresh_failed:', ''), 500, 'wallet_refresh_error')
    }

    if (String(error.message || '').startsWith('wallet_fetch_failed:')) {
      return errorResponse(error.message.replace('wallet_fetch_failed:', ''), 500, 'wallet_error')
    }

    return errorResponse(error.message || 'Unexpected error.', 500, 'internal_error')
  }
})
