-- Опечатка во вкусе больше не заводит фантомный товар.
--
-- Проведение искало строку по точному совпадению id + город + вкус, а если не находило,
-- заводило новую позицию. Задумано это было для товара, которого в городе ещё нет, но
-- работало и на опечатку: «Sour Aple» вместо «Sour Apple» молча создавал вторую позицию с
-- остатком, без цены и без названия, и всплывала она уже на витрине.
--
-- Различить эти два случая можно точно. Если товара с таким id в городе нет вовсе, это
-- новая позиция, и заводить её нормально. Если товар есть, а вкуса нет, то это опечатка:
-- вкусы у позиции заводят в ассортименте, а не в накладной. Второй случай останавливаем и
-- называем, что именно не сошлось.
create or replace function public.supply_post(p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare s record; l record; n int := 0; v_qty int; v_known text;
begin
  -- Проводит поставку только полный доступ. Раньше здесь стоял admin_sees_city, и менеджер
  -- города проходил проверку: сам документ он не видит (таблица закрыта в 0041), но функция
  -- security definer читает её мимо RLS, а номера последовательные. То есть чужой черновик
  -- можно было провести вслепую, подобрав id.
  select * into s from public.supplies where id = p_id;
  if s is null or not public.is_full_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if s.status = 'posted' then raise exception 'ALREADY_POSTED' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.supply_lines where supply_id = p_id) then
    raise exception 'EMPTY_SUPPLY' using errcode = 'P0001';
  end if;

  -- Сперва проверяем весь документ, потом меняем склад. Иначе половина строк уже легла бы
  -- на полку, а вторая упала с ошибкой, и поставку пришлось бы разбирать руками.
  for l in select * from public.supply_lines where supply_id = p_id loop
    if not exists (select 1 from public.products p
                    where p.id = l.product_id and p.city = s.city and p.flavor = l.flavor)
       and exists (select 1 from public.products p
                    where p.id = l.product_id and p.city = s.city) then
      select string_agg(nullif(p.flavor, ''), ', ' order by p.flavor) into v_known
        from public.products p where p.id = l.product_id and p.city = s.city;
      raise exception 'BAD_FLAVOR: % / % (%)', l.product_id, l.flavor, coalesce(v_known, '')
        using errcode = 'P0001';
    end if;
  end loop;

  for l in select * from public.supply_lines where supply_id = p_id loop
    insert into public.batches (city, product_id, flavor, supply_id, qty_in, qty_left, cost)
    values (s.city, l.product_id, l.flavor, p_id, l.qty, l.qty, l.cost);

    perform public.stock_mark('supply', p_id, l.qty * l.cost);
    -- остаток на витрине: строка товара может ещё не существовать, тогда её заводит поставка
    update public.products set qty = coalesce(qty, 0) + l.qty, updated_at = now()
     where id = l.product_id and city = s.city and flavor = l.flavor
    returning qty into v_qty;
    if v_qty is null then
      insert into public.products (id, city, flavor, name, qty, updated_at)
      values (l.product_id, s.city, l.flavor, l.product_id, l.qty, now())
      on conflict (id, city, flavor) do update set qty = public.products.qty + l.qty;
    end if;
    n := n + 1;
  end loop;
  perform public.stock_unmark();

  update public.supplies set status = 'posted', posted_at = now() where id = p_id;
  perform public.audit('post', 'supply', p_id::text, json_build_object('lines', n)::jsonb);
  return json_build_object('lines', n);
end;
$$;
grant execute on function public.supply_post(bigint) to authenticated;

notify pgrst, 'reload schema';
