import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse } from '../_shared/http.ts'

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

    const { error: refreshError } = await admin.rpc('refresh_timed_credits', {
      p_user_id: user.id,
    })

    if (refreshError) {
      return errorResponse(refreshError.message, 500, 'wallet_refresh_error')
    }

    const [{ data: wallet, error: walletError }, { data: profile, error: profileError }] = await Promise.all([
      admin
        .from('wallets')
        .select('tier,subscription_status,subscription_expires_at,coupons,timed_credits,permanent_credits,daily_credit_quota')
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('referral_code,invited_by,invite_redeemed_at')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    if (walletError || profileError) {
      return errorResponse(walletError?.message || profileError?.message || 'Failed to fetch wallet.', 500, 'db_error')
    }

    const timedCredits = wallet?.timed_credits ?? 0
    const permanentCredits = wallet?.permanent_credits ?? 0

    return jsonResponse({
      wallet: {
        timed_credits: timedCredits,
        permanent_credits: permanentCredits,
        total_credits: timedCredits + permanentCredits,
        daily_credit_quota: wallet?.daily_credit_quota ?? 0,
        tier: wallet?.tier ?? 'free',
        subscription_status: wallet?.subscription_status ?? 'none',
        subscription_expires_at: wallet?.subscription_expires_at ?? null,
        coupons: wallet?.coupons ?? { discount90: 0, discount85: 0 },
        referral_code: profile?.referral_code ?? null,
        invite_redeemed: Boolean(profile?.invited_by),
        invite_redeemed_at: profile?.invite_redeemed_at ?? null,
      },
    })
  } catch (error) {
    if (error.message === 'unauthorized') {
      return errorResponse('Authentication required.', 401, 'auth_required')
    }

    return errorResponse(error.message || 'Unexpected error.', 500, 'internal_error')
  }
})
