// KatoVape: настройки авторизации.
// Пока поля пустые, сайт работает как раньше (гостевой режим), вход выключен.
// Заполни своими значениями из Supabase, и вход/регистрация включатся сами.
//
// Где взять: Supabase → Project Settings → API.
//   SUPABASE_URL      — Project URL, вида https://xxxx.supabase.co
//   SUPABASE_ANON_KEY — ключ anon/public. Его МОЖНО светить в коде: доступ к данным
//                       ограничен политиками RLS, а не секретностью ключа.
//   FUNCTIONS_URL     — обычно это SUPABASE_URL + "/functions/v1"
//   TELEGRAM_BOT      — username бота без @, нужен только для кнопки
//                       "Войти через Telegram" на сайте (в мини-аппе не нужен).
//
// Токен бота и service_role ключ сюда НЕ кладём. Они живут только в секретах
// Edge Function на сервере Supabase. Подробнее в AUTH_SETUP.md.

window.KV_CONFIG = {
  // BACKEND: 'local' — локальный SQL-сервер из папки server/ (демо для показа клиенту).
  //          'supabase' — облачный Supabase (прод). '' — гостевой режим без входа.
  BACKEND: 'local',
  LOCAL_API: 'http://127.0.0.1:8790',   // адрес демо-бэкенда (node server/index.mjs)

  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  FUNCTIONS_URL: '',

  // username бота без @ для кнопки "Войти через Telegram" на публичном сайте.
  // Виджет Telegram работает ТОЛЬКО на домене, заданном боту в BotFather (/setdomain),
  // на localhost он не отрисуется — там показываем демо-вход.
  TELEGRAM_BOT: 'test_syncae_bot',

  // Telegram ID тех, кому открыта админка (проверяется на сервере).
  ADMIN_IDS: [5301671230]
};
