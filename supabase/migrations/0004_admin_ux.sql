-- KatoVape: админ-доступ с сайта + аватар из Telegram. Поверх 0001..0003.

-- фронт спрашивает «я админ?», чтобы показать кнопку перехода в админку
grant execute on function public.is_admin() to authenticated;

-- аватар профиля (для телеграм-входа кладём photo_url, для сайта — загруженный файл)
alter table public.profiles add column if not exists avatar text;

-- пользователь может менять свой аватар сам (telegram_id по-прежнему недоступен для правки)
grant update (username, display_name, full_name, phone, email, paczkomat, avatar, updated_at)
  on table public.profiles to authenticated;
