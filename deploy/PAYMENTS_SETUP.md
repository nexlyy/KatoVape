# Оплата: Stripe на сайте и в мини-аппе Telegram

Что уже в коде:
- **Сайт** — встроенные кнопки Apple Pay / Google Pay / карта (Stripe Express Checkout Element).
- **Мини-апп Telegram** — Stripe Checkout: кнопка открывает страницу Stripe во внешнем
  браузере, там Apple Pay / Google Pay / карта. Нативный инвойс Telegram НЕ используем —
  Telegram убрал Stripe из провайдеров BotFather.

Сумму считает сервер по каталогу — цене с фронта не доверяем. Пока `PAYMENTS: false` в
`shared/config.js`, чекаут работает как раньше (оплата при выдаче). Начинать проще на
**тестовых** ключах Stripe: карты и кошельки работают, деньги не двигаются.

## 1. Stripe

1. Зарегистрируйте аккаунт на stripe.com, оставайтесь в **Test mode**.
2. Developers → API keys: возьмите **Publishable key** (`pk_test_…`) и **Secret key** (`sk_test_…`).
3. Signing secret webhook (`whsec_…`) появится на шаге 4.

## 2. Секреты Supabase (серверная часть)

Секретный ключ Stripe и токен бота живут только в Supabase, в браузер не попадают.

```
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  CATALOG_BASE=https://nexlyy.github.io/KatoVape \
  PAY_RETURN_URL=https://t.me/KatoVape_bot
```

- `CATALOG_BASE` — корень сайта, откуда функция берёт `data/products.json` и `data/content.json`
  (тот же каталог, что видит покупатель).
- `PAY_RETURN_URL` — куда Stripe вернёт браузер после оплаты в мини-аппе (по умолчанию —
  назад к боту). Необязателен.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `TELEGRAM_BOT_TOKEN`
  уже заданы для функций входа — их трогать не надо.

## 3. Миграция БД и функции

```
supabase db push          # применит supabase/migrations/0011_payments.sql

# --no-verify-jwt: create-payment проверяет пользователя сам (JWT), create-checkout —
# по подписи initData, а webhook Stripe приходит вообще без токена
supabase functions deploy create-payment  --no-verify-jwt
supabase functions deploy create-checkout --no-verify-jwt
supabase functions deploy stripe-webhook  --no-verify-jwt
```

## 4. Webhook Stripe

Единственный доверенный источник факта оплаты — фронт мог закрыть вкладку.

1. Stripe → Developers → Webhooks → Add endpoint.
2. URL: `https://<PROJECT>.supabase.co/functions/v1/stripe-webhook`
3. События: `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `checkout.session.completed`, `checkout.session.expired`.
4. Скопируйте **Signing secret** (`whsec_…`) и положите в `STRIPE_WEBHOOK_SECRET` (шаг 2).

## 5. Включить оплату на фронте

В `shared/config.js` (или в проде — в скопированном `config.prod.js`):

```js
PAYMENTS: true,
STRIPE_PK: 'pk_test_xxx',   // публичный ключ, нужен для кнопок на сайте
PAYMENTS_CURRENCY: 'pln',
```

## 6. Мини-апп Telegram

Отдельная настройка НЕ нужна: мини-апп использует тот же Stripe через `create-checkout`
(шаг 3) и `STRIPE_SECRET_KEY` (шаг 2). BotFather/Payments не задействуем — Stripe там больше
нет. Бот `server/bot.mjs` для оплаты менять не требуется (факт оплаты ставит webhook,
менеджеру о новом оплаченном заказе сообщает джоба notifyOrders).

## 7. Apple Pay на сайте — верификация домена

Только для встроенных кнопок **на сайте**:

1. Stripe → Settings → Payment method domains → добавьте домен сайта.
2. Положите файл Stripe по адресу
   `https://<домен>/.well-known/apple-developer-merchantid-domain-association`.

> На пути проекта GitHub Pages (`nexlyy.github.io/KatoVape`) корень чужой — Apple Pay на
> сайте там не верифицируется (нужен свой домен). Google Pay и карта на сайте работают и так.
> В **мини-аппе** оплата идёт через страницу Stripe Checkout — Apple Pay там работает БЕЗ
> верификации домена (страница на checkout.stripe.com).

## 8. Проверка

Тестовая карта `4242 4242 4242 4242`, любой будущий срок и CVC.

- **Сайт** (Chrome/Android — Google Pay, Safari/iOS — Apple Pay, иначе карта): оплата
  прошла → у заказа в `orders` `payment_status = paid`, менеджеру в бота падает
  «Оплачено онлайн».
- **Мини-апп**: кнопка «Оплатить» открывает Stripe в браузере → оплата → возврат в Telegram,
  приложение само подтвердит (опрашивает статус заказа до 2 минут).
- Кнопка «Оплатить при выдаче» рядом создаёт заказ без оплаты, как раньше.

## Боевой режим

Переключите Stripe в Live, замените `sk_test_→sk_live_`, `pk_test_→pk_live_`, заведите
боевой webhook (новый `whsec_`), заново верифицируйте домен Apple Pay для сайта. Значения —
в те же секреты Supabase и `config.js`.
