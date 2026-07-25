-- KatoVape: комментарий покупателя к заказу и к брони (до 500 символов, счётчик на витрине).
alter table public.orders       add column if not exists comment text;
alter table public.reservations add column if not exists comment text;

-- длину режем и на стороне базы: фронт может обойти проверку, менеджеру нужен вменяемый текст
alter table public.orders       drop constraint if exists orders_comment_len;
alter table public.orders       add constraint orders_comment_len       check (comment is null or length(comment) <= 500);
alter table public.reservations drop constraint if exists reservations_comment_len;
alter table public.reservations add constraint reservations_comment_len check (comment is null or length(comment) <= 500);

-- вставку заказа делает сам покупатель (RLS ord_own_ins), поэтому колонка должна быть ему доступна
grant insert (comment) on table public.orders to authenticated;
grant insert (comment) on table public.reservations to authenticated;
