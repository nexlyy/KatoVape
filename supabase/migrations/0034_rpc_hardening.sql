-- Locking down the routines the browser never calls.
--
-- Every function in this schema is reachable with the publishable key, because Postgres hands
-- EXECUTE to PUBLIC by default and Supabase additionally grants it to anon and authenticated.
-- That is fine for the functions that check the caller's rights themselves (admin_*, dash_*,
-- crm_*, promo_*, my_*). It is not fine for these four, which trust their caller because only
-- the bot and the edge functions were ever meant to reach them:
--
--   restock_list()        returns the telegram_id of every person waiting for a restock,
--                         together with what they are waiting for. Anyone with the public key
--                         could read the customer list.
--   audit()               writes the audit log. Anyone could forge entries or flood the table,
--                         which is exactly the record meant to settle later arguments.
--   login_availability()  answers whether an e-mail or phone is already registered, so the
--                         customer base could be probed address by address.
--   bump_demand()         writes rows into demand keyed by free text, so the statistics could
--                         be inflated and the table filled with junk.
--
-- Revoking from PUBLIC is the part that actually matters: revoking from anon and authenticated
-- alone leaves the default PUBLIC grant in place, which is how resolve_login stayed readable
-- after the first attempt to close it (0008).
--
-- The internal callers are unaffected: crm_* call audit() as their own definer, and the bot and
-- the signup function connect as service_role, which is granted back explicitly below.

revoke execute on function public.restock_list()                             from public, anon, authenticated;
revoke execute on function public.audit(text, text, text, jsonb)             from public, anon, authenticated;
revoke execute on function public.login_availability(citext, citext, text)   from public, anon, authenticated;
revoke execute on function public.bump_demand(text, text)                    from public, anon, authenticated;

grant execute on function public.restock_list()                           to service_role;
grant execute on function public.login_availability(citext, citext, text) to service_role;
grant execute on function public.bump_demand(text, text)                  to service_role;

-- Trigger functions are only ever run by their triggers, which do not consult these grants.
revoke execute on function public.handle_new_user()     from public, anon, authenticated;
revoke execute on function public.reservation_guard()   from public, anon, authenticated;
revoke execute on function public.reservation_stock()   from public, anon, authenticated;

-- Password guessing.
--
-- The login function forwards the attempt to GoTrue itself, so GoTrue sees the edge function's
-- address instead of the visitor's and its own per-address limit never triggers. That turned
-- /functions/v1/login into an oracle a script could hammer, and the panel uses the same door as
-- the shop. Attempts are counted here, in the database, because the function runs in several
-- copies and a counter in memory would be trivial to sidestep.
create table if not exists public.auth_attempts (
  id  bigint generated always as identity primary key,
  key text not null,                       -- either 'ip:<address>' or 'id:<login>'
  at  timestamptz not null default now()
);
create index if not exists auth_attempts_key_idx on public.auth_attempts (key, at desc);

-- No policies on purpose: only service_role, which bypasses row level security, touches this.
alter table public.auth_attempts enable row level security;

notify pgrst, 'reload schema';
