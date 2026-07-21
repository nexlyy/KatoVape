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
