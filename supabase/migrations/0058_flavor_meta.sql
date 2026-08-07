-- Настройки вкуса: цвет, вкусовой профиль и описание.
--
-- 0056 положила гамму в products.tint, то есть в строку города. Это оказалось неверным
-- уровнем: «Apple Peach» одинаков в Катовице, Гливице и Варшаве, отличается только остаток
-- на полке. Держать описание в строке города значило бы вбивать один и тот же текст трижды
-- и смотреть, как три копии расходятся.
--
-- Поэтому всё, что описывает сам вкус, переезжает в отдельную таблицу по паре товар+вкус.
-- В products остаётся то, что и правда своё у каждого города: цена, остаток, ступени.
--
-- Три поля:
--   tint  один цвет как #rrggbb, второй конец градиента витрина считает сама (shared/tints.js)
--   taste {sweet,cool,sour} 0..100; пусто значит «посчитай по названию», как было всегда
--   descr {ru,uk,pl}; пусто значит «собери по вкусовому профилю»

create table if not exists public.flavor_meta (
  product_id text not null,
  flavor     text not null,
  tint       text,
  taste      jsonb,
  descr      jsonb,
  updated_at timestamptz not null default now(),
  primary key (product_id, flavor)
);

-- Цвет только шестнадцатеричный: пресеты панели хранятся так же, как набранное руками,
-- поэтому в базе одна форма записи и нет ссылок на исчезнувшие имена гамм.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'flavor_meta_tint_hex') then
    alter table public.flavor_meta add constraint flavor_meta_tint_hex
      check (tint is null or tint ~ '^#[0-9a-f]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'flavor_meta_taste_shape') then
    alter table public.flavor_meta add constraint flavor_meta_taste_shape
      check (taste is null or (
        jsonb_typeof(taste) = 'object'
        and jsonb_typeof(taste -> 'sweet') = 'number'
        and jsonb_typeof(taste -> 'cool')  = 'number'
        and jsonb_typeof(taste -> 'sour')  = 'number'
        and (taste ->> 'sweet')::numeric between 0 and 100
        and (taste ->> 'cool')::numeric  between 0 and 100
        and (taste ->> 'sour')::numeric  between 0 and 100));
  end if;
  -- Описание это абзац под карточкой, а не статья. Ограничение спасает от вставки
  -- страницы текста, которая раздует ответ каталога всем покупателям сразу.
  if not exists (select 1 from pg_constraint where conname = 'flavor_meta_descr_size') then
    alter table public.flavor_meta add constraint flavor_meta_descr_size
      check (descr is null or (jsonb_typeof(descr) = 'object' and length(descr::text) <= 4000));
  end if;
end $$;

-- ---- переезд гаммы из products ----
-- Значения, проставленные в панели за время жизни 0056, конвертируем в цвет. Имена гамм
-- перечислены здесь разово: дальше этот список живёт только в shared/tints.js как образцы.
insert into public.flavor_meta (product_id, flavor, tint)
select distinct on (p.id, p.flavor) p.id, p.flavor, m.hex
  from public.products p
  join (values
    ('mint', '#5ff3d0'), ('ice', '#8fd8ff'), ('tropic', '#67dcf5'), ('apple', '#8fe264'),
    ('citrus', '#ffd95e'), ('peach', '#ffa15c'), ('berry', '#ff5f7d'), ('candy', '#ff8ad2'),
    ('grape', '#b46bff'), ('blueberry', '#7f8cff'), ('coffee', '#c68d5c'),
    ('tobacco', '#b9a48a'), ('graphite', '#b3c0cc')
  ) as m(name, hex) on m.name = p.tint
 where p.flavor <> ''
 order by p.id, p.flavor, p.city
on conflict (product_id, flavor) do nothing;

alter table public.products drop column if exists tint;

-- Список прав анонима переписан в 0056 вместе с tint, возвращаем его без этой колонки.
revoke select on public.products from anon;
grant select (id, city, category, name, brand, flavor, price, qty, nic, updated_at, tiers, hit, labels)
  on public.products to anon;

-- ---- доступ ----
-- Читают все: это часть каталога, секретов тут нет.
alter table public.flavor_meta enable row level security;
drop policy if exists flavor_meta_read on public.flavor_meta;
create policy flavor_meta_read on public.flavor_meta for select using (true);

-- Пишет любой сотрудник панели. Города у вкуса нет, поэтому и сужать по городу нечего:
-- менеджер Гливице правит тот же текст, что видит Катовице, и это осознанно.
drop policy if exists flavor_meta_write on public.flavor_meta;
create policy flavor_meta_write on public.flavor_meta for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.flavor_meta to anon, authenticated;
grant insert, update, delete on public.flavor_meta to authenticated;

notify pgrst, 'reload schema';
