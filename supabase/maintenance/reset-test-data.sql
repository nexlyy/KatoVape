-- Чистка перед боевым запуском: убрать всё, что накопилось за время проверок.
--
-- Остаётся ровно три вещи: ассортимент, люди с доступом и справочники (категории товара,
-- категории расходов, причины отказа, метки клиентов). Всё остальное это следы тестов:
-- заказы, брони, клиенты, партии, поставки, расходы, промокоды, журналы.
--
-- Скрипт прогоняется один раз в SQL-редакторе Supabase целиком. Он в транзакции: если
-- где-то ошибка, не применится ничего.
--
-- ПЕРЕД ЗАПУСКОМ снимите дамп, это одна команда: см. deploy/BACKUP.md. Откатить чистку
-- нечем, кроме дампа.
--
-- Полезно сперва посмотреть, кто уцелеет, отдельным запросом:
--
--   select id, username, telegram_id, display_name from public.profiles
--    where telegram_id in (8108651376, 8658843544, 6017482088, 855010368, 5301671230)
--       or username = 'Kato_Owner';
--
-- Если строк меньше шести, кто-то ещё не входил в панель. Его доступ по Telegram ID
-- сохранится, но самого аккаунта пока нет, и это нормально.

begin;

-- ---------- кто остаётся ----------
-- Пять человек по Telegram ID и один по логину. Список ведётся здесь и нигде больше:
-- всё, что ниже, сверяется с ним.
create temporary table keep_staff (telegram_id bigint, username text) on commit drop;
insert into keep_staff (telegram_id, username) values
  (8108651376, null),
  (8658843544, null),
  (6017482088, null),
  (855010368,  null),
  (5301671230, null),
  (null, 'Kato_Owner');

create temporary table keep_profiles (id uuid primary key) on commit drop;
insert into keep_profiles (id)
select distinct p.id from public.profiles p
 where p.telegram_id in (select telegram_id from keep_staff where telegram_id is not null)
    or lower(p.username::text) in (select lower(username) from keep_staff where username is not null);

-- Подстраховка: если у кого-то из списка ещё нет профиля (не входил ни разу), доступ по
-- Telegram ID всё равно остаётся в таблице admins и сработает при первом входе.
--
-- А вот пустой список это опечатка, а не «никого не оставляем»: ниже по нему удаляются все
-- аккаунты. Останавливаемся, пока ничего не тронуто.
do $$
begin
  if (select count(*) from keep_profiles) = 0 then
    raise exception 'keep_staff не совпал ни с одним профилем: проверьте Telegram ID и логин';
  end if;
end $$;

-- ---------- движение и деньги ----------
-- Журнал движения чистится ниже, последним: правка остатка сама пишет в него строку, и снести
-- его раньше значит собрать мусор обратно.
delete from public.write_offs;
delete from public.batches;
delete from public.supply_lines;
delete from public.supplies;
delete from public.suppliers;
delete from public.expenses;

-- ---------- продажи ----------
delete from public.promo_uses;
delete from public.promo_codes;
delete from public.reviews;
delete from public.orders;
delete from public.reservations;
delete from public.demand;

-- ---------- клиенты и работа с ними ----------
delete from public.contact_notes;
delete from public.contacts;
delete from public.tasks;
delete from public.broadcasts;
delete from public.sync_jobs;
delete from public.audit_log;
delete from public.auth_attempts;

-- Бот помнит всех, кто нажал /start. Оставляем только своих.
delete from public.bot_users
 where telegram_id not in (select telegram_id from keep_staff where telegram_id is not null);

-- ---------- аккаунты ----------
-- Права: лишние роли убираем, чтобы после чистки в разделе «Доступ» не осталось тестовых.
delete from public.admin_users where user_id not in (select id from keep_profiles);
delete from public.admins
 where telegram_id not in (select telegram_id from keep_staff where telegram_id is not null);

-- Сами аккаунты живут в auth.users, public.profiles висит на них каскадом: удаляем корень,
-- профиль уходит следом. Так не остаётся сирот, которые мешают завести тот же телефон заново.
delete from auth.users u where u.id not in (select id from keep_profiles);

-- ---------- остаток ----------
-- Количество на полке НЕ трогаем. Обнулить его было бы честнее (цифры тестовые, и часть
-- завышена старым багом, когда выданный заказ не уменьшал склад), но магазин открывается
-- завтра, а пустая витрина в день открытия хуже неточной. Числа поправят в панели или
-- первой же поставкой.
--
-- Если всё-таки нужно начать с нуля и завести остаток поставкой, раскомментируйте строку:
-- update public.products set qty = 0, updated_at = now() where qty <> 0;

-- ---------- журнал движения ----------
-- Сносим начисто и ставим точку отсчёта заново, как это делает миграция 0047. Если остаток
-- обнулён, ставить нечего и журнал остаётся пустым до первой поставки.
delete from public.stock_moves;
alter table public.stock_moves alter column id restart with 1;
insert into public.stock_moves (city, product_id, flavor, delta, qty_after, reason, at)
select p.city, p.id, p.flavor, p.qty, p.qty, 'init', now()
  from public.products p where p.qty <> 0;

-- ---------- нумерация с начала ----------
alter table public.orders        alter column id restart with 1;
alter table public.reservations  alter column id restart with 1;
alter table public.reviews       alter column id restart with 1;
alter table public.broadcasts    alter column id restart with 1;
alter table public.promo_uses    alter column id restart with 1;
alter table public.sync_jobs     alter column id restart with 1;
alter table public.contacts      alter column id restart with 1;
alter table public.contact_notes alter column id restart with 1;
alter table public.tasks         alter column id restart with 1;
alter table public.audit_log     alter column id restart with 1;
alter table public.supplies      alter column id restart with 1;
alter table public.supply_lines  alter column id restart with 1;
alter table public.suppliers     alter column id restart with 1;
alter table public.batches       alter column id restart with 1;
alter table public.write_offs    alter column id restart with 1;
alter table public.expenses      alter column id restart with 1;

commit;

-- ---------- проверка ----------
-- Прогнать отдельно и посмотреть глазами: заказов ноль, ассортимент на месте, людей столько
-- же, сколько в списке выше.
select 'orders'   as t, count(*) from public.orders
union all select 'reservations', count(*) from public.reservations
union all select 'contacts',     count(*) from public.contacts
union all select 'stock_moves',  count(*) from public.stock_moves
union all select 'products',     count(*) from public.products
union all select 'profiles',     count(*) from public.profiles
union all select 'admins',       count(*) from public.admins
union all select 'admin_users',  count(*) from public.admin_users
union all select 'bot_users',    count(*) from public.bot_users;
