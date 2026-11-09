-- ПОЛЕ: shared community backend. Execute AFTER supabase/schema.sql.
-- Authentication handled by Supabase Auth; public client uses ONLY publishable key.
create table if not exists public.pole_games (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references auth.users(id) on delete cascade,
 field_id text not null check(length(field_id) between 1 and 120),
 field_name text not null check(length(field_name) between 1 and 200),
 title text not null check(length(title) between 2 and 120),
 game_date date not null,
 game_time time not null,
 capacity integer not null check(capacity between 2 and 100),
 description text not null default '' check(length(description)<=1500),
 organizer text not null check(length(organizer) between 1 and 80),
 created_at timestamptz not null default now()
);
create table if not exists public.pole_game_members (
 game_id uuid not null references public.pole_games(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(game_id,user_id)
);
create table if not exists public.pole_posts (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references auth.users(id) on delete cascade,
 type text not null check(type in ('player','team','tournament')),
 title text not null check(length(title) between 2 and 100),
 city text not null check(length(city) between 2 and 80),
 event_date date,
 description text not null check(length(description) between 10 and 2000),
 author text not null check(length(author) between 1 and 80),
 created_at timestamptz not null default now()
);
create table if not exists public.pole_moderators (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.pole_field_feedback (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references auth.users(id) on delete cascade,
 field_id text not null check(length(field_id) between 1 and 120),
 kind text not null check(kind in ('edit','review')),
 surface text,
 lighting text check(lighting in ('yes','no','unknown')),
 access text check(access in ('free','paid','private','unknown')),
 rating integer check(rating between 1 and 5),
 message text not null check(length(message) between 10 and 1500),
 author text not null check(length(author) between 1 and 80),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint rating_only_on_review check((kind='review' and rating is not null) or (kind='edit' and rating is null))
);
create index if not exists pole_games_field_date_idx on public.pole_games(field_id,game_date);
create index if not exists pole_feedback_field_idx on public.pole_field_feedback(field_id,status);
create index if not exists pole_posts_city_idx on public.pole_posts(city,type);
alter table public.pole_games enable row level security;
alter table public.pole_game_members enable row level security;
alter table public.pole_posts enable row level security;
alter table public.pole_moderators enable row level security;
alter table public.pole_field_feedback enable row level security;
drop policy if exists "games public read" on public.pole_games;
create policy "games public read" on public.pole_games for select to anon,authenticated using(true);
drop policy if exists "games creator insert" on public.pole_games;
create policy "games creator insert" on public.pole_games for insert to authenticated with check(creator_id=(select auth.uid()));
drop policy if exists "games creator delete" on public.pole_games;
create policy "games creator delete" on public.pole_games for delete to authenticated using(creator_id=(select auth.uid()));
drop policy if exists "game member public read" on public.pole_game_members;
create policy "game member public read" on public.pole_game_members for select to anon,authenticated using(true);
-- No direct member writes: RPC below enforces capacity atomically.
drop policy if exists "posts public read" on public.pole_posts;
create policy "posts public read" on public.pole_posts for select to anon,authenticated using(true);
drop policy if exists "posts self insert" on public.pole_posts;
create policy "posts self insert" on public.pole_posts for insert to authenticated with check(creator_id=(select auth.uid()));
drop policy if exists "posts self delete" on public.pole_posts;
create policy "posts self delete" on public.pole_posts for delete to authenticated using(creator_id=(select auth.uid()));
drop policy if exists "moderators self read" on public.pole_moderators;
create policy "moderators self read" on public.pole_moderators for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "feedback approved or self or moderator read" on public.pole_field_feedback;
create policy "feedback approved or self or moderator read" on public.pole_field_feedback
 for select to anon,authenticated using(
 status='approved' or creator_id=(select auth.uid())
 or exists(select 1 from public.pole_moderators m where m.user_id=(select auth.uid()))
);
drop policy if exists "feedback self submit" on public.pole_field_feedback;
create policy "feedback self submit" on public.pole_field_feedback
 for insert to authenticated with check(creator_id=(select auth.uid()) and status='pending' and reviewed_at is null);
drop policy if exists "feedback moderator update" on public.pole_field_feedback;
create policy "feedback moderator update" on public.pole_field_feedback
 for update to authenticated
 using(exists(select 1 from public.pole_moderators m where m.user_id=(select auth.uid())))
 with check(exists(select 1 from public.pole_moderators m where m.user_id=(select auth.uid())));
-- Atomic membership and capacity checks; only signed-in users.
create or replace function public.pole_join_game(p_game uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cap integer; v_count integer; v_user uuid;
begin
 v_user:=auth.uid();
 if v_user is null then raise exception 'Authentication required'; end if;
 select capacity into v_cap from public.pole_games where id=p_game for update;
 if not found then raise exception 'Game not found'; end if;
 if exists(select 1 from public.pole_game_members where game_id=p_game and user_id=v_user) then return; end if;
 select count(*) into v_count from public.pole_game_members where game_id=p_game;
 if v_count>=v_cap then raise exception 'Game is full'; end if;
 insert into public.pole_game_members(game_id,user_id) values(p_game,v_user);
end $$;
create or replace function public.pole_leave_game(p_game uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 delete from public.pole_game_members where game_id=p_game and user_id=auth.uid();
end $$;
revoke all on function public.pole_join_game(uuid) from public,anon;
revoke all on function public.pole_leave_game(uuid) from public,anon;
grant execute on function public.pole_join_game(uuid) to authenticated;
grant execute on function public.pole_leave_game(uuid) to authenticated;
-- Admin-only SQL: insert a moderator via trusted SQL editor:
-- insert into public.pole_moderators(user_id) values('ACCOUNT-UUID-HERE');
-- IMPORTANT: Publishing/approval requires an authenticated moderator and review UI.
