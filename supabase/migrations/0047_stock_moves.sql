-- Движение товара: приход, расход и остаток в динамике.
--
-- Остаток в products это одно число «сколько лежит сейчас». По нему нельзя ответить, откуда
-- он такой получился и каким был во вторник. Поставки, списания и заказы каждый ведут свой
-- документ, но собрать из них общую картину нельзя: остаток правят ещё и руками в карточке
-- товара, и синком из таблицы, а эти правки не оставляли следа вовсе.
--
-- Поэтому не отчёт поверх документов, а журнал: каждое изменение products.qty пишет строку с
-- разницей, причиной и остатком после. Тогда «остаток на конец дня» считается точно, а
-- расхождение с бумагой видно сразу, потому что ручная правка тоже попадает в журнал и
-- называется ручной правкой.

-- ---------- журнал ----------
create table if not exists public.stock_moves (
  id         bigint generated always as identity primary key,
  city       text not null,
  product_id text not null,
  flavor     text not null default '',
  delta      int not null,
  qty_after  int not null,
  -- init появляется один раз при заведении журнала, manual это правка остатка руками
  reason     text not null default 'manual',
  ref_id     bigint,
  cost       numeric(12,2),
  actor      uuid references public.profiles(id) on delete set null,
  at         timestamptz not null default now(),
  constraint stock_moves_reason_chk check (reason in
    ('init', 'supply', 'sale', 'write_off', 'reserve', 'reserve_return', 'manual'))
);
create index if not exists stock_moves_at_idx   on public.stock_moves (at desc);
create index if not exists stock_moves_city_idx on public.stock_moves (city, at desc);
create index if not exists stock_moves_prod_idx on public.stock_moves (product_id, flavor, at desc);

alter table public.stock_moves enable row level security;
-- В журнале лежит себестоимость движения, то есть закупочные цены. Менеджеру города их не
-- показываем, как и партии с поставками.
drop policy if exists stock_moves_read on public.stock_moves;
create policy stock_moves_read on public.stock_moves for select using (public.is_full_admin());

