import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse, readJsonBody } from '../_shared/http.ts'

type RedeemBody = {
  invite_code?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  try {
    const user = await requireUser(request)
    const body = await readJsonBody<RedeemBody>(request)

    const inviteCode = String(body.invite_code || '').trim()
    if (!inviteCode) {
      return errorResponse('Invite code is required.', 400, 'validation_error')
    }

    const admin = createAdminClient()
    const { data, error } = await admin.rpc('redeem_invite_code', {
      p_user_id: user.id,
      p_invite_code: inviteCode,
    })

    if (error) {
      const message = String(error.message || '')

      if (message.includes('INVITE_ALREADY_REDEEMED')) {
        return errorResponse('You have already redeemed an invite code.', 409, 'invite_already_redeemed')
      }

      if (message.includes('INVITE_CODE_NOT_FOUND') || message.includes('INVALID_INVITE_CODE')) {
        return errorResponse('Invite code is invalid.', 404, 'invite_not_found')
      }

      if (message.includes('SELF_INVITE_NOT_ALLOWED')) {
        return errorResponse('You cannot redeem your own invite code.', 400, 'self_invite_not_allowed')
      }

      return errorResponse(message || 'Failed to redeem invite code.', 500, 'redeem_failed')
    }

    return jsonResponse({
      ok: true,
      reward_credits: data?.reward_credits ?? 200,
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
