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
