-- Категория у ставки была nullable, а «пусто» означало «на всё остальное». Из-за NULL
-- уникальный индекс приходилось строить по выражению coalesce(category,''), и upsert по
-- списку колонок в такой индекс не попадает: панель не смогла бы сохранить ставку.
-- Пустая строка вместо NULL решает и то, и другое: ключ обычный, смысл прежний.
alter table public.manager_rates drop constraint if exists manager_rates_category_fkey;
update public.manager_rates set category = '' where category is null;
alter table public.manager_rates alter column category set default '';
alter table public.manager_rates alter column category set not null;

drop index if exists public.manager_rates_uniq;
create unique index if not exists manager_rates_uniq
  on public.manager_rates (telegram_id, city, category, from_date);

-- Категория должна существовать в справочнике, кроме пустой строки «все остальные».
-- Подзапрос в check нельзя, поэтому это внешний ключ на справочник с исключением для пустой
-- строки: строку '' заводим в справочнике служебной записью, скрытой от списков (active=false).
insert into public.product_categories (id, name_ru, name_uk, name_pl, sort, active)
values ('', 'все остальные', 'усі інші', 'pozostałe', 999, false)
on conflict (id) do nothing;

alter table public.manager_rates drop constraint if exists manager_rates_category_fkey;
alter table public.manager_rates add constraint manager_rates_category_fkey
  foreign key (category) references public.product_categories(id) on delete cascade;

create or replace function public.rate_at(p_tg bigint, p_city text, p_day date, p_category text default '')
returns table(percent numeric, base text)
language sql stable security definer set search_path = public as $$
  select r.percent, r.base from public.manager_rates r
   where r.telegram_id = p_tg and r.city = p_city and r.from_date <= p_day
     and (r.category = coalesce(p_category, '') or r.category = '')
   order by (r.category <> '') desc, r.from_date desc
   limit 1;
$$;
revoke execute on function public.rate_at(bigint, text, date, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
