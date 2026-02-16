# AI Reply

AI Reply is a Vite + React frontend with Supabase Edge Functions for auth, credit wallet, AI generation, Lemon Squeezy checkout, and Resend marketing automation.

## Stack

- Frontend: React 19 + Vite 6 + Tailwind 4 + Framer Motion
- Auth/Data/Functions: Supabase (Postgres + RLS + Edge Functions)
- AI: Google Gemini API (server-side only)
- Payments: Lemon Squeezy (checkout + webhook)
- Marketing: Resend (welcome + 24h/72h reminders)
- Policy/Consent: Termly links + cookie blocker script
- Hosting: Cloudflare Pages (frontend) + Supabase (backend)

## Environment Variables

Copy `.env.example` to `.env` and set at least:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL`
- `VITE_TERMLY_PRIVACY_URL`
- `VITE_TERMLY_TERMS_URL`
- `VITE_TERMLY_WEBSITE_UUID`

Set Supabase function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, default `gemini-2.0-flash`)
- `LEMON_API_KEY`
- `LEMON_STORE_ID`
- `LEMON_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_AUDIENCE_ID`
- `RESEND_FROM_EMAIL`
- `APP_BASE_URL`
- `MARKETING_CRON_SECRET`

## Local Development

```bash
npm install
npm run dev
```

## Lint + Build

```bash
npm run lint
npm run build
```

## Supabase

### 1) Apply database migration

```bash
supabase db push
```

### 2) Deploy edge functions

```bash
supabase functions deploy generate-reply
supabase functions deploy create-checkout
supabase functions deploy lemon-webhook --no-verify-jwt
supabase functions deploy wallet
supabase functions deploy ledger
supabase functions deploy config-options --no-verify-jwt
supabase functions deploy marketing-dispatch
```

### 3) Set function secrets

```bash
supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set GEMINI_API_KEY=... LEMON_API_KEY=... LEMON_STORE_ID=... LEMON_WEBHOOK_SECRET=...
supabase secrets set RESEND_API_KEY=... RESEND_AUDIENCE_ID=... RESEND_FROM_EMAIL=...
supabase secrets set APP_BASE_URL=https://aireplytool.com MARKETING_CRON_SECRET=...
```

## Lemon Squeezy Setup

1. Replace placeholder `lemon_variant_id` values in `public.plans`.
2. Configure webhook URL: `https://<project-ref>.supabase.co/functions/v1/lemon-webhook`.
3. Use signing secret as `LEMON_WEBHOOK_SECRET`.

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Add all `VITE_*` env vars in Cloudflare project settings.

## Notes

- Credit charge is fixed at `100` per generation.
- Message raw text is not persisted to DB; only hashed telemetry is stored.
- `config-options` is public read; all credit/payment operations are server-side only.
