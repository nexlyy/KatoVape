-- KatoVape: ярлык «Хит» сохраняется из панели управления.
-- Колонки hit и tiers добавляли миграции 0016 и 0021. Если их накатили частично или
-- PostgREST после накатки не перечитал схему, панель падала на сохранении с
-- «Could not find the 'hit' column of 'products' in the schema cache», хотя в базе
-- колонка есть. Повторяем добавление (идемпотентно) и просим API обновить кеш схемы.
alter table public.products add column if not exists hit   boolean not null default false;
alter table public.products add column if not exists tiers jsonb;

-- Ярлык и ступени одинаковы у всех строк одного товара в городе. Строки, заведённые
-- отдельно (кнопкой «Добавить вкус» или выгрузкой из таблицы), могли остаться без них —
-- подтягиваем к остальным, чтобы панель и витрина видели одно и то же.
update public.products p set hit = true
 where p.hit = false
   and exists (select 1 from public.products q
                where q.id = p.id and q.city = p.city and q.hit);

update public.products p set tiers = src.tiers
  from (select distinct on (id, city) id, city, tiers
          from public.products
         where tiers is not null
         order by id, city) src
 where p.id = src.id and p.city = src.city and p.tiers is null;

-- поиск по ярлыку из панели и сортировка витрины идут по городу
create index if not exists products_city_hit_idx on public.products (city, hit);

notify pgrst, 'reload schema';
