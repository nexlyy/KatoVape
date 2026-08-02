// Front-end settings. The keys here are public by design: data access is limited by RLS
// policies, not by the secrecy of the key.
// The Supabase service key and the bot token never belong here; they live on the bot server.
window.KV_CONFIG = {
  // Accounts, reservations, orders and the panel live in Supabase. The flag doubles as the
  // cloud switch: without it the storefront runs off data/ files, with no login or orders.
  BACKEND: 'supabase',

  SUPABASE_URL: 'https://vffqnydxofvunwausakv.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_1SUnHJJpoxKPTkh3_ox4Xg_ONLBue9z',
  FUNCTIONS_URL: 'https://vffqnydxofvunwausakv.supabase.co/functions/v1',

  // Payments: Stripe on the website, Stripe Checkout in the mini app.
  // With PAYMENTS false the checkout stays cash on pickup. See deploy/PAYMENTS_SETUP.md.
  // STRIPE_PK is the publishable key; the secret one lives only in Supabase.
  PAYMENTS: true,
  // Card payment is switched off for now: the button explains that and leads to the city
  // manager. Set this to false to bring online payment back; keys and functions are ready.
  PAYMENTS_CARD_OFF: true,
  STRIPE_PK: 'pk_live_51TwKp12Oh3bIhyuZcduvlmYmOyWc92Q3z4lLhhDvzu3W6FNtCLjSIdCrlD67rWUYTpcMqFqT3f56fbuDj53JRWg900Y20uiegv',
  PAYMENTS_CURRENCY: 'pln',

  TELEGRAM_BOT: 'KatoVape_bot',   // bot username: reservation deep links and mini-app login
  // Numeric id of the same bot, the public half of its token. Telegram's own login page wants
  // this rather than the username, and going there directly is what replaced the login widget:
  // the widget script only builds its button when the page loads it the way its own snippet
  // does, and injecting it after the fact left an empty space where the button should be.
  TELEGRAM_BOT_ID: 8858523403,

  // City links live here and nowhere else. The channel button, the manager contact, the
  // subscribe popup and the footer all read them through KV.cityLink(), so adding a city or
  // moving a chat is a change to this block alone.
  // An empty channel means the link does not exist yet: the button says so and offers the
  // manager instead. Every city has its own manager, because the order must reach the person
  // who hands the goods over.
  CITY_LINKS: {
    katowice: { channel: 'https://t.me/+Dx0xgIyr4XkwOWEy', manager: 'https://t.me/KatoManager' },
    gliwice:  { channel: 'https://t.me/+P-8bC9IvIn01YmQy', manager: 'https://t.me/KatoManagerGliwice' },
    warszawa: { channel: 'https://t.me/+iV43ZajefN0yMjEy', manager: 'https://t.me/KatoManagerWarszawa' }
  },

  ADMIN_IDS: [5301671230],
  ADMIN_URL: 'https://nexlyy.github.io/KatoVape/demos/admin/?v=2',   // panel link shown to admins

  // Lockers come from our own list in data/inpost/<city>.json, exported by
  // server/inpost-fetch.mjs from the public InPost directory, so no API key is needed.
  // Refresh it with: node server/inpost-fetch.mjs
  INPOST_SOURCE: 'data/inpost'
};
