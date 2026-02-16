begin;

alter table public.wallets
    add column if not exists permanent_credits integer not null default 0,
    add column if not exists timed_credits integer not null default 0,
    add column if not exists daily_credit_quota integer not null default 0,
    add column if not exists timed_credits_last_reset date;

update public.wallets
set permanent_credits = credits
where permanent_credits = 0 and credits > 0;

alter table public.wallets
    drop constraint if exists wallets_permanent_nonnegative,
    drop constraint if exists wallets_timed_nonnegative,
    drop constraint if exists wallets_quota_nonnegative;

alter table public.wallets
    add constraint wallets_permanent_nonnegative check (permanent_credits >= 0),
    add constraint wallets_timed_nonnegative check (timed_credits >= 0),
    add constraint wallets_quota_nonnegative check (daily_credit_quota >= 0);

alter table public.profiles
    add column if not exists invited_by uuid references auth.users(id),
    add column if not exists invite_redeemed_at timestamptz;

create index if not exists profiles_invited_by_idx on public.profiles (invited_by);

create table if not exists public.invite_rewards (
    id uuid primary key default gen_random_uuid(),
    inviter_id uuid not null references auth.users(id) on delete cascade,
    invitee_id uuid not null unique references auth.users(id) on delete cascade,
    reward_credits integer not null default 200,
    created_at timestamptz not null default now()
);

create or replace function public.get_daily_credit_quota(
    p_tier text,
    p_subscription_status text
)
returns integer
language plpgsql
immutable
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

create or replace function public.refresh_timed_credits(p_user_id uuid)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
    v_wallet public.wallets;
    v_today date := (now() at time zone 'utc')::date;
    v_quota integer;
begin
    select * into v_wallet
    from public.wallets
    where user_id = p_user_id
    for update;

    if not found then
        raise exception 'WALLET_NOT_FOUND';
    end if;

    v_quota := public.get_daily_credit_quota(v_wallet.tier, v_wallet.subscription_status);

    if v_wallet.timed_credits_last_reset is distinct from v_today
       or v_wallet.daily_credit_quota is distinct from v_quota then
        update public.wallets
        set timed_credits = v_quota,
            daily_credit_quota = v_quota,
            timed_credits_last_reset = v_today,
            credits = permanent_credits + v_quota,
            updated_at = now()
        where user_id = p_user_id
        returning * into v_wallet;
    elsif v_wallet.credits is distinct from (v_wallet.permanent_credits + v_wallet.timed_credits) then
        update public.wallets
        set credits = permanent_credits + timed_credits,
            updated_at = now()
        where user_id = p_user_id
        returning * into v_wallet;
    end if;

    return v_wallet;
end;
$$;

drop function if exists public.consume_credits(uuid, integer, text, jsonb);
create or replace function public.consume_credits(
    p_user_id uuid,
    p_amount integer,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_wallet public.wallets;
    v_take_timed integer;
    v_take_permanent integer;
begin
    if p_amount <= 0 then
        raise exception 'INVALID_AMOUNT';
    end if;

    v_wallet := public.refresh_timed_credits(p_user_id);

    if (v_wallet.timed_credits + v_wallet.permanent_credits) < p_amount then
        raise exception 'INSUFFICIENT_CREDITS';
    end if;

    v_take_timed := least(v_wallet.timed_credits, p_amount);
    v_take_permanent := p_amount - v_take_timed;

    update public.wallets
    set timed_credits = timed_credits - v_take_timed,
        permanent_credits = permanent_credits - v_take_permanent,
        credits = (timed_credits - v_take_timed) + (permanent_credits - v_take_permanent),
        updated_at = now()
    where user_id = p_user_id
    returning * into v_wallet;

    insert into public.credit_ledger (user_id, amount, reason, metadata)
    values (
        p_user_id,
        -p_amount,
        p_reason,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
            'timed_spent', v_take_timed,
            'permanent_spent', v_take_permanent
        )
    );

    return jsonb_build_object(
        'timed_credits', v_wallet.timed_credits,
        'permanent_credits', v_wallet.permanent_credits,
        'total_credits', v_wallet.timed_credits + v_wallet.permanent_credits
    );
