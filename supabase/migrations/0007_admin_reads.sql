-- KatoVape: админке нужно видеть подписчиков бота, чтобы показать охват рассылки.
-- RLS на bot_users включали без политик, поэтому чтение было закрыто вообще всем,
-- включая менеджеров. Открываем только на чтение и только админам.
drop policy if exists bot_users_admin_read on public.bot_users;
create policy bot_users_admin_read on public.bot_users
  for select using (public.is_admin());
