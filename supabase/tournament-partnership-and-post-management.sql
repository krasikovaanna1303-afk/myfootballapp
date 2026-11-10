-- ПОЛЕ: платная модель размещения турниров и управление своими объявлениями.
-- Выполни ОДИН РАЗ в Supabase SQL Editor после community.sql / community-messaging.sql.
-- Не удаляет существующие турниры, игры, аккаунты или объявления.
-- Новые турниры не публикуются пользователями напрямую; заявки приватны до ручного согласования.
begin;

-- 1. Безопасное создание: игроки/команды размещают только обычные объявления.
-- Турнирные записи может создать модератор после отдельного подтверждения условий.
alter table public.pole_posts enable row level security;
drop policy if exists "posts self insert" on public.pole_posts;
create policy "posts self insert" on public.pole_posts
 for insert to authenticated
 with check (
  creator_id=(select auth.uid())
  and (
   type in ('player','team')
   or (
    type='tournament'
    and exists (
     select 1 from public.pole_moderators m
     where m.user_id=(select auth.uid())
    )
   )
  )
 );

-- 2. Автор может править текст, даты и параметры своего объявления,
-- но не владельца, тип (в частности, обычное объявление нельзя превратить
-- в бесплатный турнир), аватар, статус или другие служебные поля.
drop policy if exists "posts self update" on public.pole_posts;
create policy "posts self update" on public.pole_posts
 for update to authenticated
 using (creator_id=(select auth.uid()))
 with check (creator_id=(select auth.uid()));
revoke update on public.pole_posts from public, anon, authenticated;
grant update (title,city,event_date,description,details,contact_platform,contact_handle)
 on public.pole_posts to authenticated;
grant select,insert,delete on public.pole_posts to authenticated;
-- Политика удаления "posts self delete" уже есть в community.sql; повторим её безопасно.
drop policy if exists "posts self delete" on public.pole_posts;
create policy "posts self delete" on public.pole_posts
 for delete to authenticated using (creator_id=(select auth.uid()));

-- 3. Приватные заявки на коммерческое сотрудничество.
-- Контакты доступны только подавшему заявку и модераторам ПОЛЯ.
create table if not exists public.pole_partner_requests (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('tournament','venue')),
 entity text not null check(char_length(btrim(entity)) between 2 and 120),
 city text not null check(char_length(btrim(city)) between 2 and 80),
 person text not null check(char_length(btrim(person)) between 2 and 80),
 contact text not null check(char_length(btrim(contact)) between 3 and 160),
 start_date date,
 end_date date,
 url text check(url is null or char_length(url)<=500),
 details text not null check(char_length(btrim(details)) between 10 and 1600),
 status text not null default 'pending' check(status in ('pending','contacted','closed')),
 created_at timestamptz not null default now(),
 constraint partner_request_dates check(end_date is null or (start_date is not null and end_date>=start_date))
);
create index if not exists pole_partner_requests_status_idx
 on public.pole_partner_requests(status,created_at desc);
alter table public.pole_partner_requests enable row level security;
drop policy if exists "partner request own or moderator read" on public.pole_partner_requests;
create policy "partner request own or moderator read" on public.pole_partner_requests
 for select to authenticated using (
  requester_id=(select auth.uid())
  or exists (
   select 1 from public.pole_moderators m
   where m.user_id=(select auth.uid())
  )
 );
drop policy if exists "partner request submit" on public.pole_partner_requests;
create policy "partner request submit" on public.pole_partner_requests
 for insert to authenticated with check (
  requester_id=(select auth.uid()) and status='pending'
 );
drop policy if exists "partner request moderator status" on public.pole_partner_requests;
create policy "partner request moderator status" on public.pole_partner_requests
 for update to authenticated using (
  exists (select 1 from public.pole_moderators m where m.user_id=(select auth.uid()))
 ) with check (
  exists (select 1 from public.pole_moderators m where m.user_id=(select auth.uid()))
 );
revoke all on public.pole_partner_requests from public,anon,authenticated;
grant select,insert on public.pole_partner_requests to authenticated;
grant update(status) on public.pole_partner_requests to authenticated;

commit;
notify pgrst, 'reload schema';
