# AI Reply Launch Retrospective (v1)

Date: 2026-03-06

## What went well

- End-to-end architecture landed: auth, wallet, generation, payment, webhook, ledger
- Credit model is clear: timed credits reset daily, permanent credits accumulate
- Prompting logic improved to avoid assistant-meta replies
- Frontend UX is stable and bilingual where needed

## What was hard

- Third-party setup friction (Supabase CLI/config, OAuth provider toggles)
- Email delivery path required authenticated sender and correct provider setup
- Payment provider migration increased integration complexity during launch window

## Key lessons

1. Keep provider-agnostic boundaries early (payment + model adapters)
2. Always script a production cutover checklist before launch day
3. Validate auth redirects and callback URLs in incognito before publishing
4. Treat webhook idempotency and signature verification as launch blockers

## Next iteration priorities

1. Creem production cutover and live transaction verification
2. More robust language detection and mixed-language handling
3. Public launch distribution and referral loop optimization
4. Add admin dashboard for revenue/events/credit anomalies

