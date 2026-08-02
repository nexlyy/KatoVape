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
