// Проверка боевой базы публичным ключом: то, что закрыто в миграциях, должно быть закрыто
// и в облаке. Набор в test/security.test.mjs читает исходники и не знает, накатаны ли они.
//
// Скрипт ходит тем же ключом, который и так лежит в странице витрины. Пробы на запись бьют
// по заведомо несуществующим строкам (город и товар «__probe__»), поэтому даже дыра в правах
// не испортит настоящие данные, а оставит заметный след.
//
// ВАЖНО про чтение: при включённом RLS PostgREST отвечает 200 и пустым списком, а не
// отказом. Поэтому смотрим на тело, а не на код ответа: 200 с пустым списком означает
// «строк не видно», и это ровно то, что нужно. Проверка по одному коду ответа объявила бы
// утечкой нормально закрытую таблицу.
//
//   node tools/security-live.mjs
import { readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const cfg = readFileSync(new URL('shared/config.js', ROOT), 'utf8');
const URL_ = (cfg.match(/SUPABASE_URL:\s*'([^']+)'/) || [])[1];
const KEY = (cfg.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/) || [])[1];
if (!URL_ || !KEY) { console.error('в shared/config.js нет адреса или публичного ключа'); process.exit(2); }

const base = URL_.replace(/\/$/, '');
const H = { apikey: KEY };
const JH = { ...H, 'Content-Type': 'application/json' };
const out = [];

async function call(path, opts) {
  const r = await fetch(base + '/rest/v1/' + path, { headers: H, ...opts });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* не json, оставляем как есть */ }
  return { status: r.status, text: text.slice(0, 200), json };
}
const add = (what, ok, note) => out.push({ what, ok, note });

// Закрыто = отказ или пустой список. Открыто = хоть одна строка в ответе.
async function mustBeEmpty(what, path) {
  const r = await call(path);
  const rows = Array.isArray(r.json) ? r.json.length : (r.json == null ? 0 : 1);
  const denied = r.status === 401 || r.status === 403 || r.status === 404;
  add(what, denied || rows === 0, denied ? 'отказ ' + r.status : 'строк видно: ' + rows);
}
async function mustReturnRows(what, path) {
  const r = await call(path);
  const rows = Array.isArray(r.json) ? r.json.length : 0;
  add(what, rows > 0, 'строк: ' + rows + (rows ? '' : ' (' + r.status + ' ' + r.text.slice(0, 60) + ')'));
}
// Запись считаем отбитой, если сервер отказал или не тронул ни одной строки.
async function mustNotWrite(what, path, method, body) {
  const r = await call(path, { method, headers: { ...JH, Prefer: 'return=representation' }, body: JSON.stringify(body) });
  const wrote = Array.isArray(r.json) ? r.json.length : (r.status < 300 && r.json ? 1 : 0);
  add(what, r.status >= 400 || wrote === 0,
    r.status >= 400 ? 'отказ ' + r.status : 'записано строк: ' + wrote);
}
async function rpcMustBeEmpty(what, name, body) {
  const r = await call('rpc/' + name, { method: 'POST', headers: JH, body: JSON.stringify(body || {}) });
  const empty = r.status >= 400 || r.json === null || (Array.isArray(r.json) && r.json.length === 0);
  add(what, empty, r.status >= 400 ? 'отказ ' + r.status : 'ответ: ' + r.text.slice(0, 60));
}

/* ---- витрина обязана работать ---- */
await mustReturnRows('каталог читается без входа', 'products?select=id&limit=1');
await mustReturnRows('настройки вкусов читаются без входа', 'flavor_meta?select=product_id&limit=1');

/* ---- чужие данные не видны ---- */
await mustBeEmpty('закупочная цена закрыта', 'products?select=cost&limit=1');
for (const [what, t] of [
  ['профили клиентов', 'profiles'], ['заказы', 'orders'], ['брони', 'reservations'],
  ['карточки клиентов', 'contacts'], ['заметки о клиентах', 'contact_notes'],
  ['список админов', 'admins'], ['роли админов', 'admin_users'],
  ['промокоды', 'promo_codes'], ['партии товара', 'batches'], ['расходы', 'expenses'],
  ['ставки менеджеров', 'manager_rates'], ['журнал изменений', 'audit_log'],
  ['отзывы с привязкой к людям', 'reviews'], ['подписчики бота', 'bot_users'],
  ['рассылки', 'broadcasts'], ['движение товара', 'stock_moves'], ['списания', 'write_offs']
]) await mustBeEmpty(what + ': не видны анониму', t + '?select=*&limit=1');

