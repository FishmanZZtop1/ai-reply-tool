import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse, readJsonBody } from '../_shared/http.ts'

type DeleteReasonCode =
  | 'no_longer_need'
  | 'better_alternative'
  | 'too_expensive'
  | 'too_robotic'
  | 'other'

type DeleteAccountBody = {
  reason?: DeleteReasonCode
  reason_detail?: string
}

const DELETE_REASON_LABELS: Record<DeleteReasonCode, string> = {
  no_longer_need: 'I no longer need this tool.',
  better_alternative: 'Found a better alternative.',
  too_expensive: "It's too expensive / Not worth the price.",
  too_robotic: 'Responses feel too robotic / Not context-aware enough.',
  other: 'Other (Please specify...)',
}

async function sha256Hex(input: string) {
  const encoded = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function normalizeIdentifier(type: 'email' | 'phone' | 'provider_id', value: string | null | undefined) {
  const raw = String(value || '')
  if (!raw) {
    return ''
  }

  if (type === 'email') {
    return raw.trim().toLowerCase()
  }

  if (type === 'phone') {
    return raw.replace(/[^\d+]/g, '')
  }

  return raw.trim().toLowerCase()
}

async function recordPromoBlacklist({
  admin,
  identifierType,
  identifierValue,
  reasonCode,
  reasonDetail,
}: {
  admin: ReturnType<typeof createAdminClient>
  identifierType: 'email' | 'phone' | 'provider_id'
  identifierValue: string
  reasonCode: DeleteReasonCode
  reasonDetail: string
}) {
  const normalized = normalizeIdentifier(identifierType, identifierValue)
  if (!normalized) {
    return
  }

  const metadata = {
    source: 'account_deletion',
    reason_code: reasonCode,
    reason_label: DELETE_REASON_LABELS[reasonCode],
    reason_detail: reasonDetail || null,
  }

  const { error: rpcError } = await admin.rpc('record_banned_promo', {
    p_identifier_type: identifierType,
    p_identifier_value: normalized,
    p_reason: 'deleted_account_no_signup_bonus',
    p_metadata: metadata,
  })

  if (!rpcError) {
    return
  }

  const hash = await sha256Hex(normalized)
  const { error: fallbackError } = await admin
    .from('banned_promos')
    .upsert({
      identifier_type: identifierType,
      identifier_hash: hash,
      reason: 'deleted_account_no_signup_bonus',
      metadata,
    }, { onConflict: 'identifier_type,identifier_hash' })

  if (fallbackError) {
    throw fallbackError
  }
}

async function sendDeleteNoticeEmail({
  to,
  reasonCode,
  reasonDetail,
  email,
  provider,
  userId,
}: {
  to: string
  reasonCode: DeleteReasonCode
  reasonDetail: string
  email: string
  provider: string
  userId: string
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    return { ok: false, reason: 'missing_resend_api_key' }
  }

  const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'AI Reply <hello@aireplytool.com>'
  const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://aireplytool.com'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject: '[AI Reply] Account deleted notification',
      html: `
        <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2>Account Deleted</h2>
          <p>A user has permanently deleted their AI Reply account.</p>
          <ul>
            <li><strong>User ID:</strong> ${userId}</li>
            <li><strong>Email:</strong> ${email || 'N/A'}</li>
            <li><strong>Provider:</strong> ${provider || 'unknown'}</li>
            <li><strong>Reason:</strong> ${DELETE_REASON_LABELS[reasonCode]}</li>
            <li><strong>Detail:</strong> ${reasonDetail || 'N/A'}</li>
          </ul>
          <p>Source: ${appBaseUrl}</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    return { ok: false, reason: await response.text() }
  }

  return { ok: true }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  try {
    const body = await readJsonBody<DeleteAccountBody>(request)
    const reasonCode = body?.reason
    const reasonDetail = String(body?.reason_detail || '').trim().slice(0, 1000)

    if (!reasonCode || !DELETE_REASON_LABELS[reasonCode]) {
      return errorResponse('Please select a valid deletion reason.', 400, 'invalid_reason')
    }

    if (reasonCode === 'other' && !reasonDetail) {
      return errorResponse('Please provide details for "Other".', 400, 'missing_reason_detail')
    }

    const user = await requireUser(request)
    const admin = createAdminClient()

    const { data: authUserData } = await admin.auth.admin.getUserById(user.id)
    const authUser = authUserData.user
    const provider = String(authUser?.app_metadata?.provider || user.app_metadata?.provider || 'unknown')

    const providerIdentifiers = new Set<string>()
    const identityCandidates = authUser?.identities || []
    for (const identity of identityCandidates) {
      const id = String(identity?.id || '').trim()
      const p = String(identity?.provider || provider || 'unknown').trim().toLowerCase()
      if (id) {
        providerIdentifiers.add(`${p}:${id}`)
        providerIdentifiers.add(id)
      }
    }

    const userMetaSub = String(authUser?.user_metadata?.sub || '').trim()
    if (userMetaSub) {
      providerIdentifiers.add(`${provider.toLowerCase()}:${userMetaSub}`)
      providerIdentifiers.add(userMetaSub)
    }

    await recordPromoBlacklist({
      admin,
      identifierType: 'email',
      identifierValue: authUser?.email || user.email || '',
      reasonCode,
      reasonDetail,
    })

    await recordPromoBlacklist({
      admin,
      identifierType: 'phone',
      identifierValue: authUser?.phone || user.phone || '',
      reasonCode,
      reasonDetail,
    })

    for (const providerId of providerIdentifiers) {
      await recordPromoBlacklist({
        admin,
        identifierType: 'provider_id',
        identifierValue: providerId,
        reasonCode,
        reasonDetail,
      })
    }

    const noticeEmailResult = await sendDeleteNoticeEmail({
      to: 'hello@aireplytool.com',
      reasonCode,
      reasonDetail,
      email: authUser?.email || user.email || '',
      provider,
      userId: user.id,
    })

    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      return errorResponse(error.message, 500, 'delete_account_failed')
    }

    return jsonResponse({
      ok: true,
      notice_email_sent: noticeEmailResult.ok,
      notice_email_error: noticeEmailResult.ok ? null : noticeEmailResult.reason,
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
