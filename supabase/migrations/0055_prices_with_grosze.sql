-- Цены с грошами.
--
-- Цена продажи была целым числом злотых, и 45,50 округлялось до 46 ещё при сохранении.
-- У поставщиков скидочные цены дробные, магазин должен их повторять один в один, иначе
-- витрина обещает одно, а касса берёт другое.
--
-- Закупка (products.cost) и расходы уже были с грошами, теперь к ним приведены цена товара,
-- сумма заказа, скидка и минимальная сумма промокода. Колонку orders.amount не трогаем:
-- это сумма в грошах для платёжной системы, она целая по своей природе.

alter table public.products    alter column price    type numeric(10,2) using price::numeric(10,2);
alter table public.orders      alter column sum      type numeric(10,2) using sum::numeric(10,2);
alter table public.orders      alter column discount type numeric(10,2) using discount::numeric(10,2);
alter table public.promo_codes alter column min_sum  type numeric(10,2) using min_sum::numeric(10,2);

-- Скидка тоже перестаёт быть целой: десять процентов от 45,50 это 4,55, а не 5.
drop function if exists public.promo_check(text, text, numeric, text[], uuid);

create function public.promo_check(
  p_code text, p_city text, p_sum numeric, p_categories text[] default null, p_user uuid default null)
returns table(ok boolean, discount numeric, kind text, value numeric, stackable boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare p record; v_used int; v_disc numeric; v_who uuid;
begin
  v_who := coalesce(auth.uid(), p_user);

  select * into p from public.promo_codes where code = trim(p_code);
  if p is null then return query select false, 0::numeric, null::text, null::numeric, true, 'not_found'; return; end if;
  if not p.active then return query select false, 0::numeric, p.kind, p.value, p.stackable, 'inactive'; return; end if;
  if p.starts_at is not null and now() < p.starts_at then
    return query select false, 0::numeric, p.kind, p.value, p.stackable, 'not_started'; return; end if;
  if p.expires_at is not null and now() > p.expires_at then
    return query select false, 0::numeric, p.kind, p.value, p.stackable, 'expired'; return; end if;
  if p.city is not null and p.city is distinct from p_city then
    return query select false, 0::numeric, p.kind, p.value, p.stackable, 'other_city'; return; end if;
  if p.category is not null and (p_categories is null or not (p.category = any(p_categories))) then
    return query select false, 0::numeric, p.kind, p.value, p.stackable, 'other_category'; return; end if;
  if p_sum < p.min_sum then
    return query select false, 0::numeric, p.kind, p.value, p.stackable, 'min_sum'; return; end if;
  if p.max_uses is not null and p.used >= p.max_uses then
    return query select false, 0::numeric, p.kind, p.value, p.stackable, 'limit'; return; end if;
  if v_who is not null and p.per_user > 0 then
    select count(*) into v_used from public.promo_uses where code = p.code and user_id = v_who;
    if v_used >= p.per_user then
      return query select false, 0::numeric, p.kind, p.value, p.stackable, 'used_by_you'; return; end if;
  end if;

  v_disc := case when p.kind = 'percent' then round(p_sum * p.value / 100, 2) else round(p.value, 2) end;
  if v_disc > p_sum then v_disc := p_sum; end if;
  return query select true, v_disc, p.kind, p.value, p.stackable, null::text;
end;
$$;
revoke execute on function public.promo_check(text, text, numeric, text[], uuid) from public, anon;
grant  execute on function public.promo_check(text, text, numeric, text[], uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
