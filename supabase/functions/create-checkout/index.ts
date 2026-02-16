import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse, readJsonBody } from '../_shared/http.ts'

type CheckoutBody = {
  plan_code?: string
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

    const lemonApiKey = Deno.env.get('LEMON_API_KEY')
    const lemonStoreId = Deno.env.get('LEMON_STORE_ID')
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://aireplytool.com'

    if (!lemonApiKey || !lemonStoreId) {
      return errorResponse('Lemon Squeezy env is missing.', 500, 'missing_env')
    }

    const admin = createAdminClient()
    const { data: plan, error: planError } = await admin
      .from('plans')
      .select('plan_code, lemon_variant_id')
      .eq('plan_code', body.plan_code)
      .eq('is_active', true)
      .maybeSingle()

    if (planError || !plan) {
      return errorResponse('Invalid plan code.', 400, 'invalid_plan')
    }

    const lemonPayload = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: user.email,
            custom: {
              user_id: user.id,
              plan_code: plan.plan_code,
            },
          },
          product_options: {
            redirect_url: `${appBaseUrl}/?checkout=success`,
            receipt_link_url: appBaseUrl,
            receipt_button_text: 'Return to AI Reply',
          },
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: lemonStoreId,
            },
          },
          variant: {
            data: {
              type: 'variants',
              id: plan.lemon_variant_id,
            },
          },
        },
      },
    }

    const lemonResponse = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${lemonApiKey}`,
      },
      body: JSON.stringify(lemonPayload),
    })

    const lemonData = await lemonResponse.json()

    if (!lemonResponse.ok) {
      return errorResponse(
        lemonData?.errors?.[0]?.detail || 'Failed to create checkout.',
        502,
        'lemon_checkout_failed',
        lemonData,
      )
    }

    return jsonResponse({
      checkout_url: lemonData?.data?.attributes?.url,
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
