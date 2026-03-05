-- Pricing adjustments for Creem rollout
update public.plans
set
  display_name = '2000 Credits Welcome Pack',
  price_usd = 2.99,
  updated_at = now()
where plan_code = 'credit_pack_starter';

update public.plans
set
  display_name = 'Pro Membership (Monthly Auto-Renewal)',
  price_usd = 29.90,
  updated_at = now()
where plan_code = 'monthly_pro_auto';

update public.plans
set
  display_name = '1 Month Pro Pass (No Renewal)',
  price_usd = 39.90,
  updated_at = now()
where plan_code = 'monthly_pro_once';
