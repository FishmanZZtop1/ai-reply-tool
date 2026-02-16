import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, getClientIp, jsonResponse, readJsonBody } from '../_shared/http.ts'

type GenerateRequest = {
  message?: string
  notes?: string
  language?: string
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

const CREDITS_PER_REQUEST = 100
const MESSAGE_MAX = 6000
const NOTES_MAX = 1200

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

  const rawVariations = Number.parseInt(String(payload.variations ?? 3), 10)
  const variations = Math.min(5, Math.max(1, Number.isFinite(rawVariations) ? rawVariations : 3))

  return {
    message,
    notes,
    language,
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

function buildPrompt(input: ReturnType<typeof normalizeInput>) {
  const scene = resolveOption(input.options.scene, input.options.sceneCustom)
  const role = resolveOption(input.options.role, input.options.roleCustom)

  const optionPayload = {
    scene,
    role,
    style: input.options.style || 'Friendly',
    length: input.options.length || 'Shorter',
    emoji: input.options.emoji,
    language: input.language,
    variations: input.variations,
  }

  return [
    'You are an assistant specialized in writing practical message replies.',
    'You must follow every provided option exactly and never ignore options.',
    `Return exactly ${input.variations} replies and ensure each reply is meaningfully different.`,
    'Return strict JSON only: {"replies": ["..."]}. Never output markdown or extra keys.',
    '',
    `Selected Options JSON:\n${JSON.stringify(optionPayload, null, 2)}`,
    '',
    `Original Message:\n${input.message}`,
    '',
    `Additional Notes:\n${input.notes || 'None'}`,
    '',
    'Output requirements:',
    '- Keep language consistent with the requested language option.',
    '- Keep tone and role alignment precise.',
    '- Respect length preference (Shorter/Longer).',
    '- If emoji=false, do not include emoji.',
    '- If emoji=true, use emojis only when natural and minimal.',
    '- Return plain reply text only; do not add numbering or bullet prefixes.',
    '- Avoid policy or safety commentary unless explicitly requested by user input.',
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

async function sha256(input: string) {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  const admin = createAdminClient()
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()

  try {
    const user = await requireUser(request)
    const body = await readJsonBody<GenerateRequest>(request)
    const input = normalizeInput(body)

    if (!input.message) {
      return errorResponse('Message is required.', 400, 'validation_error')
    }

    const messageHash = await sha256(input.message)

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

    const { error: refreshError } = await admin.rpc('refresh_timed_credits', {
      p_user_id: user.id,
    })

    if (refreshError) {
      return errorResponse(refreshError.message, 500, 'wallet_refresh_error')
    }

    const { data: wallet, error: walletError } = await admin
      .from('wallets')
      .select('timed_credits,permanent_credits')
      .eq('user_id', user.id)
      .maybeSingle()

    if (walletError) {
      return errorResponse(walletError.message, 500, 'wallet_error')
    }

    const totalCredits = (wallet?.timed_credits ?? 0) + (wallet?.permanent_credits ?? 0)
    if (totalCredits < CREDITS_PER_REQUEST) {
      return errorResponse('Insufficient credits.', 402, 'insufficient_credits')
    }

    const metadata = {
      request_id: requestId,
      language: input.language,
      variations: input.variations,
      source: 'generation',
    }

    const { data: consumeResult, error: consumeError } = await admin.rpc('consume_credits', {
      p_user_id: user.id,
      p_amount: CREDITS_PER_REQUEST,
      p_reason: 'reply_generation',
      p_metadata: metadata,
    })

    if (consumeError) {
      if (String(consumeError.message).includes('INSUFFICIENT_CREDITS')) {
        return errorResponse('Insufficient credits.', 402, 'insufficient_credits')
      }
      return errorResponse(consumeError.message, 500, 'credit_consume_failed')
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'

    if (!geminiApiKey) {
      await admin.rpc('add_credits', {
        p_user_id: user.id,
        p_amount: CREDITS_PER_REQUEST,
        p_reason: 'generation_refund',
        p_metadata: { ...metadata, reason: 'missing_gemini_key' },
      })
      return errorResponse('GEMINI_API_KEY is missing.', 500, 'missing_env')
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                replies: {
                  type: 'array',
                  minItems: input.variations,
                  maxItems: input.variations,
                  items: { type: 'string' },
                },
              },
              required: ['replies'],
            },
          },
        }),
      },
    )

    const geminiPayload = await geminiResponse.json()
    const rawText = geminiPayload?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!geminiResponse.ok || !rawText) {
      await admin.rpc('add_credits', {
        p_user_id: user.id,
        p_amount: CREDITS_PER_REQUEST,
        p_reason: 'generation_refund',
        p_metadata: {
          ...metadata,
          reason: 'model_failure',
        },
      })

      return errorResponse(
        geminiPayload?.error?.message || 'Failed to generate reply.',
        502,
        'model_error',
        geminiPayload,
      )
    }

    const replies = extractReplies(rawText, input.variations)
    if (!replies.length) {
      await admin.rpc('add_credits', {
        p_user_id: user.id,
        p_amount: CREDITS_PER_REQUEST,
        p_reason: 'generation_refund',
        p_metadata: {
          ...metadata,
          reason: 'empty_output',
        },
      })
      return errorResponse('Model returned empty output.', 502, 'empty_model_output')
    }

    const latencyMs = Date.now() - startedAt

    await admin
      .from('generation_events')
      .insert({
        user_id: user.id,
        request_id: requestId,
        message_hash: messageHash,
        input_char_count: input.message.length,
        variations: input.variations,
        language: input.language,
        model: geminiModel,
        status: 'success',
        latency_ms: latencyMs,
      })

    return jsonResponse({
      request_id: requestId,
      replies,
      credits_charged: CREDITS_PER_REQUEST,
      remaining_timed_credits: Number(consumeResult?.timed_credits ?? 0),
      remaining_permanent_credits: Number(consumeResult?.permanent_credits ?? 0),
      remaining_credits: Number(consumeResult?.total_credits ?? 0),
    })
  } catch (error) {
    if (error.message === 'unauthorized') {
      return errorResponse('Authentication required.', 401, 'auth_required')
    }

    if (error.message === 'invalid_json') {
      return errorResponse('Invalid JSON body.', 400, 'invalid_json')
    }

    return errorResponse(error.message || 'Unexpected error.', 500, 'internal_error')
  }
})
