-- Owner dashboard: every figure is aggregated in the database and returned as one JSON
-- document per section. Pulling the raw orders into the browser would not survive the first
-- busy month, and the role check must not live in the interface alone.
--
-- What the schema cannot answer is deliberately absent rather than faked:
--   * margin needs purchase prices, which the catalogue does not store, so the money figures
--     are revenue, never profit;
--   * orders carry no manager, only a city, so manager stats are derived from the city map;
--   * only created_at and updated_at exist, so handling time is an approximation.

-- Hardened in 0031: this predicate must never return null, or the guards below would be
-- skipped instead of raising.
create or replace function public.is_owner_or_dev()
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_role() in ('owner', 'dev');
$$;
grant execute on function public.is_owner_or_dev() to authenticated;

-- Revenue counts orders that were actually handed over. Cancelled and pending ones are
-- reported separately so the headline number is not inflated.
create or replace function public.dash_kpi(p_from timestamptz, p_to timestamptz)
returns json language plpgsql stable security definer set search_path = public as $$
declare span interval; prev_from timestamptz; res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;
  span := p_to - p_from;
  prev_from := p_from - span;

  select json_build_object(
    'revenue_total',   (select coalesce(sum(sum), 0) from orders where status = 'done'),
    'revenue_period',  (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= p_from and created_at < p_to),
    'revenue_prev',    (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= prev_from and created_at < p_from),
    'revenue_today',   (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= date_trunc('day', now())),
    'revenue_week',    (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= now() - interval '7 days'),
    'revenue_month',   (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= now() - interval '30 days'),
    'revenue_year',    (select coalesce(sum(sum), 0) from orders where status = 'done' and created_at >= now() - interval '365 days'),
    'orders',          (select count(*) from orders where created_at >= p_from and created_at < p_to),
    'orders_prev',     (select count(*) from orders where created_at >= prev_from and created_at < p_from),
    'orders_done',     (select count(*) from orders where status = 'done' and created_at >= p_from and created_at < p_to),
    'orders_cancelled',(select count(*) from orders where status = 'cancelled' and created_at >= p_from and created_at < p_to),
    'res_active',      (select count(*) from reservations where kind = 'reserve' and status in ('active', 'notified')),
    'avg_check',       (select coalesce(round(avg(sum)), 0) from orders where status = 'done' and created_at >= p_from and created_at < p_to),
    'avg_check_prev',  (select coalesce(round(avg(sum)), 0) from orders where status = 'done' and created_at >= prev_from and created_at < p_from),
    'res_conversion',  (select case when count(*) = 0 then 0
                          else round(100.0 * count(*) filter (where status = 'done') / count(*)) end
                        from reservations where kind = 'reserve' and created_at >= p_from and created_at < p_to),
    'users_new',       (select count(*) from profiles where created_at >= p_from and created_at < p_to),
    'users_new_prev',  (select count(*) from profiles where created_at >= prev_from and created_at < p_from),
    'users_active',    (select count(distinct user_id) from orders where user_id is not null and created_at >= p_from and created_at < p_to),
    'reviews',         (select count(*) from reviews),
    'reviews_avg',     (select coalesce(round(avg(stars), 1), 0) from reviews),
    'promo_used',      (select count(*) from orders where promo is not null and array_length(promo, 1) > 0 and created_at >= p_from and created_at < p_to),
    'discount_total',  (select coalesce(sum(discount), 0) from orders where created_at >= p_from and created_at < p_to),
    'discount_avg',    (select coalesce(round(avg(discount)), 0) from orders where discount > 0 and created_at >= p_from and created_at < p_to)
  ) into res;
  return res;
end;
$$;
grant execute on function public.dash_kpi(timestamptz, timestamptz) to authenticated;

