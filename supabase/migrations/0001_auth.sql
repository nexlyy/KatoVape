-- KatoVape: схема авторизации.
-- Пароли и сессии ведёт сам Supabase Auth (bcrypt + JWT, шифрование данных на его стороне).
-- Здесь только профиль поверх auth.users, уникальность логинов и безопасные RPC.

create extension if not exists citext;

-- ---- профиль пользователя ----
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  username          citext unique,
  email             citext unique,          -- реальная почта, если её указали
  phone             text   unique,          -- только цифры и +
  auth_email        citext not null,        -- адрес, под которым заведён auth.users (может быть синтетическим)
  telegram_id       bigint unique,
  telegram_username text,
  display_name      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- свой профиль пользователь читает и меняет сам, чужие недоступны
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

-- ---- профиль создаётся автоматически при регистрации ----
-- поля берём из user_metadata, которые кладёт клиент при signUp,
-- либо из метаданных, которые ставит Edge Function при входе через Telegram
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, auth_email, username, email, phone, telegram_id, telegram_username, display_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'email_real', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    (nullif(new.raw_user_meta_data->>'telegram_id', ''))::bigint,
    nullif(new.raw_user_meta_data->>'telegram_username', ''),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(new.raw_user_meta_data->>'username', ''))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- проверка занятости логина/почты/телефона (для подсказок в форме) ----
-- отдаём только булевы флаги, чужих данных не раскрываем.
-- последнее слово всё равно за уникальными индексами таблицы.
create or replace function public.login_availability(p_username citext, p_email citext, p_phone text)
returns table(username_taken boolean, email_taken boolean, phone_taken boolean)
language sql
security definer set search_path = public
as $$
  select
    (p_username is not null and exists(select 1 from public.profiles where username = p_username)),
    (p_email    is not null and exists(select 1 from public.profiles where email = p_email)),
    (p_phone    is not null and exists(select 1 from public.profiles where phone = p_phone));
$$;

-- ---- по логину/почте/телефону вернуть auth-email для входа ----
-- нужно, потому что Supabase логинит по email, а человек вводит любой идентификатор.
-- security definer, возвращаем ровно один email и ничего лишнего.
create or replace function public.resolve_login(p_identifier text)
returns text
language sql
security definer set search_path = public
as $$
  select auth_email from public.profiles
  where username = p_identifier::citext
     or email    = p_identifier::citext
     or phone    = p_identifier
  limit 1;
$$;

grant execute on function public.login_availability(citext, citext, text) to anon, authenticated;
grant execute on function public.resolve_login(text) to anon, authenticated;
