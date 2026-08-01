-- Карточка клиента начинает жить: контакты заводятся сами, заметки видит кто положено,
-- чёрный список работает.
--
-- Таблицы завела 0032, но их никто не заполняет, поэтому CRM пустая. Заводить контакты руками
-- никто не будет, значит их должен создавать сам поток: каждый заказ и каждая бронь ищет
-- человека по телефону, телеграму или аккаунту и заводит карточку, если её ещё нет.

-- ---------- заметки ----------
-- Владелец: заметку видит тот менеджер, который её написал, владелец и разработчик.
-- Прежняя политика открывала заметки всем сотрудникам города, то есть сменщик читал чужие
-- пометки о клиенте.
drop policy if exists contact_notes_staff on public.contact_notes;

drop policy if exists contact_notes_read on public.contact_notes;
create policy contact_notes_read on public.contact_notes for select
  using (author = auth.uid() or public.is_owner_or_dev());

-- Писать заметку может любой, кто вообще работает с этим городом; автором становится он сам.
drop policy if exists contact_notes_write on public.contact_notes;
create policy contact_notes_write on public.contact_notes for insert
  with check (author = auth.uid()
    and exists (select 1 from public.contacts c
                 where c.id = contact_id and public.admin_sees_city(c.city)));

drop policy if exists contact_notes_own_del on public.contact_notes;
create policy contact_notes_own_del on public.contact_notes for delete
  using (author = auth.uid() or public.is_owner_or_dev());

-- ---------- теги ----------
-- Цвета правит владелец, поэтому набор ограничен теми, что панель умеет рисовать.
alter table public.crm_tags drop constraint if exists crm_tags_color_chk;
alter table public.crm_tags add constraint crm_tags_color_chk
  check (color in ('muted', 'accent', 'ok', 'live', 'warn', 'danger', 'new'));

-- ---------- поиск и создание карточки ----------
-- Одна точка входа: и заказ, и бронь зовут её же. Ищем по телефону (он у человека один),
-- потом по телеграму, потом по аккаунту. Найденную карточку дозаполняем тем, чего в ней
-- не было: человек, начавший с бота, со временем обрастает телефоном и почтой.
create or replace function public.crm_touch_contact(
  p_city text, p_name text, p_phone text, p_email text, p_tg bigint, p_user uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_phone text; v_id bigint;
begin
  v_phone := public.crm_norm_phone(p_phone);

  if v_phone is not null then select id into v_id from public.contacts where phone = v_phone; end if;
  if v_id is null and p_tg is not null then select id into v_id from public.contacts where telegram_id = p_tg; end if;
  if v_id is null and p_user is not null then select id into v_id from public.contacts where user_id = p_user; end if;

  if v_id is null then
    insert into public.contacts (city, full_name, phone, email, telegram_id, user_id)
    values (coalesce(p_city, 'katowice'), nullif(btrim(p_name), ''), v_phone,
            nullif(btrim(p_email), ''), p_tg, p_user)
    returning id into v_id;
    return v_id;
  end if;

  update public.contacts set
    full_name   = coalesce(full_name, nullif(btrim(p_name), '')),
    phone       = coalesce(phone, v_phone),
    email       = coalesce(email, nullif(btrim(p_email), '')),
    telegram_id = coalesce(telegram_id, p_tg),
    user_id     = coalesce(user_id, p_user),
    updated_at  = now()
   where id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.crm_touch_contact(text, text, text, text, bigint, uuid) from public, anon, authenticated;

-- ---------- заказ привязывается к человеку ----------
-- Здесь же работает чёрный список: заказ от заблокированного не заводится вовсе, иначе
-- менеджер соберёт его и узнает всё только на выдаче.
create or replace function public.orders_link_contact()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_blocked boolean;
begin
  if new.contact_id is not null then
    select blocked into v_blocked from public.contacts where id = new.contact_id;
    if coalesce(v_blocked, false) then raise exception 'CONTACT_BLOCKED' using errcode = 'P0001'; end if;
    return new;
  end if;

  v_id := public.crm_touch_contact(
    new.city,
    coalesce(new.contact->>'name', ''),
    coalesce(new.contact->>'phone', ''),
    coalesce(new.contact->>'email', ''),
    new.telegram_id,
    new.user_id);

  select blocked into v_blocked from public.contacts where id = v_id;
  if coalesce(v_blocked, false) then raise exception 'CONTACT_BLOCKED' using errcode = 'P0001'; end if;

  new.contact_id := v_id;
  return new;
end;
$$;

drop trigger if exists a_orders_link_contact on public.orders;
create trigger a_orders_link_contact
  before insert on public.orders
  for each row execute function public.orders_link_contact();

-- ---------- бронь тоже ----------
-- У брони нет снимка контактов, поэтому телефон и имя берём из профиля, если он есть.
create or replace function public.reservations_link_contact()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_blocked boolean; p record;
begin
  select full_name, phone, email into p from public.profiles
   where (new.user_id is not null and id = new.user_id)
      or (new.telegram_id is not null and telegram_id = new.telegram_id)
   limit 1;

  v_id := public.crm_touch_contact(new.city, coalesce(p.full_name, ''), coalesce(p.phone, ''),
                                   coalesce(p.email, ''), new.telegram_id, new.user_id);
  select blocked into v_blocked from public.contacts where id = v_id;
  if coalesce(v_blocked, false) then raise exception 'CONTACT_BLOCKED' using errcode = 'P0001'; end if;
  return new;
end;
$$;

-- Префикс b_ ставит её после a_reservation_guard: сперва лимиты, потом карточка.
drop trigger if exists b_reservations_link_contact on public.reservations;
create trigger b_reservations_link_contact
  before insert on public.reservations
  for each row execute function public.reservations_link_contact();

-- ---------- кто такой активный клиент ----------
-- Владелец: активный это тот, кто заказывал минимум три раза, окно 60 дней.
create or replace function public.crm_is_active(p_contact bigint, p_days int default 60, p_min int default 3)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= p_min
    from public.orders
   where contact_id = p_contact and status = 'done'
     and created_at > now() - make_interval(days => p_days);
$$;
grant execute on function public.crm_is_active(bigint, int, int) to authenticated;

notify pgrst, 'reload schema';
