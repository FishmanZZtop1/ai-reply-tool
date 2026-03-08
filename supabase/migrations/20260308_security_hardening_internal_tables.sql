begin;

-- Lock down internal/event tables used only by service-role functions.
alter table if exists public.generation_events enable row level security;
alter table if exists public.invite_rewards enable row level security;
alter table if exists public.marketing_events enable row level security;
alter table if exists public.request_limits enable row level security;
alter table if exists public.lemon_events enable row level security;
alter table if exists public.creem_events enable row level security;

-- Remove any existing policies on internal tables to enforce deny-by-default.
do $$
declare
    policy_row record;
begin
    for policy_row in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in (
            'generation_events',
            'invite_rewards',
            'marketing_events',
            'request_limits',
            'lemon_events',
            'creem_events'
          )
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            policy_row.policyname,
            policy_row.schemaname,
            policy_row.tablename
        );
    end loop;
end;
$$;

-- Revoke direct API-role access from internal tables.
revoke all privileges on table public.generation_events from anon, authenticated;
revoke all privileges on table public.invite_rewards from anon, authenticated;
revoke all privileges on table public.marketing_events from anon, authenticated;
revoke all privileges on table public.request_limits from anon, authenticated;

do $$
begin
    if exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'lemon_events'
          and c.relkind = 'r'
    ) then
        execute 'revoke all privileges on table public.lemon_events from anon, authenticated';
    end if;

    if exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'creem_events'
          and c.relkind = 'r'
    ) then
        execute 'revoke all privileges on table public.creem_events from anon, authenticated';
    end if;
end;
$$;

-- Keep sequence access tight for API roles.
do $$
begin
    if exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'marketing_events_id_seq'
          and c.relkind = 'S'
    ) then
        execute 'revoke all privileges on sequence public.marketing_events_id_seq from anon, authenticated';
    end if;
end;
$$;

-- Fix security advisor warning: function search_path should be pinned.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.get_daily_credit_quota(
    p_tier text,
    p_subscription_status text
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
begin
    if p_tier = 'elite' and p_subscription_status in ('active', 'lifetime') then
        return 5000;
    end if;

    if p_tier = 'pro' and p_subscription_status in ('active', 'trialing') then
        return 2000;
    end if;

    return 0;
end;
$$;

commit;
