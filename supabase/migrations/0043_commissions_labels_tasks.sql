-- Комиссии по категориям, клиенты из всех источников, метки товара и напоминания менеджеру.

-- ---------- TASK 3: категории как справочник ----------
-- Проценты задаются по категориям, и категории не должны быть зашиты в код: добавили
-- «энергетики» строкой в таблицу, и они сами появились в настройке ставок.
create table if not exists public.product_categories (
  id      text primary key,
  name_ru text not null,
  name_uk text not null,
  name_pl text not null,
  sort    int  not null default 100,
  active  boolean not null default true
);
alter table public.product_categories enable row level security;
drop policy if exists prod_cat_read on public.product_categories;
create policy prod_cat_read on public.product_categories for select using (true);
drop policy if exists prod_cat_write on public.product_categories;
create policy prod_cat_write on public.product_categories for all
  using (public.is_full_admin()) with check (public.is_full_admin());

insert into public.product_categories (id, name_ru, name_uk, name_pl, sort) values
  ('liquids',     'Жидкости',    'Рідини',      'Liquidy',        10),
  ('disposables', 'Одноразки',   'Одноразки',   'Jednorazowe',    20),
  ('snus',        'Снюс',        'Снюс',        'Woreczki',       30),
  ('cartridges',  'Картриджи',   'Картриджі',   'Kartridże',      40),
  ('pods',        'Под-системы', 'Под-системи', 'Pody',           50)
on conflict (id) do nothing;

-- ---------- TASK 3: ставка на категорию ----------
-- Пустая категория означает «на всё остальное»: так можно задать одну общую ставку и
-- переопределить её там, где договорённость другая.
alter table public.manager_rates add column if not exists category text
  references public.product_categories(id) on delete cascade;
alter table public.manager_rates drop constraint if exists manager_rates_uniq;
create unique index if not exists manager_rates_uniq
  on public.manager_rates (telegram_id, city, coalesce(category, ''), from_date);

-- Ставка, действовавшая в этот день для этой категории: сперва точная, потом общая.
create or replace function public.rate_at(p_tg bigint, p_city text, p_day date, p_category text default null)
returns table(percent numeric, base text)
language sql stable security definer set search_path = public as $$
  select r.percent, r.base from public.manager_rates r
   where r.telegram_id = p_tg and r.city = p_city and r.from_date <= p_day
     and (r.category is not distinct from p_category or r.category is null)
   order by (r.category is not null) desc, r.from_date desc
   limit 1;
$$;
revoke execute on function public.rate_at(bigint, text, date, text) from public, anon, authenticated;

-- ---------- себестоимость по строкам ----------
-- Чтобы считать долю по категориям, нужна закупка на каждую позицию, а не общая сумма по
-- заказу. При выдаче записываем её прямо в строку состава.
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

    update public.products p
       set qty = greatest(coalesce(p.qty, 0) - v_take, 0), updated_at = now()
     where p.id = it->>'id' and p.city = new.city and p.flavor = coalesce(it->>'flavor', '');

    v_items := v_items || jsonb_build_object(
      'cost', v_cost,
      'category', (select p.category from public.products p
                    where p.id = it->>'id' and p.city = new.city limit 1)) || it;
  end loop;

  new.items := v_items;
  if new.cogs is null then new.cogs := v_total; end if;
  return new;
end;
$$;

-- Доля менеджера считается по строкам заказа: у каждой своя категория и своя ставка.
create or replace function public.manager_payouts(p_from date, p_to date)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_full_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(json_agg(row_to_json(t) order by t.city, t.telegram_id), '[]'::json) into res from (
    select m.telegram_id, m.city,
           coalesce(sum(l.base_sum), 0) as base_sum,
           coalesce(sum(l.payout), 0)   as payout,
           count(distinct l.order_id)   as orders
      from (select distinct telegram_id, city from public.manager_rates) m
      left join lateral (
        select ord.id as order_id,
               case when r.base = 'revenue' then coalesce((i->>'sum')::numeric, 0)
                    else coalesce((i->>'sum')::numeric, 0) - coalesce((i->>'cost')::numeric, 0) end as base_sum,
               round((case when r.base = 'revenue' then coalesce((i->>'sum')::numeric, 0)
                           else coalesce((i->>'sum')::numeric, 0) - coalesce((i->>'cost')::numeric, 0) end)
                     * r.percent / 100, 2) as payout
          from public.orders ord
          cross join lateral jsonb_array_elements(coalesce(ord.items, '[]'::jsonb)) i
          cross join lateral public.rate_at(m.telegram_id, m.city, ord.created_at::date, i->>'category') r
         where ord.city = m.city and ord.status = 'done'
           and ord.created_at::date between p_from and p_to
      ) l on true
     group by m.telegram_id, m.city) t;
  return res;
