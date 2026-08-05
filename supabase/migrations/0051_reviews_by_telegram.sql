-- Отзыв на свой заказ, даже если заказ пришёл из мини-приложения.
--
-- Право оставить отзыв проверялось по владельцу заказа: o.user_id = auth.uid(). Но заказ из
-- мини-приложения кладётся с user_id только тогда, когда у человека уже есть профиль; если
-- профиля не было, заказ уходит с одним telegram_id. Такой заказ потом не давал отзыв
-- никогда, и выглядело это как «прошло время, уже нельзя».
--
-- Теперь заказ считается своим и по телеграму профиля. Правило «оценивать можно только
-- полученное» не меняется: статус по-прежнему обязан быть done.

create or replace function public.can_review(p_product text, p_flavor text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.status = 'done'
      and (o.user_id = auth.uid()
        or (o.telegram_id is not null
            and o.telegram_id = (select p.telegram_id from public.profiles p where p.id = auth.uid())))
      and o.items @> jsonb_build_array(jsonb_build_object('id', p_product, 'flavor', coalesce(p_flavor, ''))));
$$;
grant execute on function public.can_review(text, text) to authenticated;

create or replace function public.my_reviewables()
returns table(product_id text, flavor text)
language sql stable security definer set search_path = public as $$
  select distinct e->>'id', coalesce(e->>'flavor', '')
    from public.orders o, jsonb_array_elements(o.items) e
   where o.status = 'done' and e->>'id' is not null
     and (o.user_id = auth.uid()
       or (o.telegram_id is not null
           and o.telegram_id = (select p.telegram_id from public.profiles p where p.id = auth.uid())));
$$;
grant execute on function public.my_reviewables() to authenticated;

-- Заодно чиним прошлое: заказы, у которых владелец не проставился, а телеграм известен и
-- профиль с таким телеграмом уже существует. Без этого старые заказы так и остались бы
-- ничьими в списке клиентов и в статистике.
update public.orders o
   set user_id = p.id
  from public.profiles p
 where o.user_id is null
   and o.telegram_id is not null
   and p.telegram_id = o.telegram_id;

notify pgrst, 'reload schema';
