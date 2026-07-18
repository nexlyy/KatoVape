// KatoVape bot для прода (режим Supabase). ЧИСТО бот: никакого http-сервера.
// Poll Telegram (getUpdates) + poll Supabase: подтверждение броней, напоминание
// в 10:00 по Варшаве в день выдачи, просрочка брони (остаток вернёт триггер),
// заказы менеджеру, статусы клиенту, рассылки, уведомления о поступлении.
// env: TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY, MINIAPP_URL,
//      KV_MANAGER_IDS (через запятую, по умолчанию владелец), KV_SHEETS_CSV (опц.)
import { BOT_TOKEN, sendMessage, getUpdates, deleteWebhook, setMenuButton } from './tg.mjs';

const SUPA = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const MINIAPP_URL = process.env.MINIAPP_URL || '';
const SHEETS = process.env.KV_SHEETS_CSV || '';
const JOBS_MS = Number(process.env.KV_JOBS_MS || 10000);
const MANAGERS = (process.env.KV_MANAGER_IDS || '5301671230').split(',').map(s => +s.trim()).filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---- Supabase REST (PostgREST) под service_role ----
async function sb(method, path, body, extra) {
  const res = await fetch(SUPA + '/rest/v1/' + path, {
    method, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'User-Agent': 'katovape-bot/2.0', ...(extra || {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  if (!res.ok) throw new Error('supabase ' + res.status + ' ' + txt.slice(0, 200));
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}
const sbSelect = (t, q) => sb('GET', t + (q ? '?' + q : ''));
const sbInsert = (t, row) => sb('POST', t, row, { Prefer: 'return=representation' });
const sbUpdate = (t, q, patch) => sb('PATCH', t + '?' + q, patch, { Prefer: 'return=minimal' });
const sbUpsert = (t, rows, onConflict) => sb('POST', t + (onConflict ? '?on_conflict=' + onConflict : ''), rows, { Prefer: 'resolution=merge-duplicates,return=minimal' });
const sbRpc = (fn, args) => sb('POST', 'rpc/' + fn, args || {});

// ---- время по Варшаве: дата и час, чтобы напоминать ровно с 10:00 ----
function warsaw() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit'
  }).formatToParts(new Date());
  const g = t => (parts.find(x => x.type === t) || {}).value || '';
  return { date: g('year') + '-' + g('month') + '-' + g('day'), hour: +g('hour') };
}
function plusDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---- разбор CSV Google Sheets (опциональный синк, если задан KV_SHEETS_CSV) ----
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

// ---- входящие Telegram-апдейты ----
async function handleUpdate(u) {
  const m = u.message; if (!m || !m.text) return;
  if (!m.text.startsWith('/start')) return;
  const f = m.from || {};
  await sbUpsert('bot_users', { telegram_id: f.id, username: f.username || null, first_name: f.first_name || null, lang: f.language_code || null, opted_in: true }, 'telegram_id').catch(() => {});
  const param = (m.text.split(' ')[1] || '').trim();
  if (param.startsWith('res_')) { await handleReserveLink(m, param.slice(4)); return; }
  const kb = MINIAPP_URL ? { reply_markup: { inline_keyboard: [[{ text: '🛍 Открыть магазин', web_app: { url: MINIAPP_URL } }]] } } : {};
  await sendMessage(m.chat.id, 'Привет! Это <b>KatoVape</b>. Открывай магазин кнопкой ниже, выбирай вкус, оформляй заказ или бронь. О брони напомним в день выдачи.', kb);
}

// бронь по диплинку: res_<id>_<город> (старый вид, заявка на поступление)
// или res_<id>_<ггггммдд>_<город> (бронь на дату из витрины)
async function handleReserveLink(m, rest) {
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
    const p = await sbSelect('products', 'id=eq.' + encodeURIComponent(pid) + '&select=name&limit=1');
    if (p && p[0] && p[0].name) name = p[0].name;
  } catch {}
  if (dateRaw) {
    // бронь на дату: зажимаем в окно сегодня..+7 по Варшаве
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
      await sendMessage(m.chat.id, 'Вы сделали бронь: <b>' + esc(name) + '</b>.\nНапомним в 10:00 в день выдачи (' + date + ').');
    } catch (e) {
      await sendMessage(m.chat.id, 'Не получилось оформить бронь, напишите менеджеру.');
    }
  } else {
    await sbInsert('reservations', { telegram_id: f.id, city, product_id: pid, product_name: name, kind: 'notify', status: 'waiting' }).catch(() => {});
    await sbRpc('bump_demand', { p_product: pid, p_event: 'reserve' }).catch(() => {});
    await sendMessage(m.chat.id, 'Заявка принята: <b>' + esc(name) + '</b>. Сообщим, как только появится в наличии.');
  }
}
async function tgLoop() {
  await deleteWebhook().catch(() => {});
  let offset = 0;
  console.log('бот: long polling');
  for (;;) {
    try {
      const r = await getUpdates(offset, 25);
      if (r && r.ok && r.result) for (const u of r.result) { offset = u.update_id + 1; handleUpdate(u).catch(() => {}); }
      else if (r && r.ok === false) await sleep(2000);
    } catch { await sleep(3000); }
  }
}

