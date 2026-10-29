-- Выполни в SQL Editor своего проекта Supabase один раз.
-- E-mail/пароли хранит только Supabase Auth; не добавляй пароли в эту таблицу.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 40),
  age_years_at_registration integer check (age_years_at_registration between 16 and 100),
  registration_year integer not null default extract(year from now())::integer,
  gender text,
  skill text not null,
  position text,
  city text not null,
  format text,
  trips boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Создаём профиль из метаданных при регистрации, даже до подтверждения e-mail.
create or replace function public.handle_new_pole_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles
    (id,nickname,age_years_at_registration,gender,skill,position,city,format,trips)
  values
    (new.id,
     left(coalesce(nullif(new.raw_user_meta_data->>'nickname',''), 'Игрок'),40),
     nullif(new.raw_user_meta_data->>'age','')::integer,
     nullif(new.raw_user_meta_data->>'gender',''),
     coalesce(new.raw_user_meta_data->>'skill','Новичок'),
     nullif(new.raw_user_meta_data->>'position',''),
     coalesce(new.raw_user_meta_data->>'city',''),
     nullif(new.raw_user_meta_data->>'format',''),
     coalesce((new.raw_user_meta_data->>'trips')::boolean,false))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists pole_auth_new_user on auth.users;
create trigger pole_auth_new_user after insert on auth.users
for each row execute function public.handle_new_pole_user();