end;
$$;

drop function if exists public.add_credits(uuid, integer, text, jsonb);
create or replace function public.add_credits(
    p_user_id uuid,
    p_amount integer,
    p_reason text,
    p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_wallet public.wallets;
begin
    if p_amount <= 0 then
        raise exception 'INVALID_AMOUNT';
    end if;

    perform public.refresh_timed_credits(p_user_id);

    insert into public.wallets (user_id, permanent_credits, credits)
    values (p_user_id, p_amount, p_amount)
    on conflict (user_id)
    do update
    set permanent_credits = public.wallets.permanent_credits + p_amount,
        credits = public.wallets.timed_credits + public.wallets.permanent_credits + p_amount,
        updated_at = now()
    returning * into v_wallet;

    insert into public.credit_ledger (user_id, amount, reason, metadata)
    values (
        p_user_id,
        p_amount,
        p_reason,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('credit_bucket', 'permanent')
    );

    return jsonb_build_object(
        'timed_credits', v_wallet.timed_credits,
        'permanent_credits', v_wallet.permanent_credits,
        'total_credits', v_wallet.timed_credits + v_wallet.permanent_credits
    );
end;
$$;

create or replace function public.redeem_invite_code(
    p_user_id uuid,
    p_invite_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_inviter_id uuid;
    v_reward integer := 200;
    v_already_redeemed boolean;
begin
    if p_invite_code is null or length(trim(p_invite_code)) = 0 then
        raise exception 'INVALID_INVITE_CODE';
    end if;

    select invited_by is not null into v_already_redeemed
    from public.profiles
    where id = p_user_id;

    if v_already_redeemed then
        raise exception 'INVITE_ALREADY_REDEEMED';
    end if;

    select id into v_inviter_id
    from public.profiles
    where referral_code = trim(p_invite_code)
    limit 1;

    if v_inviter_id is null then
        raise exception 'INVITE_CODE_NOT_FOUND';
    end if;

    if v_inviter_id = p_user_id then
        raise exception 'SELF_INVITE_NOT_ALLOWED';
    end if;

    update public.profiles
    set invited_by = v_inviter_id,
        invite_redeemed_at = now(),
        updated_at = now()
    where id = p_user_id
      and invited_by is null;

    if not found then
        raise exception 'INVITE_ALREADY_REDEEMED';
    end if;

    insert into public.invite_rewards (inviter_id, invitee_id, reward_credits)
    values (v_inviter_id, p_user_id, v_reward)
    on conflict (invitee_id) do nothing;

    perform public.add_credits(
        v_inviter_id,
        v_reward,
        'invite_reward',
        jsonb_build_object('invitee_id', p_user_id)
    );

    return jsonb_build_object(
        'ok', true,
        'reward_credits', v_reward,
        'inviter_id', v_inviter_id
    );
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

    insert into public.wallets (user_id, permanent_credits, timed_credits, daily_credit_quota, credits, timed_credits_last_reset)
    values (new.id, 500, 0, 0, 500, (now() at time zone 'utc')::date)
    on conflict (user_id) do nothing;

    insert into public.credit_ledger (user_id, amount, reason, metadata)
    values (new.id, 500, 'signup_bonus', jsonb_build_object('source', 'auth_trigger', 'credit_bucket', 'permanent'))
    on conflict do nothing;

    return new;
end;
$$;

-- Keep the old credits field in sync for backward compatibility.
update public.wallets
set credits = permanent_credits + timed_credits,
    timed_credits_last_reset = coalesce(timed_credits_last_reset, (now() at time zone 'utc')::date),
    daily_credit_quota = coalesce(daily_credit_quota, 0);

commit;
