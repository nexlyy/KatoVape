-- KatoVape: рассылка может уходить всем или только клиентам одного города.
-- Город клиента известен из онбординга в боте (bot_users.city).
alter table public.broadcasts add column if not exists city text;
alter table public.broadcasts drop constraint if exists broadcasts_city_chk;
alter table public.broadcasts add constraint broadcasts_city_chk
  check (city is null or city in ('katowice', 'gliwice', 'warszawa'));

-- Менеджер видит и заводит рассылки только своего города, владелец и разработчик — любые.
drop policy if exists bc_admin on public.broadcasts;
create policy bc_admin on public.broadcasts
  for all using (public.is_admin() and (public.admin_city() is null or city is not distinct from public.admin_city()))
  with check (public.is_admin() and (public.admin_city() is null or city is not distinct from public.admin_city()));