-- ---------- кто меняет остаток ----------
-- Триггер видит только новое и старое значение qty, а причину знает вызывающая функция.
-- Она объявляет её на время транзакции, триггер забирает и сбрасывать не обязан: следующая
-- функция объявит свою, а незаявленное изменение и есть ручная правка.
create or replace function public.stock_mark(p_reason text, p_ref bigint default null, p_cost numeric default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('kv.move_reason', coalesce(p_reason, ''), true);
  perform set_config('kv.move_ref', coalesce(p_ref::text, ''), true);
  perform set_config('kv.move_cost', coalesce(p_cost::text, ''), true);
end;
$$;
revoke execute on function public.stock_mark(text, bigint, numeric) from public, anon, authenticated;

create or replace function public.stock_unmark()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('kv.move_reason', '', true);
  perform set_config('kv.move_ref', '', true);
  perform set_config('kv.move_cost', '', true);
end;
$$;
revoke execute on function public.stock_unmark() from public, anon, authenticated;

create or replace function public.products_stock_move()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_delta int;
begin
  -- old на вставке не заполнен, и трогать его нельзя даже в неисполняемой ветке выражения:
  -- plpgsql подставляет запись до вычисления и падает на «record old is not assigned yet».
  if tg_op = 'INSERT' then
    v_delta := coalesce(new.qty, 0);
  else
    v_delta := coalesce(new.qty, 0) - coalesce(old.qty, 0);
  end if;
  if v_delta = 0 then return null; end if;

  insert into public.stock_moves (city, product_id, flavor, delta, qty_after, reason, ref_id, cost, actor)
  values (new.city, new.id, new.flavor, v_delta, coalesce(new.qty, 0),
          coalesce(nullif(current_setting('kv.move_reason', true), ''), 'manual'),
          nullif(current_setting('kv.move_ref', true), '')::bigint,
          nullif(current_setting('kv.move_cost', true), '')::numeric,
          auth.uid());
  return null;
end;
$$;
drop trigger if exists z_products_stock_move on public.products;
create trigger z_products_stock_move
  after insert or update of qty on public.products
  for each row execute function public.products_stock_move();

-- ---------- поставка называет себя приходом ----------
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

    perform public.stock_mark('supply', p_id, l.qty * l.cost);
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
  perform public.stock_unmark();

  update public.supplies set status = 'posted', posted_at = now() where id = p_id;
  perform public.audit('post', 'supply', p_id::text, json_build_object('lines', n)::jsonb);
  return json_build_object('lines', n);
end;
$$;
grant execute on function public.supply_post(bigint) to authenticated;

-- ---------- списание ----------
create or replace function public.write_off_add(
  p_city text, p_product text, p_flavor text, p_qty int, p_reason text, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_cost numeric; v_id bigint;
begin
  if not public.admin_sees_city(p_city) then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_qty, 0) <= 0 then raise exception 'BAD_QTY' using errcode = 'P0001'; end if;

  v_cost := public.stock_consume(p_city, p_product, coalesce(p_flavor, ''), p_qty);

  insert into public.write_offs (city, product_id, flavor, qty, reason, note, cost, created_by)
  values (p_city, p_product, coalesce(p_flavor, ''), p_qty, p_reason, nullif(btrim(p_note), ''), v_cost, auth.uid())
  returning id into v_id;

  perform public.stock_mark('write_off', v_id, v_cost);
  update public.products set qty = greatest(coalesce(qty, 0) - p_qty, 0), updated_at = now()
   where id = p_product and city = p_city and flavor = coalesce(p_flavor, '');
  perform public.stock_unmark();

  perform public.audit('write_off', 'product', p_product, json_build_object('qty', p_qty, 'reason', p_reason)::jsonb);
  return v_id;
end;
$$;
grant execute on function public.write_off_add(text, text, text, int, text, text) to authenticated;

-- ---------- выдача заказа ----------
-- Тело прежнее (0043), добавлена только разметка причины: расход по заказу должен называться
-- продажей, а не ручной правкой.
create or replace function public.orders_fulfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb; v_total numeric := 0; v_take int; v_cost numeric; v_items jsonb := '[]'::jsonb;
begin
  if new.status <> 'done' or old.status = 'done' then return new; end if;

  for it in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    v_take := greatest(coalesce((it->>'n')::int, 1), 1);
    v_cost := public.stock_consume(new.city, it->>'id', coalesce(it->>'flavor', ''), v_take);
    v_total := v_total + v_cost;

    perform public.stock_mark('sale', new.id, v_cost);
    update public.products p
       set qty = greatest(coalesce(p.qty, 0) - v_take, 0), updated_at = now()
     where p.id = it->>'id' and p.city = new.city and p.flavor = coalesce(it->>'flavor', '');

    -- Скобки тут обязательны. `||` левоассоциативен, а массив, склеенный с объектом, этот
    -- объект в себя добавляет. Без скобок выходило (массив || cost-category) || it, то есть
    -- ДВА элемента на позицию вместо одного: в составе заказа появлялись пустые строки, в
    -- аналитике товар без названия, а доля менеджера по категории считалась по общей ставке.
    -- Со скобками сперва сливаются два объекта, и в массив уходит один.
    v_items := v_items || (jsonb_build_object(
      'cost', v_cost,
      'category', (select p.category from public.products p
                    where p.id = it->>'id' and p.city = new.city limit 1)) || it);
  end loop;
  perform public.stock_unmark();

  new.items := v_items;
  if new.cogs is null then new.cogs := v_total; end if;
  return new;
end;
$$;

-- ---------- бронь ----------
-- Бронь снимает товар с полки в момент создания и возвращает при отмене. Это тоже движение,
-- и без него остаток по журналу разошёлся бы с настоящим.
create or replace function public.reservation_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'reserve' then
      perform public.stock_mark('reserve', new.id);
      update public.products set qty = greatest(qty - new.qty, 0), updated_at = now()
        where id = new.product_id and city = new.city and flavor = coalesce(new.flavor, '');
      perform public.stock_unmark();
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.kind = 'reserve'
     and old.status in ('active', 'notified') and new.status in ('cancelled', 'expired') then
    perform public.stock_mark('reserve_return', new.id);
    update public.products set qty = qty + new.qty, updated_at = now()
      where id = new.product_id and city = new.city and flavor = coalesce(new.flavor, '');
    perform public.stock_unmark();
    new.closed_at = now();
  end if;
  return new;
end;
$$;

-- ---------- точка отсчёта ----------
-- Журнал начинается с того, что лежит на полке сегодня, иначе первый же график покажет, будто
-- товар взялся из воздуха. Строка одна на позицию и заводится только раз.
insert into public.stock_moves (city, product_id, flavor, delta, qty_after, reason, at)
select p.city, p.id, p.flavor, p.qty, p.qty, 'init', coalesce(p.updated_at, now())
  from public.products p
 where p.qty <> 0
   and not exists (select 1 from public.stock_moves m
                    where m.city = p.city and m.product_id = p.id and m.flavor = p.flavor);

-- ---------- отчёт ----------
-- Одна функция на весь раздел: итоги, ряды для графиков, разбивка по городам, что двигалось
-- чаще всего и хвост журнала. Остаток на конец каждого дня считается не суммой строк за день,
-- а от сегодняшнего остатка назад: так он не зависит от того, с какой даты ведётся журнал.
create or replace function public.dash_stock(p_from timestamptz, p_to timestamptz, p_bucket text default 'day')
returns json language plpgsql stable security definer set search_path = public as $$
declare
  b text; v_now numeric; v_after numeric; v_stock_cost numeric;
  v_totals json; v_series json; v_city json; v_in json; v_out json; v_log json;
begin
  if not public.is_full_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  b := case when p_bucket = 'month' then 'month' else 'day' end;

  select coalesce(sum(qty), 0) into v_now from public.products;
  select coalesce(sum(delta), 0) into v_after from public.stock_moves where at >= p_to;

  -- Склад в деньгах: что лежит партиями, по цене партии, остальное по закупочной цене позиции.
  select coalesce(sum(bt.qty_left * bt.cost), 0) +
         coalesce((select sum(greatest(p.qty - coalesce(q.left_qty, 0), 0) * coalesce(p.cost, 0))
                     from public.products p
                     left join (select city, product_id, flavor, sum(qty_left) as left_qty
                                  from public.batches group by 1, 2, 3) q
                       on q.city = p.city and q.product_id = p.id and q.flavor = p.flavor), 0)
    into v_stock_cost from public.batches bt;

  select json_build_object(
    'in_qty',       coalesce(sum(delta) filter (where reason = 'supply'), 0),
    'in_cost',      coalesce(sum(cost)  filter (where reason = 'supply'), 0),
    'sold_qty',     coalesce(-sum(delta) filter (where reason = 'sale'), 0),
    'sold_cost',    coalesce(sum(cost)  filter (where reason = 'sale'), 0),
    'written_qty',  coalesce(-sum(delta) filter (where reason = 'write_off'), 0),
    'written_cost', coalesce(sum(cost)  filter (where reason = 'write_off'), 0),
    'reserved_qty', coalesce(-sum(delta) filter (where reason = 'reserve'), 0),
    'returned_qty', coalesce(sum(delta) filter (where reason = 'reserve_return'), 0),
    'manual_delta', coalesce(sum(delta) filter (where reason = 'manual'), 0),
    'manual_n',     count(*) filter (where reason = 'manual'),
    'stock_qty',    v_now,
    'stock_cost',   v_stock_cost)
    into v_totals
    from public.stock_moves where at >= p_from and at < p_to;

  select coalesce(json_agg(row_to_json(t) order by t.bucket), '[]'::json) into v_series from (
    select g.bucket::date as bucket,
           coalesce(m.in_qty, 0) as in_qty, coalesce(m.out_qty, 0) as out_qty,
           coalesce(m.sold_qty, 0) as sold_qty, coalesce(m.written_qty, 0) as written_qty,
           -- остаток на конец этого дня: сегодняшний минус всё, что случилось позже
           v_now - v_after - coalesce(sum(coalesce(m.delta, 0)) over (
             order by g.bucket desc rows between unbounded preceding and 1 preceding), 0) as left_qty
      from generate_series(date_trunc(b, p_from), date_trunc(b, p_to), ('1 ' || b)::interval) as g(bucket)
      left join (
        select date_trunc(b, at) as bucket,
               coalesce(sum(delta) filter (where delta > 0), 0)  as in_qty,
               coalesce(-sum(delta) filter (where delta < 0), 0) as out_qty,
               coalesce(-sum(delta) filter (where reason = 'sale'), 0)      as sold_qty,
               coalesce(-sum(delta) filter (where reason = 'write_off'), 0) as written_qty,
               coalesce(sum(delta), 0) as delta
          from public.stock_moves where at >= p_from and at < p_to group by 1) m
        on m.bucket = g.bucket) t;

  select coalesce(json_agg(row_to_json(t) order by t.city), '[]'::json) into v_city from (
    select c.city,
           coalesce(m.in_qty, 0) as in_qty, coalesce(m.sold_qty, 0) as sold_qty,
           coalesce(m.written_qty, 0) as written_qty, coalesce(s.qty, 0) as stock_qty
      from (select unnest(array['katowice', 'gliwice', 'warszawa']) as city) c
      left join (select city,
                        coalesce(sum(delta) filter (where reason = 'supply'), 0) as in_qty,
                        coalesce(-sum(delta) filter (where reason = 'sale'), 0) as sold_qty,
                        coalesce(-sum(delta) filter (where reason = 'write_off'), 0) as written_qty
                   from public.stock_moves where at >= p_from and at < p_to group by city) m on m.city = c.city
      left join (select city, sum(qty) as qty from public.products group by city) s on s.city = c.city) t;

  select coalesce(json_agg(row_to_json(t) order by t.qty desc), '[]'::json) into v_in from (
    select coalesce(max(p.name), m.product_id) as name, m.city, m.flavor, sum(m.delta) as qty
      from public.stock_moves m
      left join public.products p on p.id = m.product_id and p.city = m.city and p.flavor = m.flavor
     where m.at >= p_from and m.at < p_to and m.reason = 'supply'
     group by m.product_id, m.city, m.flavor
     order by sum(m.delta) desc limit 12) t;

  select coalesce(json_agg(row_to_json(t) order by t.qty desc), '[]'::json) into v_out from (
    select coalesce(max(p.name), m.product_id) as name, m.city, m.flavor, -sum(m.delta) as qty
      from public.stock_moves m
      left join public.products p on p.id = m.product_id and p.city = m.city and p.flavor = m.flavor
     where m.at >= p_from and m.at < p_to and m.reason in ('sale', 'write_off')
     group by m.product_id, m.city, m.flavor
     order by sum(-m.delta) desc limit 12) t;

  select coalesce(json_agg(row_to_json(t) order by t.at desc), '[]'::json) into v_log from (
    select m.at, m.city, m.reason, m.delta, m.qty_after, m.ref_id, m.flavor,
           coalesce(p.name, m.product_id) as name
      from public.stock_moves m
      left join public.products p on p.id = m.product_id and p.city = m.city and p.flavor = m.flavor
     where m.at >= p_from and m.at < p_to
     order by m.at desc limit 60) t;

  return json_build_object('totals', v_totals, 'series', v_series, 'by_city', v_city,
                           'top_in', v_in, 'top_out', v_out, 'moves', v_log);
end;
$$;
grant execute on function public.dash_stock(timestamptz, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';
