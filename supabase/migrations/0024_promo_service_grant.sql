-- KatoVape: скидку по промокоду перед оплатой считает та же promo_check, что и корзина
-- в браузере (edge-функции create-payment / create-checkout зовут её под service_role).
-- Раньше оплата брала промокоды из data/content.json, и списанная сумма расходилась с той,
-- что человек видел в корзине. Право на выполнение проставляем явно: без него функция
-- ответит 403, и оплата честно откажет вместо того, чтобы посчитать сумму мимо кода.
grant execute on function public.promo_check(text, text, numeric, text[]) to service_role;
grant execute on function public.promo_use(text, bigint) to service_role;
