begin;

delete from public.promo_uses;
delete from public.promo_codes;
delete from public.reviews;
delete from public.orders;
delete from public.reservations;
delete from public.broadcasts;
delete from public.demand;
delete from public.sync_jobs;

alter table public.orders       alter column id restart with 1;
alter table public.reservations alter column id restart with 1;
alter table public.reviews      alter column id restart with 1;
alter table public.broadcasts   alter column id restart with 1;
alter table public.promo_uses   alter column id restart with 1;
alter table public.sync_jobs    alter column id restart with 1;

commit;
