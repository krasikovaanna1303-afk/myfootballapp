-- ПОЛЕ: подробные объявления и приватные чаты участников матчей.
-- Один раз выполни целиком в Supabase SQL Editor после community.sql.
-- Существующие объявления, профили, игры и участники остаются на месте.
begin;

alter table public.pole_posts
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists contact_platform text,
  add column if not exists contact_handle text;

alter table public.pole_posts
  drop constraint if exists pole_posts_details_object_check;
alter table public.pole_posts
  add constraint pole_posts_details_object_check check(jsonb_typeof(details) = 'object');

alter table public.pole_posts
  drop constraint if exists pole_posts_contact_format_check;
alter table public.pole_posts
  add constraint pole_posts_contact_format_check check (
    (contact_platform is null and contact_handle is null)
    or (contact_platform = 'telegram' and contact_handle ~ '^[A-Za-z0-9_]{5,32}$')
    or (contact_platform = 'vk' and contact_handle ~ '^[A-Za-z0-9_.]{3,50}$')
  );

-- Переписка доступна только участникам конкретной игры.
-- Никаких открытых личных сообщений, внешних почтовых адресов и телефонов.
create table if not exists public.pole_game_messages (
 id uuid primary key default gen_random_uuid(),
 game_id uuid not null references public.pole_games(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);

create index if not exists pole_game_messages_recent_idx
 on public.pole_game_messages(game_id,created_at desc);

alter table public.pole_game_messages enable row level security;

drop policy if exists "game chat members read" on public.pole_game_messages;
create policy "game chat members read" on public.pole_game_messages
 for select to authenticated
 using (exists(
   select 1 from public.pole_game_members m
   where m.game_id=pole_game_messages.game_id
     and m.user_id=(select auth.uid())
 ));

drop policy if exists "game chat members send" on public.pole_game_messages;
create policy "game chat members send" on public.pole_game_messages
 for insert to authenticated
 with check (
   user_id=(select auth.uid())
   and exists(
     select 1 from public.pole_game_members m
     where m.game_id=pole_game_messages.game_id
       and m.user_id=(select auth.uid())
   )
 );

-- Даже зная ID игры, посторонний пользователь не может прочитать или написать.
revoke all on public.pole_game_messages from anon;
grant select,insert on public.pole_game_messages to authenticated;

commit;
notify pgrst, 'reload schema';
