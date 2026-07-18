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
  ADMIN_URL: 'https://nexlyy.github.io/KatoVape/demos/admin/',   // куда ведёт кнопка "В админку" для админов

  // токен геовиджета InPost (кабинет manager.paczkomaty.pl, раздел Geowidget).
  // пустой = ручной ввод номера пачкомата, с токеном появится выбор на карте
  INPOST_GEO_TOKEN: ''
};
