-- Склад и деньги: поставки партиями, списания, расходы.
--
-- Владелец хочет точную маржу, а она невозможна без закупочной цены, привязанной к конкретной
-- партии: одна и та же модель приходит по разной цене, и «средняя по больнице» врёт тем
-- сильнее, чем чаще меняется курс. Поэтому партии (FIFO): продали штуку, списали её из самой
-- старой партии по её цене.
--
-- Остаток в products трогать не перестаём: он рабочий, по нему живёт витрина. Партии это
-- отдельный слой стоимости поверх него, а не замена.

-- ---------- поставщики ----------
-- Минимальный справочник: без него у партии нельзя спросить, откуда она, и «сколько взяли
-- у этого поставщика за квартал» не посчитается никогда.
create table if not exists public.suppliers (
  id      bigint generated always as identity primary key,
  name    text not null,
  contact text,
  note    text,
  active  boolean not null default true,
  created_at timestamptz not null default now(),
  constraint suppliers_name_len check (length(btrim(name)) between 1 and 120)
);
alter table public.suppliers enable row level security;
drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers for select using (public.is_admin());
drop policy if exists suppliers_write on public.suppliers;
create policy suppliers_write on public.suppliers for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- ---------- поставка ----------
-- Документ, а не правка остатка руками: он и увеличивает наличие, и заводит партии со
-- своей ценой. Пока он в черновике, ничего не меняется, поэтому список можно набирать
-- спокойно и провести одним нажатием.
create table if not exists public.supplies (
  id          bigint generated always as identity primary key,
  city        text not null,
  supplier_id bigint references public.suppliers(id) on delete set null,
  doc_date    date not null default (now() at time zone 'Europe/Warsaw')::date,
  note        text,
  status      text not null default 'draft',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  posted_at   timestamptz,
  constraint supplies_city_chk check (city in ('katowice', 'gliwice', 'warszawa')),
  constraint supplies_status_chk check (status in ('draft', 'posted'))
);
create index if not exists supplies_city_idx on public.supplies (city, doc_date desc);
alter table public.supplies enable row level security;
drop policy if exists supplies_staff on public.supplies;
create policy supplies_staff on public.supplies for all
  using (public.admin_sees_city(city)) with check (public.admin_sees_city(city));

create table if not exists public.supply_lines (
  id         bigint generated always as identity primary key,
  supply_id  bigint not null references public.supplies(id) on delete cascade,
  product_id text not null,
  flavor     text not null default '',
  qty        int not null,
  cost       numeric(10,2) not null,
  constraint supply_lines_qty_chk  check (qty > 0 and qty <= 100000),
  constraint supply_lines_cost_chk check (cost >= 0)
);
create index if not exists supply_lines_doc_idx on public.supply_lines (supply_id);
alter table public.supply_lines enable row level security;
drop policy if exists supply_lines_staff on public.supply_lines;
create policy supply_lines_staff on public.supply_lines for all
  using (exists (select 1 from public.supplies s where s.id = supply_id and public.admin_sees_city(s.city)))
  with check (exists (select 1 from public.supplies s where s.id = supply_id and public.admin_sees_city(s.city)));

-- ---------- партии ----------
-- qty_left уменьшается по мере продаж и списаний. Когда он ноль, партия прожита.
create table if not exists public.batches (
  id         bigint generated always as identity primary key,
  city       text not null,
  product_id text not null,
  flavor     text not null default '',
  supply_id  bigint references public.supplies(id) on delete set null,
  qty_in     int not null,
  qty_left   int not null,
  cost       numeric(10,2) not null,
  created_at timestamptz not null default now(),
  constraint batches_qty_chk check (qty_in > 0 and qty_left >= 0 and qty_left <= qty_in)
);
create index if not exists batches_fifo_idx on public.batches (city, product_id, flavor, created_at)
  where qty_left > 0;
alter table public.batches enable row level security;
drop policy if exists batches_staff on public.batches;
create policy batches_staff on public.batches for select using (public.admin_sees_city(city));

-- ---------- списание ----------
-- Отдельного раздела в панели владелец не хотел, поэтому это кнопка в карточке товара.
-- Документом оно всё равно остаётся: списание меняет и склад, и деньги.
create table if not exists public.write_offs (
  id         bigint generated always as identity primary key,
  city       text not null,
  product_id text not null,
  flavor     text not null default '',
  qty        int not null,
  reason     text not null,
  note       text,
  cost       numeric(10,2) not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint write_offs_qty_chk check (qty > 0),
  constraint write_offs_reason_chk check (reason in ('broken', 'spoiled', 'shortage', 'own', 'other'))
);
create index if not exists write_offs_city_idx on public.write_offs (city, created_at desc);
alter table public.write_offs enable row level security;
drop policy if exists write_offs_staff on public.write_offs;
create policy write_offs_staff on public.write_offs for select using (public.admin_sees_city(city));

