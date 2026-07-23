-- KatoVape: уведомления клиенту «принят» и «оплачен» из бота. Флаги, чтобы слать один раз.
alter table public.orders add column if not exists client_notified_accepted boolean not null default false;
alter table public.orders add column if not exists client_notified_paid     boolean not null default false;

-- уже существующие заказы считаем оповещёнными, иначе бот разошлёт уведомления по старым
update public.orders set client_notified_accepted = true, client_notified_paid = true
  where client_notified_accepted = false or client_notified_paid = false;
