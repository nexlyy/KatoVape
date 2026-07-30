-- KatoVape: в заказе видно, какие промокоды сработали и на сколько.
--
-- Раньше код никуда не сохранялся: менеджер видел итоговую сумму и не понимал, почему она
-- ниже прайса, а сверить скидку было не с чем. Теперь коды и размер скидки лежат в заказе,
-- их показывают панель и бот.
alter table public.orders add column if not exists promo    text[];
alter table public.orders add column if not exists discount integer not null default 0;

-- писать эти поля может только сервер (create-order и оплата под service_role):
-- клиенту вставка в orders запрещена целиком миграцией 0026.
create index if not exists orders_promo_idx on public.orders using gin (promo);

notify pgrst, 'reload schema';
