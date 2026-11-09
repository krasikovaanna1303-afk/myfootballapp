-- «ПОЛЕ»: неограниченная вместимость и безопасный список записавшихся игроков.
-- Выполнить один раз в Supabase SQL Editor проекта «ПОЛЕ».
-- Действующие игры и пользователи сохраняются.
begin;
alter table public.pole_games alter column capacity drop not null;
alter table public.pole_games drop constraint if exists pole_games_capacity_check;
alter table public.pole_games add constraint pole_games_capacity_check
  check (capacity is null or capacity between 2 and 100);

-- NULL = без ограничения количества участников. Функция сохраняет атомарную проверку мест.
create or replace function public.pole_join_game(p_game uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cap integer; v_count integer; v_user uuid;
begin
 v_user:=auth.uid();
 if v_user is null then raise exception 'Authentication required'; end if;
 select capacity into v_cap from public.pole_games where id=p_game for update;
 if not found then raise exception 'Game not found'; end if;
 if exists(select 1 from public.pole_game_members where game_id=p_game and user_id=v_user) then return; end if;
 if v_cap is not null then
   select count(*) into v_count from public.pole_game_members where game_id=p_game;
   if v_count>=v_cap then raise exception 'Game is full'; end if;
 end if;
 insert into public.pole_game_members(game_id,user_id) values(p_game,v_user);
end $$;

-- Показываем только данные анкет игроков, которые записались на игры.
-- Почта, пароли, номер телефона и другие данные Auth не раскрываются.
-- Читать список могут только вошедшие пользователи, не анонимные посетители.
create or replace function public.pole_game_rosters(p_games uuid[])
returns table (
 game_id uuid,
 user_id uuid,
 nickname text,
 age_at_registration integer,
 gender text,
 skill text,
 player_position text,
 city text,
 preferred_format text,
 joined_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_games is null or array_length(p_games,1) is null then return; end if;
 if array_length(p_games,1)>300 then raise exception 'Too many games requested'; end if;
 return query
 select m.game_id, m.user_id,
        coalesce(p.nickname,'Игрок')::text,
        p.age_years_at_registration, p.gender, p.skill, p.position,
        p.city, p.format, m.joined_at
 from public.pole_game_members m
 left join public.profiles p on p.id=m.user_id
 join public.pole_games g on g.id=m.game_id
 where m.game_id=any(p_games)
 order by m.game_id, m.joined_at;
end $$;

revoke all on function public.pole_game_rosters(uuid[]) from public, anon;
grant execute on function public.pole_game_rosters(uuid[]) to authenticated;
revoke all on function public.pole_join_game(uuid) from public, anon;
grant execute on function public.pole_join_game(uuid) to authenticated;
commit;
notify pgrst, 'reload schema';
