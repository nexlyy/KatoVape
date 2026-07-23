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
