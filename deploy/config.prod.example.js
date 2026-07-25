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
  ADMIN_URL: 'https://nexlyy.github.io/KatoVape/demos/admin/',   // куда ведёт кнопка «Панель управления» у админа

  // Оплата: включить после настройки Stripe и Supabase (см. deploy/PAYMENTS_SETUP.md).
  // STRIPE_PK — публичный ключ pk_test_… или pk_live_…, секретный ключ в Supabase, не тут.
  // PAYMENTS_CARD_OFF: true — карта отключена, кнопка ведёт к менеджеру. Этот флаг должен
  // повторять shared/config.js, иначе прод-копия включит live-оплату в обход выключателя.
  PAYMENTS: false,
  PAYMENTS_CARD_OFF: true,
  STRIPE_PK: '',
  PAYMENTS_CURRENCY: 'pln',

  // Ссылки магазинов по городам: их берут кнопка Telegram и связь с менеджером.
  CITY_LINKS: {
    katowice: { channel: '', manager: 'https://t.me/KatoManager' },
    gliwice:  { channel: 'https://t.me/+P-8bC9IvIn01YmQy', manager: 'https://t.me/KatoManager' },
    warszawa: { channel: 'https://t.me/+iV43ZajefN0yMjEy', manager: 'https://t.me/KatoManager' }
  }
};
