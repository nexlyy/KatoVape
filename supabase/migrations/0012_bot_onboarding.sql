-- KatoVape: онбординг клиента в боте. Бот собирает данные ДО кнопки «Магазин» и хранит их
-- у telegram_id. Профиль в auth заводится только при входе в мини-апп, поэтому данные из
-- бота ложатся сюда раньше и позже подставятся в профиль при первом входе.
alter table public.bot_users add column if not exists full_name text;
alter table public.bot_users add column if not exists phone     text;
alter table public.bot_users add column if not exists email     text;
alter table public.bot_users add column if not exists city      text;
alter table public.bot_users add column if not exists paczkomat text;
alter table public.bot_users add column if not exists age_ok    boolean not null default false;  -- подтвердил 18+
alter table public.bot_users add column if not exists step      text;                            -- шаг онбординга: name|phone|email|city|paczkomat
alter table public.bot_users add column if not exists onboarding_done boolean not null default false;
