import { BOT_TOKEN, sendMessage, sendPhoto, editMessage, answerCallback, getUpdates, deleteWebhook, setMenuButton } from './tg.mjs';
import { tr, pickLang, LANGS, LANG_LABEL } from './i18n.mjs';

const SUPA = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const MINIAPP_URL = process.env.MINIAPP_URL || '';
const SHEETS = process.env.KV_SHEETS_CSV || '';
const JOBS_MS = Number(process.env.KV_JOBS_MS || 10000);
const MANAGERS = (process.env.KV_MANAGER_IDS || '5301671230').split(',').map(s => +s.trim()).filter(Boolean);
const ADMIN_URL = process.env.KV_ADMIN_URL || '';
const CITIES = ['katowice', 'gliwice', 'warszawa'];
const CITY_LABEL = { katowice: 'Katowice', gliwice: 'Gliwice', warszawa: 'Warszawa' };

// Channel and manager links per city. Mirrors CITY_LINKS in shared/config.js, which the
// storefront reads; keep both in step when a city changes hands.
const CITY_LINKS = (() => {
  try { return JSON.parse(process.env.KV_CITY_LINKS || '{}'); } catch { return {}; }
})();
const cityLink = (city, kind) => (CITY_LINKS[city] || {})[kind] || '';

const PAGE = 6;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const enc = encodeURIComponent;

