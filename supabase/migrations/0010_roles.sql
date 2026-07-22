-- KatoVape: роли доступа.
-- owner   — всё, включая выдачу и снятие доступа
-- dev     — всё, включая выдачу (технический владелец)
-- manager — все разделы, кроме выдачи доступа
-- Доступ по-прежнему бывает двух видов: по Telegram (таблица admins) и по обычному
-- аккаунту с паролем (admin_users). Роль хранится в обеих.

alter table public.admins      add column if not exists role text not null default 'manager';
alter table public.admin_users add column if not exists role text not null default 'manager';
alter table public.admins      drop constraint if exists admins_role_chk;
alter table public.admins      add constraint admins_role_chk check (role in ('owner', 'dev', 'manager'));
alter table public.admin_users drop constraint if exists admin_users_role_chk;
alter table public.admin_users add constraint admin_users_role_chk check (role in ('owner', 'dev', 'manager'));

-- роль текущего пользователя, null если доступа нет
create or replace function public.admin_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.role from public.admins a
       join public.profiles p on p.telegram_id = a.telegram_id
      where p.id = auth.uid() limit 1),
    (select au.role from public.admin_users au where au.user_id = auth.uid() limit 1)
  );
$$;
grant execute on function public.admin_role() to authenticated;

-- выдавать и снимать доступ могут только owner и dev
create or replace function public.can_grant()
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_role() in ('owner', 'dev');
$$;
grant execute on function public.can_grant() to authenticated;

-- Старые версии сносим явно. Иначе прежний admin_grant(text) с одним аргументом
-- остался бы рядом с новым, выигрывал бы по точному числу аргументов и продолжал
-- пускать по старой проверке is_admin(), то есть менеджер мог бы выдавать доступ.
drop function if exists public.admin_grant(text);
drop function if exists public.admin_revoke(text);

-- список доступа теперь с ролью
drop function if exists public.admin_access_list();
create or replace function public.admin_access_list()
returns table(kind text, who text, ident text, role text, added_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'telegram', coalesce(p.display_name, p.username, 'ещё не заходил'),
         a.telegram_id::text, a.role, a.added_at
    from public.admins a
    left join public.profiles p on p.telegram_id = a.telegram_id
   where public.is_admin()
  union all
  select 'password', coalesce(p.display_name, p.username, '—'),
         coalesce(p.username, p.email, p.id::text), au.role, au.added_at
    from public.admin_users au
    join public.profiles p on p.id = au.user_id
   where public.is_admin()
  order by added_at;
$$;
grant execute on function public.admin_access_list() to authenticated;

-- выдать доступ обычному аккаунту по логину или почте
create or replace function public.admin_grant(p_login text, p_role text default 'manager')
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not public.can_grant() then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'dev', 'manager') then raise exception 'BAD_ROLE'; end if;
  select id, coalesce(display_name, username) into v_id, v_name
    from public.profiles
   where username = p_login::citext or email = p_login::citext
   limit 1;
  if v_id is null then raise exception 'NO_USER'; end if;
  insert into public.admin_users (user_id, note, role) values (v_id, 'выдан из панели', p_role)
    on conflict (user_id) do update set role = excluded.role;
  return coalesce(v_name, p_login);
end;
$$;
grant execute on function public.admin_grant(text, text) to authenticated;

-- выдать доступ по Telegram ID: человек может ещё ни разу не заходить в магазин,
-- доступ включится сам при первом входе через Telegram
create or replace function public.admin_grant_telegram(p_tid bigint, p_role text default 'manager')
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.can_grant() then raise exception 'NOT_ALLOWED'; end if;
  if p_role not in ('owner', 'dev', 'manager') then raise exception 'BAD_ROLE'; end if;
  insert into public.admins (telegram_id, note, role) values (p_tid, 'выдан из панели', p_role)
    on conflict (telegram_id) do update set role = excluded.role;
  return true;
end;
$$;
grant execute on function public.admin_grant_telegram(bigint, text) to authenticated;

-- снять доступ: по логину или по Telegram ID, себя снять нельзя
create or replace function public.admin_revoke(p_ident text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tid bigint; v_me bigint;
begin
  if not public.can_grant() then raise exception 'NOT_ALLOWED'; end if;
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

-- сводка отдаёт роль, чтобы панель сразу знала, что показывать
create or replace function public.admin_overview()
returns json language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then json_build_object(
    'role', public.admin_role(),
    'can_grant', public.can_grant(),
    'users', (select count(*) from public.profiles),
    'orders', (select count(*) from public.orders),
    'orders_new', (select count(*) from public.orders where status = 'new'),
    'reservations', (select count(*) from public.reservations where kind = 'reserve'),
    'res_active', (select count(*) from public.reservations where kind = 'reserve' and status in ('active', 'notified')),
    'waiting', (select count(*) from public.reservations where kind = 'notify' and status = 'waiting'),
    'reviews', (select count(*) from public.reviews),
    'bot_users', (select count(*) from public.bot_users)
  ) else null end;
$$;
grant execute on function public.admin_overview() to authenticated;

-- расстановка ролей, о которой договорились
insert into public.admins (telegram_id, note, role) values
  (5301671230, 'nexrsy',          'dev'),
  (8108651376, 'Elfbaro Manager', 'owner'),
  (855010368,  'Влад',            'manager'),
  (6985103909, 'blxdborne',       'manager')
on conflict (telegram_id) do update set role = excluded.role, note = excluded.note;
