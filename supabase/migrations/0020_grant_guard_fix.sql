-- KatoVape: КРИТИЧЕСКИЙ фикс проверки прав на выдачу доступа.
-- can_grant() = (admin_role() = 'owner'). У постороннего admin_role() возвращает NULL,
-- значит и сравнение даёт NULL, а не false. Проверка «if not can_grant() then raise» на NULL
-- не срабатывает вовсе (NOT NULL = NULL, ветка if пропускается), поэтому функция шла дальше
-- и выдавала доступ. То есть любой вошедший в магазин мог назначить себя админом.
-- Лечим в двух местах сразу: сама функция больше не возвращает NULL, а проверки завёрнуты
-- в coalesce, чтобы неизвестность трактовалась как «нельзя».

create or replace function public.can_grant()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.admin_role() = 'owner', false);
$$;
grant execute on function public.can_grant() to authenticated;

create or replace function public.admin_grant(p_login text, p_role text default 'manager', p_city text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_city text;
begin
  if not coalesce(public.can_grant(), false) then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'dev', 'manager') then raise exception 'BAD_ROLE'; end if;
  v_city := case when p_role = 'manager' then nullif(p_city, '') else null end;
  if p_role = 'manager' and v_city is null then raise exception 'CITY_REQUIRED'; end if;
  select id, coalesce(display_name, username) into v_id, v_name
    from public.profiles
   where username = p_login::citext or email = p_login::citext
   limit 1;
  if v_id is null then raise exception 'NO_USER'; end if;
  insert into public.admin_users (user_id, note, role, city) values (v_id, 'выдан из панели', p_role, v_city)
    on conflict (user_id) do update set role = excluded.role, city = excluded.city;
  return coalesce(v_name, p_login);
end;
$$;
grant execute on function public.admin_grant(text, text, text) to authenticated;

create or replace function public.admin_grant_telegram(p_tid bigint, p_role text default 'manager', p_city text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_city text;
begin
  if not coalesce(public.can_grant(), false) then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'dev', 'manager') then raise exception 'BAD_ROLE'; end if;
  if p_tid is null or p_tid <= 0 then raise exception 'BAD_ID'; end if;
  v_city := case when p_role = 'manager' then nullif(p_city, '') else null end;
  if p_role = 'manager' and v_city is null then raise exception 'CITY_REQUIRED'; end if;
  insert into public.admins (telegram_id, note, role, city) values (p_tid, 'выдан из панели', p_role, v_city)
    on conflict (telegram_id) do update set role = excluded.role, city = excluded.city;
  return true;
end;
$$;
grant execute on function public.admin_grant_telegram(bigint, text, text) to authenticated;

create or replace function public.admin_revoke(p_ident text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tid bigint; v_me bigint;
begin
  if not coalesce(public.can_grant(), false) then raise exception 'NOT_ALLOWED'; end if;
  if p_ident ~ '^\d+$' then
    v_tid := p_ident::bigint;
    select telegram_id into v_me from public.profiles where id = auth.uid();
    if v_me is not null and v_me = v_tid then raise exception 'SELF_REVOKE'; end if;
    delete from public.admins where telegram_id = v_tid;
    return true;
  end if;
  select id into v_id from public.profiles
   where username = p_ident::citext or email = p_ident::citext limit 1;
  if v_id is null then return false; end if;
  if v_id = auth.uid() then raise exception 'SELF_REVOKE'; end if;
  delete from public.admin_users where user_id = v_id;
  return true;
end;
$$;
grant execute on function public.admin_revoke(text) to authenticated;

-- та же ловушка была в проверке города: NULL трактуем как «доступа нет»
create or replace function public.admin_sees_city(p_city text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    public.is_admin() and (
      public.admin_role() in ('owner', 'dev') or public.admin_city() = p_city
    ), false);
$$;
grant execute on function public.admin_sees_city(text) to authenticated;
