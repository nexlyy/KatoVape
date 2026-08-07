-- Опечатка в id товара: в Катовице Puffy завели с большой буквы.
--
-- id это ключ, по которому витрина сшивает строку базы с карточкой из data/products.json,
-- и сравнение точное. Пока состав вкусов только накладывался поверх файла, расхождение
-- было незаметно с виду и вредно по сути: строки не находились, товар показывался с
-- остатками из файла, то есть «в наличии» без единой штуки на полке, а вкусы, заведённые
-- в панели, не доезжали до покупателя вовсе. С тех пор как каталог берётся из базы, тот же
-- товар просто исчез бы из продажи.
--
-- В Гливице этот же товар заведён правильно, строчными, и фото лежит как photos/puffy.jpg.
-- Приводим Катовице к ним.
--
-- Заказы не трогаем намеренно: orders.items это снимок того, что человек купил, менеджер
-- собирает посылку по нему, и переписывать историю задним числом нельзя.

update public.products set id = 'puffy' where id = 'Puffy';

-- Всё, что ссылается на товар строкой. Города фильтровать не нужно: с большой буквы этот
-- id встречался только в Катовице, а где он записан правильно, условие просто не сработает.
update public.reservations set product_id = 'puffy' where product_id = 'Puffy';
update public.reviews       set product_id = 'puffy' where product_id = 'Puffy';
update public.batches       set product_id = 'puffy' where product_id = 'Puffy';
update public.write_offs    set product_id = 'puffy' where product_id = 'Puffy';
update public.supply_lines  set product_id = 'puffy' where product_id = 'Puffy';
update public.stock_moves   set product_id = 'puffy' where product_id = 'Puffy';

-- Спрос считается по паре (товар, событие), поэтому здесь не переименование, а слияние:
-- у обоих написаний могли накопиться свои счётчики.
insert into public.demand (product_id, event, n)
  select 'puffy', event, n from public.demand where product_id = 'Puffy'
  on conflict (product_id, event) do update set n = public.demand.n + excluded.n;
delete from public.demand where product_id = 'Puffy';

-- Повторный прогон ничего не найдёт и ничего не сделает. Если когда-нибудь в одном городе
-- окажутся оба написания с одинаковым вкусом, первый update упадёт на уникальном ключе:
-- это правильнее, чем молча склеить две карточки с разными остатками.
