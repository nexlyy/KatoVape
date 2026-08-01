-- A reservation is written straight from the browser under row level security, so every field
-- in it is the customer's word. The limits are already enforced by a trigger; the two fields
-- the manager actually reads were not checked at all:
--
--   product_name  is what the bot and the panel show, and what the goods are picked by. It was
--                 sent by the client, so a reservation for a cheap model could carry the name
--                 of an expensive one. It is now taken from the catalogue by id, city and
--                 flavour, and the client value only survives for a product we do not stock.
--   reserve_time  is shown next to the date. Only the slots on the card are meant to get here,
--                 so anything that is not HH:MM is refused.

create or replace function public.reservation_trust()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select p.name into v_name
    from public.products p
   where p.id = new.product_id
     and p.city = new.city
     and (coalesce(new.flavor, '') = '' or p.flavor = new.flavor)
   limit 1;

  if v_name is not null then
    new.product_name := v_name || case when coalesce(new.flavor, '') = '' then '' else ' ' || new.flavor end;
  else
    -- Not in the catalogue: keep what came in, but never more than the column is meant to hold.
    new.product_name := left(coalesce(new.product_name, new.product_id), 200);
  end if;
  return new;
end;
$$;

-- Runs after a_reservation_guard (limits) and before reservation_stock (writing the stock off).
drop trigger if exists b_reservation_trust on public.reservations;
create trigger b_reservation_trust
  before insert or update of product_id, product_name, flavor on public.reservations
  for each row execute function public.reservation_trust();

alter table public.reservations drop constraint if exists reservations_time_chk;
alter table public.reservations add constraint reservations_time_chk
  check (reserve_time is null or reserve_time ~ '^[0-2][0-9]:[0-5][0-9]$');

revoke execute on function public.reservation_trust() from public, anon, authenticated;

notify pgrst, 'reload schema';
