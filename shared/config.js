// KatoVape: настройки фронта. Публичные ключи — их можно держать в коде
// (доступ к данным ограничен политиками RLS, а не секретностью ключа).
// Секретный ключ Supabase и токен бота сюда НЕ кладём — они только на сервере бота.
window.KV_CONFIG = {
  // BACKEND: 'supabase' — боевой контур (аккаунты, бронь, заказы, админка в Supabase).
  //          'local' — локальный демо-бэкенд из server/ (node server/index.mjs) для разработки.
  BACKEND: 'supabase',
  LOCAL_API: 'http://127.0.0.1:8790',

  SUPABASE_URL: 'https://vffqnydxofvunwausakv.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_1SUnHJJpoxKPTkh3_ox4Xg_ONLBue9z',
  FUNCTIONS_URL: 'https://vffqnydxofvunwausakv.supabase.co/functions/v1',

  TELEGRAM_BOT: 'KatoVape_bot',   // username бота: бронь диплинком, вход в мини-аппе, кнопка "Открыть в Telegram"
  ADMIN_IDS: [5301671230],
  ADMIN_URL: 'https://nexlyy.github.io/KatoVape/demos/admin/?v=2',   // куда ведёт кнопка "В админку" для админов

  // Пачкоматы выбираются из своего списка (data/inpost/<город>.json, выгрузка
  // server/inpost-fetch.mjs из открытого справочника InPost), поэтому ключ не нужен.
  // Обновить список: node server/inpost-fetch.mjs
  INPOST_SOURCE: 'data/inpost'
};
