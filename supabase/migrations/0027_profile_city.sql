-- KatoVape: город из анкеты бота доезжает до витрины.
--
-- Человек выбирает город при первом запуске бота (bot_users.city), а мини-апп открывался
-- с тем городом, что остался в localStorage телефона от прошлой сессии — то есть чужим.
-- Профиль про город не знал вовсе, потому что колонки не было.
alter table public.profiles add column if not exists city text;
alter table public.profiles drop constraint if exists profiles_city_chk;
alter table public.profiles add constraint profiles_city_chk
  check (city is null or city in ('katowice', 'gliwice', 'warszawa'));

-- человек правит свой город сам, переключателем в шапке
grant update (city) on table public.profiles to authenticated;

-- переносим уже собранные ботом города тем, у кого профиль пустой
update public.profiles p set city = b.city
  from public.bot_users b
 where b.telegram_id = p.telegram_id
   and p.city is null
   and b.city is not null;

notify pgrst, 'reload schema';
