// KatoVape bot для прода (режим Supabase). ЧИСТО бот: никакого http-сервера.
// Poll Telegram (getUpdates) + poll Supabase (pending рассылки/синк) + уведомления о
// поступлении. Данные — в Supabase (service_role), сервер ничего веб-facing не держит.
// env: TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY, MINIAPP_URL, KV_SHEETS_CSV
import { BOT_TOKEN, sendMessage, getUpdates, deleteWebhook, setMenuButton } from './tg.mjs';

const SUPA = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const MINIAPP_URL = process.env.MINIAPP_URL || '';
const SHEETS = process.env.KV_SHEETS_CSV || '';
const JOBS_MS = Number(process.env.KV_JOBS_MS || 10000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---- Supabase REST (PostgREST) под service_role ----
async function sb(method, path, body, extra) {
  const res = await fetch(SUPA + '/rest/v1/' + path, {
    method, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', ...(extra || {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  if (!res.ok) throw new Error('supabase ' + res.status + ' ' + txt.slice(0, 200));
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}
const sbSelect = (t, q) => sb('GET', t + (q ? '?' + q : ''));
const sbInsert = (t, row) => sb('POST', t, row, { Prefer: 'return=minimal' });
const sbUpdate = (t, q, patch) => sb('PATCH', t + '?' + q, patch, { Prefer: 'return=minimal' });
const sbUpsert = (t, rows, onConflict) => sb('POST', t + (onConflict ? '?on_conflict=' + onConflict : ''), rows, { Prefer: 'resolution=merge-duplicates,return=minimal' });
const sbRpc = (fn, args) => sb('POST', 'rpc/' + fn, args || {});

// ---- разбор CSV Google Sheets ----
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
  if (param.startsWith('res_')) {
    const rest = param.slice(4), i = rest.lastIndexOf('_');
    const pid = i > 0 ? rest.slice(0, i) : rest, city = i > 0 ? rest.slice(i + 1) : 'katowice';
    let name = pid;
    try { const p = await sbSelect('products', 'id=eq.' + encodeURIComponent(pid) + '&select=name&limit=1'); if (p && p[0] && p[0].name) name = p[0].name; } catch {}
    await sbInsert('reservations', { telegram_id: f.id, city, product_id: pid, product_name: name }).catch(() => {});
    await sbRpc('bump_demand', { p_product: pid, p_event: 'reserve' }).catch(() => {});
    await sendMessage(m.chat.id, `✅ Бронь принята: <b>${esc(name)}</b>. Сообщим, как только появится в наличии.`);
    return;
  }
  const kb = MINIAPP_URL ? { reply_markup: { inline_keyboard: [[{ text: '🛍 Открыть магазин', web_app: { url: MINIAPP_URL } }]] } } : {};
  await sendMessage(m.chat.id, 'Привет! Это <b>KatoVape</b>. Открывай магазин кнопкой ниже, выбирай вкус, оформляй заказ и бронь — уведомим, когда товар появится.', kb);
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
// ---- задания из админки: синк ассортимента + уведомления по броням ----
async function doSyncJobs() {
  const jobs = await sbSelect('sync_jobs', 'status=eq.pending&select=id&order=id.asc').catch(() => []);
  for (const j of jobs || []) {
    try { const n = await syncSheets(); await notifyRestocks(); await sbUpdate('sync_jobs', 'id=eq.' + j.id, { status: 'done', rows: n, done_at: new Date().toISOString() }).catch(() => {}); }
    catch (e) { await sbUpdate('sync_jobs', 'id=eq.' + j.id, { status: 'error', message: String(e.message || e), done_at: new Date().toISOString() }).catch(() => {}); }
  }
}
async function syncSheets() {
  if (!SHEETS) throw new Error('KV_SHEETS_CSV не задан');
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
async function notifyRestocks() {
  const list = await sbRpc('restock_list').catch(() => []);
  for (const r of list || []) {
    if (r.telegram_id) await sendMessage(r.telegram_id, `🔔 <b>${esc(r.product_name)}</b> снова в наличии! Заходи в магазин.`);
    await sbUpdate('reservations', 'id=eq.' + r.id, { status: 'notified', notified_at: new Date().toISOString() }).catch(() => {});
  }
}
async function jobsLoop() { for (;;) { try { await doBroadcasts(); await doSyncJobs(); } catch {} await sleep(JOBS_MS); } }

// ---- старт ----
if (!(BOT_TOKEN && SUPA && KEY)) {
  console.error('bot.mjs: нужны TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY в .env');
  process.exit(1);
}
console.log('KatoVape bot (Supabase) стартовал');
if (MINIAPP_URL) setMenuButton(MINIAPP_URL).then(r => console.log('menuButton:', r && r.ok ? 'ok' : JSON.stringify(r)));
tgLoop();
jobsLoop();
