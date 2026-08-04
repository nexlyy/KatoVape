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
