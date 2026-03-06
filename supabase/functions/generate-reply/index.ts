import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, getClientIp, jsonResponse, readJsonBody } from '../_shared/http.ts'
import { inferLanguageFromMessage } from '../_shared/language.ts'

type GenerateRequest = {
  message?: string
  notes?: string
  language?: string
  idempotency_key?: string
  variations?: number
  options?: {
    scene?: string
    role?: string
    style?: string
    length?: string
    emoji?: boolean
    sceneCustom?: string
    roleCustom?: string
  }
}

type WalletSnapshot = {
  timed_credits: number
  permanent_credits: number
  total_credits: number
}

const CREDITS_PER_REQUEST = 100
const MESSAGE_MAX = 6000
const NOTES_MAX = 1200
const IDEMPOTENCY_KEY_MAX = 96
const GEMINI_TIMEOUT_MS = Number.parseInt(Deno.env.get('GEMINI_TIMEOUT_MS') || '25000', 10)

function normalizeString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function normalizeInput(payload: GenerateRequest) {
  const message = normalizeString(payload.message, MESSAGE_MAX)
  const notes = normalizeString(payload.notes || '', NOTES_MAX)
  const language = normalizeString(payload.language || 'auto', 20) || 'auto'
  const idempotencyKey = normalizeString(payload.idempotency_key || '', IDEMPOTENCY_KEY_MAX)

  const rawVariations = Number.parseInt(String(payload.variations ?? 3), 10)
  const variations = Math.min(5, Math.max(1, Number.isFinite(rawVariations) ? rawVariations : 3))

  return {
    message,
    notes,
    language,
    idempotencyKey,
    variations,
    options: {
      scene: normalizeString(payload.options?.scene || '', 120),
      role: normalizeString(payload.options?.role || '', 120),
      style: normalizeString(payload.options?.style || '', 120),
      length: normalizeString(payload.options?.length || 'Shorter', 40),
      emoji: Boolean(payload.options?.emoji),
      sceneCustom: normalizeString(payload.options?.sceneCustom || '', 120),
      roleCustom: normalizeString(payload.options?.roleCustom || '', 120),
    },
  }
}

function resolveOption(primary: string, custom: string) {
  if (primary === 'custom') {
    return custom || 'Not specified'
  }
  return primary || custom || 'Not specified'
}

function mapLanguageLabel(languageCode: string) {
  switch (languageCode) {
    case 'zh':
    case 'zh-cn':
    case 'zh-hans':
      return 'Chinese (Simplified)'
    case 'zh-tw':
    case 'zh-hk':
    case 'zh-hant':
      return 'Chinese (Traditional)'
    case 'ja':
      return 'Japanese'
    case 'ko':
      return 'Korean'
    case 'en':
      return 'English'
    case 'ru':
      return 'Russian'
    case 'ar':
      return 'Arabic'
    case 'hi':
      return 'Hindi'
    default:
      return languageCode
  }
}

function buildPrompt(input: ReturnType<typeof normalizeInput>, effectiveLanguage: string) {
  const scene = resolveOption(input.options.scene, input.options.sceneCustom)
  const role = resolveOption(input.options.role, input.options.roleCustom)

  const optionPayload = {
    scene,
    role,
    style: input.options.style || 'Friendly',
    length: input.options.length || 'Shorter',
    emoji: input.options.emoji,
    language_requested: input.language,
    language_effective: effectiveLanguage,
    language_policy: 'follow_original_message',
    variations: input.variations,
  }

  return [
    'You are an assistant specialized in writing practical message replies.',
    'You must follow every provided option exactly and never ignore options.',
    'You write the final message that will be sent from the writer/user to the recipient (the sender of Original Message).',
    'Never respond to the writer as an assistant. Do not output helper/meta wording.',
    `Return exactly ${input.variations} replies and ensure each reply is meaningfully different.`,
    'Return strict JSON only: {"replies": ["..."]}. Never output markdown or extra keys.',
    '',
    `Selected Options JSON:\n${JSON.stringify(optionPayload, null, 2)}`,
    '',
    `Original Message:\n${input.message}`,
    '',
    `Writer Intent Notes (internal guidance, not to be answered literally):\n${input.notes || 'None'}`,
    '',
    'Output requirements:',
    `- Output language MUST be ${mapLanguageLabel(effectiveLanguage)}.`,
    '- Do not mix multiple languages unless the original message intentionally mixes them.',
    '- The reply text must directly address the recipient of Original Message.',
    '- Additional Notes describe intent/style constraints. Convert them into recipient-facing reply content.',
    '- Never output assistant/meta phrases such as "I can help you..." / "I will help you..." / "我会帮你...".',
    '- Keep tone and role alignment precise.',
    '- Respect length preference (Shorter/Longer).',
    '- If emoji=false, do not include emoji.',
    '- If emoji=true, use emojis only when natural and minimal.',
    '- Return plain reply text only; do not add numbering or bullet prefixes.',
    '- Avoid policy or safety commentary unless explicitly requested by user input.',
  ].join('\n')
}

