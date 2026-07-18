-- KatoVape: полная схема одним файлом (0001..0004).
-- Supabase Dashboard -> SQL Editor -> New query -> вставить всё -> Run.
-- Безопасно прогонять повторно (create if not exists / or replace / drop if exists).


-- ==================== 0001_auth.sql ====================

-- KatoVape: схема авторизации.
-- Пароли и сессии ведёт сам Supabase Auth (bcrypt + JWT, шифрование данных на его стороне).
-- Здесь только профиль поверх auth.users, уникальность логинов и безопасные RPC.

create extension if not exists citext;

-- профиль пользователя
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  username          citext unique,
  email             citext unique,
  phone             text   unique,
  auth_email        citext not null,
  telegram_id       bigint unique,
  telegram_username text,
  display_name      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);


create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, auth_email, username, email, phone, telegram_id, telegram_username, display_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'email_real', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    (nullif(new.raw_user_meta_data->>'telegram_id', ''))::bigint,
    nullif(new.raw_user_meta_data->>'telegram_username', ''),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(new.raw_user_meta_data->>'username', ''))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.login_availability(p_username citext, p_email citext, p_phone text)
returns table(username_taken boolean, email_taken boolean, phone_taken boolean)
language sql
security definer set search_path = public
as $$
  select
    (p_username is not null and exists(select 1 from public.profiles where username = p_username)),
    (p_email    is not null and exists(select 1 from public.profiles where email = p_email)),
    (p_phone    is not null and exists(select 1 from public.profiles where phone = p_phone));
$$;

create or replace function public.resolve_login(p_identifier text)
returns text
language sql
security definer set search_path = public
as $$
  select auth_email from public.profiles
  where username = p_identifier::citext
     or email    = p_identifier::citext
     or phone    = p_identifier
  limit 1;
$$;

grant execute on function public.login_availability(citext, citext, text) to anon, authenticated;
grant execute on function public.resolve_login(text) to anon, authenticated;


-- ==================== 0002_shop.sql ====================

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
  group by 1, 2, 3;
$$;


-- ==================== 0003_tz.sql ====================

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists paczkomat text;



alter table public.orders add column if not exists contact jsonb;
alter table public.orders add column if not exists manager_notified_at timestamptz;
alter table public.orders add column if not exists client_notified_status text;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders drop constraint if exists orders_status_chk;
alter table public.orders add constraint orders_status_chk
  check (status in ('new', 'confirmed', 'done', 'cancelled'));

drop policy if exists ord_admin_upd on public.orders;
create policy ord_admin_upd on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

alter table public.reservations add column if not exists kind text not null default 'notify';
alter table public.reservations add column if not exists qty integer not null default 1;
alter table public.reservations add column if not exists reserve_date date;
alter table public.reservations add column if not exists confirmed_at timestamptz;    -- бот прислал «бронь принята»
alter table public.reservations add column if not exists day_notified_at timestamptz; -- бот прислал напоминание в 10:00 в день брони
alter table public.reservations add column if not exists closed_at timestamptz;
alter table public.reservations drop constraint if exists res_kind_chk;
alter table public.reservations add constraint res_kind_chk check (kind in ('reserve', 'notify'));
alter table public.reservations drop constraint if exists res_date_chk;
alter table public.reservations add constraint res_date_chk
  check (kind <> 'reserve' or (reserve_date is not null
    and reserve_date >= (created_at at time zone 'Europe/Warsaw')::date
    and reserve_date <= (created_at at time zone 'Europe/Warsaw')::date + 7));

drop policy if exists res_admin_upd on public.reservations;
create policy res_admin_upd on public.reservations
  for update using (public.is_admin()) with check (public.is_admin());



create or replace function public.reservation_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'reserve' then
      update public.products set qty = greatest(qty - new.qty, 0), updated_at = now()
        where id = new.product_id and city = new.city and flavor = coalesce(new.flavor, '');
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.kind = 'reserve'
     and old.status in ('active', 'notified') and new.status in ('cancelled', 'expired') then
    update public.products set qty = qty + new.qty, updated_at = now()
      where id = new.product_id and city = new.city and flavor = coalesce(new.flavor, '');
    new.closed_at = now();
  end if;
  return new;
end;
$$;
drop trigger if exists trg_reservation_stock_ins on public.reservations;
create trigger trg_reservation_stock_ins before insert on public.reservations
  for each row execute function public.reservation_stock();
drop trigger if exists trg_reservation_stock_upd on public.reservations;
create trigger trg_reservation_stock_upd before update on public.reservations
  for each row execute function public.reservation_stock();


