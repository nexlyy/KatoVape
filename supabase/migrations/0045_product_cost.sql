-- Закупочная цена у товара.
--
-- Партии дают точную себестоимость, но только для того, что пришло через поставку. Товар,
-- лежавший на полке до появления учёта, списывался с нулевой стоимостью, и маржа по нему
-- выходила равной выручке. Теперь у позиции есть своя закупочная цена, и она подставляется
-- ровно там, где партий не хватило.
alter table public.products add column if not exists cost numeric(10,2);
comment on column public.products.cost is 'закупочная цена за штуку, запасная для остатка без партии';

create or replace function public.stock_consume(
  p_city text, p_product text, p_flavor text, p_qty int)
returns numeric language plpgsql security definer set search_path = public as $$
declare need int := p_qty; total numeric := 0; b record; take int; v_cost numeric;
begin
  for b in select id, qty_left, cost from public.batches
            where city = p_city and product_id = p_product and flavor = coalesce(p_flavor, '')
              and qty_left > 0
            order by created_at, id
  loop
    exit when need <= 0;
    take := least(need, b.qty_left);
    update public.batches set qty_left = qty_left - take where id = b.id;
    total := total + take * b.cost;
    need := need - take;
  end loop;

  -- Партий не хватило: остаток считаем по закупочной цене самой позиции, если она задана.
  -- Продажу по-прежнему не блокируем, но и нулевой себестоимости больше нет.
  if need > 0 then
    select cost into v_cost from public.products
     where id = p_product and city = p_city and flavor = coalesce(p_flavor, '') limit 1;
    total := total + need * coalesce(v_cost, 0);
  end if;

  return total;
end;
$$;
revoke execute on function public.stock_consume(text, text, text, int) from public, anon, authenticated;

notify pgrst, 'reload schema';