/* ---- запись отбивается ---- */
await mustNotWrite('аноним не заводит заказ', 'orders', 'POST',
  { city: '__probe__', items: [], sum: 1, delivery: 'pickup' });
await mustNotWrite('аноним не вписывает себя в админы', 'admins', 'POST', { telegram_id: 1 });
// Проба по настоящей строке, иначе ноль изменённых строк ничего не доказывает: его вернёт
// и дыра, если строки под фильтр не подошло. Пишем полю его же значение, поэтому даже
// пропущенная запись ничего не меняет, а ответ покажет, что править дали.
{
  const one = await call('products?select=id,city,flavor&limit=1');
  const p = Array.isArray(one.json) && one.json[0];
  if (p) {
    await mustNotWrite('аноним не правит каталог',
      'products?id=eq.' + encodeURIComponent(p.id) + '&city=eq.' + encodeURIComponent(p.city) +
      '&flavor=eq.' + encodeURIComponent(p.flavor), 'PATCH', { id: p.id });
  } else add('аноним не правит каталог', false, 'каталог пуст, проверить нечем');

  const fm = await call('flavor_meta?select=product_id,flavor&limit=1');
  const f = Array.isArray(fm.json) && fm.json[0];
  if (f) {
    await mustNotWrite('аноним не правит настройки вкуса',
      'flavor_meta?product_id=eq.' + encodeURIComponent(f.product_id) +
      '&flavor=eq.' + encodeURIComponent(f.flavor), 'PATCH', { product_id: f.product_id });
  } else add('аноним не правит настройки вкуса', false, 'настроек вкуса нет, проверить нечем');
}
await mustNotWrite('аноним не заводит промокод', 'promo_codes', 'POST',
  { code: '__PROBE__', kind: 'percent', value: 99 });

/* ---- служебные функции ---- */
await rpcMustBeEmpty('сводка панели закрыта', 'admin_overview');
await rpcMustBeEmpty('список клиентов закрыт', 'crm_contacts', { p_query: null, p_limit: 1 });
for (const [what, name, body] of [
  ['проверка промокода закрыта', 'promo_check', { p_code: 'TEST', p_city: 'katowice', p_sum: 100 }],
  ['поиск логина закрыт', 'resolve_login', { p_login: 'test' }],
  ['занятость логина закрыта', 'login_availability', { p_login: 'test' }],
  ['выручка закрыта', 'dash_kpi', { p_from: '2020-01-01', p_to: '2030-01-01' }],
  ['список броней для бота закрыт', 'restock_list', {}]
]) {
  const r = await call('rpc/' + name, { method: 'POST', headers: JH, body: JSON.stringify(body) });
  add(what, r.status >= 400, r.status >= 400 ? 'отказ ' + r.status : 'ответил: ' + r.text.slice(0, 60));
}

/* ---- хранилище картинок ---- */
{
  const r = await fetch(base + '/storage/v1/object/flavors/__probe__.jpg', {
    method: 'POST', headers: { ...H, 'Content-Type': 'image/jpeg' },
    body: new Blob([new Uint8Array([255, 216, 255, 217])])
  });
  add('аноним не заливает картинку', r.status >= 400, 'ответ ' + r.status);
}

const bad = out.filter((x) => !x.ok);
for (const r of out) console.log((r.ok ? '  ok   ' : ' ДЫРА  ') + r.what.padEnd(46) + r.note);
console.log('\nпроверок: ' + out.length + ', прошло: ' + (out.length - bad.length) + ', провалено: ' + bad.length);
if (bad.length) {
  console.error('\nБоевая база отвечает не так, как задумано. Разберитесь до выкладки.');
  process.exit(1);
}
console.log('боевая база отвечает так, как описано в миграциях');