function isAssistantMetaReply(reply: string) {
  if (!reply) return false

  const englishPatterns = [
    /\b(as an ai|as your ai|ai assistant)\b/i,
    /\bi\s*(can|will|'ll)\s*help you\s*(reply|draft|write|respond)\b/i,
    /\blet me help you\s*(reply|draft|write|respond)\b/i,
  ]

  const chinesePatterns = [
    /作为.?ai/i,
    /我(会|可以|能)(帮|替)你(回复|写|请假|处理|生成)/,
    /我来(帮|替)你(回复|写|请假|处理|生成)/,
  ]

  return englishPatterns.some((pattern) => pattern.test(reply))
    || chinesePatterns.some((pattern) => pattern.test(reply))
}

function hasAssistantMetaReplies(replies: string[]) {
  return replies.some((reply) => isAssistantMetaReply(reply))
}

function buildPerspectiveRetryPrompt(input: ReturnType<typeof normalizeInput>, effectiveLanguage: string) {
  return [
    buildPrompt(input, effectiveLanguage),
    '',
    'CRITICAL RETRY FIX:',
    '- Your previous output sounded like assistant-to-user guidance.',
    '- Rewrite all replies as direct messages from writer to recipient.',
    '- Do not include "I can help you..." / "I will help you..." / "我会帮你..." style wording.',
  ].join('\n')
}

function extractReplies(rawText: string, expectedCount: number) {
  const normalizedText = rawText?.trim()
  if (!normalizedText) {
    return []
  }

  try {
    const parsed = JSON.parse(normalizedText)
    if (Array.isArray(parsed?.replies)) {
      return parsed.replies
        .map((reply) => (typeof reply === 'string' ? reply.trim() : ''))
        .filter(Boolean)
        .slice(0, expectedCount)
    }
  } catch (_error) {
    // Fall back to plain text extraction.
  }

  return normalizedText
    .split('\n')
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, expectedCount)
}

function parseReplies(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }

  return value
    .map((reply) => (typeof reply === 'string' ? reply.trim() : ''))
    .filter(Boolean)
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

async function callGemini({
  apiKey,
  model,
  prompt,
  variations,
}: {
  apiKey: string
  model: string
  prompt: string
  variations: number
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                replies: {
                  type: 'array',
                  minItems: variations,
                  maxItems: variations,
                  items: { type: 'string' },
                },
              },
              required: ['replies'],
            },
          },
        }),
      },
    )

    return response
  } finally {
    clearTimeout(timeout)
  }
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
  } as WalletSnapshot
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

function asObject(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

async function patchChargeLedgerMetadata(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  requestId: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await findGenerationChargeLedger(admin, userId, requestId)

  if (error || !data?.id) {
    return
  }

  const nextMetadata = {
    ...asObject(data.metadata),
    ...patch,
  }

  await admin
    .from('credit_ledger')
    .update({ metadata: nextMetadata })
    .eq('id', data.id)
}

async function refundCredits(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  amount: number,
  metadata: Record<string, unknown>,
) {
  const { error } = await admin.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: 'generation_refund',
    p_metadata: metadata,
  })

  return !error
}

