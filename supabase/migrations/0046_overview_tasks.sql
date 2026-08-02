-- Счётчик открытых напоминаний в сводке: без него раздел не подсвечивается и о задаче
-- вспоминают, только когда бот уже написал.
create or replace function public.admin_overview()
returns json language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then json_build_object(
    'role', public.admin_role(),
    'city', public.admin_city(),
    'can_grant', public.can_grant(),
    'users', (select count(*) from public.profiles),
    'orders', (select count(*) from public.orders o where public.admin_sees_city(o.city)),
    'orders_new', (select count(*) from public.orders o where o.status = 'new' and public.admin_sees_city(o.city)),
    'reservations', (select count(*) from public.reservations r where r.kind = 'reserve' and public.admin_sees_city(r.city)),
    'res_active', (select count(*) from public.reservations r where r.kind = 'reserve' and r.status in ('active', 'notified') and public.admin_sees_city(r.city)),
    'waiting', (select count(*) from public.reservations r where r.kind = 'notify' and r.status = 'waiting' and public.admin_sees_city(r.city)),
    'reviews', (select count(*) from public.reviews),
    'bot_users', (select count(*) from public.bot_users),
    'tasks_open', (select count(*) from public.tasks t where t.done = false and public.admin_sees_city(t.city))
  ) else null end;
$$;

notify pgrst, 'reload schema';