create or replace function public.cancel_reservation(p_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean := false;
begin
  update public.reservations set status = 'cancelled'
    where id = p_id and user_id = auth.uid() and status in ('active', 'notified')
    returning true into ok;
  return coalesce(ok, false);
end;
$$;
grant execute on function public.cancel_reservation(bigint) to authenticated;


create table if not exists public.reviews (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  product_id   text not null,
  flavor       text not null default '',
  product_name text,
  author       text,
  stars        integer not null check (stars between 1 and 5),
  body         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, product_id, flavor)
);
alter table public.reviews enable row level security;



create or replace function public.can_review(p_product text, p_flavor text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.user_id = auth.uid() and o.status = 'done'
      and o.items @> jsonb_build_array(jsonb_build_object('id', p_product, 'flavor', coalesce(p_flavor, ''))));
$$;
grant execute on function public.can_review(text, text) to authenticated;

drop policy if exists rev_read on public.reviews;
create policy rev_read on public.reviews for select using (true);   -- отзывы видны всем
drop policy if exists rev_ins on public.reviews;
create policy rev_ins on public.reviews
  for insert with check (auth.uid() = user_id and public.can_review(product_id, flavor));

drop policy if exists rev_upd on public.reviews;
create policy rev_upd on public.reviews
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.can_review(product_id, flavor));
drop policy if exists rev_del on public.reviews;
create policy rev_del on public.reviews
  for delete using (auth.uid() = user_id or public.is_admin());



create or replace function public.my_reviewables()
returns table(product_id text, flavor text)
language sql stable security definer set search_path = public as $$
  select distinct e->>'id', coalesce(e->>'flavor', '')
  from public.orders o, jsonb_array_elements(o.items) e
  where o.user_id = auth.uid() and o.status = 'done' and e->>'id' is not null;
$$;
grant execute on function public.my_reviewables() to authenticated;



drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products
  for all using (public.is_admin()) with check (public.is_admin());



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
  where r.kind = 'notify' and r.status = 'waiting' and pr.qty > 0
    and coalesce(r.telegram_id, p.telegram_id) is not null
  group by 1, 2, 3;
$$;

alter table public.admins enable row level security;
alter table public.bot_users enable row level security;

-- КРИТИЧНО: триггер брал telegram_id из user_metadata, а его клиент задаёт сам
-- при signUp. Так можно было зарегистрироваться с telegram_id владельца (он
-- публично лежит в ADMIN_IDS) и пройти is_admin(). Убираем telegram-поля из
-- триггера: привязку Telegram ставит ТОЛЬКО edge-функция после проверки подписи.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, auth_email, username, email, phone, display_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'email_real', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(new.raw_user_meta_data->>'username', ''))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke update on table public.profiles from authenticated;
grant update (username, display_name, full_name, phone, email, paczkomat, updated_at)
  on table public.profiles to authenticated;


alter table public.reservations drop constraint if exists res_qty_chk;
alter table public.reservations add constraint res_qty_chk check (qty between 1 and 5);
drop policy if exists res_own_ins on public.reservations;
create policy res_own_ins on public.reservations for insert with check (
  auth.uid() = user_id
  and status in ('active', 'waiting')
  and (telegram_id is null or telegram_id = (select telegram_id from public.profiles where id = auth.uid()))
);


create or replace function public.admin_overview()
returns json language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then json_build_object(
    'users', (select count(*) from public.profiles),
    'orders', (select count(*) from public.orders),
    'orders_new', (select count(*) from public.orders where status = 'new'),
    'reservations', (select count(*) from public.reservations where kind = 'reserve'),
    'res_active', (select count(*) from public.reservations where kind = 'reserve' and status in ('active', 'notified')),
    'waiting', (select count(*) from public.reservations where kind = 'notify' and status = 'waiting'),
    'reviews', (select count(*) from public.reviews),
    'bot_users', (select count(*) from public.bot_users)
  ) else null end;
$$;
grant execute on function public.admin_overview() to authenticated;


-- ==================== 0004_admin_ux.sql ====================

-- KatoVape: админ-доступ с сайта + аватар из Telegram. Поверх 0001..0003.

-- фронт спрашивает «я админ?», чтобы показать кнопку перехода в админку
grant execute on function public.is_admin() to authenticated;

-- аватар профиля (для телеграм-входа кладём photo_url, для сайта — загруженный файл)
alter table public.profiles add column if not exists avatar text;

-- пользователь может менять свой аватар сам (telegram_id по-прежнему недоступен для правки)
grant update (username, display_name, full_name, phone, email, paczkomat, avatar, updated_at)
  on table public.profiles to authenticated;