function isRecoverableStatus(status: string) {
  return status !== 'success' && status !== 'running'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  const admin = createAdminClient()
  let activeUserId = ''
  let activeRequestId = ''
  let activeIdempotencyKey = ''
  let creditsConsumed = false
  let refundApplied = false
  const startedAt = Date.now()

  try {
    const user = await requireUser(request)
    activeUserId = user.id

    const body = await readJsonBody<GenerateRequest>(request)
    const input = normalizeInput(body)

    if (!input.message) {
      return errorResponse('Message is required.', 400, 'validation_error')
    }

    const idempotencyKey = input.idempotencyKey || crypto.randomUUID()
    activeIdempotencyKey = idempotencyKey
    const requestId = await deterministicRequestId(user.id, idempotencyKey)
    activeRequestId = requestId

    const { data: existingEvent, error: existingEventError } = await admin
      .from('generation_events')
      .select('request_id,status,language,model,latency_ms')
      .eq('user_id', user.id)
      .eq('request_id', requestId)
      .maybeSingle()

    if (existingEventError) {
      return errorResponse(existingEventError.message, 500, 'generation_lookup_error')
    }

    if (existingEvent) {
      if (existingEvent.status === 'success') {
        const walletSnapshot = await getWalletSnapshot(admin, user.id)
        const { data: chargeRow } = await findGenerationChargeLedger(admin, user.id, requestId)
        const chargeMetadata = asObject(chargeRow?.metadata)
        const replies = parseReplies(chargeMetadata.replies)

        if (!replies.length) {
          return jsonResponse({
            request_id: requestId,
            idempotency_key: idempotencyKey,
            status: 'running',
          }, 202)
        }

        return jsonResponse({
          request_id: requestId,
          idempotency_key: idempotencyKey,
          status: 'success',
          replies,
          credits_charged: Number(chargeMetadata.credits_charged ?? CREDITS_PER_REQUEST),
          remaining_timed_credits: walletSnapshot.timed_credits,
          remaining_permanent_credits: walletSnapshot.permanent_credits,
          remaining_credits: walletSnapshot.total_credits,
          language: String(chargeMetadata.language || existingEvent.language || 'auto'),
          idempotent_replay: true,
        })
      }

      if (existingEvent.status === 'running') {
        return jsonResponse({
          request_id: requestId,
          idempotency_key: idempotencyKey,
          status: 'running',
        }, 202)
      }

      const { data: refundRow } = await findGenerationRefundLedger(admin, user.id, requestId)
      const refundMetadata = asObject(refundRow?.metadata)
      const errorMessage = String(refundMetadata.error_message || 'Previous generation request failed. Please regenerate.')
      const errorCode = String(refundMetadata.error_code || existingEvent.status || 'generation_failed')

      return errorResponse(
        errorMessage,
        409,
        'request_previously_failed',
        {
          request_id: requestId,
          idempotency_key: idempotencyKey,
          status: 'failed',
          error_code: errorCode,
          can_regenerate: isRecoverableStatus(errorCode),
        },
      )
    }

    const messageHash = await sha256(input.message)
    const effectiveLanguage = inferLanguageFromMessage(input.message)

    const rateKey = `${user.id}:${getClientIp(request)}`
    const { data: allowed, error: rateLimitError } = await admin.rpc('enforce_rate_limit', {
      p_rate_key: rateKey,
      p_limit: 8,
      p_window_seconds: 60,
    })

    if (rateLimitError) {
      return errorResponse(rateLimitError.message, 500, 'rate_limit_error')
    }

    if (!allowed) {
      return errorResponse('Too many requests. Please retry in a minute.', 429, 'rate_limited')
    }

    const walletSnapshot = await getWalletSnapshot(admin, user.id)

    if (walletSnapshot.total_credits < CREDITS_PER_REQUEST) {
      return errorResponse('Insufficient credits.', 402, 'insufficient_credits')
    }

    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'

    const { error: insertEventError } = await admin
      .from('generation_events')
      .insert({
        user_id: user.id,
        request_id: requestId,
        message_hash: messageHash,
        input_char_count: input.message.length,
        variations: input.variations,
        language: effectiveLanguage,
        model: geminiModel,
        status: 'running',
      })

    if (insertEventError) {
      if (insertEventError.code === '23505') {
        return jsonResponse({
          request_id: requestId,
          idempotency_key: idempotencyKey,
          status: 'running',
        }, 202)
      }

      return errorResponse(insertEventError.message, 500, 'generation_create_error')
    }

    const metadata = {
      request_id: requestId,
      idempotency_key: idempotencyKey,
      language: effectiveLanguage,
      variations: input.variations,
      source: 'generation',
      credits_charged: CREDITS_PER_REQUEST,
    }

    const { data: consumeResult, error: consumeError } = await admin.rpc('consume_credits', {
      p_user_id: user.id,
      p_amount: CREDITS_PER_REQUEST,
      p_reason: 'reply_generation',
      p_metadata: metadata,
    })

    if (consumeError) {
      await admin
        .from('generation_events')
        .update({
          status: 'credit_consume_failed',
          latency_ms: Date.now() - startedAt,
        })
        .eq('request_id', requestId)

      if (String(consumeError.message).includes('INSUFFICIENT_CREDITS')) {
        return errorResponse('Insufficient credits.', 402, 'insufficient_credits')
      }

      return errorResponse(consumeError.message, 500, 'credit_consume_failed')
    }

    creditsConsumed = true

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      refundApplied = await refundCredits(admin, user.id, CREDITS_PER_REQUEST, {
        ...metadata,
        reason: 'missing_gemini_key',
        error_code: 'missing_env',
        error_message: 'GEMINI_API_KEY is missing.',
      })

      await admin
        .from('generation_events')
        .update({
          status: 'missing_env',
          latency_ms: Date.now() - startedAt,
        })
        .eq('request_id', requestId)

      await patchChargeLedgerMetadata(admin, user.id, requestId, {
        status: 'failed',
        error_code: 'missing_env',
        error_message: 'GEMINI_API_KEY is missing.',
        refund_applied: refundApplied,
      })

      return errorResponse('GEMINI_API_KEY is missing.', 500, 'missing_env')
    }

    let geminiResponse: Response
    try {
      geminiResponse = await callGemini({
        apiKey: geminiApiKey,
        model: geminiModel,
        prompt: buildPrompt(input, effectiveLanguage),
        variations: input.variations,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        refundApplied = await refundCredits(admin, user.id, CREDITS_PER_REQUEST, {
          ...metadata,
          reason: 'model_timeout',
          error_code: 'model_timeout',
          error_message: 'Model request timed out. Please retry.',
        })

        await admin
          .from('generation_events')
          .update({
            status: 'model_timeout',
            latency_ms: Date.now() - startedAt,
          })
          .eq('request_id', requestId)

        await patchChargeLedgerMetadata(admin, user.id, requestId, {
          status: 'failed',
          error_code: 'model_timeout',
          error_message: 'Model request timed out. Please retry.',
          refund_applied: refundApplied,
        })

        return errorResponse('Model request timed out. Please retry.', 504, 'model_timeout', {
          request_id: requestId,
          idempotency_key: idempotencyKey,
        })
      }

      throw error
    }

    const geminiPayload = await geminiResponse.json().catch(() => ({}))
    const rawText = geminiPayload?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!geminiResponse.ok || !rawText) {
      const modelErrorMessage = geminiPayload?.error?.message || 'Failed to generate reply.'

      refundApplied = await refundCredits(admin, user.id, CREDITS_PER_REQUEST, {
        ...metadata,
        reason: 'model_failure',
        error_code: 'model_error',
        error_message: modelErrorMessage,
      })

      await admin
        .from('generation_events')
        .update({
          status: 'model_error',
          latency_ms: Date.now() - startedAt,
        })
        .eq('request_id', requestId)

      await patchChargeLedgerMetadata(admin, user.id, requestId, {
        status: 'failed',
        error_code: 'model_error',
        error_message: modelErrorMessage,
        refund_applied: refundApplied,
      })

      return errorResponse(
        modelErrorMessage,
        502,
        'model_error',
        {
          request_id: requestId,
          idempotency_key: idempotencyKey,
        },
      )
    }

    let replies = extractReplies(rawText, input.variations)

    if (replies.length && hasAssistantMetaReplies(replies)) {
      try {
        const retryResponse = await callGemini({
          apiKey: geminiApiKey,
          model: geminiModel,
          prompt: buildPerspectiveRetryPrompt(input, effectiveLanguage),
          variations: input.variations,
        })

        const retryPayload = await retryResponse.json().catch(() => ({}))
        const retryText = retryPayload?.candidates?.[0]?.content?.parts?.[0]?.text || ''

        if (retryResponse.ok && retryText) {
          const retriedReplies = extractReplies(retryText, input.variations)
          if (retriedReplies.length && !hasAssistantMetaReplies(retriedReplies)) {
            replies = retriedReplies
          }
        }
      } catch {
        // Keep first-pass replies and validate below.
      }
    }

    if (replies.length && hasAssistantMetaReplies(replies)) {
      replies = []
    }

    if (!replies.length) {
      refundApplied = await refundCredits(admin, user.id, CREDITS_PER_REQUEST, {
        ...metadata,
        reason: 'empty_output',
        error_code: 'invalid_reply_perspective',
        error_message: 'Model output did not meet reply perspective requirements.',
      })

      await admin
        .from('generation_events')
        .update({
          status: 'invalid_perspective',
          latency_ms: Date.now() - startedAt,
        })
        .eq('request_id', requestId)

      await patchChargeLedgerMetadata(admin, user.id, requestId, {
        status: 'failed',
        error_code: 'invalid_reply_perspective',
        error_message: 'Model output did not meet reply perspective requirements.',
        refund_applied: refundApplied,
      })

      return errorResponse('Model output did not meet reply perspective requirements.', 502, 'invalid_reply_perspective', {
        request_id: requestId,
        idempotency_key: idempotencyKey,
      })
    }

    const latencyMs = Date.now() - startedAt

    await admin
      .from('generation_events')
      .update({
        status: 'success',
        latency_ms: latencyMs,
      })
      .eq('request_id', requestId)

    await patchChargeLedgerMetadata(admin, user.id, requestId, {
      status: 'success',
      language: effectiveLanguage,
      replies,
      completed_at: new Date().toISOString(),
      refund_applied: false,
    })

    return jsonResponse({
      request_id: requestId,
      idempotency_key: idempotencyKey,
      status: 'success',
      replies,
      credits_charged: CREDITS_PER_REQUEST,
      remaining_timed_credits: Number(consumeResult?.timed_credits ?? 0),
      remaining_permanent_credits: Number(consumeResult?.permanent_credits ?? 0),
      remaining_credits: Number(consumeResult?.total_credits ?? 0),
      language: effectiveLanguage,
    })
  } catch (error) {
    if (activeRequestId && activeUserId) {
      if (creditsConsumed && !refundApplied) {
        refundApplied = await refundCredits(admin, activeUserId, CREDITS_PER_REQUEST, {
          request_id: activeRequestId,
          idempotency_key: activeIdempotencyKey,
          source: 'generation',
          reason: 'unexpected_internal_error',
          error_code: 'internal_error',
          error_message: error.message || 'Unexpected error.',
        })
      }

      await admin
        .from('generation_events')
        .update({
          status: 'internal_error',
          latency_ms: Date.now() - startedAt,
        })
        .eq('request_id', activeRequestId)

      await patchChargeLedgerMetadata(admin, activeUserId, activeRequestId, {
        status: 'failed',
        error_code: 'internal_error',
        error_message: error.message || 'Unexpected error.',
        refund_applied: refundApplied,
      })
    }

    if (error.message === 'unauthorized') {
      return errorResponse('Authentication required.', 401, 'auth_required')
    }

    if (error.message === 'invalid_json') {
      return errorResponse('Invalid JSON body.', 400, 'invalid_json')
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
