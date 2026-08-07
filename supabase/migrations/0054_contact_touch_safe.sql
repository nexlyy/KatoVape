-- Учёт клиентов больше не может помешать человеку войти.
--
-- Что происходило. Человек сперва нажимал «Старт» у бота: заводилась карточка клиента с его
-- телеграмом. Потом он открывал магазин внутри Telegram, и вход шёл так:
--   1) заводится учётная запись, а вместе с ней пустой профиль;
--   2) на появление профиля срабатывает наш же учёт и заводит ВТОРУЮ карточку, уже с
--      аккаунтом, но пока без телеграма;
--   3) вход дописывает в профиль телеграм, учёт срабатывает снова, находит ПЕРВУЮ карточку
--      по телеграму и пытается приписать ей аккаунт, который уже занят второй карточкой.
-- Аккаунт у карточки уникален, поэтому шаг 3 падал с ошибкой, а вместе с ним откатывалась и
-- запись телеграма в профиль. Профиль оставался без телеграма, следующий вход снова не мог
-- найти этого человека, и он навсегда оставался гостем: ровно то, на что жаловался владелец.
--
-- Лечим с двух сторон. Во-первых, карточка перестаёт хвататься за занятое: телефон и аккаунт
-- приписываются, только если их не держит кто-то другой. Во-вторых, две карточки одного
-- человека склеиваются в одну. И в-третьих, сам учёт больше не может уронить запись профиля:
-- он ведётся ради удобства менеджера, а вход важнее.

-- ---------- склейка и осторожная привязка ----------
create or replace function public.crm_touch_contact(
  p_city text, p_name text, p_phone text, p_email text, p_tg bigint, p_user uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_phone text; v_id bigint; v_other bigint;
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

  -- Тот же человек уже заведён дважды: один раз из бота (по телеграму), второй при
  -- регистрации (по аккаунту). Сливаем в найденную карточку, чтобы менеджер видел одну.
  if p_user is not null then
    select id into v_other from public.contacts where user_id = p_user and id <> v_id;
    if v_other is not null then
      update public.contacts c set
        full_name   = coalesce(c.full_name, o.full_name),
        phone       = coalesce(c.phone, o.phone),
        email       = coalesce(c.email, o.email),
        telegram_id = coalesce(c.telegram_id, o.telegram_id),
        tags        = (select array(select distinct unnest(c.tags || o.tags))),
        blocked     = c.blocked or o.blocked,
        updated_at  = now()
        from public.contacts o where c.id = v_id and o.id = v_other;
      update public.contact_notes set contact_id = v_id where contact_id = v_other;
      update public.orders set contact_id = v_id where contact_id = v_other;
      delete from public.contacts where id = v_other;
    end if;
  end if;

  -- Телефон и аккаунт уникальны у карточки. Если их держит кто-то ещё, оставляем как есть:
  -- лучше неполная карточка, чем сорванная запись профиля.
  update public.contacts set
    full_name   = coalesce(full_name, nullif(btrim(p_name), '')),
    email       = coalesce(email, nullif(btrim(p_email), '')),
    telegram_id = coalesce(telegram_id,
                    case when p_tg is null or exists (
                      select 1 from public.contacts x where x.telegram_id = p_tg and x.id <> v_id)
                    then null else p_tg end),
    phone       = coalesce(phone,
                    case when v_phone is null or exists (
                      select 1 from public.contacts x where x.phone = v_phone and x.id <> v_id)
                    then null else v_phone end),
    user_id     = coalesce(user_id,
                    case when p_user is null or exists (
                      select 1 from public.contacts x where x.user_id = p_user and x.id <> v_id)
                    then null else p_user end),
    updated_at  = now()
   where id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.crm_touch_contact(text, text, text, text, bigint, uuid) from public, anon, authenticated;

-- ---------- учёт не роняет профиль ----------
-- Карточка клиента это удобство для менеджера. Если она почему-то не завелась, человек всё
-- равно должен войти и оформить заказ, поэтому ошибку глотаем и пишем в журнал сервера.
create or replace function public.profiles_to_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.crm_touch_contact(coalesce(new.city, 'katowice'),
      coalesce(new.full_name, new.display_name, ''), coalesce(new.phone, ''),
      coalesce(new.email, ''), new.telegram_id, new.id);
  exception when others then
    raise warning 'crm_touch_contact для профиля %: % / %', new.id, SQLSTATE, SQLERRM;
  end;
  return new;
end;
$$;

create or replace function public.bot_users_to_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.crm_touch_contact(coalesce(new.city, 'katowice'),
      coalesce(new.full_name, new.first_name, ''), coalesce(new.phone, ''),
      coalesce(new.email, ''), new.telegram_id, null);
  exception when others then
    raise warning 'crm_touch_contact для бота %: % / %', new.telegram_id, SQLSTATE, SQLERRM;
  end;
  return new;
end;
$$;

-- ---------- починить тех, кто уже застрял ----------
-- Профиль заведён телеграм-входом (логин вида tg_<id>), а самого телеграма в нём нет:
-- ровно те, кто не мог войти. Достаём номер из логина и дописываем.
update public.profiles p
   set telegram_id = substring(p.username::text from '^tg_([0-9]+)$')::bigint,
       updated_at = now()
 where p.telegram_id is null
   and p.username::text ~ '^tg_[0-9]+$'
   and not exists (select 1 from public.profiles q
                    where q.telegram_id = substring(p.username::text from '^tg_([0-9]+)$')::bigint);

notify pgrst, 'reload schema';
