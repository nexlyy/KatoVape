-- KatoVape: ТЗ v2 (июль 2026). Поверх 0001_auth.sql и 0002_shop.sql.
-- Профиль с данными доставки, статусы заказов, бронь на дату, отзывы по купленным
-- вкусам, возврат остатка при отказе, админ-редактирование ассортимента.

-- ---- профиль: данные для получения посылки ----
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists paczkomat text;   -- номер пачкомата InPost, только для доставки InPost

-- ---- заказы: статусная цепочка и снимок контактов ----
-- статусы: new (оформлен) -> confirmed (подтверждён менеджером) -> done (выдан)
--          либо cancelled (отказ). Статус меняет менеджер в админке.
alter table public.orders add column if not exists contact jsonb;                 -- {name, phone, email, paczkomat}
alter table public.orders add column if not exists manager_notified_at timestamptz; -- бот отметил, что менеджер оповещён
alter table public.orders add column if not exists client_notified_status text;     -- какой статус бот уже сообщил клиенту
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders drop constraint if exists orders_status_chk;
alter table public.orders add constraint orders_status_chk
  check (status in ('new', 'confirmed', 'done', 'cancelled'));

drop policy if exists ord_admin_upd on public.orders;
create policy ord_admin_upd on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- ---- бронь: дата выдачи (до 7 дней) + возврат остатка при отказе ----
-- kind: 'reserve' — бронь на дату (списывает остаток),
--       'notify'  — «сообщить о поступлении» (старое поведение, остаток не трогает).
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

-- списание остатка при брони и возврат при отказе/просрочке.
-- отказ = клиент отменил, менеджер отменил или дата прошла без выкупа — во всех
-- трёх случаях статус становится cancelled/expired и остаток возвращается.
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

-- клиент отменяет свою бронь сам (только свою и только активную)
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

-- ---- отзывы: только на купленный вкус после выдачи заказа ----
create table if not exists public.reviews (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  product_id   text not null,
  flavor       text not null default '',
  product_name text,                                -- полное имя для показа: «Elf Liq Spearmint»
  author       text,                                -- имя автора на момент отзыва (чужие профили закрыты RLS)
  stars        integer not null check (stars between 1 and 5),
  body         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, product_id, flavor)
);
alter table public.reviews enable row level security;

-- вкус считается купленным, если он есть в составе выданного (done) заказа.
-- заказ хранит items как [{id, flavor, ...}], поэтому хватает jsonb-вложенности.
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
-- и при правке отзыв остаётся привязан к купленному вкусу
drop policy if exists rev_upd on public.reviews;
create policy rev_upd on public.reviews
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.can_review(product_id, flavor));
drop policy if exists rev_del on public.reviews;
create policy rev_del on public.reviews
  for delete using (auth.uid() = user_id or public.is_admin());

-- какие вкусы человеку можно оценить (для формы в профиле)
create or replace function public.my_reviewables()
returns table(product_id text, flavor text)
language sql stable security definer set search_path = public as $$
  select distinct e->>'id', coalesce(e->>'flavor', '')
  from public.orders o, jsonb_array_elements(o.items) e
  where o.user_id = auth.uid() and o.status = 'done' and e->>'id' is not null;
$$;
grant execute on function public.my_reviewables() to authenticated;

-- ---- ассортимент: правит только админ, каталог читают все ----
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- «сообщить о поступлении» учитывает только notify-строки ----
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
  group by r.id, telegram_id, product_name;
$$;

-- ---- ужесточение доступа (аудит) ----
-- admins и bot_users были без RLS: любой с publishable-ключом мог читать их
-- и даже вписать себя в админы. Включаем RLS без политик: остаётся только
-- service_role (бот) и security definer функции.
alter table public.admins enable row level security;
alter table public.bot_users enable row level security;

-- профиль: клиент правит только свои контактные поля. Привязку Telegram ставит
-- только сервер (edge function), иначе можно присвоить чужой telegram_id и
-- пройти проверку is_admin().
revoke update on table public.profiles from authenticated;
grant update (username, display_name, full_name, phone, email, paczkomat, updated_at)
  on table public.profiles to authenticated;

-- бронь: статус на входе только штатный, количество разумное,
-- чужой telegram_id в бронь не подставить (иначе бот спамил бы постороннему)
alter table public.reservations drop constraint if exists res_qty_chk;
alter table public.reservations add constraint res_qty_chk check (qty between 1 and 5);
drop policy if exists res_own_ins on public.reservations;
create policy res_own_ins on public.reservations for insert with check (
  auth.uid() = user_id
  and status in ('active', 'waiting')
  and (telegram_id is null or telegram_id = (select telegram_id from public.profiles where id = auth.uid()))
);

-- сводка для админки: добавились разрезы по статусам заказов
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
