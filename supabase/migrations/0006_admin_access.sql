-- KatoVape: доступ в админку не только по Telegram, но и по обычному аккаунту с паролем.
-- Раньше is_admin() смотрел только на telegram_id, поэтому войти паролем было нельзя.

create table if not exists public.admin_users (
  user_id  uuid primary key references public.profiles(id) on delete cascade,
  note     text,
  added_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    join public.profiles p on p.telegram_id = a.telegram_id
    where p.id = auth.uid()
  ) or exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  );
$$;
grant execute on function public.is_admin() to authenticated;

-- список тех, у кого есть доступ (видит только админ)
create or replace function public.admin_access_list()
returns table(kind text, who text, ident text, added_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'telegram', coalesce(p.display_name, p.username, 'без профиля'),
         a.telegram_id::text, a.added_at
    from public.admins a
    left join public.profiles p on p.telegram_id = a.telegram_id
   where public.is_admin()
  union all
  select 'password', coalesce(p.display_name, p.username, '—'),
         coalesce(p.username, p.email, p.id::text), au.added_at
    from public.admin_users au
    join public.profiles p on p.id = au.user_id
   where public.is_admin()
  order by added_at;
$$;
grant execute on function public.admin_access_list() to authenticated;

-- выдать доступ обычному аккаунту по логину или почте
create or replace function public.admin_grant(p_login text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select id, coalesce(display_name, username) into v_id, v_name
    from public.profiles
   where username = p_login::citext or email = p_login::citext
   limit 1;
  if v_id is null then raise exception 'NO_USER'; end if;
  insert into public.admin_users (user_id, note) values (v_id, 'выдан из админки')
    on conflict (user_id) do nothing;
  return coalesce(v_name, p_login);
end;
$$;
grant execute on function public.admin_grant(text) to authenticated;

-- забрать доступ у аккаунта с паролем
create or replace function public.admin_revoke(p_login text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select id into v_id from public.profiles
   where username = p_login::citext or email = p_login::citext limit 1;
  if v_id is null then return false; end if;
  -- себя разжаловать нельзя, иначе можно остаться без доступа совсем
  if v_id = auth.uid() then raise exception 'SELF_REVOKE'; end if;
  delete from public.admin_users where user_id = v_id;
  return true;
end;
$$;
grant execute on function public.admin_revoke(text) to authenticated;
