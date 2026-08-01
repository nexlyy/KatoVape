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
