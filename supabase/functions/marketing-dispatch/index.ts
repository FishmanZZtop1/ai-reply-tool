import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { errorResponse, jsonResponse, readJsonBody } from '../_shared/http.ts'

type MarketingBody = {
  event?: 'signup'
  mode?: 'scheduled'
}

async function sendMarketingEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'AI Reply <hello@aireplytool.com>'

  if (!resendApiKey) {
    return { ok: false, reason: 'missing_resend_api_key' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const payload = await response.text()
    return { ok: false, reason: payload }
  }

  return { ok: true }
}

async function upsertResendContact(email: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const audienceId = Deno.env.get('RESEND_AUDIENCE_ID')

  if (!resendApiKey || !audienceId) {
    return
  }

  await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      audience_id: audienceId,
      unsubscribed: false,
    }),
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return errorResponse('Method not allowed.', 405, 'method_not_allowed')
  }

  try {
    const body = await readJsonBody<MarketingBody>(request)
    const admin = createAdminClient()

    if (body.event === 'signup') {
      const user = await requireUser(request)
      if (!user.email) {
        return errorResponse('No email address available.', 400, 'missing_email')
      }

      await admin
        .from('marketing_contacts')
        .upsert({
          user_id: user.id,
          email: user.email,
          consent_status: 'subscribed',
        }, { onConflict: 'user_id' })

      await upsertResendContact(user.email)

      const welcomeResult = await sendMarketingEmail({
        to: user.email,
        subject: 'Welcome to AI Reply',
        html: `
          <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #111827;">
            <h2>Welcome to AI Reply</h2>
            <p>You now have 500 free credits. Generate your first reply in seconds.</p>
            <p><a href="${Deno.env.get('APP_BASE_URL') || 'https://aireplytool.com'}" style="display:inline-block;padding:10px 16px;background:#E413A2;color:#fff;border-radius:8px;text-decoration:none;">Start Generating</a></p>
          </div>
        `,
      })

      if (welcomeResult.ok) {
        await admin
          .from('marketing_contacts')
          .update({ welcome_sent_at: new Date().toISOString() })
          .eq('user_id', user.id)
      }

      await admin
        .from('marketing_events')
        .insert({
          user_id: user.id,
          event_name: 'signup',
          payload: { welcome_sent: welcomeResult.ok },
        })

      return jsonResponse({ ok: true, welcome_sent: welcomeResult.ok })
    }

    if (body.mode === 'scheduled') {
      const cronSecret = Deno.env.get('MARKETING_CRON_SECRET')
      const incomingSecret = request.headers.get('x-cron-secret') || ''

      if (!cronSecret || incomingSecret !== cronSecret) {
        return errorResponse('Unauthorized cron request.', 401, 'unauthorized_cron')
      }

      const now = Date.now()
      const after24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
      const after72h = new Date(now - 72 * 60 * 60 * 1000).toISOString()

      const { data: reminder24Contacts } = await admin
        .from('marketing_contacts')
        .select('user_id,email')
        .is('paid_at', null)
        .is('reminder_24h_sent_at', null)
        .lt('created_at', after24h)
        .limit(200)

      for (const contact of reminder24Contacts ?? []) {
        const result = await sendMarketingEmail({
          to: contact.email,
          subject: 'Need more AI replies?',
          html: '<p>Your free credits are waiting. Upgrade any time for faster daily usage.</p>',
        })

        if (result.ok) {
          await admin
            .from('marketing_contacts')
            .update({ reminder_24h_sent_at: new Date().toISOString() })
            .eq('user_id', contact.user_id)
        }
      }

      const { data: reminder72Contacts } = await admin
        .from('marketing_contacts')
        .select('user_id,email')
        .is('paid_at', null)
        .is('reminder_72h_sent_at', null)
        .lt('created_at', after72h)
        .limit(200)

      for (const contact of reminder72Contacts ?? []) {
        const result = await sendMarketingEmail({
          to: contact.email,
          subject: 'Final reminder: unlock AI Reply Pro',
          html: '<p>Get more daily credits and priority support with Pro plans.</p>',
        })

        if (result.ok) {
          await admin
            .from('marketing_contacts')
            .update({ reminder_72h_sent_at: new Date().toISOString() })
            .eq('user_id', contact.user_id)
        }
      }

      return jsonResponse({
        ok: true,
        reminders_24h: reminder24Contacts?.length || 0,
        reminders_72h: reminder72Contacts?.length || 0,
      })
    }

    return errorResponse('Unknown marketing action.', 400, 'invalid_action')
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
