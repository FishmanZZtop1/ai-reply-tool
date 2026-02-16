begin;

create extension if not exists pgcrypto;

do $$ begin
    if not exists (select 1 from pg_type where typname = 'plan_type') then
        create type public.plan_type as enum ('credit_pack', 'subscription', 'lifetime');
    end if;
end $$;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    avatar_url text,
    referral_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
    user_id uuid primary key references auth.users(id) on delete cascade,
    credits integer not null default 500 check (credits >= 0),
    tier text not null default 'free',
    subscription_status text not null default 'none',
    subscription_expires_at timestamptz,
    coupons jsonb not null default '{"discount90":0,"discount85":0}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    amount integer not null,
    reason text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_time_idx on public.credit_ledger (user_id, created_at desc);

create table if not exists public.plans (
    id uuid primary key default gen_random_uuid(),
    plan_code text unique not null,
    display_name text not null,
    plan_type public.plan_type not null,
    lemon_variant_id text unique not null,
    credits_delta integer not null check (credits_delta > 0),
    billing_cycle text not null default 'one_time',
    price_usd numeric(10, 2) not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    plan_code text references public.plans(plan_code),
    lemon_subscription_id text unique,
    status text not null default 'inactive',
    current_period_end timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists user_subscriptions_user_idx on public.user_subscriptions (user_id, created_at desc);

create table if not exists public.lemon_events (
    id uuid primary key default gen_random_uuid(),
    event_id text not null unique,
    event_name text not null,
    payload jsonb not null,
    processed_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table if not exists public.option_catalog (
    id uuid primary key default gen_random_uuid(),
    category text not null check (category in ('scene', 'role', 'style')),
    option_key text not null,
    label text not null,
    emoji text,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (category, option_key)
);

create table if not exists public.marketing_contacts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    email text not null,
    consent_status text not null default 'unknown',
    welcome_sent_at timestamptz,
    reminder_24h_sent_at timestamptz,
    reminder_72h_sent_at timestamptz,
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.marketing_events (
    id bigint generated always as identity primary key,
    user_id uuid references auth.users(id) on delete cascade,
    event_name text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.request_limits (
    rate_key text primary key,
    window_started_at timestamptz not null,
    request_count integer not null,
    updated_at timestamptz not null default now()
);

create table if not exists public.generation_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    request_id uuid not null unique,
    message_hash text not null,
    input_char_count integer not null,
    variations integer not null,
    language text not null,
    model text not null,
    status text not null,
    latency_ms integer,
    created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, display_name, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data ->> 'avatar_url'
    )
    on conflict (id) do nothing;

    insert into public.wallets (user_id, credits)
    values (new.id, 500)
    on conflict (user_id) do nothing;

    insert into public.credit_ledger (user_id, amount, reason, metadata)
    values (new.id, 500, 'signup_bonus', jsonb_build_object('source', 'auth_trigger'))
    on conflict do nothing;

    return new;
end;
$$;

create or replace function public.consume_credits(
    p_user_id uuid,
    p_amount integer,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_remaining integer;
begin
    if p_amount <= 0 then
        raise exception 'INVALID_AMOUNT';
    end if;

    update public.wallets
    set credits = credits - p_amount,
        updated_at = now()
    where user_id = p_user_id
      and credits >= p_amount
    returning credits into v_remaining;

    if not found then
        raise exception 'INSUFFICIENT_CREDITS';
    end if;

    insert into public.credit_ledger (user_id, amount, reason, metadata)
    values (p_user_id, -p_amount, p_reason, coalesce(p_metadata, '{}'::jsonb));

    return v_remaining;
end;
$$;

create or replace function public.add_credits(
    p_user_id uuid,
    p_amount integer,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_remaining integer;
begin
    if p_amount <= 0 then
        raise exception 'INVALID_AMOUNT';
    end if;

    insert into public.wallets (user_id, credits)
    values (p_user_id, p_amount)
    on conflict (user_id)
    do update
    set credits = public.wallets.credits + p_amount,
        updated_at = now()
    returning credits into v_remaining;

    insert into public.credit_ledger (user_id, amount, reason, metadata)
    values (p_user_id, p_amount, p_reason, coalesce(p_metadata, '{}'::jsonb));

    return v_remaining;
end;
$$;

create or replace function public.enforce_rate_limit(
    p_rate_key text,
    p_limit integer,
    p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_now timestamptz := now();
    v_count integer;
begin
    insert into public.request_limits (rate_key, window_started_at, request_count, updated_at)
    values (p_rate_key, v_now, 1, v_now)
    on conflict (rate_key)
    do update
    set request_count = case
            when public.request_limits.window_started_at < v_now - make_interval(secs => p_window_seconds)
                then 1
            else public.request_limits.request_count + 1
        end,
        window_started_at = case
            when public.request_limits.window_started_at < v_now - make_interval(secs => p_window_seconds)
                then v_now
            else public.request_limits.window_started_at
        end,
        updated_at = v_now
    returning request_count into v_count;

    return v_count <= p_limit;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at
before update on public.wallets
for each row execute function public.set_updated_at();

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.user_subscriptions;
create trigger subscriptions_set_updated_at
before update on public.user_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists option_catalog_set_updated_at on public.option_catalog;
create trigger option_catalog_set_updated_at
before update on public.option_catalog
for each row execute function public.set_updated_at();

drop trigger if exists marketing_contacts_set_updated_at on public.marketing_contacts;
create trigger marketing_contacts_set_updated_at
before update on public.marketing_contacts
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.plans enable row level security;
alter table public.option_catalog enable row level security;
alter table public.marketing_contacts enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
for select to authenticated
using (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists wallets_select_self on public.wallets;
create policy wallets_select_self on public.wallets
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists credit_ledger_select_self on public.credit_ledger;
create policy credit_ledger_select_self on public.credit_ledger
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists user_subscriptions_select_self on public.user_subscriptions;
create policy user_subscriptions_select_self on public.user_subscriptions
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists marketing_contacts_select_self on public.marketing_contacts;
create policy marketing_contacts_select_self on public.marketing_contacts
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans
for select
using (is_active = true);

drop policy if exists option_catalog_public_read on public.option_catalog;
create policy option_catalog_public_read on public.option_catalog
for select
using (is_active = true);

insert into public.plans (plan_code, display_name, plan_type, lemon_variant_id, credits_delta, billing_cycle, price_usd, is_active)
values
    ('credit_pack_starter', 'Credit Pack', 'credit_pack', '1307053', 2000, 'one_time', 1.99, true),
    ('monthly_pro_auto', 'Monthly Pro (Auto)', 'subscription', '1307111', 2000, 'monthly', 29.80, true),
    ('monthly_pro_once', 'Monthly Pro (One-time)', 'subscription', '1307127', 2000, 'one_time', 39.80, true),
    ('lifetime_pro', 'Lifetime Pro', 'lifetime', '1307136', 5000, 'lifetime', 188.00, true)
on conflict (plan_code)
do update set
    display_name = excluded.display_name,
    plan_type = excluded.plan_type,
    lemon_variant_id = excluded.lemon_variant_id,
    credits_delta = excluded.credits_delta,
    billing_cycle = excluded.billing_cycle,
    price_usd = excluded.price_usd,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.option_catalog (category, option_key, label, emoji, sort_order)
values
    ('scene', 'work_email', '💼 Work Email', '💼', 10),
    ('scene', 'social_chat', '💬 Social Chat', '💬', 20),
    ('scene', 'family', '🏠 Family', '🏠', 30),
    ('scene', 'customer_service', '🎧 Customer Service', '🎧', 40),
    ('scene', 'dating', '💕 Dating', '💕', 50),
    ('scene', 'job_interview', '🎯 Job Interview', '🎯', 60),
    ('role', 'boss', '👔 Boss / Manager', '👔', 10),
    ('role', 'colleague', '🤝 Colleague', '🤝', 20),
    ('role', 'friend', '😊 Friend', '😊', 30),
    ('role', 'family', '👨‍👩‍👧 Family', '👨‍👩‍👧', 40),
    ('role', 'partner', '❤️ Partner', '❤️', 50),
    ('role', 'client', '💼 Client', '💼', 60),
    ('role', 'stranger', '👤 Stranger', '👤', 70),
    ('style', 'professional', '📋 Professional', '📋', 10),
    ('style', 'friendly', '🤗 Friendly', '🤗', 20),
    ('style', 'humorous', '😂 Humorous', '😂', 30),
    ('style', 'direct', '⚡ Direct', '⚡', 40),
    ('style', 'subtle', '🌸 Subtle', '🌸', 50),
    ('style', 'enthusiastic', '🎉 Enthusiastic', '🎉', 60)
on conflict (category, option_key)
do update set
    label = excluded.label,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

commit;
