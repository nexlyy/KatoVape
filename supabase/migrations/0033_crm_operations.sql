-- CRM operations. Every function is security definer, so each one re-checks the caller's city
-- itself: the panel hiding a button is convenience, the check here is the actual rule.

-- Same normalisation the storefront uses, so a phone typed by a manager and a phone typed by
-- the customer land on the same contact.
create or replace function public.crm_norm_phone(p text)
returns text language sql immutable set search_path = public as $$
  select case
    when p is null or btrim(p) = '' then null
    when regexp_replace(p, '[^0-9]', '', 'g') ~ '^\d{9}$' then '+48' || regexp_replace(p, '[^0-9]', '', 'g')
    when regexp_replace(p, '[^0-9]', '', 'g') ~ '^48\d{9}$' then '+' || regexp_replace(p, '[^0-9]', '', 'g')
    else '+' || regexp_replace(p, '[^0-9]', '', 'g')
  end;
$$;

create or replace function public.crm_contacts(p_query text default null, p_limit int default 50)
returns table(id bigint, city text, full_name text, phone text, email text, telegram_id bigint,
              tags text[], blocked boolean, orders bigint, spent numeric, last_order timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.city, c.full_name, c.phone, c.email, c.telegram_id, c.tags, c.blocked,
         count(o.id) filter (where o.status = 'done'),
         coalesce(sum(o.sum) filter (where o.status = 'done'), 0),
         max(o.created_at)
    from public.contacts c
    left join public.orders o on o.contact_id = c.id
   where public.admin_sees_city(c.city)
     and (p_query is null or btrim(p_query) = ''
          or c.full_name ilike '%' || p_query || '%'
          or c.phone like '%' || regexp_replace(p_query, '[^0-9]', '', 'g') || '%'
          or c.email ilike '%' || p_query || '%')
   group by c.id
   order by max(o.created_at) desc nulls last, c.id desc
   limit least(coalesce(p_limit, 50), 200);
$$;
grant execute on function public.crm_contacts(text, int) to authenticated;

create or replace function public.crm_contact_card(p_id bigint)
returns json language plpgsql stable security definer set search_path = public as $$
declare c record; res json;
begin
  select * into c from public.contacts where id = p_id;
  if c is null or not public.admin_sees_city(c.city) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select json_build_object(
    'contact', row_to_json(c),
    'orders', (select coalesce(json_agg(row_to_json(o) order by o.id desc), '[]'::json)
                 from (select id, created_at, status, sum, delivery, city, source, payment_status
                         from public.orders where contact_id = p_id order by id desc limit 50) o),
    'reservations', (select coalesce(json_agg(row_to_json(r) order by r.id desc), '[]'::json)
                 from (select id, created_at, product_name, flavor, status, reserve_date
                         from public.reservations
                        where telegram_id = c.telegram_id and c.telegram_id is not null
                        order by id desc limit 20) r),
    'notes', (select coalesce(json_agg(row_to_json(n) order by n.created_at desc), '[]'::json)
                 from (select cn.id, cn.body, cn.created_at,
                              coalesce(nullif(p.display_name, ''), p.username, '—') as author
                         from public.contact_notes cn
                         left join public.profiles p on p.id = cn.author
                        where cn.contact_id = p_id order by cn.created_at desc limit 50) n)
  ) into res;
  return res;
end;
$$;
grant execute on function public.crm_contact_card(bigint) to authenticated;

create or replace function public.crm_contact_save(
  p_id bigint, p_city text, p_name text, p_phone text, p_email text,
  p_tags text[] default '{}', p_blocked boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_phone text; v_id bigint; v_old record;
begin
  if not public.admin_sees_city(p_city) then raise exception 'forbidden' using errcode = '42501'; end if;
  v_phone := public.crm_norm_phone(p_phone);

  if p_id is null then
    -- A repeat customer must not become a second card: match on the phone first.
    if v_phone is not null then select id into v_id from public.contacts where phone = v_phone; end if;
    if v_id is null then
      insert into public.contacts (city, full_name, phone, email, tags, blocked)
      values (p_city, nullif(btrim(p_name), ''), v_phone, nullif(btrim(p_email), ''), coalesce(p_tags, '{}'), coalesce(p_blocked, false))
      returning id into v_id;
      perform public.audit('create', 'contact', v_id::text, json_build_object('phone', v_phone)::jsonb);
      return v_id;
    end if;
    p_id := v_id;
  end if;

  select * into v_old from public.contacts where id = p_id;
  if v_old is null or not public.admin_sees_city(v_old.city) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.contacts set
    city = p_city, full_name = nullif(btrim(p_name), ''), phone = v_phone,
    email = nullif(btrim(p_email), ''), tags = coalesce(p_tags, '{}'),
    blocked = coalesce(p_blocked, false), updated_at = now()
   where id = p_id;
  perform public.audit('update', 'contact', p_id::text,
    json_build_object('was', row_to_json(v_old), 'phone', v_phone)::jsonb);
  return p_id;
end;
$$;
grant execute on function public.crm_contact_save(bigint, text, text, text, text, text[], boolean) to authenticated;

create or replace function public.crm_note_add(p_contact bigint, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_city text; v_id bigint;
begin
  select city into v_city from public.contacts where id = p_contact;
  if v_city is null or not public.admin_sees_city(v_city) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if btrim(coalesce(p_body, '')) = '' then raise exception 'empty note'; end if;
  insert into public.contact_notes (contact_id, author, body)
  values (p_contact, auth.uid(), btrim(p_body)) returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.crm_note_add(bigint, text) to authenticated;

-- Manual order: the manager is staff, so they set the prices, but the total is summed here
-- from the lines. A mismatch between the lines and the total is the classic way a report
-- stops adding up.
create or replace function public.crm_create_order(
  p_city text, p_contact bigint, p_items jsonb, p_delivery text default 'pickup',
  p_address text default null, p_comment text default null, p_pay_way text default 'cash')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_sum numeric; v_id bigint; v_contact record; v_contact_json jsonb;
begin
  if not public.admin_sees_city(p_city) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'empty order'; end if;
  if p_delivery not in ('pickup', 'inpost', 'courier') then raise exception 'bad delivery'; end if;
  if p_pay_way not in ('cash', 'card') then raise exception 'bad pay_way'; end if;

  select coalesce(sum((e->>'price')::numeric * greatest(coalesce((e->>'n')::int, 1), 1)), 0)
    into v_sum from jsonb_array_elements(p_items) e;
  if v_sum <= 0 then raise exception 'bad total'; end if;

  if p_contact is not null then
    select * into v_contact from public.contacts where id = p_contact;
    if v_contact is null or not public.admin_sees_city(v_contact.city) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_contact.blocked then raise exception 'contact blocked'; end if;
    v_contact_json := jsonb_build_object('name', v_contact.full_name, 'phone', v_contact.phone, 'email', v_contact.email);
  end if;

  insert into public.orders (city, contact_id, items, sum, delivery, address, contact, comment,
                             pay_way, status, payment_status, source, manager_id, amount, currency)
  values (p_city, p_contact, p_items, v_sum, p_delivery,
          case when p_delivery = 'pickup' then null else nullif(btrim(p_address), '') end,
          coalesce(v_contact_json, '{}'::jsonb), nullif(btrim(p_comment), ''),
          p_pay_way, 'new', 'unpaid', 'manual', auth.uid(), (v_sum * 100)::int, 'pln')
  returning id into v_id;

  perform public.audit('create', 'order', v_id::text,
    json_build_object('source', 'manual', 'sum', v_sum, 'contact', p_contact)::jsonb);
  return v_id;
end;
$$;
grant execute on function public.crm_create_order(text, bigint, jsonb, text, text, text, text) to authenticated;

-- Status changes go through here so a cancellation always carries a reason and every move
-- lands in the audit log.
create or replace function public.crm_set_status(p_order bigint, p_status text, p_reason smallint default null)
returns void language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select * into o from public.orders where id = p_order;
  if o is null or not public.admin_sees_city(o.city) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('new', 'confirmed', 'packed', 'shipped', 'done', 'cancelled') then
    raise exception 'bad status';
  end if;
  if p_status = 'cancelled' and p_reason is null then raise exception 'reason required'; end if;

  update public.orders
     set status = p_status,
         cancel_reason_id = case when p_status = 'cancelled' then p_reason else cancel_reason_id end,
         updated_at = now()
   where id = p_order;
  perform public.audit('status', 'order', p_order::text,
    json_build_object('from', o.status, 'to', p_status, 'reason', p_reason)::jsonb);
end;
$$;
grant execute on function public.crm_set_status(bigint, text, smallint) to authenticated;

-- One-off backfill: build contacts from the customers the shop already knows, and attach the
-- orders they already placed. Safe to run more than once.
create or replace function public.crm_backfill()
returns json language plpgsql security definer set search_path = public as $$
declare v_made int := 0; v_linked int := 0;
begin
  if not public.is_owner_or_dev() then raise exception 'forbidden' using errcode = '42501'; end if;

  insert into public.contacts (city, full_name, phone, email, telegram_id, user_id)
  select coalesce(p.city, 'katowice'), coalesce(p.full_name, p.display_name),
         public.crm_norm_phone(p.phone), p.email, p.telegram_id, p.id
    from public.profiles p
   where not exists (select 1 from public.contacts c where c.user_id = p.id)
     and (public.crm_norm_phone(p.phone) is null
          or not exists (select 1 from public.contacts c where c.phone = public.crm_norm_phone(p.phone)))
  on conflict do nothing;
  get diagnostics v_made = row_count;

  update public.orders o set contact_id = c.id
    from public.contacts c
   where o.contact_id is null
     and ((o.user_id is not null and c.user_id = o.user_id)
          or (o.telegram_id is not null and c.telegram_id = o.telegram_id));
  get diagnostics v_linked = row_count;

  return json_build_object('contacts_created', v_made, 'orders_linked', v_linked);
end;
$$;
grant execute on function public.crm_backfill() to authenticated;

notify pgrst, 'reload schema';
