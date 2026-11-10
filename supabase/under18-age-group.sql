-- ПОЛЕ: новая возрастная категория «До 18 лет» для аккаунтов команд.
-- Выполнить ОДИН раз после profiles-teams-avatars.sql.
-- Пользователи, команды и объявления остаются без изменений.
begin;
alter table public.pole_teams
  drop constraint if exists pole_teams_age_group_check;
alter table public.pole_teams
  add constraint pole_teams_age_group_check
  check (age_group in ('under18','any','18-24','25-34','35-44','45+'));
commit;
notify pgrst, 'reload schema';