// ---- бронь из витрины: бот подтверждает в личку ----
async function confirmReservations() {
  const list = await sbSelect('reservations',
    'kind=eq.reserve&confirmed_at=is.null&select=id,product_name,reserve_date,telegram_id,profiles(telegram_id)').catch(() => []);
  for (const r of list || []) {
    const tg = r.telegram_id || (r.profiles && r.profiles.telegram_id);
    if (tg) await sendMessage(tg, 'Вы сделали бронь: <b>' + esc(r.product_name) + '</b>.\nНапомним в 10:00 в день выдачи (' + (r.reserve_date || '') + ').').catch(() => {});
    await sbUpdate('reservations', 'id=eq.' + r.id, { confirmed_at: new Date().toISOString() }).catch(() => {});
  }
}

// ---- в день брони с 10:00 по Варшаве шлём забронированный вкус ----
async function dayReminders() {
  const w = warsaw();
  if (w.hour < 10) return;
  const list = await sbSelect('reservations',
    'kind=eq.reserve&status=eq.active&day_notified_at=is.null&reserve_date=eq.' + w.date +
    '&select=id,product_name,city,telegram_id,profiles(telegram_id)').catch(() => []);
  for (const r of list || []) {
    const tg = r.telegram_id || (r.profiles && r.profiles.telegram_id);
    if (tg) await sendMessage(tg, '🔔 Сегодня день вашей брони: <b>' + esc(r.product_name) + '</b>. Ждём вас за покупкой!').catch(() => {});
    await sbUpdate('reservations', 'id=eq.' + r.id, { day_notified_at: new Date().toISOString(), status: 'notified' }).catch(() => {});
  }
}

// ---- просроченные брони: дата прошла, товар не забрали ----
// статус expired, остаток вернёт триггер в базе (это и есть «отказ от покупки»)
async function expireReservations() {
  const w = warsaw();
  await sbUpdate('reservations',
    'kind=eq.reserve&status=in.(active,notified)&reserve_date=lt.' + w.date,
    { status: 'expired' }).catch(() => {});
}

// ---- новый заказ: сообщение менеджеру ----
async function notifyOrders() {
  const list = await sbSelect('orders',
    'manager_notified_at=is.null&select=id,city,items,sum,delivery,address,contact,profiles(username,telegram_username,telegram_id)').catch(() => []);
  for (const o of list || []) {
    const items = (o.items || []).map((x, i) =>
      (i + 1) + ') ' + (typeof x === 'string' ? x : (x.name || x.id) + (x.flavor ? ', ' + x.flavor : '') + ' x' + (x.n || 1) + (x.sum ? ' = ' + x.sum + ' zl' : ''))).join('\n');
    const c = o.contact || {};
    const p = o.profiles || {};
    const who = [c.name, c.phone, c.email].filter(Boolean).join('\n');
    const tgLine = p.telegram_username ? '@' + p.telegram_username : (p.telegram_id ? 'tg id ' + p.telegram_id : (p.username || ''));
    const deliv = (o.delivery || '') + (o.address ? ', ' + o.address : '');
    const text = '🛒 <b>Новый заказ #' + o.id + '</b> (' + esc(o.city) + ')\n' + esc(items) +
      '\nИтого: <b>' + (o.sum || 0) + ' zł</b>\nПолучение: ' + esc(deliv) +
      (who ? '\n\nКлиент:\n' + esc(who) : '') + (tgLine ? '\nTelegram: ' + esc(tgLine) : '');
    for (const mid of MANAGERS) await sendMessage(mid, text).catch(() => {});
    await sbUpdate('orders', 'id=eq.' + o.id, { manager_notified_at: new Date().toISOString() }).catch(() => {});
  }
}

