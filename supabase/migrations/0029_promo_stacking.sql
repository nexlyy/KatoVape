alter table public.promo_codes add column if not exists stackable boolean not null default true;

comment on column public.promo_codes.stackable is
  'false — код применяется только в одиночку, вместе с другими не работает';

drop function if exists public.promo_check(text, text, numeric, text[]);

create function public.promo_check(p_code text, p_city text, p_sum numeric, p_categories text[] default null)
returns table(ok boolean, discount integer, kind text, value numeric, stackable boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare p record; v_used int; v_disc numeric;
begin
  select * into p from public.promo_codes where code = trim(p_code);
  if p is null then return query select false, 0, null::text, null::numeric, true, 'not_found'; return; end if;
  if not p.active then return query select false, 0, p.kind, p.value, p.stackable, 'inactive'; return; end if;
  if p.starts_at is not null and now() < p.starts_at then
    return query select false, 0, p.kind, p.value, p.stackable, 'not_started'; return; end if;
  if p.expires_at is not null and now() > p.expires_at then
    return query select false, 0, p.kind, p.value, p.stackable, 'expired'; return; end if;
  if p.city is not null and p.city is distinct from p_city then
    return query select false, 0, p.kind, p.value, p.stackable, 'other_city'; return; end if;
  if p.category is not null and (p_categories is null or not (p.category = any(p_categories))) then
    return query select false, 0, p.kind, p.value, p.stackable, 'other_category'; return; end if;
  if p_sum < p.min_sum then
    return query select false, 0, p.kind, p.value, p.stackable, 'min_sum'; return; end if;
  if p.max_uses is not null and p.used >= p.max_uses then
    return query select false, 0, p.kind, p.value, p.stackable, 'limit'; return; end if;
  if auth.uid() is not null and p.per_user > 0 then
    select count(*) into v_used from public.promo_uses where code = p.code and user_id = auth.uid();
    if v_used >= p.per_user then
      return query select false, 0, p.kind, p.value, p.stackable, 'used_by_you'; return; end if;
  end if;

  v_disc := case when p.kind = 'percent' then round(p_sum * p.value / 100) else p.value end;
  if v_disc > p_sum then v_disc := p_sum; end if;
  return query select true, v_disc::int, p.kind, p.value, p.stackable, null::text;
end;
$$;
grant execute on function public.promo_check(text, text, numeric, text[]) to anon, authenticated, service_role;

update public.promo_codes set stackable = false where kind = 'fixed';

notify pgrst, 'reload schema';