-- Time series for the charts. p_bucket is 'day' or 'month'.
create or replace function public.dash_series(p_from timestamptz, p_to timestamptz, p_bucket text default 'day')
returns json language plpgsql stable security definer set search_path = public as $$
declare b text; res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;
  b := case when p_bucket = 'month' then 'month' else 'day' end;

  select json_build_object(
    'orders', (
      select coalesce(json_agg(row_to_json(t) order by t.bucket), '[]'::json) from (
        select date_trunc(b, created_at)::date as bucket,
               count(*) as orders,
               count(*) filter (where status = 'done') as done,
               coalesce(sum(sum) filter (where status = 'done'), 0) as revenue,
               coalesce(round(avg(sum) filter (where status = 'done')), 0) as avg_check
          from orders where created_at >= p_from and created_at < p_to
         group by 1) t),
    'users', (
      select coalesce(json_agg(row_to_json(t) order by t.bucket), '[]'::json) from (
        select date_trunc(b, created_at)::date as bucket, count(*) as users
          from profiles where created_at >= p_from and created_at < p_to
         group by 1) t),
    'reviews', (
      select coalesce(json_agg(row_to_json(t) order by t.bucket), '[]'::json) from (
        select date_trunc(b, created_at)::date as bucket, count(*) as reviews,
               round(avg(stars), 1) as avg_stars
          from reviews where created_at >= p_from and created_at < p_to
         group by 1) t),
    'cities', (
      select coalesce(json_agg(row_to_json(t) order by t.revenue desc), '[]'::json) from (
        select city, count(*) as orders, coalesce(sum(sum) filter (where status = 'done'), 0) as revenue
          from orders where created_at >= p_from and created_at < p_to
         group by 1) t),
    'statuses', (
      select coalesce(json_agg(row_to_json(t) order by t.n desc), '[]'::json) from (
        select status, count(*) as n from orders
         where created_at >= p_from and created_at < p_to group by 1) t),
    'payments', (
      select coalesce(json_agg(row_to_json(t) order by t.n desc), '[]'::json) from (
        select coalesce(pay_way, 'cash') as pay_way, payment_status, count(*) as n
          from orders where created_at >= p_from and created_at < p_to group by 1, 2) t),
    'promo', (
      select coalesce(json_agg(row_to_json(t) order by t.n desc), '[]'::json) from (
        select code, count(*) as n, coalesce(sum(o.discount), 0) as discount
          from orders o, unnest(o.promo) as code
         where o.created_at >= p_from and o.created_at < p_to group by 1) t)
  ) into res;
  return res;
end;
$$;
grant execute on function public.dash_series(timestamptz, timestamptz, text) to authenticated;

-- Product analytics. Order items are a JSON snapshot, so quantity and revenue come from
-- there; brand and stock are joined from the live catalogue by id.
create or replace function public.dash_products(p_from timestamptz, p_to timestamptz)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;

  with sold as (
    select e->>'id' as id,
           coalesce(e->>'name', e->>'id') as name,
           coalesce(e->>'flavor', '') as flavor,
           coalesce((e->>'n')::int, 1) as qty,
           coalesce((e->>'sum')::numeric, 0) as revenue,
           o.status, o.city
      from orders o, jsonb_array_elements(o.items) e
     where o.created_at >= p_from and o.created_at < p_to
  )
  select json_build_object(
    'top_qty', (
      select coalesce(json_agg(row_to_json(t) order by t.qty desc), '[]'::json) from (
        select name, sum(qty) as qty, sum(revenue) as revenue from sold
         where status = 'done' group by 1 order by 2 desc limit 10) t),
    'top_flavors', (
      select coalesce(json_agg(row_to_json(t) order by t.qty desc), '[]'::json) from (
        select name || case when flavor <> '' then ', ' || flavor else '' end as name,
               sum(qty) as qty from sold where status = 'done' and flavor <> ''
         group by 1 order by 2 desc limit 10) t),
    'top_revenue', (
      select coalesce(json_agg(row_to_json(t) order by t.revenue desc), '[]'::json) from (
        select name, sum(revenue) as revenue from sold
         where status = 'done' group by 1 order by 2 desc limit 10) t),
    'top_cancelled', (
      select coalesce(json_agg(row_to_json(t) order by t.qty desc), '[]'::json) from (
        select name, sum(qty) as qty from sold
         where status = 'cancelled' group by 1 order by 2 desc limit 10) t),
    'by_brand', (
      select coalesce(json_agg(row_to_json(t) order by t.revenue desc), '[]'::json) from (
        select coalesce(nullif(p.brand, ''), s.name) as brand, sum(s.revenue) as revenue, sum(s.qty) as qty
          from sold s left join lateral (
                 select brand from products where id = s.id limit 1) p on true
         where s.status = 'done' group by 1 order by 2 desc limit 10) t),
    'no_sales', (
      select coalesce(json_agg(row_to_json(t) order by t.name), '[]'::json) from (
        select distinct coalesce(nullif(p.name, ''), p.id) as name, p.city
          from products p
         where p.qty > 0
           and not exists (select 1 from sold s where s.id = p.id and s.status = 'done')
         limit 15) t),
    'low_stock', (
      select coalesce(json_agg(row_to_json(t) order by t.qty), '[]'::json) from (
        select coalesce(nullif(name, ''), id) as name, flavor, city, qty
          from products where qty > 0 and qty <= 3 order by qty limit 15) t),
    'top_reserved', (
      select coalesce(json_agg(row_to_json(t) order by t.n desc), '[]'::json) from (
        select coalesce(product_name, product_id) as name, count(*) as n
          from reservations where created_at >= p_from and created_at < p_to
         group by 1 order by 2 desc limit 10) t)
  ) into res;
  return res;
end;
$$;
grant execute on function public.dash_products(timestamptz, timestamptz) to authenticated;

