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
