# Supabase DB Webhook -> Next.js API -> Resend Audience

## 1) Route created
This repo now includes:

- `src/app/api/webhooks/supabase/route.ts`

It expects a `POST` with header `x-supabase-webhook-secret` and forwards `record.email` to Resend Audience Contacts API.

## 2) Required environment variables (Next.js runtime)
Set these in your Next.js deployment environment:

- `SUPABASE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_AUDIENCE_ID`

## 3) Supabase Database Webhook configuration
In Supabase, create a Database Webhook on your signup source table (usually `auth.users` insert event):

- Method: `POST`
- URL: `https://<your-next-domain>/api/webhooks/supabase`
- Header key: `x-supabase-webhook-secret`
- Header value: same value as `SUPABASE_WEBHOOK_SECRET`

Payload requirement for this handler:
- `record.email` must exist

## 4) Quick curl test
```bash
curl -X POST "https://<your-next-domain>/api/webhooks/supabase" \
  -H "Content-Type: application/json" \
  -H "x-supabase-webhook-secret: <YOUR_SECRET>" \
  -d '{"record":{"email":"test@example.com"}}'
```

Expected success response:
```json
{"success":true,"message":"Email captured and synced."}
```

## Notes
- This repository is currently a Vite frontend + Supabase Edge Functions architecture.
- The new `route.ts` is for a Next.js runtime. It will not execute unless deployed under a Next.js app.
