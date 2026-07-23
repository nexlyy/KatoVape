// Прод-конфиг фронта для VPS. На сервере скопировать поверх site/shared/config.js,
// подставив свой поддомен и имя бота. НЕ коммитим реальные значения в git.
window.KV_CONFIG = {
  BACKEND: 'local',
  LOCAL_API: 'https://SUBDOMAIN/api',   // API за nginx (напр. https://shop.mcrplanet.com/api)

  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  FUNCTIONS_URL: '',

  TELEGRAM_BOT: 'ИМЯ_БОТА_без_собачки', // для кнопки "Войти через Telegram" на сайте (нужен /setdomain у BotFather)
  ADMIN_IDS: [5301671230],

  // Оплата: включить после настройки Stripe и Supabase (см. deploy/PAYMENTS_SETUP.md).
  // STRIPE_PK — публичный ключ pk_test_… или pk_live_…, секретный ключ в Supabase, не тут.
  PAYMENTS: false,
  STRIPE_PK: '',
  PAYMENTS_CURRENCY: 'pln'
};
