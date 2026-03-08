begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.banned_promos (
    id bigint generated always as identity primary key,
    identifier_type text not null check (identifier_type in ('email', 'phone', 'provider_id')),
    identifier_hash text not null,
    reason text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (identifier_type, identifier_hash)
);

alter table public.banned_promos enable row level security;
revoke all privileges on table public.banned_promos from anon, authenticated;

create or replace function public.normalize_banned_identifier(
    p_identifier_type text,
    p_identifier_value text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
    v_value text := coalesce(p_identifier_value, '');
begin
    if p_identifier_type = 'email' then
        return nullif(lower(trim(v_value)), '');
    end if;

    if p_identifier_type = 'phone' then
        return nullif(regexp_replace(v_value, '[^0-9+]', '', 'g'), '');
    end if;

    if p_identifier_type = 'provider_id' then
        return nullif(lower(trim(v_value)), '');
    end if;

    return null;
end;
$$;

create or replace function public.record_banned_promo(
    p_identifier_type text,
    p_identifier_value text,
    p_reason text default null,
    p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_normalized text;
begin
    if p_identifier_type not in ('email', 'phone', 'provider_id') then
        raise exception 'INVALID_IDENTIFIER_TYPE';
    end if;

    v_normalized := public.normalize_banned_identifier(p_identifier_type, p_identifier_value);
    if v_normalized is null then
        return;
    end if;

    insert into public.banned_promos (identifier_type, identifier_hash, reason, metadata)
    values (
        p_identifier_type,
        encode(extensions.digest(v_normalized, 'sha256'), 'hex'),
        p_reason,
        coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (identifier_type, identifier_hash) do update
    set reason = coalesce(excluded.reason, public.banned_promos.reason),
        metadata = public.banned_promos.metadata || excluded.metadata;
end;
$$;

create or replace function public.is_banned_promo_identifier(
    p_identifier_type text,
    p_identifier_value text
)
returns boolean
language plpgsql
stable
set search_path = public, extensions
as $$
declare
    v_normalized text;
begin
    if p_identifier_type not in ('email', 'phone', 'provider_id') then
        return false;
    end if;

    v_normalized := public.normalize_banned_identifier(p_identifier_type, p_identifier_value);
    if v_normalized is null then
        return false;
    end if;

    return exists (
        select 1
        from public.banned_promos
        where identifier_type = p_identifier_type
          and identifier_hash = encode(extensions.digest(v_normalized, 'sha256'), 'hex')
    );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_provider text := nullif(lower(trim(coalesce(new.raw_app_meta_data ->> 'provider', ''))), '');
    v_provider_id text := nullif(coalesce(
        new.raw_user_meta_data ->> 'sub',
        new.raw_user_meta_data ->> 'provider_id',
        new.raw_user_meta_data ->> 'id',
        ''
    ), '');
    v_provider_key text := nullif(concat_ws(':', v_provider, v_provider_id), '');
    v_is_returning_user boolean;
    v_signup_bonus integer;
begin
    v_is_returning_user :=
        public.is_banned_promo_identifier('email', new.email)
        or public.is_banned_promo_identifier('phone', new.phone)
        or public.is_banned_promo_identifier('provider_id', v_provider_key)
        or public.is_banned_promo_identifier('provider_id', v_provider_id);

    v_signup_bonus := case when v_is_returning_user then 0 else 500 end;

    insert into public.profiles (id, display_name, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data ->> 'avatar_url'
    )
    on conflict (id) do nothing;

    insert into public.wallets (user_id, permanent_credits, timed_credits, daily_credit_quota, credits, timed_credits_last_reset)
    values (new.id, v_signup_bonus, 0, 0, v_signup_bonus, (now() at time zone 'utc')::date)
    on conflict (user_id) do nothing;

    if v_signup_bonus > 0 then
        insert into public.credit_ledger (user_id, amount, reason, metadata)
        values (new.id, v_signup_bonus, 'signup_bonus', jsonb_build_object('source', 'auth_trigger', 'credit_bucket', 'permanent'));
    end if;

    return new;
end;
$$;

commit;
