-- KatoVape: оптовые (ступенчатые) цены редактируются в админке. Раньше tiers жили только в
-- data/products.json; теперь храним их в облаке на товар (одинаково на всех строках id).
alter table public.products add column if not exists tiers jsonb;   -- [{q:1,p:...},{q:3,p:...},{q:5,p:...},{q:10,p:...}]
