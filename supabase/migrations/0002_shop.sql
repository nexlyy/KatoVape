-- KatoVape: витринная часть в Supabase (поверх 0001_auth.sql).
-- Мини-апп и админка ходят в Supabase напрямую (RLS), бот на VPS — по service_role.
-- Сервер остаётся чисто ботом: он читает pending-задания отсюда (рассылки, синк),
-- шлёт уведомления о поступлении. Ничего веб-facing на сервере не нужно.

create extension if not exists pgcrypto;

-- ---- админы (Telegram ID) ----
create table if not exists public.admins (
  telegram_id bigint primary key,
  note        text,
  added_at    timestamptz not null default now()
);
insert into public.admins (telegram_id, note) values (5301671230, 'owner')
  on conflict (telegram_id) do nothing;

-- текущий пользователь — админ? (по telegram_id из его профиля)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    join public.profiles p on p.telegram_id = a.telegram_id
    where p.id = auth.uid());
$$;

-- ---- кто нажал /start у бота ----
create table if not exists public.bot_users (
  telegram_id bigint primary key,
  username    text,
  first_name  text,
  lang        text,
  opted_in    boolean not null default true,
  first_seen  timestamptz not null default now()
);

-- ---- ассортимент (зеркало Google Sheets) ----
create table if not exists public.products (
  id         text not null,
  city       text not null,
  category   text,
  name       text,
  brand      text,
  flavor     text not null default '',
  price      integer,
  qty        integer not null default 0,
  nic        text,
  updated_at timestamptz not null default now(),
  primary key (id, city, flavor)
);
alter table public.products enable row level security;
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (true);   -- каталог публичный

-- ---- бронь ----
create table if not exists public.reservations (
  id           bigint generated always as identity primary key,
  user_id      uuid references public.profiles(id) on delete set null,
  telegram_id  bigint,                              -- для брони по диплинку (без профиля)
  city         text not null default 'katowice',
  product_id   text not null,
  product_name text,
  flavor       text not null default '',
  status       text not null default 'waiting',
  created_at   timestamptz not null default now(),
  notified_at  timestamptz
);
alter table public.reservations enable row level security;
drop policy if exists res_own_ins on public.reservations;
create policy res_own_ins on public.reservations for insert with check (auth.uid() = user_id);
drop policy if exists res_own_sel on public.reservations;
create policy res_own_sel on public.reservations for select using (auth.uid() = user_id or public.is_admin());

-- ---- заказы ----
create table if not exists public.orders (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  city        text not null default 'katowice',
  items       jsonb not null default '[]',
  sum         integer not null default 0,
  delivery    text,
  address     text,
  status      text not null default 'new',
  created_at  timestamptz not null default now()
);
alter table public.orders enable row level security;
drop policy if exists ord_own_ins on public.orders;
create policy ord_own_ins on public.orders for insert with check (auth.uid() = user_id);
drop policy if exists ord_own_sel on public.orders;
create policy ord_own_sel on public.orders for select using (auth.uid() = user_id or public.is_admin());

-- ---- рассылки (админ создаёт pending, бот отправляет) ----
create table if not exists public.broadcasts (
  id         bigint generated always as identity primary key,
  author     uuid references public.profiles(id) on delete set null,
  text       text not null,
  audience   text not null default 'all',
  status     text not null default 'pending',   -- pending | sending | done
  sent       integer not null default 0,
  failed     integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
alter table public.broadcasts enable row level security;
drop policy if exists bc_admin on public.broadcasts;
create policy bc_admin on public.broadcasts for all using (public.is_admin()) with check (public.is_admin());

-- ---- задания синка ассортимента (админ жмёт кнопку, бот выполняет) ----
create table if not exists public.sync_jobs (
  id          bigint generated always as identity primary key,
  requested_by uuid references public.profiles(id) on delete set null,
  status      text not null default 'pending',   -- pending | done | error
  rows        integer,
  message     text,
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);
alter table public.sync_jobs enable row level security;
drop policy if exists sj_admin on public.sync_jobs;
create policy sj_admin on public.sync_jobs for all using (public.is_admin()) with check (public.is_admin());

-- ---- спрос ----
create table if not exists public.demand (
  product_id text not null,
  event      text not null,
  n          integer not null default 0,
  primary key (product_id, event)
);
alter table public.demand enable row level security;
drop policy if exists demand_admin on public.demand;
create policy demand_admin on public.demand for select using (public.is_admin());

-- бампнуть спрос из мини-аппа (любой залогиненный)
create or replace function public.bump_demand(p_product text, p_event text)
returns void language sql security definer set search_path = public as $$
  insert into public.demand (product_id, event, n) values (p_product, p_event, 1)
  on conflict (product_id, event) do update set n = public.demand.n + 1;
$$;
grant execute on function public.bump_demand(text, text) to authenticated;

-- сводка для админки одним запросом
create or replace function public.admin_overview()
returns json language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then json_build_object(
    'users', (select count(*) from public.profiles),
    'orders', (select count(*) from public.orders),
    'reservations', (select count(*) from public.reservations),
    'waiting', (select count(*) from public.reservations where status='waiting'),
    'bot_users', (select count(*) from public.bot_users)
  ) else null end;
$$;
grant execute on function public.admin_overview() to authenticated;

-- админ читает клиентов (профили) — через функцию, чтобы не открывать всю таблицу
create or replace function public.admin_customers()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where public.is_admin() order by created_at desc limit 500;
$$;
grant execute on function public.admin_customers() to authenticated;

-- список броней, чей товар снова в наличии (для бота, service_role). Возвращает
-- telegram_id получателя (из брони или из профиля) и название товара.
create or replace function public.restock_list()
returns table(id bigint, telegram_id bigint, product_name text)
language sql stable security definer set search_path = public as $$
  select r.id,
         coalesce(r.telegram_id, p.telegram_id) as telegram_id,
         coalesce(r.product_name, r.product_id) as product_name
  from public.reservations r
  left join public.profiles p on p.id = r.user_id
  join public.products pr on pr.id = r.product_id and pr.city = r.city
    and (r.flavor = '' or pr.flavor = r.flavor)
  where r.status = 'waiting' and pr.qty > 0
    and coalesce(r.telegram_id, p.telegram_id) is not null
  group by r.id, telegram_id, product_name;
$$;