-- ---------- расходы ----------
create table if not exists public.expense_categories (
  id     smallint generated always as identity primary key,
  name   text not null unique,
  active boolean not null default true
);
alter table public.expense_categories enable row level security;
drop policy if exists exp_cat_read on public.expense_categories;
create policy exp_cat_read on public.expense_categories for select using (public.is_admin());
drop policy if exists exp_cat_write on public.expense_categories;
create policy exp_cat_write on public.expense_categories for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());
insert into public.expense_categories (name) values
  ('аренда'), ('закупка'), ('зарплата'), ('реклама'), ('доставка'), ('прочее')
  on conflict (name) do nothing;

create table if not exists public.expenses (
  id          bigint generated always as identity primary key,
  city        text,
  category_id smallint references public.expense_categories(id),
  at          date not null default (now() at time zone 'Europe/Warsaw')::date,
  amount      numeric(10,2) not null,
  note        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint expenses_amount_chk check (amount > 0),
  constraint expenses_city_chk check (city is null or city in ('katowice', 'gliwice', 'warszawa'))
);
create index if not exists expenses_at_idx on public.expenses (at desc);
alter table public.expenses enable row level security;
-- Расходы это деньги владельца: менеджер их не видит и не заводит.
drop policy if exists expenses_owner on public.expenses;
create policy expenses_owner on public.expenses for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- ---------- себестоимость на заказе ----------
alter table public.orders add column if not exists cogs numeric(10,2);

-- ---------- FIFO ----------
-- Съесть n штук из самых старых партий и вернуть их стоимость. Если партий не хватает
-- (товар лежал на полке ещё до учёта), берём сколько есть: продажу останавливать нельзя,
-- недостающее просто идёт с нулевой стоимостью и видно в отчёте как завышенная маржа.
create or replace function public.stock_consume(
  p_city text, p_product text, p_flavor text, p_qty int)
returns numeric language plpgsql security definer set search_path = public as $$
declare need int := p_qty; total numeric := 0; b record; take int;
begin
  for b in select id, qty_left, cost from public.batches
            where city = p_city and product_id = p_product and flavor = coalesce(p_flavor, '')
              and qty_left > 0
            order by created_at, id
  loop
    exit when need <= 0;
    take := least(need, b.qty_left);
    update public.batches set qty_left = qty_left - take where id = b.id;
    total := total + take * b.cost;
    need := need - take;
  end loop;
  return total;
end;
$$;
revoke execute on function public.stock_consume(text, text, text, int) from public, anon, authenticated;

-- Заказ стал выданным: списываем проданное с партий и запоминаем себестоимость.
create or replace function public.orders_cogs()
returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb; total numeric := 0;
begin
  if new.status <> 'done' or old.status = 'done' or new.cogs is not null then return new; end if;
  for it in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    total := total + public.stock_consume(
      new.city, it->>'id', coalesce(it->>'flavor', ''),
      greatest(coalesce((it->>'n')::int, 1), 1));
  end loop;
  new.cogs := total;
  return new;
end;
$$;

drop trigger if exists c_orders_cogs on public.orders;
create trigger c_orders_cogs
  before update of status on public.orders
  for each row execute function public.orders_cogs();

-- ---------- провести поставку ----------
create or replace function public.supply_post(p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare s record; l record; n int := 0; v_qty int;
begin
  select * into s from public.supplies where id = p_id;
  if s is null or not public.admin_sees_city(s.city) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if s.status = 'posted' then raise exception 'ALREADY_POSTED' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.supply_lines where supply_id = p_id) then
    raise exception 'EMPTY_SUPPLY' using errcode = 'P0001';
  end if;

  for l in select * from public.supply_lines where supply_id = p_id loop
    insert into public.batches (city, product_id, flavor, supply_id, qty_in, qty_left, cost)
    values (s.city, l.product_id, l.flavor, p_id, l.qty, l.qty, l.cost);

    -- остаток на витрине: строка товара может ещё не существовать, тогда её заводит поставка
    update public.products set qty = coalesce(qty, 0) + l.qty, updated_at = now()
     where id = l.product_id and city = s.city and flavor = l.flavor
    returning qty into v_qty;
    if v_qty is null then
      insert into public.products (id, city, flavor, name, qty, updated_at)
      values (l.product_id, s.city, l.flavor, l.product_id, l.qty, now())
      on conflict (id, city, flavor) do update set qty = public.products.qty + l.qty;
    end if;
    n := n + 1;
  end loop;

  update public.supplies set status = 'posted', posted_at = now() where id = p_id;
  perform public.audit('post', 'supply', p_id::text, json_build_object('lines', n)::jsonb);
  return json_build_object('lines', n);