async function sb(method, path, body, extra) {
  const res = await fetch(SUPA + '/rest/v1/' + path, {
    method,
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'User-Agent': 'katovape-bot/3.0', ...(extra || {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  if (!res.ok) throw new Error('supabase ' + res.status + ' ' + txt.slice(0, 200));
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}
const sbSelect = (t, q) => sb('GET', t + (q ? '?' + q : ''));
const sbInsert = (t, row) => sb('POST', t, row, { Prefer: 'return=representation' });
const sbUpdate = (t, q, patch) => sb('PATCH', t + '?' + q, patch, { Prefer: 'return=minimal' });
// Same as sbUpdate but returns the changed rows, so a job can tell whether it won the
// row or another bot instance took it first.
const sbClaim = (t, q, patch) => sb('PATCH', t + '?' + q, patch, { Prefer: 'return=representation' });
const sbUpsert = (t, rows, onConflict) => sb('POST', t + (onConflict ? '?on_conflict=' + onConflict : ''), rows, { Prefer: 'resolution=merge-duplicates,return=minimal' });
const sbRpc = (fn, args) => sb('POST', 'rpc/' + fn, args || {});
async function sbCount(table, query) {
  const res = await fetch(SUPA + '/rest/v1/' + table + '?select=id&limit=1' + (query ? '&' + query : ''), {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Prefer: 'count=exact', Range: '0-0' }
  });
  const range = res.headers.get('content-range') || '';
  return Number(range.split('/')[1]) || 0;
}

function warsaw() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date());
  const g = t => (parts.find(x => x.type === t) || {}).value || '';
  return { date: g('year') + '-' + g('month') + '-' + g('day'), hour: +g('hour'), minute: +g('minute') };
}
const fmtDMY = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('-') : '';
function plusDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

function validName(s) { return (s || '').trim().split(/\s+/).filter(Boolean).length >= 2; }
function normPhone(s) {
  let d = (s || '').replace(/[^\d+]/g, '');
  if (/^\d{9}$/.test(d)) d = '+48' + d;
  if (/^48\d{9}$/.test(d)) d = '+' + d;
  return d;
}
const validPhone = s => /^\+\d{10,14}$/.test(s);
// Same rule as the storefront (core.js validEmail): the bot form and the mini app must
// not disagree on which address is acceptable.
const EMAIL_RE = /^[A-Za-z0-9]([A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const validEmail = s => {
  const v = (s || '').trim();
  return v.length <= 254 && !v.includes('..') && EMAIL_RE.test(v);
};
const normPaczko = s => (s || '').trim().toUpperCase().replace(/\s+/g, '');
const validPaczko = s => /^[A-Z]{3}\d{2,4}[A-Z]{0,2}$/.test(s);

// Any message to the bot means the person started it and can receive broadcasts.
// opted_in stays out of the payload so the column default applies on insert.
//
// The language is deliberately NOT part of this upsert. It used to be, and since this runs on
// every message and every button press it overwrote the language chosen in settings with the
// Telegram client language on the very next tap. The client language is only a starting point,
// applied once, when the row still has none.
async function touchUser(f) {
  if (!f || !f.id) return null;
  await sbUpsert('bot_users', {
    telegram_id: f.id, username: f.username || null, first_name: f.first_name || null
  }, 'telegram_id').catch(() => {});
  const st = await botUser(f.id);
  if (st && !st.lang && f.language_code) {
    const lang = pickLang(f.language_code);
    await setBotUser(f.id, { lang });
    st.lang = lang;
  }
  return st;
}
async function botUser(id) {
  const r = await sbSelect('bot_users', 'telegram_id=eq.' + id + '&select=*&limit=1').catch(() => null);
  return (r && r[0]) || null;
}
async function setBotUser(id, patch) { await sbUpdate('bot_users', 'telegram_id=eq.' + id, patch).catch(() => {}); }
async function langOf(tg) {
  const r = await sbSelect('bot_users', 'telegram_id=eq.' + tg + '&select=lang&limit=1').catch(() => null);
  return pickLang(r && r[0] && r[0].lang);
}
async function profileOf(tgId) {
  const r = await sbSelect('profiles', 'telegram_id=eq.' + tgId + '&select=id,full_name,phone,email,paczkomat,city&limit=1').catch(() => null);
  return (r && r[0]) || null;
}
// A returning customer who already filled everything in the mini app should not be
// walked through the bot questionnaire again.
async function profileComplete(tgId) {
  const p = await profileOf(tgId);
  return !!(p && p.full_name && p.phone && p.email && p.paczkomat);
}

const stLabel = (lang, s) => tr(lang, { new: 'stNew', confirmed: 'stConfirmed', done: 'stDone', cancelled: 'stCancelled' }[s] || 'stNew');
const resLabel = (lang, s) => tr(lang, { active: 'rsActive', notified: 'rsNotified', done: 'rsDone', cancelled: 'rsCancelled', expired: 'rsExpired', waiting: 'rsWaiting' }[s] || 'rsActive');
const delivLabel = (lang, d) => tr(lang, { pickup: 'dvPickup', inpost: 'dvInpost', courier: 'dvCourier' }[d] || 'dvPickup');
const payLabel = (lang, p) => tr(lang, { paid: 'pyPaid', pending: 'pyPending', unpaid: 'pyUnpaid', failed: 'pyFailed' }[p] || 'pyUnpaid');
const roleLabel = (lang, r) => tr(lang, { owner: 'roleOwner', dev: 'roleDev', manager: 'roleManager' }[r] || 'roleManager');

const delivLine = (lang, o) => delivLabel(lang, o.delivery) + (o.address ? ', ' + o.address : '');
const promoLine = (lang, o) => (o.promo && o.promo.length)
  ? '\n' + tr(lang, 'admOrderPromo', { codes: esc(o.promo.join(', ')) + (o.discount ? ' (−' + o.discount + ' zł)' : '') })
  : '';
const itemsLine = o => (o.items || []).map((x, i) =>
  (i + 1) + ') ' + (typeof x === 'string' ? x : (x.name || x.id) + (x.flavor ? ', ' + x.flavor : '') + ' × ' + (x.n || 1) +
    (x.sum ? ' = ' + x.sum + ' zł' : ''))).join('\n');

const btn = (text, data) => ({ text, callback_data: data });
const rows = (...r) => ({ inline_keyboard: r.filter(x => x && x.length) });

function shopRow(lang) {
  return MINIAPP_URL ? [{ text: tr(lang, 'shopBtn'), web_app: { url: MINIAPP_URL } }] : null;
}
function linkRow(lang, city) {
  const out = [];
  const ch = cityLink(city, 'channel');
  const mgr = cityLink(city, 'manager');
  if (ch) out.push({ text: tr(lang, 'btnChannel'), url: ch });
  if (mgr) out.push({ text: tr(lang, 'btnManager'), url: mgr });
  return out;
}

// ---- client screens ----

function mainMenu(lang, city, isAdmin) {
  const text = [tr(lang, 'menuTitle'), tr(lang, 'menuCity', { city: CITY_LABEL[city] || city }), '', tr(lang, 'menuHint')].join('\n');
  const markup = rows(
    shopRow(lang),
    linkRow(lang, city),
    [btn(tr(lang, 'btnOrders'), 'c:orders'), btn(tr(lang, 'btnRes'), 'c:res')],
    [btn(tr(lang, 'btnReviews'), 'c:reviews'), btn(tr(lang, 'btnSettings'), 'c:set')],
    isAdmin ? [btn(tr(lang, 'admTitle').replace(/<\/?b>/g, ''), 'a:main')] : null
  );
  return { text, markup };
}

const backRow = lang => [btn(tr(lang, 'btnMenu'), 'c:main')];

async function myOrdersScreen(tg, lang) {
  const list = await sbSelect('orders',
    'telegram_id=eq.' + tg + '&select=id,city,sum,status,payment_status,delivery,created_at&order=id.desc&limit=10').catch(() => []);
  const mine = list && list.length ? list : await ordersByProfile(tg);
  if (!mine.length) return { text: tr(lang, 'ordersTitle') + '\n\n' + tr(lang, 'ordersEmpty'), markup: rows(shopRow(lang), backRow(lang)) };
  const body = mine.map(o =>
    '№' + o.id + ' · ' + fmtDMY(o.created_at) + ' · <b>' + (o.sum || 0) + ' zł</b>\n' +
    stLabel(lang, o.status) + ' · ' + payLabel(lang, o.payment_status) + ' · ' + delivLabel(lang, o.delivery)
  ).join('\n\n');
  return { text: tr(lang, 'ordersTitle') + '\n\n' + body, markup: rows(backRow(lang)) };
}
async function ordersByProfile(tg) {
  const p = await profileOf(tg);
  if (!p) return [];
  return await sbSelect('orders',
    'user_id=eq.' + p.id + '&select=id,city,sum,status,payment_status,delivery,created_at&order=id.desc&limit=10').catch(() => []) || [];
}

async function myResScreen(tg, lang) {
  const list = await sbSelect('reservations',
    'telegram_id=eq.' + tg + '&select=id,product_name,product_id,flavor,qty,kind,status,reserve_date,reserve_time&order=id.desc&limit=10').catch(() => []) || [];
  if (!list.length) return { text: tr(lang, 'resTitle') + '\n\n' + tr(lang, 'resEmpty'), markup: rows(shopRow(lang), backRow(lang)) };
  const body = list.map(r =>
    '№' + r.id + ' · ' + esc(r.product_name || r.product_id) + (r.flavor ? ', ' + esc(r.flavor) : '') + '\n' +
    resLabel(lang, r.status) + (r.reserve_date ? ' · ' + fmtDMY(r.reserve_date) + (r.reserve_time ? ' ' + r.reserve_time : '') : '')
  ).join('\n\n');
  return { text: tr(lang, 'resTitle') + '\n\n' + body, markup: rows(backRow(lang)) };
}

async function myReviewsScreen(tg, lang) {
  const p = await profileOf(tg);
  const list = p ? (await sbSelect('reviews',
    'user_id=eq.' + p.id + '&select=product_name,flavor,stars,body,created_at&order=created_at.desc&limit=10').catch(() => []) || []) : [];
  if (!list.length) return { text: tr(lang, 'reviewsTitle') + '\n\n' + tr(lang, 'reviewsEmpty'), markup: rows(shopRow(lang), backRow(lang)) };
  const body = list.map(r =>
    '<b>' + esc(r.product_name || '') + '</b>' + (r.flavor ? ' · ' + esc(r.flavor) : '') + '\n' +
    '★'.repeat(r.stars || 5) + (r.body ? '\n' + esc(r.body) : '')
  ).join('\n\n');
  return { text: tr(lang, 'reviewsTitle') + '\n\n' + body, markup: rows(backRow(lang)) };
}

function settingsScreen(lang, city) {
  const text = [tr(lang, 'settingsTitle'), '', tr(lang, 'settingsNow', { city: CITY_LABEL[city] || city, lang: LANG_LABEL[lang] })].join('\n');
  return {
    text,
    markup: rows(
      [btn(tr(lang, 'btnCity'), 'c:city'), btn(tr(lang, 'btnLang'), 'c:lang')],
      backRow(lang)
    )
  };
}
function citiesScreen(lang, city) {
  return {
    text: tr(lang, 'chooseCity'),
    markup: rows(
      ...CITIES.map(c => [btn((c === city ? '• ' : '') + CITY_LABEL[c], 'c:city:' + c)]),
      [btn(tr(lang, 'btnBack'), 'c:set')]
    )
  };
}
function langsScreen(lang) {
  return {
    text: tr(lang, 'chooseLang'),
    markup: rows(
      ...LANGS.map(l => [btn((l === lang ? '• ' : '') + LANG_LABEL[l], 'c:lang:' + l)]),
      [btn(tr(lang, 'btnBack'), 'c:set')]
    )
  };
}

// ---- admin access ----
// The admin list changes rarely and jobs read it often, so it is cached briefly.
let adminsCache = { at: 0, rows: [] };
async function adminsList() {
  if (Date.now() - adminsCache.at < 60000) return adminsCache.rows;
  const list = await sbSelect('admins', 'select=telegram_id,role,city').catch(() => null);
  if (list) adminsCache = { at: Date.now(), rows: list };
  return adminsCache.rows;
}
// Owner and developer get everything; a city manager only their own city.
// KV_MANAGER_IDS stays as a fallback for an empty table (first run, network glitch).
async function managersFor(city) {
  const list = await adminsList();
  const ids = (list || [])
    .filter(a => a.role === 'owner' || a.role === 'dev' || (a.role === 'manager' && a.city && a.city === city))
    .map(a => Number(a.telegram_id))
    .filter(Boolean);
  const uniq = [...new Set(ids)];
  return uniq.length ? uniq : MANAGERS;
}
async function adminOf(tgId) {
  const list = await adminsList();
  return (list || []).find(a => Number(a.telegram_id) === Number(tgId)) || null;
}
async function isManager(tgId) {
  if (MANAGERS.includes(Number(tgId))) return true;
  return !!(await adminOf(tgId));
}
async function cityFilterFor(tgId) {
  const me = await adminOf(tgId);
  return me && me.role === 'manager' && me.city ? me.city : null;
}
const cityQuery = city => city ? '&city=eq.' + enc(city) : '';

// ---- admin screens ----

async function adminMenu(tgId, lang) {
  const only = await cityFilterFor(tgId);
  const text = [
    tr(lang, 'admTitle'),
    only ? tr(lang, 'admScope', { city: CITY_LABEL[only] || only }) : tr(lang, 'admScopeAll')
  ].join('\n');
  return {
    text,
    markup: rows(
      [btn(tr(lang, 'admOrders'), 'o:list:0:active'), btn(tr(lang, 'admRes'), 'r:list:0:active')],
      [btn(tr(lang, 'admStats'), 'a:stats'), btn(tr(lang, 'admProducts'), 'a:prod')],
      [btn(tr(lang, 'admUsers'), 'a:users'), btn(tr(lang, 'admReviews'), 'a:revs')],
      [btn(tr(lang, 'admPromo'), 'a:promo'), btn(tr(lang, 'admManagers'), 'a:mgrs')],
      ADMIN_URL ? [{ text: tr(lang, 'admPanel'), web_app: { url: ADMIN_URL } }] : null,
      [btn(tr(lang, 'btnMenu'), 'c:main')]
    )
  };
}
const admBack = lang => [btn(tr(lang, 'btnBack'), 'a:main')];

async function statsScreen(tgId, lang) {
  const only = await cityFilterFor(tgId);
  const c = cityQuery(only);
  const [total, fresh, resActive, resWaiting, profiles, bots, done] = await Promise.all([
    sbCount('orders', c.slice(1)),
    sbCount('orders', 'status=eq.new' + c),
    sbCount('reservations', 'kind=eq.reserve&status=in.(active,notified)' + c),
    sbCount('reservations', 'kind=eq.notify&status=eq.waiting' + c),
    sbCount('profiles', ''),
    sbCount('bot_users', ''),
    sbSelect('orders', 'status=eq.done&select=sum' + c).catch(() => [])
  ]);
  const revenue = (done || []).reduce((s, o) => s + (o.sum || 0), 0);
  const revs = await sbSelect('reviews', 'select=stars').catch(() => []) || [];
  const avg = revs.length ? (revs.reduce((s, r) => s + (r.stars || 0), 0) / revs.length).toFixed(1) : '—';
  const text = [
    tr(lang, 'admStatsTitle', { scope: only ? (CITY_LABEL[only] || only) : tr(lang, 'allCities') }),
    '',
    tr(lang, 'admStatsOrders', { total, fresh }),
    tr(lang, 'admStatsRevenue', { sum: revenue }),
    tr(lang, 'admStatsRes', { active: resActive, waiting: resWaiting }),
    tr(lang, 'admStatsClients', { profiles, bot: bots }),
    tr(lang, 'admStatsReviews', { count: revs.length, avg })
  ].join('\n');
  return { text, markup: rows(admBack(lang)) };
}

async function productsScreen(tgId, lang) {
  const only = (await cityFilterFor(tgId)) || CITIES[0];
  const list = await sbSelect('products', 'city=eq.' + enc(only) + '&select=id,name,flavor,qty').catch(() => []) || [];
  if (!list.length) return { text: tr(lang, 'admProductsNone'), markup: rows(admBack(lang)) };
  const inStock = list.filter(p => (p.qty || 0) > 0).length;
  const low = list.filter(p => (p.qty || 0) > 0 && (p.qty || 0) <= 3)
    .slice(0, 12)
    .map(p => '• ' + esc(p.name || p.id) + (p.flavor ? ', ' + esc(p.flavor) : '') + ' — ' + p.qty);
  const text = [
    tr(lang, 'admProductsTitle', { city: CITY_LABEL[only] || only }),
    '',
    tr(lang, 'admProductsLine', { items: list.length, inStock, out: list.length - inStock }),
    low.length ? '\n' + tr(lang, 'admProductsLow') + '\n' + low.join('\n') : '',
    '\n' + tr(lang, 'admProductsEdit')
  ].filter(Boolean).join('\n');
  return { text, markup: rows(admBack(lang)) };
}

async function usersScreen(tgId, lang) {
  const [profiles, bots, byCity, recent] = await Promise.all([
    sbCount('profiles', ''),
    sbCount('bot_users', ''),
    sbSelect('bot_users', 'select=city').catch(() => []),
    sbSelect('profiles', 'select=display_name,username,created_at&order=created_at.desc&limit=5').catch(() => [])
  ]);
  const counts = {};
  for (const b of byCity || []) if (b.city) counts[b.city] = (counts[b.city] || 0) + 1;
  const cityLines = CITIES.filter(c => counts[c]).map(c => '• ' + CITY_LABEL[c] + ' — ' + counts[c]);
  const recentLines = (recent || []).map(p => '• ' + esc(p.display_name || p.username || '—') + ' · ' + fmtDMY(p.created_at));
  const text = [
    tr(lang, 'admUsersTitle'), '',
    tr(lang, 'admUsersLine', { profiles, bot: bots }),
    cityLines.length ? '\n' + tr(lang, 'admUsersByCity') + '\n' + cityLines.join('\n') : '',
    recentLines.length ? '\n' + tr(lang, 'admUsersRecent') + '\n' + recentLines.join('\n') : ''
  ].filter(Boolean).join('\n');
  return { text, markup: rows(admBack(lang)) };
}

async function reviewsScreen(lang) {
  const list = await sbSelect('reviews', 'select=product_name,flavor,stars,body,author,created_at&order=created_at.desc&limit=8').catch(() => []) || [];
  if (!list.length) return { text: tr(lang, 'admReviewsTitle') + '\n\n' + tr(lang, 'admReviewsNone'), markup: rows(admBack(lang)) };
  const body = list.map(r =>
    '<b>' + esc(r.product_name || '') + '</b>' + (r.flavor ? ' · ' + esc(r.flavor) : '') + ' ' + '★'.repeat(r.stars || 5) + '\n' +
    esc(r.author || '') + (r.body ? ': ' + esc(r.body) : '')
  ).join('\n\n');
  return { text: tr(lang, 'admReviewsTitle') + '\n\n' + body, markup: rows(admBack(lang)) };
}

async function promoScreen(lang) {
  const list = await sbSelect('promo_codes', 'select=code,kind,value,active,used,max_uses,stackable&order=created_at.desc&limit=15').catch(() => []) || [];
  if (!list.length) return { text: tr(lang, 'admPromoTitle') + '\n\n' + tr(lang, 'admPromoNone'), markup: rows(admBack(lang)) };
  const body = list.map(p => {
    const value = p.kind === 'percent' ? p.value + '%' : p.value + ' zł';
    const used = p.used + (p.max_uses ? '/' + p.max_uses : '');
    const flags = [!p.active ? tr(lang, 'admPromoOff') : '', p.stackable === false ? tr(lang, 'admPromoSolo') : ''].filter(Boolean);
    return tr(lang, 'admPromoLine', { code: '<code>' + esc(p.code) + '</code>', value, used }) +
      (flags.length ? ' · ' + flags.join(', ') : '');
  }).join('\n');
  return { text: tr(lang, 'admPromoTitle') + '\n\n' + body, markup: rows(admBack(lang)) };
}

async function managersScreen(lang) {
  const list = await adminsList();
  if (!list || !list.length) return { text: tr(lang, 'admManagersTitle') + '\n\n' + tr(lang, 'admManagersNone'), markup: rows(admBack(lang)) };
  const body = list.map(a =>
    '• <code>' + a.telegram_id + '</code> · ' + roleLabel(lang, a.role) +
    ' · ' + (a.city ? (CITY_LABEL[a.city] || a.city) : tr(lang, 'allCities'))
  ).join('\n');
  return { text: tr(lang, 'admManagersTitle') + '\n\n' + body, markup: rows(admBack(lang)) };
}

// Paged order list: every row is a button leading to the order card.
async function ordersScreen(tgId, lang, page = 0, mode = 'active') {
  const only = await cityFilterFor(tgId);
  const statuses = mode === 'all' ? '' : '&status=in.(new,confirmed)';
  const list = await sbSelect('orders',
    'select=id,city,sum,status,payment_status,contact,created_at' + statuses + cityQuery(only) +
    '&order=id.desc&limit=' + (PAGE + 1) + '&offset=' + (page * PAGE)).catch(() => []) || [];
  const page_ = list.slice(0, PAGE);
  const hasMore = list.length > PAGE;
  const swap = [btn(mode === 'all' ? tr(lang, 'admShowActive') : tr(lang, 'admShowAll'), 'o:list:0:' + (mode === 'all' ? 'active' : 'all'))];

  if (!page_.length) {
    const empty = page ? tr(lang, 'admNoMore') : tr(lang, mode === 'all' ? 'admOrdersNoneAll' : 'admOrdersNone');
    return { text: empty, markup: rows(swap, admBack(lang)) };
  }
  const kb = page_.map(o => {
    const c = o.contact || {};
    return [btn('№' + o.id + ' · ' + (o.sum || 0) + ' zł · ' + stLabel(lang, o.status) +
      (c.name ? ' · ' + String(c.name).split(/\s+/)[0] : ''), 'o:card:' + o.id + ':' + mode)];
  });
  const nav = [];
  if (page > 0) nav.push(btn(tr(lang, 'admPrev'), 'o:list:' + (page - 1) + ':' + mode));
  if (hasMore) nav.push(btn(tr(lang, 'admNext'), 'o:list:' + (page + 1) + ':' + mode));
  const title = tr(lang, mode === 'all' ? 'admOrdersAll' : 'admOrdersActive') + (only ? ' · ' + esc(CITY_LABEL[only] || only) : '');
  return {
    text: title + '\n' + tr(lang, 'admOrdersPick'),
    markup: rows(...kb, nav, swap, admBack(lang))
  };
}

async function orderCard(tgId, lang, id, mode = 'active') {
  const only = await cityFilterFor(tgId);
  const list = await sbSelect('orders', 'id=eq.' + Number(id) +
    '&select=id,city,items,sum,status,payment_status,delivery,address,contact,comment,promo,discount,created_at').catch(() => []);
  const o = list && list[0];
  const back = [btn(tr(lang, 'admToList'), 'o:list:0:' + mode)];
  if (!o) return { text: tr(lang, 'admOrderNotFound'), markup: rows(back) };
  // A manager of another city must not see the card even knowing the number.
  if (only && o.city !== only) return { text: tr(lang, 'admOrderOtherCity'), markup: rows(back) };

  const c = o.contact || {};
  const text = [
    tr(lang, 'admOrderTitle', { id: o.id, city: esc(CITY_LABEL[o.city] || o.city) }),
    tr(lang, 'admOrderStatus', { status: stLabel(lang, o.status), pay: payLabel(lang, o.payment_status) }),
    tr(lang, 'admOrderPlaced', { date: fmtDMY(o.created_at) }),
    '',
    esc(itemsLine(o)),
    '',
    tr(lang, 'admOrderTotal', { sum: o.sum || 0 }) + promoLine(lang, o),
    tr(lang, 'admOrderDeliv', { deliv: esc(delivLine(lang, o)) }),
    o.comment ? tr(lang, 'admOrderComment', { text: esc(o.comment) }) : '',
    (c.name || c.phone) ? '\n' + tr(lang, 'admOrderClient', { who: esc([c.name, c.phone, c.email].filter(Boolean).join(', ')) }) : ''
  ].filter(Boolean).join('\n');

  const acts = [];
  if (o.status === 'new') acts.push(btn(tr(lang, 'admBtnConfirm'), 'o:set:' + o.id + ':confirmed:' + mode));
  if (o.status === 'new' || o.status === 'confirmed') {
    acts.push(btn(tr(lang, 'admBtnDone'), 'o:set:' + o.id + ':done:' + mode));
    acts.push(btn(tr(lang, 'admBtnCancel'), 'o:set:' + o.id + ':cancelled:' + mode));
  }
  return { text, markup: rows(acts.slice(0, 2), acts.slice(2), back) };
}

async function setOrderStatus(tgId, lang, id, status) {
  const only = await cityFilterFor(tgId);
  const list = await sbSelect('orders', 'id=eq.' + Number(id) + '&select=id,city,status').catch(() => []);
  const o = list && list[0];
  if (!o) return tr(lang, 'admOrderNotFound');
  if (only && o.city !== only) return tr(lang, 'admOrderOtherCity');
  if (!['confirmed', 'done', 'cancelled'].includes(status)) return tr(lang, 'admBadStatus');
  try {
    await sbUpdate('orders', 'id=eq.' + Number(id), { status, updated_at: new Date().toISOString() });
    return tr(lang, 'admStatusSet', { id, status: stLabel(lang, status) });
  } catch { return tr(lang, 'admStatusFail'); }
}

async function resScreen(tgId, lang, page = 0, mode = 'active') {
  const only = await cityFilterFor(tgId);
  const filter = mode === 'all' ? '' : '&kind=eq.reserve&status=in.(active,notified)';
  const list = await sbSelect('reservations',
    'select=id,city,product_name,product_id,flavor,qty,kind,status,reserve_date,reserve_time,created_at' + filter + cityQuery(only) +
    '&order=id.desc&limit=' + (PAGE + 1) + '&offset=' + (page * PAGE)).catch(() => []) || [];
  const page_ = list.slice(0, PAGE);
  const hasMore = list.length > PAGE;
  const swap = [btn(mode === 'all' ? tr(lang, 'admShowActive') : tr(lang, 'admShowAll'), 'r:list:0:' + (mode === 'all' ? 'active' : 'all'))];

  if (!page_.length) {
    const empty = page ? tr(lang, 'admNoMore') : tr(lang, mode === 'all' ? 'admResNoneAll' : 'admResNone');
    return { text: empty, markup: rows(swap, admBack(lang)) };
  }
  const kb = page_.map(r => [btn(
    '№' + r.id + ' · ' + String(r.product_name || r.product_id).slice(0, 22) +
    (r.reserve_date ? ' · ' + fmtDMY(r.reserve_date) + (r.reserve_time ? ' ' + r.reserve_time : '') : ' · ' + tr(lang, 'admResRequest')),
    'r:card:' + r.id + ':' + mode)]);
  const nav = [];
  if (page > 0) nav.push(btn(tr(lang, 'admPrev'), 'r:list:' + (page - 1) + ':' + mode));
  if (hasMore) nav.push(btn(tr(lang, 'admNext'), 'r:list:' + (page + 1) + ':' + mode));
  const title = tr(lang, mode === 'all' ? 'admResAll' : 'admResActive') + (only ? ' · ' + esc(CITY_LABEL[only] || only) : '');
  return { text: title + '\n' + tr(lang, 'admResPick'), markup: rows(...kb, nav, swap, admBack(lang)) };
}

async function resCard(tgId, lang, id, mode = 'active') {
  const only = await cityFilterFor(tgId);
  const list = await sbSelect('reservations', 'id=eq.' + Number(id) +
    '&select=id,city,product_name,product_id,flavor,qty,kind,status,reserve_date,reserve_time,comment,created_at,telegram_id,profiles(telegram_username,username,phone)').catch(() => []);
  const r = list && list[0];
  const back = [btn(tr(lang, 'admToList'), 'r:list:0:' + mode)];
  if (!r) return { text: tr(lang, 'admResNotFound'), markup: rows(back) };
  if (only && r.city !== only) return { text: tr(lang, 'admResOtherCity'), markup: rows(back) };

  const p = r.profiles || {};
  const who = p.telegram_username ? '@' + p.telegram_username : (p.username || (r.telegram_id ? 'tg ' + r.telegram_id : ''));
  const text = [
    tr(lang, 'admResTitle', { id: r.id, city: esc(CITY_LABEL[r.city] || r.city) }),
    tr(lang, 'admResItem', { name: esc(r.product_name || r.product_id) + (r.flavor ? ', ' + esc(r.flavor) : ''), qty: r.qty || 1 }),
    tr(lang, 'admOrderStatus', { status: resLabel(lang, r.status), pay: r.kind === 'notify' ? tr(lang, 'admResKindNotify') : '—' }),
    r.reserve_date ? tr(lang, 'admResPickup', { when: fmtDMY(r.reserve_date) + (r.reserve_time ? ' ' + esc(r.reserve_time) : '') }) : '',
    tr(lang, 'admResPlaced', { date: fmtDMY(r.created_at) }),
    r.comment ? tr(lang, 'admOrderComment', { text: esc(r.comment) }) : '',
    (who || p.phone) ? '\n' + tr(lang, 'admOrderClient', { who: esc([who, p.phone].filter(Boolean).join(', ')) }) : ''
  ].filter(Boolean).join('\n');

  const acts = [];
  if (r.kind === 'reserve' && (r.status === 'active' || r.status === 'notified')) {
    acts.push(btn(tr(lang, 'admBtnIssued'), 'r:set:' + r.id + ':done:' + mode));
    acts.push(btn(tr(lang, 'admBtnCancel'), 'r:set:' + r.id + ':cancelled:' + mode));
  }
  return { text, markup: rows(acts, back) };
}

async function setResStatus(tgId, lang, id, status) {
  const only = await cityFilterFor(tgId);
  const list = await sbSelect('reservations', 'id=eq.' + Number(id) + '&select=id,city,status,kind').catch(() => []);
  const r = list && list[0];
  if (!r) return tr(lang, 'admResNotFound');
  if (only && r.city !== only) return tr(lang, 'admResOtherCity');
  if (!['done', 'cancelled'].includes(status)) return tr(lang, 'admBadStatus');
  try {
    // the reservation_stock trigger returns the stock when a reservation is cancelled
    await sbUpdate('reservations', 'id=eq.' + Number(id), { status });
    return tr(lang, 'admResSet', { id, status: resLabel(lang, status) });
  } catch { return tr(lang, 'admResFail'); }
}

// ---- onboarding ----

function sendAgeGate(chat, lang) {
  return sendMessage(chat, tr(lang, 'ageGate'), {
    reply_markup: rows([btn(tr(lang, 'ageYes'), 'age:yes')], [btn(tr(lang, 'ageNo'), 'age:no')])
  });
}
function askStep(chat, step, lang) {
  if (step === 'phone')
    return sendMessage(chat, tr(lang, 'askPhone'), { reply_markup: { keyboard: [[{ text: tr(lang, 'phoneBtn'), request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
  if (step === 'email') return sendMessage(chat, tr(lang, 'askEmail'), { reply_markup: { remove_keyboard: true } });
  if (step === 'city')
    return sendMessage(chat, tr(lang, 'askCity'), { reply_markup: rows(CITIES.map(c => btn(CITY_LABEL[c], 'city:' + c))) });
  if (step === 'paczkomat') return sendMessage(chat, tr(lang, 'askPaczko'), { reply_markup: { remove_keyboard: true } });
  return sendMessage(chat, tr(lang, 'askName'), { reply_markup: { remove_keyboard: true } });
}
async function onboardingAnswer(m, st, lang, text) {
  const chat = m.chat.id, id = m.from.id, step = st.step || 'name';
  if (step === 'name') {
    if (!validName(text)) { await sendMessage(chat, tr(lang, 'badName')); return; }
    await setBotUser(id, { full_name: text.trim(), step: 'phone' });
    await askStep(chat, 'phone', lang); return;
  }
  if (step === 'phone') {
    const phone = normPhone(text);
    if (!validPhone(phone)) { await sendMessage(chat, tr(lang, 'badPhone')); return; }
    await setBotUser(id, { phone, step: 'email' });
    await askStep(chat, 'email', lang); return;
  }
  if (step === 'email') {
    if (!validEmail(text)) { await sendMessage(chat, tr(lang, 'badEmail')); return; }
    await setBotUser(id, { email: text.trim(), step: 'city' });
    await askStep(chat, 'city', lang); return;
  }
  if (step === 'city') { await askStep(chat, 'city', lang); return; }
  if (step === 'paczkomat') {
    const p = normPaczko(text);
    if (!validPaczko(p)) { await sendMessage(chat, tr(lang, 'badPaczko')); return; }
    await setBotUser(id, { paczkomat: p, step: null, onboarding_done: true });
    await sendMessage(chat, tr(lang, 'onbDone'), { reply_markup: { remove_keyboard: true } });
    await showMain(chat, id, lang); return;
  }
}
// Only the person themselves may share their own number.
async function onContact(m, st, lang) {
  const f = m.from || {}, c = m.contact || {}, chat = m.chat.id;
  if (c.user_id && Number(c.user_id) !== Number(f.id)) { await sendMessage(chat, tr(lang, 'phoneForeign')); return; }
  let phone = String(c.phone_number || '').replace(/[^\d+]/g, '');
  if (phone && phone[0] !== '+') phone = '+' + phone;
  if (!phone) { await sendMessage(chat, tr(lang, 'badPhone')); return; }
  if (st && st.age_ok && !st.onboarding_done && st.step === 'phone') {
    await setBotUser(f.id, { phone, step: 'email' });
    await askStep(chat, 'email', lang); return;
  }
  await setBotUser(f.id, { phone });
  try { await sbUpdate('profiles', 'telegram_id=eq.' + f.id, { phone, updated_at: new Date().toISOString() }); } catch {}
  await sendMessage(chat, tr(lang, 'phoneSaved', { phone: esc(phone) }), { reply_markup: { remove_keyboard: true } });
}

// Reservation deep link: t.me/<bot>?start=res_<id>[_<yyyymmdd>]_<city>
async function handleReserveLink(m, rest, lang) {
  const f = m.from || {};
  const parts = rest.split('_');
  let city = 'katowice', dateRaw = null;
  if (parts.length >= 2) {
    city = parts.pop();
    if (parts.length > 1 && /^\d{8}$/.test(parts[parts.length - 1])) dateRaw = parts.pop();
  }
  const pid = parts.join('_');
  let name = pid;
  try {
    const p = await sbSelect('products', 'id=eq.' + enc(pid) + '&select=name&limit=1');
    if (p && p[0] && p[0].name) name = p[0].name;
  } catch {}
  if (dateRaw) {
    const today = warsaw().date;
    let date = dateRaw.slice(0, 4) + '-' + dateRaw.slice(4, 6) + '-' + dateRaw.slice(6, 8);
    if (date < today) date = today;
    if (date > plusDays(today, 7)) date = plusDays(today, 7);
    try {
      await sbInsert('reservations', {
        telegram_id: f.id, city, product_id: pid, product_name: name,
        kind: 'reserve', status: 'active', reserve_date: date,
        confirmed_at: new Date().toISOString()
      });
      await sbRpc('bump_demand', { p_product: pid, p_event: 'reserve' }).catch(() => {});
      await sendMessage(m.chat.id, tr(lang, 'resConfirmed', { name: esc(name), date: fmtDMY(date) }));
    } catch {
      await sendMessage(m.chat.id, tr(lang, 'resFail'));
    }
  } else {
    await sbInsert('reservations', { telegram_id: f.id, city, product_id: pid, product_name: name, kind: 'notify', status: 'waiting' }).catch(() => {});
    await sbRpc('bump_demand', { p_product: pid, p_event: 'reserve' }).catch(() => {});
    await sendMessage(m.chat.id, tr(lang, 'resWaiting', { name: esc(name) }));
  }
}

// ---- routing ----

async function showMain(chat, tgId, lang, city) {
  const c = city || (await botUser(tgId) || {}).city || CITIES[0];
  const scr = mainMenu(lang, c, await isManager(tgId));
  return sendMessage(chat, scr.text, { reply_markup: scr.markup });
}

async function handleUpdate(u) {
  if (u.callback_query) { await handleCallback(u.callback_query).catch(() => {}); return; }
  const m = u.message; if (!m) return;
  if (!(m.chat && m.chat.type === 'private')) return;
  const f = m.from || {};
  let st = await touchUser(f);
  const lang = pickLang((st && st.lang) || f.language_code);

  if (m.contact) { await onContact(m, st, lang).catch(() => {}); return; }
  if (!m.text) return;
  const text = m.text.trim();

  if (text.startsWith('/start')) {
    if (!st || !st.age_ok || !st.onboarding_done) {
      if (await profileComplete(f.id)) {
        await setBotUser(f.id, { age_ok: true, onboarding_done: true, step: null });
        st = Object.assign({}, st, { age_ok: true, onboarding_done: true });
      }
    }
    if (!st || !st.age_ok) { await sendAgeGate(m.chat.id, lang); return; }
    if (!st.onboarding_done) { await sendMessage(m.chat.id, tr(lang, 'resume')); await askStep(m.chat.id, st.step || 'name', lang); return; }
    const param = (m.text.split(' ')[1] || '').trim();
    if (param.startsWith('res_')) { await handleReserveLink(m, param.slice(4), lang); return; }
    if (param === 'phone') { await askStep(m.chat.id, 'phone', lang); return; }
    await showMain(m.chat.id, f.id, lang, st.city); return;
  }

  if (text === '/menu') {
    if (!st || !st.age_ok) { await sendAgeGate(m.chat.id, lang); return; }
    await showMain(m.chat.id, f.id, lang, st.city); return;
  }
  if (text === '/admin' || text === '/orders' || text === '/reserves' || text === '/res') {
    if (!(await isManager(f.id))) return;
    const scr = text === '/orders' ? await ordersScreen(f.id, lang, 0, 'active')
      : (text === '/admin' ? await adminMenu(f.id, lang) : await resScreen(f.id, lang, 0, 'active'));
    await sendMessage(m.chat.id, scr.text, { reply_markup: scr.markup });
    return;
  }

  if (!st || !st.age_ok) { await sendAgeGate(m.chat.id, lang); return; }
  if (!st.onboarding_done) { await onboardingAnswer(m, st, lang, text); return; }
  await showMain(m.chat.id, f.id, lang, st.city);
}

async function handleCallback(q) {
  const f = q.from || {};
  const data = q.data || '';
  const chat = q.message && q.message.chat && q.message.chat.id;
  const mid = q.message && q.message.message_id;
  if (!chat) return;
  // Screens that report a result answer the callback themselves: Telegram ignores a
  // second answer, and the manager would never see what changed.
  const selfAnswer = /^[or]:set:/.test(data);
  if (!selfAnswer) await answerCallback(q.id).catch(() => {});

  const st = await touchUser(f);
  const lang = pickLang((st && st.lang) || f.language_code);
  const city = (st && st.city) || CITIES[0];
  const show = scr => editMessage(chat, mid, scr.text, { reply_markup: scr.markup });

  if (data === 'age:no') { await sendMessage(chat, tr(lang, 'ageDenied')); return; }
  if (data === 'age:yes') {
    if (st && st.onboarding_done) { await showMain(chat, f.id, lang, city); return; }
    await setBotUser(f.id, { age_ok: true, step: 'name' });
    await sendMessage(chat, tr(lang, 'onbIntro'));
    await askStep(chat, 'name', lang);
    return;
  }
  if (data.startsWith('city:')) {
    if (!st || st.step !== 'city') return;
    const c = data.slice(5);
    if (!CITIES.includes(c)) return;
    await setBotUser(f.id, { city: c, step: 'paczkomat' });
    await askStep(chat, 'paczkomat', lang);
    return;
  }

  if (data.startsWith('c:')) {
    const [, screen, arg] = data.split(':');
    if (screen === 'main') return void await show(mainMenu(lang, city, await isManager(f.id)));
    if (screen === 'orders') return void await show(await myOrdersScreen(f.id, lang));
    if (screen === 'res') return void await show(await myResScreen(f.id, lang));
    if (screen === 'reviews') return void await show(await myReviewsScreen(f.id, lang));
    if (screen === 'set') return void await show(settingsScreen(lang, city));
    if (screen === 'city') {
      if (!arg) return void await show(citiesScreen(lang, city));
      if (!CITIES.includes(arg)) return;
      await setBotUser(f.id, { city: arg });
      await sbUpdate('profiles', 'telegram_id=eq.' + f.id, { city: arg, updated_at: new Date().toISOString() }).catch(() => {});
      await answerCallback(q.id, tr(lang, 'cityChanged', { city: CITY_LABEL[arg] })).catch(() => {});
      return void await show(settingsScreen(lang, arg));
    }
    if (screen === 'lang') {
      if (!arg) return void await show(langsScreen(lang));
      if (!LANGS.includes(arg)) return;
      await setBotUser(f.id, { lang: arg });
      await answerCallback(q.id, tr(arg, 'langChanged')).catch(() => {});
      return void await show(settingsScreen(arg, city));
    }
    return;
  }

  if (data.startsWith('a:')) {
    if (!(await isManager(f.id))) { await answerCallback(q.id, tr(lang, 'admNoAccess'), true).catch(() => {}); return; }
    const screen = data.split(':')[1];
    if (screen === 'main') return void await show(await adminMenu(f.id, lang));
    if (screen === 'stats') return void await show(await statsScreen(f.id, lang));
    if (screen === 'prod') return void await show(await productsScreen(f.id, lang));
    if (screen === 'users') return void await show(await usersScreen(f.id, lang));
    if (screen === 'revs') return void await show(await reviewsScreen(lang));
    if (screen === 'promo') return void await show(await promoScreen(lang));
    if (screen === 'mgrs') return void await show(await managersScreen(lang));
    return;
  }

  if (data.startsWith('o:') || data.startsWith('r:')) {
    if (!(await isManager(f.id))) { await answerCallback(q.id, tr(lang, 'admNoAccess'), true).catch(() => {}); return; }
    const [kindPrefix, action, a, b, c] = data.split(':');
    const isOrder = kindPrefix === 'o';
    if (action === 'list') {
      return void await show(isOrder
        ? await ordersScreen(f.id, lang, Number(a) || 0, b || 'active')
        : await resScreen(f.id, lang, Number(a) || 0, b || 'active'));
    }
    if (action === 'card') {
      return void await show(isOrder ? await orderCard(f.id, lang, a, b || 'active') : await resCard(f.id, lang, a, b || 'active'));
    }
    if (action === 'set') {
      const note = isOrder ? await setOrderStatus(f.id, lang, a, b) : await setResStatus(f.id, lang, a, b);
      await answerCallback(q.id, note);
      return void await show(isOrder ? await orderCard(f.id, lang, a, c || 'active') : await resCard(f.id, lang, a, c || 'active'));
    }
  }
}

async function tgLoop() {
  await deleteWebhook().catch(() => {});
  let offset = 0;
  console.log('bot: long polling');
  for (;;) {
    try {
      const r = await getUpdates(offset, 25);
      if (r && r.ok && r.result) for (const u of r.result) { offset = u.update_id + 1; handleUpdate(u).catch(() => {}); }
      else if (r && r.ok === false) await sleep(2000);
    } catch { await sleep(3000); }
  }
}

// ---- background jobs ----

async function confirmReservations() {
  const list = await sbSelect('reservations',
    'kind=eq.reserve&confirmed_at=is.null&select=id,product_name,reserve_date,reserve_time,telegram_id,profiles(telegram_id)').catch(() => []);
  for (const r of list || []) {
    const tg = r.telegram_id || (r.profiles && r.profiles.telegram_id);
    const when = fmtDMY(r.reserve_date) + (r.reserve_time ? ' ' + r.reserve_time : '');
    if (tg) { const lang = await langOf(tg); await sendMessage(tg, tr(lang, 'resConfirmed', { name: esc(r.product_name), date: when })).catch(() => {}); }
    await sbUpdate('reservations', 'id=eq.' + r.id, { confirmed_at: new Date().toISOString() }).catch(() => {});
  }
}

async function dayReminders() {
  const w = warsaw();
  if (w.hour < 10) return;
  const list = await sbSelect('reservations',
    'kind=eq.reserve&status=eq.active&day_notified_at=is.null&reserve_date=eq.' + w.date +
    '&select=id,product_name,city,telegram_id,profiles(telegram_id)').catch(() => []);
  for (const r of list || []) {
    const tg = r.telegram_id || (r.profiles && r.profiles.telegram_id);
    if (tg) { const lang = await langOf(tg); await sendMessage(tg, tr(lang, 'resReminder', { name: esc(r.product_name) })).catch(() => {}); }
    await sbUpdate('reservations', 'id=eq.' + r.id, { day_notified_at: new Date().toISOString(), status: 'notified' }).catch(() => {});
  }
}

async function expireReservations() {
  const w = warsaw();
  await sbUpdate('reservations',
    'kind=eq.reserve&status=in.(active,notified)&reserve_date=lt.' + w.date,
    { status: 'expired' }).catch(() => {});
}

async function remindManagers() {
  const w = warsaw();
  const nowMin = w.hour * 60 + w.minute;
  const list = await sbSelect('reservations',
    'kind=eq.reserve&status=in.(active,notified)&manager_reminded_at=is.null&reserve_time=not.is.null&reserve_date=eq.' + w.date +
    '&select=id,product_name,reserve_time,city,telegram_id,profiles(telegram_username,username)').catch(() => []);
  for (const r of list || []) {
    const [rh, rm] = String(r.reserve_time).split(':').map(Number);
    if (nowMin < (rh || 0) * 60 + (rm || 0) - 60) continue;
    const p = r.profiles || {};
    const who = p.telegram_username ? '@' + p.telegram_username : (p.username || '');
    for (const mid of await managersFor(r.city)) {
      const lang = await langOf(mid);
      await sendMessage(mid, tr(lang, 'admResSoon', {
        name: esc(r.product_name), time: esc(r.reserve_time),
        city: esc(CITY_LABEL[r.city] || r.city), who: who ? ', ' + esc(who) : ''
      })).catch(() => {});
    }
    await sbUpdate('reservations', 'id=eq.' + r.id, { manager_reminded_at: new Date().toISOString() }).catch(() => {});
  }
}

async function notifyOrders() {
  // pending (card checkout started but unpaid) is not shown to managers: only cash on
  // pickup (unpaid) and orders already paid online (paid).
  const list = await sbSelect('orders',
    'manager_notified_at=is.null&payment_status=in.(unpaid,paid)&select=id,city,items,sum,delivery,address,contact,comment,promo,discount,payment_status,payment_provider,profiles(username,telegram_username,telegram_id)').catch(() => []);
  for (const o of list || []) {
    const c = o.contact || {};
    const p = o.profiles || {};
    const who = [c.name, c.phone, c.email].filter(Boolean).join('\n');
    const tgLine = p.telegram_username ? '@' + p.telegram_username : (p.telegram_id ? 'tg ' + p.telegram_id : (p.username || ''));
    for (const mid of await managersFor(o.city)) {
      const lang = await langOf(mid);
      const text = [
        tr(lang, 'admNewOrder', { id: o.id, city: esc(CITY_LABEL[o.city] || o.city) }),
        '',
        esc(itemsLine(o)),
        '',
        tr(lang, 'admOrderTotal', { sum: o.sum || 0 }) + promoLine(lang, o),
        o.payment_status === 'paid'
          ? tr(lang, 'admPaidOnline', { provider: esc(o.payment_provider || 'stripe') })
          : tr(lang, 'admPayOnPickup'),
        tr(lang, 'admOrderDeliv', { deliv: esc(delivLine(lang, o)) }),
        o.comment ? tr(lang, 'admOrderComment', { text: esc(o.comment) }) : '',
        who ? '\n' + tr(lang, 'admOrderClient', { who: esc(who) }) : '',
        tgLine ? 'Telegram: ' + esc(tgLine) : ''
      ].filter(Boolean).join('\n');
      await sendMessage(mid, text).catch(() => {});
    }
    await sbUpdate('orders', 'id=eq.' + o.id, { manager_notified_at: new Date().toISOString() }).catch(() => {});
  }
}

async function notifyOrderStatus() {
  // PostgREST cannot compare one column with another, so already-notified rows cannot be
  // filtered away in the query. Without a limit this would scan the whole order history
  // every ten seconds, so only the recent tail is read.
  const list = await sbSelect('orders',
    'status=in.(confirmed,done,cancelled)&select=id,status,client_notified_status,profiles(telegram_id)' +
    '&order=id.desc&limit=200').catch(() => []);
  for (const o of list || []) {
    if (o.client_notified_status === o.status) continue;
    const tg = o.profiles && o.profiles.telegram_id;
    if (tg) {
      const lang = await langOf(tg);
      let text, extra = {};
      if (o.status === 'confirmed') text = tr(lang, 'statusConfirmed', { id: o.id });
      else if (o.status === 'done') {
        text = tr(lang, 'statusDone', { id: o.id });
        if (MINIAPP_URL) extra = { reply_markup: rows([{ text: tr(lang, 'reviewBtn'), web_app: { url: MINIAPP_URL + (MINIAPP_URL.includes('?') ? '&' : '?') + 'review=' + o.id } }]) };
      } else text = tr(lang, 'statusCancelled', { id: o.id });
      await sendMessage(tg, text, extra).catch(() => {});
    }
    await sbUpdate('orders', 'id=eq.' + o.id, { client_notified_status: o.status }).catch(() => {});
  }
}

async function notifyAccepted() {
  const list = await sbSelect('orders',
    'payment_status=eq.unpaid&client_notified_accepted=is.false&select=id,telegram_id,profiles(telegram_id)').catch(() => []);
  for (const o of list || []) {
    const tg = o.telegram_id || (o.profiles && o.profiles.telegram_id);
    if (tg) { const lang = await langOf(tg); await sendMessage(tg, tr(lang, 'orderAccepted', { id: o.id })).catch(() => {}); }
    await sbUpdate('orders', 'id=eq.' + o.id, { client_notified_accepted: true }).catch(() => {});
  }
}
async function notifyPaid() {
  const list = await sbSelect('orders',
    'payment_status=eq.paid&client_notified_paid=is.false&select=id,telegram_id,profiles(telegram_id)').catch(() => []);
  for (const o of list || []) {
    const tg = o.telegram_id || (o.profiles && o.profiles.telegram_id);
    if (tg) { const lang = await langOf(tg); await sendMessage(tg, tr(lang, 'orderPaid', { id: o.id })).catch(() => {}); }
    await sbUpdate('orders', 'id=eq.' + o.id, { client_notified_paid: true }).catch(() => {});
  }
}

async function doBroadcasts() {
  const list = await sbSelect('broadcasts', 'status=eq.pending&select=id,text,photo,city&order=id.asc').catch(() => []);
  for (const b of list || []) {
    // Claim the row with status=pending. An unconditional PATCH meant two running bot
    // instances both considered it theirs and sent the same broadcast twice.
    const claimed = await sbClaim('broadcasts', 'id=eq.' + b.id + '&status=eq.pending', { status: 'sending' }).catch(() => null);
    if (!claimed || !claimed.length) continue;
    const users = await sbSelect('bot_users', 'select=telegram_id' + (b.city ? '&city=eq.' + enc(b.city) : '')).catch(() => []);
    let sent = 0, failed = 0, photoWarned = false;
    for (const u of users || []) {
      // Telegram sometimes rejects a photo (too small, broken) — then at least send the text.
      let r = b.photo ? await sendPhoto(u.telegram_id, b.photo, b.text) : null;
      if (!r || !r.ok) {
        if (b.photo && r && !r.ok && !photoWarned) { photoWarned = true; console.error('broadcast: photo rejected -', r.description || r.error); }
        r = await sendMessage(u.telegram_id, b.text);
      }
      if (r && r.ok) sent++; else failed++;
      await sleep(60);
    }
    await sbUpdate('broadcasts', 'id=eq.' + b.id, { status: 'done', sent, failed, sent_at: new Date().toISOString() }).catch(() => {});
  }
}

async function doSyncJobs() {
  const jobs = await sbSelect('sync_jobs', 'status=eq.pending&select=id&order=id.asc').catch(() => []);
  for (const j of jobs || []) {
    try {
      const n = await syncSheets();
      await notifyRestocks();
      await sbUpdate('sync_jobs', 'id=eq.' + j.id, { status: 'done', rows: n, done_at: new Date().toISOString() }).catch(() => {});
    } catch (e) {
      await sbUpdate('sync_jobs', 'id=eq.' + j.id, { status: 'error', message: String(e.message || e), done_at: new Date().toISOString() }).catch(() => {});
    }
  }
}

async function syncSheets() {
  if (!SHEETS) throw new Error('KV_SHEETS_CSV is not set');
  const res = await fetch(SHEETS, { redirect: 'follow' });
  if (!res.ok) throw new Error('sheets ' + res.status);
  const table = parseCSV(await res.text());
  if (table.length < 2) return 0;
  const head = table[0].map(h => h.trim().toLowerCase()), ix = n => head.indexOf(n);
  const col = { city: ix('city'), category: ix('category'), id: ix('id'), name: ix('name'), brand: ix('brand'), flavor: ix('flavor'), price: ix('price'), qty: ix('qty'), nic: ix('nic') };
  const batch = [];
  for (let r = 1; r < table.length; r++) {
    const row = table[r], g = k => col[k] >= 0 ? (row[col[k]] || '').trim() : '', id = g('id');
    if (!id) continue;
    batch.push({ id, city: g('city') || 'katowice', category: g('category'), name: g('name'), brand: g('brand'), flavor: g('flavor'), price: Number(g('price')) || null, qty: Number(g('qty')) || 0, nic: g('nic'), updated_at: new Date().toISOString() });
  }
  if (batch.length) {
    // The hit marker and tier prices are set in the panel and are absent from the sheet.
    // An upsert rewrites the whole row, so without carrying them over every sync reset
    // hit to false and tiers to null: the manager ticked the box and it vanished by itself.
    const keep = await sbSelect('products', 'select=id,city,hit,tiers&limit=10000').catch(() => null);
    if (keep) {
      const own = {};
      for (const r of keep) {
        const k = r.id + '::' + r.city;
        const o = own[k] || (own[k] = { hit: false, tiers: null });
        if (r.hit) o.hit = true;
        if (r.tiers && r.tiers.length) o.tiers = r.tiers;
      }
      for (const b of batch) {
        const o = own[b.id + '::' + b.city];
        if (o) { b.hit = o.hit; b.tiers = o.tiers; }
      }
    }
    await sbUpsert('products', batch, 'id,city,flavor');
  }
  return batch.length;
}

async function notifyRestocks() {
  const list = await sbRpc('restock_list').catch(() => []);
  for (const r of list || []) {
    if (r.telegram_id) {
      const lang = await langOf(r.telegram_id);
      await sendMessage(r.telegram_id, tr(lang, 'restock', { name: esc(r.product_name) })).catch(() => {});
    }
    await sbUpdate('reservations', 'id=eq.' + r.id, { status: 'notified', notified_at: new Date().toISOString() }).catch(() => {});
  }
}

// Host metrics Postgres cannot see. The developer section of the dashboard reads the last
// beat, so a stale timestamp is itself the signal that the bot is down.
const BOT_VERSION = '3.1';
const STARTED_AT = new Date().toISOString();
async function heartbeat() {
  const mb = Math.round(process.memoryUsage().rss / 1048576);
  await sbUpsert('bot_heartbeat', [{
    id: 1, version: BOT_VERSION, started_at: STARTED_AT,
    beat_at: new Date().toISOString(), rss_mb: mb, node: process.version
  }], 'id').catch(() => {});
}

async function jobsLoop() {
  for (;;) {
    try {
      await confirmReservations();
      await dayReminders();
      await remindManagers();
      await expireReservations();
      await notifyOrders();
      await notifyOrderStatus();
      await notifyAccepted();
      await notifyPaid();
      await doBroadcasts();
      await doSyncJobs();
      await notifyRestocks();
      await heartbeat();
    } catch {}
    await sleep(JOBS_MS);
  }
}

if (!(BOT_TOKEN && SUPA && KEY)) {
  console.error('bot.mjs needs TELEGRAM_BOT_TOKEN, SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}
console.log('KatoVape bot started, managers: ' + MANAGERS.join(', '));
if (MINIAPP_URL) setMenuButton(MINIAPP_URL).then(r => console.log('menuButton:', r && r.ok ? 'ok' : JSON.stringify(r)));
tgLoop();
jobsLoop();
