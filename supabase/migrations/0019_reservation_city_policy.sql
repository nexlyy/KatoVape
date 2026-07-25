-- KatoVape: статусы броней менеджер меняет только в своём городе.
-- Отдельным файлом, а не правкой 0017: та миграция могла быть уже применена, и дописанное
-- в неё условие просто не выполнилось бы. Тогда осталась бы старая политика из 0003_tz.sql
-- (update по is_admin()), и менеджер Катовице мог бы вслепую закрыть бронь Варшавы —
-- заодно дёрнув триггер возврата остатка в чужом городе.
drop policy if exists res_admin_upd on public.reservations;
create policy res_admin_upd on public.reservations
  for update using (public.admin_sees_city(city)) with check (public.admin_sees_city(city));
