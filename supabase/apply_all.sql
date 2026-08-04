-- KatoVape: вся схема одним файлом (0001..0050).
--
-- Файл собран автоматически: npm run schema. Руками не правьте, правьте миграцию.
-- Обычный путь раскатки это `supabase db push`; этот файл на случай, когда CLI недоступен:
-- Supabase Dashboard -> SQL Editor -> New query -> вставить всё -> Run.
-- Повторный прогон безопасен: миграции идемпотентны.


-- ================= 0001_auth.sql ================

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


-- ================= 0002_shop.sql ================

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


-- ================= 0003_tz.sql ================

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


-- ================= 0004_admin_ux.sql ================

-- KatoVape: админ-доступ с сайта + аватар из Telegram. Поверх 0001..0003.

-- фронт спрашивает «я админ?», чтобы показать кнопку перехода в админку
grant execute on function public.is_admin() to authenticated;

-- аватар профиля (для телеграм-входа кладём photo_url, для сайта — загруженный файл)
alter table public.profiles add column if not exists avatar text;

-- пользователь может менять свой аватар сам (telegram_id по-прежнему недоступен для правки)
grant update (username, display_name, full_name, phone, email, paczkomat, avatar, updated_at)
  on table public.profiles to authenticated;


-- ================= 0005_reservation_limits.sql ================

-- KatoVape: страховка от выноса остатков бронями.
-- Проблема: человек бронирует много позиций, товар пропадает из наличия, а в последний
-- момент он отказывается. Ограничиваем то, сколько один человек держит одновременно,
-- и закрываем вход тем, кто регулярно не выкупает.

alter table public.reservations add column if not exists expired_notified_at timestamptz;

create or replace function public.reservation_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_held  int;
  v_noshow int;
begin
  if new.kind <> 'reserve' then return new; end if;
  if new.user_id is null then return new; end if;

  select count(*), coalesce(sum(qty), 0) into v_count, v_held
  from public.reservations
  where user_id = new.user_id and kind = 'reserve' and status in ('active', 'notified');

  -- не больше трёх активных броней и пяти единиц товара на руках
  if v_count >= 3 then raise exception 'RES_LIMIT_COUNT' using errcode = 'P0001'; end if;
  if v_held + coalesce(new.qty, 1) > 5 then raise exception 'RES_LIMIT_QTY' using errcode = 'P0001'; end if;

  -- три невыкупленных брони за месяц закрывают возможность бронировать
  select count(*) into v_noshow
  from public.reservations
  where user_id = new.user_id and kind = 'reserve' and status = 'expired'
    and created_at > now() - interval '30 days';
  if v_noshow >= 3 then raise exception 'RES_NOSHOW' using errcode = 'P0001'; end if;

  return new;
end;
$$;

-- имя с префиксом a_ , чтобы проверка отработала раньше списания остатка
drop trigger if exists a_reservation_guard on public.reservations;
create trigger a_reservation_guard before insert on public.reservations
  for each row execute function public.reservation_guard();

-- сколько человек уже держит: витрина показывает это до нажатия «Забронировать»
create or replace function public.my_reservation_load()
returns table(active_count int, held_qty int, noshow int, blocked boolean)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.reservations
      where user_id = auth.uid() and kind = 'reserve' and status in ('active', 'notified')),
    (select coalesce(sum(qty), 0)::int from public.reservations
      where user_id = auth.uid() and kind = 'reserve' and status in ('active', 'notified')),
    (select count(*)::int from public.reservations
      where user_id = auth.uid() and kind = 'reserve' and status = 'expired'
        and created_at > now() - interval '30 days'),
    (select count(*) from public.reservations
      where user_id = auth.uid() and kind = 'reserve' and status = 'expired'
        and created_at > now() - interval '30 days') >= 3;
$$;
grant execute on function public.my_reservation_load() to authenticated;


-- ================= 0006_admin_access.sql ================

-- KatoVape: доступ в админку не только по Telegram, но и по обычному аккаунту с паролем.
-- Раньше is_admin() смотрел только на telegram_id, поэтому войти паролем было нельзя.

create table if not exists public.admin_users (
  user_id  uuid primary key references public.profiles(id) on delete cascade,
  note     text,
  added_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    join public.profiles p on p.telegram_id = a.telegram_id
    where p.id = auth.uid()
  ) or exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  );
$$;
grant execute on function public.is_admin() to authenticated;

-- список тех, у кого есть доступ (видит только админ)
create or replace function public.admin_access_list()
returns table(kind text, who text, ident text, added_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'telegram', coalesce(p.display_name, p.username, 'без профиля'),
         a.telegram_id::text, a.added_at
    from public.admins a
    left join public.profiles p on p.telegram_id = a.telegram_id
   where public.is_admin()
  union all
  select 'password', coalesce(p.display_name, p.username, '—'),
         coalesce(p.username, p.email, p.id::text), au.added_at
    from public.admin_users au
    join public.profiles p on p.id = au.user_id
   where public.is_admin()
  order by added_at;
$$;
grant execute on function public.admin_access_list() to authenticated;

-- выдать доступ обычному аккаунту по логину или почте
create or replace function public.admin_grant(p_login text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select id, coalesce(display_name, username) into v_id, v_name
    from public.profiles
   where username = p_login::citext or email = p_login::citext
   limit 1;
  if v_id is null then raise exception 'NO_USER'; end if;
  insert into public.admin_users (user_id, note) values (v_id, 'выдан из админки')
    on conflict (user_id) do nothing;
  return coalesce(v_name, p_login);
end;
$$;
grant execute on function public.admin_grant(text) to authenticated;

-- забрать доступ у аккаунта с паролем
create or replace function public.admin_revoke(p_login text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select id into v_id from public.profiles
   where username = p_login::citext or email = p_login::citext limit 1;
  if v_id is null then return false; end if;
  -- себя разжаловать нельзя, иначе можно остаться без доступа совсем
  if v_id = auth.uid() then raise exception 'SELF_REVOKE'; end if;
  delete from public.admin_users where user_id = v_id;
  return true;
end;
$$;
grant execute on function public.admin_revoke(text) to authenticated;


-- ================= 0007_admin_reads.sql ================

-- KatoVape: админке нужно видеть подписчиков бота, чтобы показать охват рассылки.
-- RLS на bot_users включали без политик, поэтому чтение было закрыто вообще всем,
-- включая менеджеров. Открываем только на чтение и только админам.
drop policy if exists bot_users_admin_read on public.bot_users;
create policy bot_users_admin_read on public.bot_users
  for select using (public.is_admin());


-- ================= 0008_login_hardening.sql ================

-- KatoVape: закрываем утечку почты через вход.
-- resolve_login был доступен анониму и по логину возвращал auth_email, а у тех, кто
-- регистрировался с реальной почтой, это и есть их настоящий адрес. Подобрал логин —
-- узнал почту клиента. Теперь связку «логин -> адрес» делает edge-функция login
-- под service_role, а наружу функция больше не выставляется.
-- ВАЖНО: в PostgreSQL новая функция автоматически получает execute у роли PUBLIC,
-- поэтому отзыва только у anon и authenticated недостаточно, вызов всё равно проходит.
revoke execute on function public.resolve_login(text) from public;
revoke execute on function public.resolve_login(text) from anon, authenticated;

-- login_availability оставляем: она отдаёт только да/нет по занятости и нужна форме
-- регистрации, чтобы подсказать до отправки. Чужих данных она не раскрывает.


-- ================= 0009_reservation_guard_fix.sql ================

-- KatoVape: лимиты броней обходились полностью.
-- Бронь из бота (диплинк /start res_...) приходит без user_id, а проверка выходила
-- раньше времени именно на пустом user_id. Проверено: шесть броней подряд при лимите
-- три, остаток товара вынесен в ноль. Теперь считаем по любому владельцу: у вошедшего
-- по user_id, у гостя из бота по telegram_id, и учитываем обе привязки сразу, чтобы
-- нельзя было набрать лимит отдельно через сайт и отдельно через бота.

create or replace function public.reservation_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count  int;
  v_held   int;
  v_noshow int;
begin
  if new.kind <> 'reserve' then return new; end if;

  -- бронь без владельца ограничить нечем, такие не принимаем
  if new.user_id is null and new.telegram_id is null then
    raise exception 'RES_NO_OWNER' using errcode = 'P0001';
  end if;

  select count(*), coalesce(sum(qty), 0) into v_count, v_held
  from public.reservations
  where kind = 'reserve' and status in ('active', 'notified')
    and ((new.user_id is not null and user_id = new.user_id)
      or (new.telegram_id is not null and telegram_id = new.telegram_id));

  if v_count >= 3 then raise exception 'RES_LIMIT_COUNT' using errcode = 'P0001'; end if;
  if v_held + coalesce(new.qty, 1) > 5 then raise exception 'RES_LIMIT_QTY' using errcode = 'P0001'; end if;

  select count(*) into v_noshow
  from public.reservations
  where kind = 'reserve' and status = 'expired'
    and created_at > now() - interval '30 days'
    and ((new.user_id is not null and user_id = new.user_id)
      or (new.telegram_id is not null and telegram_id = new.telegram_id));
  if v_noshow >= 3 then raise exception 'RES_NOSHOW' using errcode = 'P0001'; end if;

  return new;
end;
$$;

-- подсказка «у вас в брони N из 5» тоже должна видеть брони, сделанные через бота
create or replace function public.my_reservation_load()
returns table(active_count int, held_qty int, noshow int, blocked boolean)
language sql stable security definer set search_path = public as $$
  with me as (select telegram_id from public.profiles where id = auth.uid()),
  mine as (
    select r.* from public.reservations r
    where r.kind = 'reserve'
      and (r.user_id = auth.uid()
        or (r.telegram_id is not null and r.telegram_id = (select telegram_id from me)))
  )
  select
    (select count(*)::int from mine where status in ('active', 'notified')),
    (select coalesce(sum(qty), 0)::int from mine where status in ('active', 'notified')),
    (select count(*)::int from mine where status = 'expired' and created_at > now() - interval '30 days'),
    (select count(*) from mine where status = 'expired' and created_at > now() - interval '30 days') >= 3;
$$;
grant execute on function public.my_reservation_load() to authenticated;


-- ================= 0010_roles.sql ================

-- KatoVape: роли доступа.
-- owner   — всё, включая выдачу и снятие доступа
-- dev     — всё, включая выдачу (технический владелец)
-- manager — все разделы, кроме выдачи доступа
-- Доступ по-прежнему бывает двух видов: по Telegram (таблица admins) и по обычному
-- аккаунту с паролем (admin_users). Роль хранится в обеих.

alter table public.admins      add column if not exists role text not null default 'manager';
alter table public.admin_users add column if not exists role text not null default 'manager';
alter table public.admins      drop constraint if exists admins_role_chk;
alter table public.admins      add constraint admins_role_chk check (role in ('owner', 'dev', 'manager'));
alter table public.admin_users drop constraint if exists admin_users_role_chk;
alter table public.admin_users add constraint admin_users_role_chk check (role in ('owner', 'dev', 'manager'));

-- роль текущего пользователя, null если доступа нет
create or replace function public.admin_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.role from public.admins a
       join public.profiles p on p.telegram_id = a.telegram_id
      where p.id = auth.uid() limit 1),
    (select au.role from public.admin_users au where au.user_id = auth.uid() limit 1)
  );
$$;
grant execute on function public.admin_role() to authenticated;

-- выдавать и снимать доступ могут только owner и dev
create or replace function public.can_grant()
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_role() in ('owner', 'dev');
$$;
grant execute on function public.can_grant() to authenticated;

-- Старые версии сносим явно. Иначе прежний admin_grant(text) с одним аргументом
-- остался бы рядом с новым, выигрывал бы по точному числу аргументов и продолжал
-- пускать по старой проверке is_admin(), то есть менеджер мог бы выдавать доступ.
drop function if exists public.admin_grant(text);
drop function if exists public.admin_revoke(text);

-- список доступа теперь с ролью
drop function if exists public.admin_access_list();
create or replace function public.admin_access_list()
returns table(kind text, who text, ident text, role text, added_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'telegram', coalesce(p.display_name, p.username, 'ещё не заходил'),
         a.telegram_id::text, a.role, a.added_at
    from public.admins a
    left join public.profiles p on p.telegram_id = a.telegram_id
   where public.is_admin()
  union all
  select 'password', coalesce(p.display_name, p.username, '—'),
         coalesce(p.username, p.email, p.id::text), au.role, au.added_at
    from public.admin_users au
    join public.profiles p on p.id = au.user_id
   where public.is_admin()
  order by added_at;
$$;
grant execute on function public.admin_access_list() to authenticated;

-- выдать доступ обычному аккаунту по логину или почте
create or replace function public.admin_grant(p_login text, p_role text default 'manager')
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not public.can_grant() then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'dev', 'manager') then raise exception 'BAD_ROLE'; end if;
  select id, coalesce(display_name, username) into v_id, v_name
    from public.profiles
   where username = p_login::citext or email = p_login::citext
   limit 1;
  if v_id is null then raise exception 'NO_USER'; end if;
  insert into public.admin_users (user_id, note, role) values (v_id, 'выдан из панели', p_role)
    on conflict (user_id) do update set role = excluded.role;
  return coalesce(v_name, p_login);
end;
$$;
grant execute on function public.admin_grant(text, text) to authenticated;

-- выдать доступ по Telegram ID: человек может ещё ни разу не заходить в магазин,
-- доступ включится сам при первом входе через Telegram
create or replace function public.admin_grant_telegram(p_tid bigint, p_role text default 'manager')
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.can_grant() then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'dev', 'manager') then raise exception 'BAD_ROLE'; end if;
  insert into public.admins (telegram_id, note, role) values (p_tid, 'выдан из панели', p_role)
    on conflict (telegram_id) do update set role = excluded.role;
  return true;
