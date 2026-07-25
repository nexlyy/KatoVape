-- KatoVape: доступ менеджеров разделён по городам.
-- Менеджер привязан к своему городу: видит и правит только его ассортимент, заказы и брони,
-- уведомления о заказах получает только по своему городу. У владельца и разработчика город
-- пустой (null) — это значит «все города».
-- Раздел «Доступ» остаётся только владельцу: разработчик и менеджер туда не заходят.

alter table public.admins      add column if not exists city text;
alter table public.admin_users add column if not exists city text;

alter table public.admins      drop constraint if exists admins_city_chk;
alter table public.admins      add constraint admins_city_chk
  check (city is null or city in ('katowice', 'gliwice', 'warszawa'));
alter table public.admin_users drop constraint if exists admin_users_city_chk;
alter table public.admin_users add constraint admin_users_city_chk
  check (city is null or city in ('katowice', 'gliwice', 'warszawa'));

-- город текущего пользователя: null = доступ ко всем городам (владелец, разработчик)
create or replace function public.admin_city()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.city from public.admins a
       join public.profiles p on p.telegram_id = a.telegram_id
      where p.id = auth.uid() limit 1),
    (select au.city from public.admin_users au where au.user_id = auth.uid() limit 1)
  );
$$;
grant execute on function public.admin_city() to authenticated;

-- выдавать и снимать доступ может ТОЛЬКО владелец (раньше мог и разработчик)
create or replace function public.can_grant()
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_role() = 'owner';
$$;
grant execute on function public.can_grant() to authenticated;

-- Строка доступна текущему админу: владелец и разработчик видят все города, менеджер —
-- только свой. Привязка идёт от РОЛИ, а не от пустого города: у менеджера без назначенного
-- города доступа к данным нет вовсе (иначе пустой city читался бы как «все города»).
create or replace function public.admin_sees_city(p_city text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and (
    public.admin_role() in ('owner', 'dev') or public.admin_city() = p_city
  );
$$;
grant execute on function public.admin_sees_city(text) to authenticated;

-- ---- список доступа и выдача прав: теперь с городом ----
drop function if exists public.admin_access_list();
create or replace function public.admin_access_list()
returns table(kind text, who text, ident text, role text, city text, added_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'telegram', coalesce(p.display_name, p.username, 'ещё не заходил'),
         a.telegram_id::text, a.role, a.city, a.added_at
    from public.admins a
    left join public.profiles p on p.telegram_id = a.telegram_id
   where public.is_admin()
  union all
  select 'password', coalesce(p.display_name, p.username, '—'),
         coalesce(p.username, p.email, p.id::text), au.role, au.city, au.added_at
    from public.admin_users au
    join public.profiles p on p.id = au.user_id
   where public.is_admin()
  order by added_at;
$$;
grant execute on function public.admin_access_list() to authenticated;

-- Старые версии сносим явно: иначе прежняя admin_grant(text, text) осталась бы рядом с
-- новой и выигрывала бы по числу аргументов, то есть город бы не сохранялся.
drop function if exists public.admin_grant(text, text);
drop function if exists public.admin_grant_telegram(bigint, text);

create or replace function public.admin_grant(p_login text, p_role text default 'manager', p_city text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_city text;
begin
  if not public.can_grant() then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'dev', 'manager') then raise exception 'BAD_ROLE'; end if;
  -- город обязателен менеджеру и не имеет смысла у владельца с разработчиком
  v_city := case when p_role = 'manager' then nullif(p_city, '') else null end;
  if p_role = 'manager' and v_city is null then raise exception 'CITY_REQUIRED'; end if;
  select id, coalesce(display_name, username) into v_id, v_name
    from public.profiles
   where username = p_login::citext or email = p_login::citext
   limit 1;
  if v_id is null then raise exception 'NO_USER'; end if;
  insert into public.admin_users (user_id, note, role, city) values (v_id, 'выдан из панели', p_role, v_city)
    on conflict (user_id) do update set role = excluded.role, city = excluded.city;
  return coalesce(v_name, p_login);
end;
$$;
grant execute on function public.admin_grant(text, text, text) to authenticated;

create or replace function public.admin_grant_telegram(p_tid bigint, p_role text default 'manager', p_city text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_city text;
begin
  if not public.can_grant() then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'dev', 'manager') then raise exception 'BAD_ROLE'; end if;
  v_city := case when p_role = 'manager' then nullif(p_city, '') else null end;
  if p_role = 'manager' and v_city is null then raise exception 'CITY_REQUIRED'; end if;
  insert into public.admins (telegram_id, note, role, city) values (p_tid, 'выдан из панели', p_role, v_city)
    on conflict (telegram_id) do update set role = excluded.role, city = excluded.city;
  return true;
end;
$$;
grant execute on function public.admin_grant_telegram(bigint, text, text) to authenticated;

-- ---- видимость данных: менеджер работает только со своим городом ----
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products
  for all using (public.admin_sees_city(city)) with check (public.admin_sees_city(city));

drop policy if exists ord_own_sel on public.orders;
create policy ord_own_sel on public.orders
  for select using (auth.uid() = user_id or public.admin_sees_city(city));

drop policy if exists ord_admin_upd on public.orders;
create policy ord_admin_upd on public.orders
  for update using (public.admin_sees_city(city)) with check (public.admin_sees_city(city));

drop policy if exists res_own_sel on public.reservations;
create policy res_own_sel on public.reservations
  for select using (auth.uid() = user_id or public.admin_sees_city(city));

-- статусы броней (выдана, отмена) менеджер меняет только в своём городе;
-- без этого прежняя политика на is_admin() пускала бы его в чужие города
drop policy if exists res_admin_upd on public.reservations;
create policy res_admin_upd on public.reservations
  for update using (public.admin_sees_city(city)) with check (public.admin_sees_city(city));

-- сводка отдаёт роль и город, панель по ним решает, что показывать
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
    'bot_users', (select count(*) from public.bot_users)
  ) else null end;
$$;
grant execute on function public.admin_overview() to authenticated;

-- расстановка менеджеров по городам, о которой договорились
insert into public.admins (telegram_id, note, role, city) values
  (5301671230, 'nexrsy',            'dev',     null),
  (8108651376, 'Elfbaro Manager',   'owner',   null),
  (855010368,  'Менеджер Катовице', 'manager', 'katowice'),
  (8658843544, 'Менеджер Варшава',  'manager', 'warszawa'),
  (6017482088, 'Менеджер Гливице',  'manager', 'gliwice')
on conflict (telegram_id) do update set role = excluded.role, note = excluded.note, city = excluded.city;
