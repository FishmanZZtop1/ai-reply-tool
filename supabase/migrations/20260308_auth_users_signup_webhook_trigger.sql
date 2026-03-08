begin;

create extension if not exists pg_net with schema extensions;

create table if not exists public.system_settings (
    key text primary key,
    value text not null,
    updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

revoke all on table public.system_settings from anon;
revoke all on table public.system_settings from authenticated;

create or replace function public.forward_auth_user_to_signup_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_url text := '';
    v_secret text := '';
begin
    select value into v_url
    from public.system_settings
    where key = 'signup_webhook_url';

    select value into v_secret
    from public.system_settings
    where key = 'webhook_shared_secret';

    if tg_op <> 'INSERT' then
        return new;
    end if;

    if v_url = '' or v_secret = '' then
        return new;
    end if;

    perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-supabase-webhook-secret', v_secret
        ),
        body := jsonb_build_object(
            'type', tg_op,
            'schema', tg_table_schema,
            'table', tg_table_name,
            'record', jsonb_build_object(
                'id', new.id,
                'email', new.email
            )
        )
    );

    return new;
end;
$$;

drop trigger if exists ai_reply_auth_users_signup_webhook on auth.users;
create trigger ai_reply_auth_users_signup_webhook
after insert on auth.users
for each row
execute function public.forward_auth_user_to_signup_webhook();

commit;
