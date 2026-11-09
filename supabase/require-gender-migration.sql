-- Для СУЩЕСТВУЮЩЕГО проекта Supabase. Выполнить в SQL Editor один раз.
-- Не подменяем пол зарегистрированных пользователей: старые NULL/other остаются без изменений.
-- NOT VALID проверяет новые записи и изменения, но не отвергает старые профили.
alter table public.profiles drop constraint if exists pole_profiles_gender_choices;
alter table public.profiles
 add constraint pole_profiles_gender_choices
 check (gender is not null and gender in ('female','male')) not valid;

-- Проверить устаревшие профили (если есть) перед последующей валидацией:
-- select id, gender from public.profiles where gender is null or gender not in ('female','male');
-- Когда пользователи самостоятельно обновят свои данные, можно выполнить:
-- alter table public.profiles validate constraint pole_profiles_gender_choices;
