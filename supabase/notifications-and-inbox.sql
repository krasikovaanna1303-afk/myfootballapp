-- ПОЛЕ: уведомления, личные сообщения и отклики на анкеты.
-- Выполнить в Supabase SQL Editor ПОСЛЕ community-messaging.sql.
-- Не удаляет существующих пользователей, игр, объявлений и сообщений.
begin;

create table if not exists public.pole_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check(kind in ('game_join','game_chat','direct_message','interest')),
  entity_id uuid,
  title text not null check(length(title) between 1 and 160),
  body text not null default '' check(length(body)<=300),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pole_notifications_recipient_idx
  on public.pole_notifications(recipient_id,created_at desc);
alter table public.pole_notifications enable row level security;
drop policy if exists "notifications own read" on public.pole_notifications;
create policy "notifications own read" on public.pole_notifications
  for select to authenticated using(recipient_id=(select auth.uid()));
drop policy if exists "notifications own mark read" on public.pole_notifications;
create policy "notifications own mark read" on public.pole_notifications
  for update to authenticated using(recipient_id=(select auth.uid()))
  with check(recipient_id=(select auth.uid()));
-- Пользователь не может создавать уведомления за другого.
revoke all on public.pole_notifications from anon,authenticated;
grant select on public.pole_notifications to authenticated;
grant update(is_read) on public.pole_notifications to authenticated;

create table if not exists public.pole_message_threads (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.pole_posts(id) on delete set null,
  starter_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check(length(subject) between 1 and 160),
  created_at timestamptz not null default now(),
  constraint pole_message_thread_participants_differ check(starter_id<>owner_id),
  constraint pole_message_thread_unique unique(post_id,starter_id)
);
create index if not exists pole_message_threads_starter_idx on public.pole_message_threads(starter_id,created_at desc);
create index if not exists pole_message_threads_owner_idx on public.pole_message_threads(owner_id,created_at desc);
alter table public.pole_message_threads enable row level security;
drop policy if exists "threads participants read" on public.pole_message_threads;
create policy "threads participants read" on public.pole_message_threads
  for select to authenticated using(starter_id=(select auth.uid()) or owner_id=(select auth.uid()));
drop policy if exists "threads start at published post" on public.pole_message_threads;
create policy "threads start at published post" on public.pole_message_threads
  for insert to authenticated with check(
    starter_id=(select auth.uid()) and post_id is not null
    and exists(select 1 from public.pole_posts p where p.id=post_id and p.creator_id=owner_id)
  );
revoke all on public.pole_message_threads from anon;
grant select,insert on public.pole_message_threads to authenticated;

create table if not exists public.pole_direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.pole_message_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists pole_direct_messages_thread_idx on public.pole_direct_messages(thread_id,created_at desc);
alter table public.pole_direct_messages enable row level security;
drop policy if exists "direct messages participants read" on public.pole_direct_messages;
create policy "direct messages participants read" on public.pole_direct_messages
  for select to authenticated using(exists(
    select 1 from public.pole_message_threads t where t.id=thread_id
      and ((select auth.uid())=t.starter_id or (select auth.uid())=t.owner_id)
  ));
drop policy if exists "direct messages participants send" on public.pole_direct_messages;
create policy "direct messages participants send" on public.pole_direct_messages
  for insert to authenticated with check(
    sender_id=(select auth.uid()) and exists(
      select 1 from public.pole_message_threads t where t.id=thread_id
        and (sender_id=t.starter_id or sender_id=t.owner_id)
    )
  );
revoke all on public.pole_direct_messages from anon;
grant select,insert on public.pole_direct_messages to authenticated;

create table if not exists public.pole_post_interests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.pole_posts(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id,actor_id)
);
alter table public.pole_post_interests enable row level security;
drop policy if exists "interests participants read" on public.pole_post_interests;
create policy "interests participants read" on public.pole_post_interests
  for select to authenticated using(
    actor_id=(select auth.uid()) or exists(
      select 1 from public.pole_posts p where p.id=post_id and p.creator_id=(select auth.uid())
    )
  );
drop policy if exists "interests send to player posts" on public.pole_post_interests;
create policy "interests send to player posts" on public.pole_post_interests
  for insert to authenticated with check(
    actor_id=(select auth.uid()) and exists(
      select 1 from public.pole_posts p where p.id=post_id and p.type='player'
        and p.creator_id<>(select auth.uid())
    )
  );
revoke all on public.pole_post_interests from anon;
grant select,insert on public.pole_post_interests to authenticated;

-- SECURITY DEFINER нужен только триггерам: клиент не может подделать получателя.
create or replace function public.pole_notify_game_join()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.pole_notifications(recipient_id,actor_id,kind,entity_id,title,body)
  select g.creator_id,new.user_id,'game_join',g.id,'К твоей игре присоединились',
         left(g.title,200)
  from public.pole_games g where g.id=new.game_id and g.creator_id<>new.user_id;
  return new;
end; $$;
drop trigger if exists pole_notification_game_join on public.pole_game_members;
create trigger pole_notification_game_join after insert on public.pole_game_members
for each row execute function public.pole_notify_game_join();

create or replace function public.pole_notify_game_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.pole_notifications(recipient_id,actor_id,kind,entity_id,title,body)
  select m.user_id,new.user_id,'game_chat',new.game_id,'Новое сообщение в чате игры',
         left(g.title,200)
  from public.pole_game_members m join public.pole_games g on g.id=m.game_id
  where m.game_id=new.game_id and m.user_id<>new.user_id;
  return new;
end; $$;
drop trigger if exists pole_notification_game_chat on public.pole_game_messages;
create trigger pole_notification_game_chat after insert on public.pole_game_messages
for each row execute function public.pole_notify_game_message();

create or replace function public.pole_notify_direct_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.pole_notifications(recipient_id,actor_id,kind,entity_id,title,body)
  select case when new.sender_id=t.starter_id then t.owner_id else t.starter_id end,
         new.sender_id,'direct_message',t.id,'Тебе написали',left(t.subject,200)
  from public.pole_message_threads t where t.id=new.thread_id;
  return new;
end; $$;
drop trigger if exists pole_notification_direct_message on public.pole_direct_messages;
create trigger pole_notification_direct_message after insert on public.pole_direct_messages
for each row execute function public.pole_notify_direct_message();

create or replace function public.pole_notify_interest()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.pole_message_threads(post_id,starter_id,owner_id,subject)
  select p.id,new.actor_id,p.creator_id,left(p.title,160)
  from public.pole_posts p where p.id=new.post_id and p.creator_id<>new.actor_id
  on conflict(post_id,starter_id) do nothing;
  insert into public.pole_notifications(recipient_id,actor_id,kind,entity_id,title,body)
  select p.creator_id,new.actor_id,'interest',p.id,'Твоей кандидатурой заинтересовались',
         left(p.title,200)
  from public.pole_posts p where p.id=new.post_id and p.creator_id<>new.actor_id;
  return new;
end; $$;
drop trigger if exists pole_notification_interest on public.pole_post_interests;
create trigger pole_notification_interest after insert on public.pole_post_interests
for each row execute function public.pole_notify_interest();

-- Realtime работает при включённой репликации; интерфейс также опрашивает базу.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and
     not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
       and schemaname='public' and tablename='pole_notifications') then
    alter publication supabase_realtime add table public.pole_notifications;
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
