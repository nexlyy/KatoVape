-- The dashboard access check must fail closed.
--
-- admin_role() returns null for anyone without access, so `null in ('owner','dev')` was null,
-- and `if not null then raise` never fired: PL/pgSQL treats a null condition as not taken.
-- Any logged-in customer could therefore call the dash_* functions and read the whole business
-- report. Wrapping the predicate in coalesce makes it return false instead of null, which turns
-- every guard in 0030 back into a real check.
create or replace function public.is_owner_or_dev()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.admin_role() in ('owner', 'dev'), false);
$$;