-- Customer analytics. Lifetime value is the sum of everything a customer ever received,
-- not a forecast.
create or replace function public.dash_customers(p_from timestamptz, p_to timestamptz)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;

  with per_user as (
    select user_id,
           count(*) as orders,
           count(*) filter (where status = 'done') as done,
           coalesce(sum(sum) filter (where status = 'done'), 0) as spent
      from orders where user_id is not null group by 1
  )
  select json_build_object(
    'new_in_period',  (select count(*) from profiles where created_at >= p_from and created_at < p_to),
    'buyers',         (select count(*) from per_user where done > 0),
    'repeat_buyers',  (select count(*) from per_user where done > 1),
    'repeat_share',   (select case when count(*) filter (where done > 0) = 0 then 0
                          else round(100.0 * count(*) filter (where done > 1) / count(*) filter (where done > 0)) end
                        from per_user),
    'orders_per_user',(select coalesce(round(avg(orders), 1), 0) from per_user),
    'ltv_avg',        (select coalesce(round(avg(spent)), 0) from per_user where done > 0),
    'top', (
      select coalesce(json_agg(row_to_json(t) order by t.spent desc), '[]'::json) from (
        select coalesce(nullif(pr.display_name, ''), pr.username, 'id ' || left(u.user_id::text, 8)) as name,
               u.orders, u.done, u.spent
          from per_user u left join profiles pr on pr.id = u.user_id
         where u.done > 0 order by u.spent desc limit 10) t)
  ) into res;
  return res;
end;
$$;
grant execute on function public.dash_customers(timestamptz, timestamptz) to authenticated;

-- Manager analytics. Orders carry no manager, only a city, so the figures are grouped by the
-- city each manager is responsible for. Handling time is updated_at - created_at, which is the
-- closest the current schema allows.
create or replace function public.dash_managers(p_from timestamptz, p_to timestamptz)
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;

  select coalesce(json_agg(row_to_json(t) order by t.done desc), '[]'::json) into res from (
    select a.telegram_id, a.role, a.city,
           count(o.id) as orders,
           count(o.id) filter (where o.status = 'done') as done,
           count(o.id) filter (where o.status = 'cancelled') as cancelled,
           coalesce(sum(o.sum) filter (where o.status = 'done'), 0) as revenue,
           coalesce(round(avg(extract(epoch from (o.updated_at - o.created_at)) / 3600)
                    filter (where o.status = 'done')), 0) as avg_hours
      from admins a
      left join orders o
        on o.city = a.city and o.created_at >= p_from and o.created_at < p_to
     where a.role = 'manager' and a.city is not null
     group by 1, 2, 3) t;
  return json_build_object('managers', res);
end;
$$;
grant execute on function public.dash_managers(timestamptz, timestamptz) to authenticated;

-- Technical section for the developer role. Everything Postgres itself knows is read here;
-- host metrics that only the bot can see arrive through bot_heartbeat below.
create table if not exists public.bot_heartbeat (
  id          smallint primary key default 1,
  version     text,
  started_at  timestamptz,
  beat_at     timestamptz not null default now(),
  rss_mb      integer,
  node        text,
  constraint bot_heartbeat_single check (id = 1)
);
alter table public.bot_heartbeat enable row level security;
drop policy if exists heartbeat_dev on public.bot_heartbeat;
create policy heartbeat_dev on public.bot_heartbeat for select using (public.is_owner_or_dev());

create or replace function public.dash_system()
returns json language plpgsql stable security definer set search_path = public as $$
declare res json;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;
  select json_build_object(
    'db_size',        pg_size_pretty(pg_database_size(current_database())),
    'db_version',     (select current_setting('server_version')),
    'schema_version', (select max(version) from supabase_migrations.schema_migrations),
    'connections',    (select count(*) from pg_stat_activity where datname = current_database()),
    'tables', (
      select coalesce(json_agg(row_to_json(t) order by t.bytes desc), '[]'::json) from (
        select relname as name, pg_total_relation_size(c.oid) as bytes,
               pg_size_pretty(pg_total_relation_size(c.oid)) as size
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
         order by 2 desc limit 8) t),
    'jobs_pending',   (select count(*) from sync_jobs where status = 'pending'),
    'jobs_failed_24h',(select count(*) from sync_jobs where status = 'error' and coalesce(done_at, created_at) > now() - interval '24 hours'),
    'broadcast_queue',(select count(*) from broadcasts where status in ('pending', 'sending')),
    'orders_stuck',   (select count(*) from orders where payment_status = 'pending' and created_at < now() - interval '1 hour'),
    'bot',            (select row_to_json(b) from bot_heartbeat b where b.id = 1)
  ) into res;
  return res;
end;
$$;
grant execute on function public.dash_system() to authenticated;

notify pgrst, 'reload schema';
