-- ПОЛЕ: подписки браузеров на настоящие фоновые Web Push.
-- Выполнить после notifications-and-inbox.sql. Существующие данные не трогаем.
begin;

create table if not exists public.pole_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint) between 30 and 2048),
 p256dh text not null check(length(p256dh) between 60 and 200),
 auth_secret text not null check(length(auth_secret) between 15 and 100),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists pole_push_subscriptions_user_idx
 on public.pole_push_subscriptions(user_id,updated_at desc);
alter table public.pole_push_subscriptions enable row level security;

drop policy if exists "push subscription own read" on public.pole_push_subscriptions;
create policy "push subscription own read" on public.pole_push_subscriptions
 for select to authenticated using(user_id=(select auth.uid()));

-- Клиенту запрещено напрямую создавать или переназначать чужие подписки.
revoke all on public.pole_push_subscriptions from anon,authenticated;
grant select on public.pole_push_subscriptions to authenticated;

-- Повторная регистрация устройства привязывает endpoint к текущему пользователю.
-- Это предотвращает отправку личных push предыдущего аккаунта после смены входа.
create or replace function public.pole_register_push_subscription(
 p_endpoint text,p_p256dh text,p_auth_secret text
) returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
 v_user:=auth.uid();
 if v_user is null then raise exception 'Sign in required'; end if;
 if p_endpoint is null or length(p_endpoint) not between 30 and 2048
    or p_endpoint !~ '^https://[^[:space:]]+$'
    or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{60,200}$'
    or p_auth_secret is null or p_auth_secret !~ '^[A-Za-z0-9_-]{15,100}$'
 then raise exception 'Invalid Web Push subscription'; end if;

 insert into public.pole_push_subscriptions(user_id,endpoint,p256dh,auth_secret)
 values(v_user,p_endpoint,p_p256dh,p_auth_secret)
 on conflict(endpoint) do update set
   user_id=excluded.user_id,p256dh=excluded.p256dh,
   auth_secret=excluded.auth_secret,updated_at=now();

 -- Не больше 5 устройств на аккаунт: устаревшие подписки удаляем.
 delete from public.pole_push_subscriptions p
 where p.user_id=v_user and p.id in (
   select old.id from public.pole_push_subscriptions old
   where old.user_id=v_user order by old.updated_at desc,old.id desc offset 5
 );
end $$;

create or replace function public.pole_unregister_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 delete from public.pole_push_subscriptions
 where endpoint=p_endpoint and user_id=auth.uid();
end $$;

revoke all on function public.pole_register_push_subscription(text,text,text) from public,anon;
revoke all on function public.pole_unregister_push_subscription(text) from public,anon;
grant execute on function public.pole_register_push_subscription(text,text,text) to authenticated;
grant execute on function public.pole_unregister_push_subscription(text) to authenticated;

commit;
notify pgrst,'reload schema';
