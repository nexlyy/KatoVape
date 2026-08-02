-- Роль «управляющий», разграничение доступа и списание остатка при выдаче заказа.

-- ---------- TASK 1: роль owner_manager ----------
-- Управляющий делает всё то же, что владелец, кроме раздачи прав. Отдельная роль, а не
-- «владелец с флажком»: право выдавать доступ это единственное, что отличает их друг от друга,
-- и проверка должна называть это прямо.
alter table public.admins      drop constraint if exists admins_role_chk;
alter table public.admins      add  constraint admins_role_chk
  check (role in ('owner', 'owner_manager', 'dev', 'manager'));
alter table public.admin_users drop constraint if exists admin_users_role_chk;
alter table public.admin_users add  constraint admin_users_role_chk
  check (role in ('owner', 'owner_manager', 'dev', 'manager'));

-- Полный доступ: видит все города, весь склад, все деньги, все отчёты.
-- Раньше эту роль играла is_owner_or_dev(), и она же осталась в десятке политик, поэтому
-- смысл вынесен в отдельную функцию, а старое имя оставлено псевдонимом. Так добавление
-- четвёртой роли не потребовало переписывать политики, а название перестало врать.
create or replace function public.is_full_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.admin_role() in ('owner', 'owner_manager', 'dev'), false);
$$;
grant execute on function public.is_full_admin() to authenticated;

create or replace function public.is_owner_or_dev()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_full_admin();
$$;

-- Права раздаёт только владелец: управляющий сюда не входит намеренно.
create or replace function public.can_grant()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.admin_role() = 'owner', false);
$$;

-- Город: полный доступ видит все, менеджер только свой.
create or replace function public.admin_sees_city(p_city text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    public.is_admin() and (public.is_full_admin() or public.admin_city() = p_city),
    false);
$$;

-- Выдача доступа должна принимать новую роль.
create or replace function public.admin_grant(p_login text, p_role text default 'manager', p_city text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if not coalesce(public.can_grant(), false) then raise exception 'NOT_ALLOWED' using errcode = 'P0001'; end if;
  if p_role not in ('owner', 'owner_manager', 'dev', 'manager') then raise exception 'BAD_ROLE' using errcode = 'P0001'; end if;
  if p_role = 'manager' and (p_city is null or p_city = '') then raise exception 'CITY_REQUIRED' using errcode = 'P0001'; end if;

  select p.id, coalesce(nullif(p.display_name, ''), p.username) as who into v
    from public.profiles p
   where p.username = p_login or p.email = p_login or p.auth_email = p_login
   limit 1;
  if v is null then raise exception 'NO_USER' using errcode = 'P0001'; end if;

  insert into public.admin_users (user_id, role, city)
  values (v.id, p_role, case when p_role = 'manager' then p_city else null end)
  on conflict (user_id) do update set role = excluded.role, city = excluded.city;
  return v.who;
end;
$$;

-- Возвращает boolean, как и прежняя версия: менять тип возврата у существующей функции
-- нельзя, а панель уже проверяет ответ.
create or replace function public.admin_grant_telegram(p_tid bigint, p_role text default 'manager', p_city text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.can_grant(), false) then raise exception 'NOT_ALLOWED' using errcode = 'P0001'; end if;
  if p_role not in ('owner', 'owner_manager', 'dev', 'manager') then raise exception 'BAD_ROLE' using errcode = 'P0001'; end if;
  if p_role = 'manager' and (p_city is null or p_city = '') then raise exception 'CITY_REQUIRED' using errcode = 'P0001'; end if;

  insert into public.admins (telegram_id, role, city)
  values (p_tid, p_role, case when p_role = 'manager' then p_city else null end)
  on conflict (telegram_id) do update set role = excluded.role, city = excluded.city;
  return true;
end;
$$;

-- ---------- TASK 2: склад закрыт от рядового менеджера ----------
-- Поставки, партии и поставщики это закупочные цены, то есть маржа. Менеджеру города они
-- не показываются ни в интерфейсе, ни через API.
drop policy if exists supplies_staff on public.supplies;
create policy supplies_staff on public.supplies for all
  using (public.is_full_admin()) with check (public.is_full_admin());

drop policy if exists supply_lines_staff on public.supply_lines;
create policy supply_lines_staff on public.supply_lines for all
  using (public.is_full_admin()) with check (public.is_full_admin());

drop policy if exists batches_staff on public.batches;
create policy batches_staff on public.batches for select using (public.is_full_admin());

drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers for select using (public.is_full_admin());

drop policy if exists write_offs_staff on public.write_offs;
create policy write_offs_staff on public.write_offs for select using (public.is_full_admin());

-- Списывать товар менеджер по-прежнему может: это работа с полкой, а не с деньгами.
-- Функция сама проверяет город, стоимость считает по партиям и наружу её не отдаёт.

-- ---------- TASK 12: выдача заказа уменьшает остаток ----------
-- Продажа не трогала products.qty вовсе: остаток падал только от броней и списаний. Заказ
-- уходил, товар на витрине оставался. Теперь выдача и списывает партии (себестоимость),
-- и уменьшает наличие, одной транзакцией.
create or replace function public.orders_fulfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb; total numeric := 0; qty int;
begin
  if new.status <> 'done' or old.status = 'done' then return new; end if;

  for it in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    qty := greatest(coalesce((it->>'n')::int, 1), 1);

    -- себестоимость по партиям (FIFO)
    total := total + public.stock_consume(new.city, it->>'id', coalesce(it->>'flavor', ''), qty);

    -- и сам остаток на витрине
    update public.products
       set qty = greatest(coalesce(qty, 0) - orders_fulfil.qty, 0), updated_at = now()
     where id = it->>'id' and city = new.city and flavor = coalesce(it->>'flavor', '');
  end loop;

  if new.cogs is null then new.cogs := total; end if;
  return new;
end;
$$;

drop trigger if exists c_orders_cogs on public.orders;
drop trigger if exists c_orders_fulfil on public.orders;
create trigger c_orders_fulfil
  before update of status on public.orders
  for each row execute function public.orders_fulfil();

notify pgrst, 'reload schema';