// ---- смена статуса заказа: сообщение клиенту ----
async function notifyOrderStatus() {
  const list = await sbSelect('orders',
    'status=in.(confirmed,done,cancelled)&select=id,status,client_notified_status,profiles(telegram_id)').catch(() => []);
  for (const o of list || []) {
    if (o.client_notified_status === o.status) continue;
    const tg = o.profiles && o.profiles.telegram_id;
    if (tg) {
      const text = o.status === 'confirmed' ? '✅ Заказ #' + o.id + ' подтверждён менеджером.'
        : o.status === 'done' ? '📦 Заказ #' + o.id + ' выдан. Спасибо за покупку! Теперь на купленные вкусы можно оставить отзыв в приложении.'
        : '❌ Заказ #' + o.id + ' отменён. Если это ошибка, напишите менеджеру.';
      await sendMessage(tg, text).catch(() => {});
    }
    await sbUpdate('orders', 'id=eq.' + o.id, { client_notified_status: o.status }).catch(() => {});
  }
}

// ---- задания из админки: рассылки ----
async function doBroadcasts() {
  const list = await sbSelect('broadcasts', 'status=eq.pending&select=id,text&order=id.asc').catch(() => []);
  for (const b of list || []) {
    await sbUpdate('broadcasts', 'id=eq.' + b.id, { status: 'sending' }).catch(() => {});
    const users = await sbSelect('bot_users', 'opted_in=eq.true&select=telegram_id').catch(() => []);
    let sent = 0, failed = 0;
    for (const u of users || []) { const r = await sendMessage(u.telegram_id, b.text); r && r.ok ? sent++ : failed++; await sleep(60); }
    await sbUpdate('broadcasts', 'id=eq.' + b.id, { status: 'done', sent, failed, sent_at: new Date().toISOString() }).catch(() => {});
  }
}
// ---- задания из админки: синк ассортимента из Sheets (опционально) ----
async function doSyncJobs() {
  const jobs = await sbSelect('sync_jobs', 'status=eq.pending&select=id&order=id.asc').catch(() => []);
  for (const j of jobs || []) {
    try { const n = await syncSheets(); await notifyRestocks(); await sbUpdate('sync_jobs', 'id=eq.' + j.id, { status: 'done', rows: n, done_at: new Date().toISOString() }).catch(() => {}); }
    catch (e) { await sbUpdate('sync_jobs', 'id=eq.' + j.id, { status: 'error', message: String(e.message || e), done_at: new Date().toISOString() }).catch(() => {}); }
  }
}
async function syncSheets() {
  if (!SHEETS) throw new Error('KV_SHEETS_CSV не задан (ассортимент правится в админке)');
  const res = await fetch(SHEETS, { redirect: 'follow' }); if (!res.ok) throw new Error('sheets ' + res.status);
  const rows = parseCSV(await res.text()); if (rows.length < 2) return 0;
  const head = rows[0].map(h => h.trim().toLowerCase()), ix = n => head.indexOf(n);
  const c = { city: ix('city'), category: ix('category'), id: ix('id'), name: ix('name'), brand: ix('brand'), flavor: ix('flavor'), price: ix('price'), qty: ix('qty'), nic: ix('nic') };
  const batch = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r], g = k => c[k] >= 0 ? (row[c[k]] || '').trim() : '', id = g('id'); if (!id) continue;
    batch.push({ id, city: g('city') || 'katowice', category: g('category'), name: g('name'), brand: g('brand'), flavor: g('flavor'), price: Number(g('price')) || null, qty: Number(g('qty')) || 0, nic: g('nic'), updated_at: new Date().toISOString() });
  }
  if (batch.length) await sbUpsert('products', batch, 'id,city,flavor');
  return batch.length;
}
// ---- «сообщить о поступлении»: товар снова в наличии ----
async function notifyRestocks() {
  const list = await sbRpc('restock_list').catch(() => []);
  for (const r of list || []) {
    if (r.telegram_id) await sendMessage(r.telegram_id, '🔔 <b>' + esc(r.product_name) + '</b> снова в наличии! Заходи в магазин.');
    await sbUpdate('reservations', 'id=eq.' + r.id, { status: 'notified', notified_at: new Date().toISOString() }).catch(() => {});
  }
}
async function jobsLoop() {
  for (;;) {
    try {
      await confirmReservations();
      await dayReminders();
      await expireReservations();
      await notifyOrders();
      await notifyOrderStatus();
      await doBroadcasts();
      await doSyncJobs();
      await notifyRestocks();
    } catch {}
    await sleep(JOBS_MS);
  }
}

// ---- старт ----
if (!(BOT_TOKEN && SUPA && KEY)) {
  console.error('bot.mjs: нужны TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY в .env');
  process.exit(1);
}
console.log('KatoVape bot (Supabase) стартовал, менеджеры: ' + MANAGERS.join(', '));
if (MINIAPP_URL) setMenuButton(MINIAPP_URL).then(r => console.log('menuButton:', r && r.ok ? 'ok' : JSON.stringify(r)));
tgLoop();
jobsLoop();
