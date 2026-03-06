# AI Reply

AI Reply is a Vite + React web app with Supabase Edge Functions.
It supports auth, credit wallet, AI reply generation (Gemini), Creem checkout/webhook, and basic marketing automation.

## Stack

- Frontend: React 19 + Vite 6 + Tailwind 4 + Framer Motion
- Backend: Supabase (Postgres + RLS + Edge Functions + Auth)
- AI: Gemini API (server-side only)
- Payments: Creem (hosted checkout + webhook)
- Marketing: Resend (welcome + reminder emails)
- Policy/Consent: Termly policy pages + cookie consent script
- Hosting: Cloudflare + GitHub

## Environment Variables

Copy `.env.example` to `.env`.

Required frontend env:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL` (default `https://aireplytool.com`)

Required Supabase secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, default `gemini-2.0-flash`)
- `GEMINI_TIMEOUT_MS` (optional, default `25000`)
- `CREEM_API_KEY`
- `CREEM_WEBHOOK_SECRET`
- `CREEM_PRODUCT_ID_CREDIT_PACK_STARTER`
- `CREEM_PRODUCT_ID_MONTHLY_PRO_AUTO`
- `CREEM_PRODUCT_ID_MONTHLY_PRO_ONCE`
- `CREEM_PRODUCT_ID_LIFETIME_PRO`
- `RESEND_API_KEY` (optional but required for email send)
- `RESEND_AUDIENCE_ID` (optional)
- `RESEND_FROM_EMAIL` (optional, default `AI Reply <hello@aireplytool.com>`)
- `APP_BASE_URL` (default `https://aireplytool.com`)
- `MARKETING_CRON_SECRET` (optional if using scheduled reminders)

## Local Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run test -- --run
npm run build
```

## Supabase Deploy

### 1) Apply migrations

```bash
supabase db push
```

### 2) Deploy functions

```bash
supabase functions deploy generate-reply
supabase functions deploy generation-status
supabase functions deploy create-checkout
supabase functions deploy creem-webhook --no-verify-jwt
supabase functions deploy wallet
supabase functions deploy ledger
supabase functions deploy config-options --no-verify-jwt
supabase functions deploy marketing-dispatch
supabase functions deploy upload-avatar
supabase functions deploy delete-account
supabase functions deploy redeem-invite-code
```

### 3) Set secrets

```bash
supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.0-flash GEMINI_TIMEOUT_MS=25000
supabase secrets set CREEM_API_KEY=... CREEM_WEBHOOK_SECRET=...
supabase secrets set CREEM_PRODUCT_ID_CREDIT_PACK_STARTER=... CREEM_PRODUCT_ID_MONTHLY_PRO_AUTO=...
supabase secrets set CREEM_PRODUCT_ID_MONTHLY_PRO_ONCE=... CREEM_PRODUCT_ID_LIFETIME_PRO=...
supabase secrets set RESEND_API_KEY=... RESEND_AUDIENCE_ID=... RESEND_FROM_EMAIL='AI Reply <hello@aireplytool.com>'
supabase secrets set APP_BASE_URL=https://aireplytool.com MARKETING_CRON_SECRET=...
```

## Creem Production Cutover

See: `docs/creem-production-cutover.md`

Important behavior in current code:

- `create-checkout` uses `test-api.creem.io` only when key starts with `creem_test_`
- otherwise it uses production `api.creem.io`
- checkout prefill email is currently fixed to `hello@aireplytool.com`

## SEO / Google Indexing

See: `docs/google-indexing-checklist.md`

## Notes

- Credit charge is fixed at `100` per generation
- Timed credits are reset daily and are consumed before permanent credits
- Raw message text is not stored; only minimal metadata/hash is persisted
