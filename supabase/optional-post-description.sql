-- ПОЛЕ: поле «Дополнительная информация» в объявлениях становится необязательным.
-- Выполнить один раз в Supabase SQL Editor.
-- Существующие объявления и их тексты сохраняются, ничего не удаляется.
begin;
alter table public.pole_posts
 drop constraint if exists pole_posts_description_check;
alter table public.pole_posts
 drop constraint if exists pole_posts_description_length_check;
alter table public.pole_posts
 add constraint pole_posts_description_length_check
 check (char_length(description) <= 2000);
alter table public.pole_posts
 alter column description set default '';
commit;
notify pgrst, 'reload schema';
