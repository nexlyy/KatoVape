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
