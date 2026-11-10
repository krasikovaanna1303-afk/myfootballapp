-- ПОЛЕ: подробные параметры матчей для поиска и карточек.
-- Выполнить один раз ПОСЛЕ community.sql и unlimited-games-and-rosters.sql.
-- Старые игры и участники сохраняются. NULL у старых записей означает «не указано».
begin;

alter table public.pole_games
 add column if not exists city text,
 add column if not exists game_format text,
 add column if not exists skill_level text,
 add column if not exists participant_group text,
 add column if not exists age_group text,
 add column if not exists fee_amount integer;

alter table public.pole_games drop constraint if exists pole_games_city_length;
alter table public.pole_games add constraint pole_games_city_length
 check (city is null or char_length(city)<=80);

alter table public.pole_games drop constraint if exists pole_games_game_format_valid;
alter table public.pole_games add constraint pole_games_game_format_valid
 check (game_format is null or game_format in ('3v3','4v4','5v5','6v6','7v7','8v8','11v11','any'));

alter table public.pole_games drop constraint if exists pole_games_skill_valid;
alter table public.pole_games add constraint pole_games_skill_valid
 check (skill_level is null or skill_level in ('new','amateur','confident','advanced','any'));

alter table public.pole_games drop constraint if exists pole_games_participants_valid;
alter table public.pole_games add constraint pole_games_participants_valid
 check (participant_group is null or participant_group in ('female','male','mixed','any'));

alter table public.pole_games drop constraint if exists pole_games_age_valid;
alter table public.pole_games add constraint pole_games_age_valid
 check (age_group is null or age_group in ('under18','18-24','25-34','35-44','45+','any'));

alter table public.pole_games drop constraint if exists pole_games_fee_valid;
alter table public.pole_games add constraint pole_games_fee_valid
 check (fee_amount is null or fee_amount between 0 and 100000);

create index if not exists pole_games_city_date_idx on public.pole_games(city,game_date);

commit;
notify pgrst, 'reload schema';