end;
$$;
grant execute on function public.supply_post(bigint) to authenticated;

-- ---------- списать ----------
create or replace function public.write_off_add(
  p_city text, p_product text, p_flavor text, p_qty int, p_reason text, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_cost numeric; v_id bigint;
begin
  if not public.admin_sees_city(p_city) then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_qty, 0) <= 0 then raise exception 'BAD_QTY' using errcode = 'P0001'; end if;

  v_cost := public.stock_consume(p_city, p_product, coalesce(p_flavor, ''), p_qty);
  update public.products set qty = greatest(coalesce(qty, 0) - p_qty, 0), updated_at = now()
   where id = p_product and city = p_city and flavor = coalesce(p_flavor, '');

  insert into public.write_offs (city, product_id, flavor, qty, reason, note, cost, created_by)
  values (p_city, p_product, coalesce(p_flavor, ''), p_qty, p_reason, nullif(btrim(p_note), ''), v_cost, auth.uid())
  returning id into v_id;
  perform public.audit('write_off', 'product', p_product, json_build_object('qty', p_qty, 'reason', p_reason)::jsonb);
  return v_id;
end;
$$;
grant execute on function public.write_off_add(text, text, text, int, text, text) to authenticated;

-- ---------- отчёт по деньгам ----------
-- Владелец: раздельно по городам, но с общей картиной. Поэтому одна функция возвращает и
-- разбивку, и итог. Выручка это выданные заказы, наличные и карта вместе.
create or replace function public.fin_report(p_from date, p_to date)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;
  select json_build_object(
    'by_city', (
      select coalesce(json_agg(row_to_json(t) order by t.city), '[]'::json) from (
        select c.city,
               coalesce(o.revenue, 0)  as revenue,
               coalesce(o.cogs, 0)     as cogs,
               coalesce(o.revenue, 0) - coalesce(o.cogs, 0) as gross,
               coalesce(e.spent, 0)    as expenses,
               coalesce(w.lost, 0)     as write_offs,
               coalesce(o.revenue, 0) - coalesce(o.cogs, 0) - coalesce(e.spent, 0) - coalesce(w.lost, 0) as profit,
               coalesce(o.orders, 0)   as orders
          from (select unnest(array['katowice', 'gliwice', 'warszawa']) as city) c
          left join (select city, sum(sum) as revenue, sum(coalesce(cogs, 0)) as cogs, count(*) as orders
                       from public.orders
                      where status = 'done' and created_at::date between p_from and p_to
                      group by city) o on o.city = c.city
          left join (select city, sum(amount) as spent from public.expenses
                      where at between p_from and p_to group by city) e on e.city = c.city
          left join (select city, sum(cost) as lost from public.write_offs
                      where created_at::date between p_from and p_to group by city) w on w.city = c.city) t),
    'shared_expenses', (select coalesce(sum(amount), 0) from public.expenses
                         where city is null and at between p_from and p_to),
    'by_category', (
      select coalesce(json_agg(row_to_json(t) order by t.spent desc), '[]'::json) from (
        select coalesce(ec.name, 'без категории') as name, sum(e.amount) as spent
          from public.expenses e left join public.expense_categories ec on ec.id = e.category_id
         where e.at between p_from and p_to group by 1) t),
    'by_day', (
      select coalesce(json_agg(row_to_json(t) order by t.day), '[]'::json) from (
        select d::date as day,
               (select coalesce(sum(sum), 0) from public.orders
                 where status = 'done' and created_at::date = d::date) as revenue,
               (select coalesce(sum(amount), 0) from public.expenses where at = d::date) as spent
          from generate_series(p_from, p_to, interval '1 day') d) t)
  ) into res;
  return res;
end;
$$;
grant execute on function public.fin_report(date, date) to authenticated;

notify pgrst, 'reload schema';
