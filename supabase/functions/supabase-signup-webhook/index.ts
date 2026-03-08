import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse, readJsonBody } from '../_shared/http.ts'

type SupabaseWebhookBody = {
  type?: string
  table?: string
  schema?: string
  record?: {
    id?: string
    email?: string
    [key: string]: unknown
  }
}

function getWebhookSecret(request: Request) {
  return request.headers.get('x-supabase-webhook-secret') || ''
}

async function syncResendContact(email: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const audienceId = Deno.env.get('RESEND_AUDIENCE_ID')

  if (!resendApiKey || !audienceId) {
    throw new Error('missing_resend_config')
  }

  const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      unsubscribed: false,
    }),
  })

  if (response.ok) {
    return
  }

  // Contact may already exist; treat as idempotent success.
  if (response.status === 409) {
    return
  }

  const errorText = await response.text()
  throw new Error(`resend_error:${errorText}`)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  try {
    const expectedSecret = Deno.env.get('SUPABASE_WEBHOOK_SECRET') || ''
    const providedSecret = getWebhookSecret(request)

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return errorResponse('Unauthorized: Invalid Secret', 401, 'unauthorized')
    }

    const body = await readJsonBody<SupabaseWebhookBody>(request)
    const record = body?.record
    const email = String(record?.email || '').trim().toLowerCase()

    if (!email) {
      return errorResponse('Malformed payload: No email found', 400, 'missing_email')
    }

    const admin = createAdminClient()

    const userId = String(record?.id || '').trim()
    if (userId) {
      await admin
        .from('marketing_contacts')
        .upsert({
          user_id: userId,
          email,
          consent_status: 'subscribed',
        }, { onConflict: 'user_id' })

      await admin
        .from('marketing_events')
        .insert({
          user_id: userId,
          event_name: 'signup_webhook_captured',
          payload: {
            schema: body?.schema || null,
            table: body?.table || null,
            type: body?.type || null,
          },
        })
    }

    await syncResendContact(email)

    return jsonResponse({
      success: true,
      message: 'Email captured and synced.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal_error'

    if (message === 'invalid_json') {
      return errorResponse('Invalid JSON body.', 400, 'invalid_json')
    }

    if (message === 'missing_resend_config') {
      return errorResponse('Server configuration error', 500, 'missing_resend_config')
    }

    if (message.startsWith('resend_error:')) {
      return errorResponse('Failed to sync with Resend', 502, 'resend_sync_failed')
    }

    return errorResponse('Internal Server Error', 500, 'internal_error')
  }
})
