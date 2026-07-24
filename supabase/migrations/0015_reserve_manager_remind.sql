-- KatoVape: напоминание менеджеру за час до времени брони (шлём один раз).
alter table public.reservations add column if not exists manager_reminded_at timestamptz;
