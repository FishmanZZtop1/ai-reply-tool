import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse, readJsonBody } from '../_shared/http.ts'

type CheckoutBody = {
  plan_code?: string
}

const CREEM_PRODUCT_ENV_BY_PLAN: Record<string, string> = {
  credit_pack_starter: 'CREEM_PRODUCT_ID_CREDIT_PACK_STARTER',
  monthly_pro_auto: 'CREEM_PRODUCT_ID_MONTHLY_PRO_AUTO',
  monthly_pro_once: 'CREEM_PRODUCT_ID_MONTHLY_PRO_ONCE',
  lifetime_pro: 'CREEM_PRODUCT_ID_LIFETIME_PRO',
}

function resolveCreemApiBaseUrl(apiKey: string) {
  if (apiKey.startsWith('creem_test_')) {
    return 'https://test-api.creem.io'
  }

  return 'https://api.creem.io'
}

function resolveCreemProductId(planCode: string) {
  const envName = CREEM_PRODUCT_ENV_BY_PLAN[planCode]
  if (!envName) return ''
  return Deno.env.get(envName) || ''
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
    const body = await readJsonBody<CheckoutBody>(request)

    if (!body.plan_code) {
      return errorResponse('plan_code is required.', 400, 'validation_error')
    }

    const creemApiKey = Deno.env.get('CREEM_API_KEY')
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://aireplytool.com'

    if (!creemApiKey) {
      return errorResponse('CREEM_API_KEY is missing.', 500, 'missing_env')
    }

    const admin = createAdminClient()
    const { data: plan, error: planError } = await admin
      .from('plans')
      .select('plan_code')
      .eq('plan_code', body.plan_code)
      .eq('is_active', true)
      .maybeSingle()

    if (planError || !plan) {
      return errorResponse('Invalid plan code.', 400, 'invalid_plan')
    }

    const creemProductId = resolveCreemProductId(plan.plan_code)
    if (!creemProductId) {
      return errorResponse(
        `Missing Creem product mapping for ${plan.plan_code}. Set ${CREEM_PRODUCT_ENV_BY_PLAN[plan.plan_code] || 'CREEM_PRODUCT_ID_*'} secret.`,
        500,
        'missing_creem_product_mapping',
      )
    }

    const creemApiBaseUrl = resolveCreemApiBaseUrl(creemApiKey)
    const creemPayload = {
      product_id: creemProductId,
      request_id: `aireply_${crypto.randomUUID()}`,
      success_url: `${appBaseUrl}/?checkout=success`,
      metadata: {
        user_id: user.id,
        plan_code: plan.plan_code,
      },
      customer: {
        email: 'hello@aireplytool.com',
      },
    }

    const creemResponse = await fetch(`${creemApiBaseUrl}/v1/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': creemApiKey,
      },
      body: JSON.stringify(creemPayload),
    })

    const creemData = await creemResponse.json().catch(() => ({}))

    if (!creemResponse.ok) {
      return errorResponse(
        creemData?.message
          || creemData?.error?.message
          || 'Failed to create Creem checkout.',
        502,
        'creem_checkout_failed',
        creemData,
      )
    }

    const checkoutUrl = String(
      creemData?.checkout_url
      || creemData?.url
      || creemData?.data?.checkout_url
      || '',
    )

    if (!checkoutUrl) {
      return errorResponse('Creem checkout URL missing in API response.', 502, 'creem_checkout_response_invalid', creemData)
    }

    return jsonResponse({
      checkout_url: checkoutUrl,
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
