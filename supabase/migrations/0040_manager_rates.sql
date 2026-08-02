-- Доля менеджера: процент с прибыли, настраивается в базе и меняется со временем.
--
-- Продавец не отдаёт весь выторг: часть остаётся ему как заработок. Процент у каждого свой и
-- периодически меняется, поэтому он не может жить в коде: владелец и разработчик правят его
-- в панели.
--
-- Ставки хранятся историей, а не одним значением. Если просто перезаписывать процент, то
-- отчёт за прошлый месяц завтра посчитается по новой ставке и разойдётся с тем, что уже
-- выплачено. Каждая строка действует с даты from_date, а к заказу применяется та, что
-- действовала в день заказа.
create table if not exists public.manager_rates (
  id          bigint generated always as identity primary key,
  telegram_id bigint not null,
  city        text not null,
  percent     numeric(5,2) not null,
  base        text not null default 'gross',
  from_date   date not null default (now() at time zone 'Europe/Warsaw')::date,
  note        text,
  created_at  timestamptz not null default now(),
  constraint manager_rates_pct_chk  check (percent >= 0 and percent <= 100),
  constraint manager_rates_city_chk check (city in ('katowice', 'gliwice', 'warszawa')),
  -- gross: процент с прибыли по заказу (выручка минус закупка товара), так владелец и сказал.
  -- revenue: процент со всей суммы заказа, на случай другой договорённости.
  constraint manager_rates_base_chk check (base in ('gross', 'revenue')),
  constraint manager_rates_uniq unique (telegram_id, city, from_date)
);
create index if not exists manager_rates_lookup on public.manager_rates (city, from_date desc);

alter table public.manager_rates enable row level security;
-- Ставки это деньги: менеджер свою не правит и чужую не видит.
drop policy if exists manager_rates_owner on public.manager_rates;
create policy manager_rates_owner on public.manager_rates for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- Ставка, действовавшая в конкретный день. Заказ считается по ней, а не по сегодняшней.
create or replace function public.rate_at(p_tg bigint, p_city text, p_day date)
returns table(percent numeric, base text)
language sql stable security definer set search_path = public as $$
  select r.percent, r.base from public.manager_rates r
   where r.telegram_id = p_tg and r.city = p_city and r.from_date <= p_day
   order by r.from_date desc limit 1;
$$;
revoke execute on function public.rate_at(bigint, text, date) from public, anon, authenticated;

-- Сколько заработал каждый менеджер за период и с какой базы.
create or replace function public.manager_payouts(p_from date, p_to date)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(json_agg(row_to_json(t) order by t.city, t.telegram_id), '[]'::json) into res from (
    select m.telegram_id, m.city,
           max(m.percent) filter (where m.rn = 1) as percent_now,
           coalesce(sum(o.base_sum), 0)  as base_sum,
           coalesce(sum(o.payout), 0)    as payout,
           count(o.id)                   as orders
      from (select telegram_id, city, percent,
                   row_number() over (partition by telegram_id, city order by from_date desc) as rn
              from public.manager_rates) m
      left join lateral (
        select ord.id,
               case when r.base = 'revenue' then ord.sum else ord.sum - coalesce(ord.cogs, 0) end as base_sum,
               round(case when r.base = 'revenue' then ord.sum else ord.sum - coalesce(ord.cogs, 0) end
                     * r.percent / 100, 2) as payout
          from public.orders ord
          cross join lateral public.rate_at(m.telegram_id, m.city, ord.created_at::date) r
         where ord.city = m.city and ord.status = 'done'
           and ord.created_at::date between p_from and p_to
      ) o on true
     where m.rn = 1
     group by m.telegram_id, m.city) t;
  return res;
end;
$$;
grant execute on function public.manager_payouts(date, date) to authenticated;

-- Отчёт по деньгам пересобран: владелец хотел видеть отдельно доход и отдельно то, что
-- остаётся ему после доли продавца.
create or replace function public.fin_report(p_from date, p_to date)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;
  select json_build_object(
    'by_city', (
      select coalesce(json_agg(row_to_json(t) order by t.city), '[]'::json) from (
        select c.city,
               coalesce(o.revenue, 0)  as revenue,
               coalesce(o.cogs, 0)     as cogs,
               coalesce(o.revenue, 0) - coalesce(o.cogs, 0) as gross,
               coalesce(pay.payout, 0) as payout,
               coalesce(e.spent, 0)    as expenses,
               coalesce(w.lost, 0)     as write_offs,
               coalesce(o.revenue, 0) - coalesce(o.cogs, 0) - coalesce(pay.payout, 0)
                 - coalesce(e.spent, 0) - coalesce(w.lost, 0) as profit,
               coalesce(o.orders, 0)   as orders
          from (select unnest(array['katowice', 'gliwice', 'warszawa']) as city) c
          left join (select city, sum(sum) as revenue, sum(coalesce(cogs, 0)) as cogs, count(*) as orders
                       from public.orders
                      where status = 'done' and created_at::date between p_from and p_to
                      group by city) o on o.city = c.city
          left join (select city, sum(amount) as spent from public.expenses
                      where at between p_from and p_to group by city) e on e.city = c.city
          left join (select city, sum(cost) as lost from public.write_offs
                      where created_at::date between p_from and p_to group by city) w on w.city = c.city
          left join (select (x->>'city') as city, sum((x->>'payout')::numeric) as payout
                       from json_array_elements(public.manager_payouts(p_from, p_to)) x
                      group by 1) pay on pay.city = c.city) t),
    'payouts', public.manager_payouts(p_from, p_to),
    'shared_expenses', (select coalesce(sum(amount), 0) from public.expenses
                         where city is null and at between p_from and p_to),
    'by_category', (
      select coalesce(json_agg(row_to_json(t) order by t.spent desc), '[]'::json) from (
        select coalesce(ec.name, 'без категории') as name, sum(e.amount) as spent
          from public.expenses e left join public.expense_categories ec on ec.id = e.category_id
         where e.at between p_from and p_to group by 1) t),
    'by_day', (
      select coalesce(json_agg(row_to_json(t) order by t.day), '[]'::json) from (
        select d::date as day,
               (select coalesce(sum(sum), 0) from public.orders
                 where status = 'done' and created_at::date = d::date) as revenue,
               (select coalesce(sum(amount), 0) from public.expenses where at = d::date) as spent
          from generate_series(p_from, p_to, interval '1 day') d) t)
  ) into res;
  return res;
end;
$$;
grant execute on function public.fin_report(date, date) to authenticated;

notify pgrst, 'reload schema';
