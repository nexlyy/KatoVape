# KatoVape: деплой бота + мини-приложения + админки на VPS

Ставим рядом с MCR Planet, ничего его не трогая: отдельная папка `/opt/katovape`,
отдельный systemd-сервис `katovape-api`, отдельный поддомен, свой порт (8790).
На VPS системный Node 20 (для mcr-bot) не меняем — KatoVape крутится на изолированном
Node 22 в `/opt/katovape/node`.

## Что нужно заранее
1. **Токен бота** от @BotFather.
2. **Поддомен**, указывающий A-записью на IP этого VPS (напр. `shop.mcrplanet.com`).
3. Домен бота в @BotFather (`/setdomain` → тот же поддомен) — для кнопки «Войти через Telegram» на сайте.

## 1. Залить код (с локальной машины)
```
rsync -az --delete server/  mcr:/opt/katovape/server/
rsync -az --delete shared/ demos/ data/ index.html README.md  mcr:/opt/katovape/site/
rsync -az deploy/          mcr:/opt/katovape/server/deploy/
```
(БД `/opt/katovape/data/katovape.db` rsync не трогает — она вне выгружаемых папок.)

## 2. Прод-конфиг фронта
На VPS перезаписать `/opt/katovape/site/shared/config.js`, указав адрес API и бота:
```js
window.KV_CONFIG = {
  BACKEND: 'local',
  LOCAL_API: 'https://SUBDOMAIN/api',   // API за nginx
  SUPABASE_URL: '', SUPABASE_ANON_KEY: '', FUNCTIONS_URL: '',
  TELEGRAM_BOT: 'ИМЯ_БОТА_без_@',
  ADMIN_IDS: [5301671230]
};
```
(Витрина на localhost-хосте пускает вход только локально; на реальном домене — против этого API. Логика уже в auth.js.)

## 3. Настройка на сервере
```
ssh mcr
cp /opt/katovape/server/deploy/.env.example /opt/katovape/.env && chmod 600 /opt/katovape/.env
nano /opt/katovape/.env          # токен, PUBLIC_URL=https://SUBDOMAIN/api, MINIAPP_URL=https://SUBDOMAIN/demos/hub/
bash /opt/katovape/server/deploy/setup.sh    # ставит Node 22, systemd-сервис
```

## 4. nginx + TLS
```
sed 's/SUBDOMAIN/shop.mcrplanet.com/g' /opt/katovape/server/deploy/nginx-katovape.conf \
  > /etc/nginx/sites-available/katovape
ln -sf /etc/nginx/sites-available/katovape /etc/nginx/sites-enabled/katovape
nginx -t && systemctl reload nginx
certbot --nginx -d shop.mcrplanet.com
```

## 5. Проверка
- `curl https://SUBDOMAIN/api/health` → `{"ok":true,"bot":true,...}`
- В логах сервиса `journalctl -u katovape-api -f` должно быть `setWebhook: ok`, `menuButton: ok`.
- В боте `/start` → приходит кнопка «Открыть магазин».
- Админка: `https://SUBDOMAIN/demos/admin/` → вход через Telegram (только для id из KV_ADMIN_IDS).

## Обновление кода потом
Повторить шаг 1 (rsync) и `systemctl restart katovape-api`. БД и `.env` не затираются.

## Что делает система
- **Мини-апп в боте**: кнопка-меню открывает витрину (initData → авто-вход, подпись проверяется бот-токеном).
- **Бронь**: на витрине жмёшь БРОНЬ у товара «нет в наличии» → запись в БД. После синка Google Sheets бот сам пишет тебе, когда позиция появилась.
- **Рассылка**: из админки текст уходит всем, кто нажал /start.
- **Заказы**: оформление сохраняется в БД, видно в админке (клиент, ник, телефон, состав, сумма, доставка).
- **Спрос**: счётчики просмотров/броней/заказов в админке.
- **Stripe**: место под оплату заготовлено (заказы со статусами) — подключается отдельно.

## Безопасность
- Токен бота и `.env` только на сервере (600), в git нет.
- `/auth/telegram` в проде проверяет подпись бот-токеном (widget=SHA256, initData=HMAC).
- Админ-эндпоинты закрыты проверкой telegram_id по KV_ADMIN_IDS.
- Пароли — scrypt+соль; сессии — случайные токены.