end;
$$;
grant execute on function public.admin_grant_telegram(bigint, text) to authenticated;

-- снять доступ: по логину или по Telegram ID, себя снять нельзя
create or replace function public.admin_revoke(p_ident text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tid bigint; v_me bigint;
begin
  if not public.can_grant() then raise exception 'NOT_ALLOWED'; end if;
  if p_ident ~ '^\d+$' then
    v_tid := p_ident::bigint;
    select telegram_id into v_me from public.profiles where id = auth.uid();
    if v_me is not null and v_me = v_tid then raise exception 'SELF_REVOKE'; end if;
    delete from public.admins where telegram_id = v_tid;
    return true;
  end if;
  select id into v_id from public.profiles
   where username = p_ident::citext or email = p_ident::citext limit 1;
  if v_id is null then return false; end if;
  if v_id = auth.uid() then raise exception 'SELF_REVOKE'; end if;
  delete from public.admin_users where user_id = v_id;
  return true;
end;
$$;
grant execute on function public.admin_revoke(text) to authenticated;

-- сводка отдаёт роль, чтобы панель сразу знала, что показывать
create or replace function public.admin_overview()
returns json language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then json_build_object(
    'role', public.admin_role(),
    'can_grant', public.can_grant(),
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

-- расстановка ролей, о которой договорились
insert into public.admins (telegram_id, note, role) values
  (5301671230, 'nexrsy',          'dev'),
  (8108651376, 'Elfbaro Manager', 'owner'),
  (855010368,  'Влад',            'manager'),
  (6985103909, 'blxdborne',       'manager')
on conflict (telegram_id) do update set role = excluded.role, note = excluded.note;


-- ================= 0011_payments.sql ================

-- KatoVape: онлайн-оплата заказов (Stripe на сайте, нативные инвойсы Telegram в мини-аппе).
-- Оплата — отдельная ось от статуса выполнения (new/confirmed/done/cancelled): заказ может
-- быть оплачен, но ещё не собран. Поэтому не трогаем orders_status_chk, а заводим свои поля.

alter table public.orders add column if not exists payment_status text not null default 'unpaid';
-- unpaid   — оплата не заводилась (самовывоз/оплата при выдаче, как было раньше)
-- pending  — карта/кошелёк начаты, ждём подтверждения (PaymentIntent или инвойс Telegram)
-- paid     — деньги пришли (webhook Stripe или successful_payment из бота)
-- failed   — оплата сорвалась, заказ можно оформить заново
alter table public.orders drop constraint if exists orders_payment_chk;
alter table public.orders add constraint orders_payment_chk
  check (payment_status in ('unpaid', 'pending', 'paid', 'failed'));

alter table public.orders add column if not exists payment_provider text;   -- stripe | telegram
alter table public.orders add column if not exists payment_ref text;         -- PaymentIntent id или telegram charge id
alter table public.orders add column if not exists amount integer;           -- реально списано, в грошах (zł * 100)
alter table public.orders add column if not exists currency text not null default 'pln';
alter table public.orders add column if not exists paid_at timestamptz;
-- заказ из мини-аппа привязываем к telegram_id (профиля может ещё не быть), как в локальной БД
alter table public.orders add column if not exists telegram_id bigint;

-- webhook и бот ищут заказ по идентификатору платежа — под это индекс
create index if not exists orders_payment_ref_idx on public.orders (payment_ref);

-- Карточные и телеграм-заказы заводит edge-функция под service_role (сумму считает
-- сервер, клиенту цену не доверяем), поэтому отдельная клиентская RLS-политика не нужна:
-- self-insert как был (ord_own_ins) остаётся для оплаты при выдаче, а платный путь идёт
-- мимо RLS. Обновляет оплату тоже service_role (webhook/бот).


-- ================= 0012_bot_onboarding.sql ================

-- KatoVape: онбординг клиента в боте. Бот собирает данные ДО кнопки «Магазин» и хранит их
-- у telegram_id. Профиль в auth заводится только при входе в мини-апп, поэтому данные из
-- бота ложатся сюда раньше и позже подставятся в профиль при первом входе.
alter table public.bot_users add column if not exists full_name text;
alter table public.bot_users add column if not exists phone     text;
alter table public.bot_users add column if not exists email     text;
alter table public.bot_users add column if not exists city      text;
alter table public.bot_users add column if not exists paczkomat text;
alter table public.bot_users add column if not exists age_ok    boolean not null default false;  -- подтвердил 18+
alter table public.bot_users add column if not exists step      text;                            -- шаг онбординга: name|phone|email|city|paczkomat
alter table public.bot_users add column if not exists onboarding_done boolean not null default false;


-- ================= 0013_order_notify.sql ================

-- KatoVape: уведомления клиенту «принят» и «оплачен» из бота. Флаги, чтобы слать один раз.
alter table public.orders add column if not exists client_notified_accepted boolean not null default false;
alter table public.orders add column if not exists client_notified_paid     boolean not null default false;

-- уже существующие заказы считаем оповещёнными, иначе бот разошлёт уведомления по старым
update public.orders set client_notified_accepted = true, client_notified_paid = true
  where client_notified_accepted = false or client_notified_paid = false;


-- ================= 0014_reservation_time.sql ================

-- KatoVape: бронь теперь с временем самовывоза и лимитом 10 единиц (было 5).
alter table public.reservations add column if not exists reserve_time text;   -- слот самовывоза, напр. '14:00'

-- лимит держим на 10 единиц/броней на человека (правило «3 невыкупа за 30 дней» оставляем)
create or replace function public.reservation_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_held  int;
  v_noshow int;
begin
  if new.kind <> 'reserve' then return new; end if;
  if new.user_id is null then return new; end if;

  select count(*), coalesce(sum(qty), 0) into v_count, v_held
  from public.reservations
  where user_id = new.user_id and kind = 'reserve' and status in ('active', 'notified');

  if v_count >= 10 then raise exception 'RES_LIMIT_COUNT' using errcode = 'P0001'; end if;
  if v_held + coalesce(new.qty, 1) > 10 then raise exception 'RES_LIMIT_QTY' using errcode = 'P0001'; end if;

  select count(*) into v_noshow
  from public.reservations
  where user_id = new.user_id and kind = 'reserve' and status = 'expired'
    and created_at > now() - interval '30 days';
  if v_noshow >= 3 then raise exception 'RES_NOSHOW' using errcode = 'P0001'; end if;

  return new;
end;
$$;


-- ================= 0015_reserve_manager_remind.sql ================

-- KatoVape: напоминание менеджеру за час до времени брони (шлём один раз).
alter table public.reservations add column if not exists manager_reminded_at timestamptz;


-- ================= 0016_product_tiers.sql ================

-- KatoVape: оптовые (ступенчатые) цены редактируются в админке. Раньше tiers жили только в
-- data/products.json; теперь храним их в облаке на товар (одинаково на всех строках id).
alter table public.products add column if not exists tiers jsonb;   -- [{q:1,p:...},{q:3,p:...},{q:5,p:...},{q:10,p:...}]


-- ================= 0017_city_roles.sql ================

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
-- Три владельца (город не задаём: владелец работает со всеми городами) и менеджеры городов.
-- Роли владельцев не понижаем: иначе повторный прогон миграции отобрал бы раздел «Доступ»
-- и выдавать права стало бы некому.
insert into public.admins (telegram_id, note, role, city) values
  (5301671230, 'nexrsy',           'owner',   null),
  (8108651376, 'Elfbaro Manager',  'owner',   null),
  (855010368,  'Влад',             'owner',   null),
  (8658843544, 'Менеджер Варшава', 'manager', 'warszawa'),
  (6017482088, 'Менеджер Гливице', 'manager', 'gliwice')
on conflict (telegram_id) do update set role = excluded.role, note = excluded.note, city = excluded.city;


-- ================= 0018_comments.sql ================

-- KatoVape: комментарий покупателя к заказу и к брони (до 500 символов, счётчик на витрине).
alter table public.orders       add column if not exists comment text;
alter table public.reservations add column if not exists comment text;

-- длину режем и на стороне базы: фронт может обойти проверку, менеджеру нужен вменяемый текст
alter table public.orders       drop constraint if exists orders_comment_len;
alter table public.orders       add constraint orders_comment_len       check (comment is null or length(comment) <= 500);
alter table public.reservations drop constraint if exists reservations_comment_len;
alter table public.reservations add constraint reservations_comment_len check (comment is null or length(comment) <= 500);

-- вставку заказа делает сам покупатель (RLS ord_own_ins), поэтому колонка должна быть ему доступна
grant insert (comment) on table public.orders to authenticated;
grant insert (comment) on table public.reservations to authenticated;


-- ================= 0019_reservation_city_policy.sql ================

-- KatoVape: статусы броней менеджер меняет только в своём городе.
-- Отдельным файлом, а не правкой 0017: та миграция могла быть уже применена, и дописанное
-- в неё условие просто не выполнилось бы. Тогда осталась бы старая политика из 0003_tz.sql
-- (update по is_admin()), и менеджер Катовице мог бы вслепую закрыть бронь Варшавы —
-- заодно дёрнув триггер возврата остатка в чужом городе.
drop policy if exists res_admin_upd on public.reservations;
create policy res_admin_upd on public.reservations
  for update using (public.admin_sees_city(city)) with check (public.admin_sees_city(city));


-- ================= 0020_grant_guard_fix.sql ================

-- KatoVape: КРИТИЧЕСКИЙ фикс проверки прав на выдачу доступа.
-- can_grant() = (admin_role() = 'owner'). У постороннего admin_role() возвращает NULL,
-- значит и сравнение даёт NULL, а не false. Проверка «if not can_grant() then raise» на NULL
-- не срабатывает вовсе (NOT NULL = NULL, ветка if пропускается), поэтому функция шла дальше
-- и выдавала доступ. То есть любой вошедший в магазин мог назначить себя админом.
-- Лечим в двух местах сразу: сама функция больше не возвращает NULL, а проверки завёрнуты
-- в coalesce, чтобы неизвестность трактовалась как «нельзя».

create or replace function public.can_grant()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.admin_role() = 'owner', false);
$$;
grant execute on function public.can_grant() to authenticated;

create or replace function public.admin_grant(p_login text, p_role text default 'manager', p_city text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_city text;
begin
  if not coalesce(public.can_grant(), false) then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'dev', 'manager') then raise exception 'BAD_ROLE'; end if;
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
  if not coalesce(public.can_grant(), false) then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'dev', 'manager') then raise exception 'BAD_ROLE'; end if;
  if p_tid is null or p_tid <= 0 then raise exception 'BAD_ID'; end if;
  v_city := case when p_role = 'manager' then nullif(p_city, '') else null end;
  if p_role = 'manager' and v_city is null then raise exception 'CITY_REQUIRED'; end if;
  insert into public.admins (telegram_id, note, role, city) values (p_tid, 'выдан из панели', p_role, v_city)
    on conflict (telegram_id) do update set role = excluded.role, city = excluded.city;
  return true;
end;
$$;
grant execute on function public.admin_grant_telegram(bigint, text, text) to authenticated;

