-- Действующая ставка в отчёте по выплатам.
--
-- Пока процент был один на менеджера, отчёт его возвращал. Ставки разъехались по категориям
-- (0043), поле пропало, и в «Финансах» колонка «Ставка сейчас» у всех показывала прочерк:
-- деньги считались верно, а по какому проценту, было не видно.
--
-- Одного числа на менеджера больше не существует, поэтому возвращаем общую ставку («все
-- остальные») и отдельно считаем, сколько категорий переопределено. Прочерк остаётся только
-- там, где общая ставка и правда не задана.
create or replace function public.manager_payouts(p_from date, p_to date)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_full_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(json_agg(row_to_json(t) order by t.city, t.telegram_id), '[]'::json) into res from (
    select m.telegram_id, m.city,
           coalesce(sum(l.base_sum), 0) as base_sum,
           coalesce(sum(l.payout), 0)   as payout,
           count(distinct l.order_id)   as orders,
           (select r.percent from public.manager_rates r
             where r.telegram_id = m.telegram_id and r.city = m.city and r.category = ''
             order by r.from_date desc limit 1) as percent_now,
           (select r.base from public.manager_rates r
             where r.telegram_id = m.telegram_id and r.city = m.city
             order by (r.category = '') desc, r.from_date desc limit 1) as base_now,
           (select count(*) from public.manager_rates r
             where r.telegram_id = m.telegram_id and r.city = m.city and r.category <> '') as cat_rates
      from (select distinct telegram_id, city from public.manager_rates) m
      left join lateral (
        select ord.id as order_id,
               case when r.base = 'revenue' then coalesce((i->>'sum')::numeric, 0)
                    else coalesce((i->>'sum')::numeric, 0) - coalesce((i->>'cost')::numeric, 0) end as base_sum,
               round((case when r.base = 'revenue' then coalesce((i->>'sum')::numeric, 0)
                           else coalesce((i->>'sum')::numeric, 0) - coalesce((i->>'cost')::numeric, 0) end)
                     * r.percent / 100, 2) as payout
          from public.orders ord
          cross join lateral jsonb_array_elements(coalesce(ord.items, '[]'::jsonb)) i
          cross join lateral public.rate_at(m.telegram_id, m.city, ord.created_at::date, i->>'category') r
         where ord.city = m.city and ord.status = 'done'
           and ord.created_at::date between p_from and p_to
      ) l on true
     group by m.telegram_id, m.city) t;
  return res;
end;
$$;
grant execute on function public.manager_payouts(date, date) to authenticated;

notify pgrst, 'reload schema';
