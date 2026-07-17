# KatoVape: боевой контур на Supabase (сервер = только бот)

Схема: мини-апп и админка (GitHub Pages) ходят в Supabase напрямую. На VPS крутится
ТОЛЬКО бот (`server/bot.mjs`, long polling, без http/nginx/домена), читает Supabase по
service_role: рассылки, синк ассортимента, уведомления о поступлении по броням.

## Что нужно от тебя
1. **Проект Supabase** — URL, ключ `anon`, ключ `service_role` (Project Settings → API).
2. **Токен бота** от @BotFather.
   (Либо дай Supabase access token — заведу проект и накачу схему сам.)

## 1. Схема
В Supabase → SQL Editor выполнить по порядку:
- `supabase/migrations/0001_auth.sql` (профили, вход);
- `supabase/migrations/0002_shop.sql` (бронь, заказы, ассортимент, рассылки, спрос, админ-RLS).
Твой Telegram id `5301671230` уже прописан в таблицу `admins`.

## 2. Вход через Telegram (Edge Function)
Проверка подписи Telegram делается секретным бот-токеном на сервере Supabase:
```
supabase functions deploy telegram-auth --no-verify-jwt
supabase secrets set TELEGRAM_BOT_TOKEN=<токен>
```
BotFather `/setdomain` → домен, где открыт сайт (для кнопки «Войти через Telegram»).
В мини-аппе (внутри Telegram) вход авто по initData.

## 3. Конфиг фронта (GitHub Pages)
`shared/config.js`:
```js
window.KV_CONFIG = {
  BACKEND: 'supabase',
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...',
  FUNCTIONS_URL: 'https://xxxx.supabase.co/functions/v1',
  TELEGRAM_BOT: 'имя_бота_без_@',
  ADMIN_IDS: [5301671230]
};
```

## 4. Бот на VPS
В `/opt/katovape/.env` добавить:
```
TELEGRAM_BOT_TOKEN=<токен>
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=<service_role>
MINIAPP_URL=https://nexlyy.github.io/KatoVape/demos/hub/
KV_SHEETS_CSV=            # опционально
```
Переключить сервис на бота Supabase:
```
sed -i 's/index.mjs/bot.mjs/' /etc/systemd/system/katovape-api.service
systemctl daemon-reload && systemctl restart katovape-api
journalctl -u katovape-api -f      # 'KatoVape bot (Supabase) стартовал', 'menuButton: ok'
```

## Как всё работает
- **Мини-апп/сайт** ↔ Supabase: регистрация/вход, бронь (insert в reservations), заказы (insert в orders), спрос (rpc bump_demand).
- **Админка** ↔ Supabase (RLS `is_admin()`): заказы, клиенты, спрос, бронь; кнопки «рассылка» и «синк» пишут pending-строку в broadcasts/sync_jobs.
- **Бот на VPS** poll-ит: Telegram (getUpdates → /start, бронь-диплинки) и Supabase (pending рассылки/синк → выполняет; после синка шлёт уведомления по броням).
- Сервер ничего веб-facing не держит; MCR Planet не задет.

## Осталось доделать в коде (когда дашь ключи — сделаю и проверю)
- Фронт: бронь/заказ через supabase-js в режиме BACKEND='supabase' (сейчас это только в локальном демо-бэкенде).
- Админка demos/admin: переключить с локального API на supabase-js (RPC admin_overview/admin_customers + select orders/reservations/demand).
