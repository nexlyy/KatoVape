# KatoVape: как всё развёрнуто и как обновлять

Три части живут раздельно:

| Часть | Где | Чем обновляется |
|---|---|---|
| Витрина, мини-апп, админка | GitHub Pages (`nexlyy.github.io/KatoVape`) | `git push` в `main` |
| База, вход, оплата | Supabase (проект `vffqnydxofvunwausakv`) | миграции в SQL Editor + `supabase functions deploy` |
| Бот | VPS `mcr`, `/opt/katovape`, systemd `katovape-api` | rsync/scp + `systemctl restart` |

Проект MCR Planet на том же сервере не затрагивается: своя папка, свой сервис, свой
изолированный Node 22 в `/opt/katovape/node` (системный Node 20 для mcr-bot не трогаем).

## Обновить бота
```
scp server/bot.mjs server/tg.mjs server/i18n.mjs mcr:/opt/katovape/server/
ssh mcr "systemctl restart katovape-api"
```
Проверка: `ssh mcr "journalctl -u katovape-api -n 20 --no-pager"` — ожидаем
`стартовал`, `menuButton: ok`, `бот: long polling`.

`.env` (`/opt/katovape/.env`, права 600) и папка `data/` при этом не трогаются. В `.env` лежат
`TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `MINIAPP_URL`, `KV_MANAGER_IDS`,
`KV_ADMIN_URL`.

## Обновить витрину и админку
`git push` в `main` — Pages пересобирается сам. Настройки фронта лежат в `shared/config.js`
(единственная копия): ссылки городов `CITY_LINKS`, выключатель оплаты `PAYMENTS_CARD_OFF`,
`ADMIN_URL`, ключи Supabase (публичные) и имя бота.

Важно: браузеры кешируют скрипты по строке `?v=` в подключении. Поменяли `shared/*.js` —
поднимите номер версии во всех восьми демо (`demos/*/site|app/index.html`), иначе у людей
останется старый файл. Админка (demos/admin/index.html) подключает config.js своей строкой — её версию поднимайте вместе с остальными.

## Применить миграции базы
Автоматического `db push` тут нет (проект не слинкован с CLI), миграции применяются вручную:
Supabase → SQL Editor → New query → вставить файл целиком → Run. Порядок по номерам,
все миграции идемпотентны (повторный запуск безопасен).

Применены: `0001`–`0016`.
Ждут применения: `0017_city_roles.sql`, `0018_comments.sql`, `0019_reservation_city_policy.sql`.

После `0017` менеджеры получают доступ только к своему городу, поэтому применять его нужно
вместе с `0019` — иначе останется старая политика на брони из `0003`, и статусы чужого города
всё ещё будут доступны на запись.

## Обновить edge-функции
Из корня проекта:
```
supabase functions deploy create-payment  --no-verify-jwt --project-ref vffqnydxofvunwausakv
supabase functions deploy create-checkout --no-verify-jwt --project-ref vffqnydxofvunwausakv
supabase functions deploy stripe-webhook  --no-verify-jwt --project-ref vffqnydxofvunwausakv
supabase functions deploy telegram-auth   --no-verify-jwt --project-ref vffqnydxofvunwausakv
supabase functions deploy login           --no-verify-jwt --project-ref vffqnydxofvunwausakv
supabase functions deploy signup          --no-verify-jwt --project-ref vffqnydxofvunwausakv
```
Подробности по ключам и вебхуку — в `deploy/PAYMENTS_SETUP.md`.

## Безопасность
- Токен бота и service-ключ только в `.env` на сервере (600) и в секретах Supabase, в git их нет.
- Подпись Telegram проверяется бот-токеном на сервере (widget = SHA256, initData = HMAC).
- Доступ в админку — таблицы `admins` / `admin_users`; раздел «Доступ» открыт только владельцу.
- Менеджер видит и правит только свой город: это закреплено политиками RLS, а не только интерфейсом.
