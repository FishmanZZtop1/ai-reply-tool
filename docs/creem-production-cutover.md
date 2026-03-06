# Creem Production Cutover Checklist

## Goal

Switch from Creem test mode to production with zero regression in checkout and webhook fulfillment.

## 1) Secrets

Set production secrets in Supabase project:

```bash
supabase secrets set CREEM_API_KEY=<live_key> --project-ref xlkibhktnsorttppzdby
supabase secrets set CREEM_WEBHOOK_SECRET=<live_webhook_secret> --project-ref xlkibhktnsorttppzdby
supabase secrets set CREEM_PRODUCT_ID_CREDIT_PACK_STARTER=<live_product_id> --project-ref xlkibhktnsorttppzdby
supabase secrets set CREEM_PRODUCT_ID_MONTHLY_PRO_AUTO=<live_product_id> --project-ref xlkibhktnsorttppzdby
supabase secrets set CREEM_PRODUCT_ID_MONTHLY_PRO_ONCE=<live_product_id> --project-ref xlkibhktnsorttppzdby
supabase secrets set CREEM_PRODUCT_ID_LIFETIME_PRO=<live_product_id> --project-ref xlkibhktnsorttppzdby
```

## 2) Webhook

Creem webhook URL:

`https://xlkibhktnsorttppzdby.supabase.co/functions/v1/creem-webhook`

Events to subscribe:

- `checkout.completed`
- `subscription.active`
- `subscription.paid`
- `subscription.trialing`
- `subscription.canceled`
- `subscription.expired`
- `subscription.unpaid`
- `subscription.paused`

## 3) Smoke test

1. Login as real user
2. Buy `credit_pack_starter`
3. Confirm webhook 200
4. Confirm wallet increment (permanent credits +2000)
5. Confirm `credit_ledger.reason = creem_checkout_completed`

Then test subscription plan:

1. Buy `monthly_pro_auto`
2. Confirm webhook 200
3. Confirm wallet `tier=pro`, `subscription_status=active`
4. Confirm timed credits refreshed

## 4) Rollback plan

If production checkout fails:

1. Revert `CREEM_API_KEY` to previous known-good key
2. Re-send failed webhooks from Creem dashboard
3. Validate idempotency (`duplicate=true`) prevents double grant

