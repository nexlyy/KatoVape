-- KatoVape: онлайн-оплата заказов (Stripe на сайте, нативные инвойсы Telegram в мини-аппе).
-- Оплата — отдельная ось от статуса выполнения (new/confirmed/done/cancelled): заказ может
-- быть оплачен, но ещё не собран. Поэтому не трогаем orders_status_chk, а заводим свои поля.

alter table public.orders add column if not exists payment_status text not null default 'unpaid';
-- unpaid   — оплата не заводилась (самовывоз/оплата при выдаче, как было раньше)
-- pending  — карта/кошелёк начаты, ждём подтверждения (PaymentIntent или инвойс Telegram)
-- paid     — деньги пришли (webhook Stripe или successful_payment из бота)
-- failed   — оплата сорвалась, заказ можно оформить заново
alter table public.orders drop constraint if exists orders_payment_chk;
alter table public.orders add constraint orders_payment_chk
  check (payment_status in ('unpaid', 'pending', 'paid', 'failed'));

alter table public.orders add column if not exists payment_provider text;   -- stripe | telegram
alter table public.orders add column if not exists payment_ref text;         -- PaymentIntent id или telegram charge id
alter table public.orders add column if not exists amount integer;           -- реально списано, в грошах (zł * 100)
alter table public.orders add column if not exists currency text not null default 'pln';
alter table public.orders add column if not exists paid_at timestamptz;
-- заказ из мини-аппа привязываем к telegram_id (профиля может ещё не быть), как в локальной БД
alter table public.orders add column if not exists telegram_id bigint;

-- webhook и бот ищут заказ по идентификатору платежа — под это индекс
create index if not exists orders_payment_ref_idx on public.orders (payment_ref);

-- Карточные и телеграм-заказы заводит edge-функция под service_role (сумму считает
-- сервер, клиенту цену не доверяем), поэтому отдельная клиентская RLS-политика не нужна:
-- self-insert как был (ord_own_ins) остаётся для оплаты при выдаче, а платный путь идёт
-- мимо RLS. Обновляет оплату тоже service_role (webhook/бот).