end;
$$;
grant execute on function public.manager_payouts(date, date) to authenticated;

-- ---------- TASK 4: клиент из любого источника ----------
-- Карточка заводилась только на заказ или бронь, поэтому зарегистрировавшийся на сайте и
-- запустивший бота в списке клиентов не появлялись.
create or replace function public.profiles_to_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.crm_touch_contact(coalesce(new.city, 'katowice'),
    coalesce(new.full_name, new.display_name, ''), coalesce(new.phone, ''),
    coalesce(new.email, ''), new.telegram_id, new.id);
  return new;
end;
$$;
drop trigger if exists z_profiles_to_contact on public.profiles;
create trigger z_profiles_to_contact
  after insert or update of phone, email, full_name, telegram_id on public.profiles
  for each row execute function public.profiles_to_contact();

create or replace function public.bot_users_to_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.crm_touch_contact(coalesce(new.city, 'katowice'),
    coalesce(new.full_name, new.first_name, ''), coalesce(new.phone, ''),
    coalesce(new.email, ''), new.telegram_id, null);
  return new;
end;
$$;
drop trigger if exists z_bot_users_to_contact on public.bot_users;
create trigger z_bot_users_to_contact
  after insert or update of phone, email, full_name, city on public.bot_users
  for each row execute function public.bot_users_to_contact();

-- Разовое дозаполнение теми, кто уже есть.
create or replace function public.crm_backfill()
returns json language plpgsql security definer set search_path = public as $$
declare v_made int := 0; v_linked int := 0; r record;
begin
  if not public.is_full_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  for r in select coalesce(city, 'katowice') as city, coalesce(full_name, display_name, '') as nm,
                  coalesce(phone, '') as ph, coalesce(email, '') as em, telegram_id, id
             from public.profiles loop
    perform public.crm_touch_contact(r.city, r.nm, r.ph, r.em, r.telegram_id, r.id);
    v_made := v_made + 1;
  end loop;

  for r in select coalesce(city, 'katowice') as city, coalesce(full_name, first_name, '') as nm,
                  coalesce(phone, '') as ph, coalesce(email, '') as em, telegram_id
             from public.bot_users loop
    perform public.crm_touch_contact(r.city, r.nm, r.ph, r.em, r.telegram_id, null);
    v_made := v_made + 1;
  end loop;

  update public.orders o set contact_id = c.id
    from public.contacts c
   where o.contact_id is null
     and ((o.user_id is not null and c.user_id = o.user_id)
       or (o.telegram_id is not null and c.telegram_id = o.telegram_id));
  get diagnostics v_linked = row_count;

  return json_build_object('touched', v_made, 'orders_linked', v_linked);
end;
$$;
grant execute on function public.crm_backfill() to authenticated;

-- ---------- TASK 11: метки товара ----------
-- Была одна булева «хит». Меток теперь набор, и новую добавляет строка в этом списке, а не
-- новая колонка.
alter table public.products add column if not exists labels text[] not null default '{}';
update public.products set labels = array['hit'] where hit is true and not ('hit' = any(labels));

create or replace function public.products_labels_sync()
returns trigger language plpgsql set search_path = public as $$
begin
  new.labels := coalesce(new.labels, '{}');
  -- Витрина и синк из таблицы ещё читают hit: держим его в согласии с набором меток,
  -- чтобы старый код не разошёлся с новым.
  new.hit := 'hit' = any(new.labels);
  return new;
end;
$$;
drop trigger if exists a_products_labels on public.products;
create trigger a_products_labels
  before insert or update of labels on public.products
  for each row execute function public.products_labels_sync();

-- ---------- TASK 9: напоминания менеджеру ----------
create table if not exists public.tasks (
  id          bigint generated always as identity primary key,
  city        text not null,
  telegram_id bigint,
  title       text not null,
  body        text,
  due_at      timestamptz not null,
  order_id    bigint references public.orders(id) on delete set null,
  kind        text not null default 'custom',
  done        boolean not null default false,
  notified_at timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint tasks_city_chk  check (city in ('katowice', 'gliwice', 'warszawa')),
  constraint tasks_title_len check (length(btrim(title)) between 1 and 200),
  constraint tasks_kind_chk  check (kind in ('call', 'address', 'follow_up', 'custom', 'order_stuck'))
);
create index if not exists tasks_due_idx on public.tasks (done, due_at);
alter table public.tasks enable row level security;
drop policy if exists tasks_staff on public.tasks;
create policy tasks_staff on public.tasks for all
  using (public.admin_sees_city(city)) with check (public.admin_sees_city(city));

notify pgrst, 'reload schema';