create or replace function public.admin_revoke(p_ident text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tid bigint; v_me bigint;
begin
  if not coalesce(public.can_grant(), false) then raise exception 'NOT_ALLOWED'; end if;
  if p_ident ~ '^\d+$' then
    v_tid := p_ident::bigint;
    select telegram_id into v_me from public.profiles where id = auth.uid();
    if v_me is not null and v_me = v_tid then raise exception 'SELF_REVOKE'; end if;
    delete from public.admins where telegram_id = v_tid;
    return true;
  end if;
  select id into v_id from public.profiles
   where username = p_ident::citext or email = p_ident::citext limit 1;
  if v_id is null then return false; end if;
  if v_id = auth.uid() then raise exception 'SELF_REVOKE'; end if;
  delete from public.admin_users where user_id = v_id;
  return true;
end;
$$;
grant execute on function public.admin_revoke(text) to authenticated;

-- та же ловушка была в проверке города: NULL трактуем как «доступа нет»
create or replace function public.admin_sees_city(p_city text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    public.is_admin() and (
      public.admin_role() in ('owner', 'dev') or public.admin_city() = p_city
    ), false);
$$;
grant execute on function public.admin_sees_city(text) to authenticated;


-- ================= 0021_promo_hit_pay.sql ================

-- KatoVape: способ оплаты в заказе, маркер «Хит» у товара, фото в рассылке
-- и полноценные промокоды с условиями и лимитами.

-- ---- способ оплаты: наличные при выдаче или карта (+10%) ----
alter table public.orders add column if not exists pay_way text not null default 'cash';
alter table public.orders drop constraint if exists orders_payway_chk;
alter table public.orders add constraint orders_payway_chk check (pay_way in ('cash', 'card'));
grant insert (pay_way) on table public.orders to authenticated;

-- ---- маркер товара: «Хит» ставит менеджер в панели, витрина рисует бейдж ----
alter table public.products add column if not exists hit boolean not null default false;

-- ---- рассылка с картинкой: бот отправит фото с подписью ----
alter table public.broadcasts add column if not exists photo text;   -- ссылка или data:URL

-- ---- промокоды ----
create table if not exists public.promo_codes (
  code        text primary key,                       -- всегда в верхнем регистре
  kind        text not null default 'percent',        -- percent | fixed
  value       numeric not null check (value > 0),     -- проценты или злотые
  city        text,                                   -- null = во всех городах
  category    text,                                   -- null = на весь ассортимент
  min_sum     integer not null default 0,             -- минимальная сумма корзины
  max_uses    integer,                                -- лимит всего, null = без лимита
  per_user    integer not null default 1,             -- сколько раз может применить один человек
  used        integer not null default 0,
  starts_at   timestamptz,
  expires_at  timestamptz,
  active      boolean not null default true,
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.promo_codes drop constraint if exists promo_kind_chk;
alter table public.promo_codes add constraint promo_kind_chk check (kind in ('percent', 'fixed'));
alter table public.promo_codes drop constraint if exists promo_city_chk;
alter table public.promo_codes add constraint promo_city_chk
  check (city is null or city in ('katowice', 'gliwice', 'warszawa'));
alter table public.promo_codes enable row level security;

-- кто и сколько раз применял код: нужно для лимита «на человека»
create table if not exists public.promo_uses (
  id        bigint generated always as identity primary key,
  code      text not null references public.promo_codes(code) on delete cascade,
  user_id   uuid references public.profiles(id) on delete set null,
  order_id  bigint,
  used_at   timestamptz not null default now()
);
create index if not exists promo_uses_code_user_idx on public.promo_uses (code, user_id);
alter table public.promo_uses enable row level security;

-- Сам список кодов покупателю не отдаём (иначе можно подобрать чужой код и условия):
-- проверка идёт через функцию, а таблицу читают только админы своего доступа.
drop policy if exists promo_admin_all on public.promo_codes;
create policy promo_admin_all on public.promo_codes
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists promo_uses_admin on public.promo_uses;
create policy promo_uses_admin on public.promo_uses
  for select using (public.is_admin());

-- Проверка кода: возвращает скидку в злотых и причину отказа.
-- Считает на сервере, поэтому подделать скидку из браузера нельзя.
create or replace function public.promo_check(p_code text, p_city text, p_sum numeric, p_categories text[] default null)
returns table(ok boolean, discount integer, kind text, value numeric, reason text)
language plpgsql stable security definer set search_path = public as $$
declare p record; v_used int; v_disc numeric;
begin
  select * into p from public.promo_codes where code = upper(trim(p_code));
  if p is null then return query select false, 0, null::text, null::numeric, 'not_found'; return; end if;
  if not p.active then return query select false, 0, p.kind, p.value, 'inactive'; return; end if;
  if p.starts_at is not null and now() < p.starts_at then
    return query select false, 0, p.kind, p.value, 'not_started'; return; end if;
  if p.expires_at is not null and now() > p.expires_at then
    return query select false, 0, p.kind, p.value, 'expired'; return; end if;
  if p.city is not null and p.city is distinct from p_city then
    return query select false, 0, p.kind, p.value, 'other_city'; return; end if;
  if p.category is not null and (p_categories is null or not (p.category = any(p_categories))) then
    return query select false, 0, p.kind, p.value, 'other_category'; return; end if;
  if p_sum < p.min_sum then
    return query select false, 0, p.kind, p.value, 'min_sum'; return; end if;
  if p.max_uses is not null and p.used >= p.max_uses then
    return query select false, 0, p.kind, p.value, 'limit'; return; end if;
  -- лимит на человека считаем только для вошедших: гость и так не оформит заказ
  if auth.uid() is not null and p.per_user > 0 then
    select count(*) into v_used from public.promo_uses where code = p.code and user_id = auth.uid();
    if v_used >= p.per_user then
      return query select false, 0, p.kind, p.value, 'used_by_you'; return; end if;
  end if;

  v_disc := case when p.kind = 'percent' then round(p_sum * p.value / 100) else p.value end;
  if v_disc > p_sum then v_disc := p_sum; end if;    -- скидка не больше самой корзины
  return query select true, v_disc::int, p.kind, p.value, null::text;
end;
$$;
grant execute on function public.promo_check(text, text, numeric, text[]) to anon, authenticated;

-- Отметка использования: зовём после успешного заказа. Счётчик и история — на сервере.
create or replace function public.promo_use(p_code text, p_order bigint default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.promo_codes where code = upper(trim(p_code));
  if p is null or not p.active then return false; end if;
  insert into public.promo_uses (code, user_id, order_id) values (p.code, auth.uid(), p_order);
  update public.promo_codes set used = used + 1 where code = p.code;
  return true;
end;
$$;
grant execute on function public.promo_use(text, bigint) to authenticated;


-- ================= 0022_promo_case.sql ================

-- KatoVape: промокод срабатывает только при точном совпадении регистра.
-- Было upper(trim(code)): код KATOVAPE подходил и под «katovape», и под «KatoVape».
-- Теперь сравниваем как есть, лишние пробелы всё так же отсекаем.

create or replace function public.promo_check(p_code text, p_city text, p_sum numeric, p_categories text[] default null)
returns table(ok boolean, discount integer, kind text, value numeric, reason text)
language plpgsql stable security definer set search_path = public as $$
declare p record; v_used int; v_disc numeric;
begin
  select * into p from public.promo_codes where code = trim(p_code);
  if p is null then return query select false, 0, null::text, null::numeric, 'not_found'; return; end if;
  if not p.active then return query select false, 0, p.kind, p.value, 'inactive'; return; end if;
  if p.starts_at is not null and now() < p.starts_at then
    return query select false, 0, p.kind, p.value, 'not_started'; return; end if;
  if p.expires_at is not null and now() > p.expires_at then
    return query select false, 0, p.kind, p.value, 'expired'; return; end if;
  if p.city is not null and p.city is distinct from p_city then
    return query select false, 0, p.kind, p.value, 'other_city'; return; end if;
  if p.category is not null and (p_categories is null or not (p.category = any(p_categories))) then
    return query select false, 0, p.kind, p.value, 'other_category'; return; end if;
  if p_sum < p.min_sum then
    return query select false, 0, p.kind, p.value, 'min_sum'; return; end if;
  if p.max_uses is not null and p.used >= p.max_uses then
    return query select false, 0, p.kind, p.value, 'limit'; return; end if;
  if auth.uid() is not null and p.per_user > 0 then
    select count(*) into v_used from public.promo_uses where code = p.code and user_id = auth.uid();
    if v_used >= p.per_user then
      return query select false, 0, p.kind, p.value, 'used_by_you'; return; end if;
  end if;

  v_disc := case when p.kind = 'percent' then round(p_sum * p.value / 100) else p.value end;
  if v_disc > p_sum then v_disc := p_sum; end if;
  return query select true, v_disc::int, p.kind, p.value, null::text;
end;
$$;
grant execute on function public.promo_check(text, text, numeric, text[]) to anon, authenticated;

-- списание тоже по точному коду
create or replace function public.promo_use(p_code text, p_order bigint default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.promo_codes where code = trim(p_code);
  if p is null or not p.active then return false; end if;
  insert into public.promo_uses (code, user_id, order_id) values (p.code, auth.uid(), p_order);
  update public.promo_codes set used = used + 1 where code = p.code;
  return true;
end;
$$;
grant execute on function public.promo_use(text, bigint) to authenticated;


-- ================= 0023_broadcast_city.sql ================

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


-- ================= 0024_promo_service_grant.sql ================

-- KatoVape: скидку по промокоду перед оплатой считает та же promo_check, что и корзина
-- в браузере (edge-функции create-payment / create-checkout зовут её под service_role).
-- Раньше оплата брала промокоды из data/content.json, и списанная сумма расходилась с той,
-- что человек видел в корзине. Право на выполнение проставляем явно: без него функция
-- ответит 403, и оплата честно откажет вместо того, чтобы посчитать сумму мимо кода.
grant execute on function public.promo_check(text, text, numeric, text[]) to service_role;
grant execute on function public.promo_use(text, bigint) to service_role;


-- ================= 0025_product_badges.sql ================

-- KatoVape: ярлык «Хит» сохраняется из панели управления.
-- Колонки hit и tiers добавляли миграции 0016 и 0021. Если их накатили частично или
-- PostgREST после накатки не перечитал схему, панель падала на сохранении с
-- «Could not find the 'hit' column of 'products' in the schema cache», хотя в базе
-- колонка есть. Повторяем добавление (идемпотентно) и просим API обновить кеш схемы.
alter table public.products add column if not exists hit   boolean not null default false;
alter table public.products add column if not exists tiers jsonb;

-- Ярлык и ступени одинаковы у всех строк одного товара в городе. Строки, заведённые
-- отдельно (кнопкой «Добавить вкус» или выгрузкой из таблицы), могли остаться без них —
-- подтягиваем к остальным, чтобы панель и витрина видели одно и то же.
update public.products p set hit = true
 where p.hit = false
   and exists (select 1 from public.products q
                where q.id = p.id and q.city = p.city and q.hit);

update public.products p set tiers = src.tiers
  from (select distinct on (id, city) id, city, tiers
          from public.products
         where tiers is not null
         order by id, city) src
 where p.id = src.id and p.city = src.city and p.tiers is null;

-- поиск по ярлыку из панели и сортировка витрины идут по городу
create index if not exists products_city_hit_idx on public.products (city, hit);

notify pgrst, 'reload schema';


-- ================= 0026_orders_server_price.sql ================

-- KatoVape: цену заказа считает только сервер.
--
-- ВАЖЕН ПОРЯДОК. Эту миграцию применяют ПОСЛЕ того, как задеплоена edge-функция
-- create-order и проверено, что заказ с оплатой при выдаче проходит. Миграция забирает
-- у браузера право писать в orders напрямую, и без функции оформление перестанет работать.
--   supabase functions deploy create-order
--   (оформить тестовый заказ)
--   supabase db push
--
-- Что закрываем: политика ord_own_ins разрешала любому вошедшему вставить свой заказ
-- с любым полем sum. Достаточно было одного запроса к REST, чтобы завести заказ на 1 zł —
-- менеджер видел в панели присланную цифру и выдавал товар по ней. Теперь заказы заводит
-- только create-order под service_role: она считает сумму по каталогу, проверяет остаток
-- и промокод. Правки статусов остаются у админов (ord_admin_upd), чтение — у владельца
-- заказа и менеджера города (ord_own_sel).
drop policy if exists ord_own_ins on public.orders;

-- Табличный грант перекрывает колоночные, поэтому сначала снимаем его целиком.
revoke insert on table public.orders from authenticated;
revoke insert on table public.orders from anon;

-- create-order ходит под service_role и грантов authenticated не касается.


-- ================= 0027_profile_city.sql ================

-- KatoVape: город из анкеты бота доезжает до витрины.
--
-- Человек выбирает город при первом запуске бота (bot_users.city), а мини-апп открывался
-- с тем городом, что остался в localStorage телефона от прошлой сессии — то есть чужим.
-- Профиль про город не знал вовсе, потому что колонки не было.
alter table public.profiles add column if not exists city text;
alter table public.profiles drop constraint if exists profiles_city_chk;
alter table public.profiles add constraint profiles_city_chk
  check (city is null or city in ('katowice', 'gliwice', 'warszawa'));

-- человек правит свой город сам, переключателем в шапке
grant update (city) on table public.profiles to authenticated;

-- переносим уже собранные ботом города тем, у кого профиль пустой
update public.profiles p set city = b.city
  from public.bot_users b
 where b.telegram_id = p.telegram_id
   and p.city is null
   and b.city is not null;

notify pgrst, 'reload schema';


-- ================= 0028_order_promo.sql ================

-- KatoVape: в заказе видно, какие промокоды сработали и на сколько.
--
-- Раньше код никуда не сохранялся: менеджер видел итоговую сумму и не понимал, почему она
-- ниже прайса, а сверить скидку было не с чем. Теперь коды и размер скидки лежат в заказе,
-- их показывают панель и бот.
alter table public.orders add column if not exists promo    text[];
alter table public.orders add column if not exists discount integer not null default 0;

-- писать эти поля может только сервер (create-order и оплата под service_role):
-- клиенту вставка в orders запрещена целиком миграцией 0026.
create index if not exists orders_promo_idx on public.orders using gin (promo);

notify pgrst, 'reload schema';


-- ================= 0029_promo_stacking.sql ================

alter table public.promo_codes add column if not exists stackable boolean not null default true;

comment on column public.promo_codes.stackable is
  'false — код применяется только в одиночку, вместе с другими не работает';

drop function if exists public.promo_check(text, text, numeric, text[]);

create function public.promo_check(p_code text, p_city text, p_sum numeric, p_categories text[] default null)
returns table(ok boolean, discount integer, kind text, value numeric, stackable boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare p record; v_used int; v_disc numeric;
begin
  select * into p from public.promo_codes where code = trim(p_code);
  if p is null then return query select false, 0, null::text, null::numeric, true, 'not_found'; return; end if;
  if not p.active then return query select false, 0, p.kind, p.value, p.stackable, 'inactive'; return; end if;
  if p.starts_at is not null and now() < p.starts_at then
    return query select false, 0, p.kind, p.value, p.stackable, 'not_started'; return; end if;
  if p.expires_at is not null and now() > p.expires_at then
    return query select false, 0, p.kind, p.value, p.stackable, 'expired'; return; end if;
  if p.city is not null and p.city is distinct from p_city then
    return query select false, 0, p.kind, p.value, p.stackable, 'other_city'; return; end if;
  if p.category is not null and (p_categories is null or not (p.category = any(p_categories))) then
    return query select false, 0, p.kind, p.value, p.stackable, 'other_category'; return; end if;
  if p_sum < p.min_sum then
    return query select false, 0, p.kind, p.value, p.stackable, 'min_sum'; return; end if;
  if p.max_uses is not null and p.used >= p.max_uses then
    return query select false, 0, p.kind, p.value, p.stackable, 'limit'; return; end if;
  if auth.uid() is not null and p.per_user > 0 then
    select count(*) into v_used from public.promo_uses where code = p.code and user_id = auth.uid();
    if v_used >= p.per_user then
      return query select false, 0, p.kind, p.value, p.stackable, 'used_by_you'; return; end if;
  end if;

  v_disc := case when p.kind = 'percent' then round(p_sum * p.value / 100) else p.value end;
  if v_disc > p_sum then v_disc := p_sum; end if;
  return query select true, v_disc::int, p.kind, p.value, p.stackable, null::text;
end;
$$;
grant execute on function public.promo_check(text, text, numeric, text[]) to anon, authenticated, service_role;

update public.promo_codes set stackable = false where kind = 'fixed';

notify pgrst, 'reload schema';


-- ================= 0030_dashboard.sql ================

-- Owner dashboard: every figure is aggregated in the database and returned as one JSON
-- document per section. Pulling the raw orders into the browser would not survive the first
-- busy month, and the role check must not live in the interface alone.
--
-- What the schema cannot answer is deliberately absent rather than faked:
--   * margin needs purchase prices, which the catalogue does not store, so the money figures
--     are revenue, never profit;
--   * orders carry no manager, only a city, so manager stats are derived from the city map;
--   * only created_at and updated_at exist, so handling time is an approximation.

-- Hardened in 0031: this predicate must never return null, or the guards below would be
-- skipped instead of raising.
create or replace function public.is_owner_or_dev()
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_role() in ('owner', 'dev');
$$;
grant execute on function public.is_owner_or_dev() to authenticated;

-- Revenue counts orders that were actually handed over. Cancelled and pending ones are
-- reported separately so the headline number is not inflated.
create or replace function public.dash_kpi(p_from timestamptz, p_to timestamptz)
returns json language plpgsql stable security definer set search_path = public as $$
declare span interval; prev_from timestamptz; res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;
  span := p_to - p_from;
  prev_from := p_from - span;

  select json_build_object(
    'revenue_total',   (select coalesce(sum(sum), 0) from orders where status = 'done'),
    'revenue_period',  (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= p_from and created_at < p_to),
    'revenue_prev',    (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= prev_from and created_at < p_from),
    'revenue_today',   (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= date_trunc('day', now())),
    'revenue_week',    (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= now() - interval '7 days'),
    'revenue_month',   (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= now() - interval '30 days'),
    'revenue_year',    (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= now() - interval '365 days'),
    'orders',          (select count(*) from orders where created_at >= p_from and created_at < p_to),
    'orders_prev',     (select count(*) from orders where created_at >= prev_from and created_at < p_from),
    'orders_done',     (select count(*) from orders where status = 'done' and created_at >= p_from and created_at < p_to),
    'orders_cancelled',(select count(*) from orders where status = 'cancelled' and created_at >= p_from and created_at < p_to),
    'res_active',      (select count(*) from reservations where kind = 'reserve' and status in ('active', 'notified')),
    'avg_check',       (select coalesce(round(avg(sum)), 0) from orders where status = 'done' and created_at >= p_from and created_at < p_to),
    'avg_check_prev',  (select coalesce(round(avg(sum)), 0) from orders where status = 'done' and created_at >= prev_from and created_at < p_from),
    'res_conversion',  (select case when count(*) = 0 then 0
                          else round(100.0 * count(*) filter (where status = 'done') / count(*)) end
                        from reservations where kind = 'reserve' and created_at >= p_from and created_at < p_to),
    'users_new',       (select count(*) from profiles where created_at >= p_from and created_at < p_to),
    'users_new_prev',  (select count(*) from profiles where created_at >= prev_from and created_at < p_from),
    'users_active',    (select count(distinct user_id) from orders where user_id is not null and created_at >= p_from and created_at < p_to),
    'reviews',         (select count(*) from reviews),
    'reviews_avg',     (select coalesce(round(avg(stars), 1), 0) from reviews),
    'promo_used',      (select count(*) from orders where promo is not null and array_length(promo, 1) > 0 and created_at >= p_from and created_at < p_to),
    'discount_total',  (select coalesce(sum(discount), 0) from orders where created_at >= p_from and created_at < p_to),
    'discount_avg',    (select coalesce(round(avg(discount)), 0) from orders where discount > 0 and created_at >= p_from and created_at < p_to)
  ) into res;
  return res;
end;
$$;
grant execute on function public.dash_kpi(timestamptz, timestamptz) to authenticated;

-- Time series for the charts. p_bucket is 'day' or 'month'.
create or replace function public.dash_series(p_from timestamptz, p_to timestamptz, p_bucket text default 'day')
returns json language plpgsql stable security definer set search_path = public as $$
declare b text; res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;
  b := case when p_bucket = 'month' then 'month' else 'day' end;

  select json_build_object(
    'orders', (
      select coalesce(json_agg(row_to_json(t) order by t.bucket), '[]'::json) from (
        select date_trunc(b, created_at)::date as bucket,
               count(*) as orders,
               count(*) filter (where status = 'done') as done,
               coalesce(sum(sum) filter (where status = 'done'), 0) as revenue,
               coalesce(round(avg(sum) filter (where status = 'done')), 0) as avg_check
          from orders where created_at >= p_from and created_at < p_to
         group by 1) t),
    'users', (
      select coalesce(json_agg(row_to_json(t) order by t.bucket), '[]'::json) from (
        select date_trunc(b, created_at)::date as bucket, count(*) as users
          from profiles where created_at >= p_from and created_at < p_to
         group by 1) t),
    'reviews', (
      select coalesce(json_agg(row_to_json(t) order by t.bucket), '[]'::json) from (
        select date_trunc(b, created_at)::date as bucket, count(*) as reviews,
               round(avg(stars), 1) as avg_stars
          from reviews where created_at >= p_from and created_at < p_to
         group by 1) t),
    'cities', (
      select coalesce(json_agg(row_to_json(t) order by t.revenue desc), '[]'::json) from (
        select city, count(*) as orders, coalesce(sum(sum) filter (where status = 'done'), 0) as revenue
          from orders where created_at >= p_from and created_at < p_to
         group by 1) t),
    'statuses', (
      select coalesce(json_agg(row_to_json(t) order by t.n desc), '[]'::json) from (
        select status, count(*) as n from orders
         where created_at >= p_from and created_at < p_to group by 1) t),
    'payments', (
      select coalesce(json_agg(row_to_json(t) order by t.n desc), '[]'::json) from (
        select coalesce(pay_way, 'cash') as pay_way, payment_status, count(*) as n
          from orders where created_at >= p_from and created_at < p_to group by 1, 2) t),
    'promo', (
      select coalesce(json_agg(row_to_json(t) order by t.n desc), '[]'::json) from (
        select code, count(*) as n, coalesce(sum(o.discount), 0) as discount
          from orders o, unnest(o.promo) as code
         where o.created_at >= p_from and o.created_at < p_to group by 1) t)
  ) into res;
  return res;
end;
$$;
grant execute on function public.dash_series(timestamptz, timestamptz, text) to authenticated;

-- Product analytics. Order items are a JSON snapshot, so quantity and revenue come from
-- there; brand and stock are joined from the live catalogue by id.
create or replace function public.dash_products(p_from timestamptz, p_to timestamptz)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;

  with sold as (
    select e->>'id' as id,
           coalesce(e->>'name', e->>'id') as name,
           coalesce(e->>'flavor', '') as flavor,
           coalesce((e->>'n')::int, 1) as qty,
           coalesce((e->>'sum')::numeric, 0) as revenue,
           o.status, o.city
      from orders o, jsonb_array_elements(o.items) e
     where o.created_at >= p_from and o.created_at < p_to
  )
  select json_build_object(
    'top_qty', (
      select coalesce(json_agg(row_to_json(t) order by t.qty desc), '[]'::json) from (
        select name, sum(qty) as qty, sum(revenue) as revenue from sold
         where status = 'done' group by 1 order by 2 desc limit 10) t),
    'top_flavors', (
      select coalesce(json_agg(row_to_json(t) order by t.qty desc), '[]'::json) from (
        select name || case when flavor <> '' then ', ' || flavor else '' end as name,
               sum(qty) as qty from sold where status = 'done' and flavor <> ''
         group by 1 order by 2 desc limit 10) t),
    'top_revenue', (
      select coalesce(json_agg(row_to_json(t) order by t.revenue desc), '[]'::json) from (
        select name, sum(revenue) as revenue from sold
         where status = 'done' group by 1 order by 2 desc limit 10) t),
    'top_cancelled', (
      select coalesce(json_agg(row_to_json(t) order by t.qty desc), '[]'::json) from (
        select name, sum(qty) as qty from sold
         where status = 'cancelled' group by 1 order by 2 desc limit 10) t),
    'by_brand', (
      select coalesce(json_agg(row_to_json(t) order by t.revenue desc), '[]'::json) from (
        select coalesce(nullif(p.brand, ''), s.name) as brand, sum(s.revenue) as revenue, sum(s.qty) as qty
          from sold s left join lateral (
                 select brand from products where id = s.id limit 1) p on true
         where s.status = 'done' group by 1 order by 2 desc limit 10) t),
    'no_sales', (
      select coalesce(json_agg(row_to_json(t) order by t.name), '[]'::json) from (
        select distinct coalesce(nullif(p.name, ''), p.id) as name, p.city
          from products p
         where p.qty > 0
           and not exists (select 1 from sold s where s.id = p.id and s.status = 'done')
         limit 15) t),
    'low_stock', (
      select coalesce(json_agg(row_to_json(t) order by t.qty), '[]'::json) from (
        select coalesce(nullif(name, ''), id) as name, flavor, city, qty
          from products where qty > 0 and qty <= 3 order by qty limit 15) t),
    'top_reserved', (
      select coalesce(json_agg(row_to_json(t) order by t.n desc), '[]'::json) from (
        select coalesce(product_name, product_id) as name, count(*) as n
          from reservations where created_at >= p_from and created_at < p_to
         group by 1 order by 2 desc limit 10) t)
  ) into res;
  return res;
end;
$$;
grant execute on function public.dash_products(timestamptz, timestamptz) to authenticated;

-- Customer analytics. Lifetime value is the sum of everything a customer ever received,
-- not a forecast.
create or replace function public.dash_customers(p_from timestamptz, p_to timestamptz)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;

  with per_user as (
    select user_id,
           count(*) as orders,
           count(*) filter (where status = 'done') as done,
           coalesce(sum(sum) filter (where status = 'done'), 0) as spent
      from orders where user_id is not null group by 1
  )
  select json_build_object(
    'new_in_period',  (select count(*) from profiles where created_at >= p_from and created_at < p_to),
    'buyers',         (select count(*) from per_user where done > 0),
    'repeat_buyers',  (select count(*) from per_user where done > 1),
    'repeat_share',   (select case when count(*) filter (where done > 0) = 0 then 0
                          else round(100.0 * count(*) filter (where done > 1) / count(*) filter (where done > 0)) end
                        from per_user),
    'orders_per_user',(select coalesce(round(avg(orders), 1), 0) from per_user),
    'ltv_avg',        (select coalesce(round(avg(spent)), 0) from per_user where done > 0),
    'top', (
      select coalesce(json_agg(row_to_json(t) order by t.spent desc), '[]'::json) from (
        select coalesce(nullif(pr.display_name, ''), pr.username, 'id ' || left(u.user_id::text, 8)) as name,
               u.orders, u.done, u.spent
          from per_user u left join profiles pr on pr.id = u.user_id
         where u.done > 0 order by u.spent desc limit 10) t)
  ) into res;
  return res;
end;
$$;
grant execute on function public.dash_customers(timestamptz, timestamptz) to authenticated;

-- Manager analytics. Orders carry no manager, only a city, so the figures are grouped by the
-- city each manager is responsible for. Handling time is updated_at - created_at, which is the
-- closest the current schema allows.
create or replace function public.dash_managers(p_from timestamptz, p_to timestamptz)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(json_agg(row_to_json(t) order by t.done desc), '[]'::json) into res from (
    select a.telegram_id, a.role, a.city,
           count(o.id) as orders,
           count(o.id) filter (where o.status = 'done') as done,
           count(o.id) filter (where o.status = 'cancelled') as cancelled,
           coalesce(sum(o.sum) filter (where o.status = 'done'), 0) as revenue,
           coalesce(round(avg(extract(epoch from (o.updated_at - o.created_at)) / 3600)
                    filter (where o.status = 'done')), 0) as avg_hours
      from admins a
      left join orders o
        on o.city = a.city and o.created_at >= p_from and o.created_at < p_to
     where a.role = 'manager' and a.city is not null
     group by 1, 2, 3) t;
  return json_build_object('managers', res);
end;
$$;
grant execute on function public.dash_managers(timestamptz, timestamptz) to authenticated;

-- Technical section for the developer role. Everything Postgres itself knows is read here;
-- host metrics that only the bot can see arrive through bot_heartbeat below.
create table if not exists public.bot_heartbeat (
  id          smallint primary key default 1,
  version     text,
  started_at  timestamptz,
  beat_at     timestamptz not null default now(),
  rss_mb      integer,
  node        text,
  constraint bot_heartbeat_single check (id = 1)
);
alter table public.bot_heartbeat enable row level security;
drop policy if exists heartbeat_dev on public.bot_heartbeat;
create policy heartbeat_dev on public.bot_heartbeat for select using (public.is_owner_or_dev());

create or replace function public.dash_system()
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;
  select json_build_object(
    'db_size',        pg_size_pretty(pg_database_size(current_database())),
    'db_version',     (select current_setting('server_version')),
    'schema_version', (select max(version) from supabase_migrations.schema_migrations),
    'connections',    (select count(*) from pg_stat_activity where datname = current_database()),
    'tables', (
      select coalesce(json_agg(row_to_json(t) order by t.bytes desc), '[]'::json) from (
        select relname as name, pg_total_relation_size(c.oid) as bytes,
               pg_size_pretty(pg_total_relation_size(c.oid)) as size
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
         order by 2 desc limit 8) t),
    'jobs_pending',   (select count(*) from sync_jobs where status = 'pending'),
    'jobs_failed_24h',(select count(*) from sync_jobs where status = 'error' and coalesce(done_at, created_at) > now() - interval '24 hours'),
    'broadcast_queue',(select count(*) from broadcasts where status in ('pending', 'sending')),
    'orders_stuck',   (select count(*) from orders where payment_status = 'pending' and created_at < now() - interval '1 hour'),
    'bot',            (select row_to_json(b) from bot_heartbeat b where b.id = 1)
  ) into res;
  return res;
end;
$$;
grant execute on function public.dash_system() to authenticated;

notify pgrst, 'reload schema';


-- ================= 0031_dashboard_guard_fix.sql ================

-- The dashboard access check must fail closed.
--
-- admin_role() returns null for anyone without access, so `null in ('owner','dev')` was null,
-- and `if not null then raise` never fired: PL/pgSQL treats a null condition as not taken.
-- Any logged-in customer could therefore call the dash_* functions and read the whole business
-- report. Wrapping the predicate in coalesce makes it return false instead of null, which turns
-- every guard in 0030 back into a real check.
create or replace function public.is_owner_or_dev()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.admin_role() in ('owner', 'dev'), false);
$$;


-- ================= 0032_crm_contacts.sql ================

-- CRM foundation: a contact is one human being, however they reached the shop.
--
-- Until now a customer existed as up to three unrelated rows: an account on the storefront
-- (profiles), a person in the bot (bot_users) and, from now on, nothing at all for orders a
-- manager takes by phone. Contacts tie those together, keyed by phone, which is the one
-- identifier a manager always has.

create table if not exists public.contacts (
  id          bigint generated always as identity primary key,
  city        text not null,
  full_name   text,
  phone       text,
  email       text,
  telegram_id bigint,
  user_id     uuid references public.profiles(id) on delete set null,
  tags        text[] not null default '{}',
  blocked     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint contacts_city_chk check (city in ('katowice', 'gliwice', 'warszawa'))
);
-- One phone is one person. Contacts without a phone are allowed (a walk-in with no number)
-- but cannot be deduplicated, so the interface asks for it.
create unique index if not exists contacts_phone_uniq on public.contacts (phone) where phone is not null;
create unique index if not exists contacts_tg_uniq on public.contacts (telegram_id) where telegram_id is not null;
create unique index if not exists contacts_user_uniq on public.contacts (user_id) where user_id is not null;
create index if not exists contacts_city_idx on public.contacts (city);

alter table public.contacts enable row level security;
drop policy if exists contacts_staff on public.contacts;
create policy contacts_staff on public.contacts
  for all using (public.admin_sees_city(city)) with check (public.admin_sees_city(city));

-- Notes carry an author and a time, otherwise "he promised to call back" is worthless.
create table if not exists public.contact_notes (
  id         bigint generated always as identity primary key,
  contact_id bigint not null references public.contacts(id) on delete cascade,
  author     uuid references public.profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint contact_notes_len check (length(body) between 1 and 2000)
);
create index if not exists contact_notes_contact_idx on public.contact_notes (contact_id, created_at desc);
alter table public.contact_notes enable row level security;
drop policy if exists contact_notes_staff on public.contact_notes;
create policy contact_notes_staff on public.contact_notes
  for all using (exists (select 1 from public.contacts c where c.id = contact_id and public.admin_sees_city(c.city)))
  with check (exists (select 1 from public.contacts c where c.id = contact_id and public.admin_sees_city(c.city)));

-- Tags are a fixed list the owner edits, not free text: free tags turn into fifteen spellings
-- of "wholesale" within a month.
create table if not exists public.crm_tags (
  name  text primary key,
  color text not null default 'muted',
  constraint crm_tags_len check (length(name) between 1 and 24)
);
alter table public.crm_tags enable row level security;
drop policy if exists crm_tags_read on public.crm_tags;
create policy crm_tags_read on public.crm_tags for select using (public.is_admin());
drop policy if exists crm_tags_write on public.crm_tags;
create policy crm_tags_write on public.crm_tags for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());
insert into public.crm_tags (name, color) values
  ('оптовик', 'ok'), ('постоянный', 'accent'), ('VIP', 'warn'), ('проблемный', 'danger')
  on conflict (name) do nothing;

-- Why a deal was lost is the one thing a sales report cannot reconstruct afterwards.
create table if not exists public.cancel_reasons (
  id     smallint generated always as identity primary key,
  name   text not null unique,
  active boolean not null default true
);
alter table public.cancel_reasons enable row level security;
drop policy if exists cancel_reasons_read on public.cancel_reasons;
create policy cancel_reasons_read on public.cancel_reasons for select using (public.is_admin());
drop policy if exists cancel_reasons_write on public.cancel_reasons;
create policy cancel_reasons_write on public.cancel_reasons for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());
insert into public.cancel_reasons (name) values
  ('передумал'), ('нет в наличии'), ('не вышел на связь'), ('дорого'), ('дубль заказа'), ('другое')
  on conflict (name) do nothing;

-- Orders gain the CRM fields. Nothing existing changes meaning.
alter table public.orders add column if not exists contact_id       bigint references public.contacts(id) on delete set null;
alter table public.orders add column if not exists source           text not null default 'shop';
alter table public.orders add column if not exists cancel_reason_id smallint references public.cancel_reasons(id);
alter table public.orders add column if not exists manager_id       uuid references public.profiles(id) on delete set null;
alter table public.orders drop constraint if exists orders_source_chk;
alter table public.orders add constraint orders_source_chk check (source in ('shop', 'manual'));
create index if not exists orders_contact_idx on public.orders (contact_id);

-- Two more funnel stages between "confirmed" and "done".
alter table public.orders drop constraint if exists orders_status_chk;
alter table public.orders add constraint orders_status_chk
  check (status in ('new', 'confirmed', 'packed', 'shipped', 'done', 'cancelled'));

-- Who changed what. The only way to settle an argument about a price or a status later.
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid references public.profiles(id) on delete set null,
  actor_role text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  detail     jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);
alter table public.audit_log enable row level security;
-- Reading the log is an owner matter; nobody writes to it directly, only the RPCs below do.
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select using (public.is_owner_or_dev());

create or replace function public.audit(p_action text, p_entity text, p_id text, p_detail jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor, actor_role, action, entity, entity_id, detail)
  values (auth.uid(), public.admin_role(), p_action, p_entity, p_id, p_detail);
$$;

notify pgrst, 'reload schema';


-- ================= 0033_crm_operations.sql ================

-- CRM operations. Every function is security definer, so each one re-checks the caller's city
-- itself: the panel hiding a button is convenience, the check here is the actual rule.

-- Same normalisation the storefront uses, so a phone typed by a manager and a phone typed by
-- the customer land on the same contact.
create or replace function public.crm_norm_phone(p text)
returns text language sql immutable set search_path = public as $$
  select case
    when p is null or btrim(p) = '' then null
    when regexp_replace(p, '[^0-9]', '', 'g') ~ '^\d{9}$' then '+48' || regexp_replace(p, '[^0-9]', '', 'g')
    when regexp_replace(p, '[^0-9]', '', 'g') ~ '^48\d{9}$' then '+' || regexp_replace(p, '[^0-9]', '', 'g')
    else '+' || regexp_replace(p, '[^0-9]', '', 'g')
  end;
$$;

create or replace function public.crm_contacts(p_query text default null, p_limit int default 50)
returns table(id bigint, city text, full_name text, phone text, email text, telegram_id bigint,
              tags text[], blocked boolean, orders bigint, spent numeric, last_order timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.city, c.full_name, c.phone, c.email, c.telegram_id, c.tags, c.blocked,
         count(o.id) filter (where o.status = 'done'),
         coalesce(sum(o.sum) filter (where o.status = 'done'), 0),
         max(o.created_at)
    from public.contacts c
    left join public.orders o on o.contact_id = c.id
   where public.admin_sees_city(c.city)
     and (p_query is null or btrim(p_query) = ''
          or c.full_name ilike '%' || p_query || '%'
          or c.phone like '%' || regexp_replace(p_query, '[^0-9]', '', 'g') || '%'
          or c.email ilike '%' || p_query || '%')
   group by c.id
   order by max(o.created_at) desc nulls last, c.id desc
   limit least(coalesce(p_limit, 50), 200);
$$;
grant execute on function public.crm_contacts(text, int) to authenticated;

create or replace function public.crm_contact_card(p_id bigint)
returns json language plpgsql stable security definer set search_path = public as $$
declare c record; res json;
begin
  select * into c from public.contacts where id = p_id;
  if c is null or not public.admin_sees_city(c.city) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select json_build_object(
    'contact', row_to_json(c),
    'orders', (select coalesce(json_agg(row_to_json(o) order by o.id desc), '[]'::json)
                 from (select id, created_at, status, sum, delivery, city, source, payment_status
                         from public.orders where contact_id = p_id order by id desc limit 50) o),
    'reservations', (select coalesce(json_agg(row_to_json(r) order by r.id desc), '[]'::json)
                 from (select id, created_at, product_name, flavor, status, reserve_date
                         from public.reservations
                        where telegram_id = c.telegram_id and c.telegram_id is not null
                        order by id desc limit 20) r),
    'notes', (select coalesce(json_agg(row_to_json(n) order by n.created_at desc), '[]'::json)
                 from (select cn.id, cn.body, cn.created_at,
                              coalesce(nullif(p.display_name, ''), p.username, '—') as author
                         from public.contact_notes cn
                         left join public.profiles p on p.id = cn.author
                        where cn.contact_id = p_id order by cn.created_at desc limit 50) n)
  ) into res;
  return res;
end;
$$;
grant execute on function public.crm_contact_card(bigint) to authenticated;

create or replace function public.crm_contact_save(
  p_id bigint, p_city text, p_name text, p_phone text, p_email text,
  p_tags text[] default '{}', p_blocked boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_phone text; v_id bigint; v_old record;
begin
  if not public.admin_sees_city(p_city) then raise exception 'forbidden' using errcode = '42501'; end if;
  v_phone := public.crm_norm_phone(p_phone);

  if p_id is null then
    -- A repeat customer must not become a second card: match on the phone first.
    if v_phone is not null then select id into v_id from public.contacts where phone = v_phone; end if;
    if v_id is null then
      insert into public.contacts (city, full_name, phone, email, tags, blocked)
      values (p_city, nullif(btrim(p_name), ''), v_phone, nullif(btrim(p_email), ''), coalesce(p_tags, '{}'), coalesce(p_blocked, false))
      returning id into v_id;
      perform public.audit('create', 'contact', v_id::text, json_build_object('phone', v_phone)::jsonb);
      return v_id;
    end if;
    p_id := v_id;
  end if;

  select * into v_old from public.contacts where id = p_id;
  if v_old is null or not public.admin_sees_city(v_old.city) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.contacts set
    city = p_city, full_name = nullif(btrim(p_name), ''), phone = v_phone,
    email = nullif(btrim(p_email), ''), tags = coalesce(p_tags, '{}'),
    blocked = coalesce(p_blocked, false), updated_at = now()
   where id = p_id;
  perform public.audit('update', 'contact', p_id::text,
    json_build_object('was', row_to_json(v_old), 'phone', v_phone)::jsonb);
  return p_id;
end;
$$;
grant execute on function public.crm_contact_save(bigint, text, text, text, text, text[], boolean) to authenticated;

create or replace function public.crm_note_add(p_contact bigint, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_city text; v_id bigint;
begin
  select city into v_city from public.contacts where id = p_contact;
  if v_city is null or not public.admin_sees_city(v_city) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if btrim(coalesce(p_body, '')) = '' then raise exception 'empty note'; end if;
  insert into public.contact_notes (contact_id, author, body)
  values (p_contact, auth.uid(), btrim(p_body)) returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.crm_note_add(bigint, text) to authenticated;

-- Manual order: the manager is staff, so they set the prices, but the total is summed here
-- from the lines. A mismatch between the lines and the total is the classic way a report
-- stops adding up.
create or replace function public.crm_create_order(
  p_city text, p_contact bigint, p_items jsonb, p_delivery text default 'pickup',
  p_address text default null, p_comment text default null, p_pay_way text default 'cash')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_sum numeric; v_id bigint; v_contact record; v_contact_json jsonb;
begin
  if not public.admin_sees_city(p_city) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'empty order'; end if;
  if p_delivery not in ('pickup', 'inpost', 'courier') then raise exception 'bad delivery'; end if;
  if p_pay_way not in ('cash', 'card') then raise exception 'bad pay_way'; end if;

  select coalesce(sum((e->>'price')::numeric * greatest(coalesce((e->>'n')::int, 1), 1)), 0)
    into v_sum from jsonb_array_elements(p_items) e;
  if v_sum <= 0 then raise exception 'bad total'; end if;

  if p_contact is not null then
    select * into v_contact from public.contacts where id = p_contact;
    if v_contact is null or not public.admin_sees_city(v_contact.city) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_contact.blocked then raise exception 'contact blocked'; end if;
    v_contact_json := jsonb_build_object('name', v_contact.full_name, 'phone', v_contact.phone, 'email', v_contact.email);
  end if;

  insert into public.orders (city, contact_id, items, sum, delivery, address, contact, comment,
                             pay_way, status, payment_status, source, manager_id, amount, currency)
  values (p_city, p_contact, p_items, v_sum, p_delivery,
          case when p_delivery = 'pickup' then null else nullif(btrim(p_address), '') end,
          coalesce(v_contact_json, '{}'::jsonb), nullif(btrim(p_comment), ''),
          p_pay_way, 'new', 'unpaid', 'manual', auth.uid(), (v_sum * 100)::int, 'pln')
  returning id into v_id;

  perform public.audit('create', 'order', v_id::text,
    json_build_object('source', 'manual', 'sum', v_sum, 'contact', p_contact)::jsonb);
  return v_id;
end;
$$;
grant execute on function public.crm_create_order(text, bigint, jsonb, text, text, text, text) to authenticated;

-- Status changes go through here so a cancellation always carries a reason and every move
-- lands in the audit log.
create or replace function public.crm_set_status(p_order bigint, p_status text, p_reason smallint default null)
returns void language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select * into o from public.orders where id = p_order;
  if o is null or not public.admin_sees_city(o.city) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('new', 'confirmed', 'packed', 'shipped', 'done', 'cancelled') then
    raise exception 'bad status';
  end if;
  if p_status = 'cancelled' and p_reason is null then raise exception 'reason required'; end if;

  update public.orders
     set status = p_status,
         cancel_reason_id = case when p_status = 'cancelled' then p_reason else cancel_reason_id end,
         updated_at = now()
   where id = p_order;
  perform public.audit('status', 'order', p_order::text,
    json_build_object('from', o.status, 'to', p_status, 'reason', p_reason)::jsonb);
end;
$$;
grant execute on function public.crm_set_status(bigint, text, smallint) to authenticated;

-- One-off backfill: build contacts from the customers the shop already knows, and attach the
-- orders they already placed. Safe to run more than once.
create or replace function public.crm_backfill()
returns json language plpgsql security definer set search_path = public as $$
declare v_made int := 0; v_linked int := 0;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;

  insert into public.contacts (city, full_name, phone, email, telegram_id, user_id)
  select coalesce(p.city, 'katowice'), coalesce(p.full_name, p.display_name),
         public.crm_norm_phone(p.phone), p.email, p.telegram_id, p.id
    from public.profiles p
   where not exists (select 1 from public.contacts c where c.user_id = p.id)
     and (public.crm_norm_phone(p.phone) is null
          or not exists (select 1 from public.contacts c where c.phone = public.crm_norm_phone(p.phone)))
  on conflict do nothing;
  get diagnostics v_made = row_count;

  update public.orders o set contact_id = c.id
    from public.contacts c
   where o.contact_id is null
     and ((o.user_id is not null and c.user_id = o.user_id)
          or (o.telegram_id is not null and c.telegram_id = o.telegram_id));
  get diagnostics v_linked = row_count;

  return json_build_object('contacts_created', v_made, 'orders_linked', v_linked);
end;
$$;
grant execute on function public.crm_backfill() to authenticated;

notify pgrst, 'reload schema';


-- ================= 0034_rpc_hardening.sql ================

-- Locking down the routines the browser never calls.
--
-- Every function in this schema is reachable with the publishable key, because Postgres hands
-- EXECUTE to PUBLIC by default and Supabase additionally grants it to anon and authenticated.
-- That is fine for the functions that check the caller's rights themselves (admin_*, dash_*,
-- crm_*, promo_*, my_*). It is not fine for these four, which trust their caller because only
-- the bot and the edge functions were ever meant to reach them:
--
--   restock_list()        returns the telegram_id of every person waiting for a restock,
--                         together with what they are waiting for. Anyone with the public key
--                         could read the customer list.
--   audit()               writes the audit log. Anyone could forge entries or flood the table,
--                         which is exactly the record meant to settle later arguments.
--   login_availability()  answers whether an e-mail or phone is already registered, so the
--                         customer base could be probed address by address.
--   bump_demand()         writes rows into demand keyed by free text, so the statistics could
--                         be inflated and the table filled with junk.
--
-- Revoking from PUBLIC is the part that actually matters: revoking from anon and authenticated
-- alone leaves the default PUBLIC grant in place, which is how resolve_login stayed readable
-- after the first attempt to close it (0008).
--
-- The internal callers are unaffected: crm_* call audit() as their own definer, and the bot and
-- the signup function connect as service_role, which is granted back explicitly below.

revoke execute on function public.restock_list()                             from public, anon, authenticated;
revoke execute on function public.audit(text, text, text, jsonb)             from public, anon, authenticated;
revoke execute on function public.login_availability(citext, citext, text)   from public, anon, authenticated;
revoke execute on function public.bump_demand(text, text)                    from public, anon, authenticated;

grant execute on function public.restock_list()                           to service_role;
grant execute on function public.login_availability(citext, citext, text) to service_role;
grant execute on function public.bump_demand(text, text)                  to service_role;

-- Trigger functions are only ever run by their triggers, which do not consult these grants.
revoke execute on function public.handle_new_user()     from public, anon, authenticated;
revoke execute on function public.reservation_guard()   from public, anon, authenticated;
revoke execute on function public.reservation_stock()   from public, anon, authenticated;

-- Password guessing.
--
-- The login function forwards the attempt to GoTrue itself, so GoTrue sees the edge function's
-- address instead of the visitor's and its own per-address limit never triggers. That turned
-- /functions/v1/login into an oracle a script could hammer, and the panel uses the same door as
-- the shop. Attempts are counted here, in the database, because the function runs in several
-- copies and a counter in memory would be trivial to sidestep.
create table if not exists public.auth_attempts (
  id  bigint generated always as identity primary key,
  key text not null,                       -- either 'ip:<address>' or 'id:<login>'
  at  timestamptz not null default now()
);
create index if not exists auth_attempts_key_idx on public.auth_attempts (key, at desc);

-- No policies on purpose: only service_role, which bypasses row level security, touches this.
alter table public.auth_attempts enable row level security;

notify pgrst, 'reload schema';


-- ================= 0035_reservation_trust.sql ================

-- A reservation is written straight from the browser under row level security, so every field
-- in it is the customer's word. The limits are already enforced by a trigger; the two fields
-- the manager actually reads were not checked at all:
--
--   product_name  is what the bot and the panel show, and what the goods are picked by. It was
--                 sent by the client, so a reservation for a cheap model could carry the name
--                 of an expensive one. It is now taken from the catalogue by id, city and
--                 flavour, and the client value only survives for a product we do not stock.
--   reserve_time  is shown next to the date. Only the slots on the card are meant to get here,
--                 so anything that is not HH:MM is refused.

create or replace function public.reservation_trust()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select p.name into v_name
    from public.products p
   where p.id = new.product_id
     and p.city = new.city
     and (coalesce(new.flavor, '') = '' or p.flavor = new.flavor)
   limit 1;

  if v_name is not null then
    new.product_name := v_name || case when coalesce(new.flavor, '') = '' then '' else ' ' || new.flavor end;
  else
    -- Not in the catalogue: keep what came in, but never more than the column is meant to hold.
    new.product_name := left(coalesce(new.product_name, new.product_id), 200);
  end if;
  return new;
end;
$$;

-- Runs after a_reservation_guard (limits) and before reservation_stock (writing the stock off).
drop trigger if exists b_reservation_trust on public.reservations;
create trigger b_reservation_trust
  before insert or update of product_id, product_name, flavor on public.reservations
  for each row execute function public.reservation_trust();

alter table public.reservations drop constraint if exists reservations_time_chk;
alter table public.reservations add constraint reservations_time_chk
  check (reserve_time is null or reserve_time ~ '^[0-2][0-9]:[0-5][0-9]$');

revoke execute on function public.reservation_trust() from public, anon, authenticated;

notify pgrst, 'reload schema';


-- ================= 0036_promo_check_auth.sql ================

-- Промокоды нельзя было подбирать только по одной причине: их никто не подбирал.
--
-- promo_check отвечает, существует ли код и какую скидку он даёт, и была доступна анониму,
-- то есть любому с публичным ключом. Список кодов покупателю не виден (политика на
-- promo_codes), но это ничего не меняло: коды человеческие и короткие (LETO10, KATO10),
-- словарь из пары тысяч вариантов перебирается за минуты, а ответ сразу говорит и размер
-- скидки, и город, и категорию.
--
-- Скрывать причину отказа бессмысленно: она нужна покупателю, чтобы понять, почему код не
-- сработал. Поэтому закрывается сам доступ. Проверять код имеет смысл только тому, кто может
-- оформить заказ, а оформление и так требует входа. После этого перебор стоит аккаунта,
-- виден в логах по user_id и упирается в лимит регистраций (5 в час на адрес, 0034).
revoke execute on function public.promo_check(text, text, numeric, text[]) from public, anon;
grant  execute on function public.promo_check(text, text, numeric, text[]) to authenticated, service_role;

notify pgrst, 'reload schema';


-- ================= 0037_reservation_guard_restore.sql ================

-- Лимиты броней снова обходятся, и обходятся полностью.
--
-- 0009 закрыл дыру: гвард выходил на `if new.user_id is null then return new`, а бронь по
-- диплинку бота (t.me/<bot>?start=res_...) приходит без user_id, только с telegram_id. То
-- есть гость мог набрать сколько угодно броней, а триггер списания остатка честно уводил
-- склад в ноль. 0014 поднимала лимит до десяти и переписала функцию целиком, вернув ту самую
-- строку. С тех пор гостевые брони не ограничены ничем.
--
-- Здесь возвращается счёт по обеим привязкам сразу (нельзя набрать лимит отдельно сайтом и
-- отдельно ботом) и отказ брони без владельца. Заодно количество броней приводится к трём:
-- так решил владелец, и ровно это уже написано в текстах витрины («больше трёх броней сразу
-- держать нельзя»), пока база позволяла десять.
create or replace function public.reservation_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count int; v_held int; v_noshow int;
begin
  if new.kind <> 'reserve' then return new; end if;

  -- Бронь без владельца принять не за кого: её никто не выкупит и никому не напомнить.
  if new.user_id is null and new.telegram_id is null then
    raise exception 'RES_NO_OWNER' using errcode = 'P0001';
  end if;

  select count(*), coalesce(sum(qty), 0) into v_count, v_held
    from public.reservations
   where kind = 'reserve' and status in ('active', 'notified')
     and ((new.user_id is not null and user_id = new.user_id)
       or (new.telegram_id is not null and telegram_id = new.telegram_id));

  if v_count >= 3 then raise exception 'RES_LIMIT_COUNT' using errcode = 'P0001'; end if;
  if v_held + coalesce(new.qty, 1) > 10 then raise exception 'RES_LIMIT_QTY' using errcode = 'P0001'; end if;

  select count(*) into v_noshow from public.reservations
   where kind = 'reserve' and status = 'expired' and created_at > now() - interval '30 days'
     and ((new.user_id is not null and user_id = new.user_id)
       or (new.telegram_id is not null and telegram_id = new.telegram_id));
  if v_noshow >= 3 then raise exception 'RES_NOSHOW' using errcode = 'P0001'; end if;

  return new;
end;
$$;

-- Подсказку «у вас в брони N из 10» (my_reservation_load) трогать не нужно: она с 0009 умеет
-- считать по обеим привязкам, 0014 её не переписывала.

notify pgrst, 'reload schema';


-- ================= 0038_crm_contacts_live.sql ================

-- Карточка клиента начинает жить: контакты заводятся сами, заметки видит кто положено,
-- чёрный список работает.
--
-- Таблицы завела 0032, но их никто не заполняет, поэтому CRM пустая. Заводить контакты руками
-- никто не будет, значит их должен создавать сам поток: каждый заказ и каждая бронь ищет
-- человека по телефону, телеграму или аккаунту и заводит карточку, если её ещё нет.

-- ---------- заметки ----------
-- Владелец: заметку видит тот менеджер, который её написал, владелец и разработчик.
-- Прежняя политика открывала заметки всем сотрудникам города, то есть сменщик читал чужие
-- пометки о клиенте.
drop policy if exists contact_notes_staff on public.contact_notes;

drop policy if exists contact_notes_read on public.contact_notes;
create policy contact_notes_read on public.contact_notes for select
  using (author = auth.uid() or public.is_owner_or_dev());

-- Писать заметку может любой, кто вообще работает с этим городом; автором становится он сам.
drop policy if exists contact_notes_write on public.contact_notes;
create policy contact_notes_write on public.contact_notes for insert
  with check (author = auth.uid()
    and exists (select 1 from public.contacts c
                 where c.id = contact_id and public.admin_sees_city(c.city)));

drop policy if exists contact_notes_own_del on public.contact_notes;
create policy contact_notes_own_del on public.contact_notes for delete
  using (author = auth.uid() or public.is_owner_or_dev());

-- ---------- теги ----------
-- Цвета правит владелец, поэтому набор ограничен теми, что панель умеет рисовать.
alter table public.crm_tags drop constraint if exists crm_tags_color_chk;
alter table public.crm_tags add constraint crm_tags_color_chk
  check (color in ('muted', 'accent', 'ok', 'live', 'warn', 'danger', 'new'));

-- ---------- поиск и создание карточки ----------
-- Одна точка входа: и заказ, и бронь зовут её же. Ищем по телефону (он у человека один),
-- потом по телеграму, потом по аккаунту. Найденную карточку дозаполняем тем, чего в ней
-- не было: человек, начавший с бота, со временем обрастает телефоном и почтой.
create or replace function public.crm_touch_contact(
  p_city text, p_name text, p_phone text, p_email text, p_tg bigint, p_user uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_phone text; v_id bigint;
begin
  v_phone := public.crm_norm_phone(p_phone);

  if v_phone is not null then select id into v_id from public.contacts where phone = v_phone; end if;
  if v_id is null and p_tg is not null then select id into v_id from public.contacts where telegram_id = p_tg; end if;
  if v_id is null and p_user is not null then select id into v_id from public.contacts where user_id = p_user; end if;

  if v_id is null then
    insert into public.contacts (city, full_name, phone, email, telegram_id, user_id)
    values (coalesce(p_city, 'katowice'), nullif(btrim(p_name), ''), v_phone,
            nullif(btrim(p_email), ''), p_tg, p_user)
    returning id into v_id;
    return v_id;
  end if;

  update public.contacts set
    full_name   = coalesce(full_name, nullif(btrim(p_name), '')),
    phone       = coalesce(phone, v_phone),
    email       = coalesce(email, nullif(btrim(p_email), '')),
    telegram_id = coalesce(telegram_id, p_tg),
    user_id     = coalesce(user_id, p_user),
    updated_at  = now()
   where id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.crm_touch_contact(text, text, text, text, bigint, uuid) from public, anon, authenticated;

-- ---------- заказ привязывается к человеку ----------
-- Здесь же работает чёрный список: заказ от заблокированного не заводится вовсе, иначе
-- менеджер соберёт его и узнает всё только на выдаче.
create or replace function public.orders_link_contact()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_blocked boolean;
begin
  if new.contact_id is not null then
    select blocked into v_blocked from public.contacts where id = new.contact_id;
    if coalesce(v_blocked, false) then raise exception 'CONTACT_BLOCKED' using errcode = 'P0001'; end if;
    return new;
  end if;

  v_id := public.crm_touch_contact(
    new.city,
    coalesce(new.contact->>'name', ''),
    coalesce(new.contact->>'phone', ''),
    coalesce(new.contact->>'email', ''),
    new.telegram_id,
    new.user_id);

  select blocked into v_blocked from public.contacts where id = v_id;
  if coalesce(v_blocked, false) then raise exception 'CONTACT_BLOCKED' using errcode = 'P0001'; end if;

  new.contact_id := v_id;
  return new;
end;
$$;

drop trigger if exists a_orders_link_contact on public.orders;
create trigger a_orders_link_contact
  before insert on public.orders
  for each row execute function public.orders_link_contact();

-- ---------- бронь тоже ----------
-- У брони нет снимка контактов, поэтому телефон и имя берём из профиля, если он есть.
create or replace function public.reservations_link_contact()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_blocked boolean; p record;
begin
  select full_name, phone, email into p from public.profiles
   where (new.user_id is not null and id = new.user_id)
      or (new.telegram_id is not null and telegram_id = new.telegram_id)
   limit 1;

  v_id := public.crm_touch_contact(new.city, coalesce(p.full_name, ''), coalesce(p.phone, ''),
                                   coalesce(p.email, ''), new.telegram_id, new.user_id);
  select blocked into v_blocked from public.contacts where id = v_id;
  if coalesce(v_blocked, false) then raise exception 'CONTACT_BLOCKED' using errcode = 'P0001'; end if;
  return new;
end;
$$;

-- Префикс b_ ставит её после a_reservation_guard: сперва лимиты, потом карточка.
drop trigger if exists b_reservations_link_contact on public.reservations;
create trigger b_reservations_link_contact
  before insert on public.reservations
  for each row execute function public.reservations_link_contact();

-- ---------- кто такой активный клиент ----------
-- Владелец: активный это тот, кто заказывал минимум три раза, окно 60 дней.
create or replace function public.crm_is_active(p_contact bigint, p_days int default 60, p_min int default 3)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= p_min
    from public.orders
   where contact_id = p_contact and status = 'done'
     and created_at > now() - make_interval(days => p_days);
$$;
grant execute on function public.crm_is_active(bigint, int, int) to authenticated;

notify pgrst, 'reload schema';


-- ================= 0039_stock_money.sql ================

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


-- ================= 0040_manager_rates.sql ================

-- Доля менеджера: процент с прибыли, настраивается в базе и меняется со временем.
--
-- Продавец не отдаёт весь выторг: часть остаётся ему как заработок. Процент у каждого свой и
-- периодически меняется, поэтому он не может жить в коде: владелец и разработчик правят его
-- в панели.
--
-- Ставки хранятся историей, а не одним значением. Если просто перезаписывать процент, то
-- отчёт за прошлый месяц завтра посчитается по новой ставке и разойдётся с тем, что уже
-- выплачено. Каждая строка действует с даты from_date, а к заказу применяется та, что
-- действовала в день заказа.
create table if not exists public.manager_rates (
  id          bigint generated always as identity primary key,
  telegram_id bigint not null,
  city        text not null,
  percent     numeric(5,2) not null,
  base        text not null default 'gross',
  from_date   date not null default (now() at time zone 'Europe/Warsaw')::date,
  note        text,
  created_at  timestamptz not null default now(),
  constraint manager_rates_pct_chk  check (percent >= 0 and percent <= 100),
  constraint manager_rates_city_chk check (city in ('katowice', 'gliwice', 'warszawa')),
  -- gross: процент с прибыли по заказу (выручка минус закупка товара), так владелец и сказал.
  -- revenue: процент со всей суммы заказа, на случай другой договорённости.
  constraint manager_rates_base_chk check (base in ('gross', 'revenue')),
  constraint manager_rates_uniq unique (telegram_id, city, from_date)
);
create index if not exists manager_rates_lookup on public.manager_rates (city, from_date desc);

alter table public.manager_rates enable row level security;
-- Ставки это деньги: менеджер свою не правит и чужую не видит.
drop policy if exists manager_rates_owner on public.manager_rates;
create policy manager_rates_owner on public.manager_rates for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- Ставка, действовавшая в конкретный день. Заказ считается по ней, а не по сегодняшней.
create or replace function public.rate_at(p_tg bigint, p_city text, p_day date)
returns table(percent numeric, base text)
language sql stable security definer set search_path = public as $$
  select r.percent, r.base from public.manager_rates r
   where r.telegram_id = p_tg and r.city = p_city and r.from_date <= p_day
   order by r.from_date desc limit 1;
$$;
revoke execute on function public.rate_at(bigint, text, date) from public, anon, authenticated;

-- Сколько заработал каждый менеджер за период и с какой базы.
create or replace function public.manager_payouts(p_from date, p_to date)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(json_agg(row_to_json(t) order by t.city, t.telegram_id), '[]'::json) into res from (
    select m.telegram_id, m.city,
           max(m.percent) filter (where m.rn = 1) as percent_now,
           coalesce(sum(o.base_sum), 0)  as base_sum,
           coalesce(sum(o.payout), 0)    as payout,
           count(o.id)                   as orders
      from (select telegram_id, city, percent,
                   row_number() over (partition by telegram_id, city order by from_date desc) as rn
              from public.manager_rates) m
      left join lateral (
        select ord.id,
               case when r.base = 'revenue' then ord.sum else ord.sum - coalesce(ord.cogs, 0) end as base_sum,
               round(case when r.base = 'revenue' then ord.sum else ord.sum - coalesce(ord.cogs, 0) end
                     * r.percent / 100, 2) as payout
          from public.orders ord
          cross join lateral public.rate_at(m.telegram_id, m.city, ord.created_at::date) r
         where ord.city = m.city and ord.status = 'done'
           and ord.created_at::date between p_from and p_to
      ) o on true
     where m.rn = 1
     group by m.telegram_id, m.city) t;
  return res;
end;
$$;
grant execute on function public.manager_payouts(date, date) to authenticated;

-- Отчёт по деньгам пересобран: владелец хотел видеть отдельно доход и отдельно то, что
-- остаётся ему после доли продавца.
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
               coalesce(pay.payout, 0) as payout,
               coalesce(e.spent, 0)    as expenses,
               coalesce(w.lost, 0)     as write_offs,
               coalesce(o.revenue, 0) - coalesce(o.cogs, 0) - coalesce(pay.payout, 0)
                 - coalesce(e.spent, 0) - coalesce(w.lost, 0) as profit,
               coalesce(o.orders, 0)   as orders
          from (select unnest(array['katowice', 'gliwice', 'warszawa']) as city) c
          left join (select city, sum(sum) as revenue, sum(coalesce(cogs, 0)) as cogs, count(*) as orders
                       from public.orders
                      where status = 'done' and created_at::date between p_from and p_to
                      group by city) o on o.city = c.city
          left join (select city, sum(amount) as spent from public.expenses
                      where at between p_from and p_to group by city) e on e.city = c.city
          left join (select city, sum(cost) as lost from public.write_offs
                      where created_at::date between p_from and p_to group by city) w on w.city = c.city
          left join (select (x->>'city') as city, sum((x->>'payout')::numeric) as payout
                       from json_array_elements(public.manager_payouts(p_from, p_to)) x
                      group by 1) pay on pay.city = c.city) t),
    'payouts', public.manager_payouts(p_from, p_to),
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


-- ================= 0041_roles_and_stock.sql ================

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


-- ================= 0042_fulfil_fix.sql ================

-- В 0041 переменная называлась qty и затеняла одноимённую колонку products.qty: списание
-- падало на «column reference qty is ambiguous». Имя переменной с префиксом, колонки
-- квалифицированы таблицей.
create or replace function public.orders_fulfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb; v_total numeric := 0; v_take int;
begin
  if new.status <> 'done' or old.status = 'done' then return new; end if;

  for it in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    v_take := greatest(coalesce((it->>'n')::int, 1), 1);

    -- себестоимость по партиям (FIFO)
    v_total := v_total + public.stock_consume(new.city, it->>'id', coalesce(it->>'flavor', ''), v_take);

    -- и сам остаток на витрине
    update public.products p
       set qty = greatest(coalesce(p.qty, 0) - v_take, 0), updated_at = now()
     where p.id = it->>'id' and p.city = new.city and p.flavor = coalesce(it->>'flavor', '');
  end loop;

  if new.cogs is null then new.cogs := v_total; end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';


-- ================= 0043_commissions_labels_tasks.sql ================

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


-- ================= 0044_rate_category_key.sql ================

-- Категория у ставки была nullable, а «пусто» означало «на всё остальное». Из-за NULL
-- уникальный индекс приходилось строить по выражению coalesce(category,''), и upsert по
-- списку колонок в такой индекс не попадает: панель не смогла бы сохранить ставку.
-- Пустая строка вместо NULL решает и то, и другое: ключ обычный, смысл прежний.
alter table public.manager_rates drop constraint if exists manager_rates_category_fkey;
update public.manager_rates set category = '' where category is null;
alter table public.manager_rates alter column category set default '';
alter table public.manager_rates alter column category set not null;

drop index if exists public.manager_rates_uniq;
create unique index if not exists manager_rates_uniq
  on public.manager_rates (telegram_id, city, category, from_date);

-- Категория должна существовать в справочнике, кроме пустой строки «все остальные».
-- Подзапрос в check нельзя, поэтому это внешний ключ на справочник с исключением для пустой
-- строки: строку '' заводим в справочнике служебной записью, скрытой от списков (active=false).
insert into public.product_categories (id, name_ru, name_uk, name_pl, sort, active)
values ('', 'все остальные', 'усі інші', 'pozostałe', 999, false)
on conflict (id) do nothing;

alter table public.manager_rates drop constraint if exists manager_rates_category_fkey;
alter table public.manager_rates add constraint manager_rates_category_fkey
  foreign key (category) references public.product_categories(id) on delete cascade;

create or replace function public.rate_at(p_tg bigint, p_city text, p_day date, p_category text default '')
returns table(percent numeric, base text)
language sql stable security definer set search_path = public as $$
  select r.percent, r.base from public.manager_rates r
   where r.telegram_id = p_tg and r.city = p_city and r.from_date <= p_day
     and (r.category = coalesce(p_category, '') or r.category = '')
   order by (r.category <> '') desc, r.from_date desc
   limit 1;
$$;
revoke execute on function public.rate_at(bigint, text, date, text) from public, anon, authenticated;

notify pgrst, 'reload schema';


-- ================= 0045_product_cost.sql ================

-- Закупочная цена у товара.
--
-- Партии дают точную себестоимость, но только для того, что пришло через поставку. Товар,
-- лежавший на полке до появления учёта, списывался с нулевой стоимостью, и маржа по нему
-- выходила равной выручке. Теперь у позиции есть своя закупочная цена, и она подставляется
-- ровно там, где партий не хватило.
alter table public.products add column if not exists cost numeric(10,2);
comment on column public.products.cost is 'закупочная цена за штуку, запасная для остатка без партии';

create or replace function public.stock_consume(
  p_city text, p_product text, p_flavor text, p_qty int)
returns numeric language plpgsql security definer set search_path = public as $$
declare need int := p_qty; total numeric := 0; b record; take int; v_cost numeric;
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

  -- Партий не хватило: остаток считаем по закупочной цене самой позиции, если она задана.
  -- Продажу по-прежнему не блокируем, но и нулевой себестоимости больше нет.
  if need > 0 then
    select cost into v_cost from public.products
     where id = p_product and city = p_city and flavor = coalesce(p_flavor, '') limit 1;
    total := total + need * coalesce(v_cost, 0);
  end if;

  return total;
end;
$$;
revoke execute on function public.stock_consume(text, text, text, int) from public, anon, authenticated;

notify pgrst, 'reload schema';


-- ================= 0046_overview_tasks.sql ================

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


-- ================= 0047_stock_moves.sql ================

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


-- ================= 0048_payout_rate_shown.sql ================

-- Действующая ставка в отчёте по выплатам.
--
-- Пока процент был один на менеджера, отчёт его возвращал. Ставки разъехались по категориям
-- (0043), поле пропало, и в «Финансах» колонка «Ставка сейчас» у всех показывала прочерк:
-- деньги считались верно, а по какому проценту, было не видно.
--
-- Одного числа на менеджера больше не существует, поэтому возвращаем общую ставку («все
-- остальные») и отдельно считаем, сколько категорий переопределено. Прочерк остаётся только
-- там, где общая ставка и правда не задана.
create or replace function public.manager_payouts(p_from date, p_to date)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_full_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(json_agg(row_to_json(t) order by t.city, t.telegram_id), '[]'::json) into res from (
    select m.telegram_id, m.city,
           coalesce(sum(l.base_sum), 0) as base_sum,
           coalesce(sum(l.payout), 0)   as payout,
           count(distinct l.order_id)   as orders,
           (select r.percent from public.manager_rates r
             where r.telegram_id = m.telegram_id and r.city = m.city and r.category = ''
             order by r.from_date desc limit 1) as percent_now,
           (select r.base from public.manager_rates r
             where r.telegram_id = m.telegram_id and r.city = m.city
             order by (r.category = '') desc, r.from_date desc limit 1) as base_now,
           (select count(*) from public.manager_rates r
             where r.telegram_id = m.telegram_id and r.city = m.city and r.category <> '') as cat_rates
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

notify pgrst, 'reload schema';


-- ================= 0049_supply_flavor_guard.sql ================

-- Опечатка во вкусе больше не заводит фантомный товар.
--
-- Проведение искало строку по точному совпадению id + город + вкус, а если не находило,
-- заводило новую позицию. Задумано это было для товара, которого в городе ещё нет, но
-- работало и на опечатку: «Sour Aple» вместо «Sour Apple» молча создавал вторую позицию с
-- остатком, без цены и без названия, и всплывала она уже на витрине.
--
-- Различить эти два случая можно точно. Если товара с таким id в городе нет вовсе, это
-- новая позиция, и заводить её нормально. Если товар есть, а вкуса нет, то это опечатка:
-- вкусы у позиции заводят в ассортименте, а не в накладной. Второй случай останавливаем и
-- называем, что именно не сошлось.
create or replace function public.supply_post(p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare s record; l record; n int := 0; v_qty int; v_known text;
begin
  -- Проводит поставку только полный доступ. Раньше здесь стоял admin_sees_city, и менеджер
  -- города проходил проверку: сам документ он не видит (таблица закрыта в 0041), но функция
  -- security definer читает её мимо RLS, а номера последовательные. То есть чужой черновик
  -- можно было провести вслепую, подобрав id.
  select * into s from public.supplies where id = p_id;
  if s is null or not public.is_full_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if s.status = 'posted' then raise exception 'ALREADY_POSTED' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.supply_lines where supply_id = p_id) then
    raise exception 'EMPTY_SUPPLY' using errcode = 'P0001';
  end if;

  -- Сперва проверяем весь документ, потом меняем склад. Иначе половина строк уже легла бы
  -- на полку, а вторая упала с ошибкой, и поставку пришлось бы разбирать руками.
  for l in select * from public.supply_lines where supply_id = p_id loop
    if not exists (select 1 from public.products p
                    where p.id = l.product_id and p.city = s.city and p.flavor = l.flavor)
       and exists (select 1 from public.products p
                    where p.id = l.product_id and p.city = s.city) then
      select string_agg(nullif(p.flavor, ''), ', ' order by p.flavor) into v_known
        from public.products p where p.id = l.product_id and p.city = s.city;
      raise exception 'BAD_FLAVOR: % / % (%)', l.product_id, l.flavor, coalesce(v_known, '')
        using errcode = 'P0001';
    end if;
  end loop;

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

notify pgrst, 'reload schema';


-- ================= 0050_promo_server_side.sql ================

-- Лимиты промокода перестают зависеть от честности браузера.
--
-- Как было. Скидку считает сервер (0026), но расход кода записывал КЛИЕНТ: витрина после
-- заказа звала promo_use, и звала её через .catch(() => {}), то есть молча. Кто не позовёт,
-- у того код и не потратится. Отсюда два следствия: «раз на человека» не работает вовсе, а
-- общий лимит держится только на добросовестности покупателя.
--
-- Вторая половина той же дыры: заказ заводит edge-функция под service_role, а там auth.uid()
-- пустой, поэтому и проверка «сколько раз этот человек уже применял код» внутри promo_check
-- просто пропускалась.
--
-- Как стало. Функция принимает того, кто заказывает, явным параметром и считает лимит по
-- нему, когда auth.uid() недоступен. Расход записывает сервер сразу после того, как заказ
-- лёг в таблицу, отдельной функцией, доступной только service_role.

-- ---------- проверка кода ----------
drop function if exists public.promo_check(text, text, numeric, text[]);

create function public.promo_check(
  p_code text, p_city text, p_sum numeric, p_categories text[] default null, p_user uuid default null)
returns table(ok boolean, discount integer, kind text, value numeric, stackable boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare p record; v_used int; v_disc numeric; v_who uuid;
begin
  -- Из браузера человек известен сессией, из edge-функции его передают параметром. Своему
  -- auth.uid() доверяем больше: подставить чужой uuid в параметр может кто угодно, но и вреда
  -- в этом нет, чужой лимит так только ужесточишь.
  v_who := coalesce(auth.uid(), p_user);

  select * into p from public.promo_codes where code = trim(p_code);
  if p is null then return query select false, 0, null::text, null::numeric, true, 'not_found'; return; end if;
  if not p.active then return query select false, 0, p.kind, p.value, p.stackable, 'inactive'; return; end if;
  if p.starts_at is not null and now() < p.starts_at then
    return query select false, 0, p.kind, p.value, p.stackable, 'not_started'; return; end if;
  if p.expires_at is not null and now() > p.expires_at then
    return query select false, 0, p.kind, p.value, p.stackable, 'expired'; return; end if;
  if p.city is not null and p.city is distinct from p_city then
    return query select false, 0, p.kind, p.value, p.stackable, 'other_city'; return; end if;
  if p.category is not null and (p_categories is null or not (p.category = any(p_categories))) then
    return query select false, 0, p.kind, p.value, p.stackable, 'other_category'; return; end if;
  if p_sum < p.min_sum then
    return query select false, 0, p.kind, p.value, p.stackable, 'min_sum'; return; end if;
  if p.max_uses is not null and p.used >= p.max_uses then
    return query select false, 0, p.kind, p.value, p.stackable, 'limit'; return; end if;
  if v_who is not null and p.per_user > 0 then
    select count(*) into v_used from public.promo_uses where code = p.code and user_id = v_who;
    if v_used >= p.per_user then
      return query select false, 0, p.kind, p.value, p.stackable, 'used_by_you'; return; end if;
  end if;

  v_disc := case when p.kind = 'percent' then round(p_sum * p.value / 100) else p.value end;
  if v_disc > p_sum then v_disc := p_sum; end if;
  return query select true, v_disc::int, p.kind, p.value, p.stackable, null::text;
end;
$$;
-- Аноним по-прежнему код проверить не может (0036): коды короткие, их подбирали словарём.
revoke execute on function public.promo_check(text, text, numeric, text[], uuid) from public, anon;
grant  execute on function public.promo_check(text, text, numeric, text[], uuid) to authenticated, service_role;

-- ---------- запись расхода ----------
-- Пишет сервер и только он. Человек в параметре, потому что под service_role auth.uid() пуст.
-- Повторный вызов по тому же заказу ничего не удваивает: один код на заказ засчитывается раз.
create or replace function public.promo_use_for(p_code text, p_order bigint, p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.promo_codes where code = trim(p_code);
  if p is null or not p.active then return false; end if;
  if p_order is not null and exists (
    select 1 from public.promo_uses where code = p.code and order_id = p_order) then
    return false;
  end if;
  insert into public.promo_uses (code, user_id, order_id) values (p.code, p_user, p_order);
  update public.promo_codes set used = used + 1 where code = p.code;
  return true;
end;
$$;
revoke execute on function public.promo_use_for(text, bigint, uuid) from public, anon, authenticated;
grant  execute on function public.promo_use_for(text, bigint, uuid) to service_role;

-- Клиентскую promo_use убираем: витрина её больше не зовёт, а оставленная функция это ровно
-- та кнопка «засчитать код», которой можно было не пользоваться.
drop function if exists public.promo_use(text, bigint);

notify pgrst, 'reload schema';
