-- ПОЛЕ: регистрация команд, несколько игровых форматов, необязательные фотографии.
-- Выполнить один раз в Supabase SQL Editor после предыдущих миграций.
-- Не удаляет существующих игроков, объявления, игры или переписку.
begin;
alter table public.profiles add column if not exists formats text[] not null default array[]::text[];
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_path text;
update public.profiles set formats=array[format]
 where cardinality(formats)=0 and format in ('any','5v5','6v6','7v7','8v8','11v11');
alter table public.profiles drop constraint if exists pole_formats_valid;
alter table public.profiles add constraint pole_formats_valid
 check (formats <@ array['any','5v5','6v6','7v7','8v8','11v11']::text[]
        and cardinality(formats)<=5 and (not ('any'=any(formats)) or cardinality(formats)=1));
alter table public.profiles drop constraint if exists pole_bio_length;
alter table public.profiles add constraint pole_bio_length check(char_length(bio)<=500);

create table if not exists public.pole_teams (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 2 and 100),
 city text not null check(char_length(city) between 2 and 80),
 gender text not null check(gender in ('female','male','any')),
 female_team_kind text check(female_team_kind in ('regular','moms')),
 age_group text not null default 'any' check(age_group in ('any','18-24','25-34','35-44','45+')),
 formats text[] not null default array['any']::text[],
 bio text not null default '' check(char_length(bio)<=500),
 avatar_path text,
 updated_at timestamptz not null default now(),
 constraint pole_team_female_kind check(gender='female' or female_team_kind is null),
 constraint pole_team_formats check(formats <@ array['any','5v5','6v6','7v7','8v8','11v11']::text[]
       and cardinality(formats) between 1 and 5 and (not ('any'=any(formats)) or cardinality(formats)=1))
);
alter table public.pole_teams enable row level security;
grant select,insert,update on public.pole_teams to authenticated;
drop policy if exists "team own read" on public.pole_teams;
create policy "team own read" on public.pole_teams for select to authenticated using(id=(select auth.uid()));
drop policy if exists "team own insert" on public.pole_teams;
create policy "team own insert" on public.pole_teams for insert to authenticated with check(id=(select auth.uid()));
drop policy if exists "team own update" on public.pole_teams;
create policy "team own update" on public.pole_teams for update to authenticated
 using(id=(select auth.uid())) with check(id=(select auth.uid()));

-- Фотографии в объявлениях публикуются только после добровольной загрузки.
alter table public.pole_posts add column if not exists avatar_path text;
alter table public.pole_posts drop constraint if exists pole_post_avatar_path;
alter table public.pole_posts add constraint pole_post_avatar_path
 check(avatar_path is null or (char_length(avatar_path)<=250 and avatar_path !~ '\.\.'));

-- Обновляем функцию триггера регистрации. Роль закрепляется таблицей; старые профили остаются без изменений.
create or replace function public.handle_new_pole_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_formats text[];
begin
 select coalesce(array_agg(j.code),array[]::text[]) into v_formats
 from jsonb_array_elements_text(
   case when jsonb_typeof(new.raw_user_meta_data->'formats')='array'
        then new.raw_user_meta_data->'formats' else '[]'::jsonb end
 ) as j(code);
 if cardinality(v_formats)=0 then
   v_formats:=array[coalesce(nullif(new.raw_user_meta_data->>'format',''),'any')];
 end if;
 if new.raw_user_meta_data->>'account_type'='team' then
   insert into public.pole_teams
    (id,name,city,gender,female_team_kind,age_group,formats,bio)
   values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'team_name',''),'Команда'),100),
    left(coalesce(new.raw_user_meta_data->>'city',''),80),
    coalesce(nullif(new.raw_user_meta_data->>'team_gender',''),'any'),
    case when new.raw_user_meta_data->>'team_gender'='female'
         then nullif(new.raw_user_meta_data->>'female_team_kind','') else null end,
    coalesce(nullif(new.raw_user_meta_data->>'age_group',''),'any'),
    v_formats,
    left(coalesce(new.raw_user_meta_data->>'bio',''),500)
   ) on conflict(id) do nothing;
 else
   insert into public.profiles
    (id,nickname,age_years_at_registration,gender,skill,position,city,format,formats,trips,bio)
   values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'nickname',''),'Игрок'),40),
    nullif(new.raw_user_meta_data->>'age','')::integer,
    nullif(new.raw_user_meta_data->>'gender',''),
    coalesce(new.raw_user_meta_data->>'skill','new'),
    nullif(new.raw_user_meta_data->>'position',''),
    coalesce(new.raw_user_meta_data->>'city',''),
    v_formats[1],
    v_formats,
    coalesce((new.raw_user_meta_data->>'trips')::boolean,false),
    left(coalesce(new.raw_user_meta_data->>'bio',''),500)
   ) on conflict(id) do nothing;
 end if;
 return new;
end $$;

-- Новая версия RPC (старую не трогаем ради совместимости).
create or replace function public.pole_game_rosters_v2(p_games uuid[])
returns table (
 game_id uuid,user_id uuid,nickname text,age_at_registration integer,
 gender text,skill text,player_position text,city text,
 preferred_format text,avatar_path text,joined_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_games is null or cardinality(p_games)=0 then return; end if;
 if cardinality(p_games)>300 then raise exception 'Too many games requested'; end if;
 return query
 select m.game_id,m.user_id,
   coalesce(p.nickname,t.name,'Игрок')::text,
   p.age_years_at_registration,p.gender,p.skill,p.position,
   coalesce(p.city,t.city)::text,
   coalesce(array_to_string(p.formats,', '),p.format,array_to_string(t.formats,', '))::text,
   coalesce(p.avatar_path,t.avatar_path)::text,m.joined_at
 from public.pole_game_members m
 left join public.profiles p on p.id=m.user_id
 left join public.pole_teams t on t.id=m.user_id
 where m.game_id=any(p_games)
 order by m.game_id,m.joined_at;
end $$;
revoke all on function public.pole_game_rosters_v2(uuid[]) from public,anon;
grant execute on function public.pole_game_rosters_v2(uuid[]) to authenticated;

-- Bucket public: загруженное фото смогут видеть посетители объявления или состава игры.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('pole-avatars','pole-avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set
 public=true,file_size_limit=2097152,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "pole avatar owner upload" on storage.objects;
create policy "pole avatar owner upload" on storage.objects
 for insert to authenticated with check(
 bucket_id='pole-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists "pole avatar owner delete" on storage.objects;
create policy "pole avatar owner delete" on storage.objects
 for delete to authenticated using(
 bucket_id='pole-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
-- Обновление имени и аватарки в уже опубликованных объявлениях только их автором.
create or replace function public.pole_sync_own_post_profile()
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text; v_avatar text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select coalesce(p.nickname,t.name),coalesce(p.avatar_path,t.avatar_path)
 into v_name,v_avatar
 from auth.users a
 left join public.profiles p on p.id=a.id
 left join public.pole_teams t on t.id=a.id
 where a.id=auth.uid();
 if v_name is null then raise exception 'Profile not found'; end if;
 update public.pole_posts set author=v_name,avatar_path=v_avatar
 where creator_id=auth.uid();
end $$;
revoke all on function public.pole_sync_own_post_profile() from public,anon;
grant execute on function public.pole_sync_own_post_profile() to authenticated;

commit;
notify pgrst, 'reload schema';
