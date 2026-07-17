// KatoVape backend: авторизация, бронь, заказы, админка, приём Telegram-вебхука.
// Чистый Node (http + node:sqlite + node:crypto), плюс fetch к Bot API. Без сборки.
// Ключевые env: TELEGRAM_BOT_TOKEN, PUBLIC_URL (https-адрес этого API), MINIAPP_URL,
// WEBHOOK_SECRET, KV_ADMIN_IDS, KV_SHEETS_CSV, PORT. Всё опционально для локали.
import { createServer } from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db.mjs';
import { BOT_TOKEN, verifyWidget, verifyInitData, sendMessage, setWebhook, deleteWebhook, getUpdates, setMenuButton } from './tg.mjs';
import * as sheets from './sheets.mjs';

const PORT = process.env.PORT || 8790;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const MINIAPP_URL = process.env.MINIAPP_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'kv_hook';
const BOT_MODE = process.env.KV_BOT_MODE || 'poll';   // poll (по умолчанию, без домена/nginx) | webhook
const ADMIN_IDS = new Set((process.env.KV_ADMIN_IDS || '5301671230').split(',').map(s => Number(s.trim())).filter(Boolean));
const ALLOW_DEMO_TG = !BOT_TOKEN;   // без токена бота разрешаем демо-вход (локальный показ)

// ---- пароли ----
function hashPass(pw) { const s = randomBytes(16); return s.toString('hex') + ':' + scryptSync(pw, s, 64).toString('hex'); }
function verifyPass(pw, stored) {
  if (!stored) return false;
  const [s, h] = stored.split(':'); const hh = scryptSync(pw, Buffer.from(s, 'hex'), 64), hb = Buffer.from(h, 'hex');
  return hh.length === hb.length && timingSafeEqual(hh, hb);
}
const newToken = () => randomBytes(32).toString('hex');
const normPhone = s => (s || '').replace(/[^\d+]/g, '');

// ---- запросы ----
const Q = {
  user: db.prepare('select * from users where id = ?'),
  byName: db.prepare('select * from users where username = ? collate nocase'),
  byEmail: db.prepare('select * from users where email = ? collate nocase'),
  byPhone: db.prepare('select * from users where phone = ?'),
  byTg: db.prepare('select * from users where telegram_id = ?'),
  insUser: db.prepare(`insert into users (username, email, phone, pass_hash, telegram_id, telegram_username, display_name, avatar)
                       values (?, ?, ?, ?, ?, ?, ?, ?)`),
  insSession: db.prepare('insert into sessions (token, user_id) values (?, ?)'),
  session: db.prepare('select * from sessions where token = ?'),
  delSession: db.prepare('delete from sessions where token = ?'),
  setAvatar: db.prepare('update users set avatar = ? where id = ?'),
  setName: db.prepare('update users set display_name = ? where id = ?'),
  botUser: db.prepare(`insert into bot_users (telegram_id, username, first_name, lang) values (?, ?, ?, ?)
                       on conflict(telegram_id) do update set username=excluded.username, opted_in=1`),
  botUserList: db.prepare('select telegram_id from bot_users where opted_in = 1'),
  insRes: db.prepare(`insert into reservations (user_id, telegram_id, city, product_id, product_name, flavor)
                      values (?, ?, ?, ?, ?, ?)`),
  resByUser: db.prepare('select * from reservations where user_id = ? order by id desc'),
  resNotify: db.prepare(`update reservations set status='notified', notified_at=datetime('now') where id = ?`),
  insOrder: db.prepare(`insert into orders (user_id, telegram_id, city, items, sum, delivery, address) values (?, ?, ?, ?, ?, ?, ?)`),
  ordersByUser: db.prepare('select * from orders where user_id = ? order by id desc'),
  ordersAll: db.prepare('select * from orders order by id desc limit 200'),
  usersAll: db.prepare('select id, username, email, phone, telegram_id, telegram_username, display_name, created_at from users order by id desc limit 500'),
  insBroadcast: db.prepare('insert into broadcasts (author_id, text, audience) values (?, ?, ?)'),
  bumpDemand: db.prepare(`insert into demand (product_id, event, n) values (?, ?, 1)
                          on conflict(product_id, event) do update set n = n + 1`),
  demandTop: db.prepare('select product_id, event, n from demand order by n desc limit 100')
};

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, email: u.email, phone: u.phone, telegram_id: u.telegram_id,
    telegram_username: u.telegram_username, display_name: u.display_name, avatar: u.avatar,
    created_at: u.created_at, is_admin: !!(u.telegram_id && ADMIN_IDS.has(u.telegram_id)) };
}
function startSession(uid) { const t = newToken(); Q.insSession.run(t, uid); return t; }
function userFromAuth(req) {
  const h = req.headers['authorization'] || ''; const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!t) return null; const s = Q.session.get(t); return s ? Q.user.get(s.user_id) : null;
}
function isAdmin(u) { return !!(u && u.telegram_id && ADMIN_IDS.has(u.telegram_id)); }

// upsert телеграм-пользователя (для входа) — общий для widget/initdata/demo
function upsertTgUser(tgu) {
  let u = Q.byTg.get(tgu.id);
  if (!u) {
    const info = Q.insUser.run('tg_' + tgu.id, null, null, null, tgu.id, tgu.username || null,
      tgu.first_name || tgu.username || ('tg_' + tgu.id), tgu.photo_url || null);
    u = Q.user.get(info.lastInsertRowid);
  } else if (tgu.photo_url && !u.avatar) { Q.setAvatar.run(tgu.photo_url, u.id); u = Q.user.get(u.id); }
  return u;
}

// ---- http ----
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const send = (res, code, obj) => res.writeHead(code, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(obj));
function readBody(req) { return new Promise(r => { let d = ''; req.on('data', c => { d += c; if (d.length > 2e7) req.destroy(); }); req.on('end', () => { try { r(d ? JSON.parse(d) : {}); } catch { r({}); } }); }); }

async function route(req, res) {
  const url = new URL(req.url, 'http://x'), path = url.pathname, M = req.method;
  if (M === 'OPTIONS') return res.writeHead(204, CORS).end();
  if (path === '/health') return send(res, 200, { ok: true, bot: !!BOT_TOKEN, sheets: sheets.configured() });

  // ---------- Telegram webhook ----------
  if (path === '/tg/webhook/' + WEBHOOK_SECRET && M === 'POST') {
    if (BOT_TOKEN && req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) return send(res, 401, {});
    const upd = await readBody(req);
    handleUpdate(upd).catch(() => {});
    return send(res, 200, { ok: true });
  }

  // ---------- auth ----------
  if (path === '/auth/availability' && M === 'POST') {
    const b = await readBody(req);
    return send(res, 200, {
      username_taken: !!(b.username && Q.byName.get(b.username)),
      email_taken: !!(b.email && Q.byEmail.get(b.email)),
      phone_taken: !!(b.phone && Q.byPhone.get(normPhone(b.phone)))
    });
  }
  if (path === '/auth/register' && M === 'POST') {
    const b = await readBody(req);
    const username = (b.username || '').trim(), password = b.password || '';
    const email = (b.email || '').trim().toLowerCase() || null, phone = normPhone(b.phone) || null;
    if (username.length < 3) return send(res, 400, { error: 'errUser' });
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) return send(res, 400, { error: 'errUserChars' });
    if (password.length < 6) return send(res, 400, { error: 'errPass' });
    if (Q.byName.get(username)) return send(res, 409, { error: 'takenUser' });
    if (email && Q.byEmail.get(email)) return send(res, 409, { error: 'takenEmail' });
    if (phone && Q.byPhone.get(phone)) return send(res, 409, { error: 'takenPhone' });
    let info; try { info = Q.insUser.run(username, email, phone, hashPass(password), null, null, username, null); }
    catch { return send(res, 409, { error: 'takenUser' }); }
    return send(res, 200, { token: startSession(info.lastInsertRowid), user: publicUser(Q.user.get(info.lastInsertRowid)) });
  }
  if (path === '/auth/login' && M === 'POST') {
    const b = await readBody(req); const id = (b.identifier || '').trim(), password = b.password || '';
    if (!id || !password) return send(res, 400, { error: 'errEmpty' });
    const u = Q.byName.get(id) || Q.byEmail.get(id.toLowerCase()) || Q.byPhone.get(normPhone(id));
    if (!u || !verifyPass(password, u.pass_hash)) return send(res, 401, { error: 'badCreds' });
    return send(res, 200, { token: startSession(u.id), user: publicUser(u) });
  }
  // Вход через Telegram: проверяем подпись бот-токеном. Демо (без подписи) — только когда токена нет.
  if (path === '/auth/telegram' && M === 'POST') {
    const b = await readBody(req);
    let tgu = null;
    if (b.mode === 'widget') tgu = verifyWidget(b.payload);
    else if (b.mode === 'initdata') tgu = verifyInitData(b.initData);
    else if ((b.mode === 'demo' || b.id) && ALLOW_DEMO_TG) { const s = b.payload || b; tgu = { id: Number(s.id), username: s.username, first_name: s.first_name, photo_url: s.photo_url }; }
    if (!tgu || !tgu.id) return send(res, 401, { error: 'tgFail' });
    const u = upsertTgUser(tgu);
    return send(res, 200, { token: startSession(u.id), user: publicUser(u) });
  }
  if (path === '/auth/me' && M === 'GET') { const u = userFromAuth(req); return send(res, u ? 200 : 401, u ? { user: publicUser(u) } : { error: 'noAuth' }); }
  if (path === '/auth/avatar' && M === 'POST') {
    const u = userFromAuth(req); if (!u) return send(res, 401, { error: 'noAuth' });
    const b = await readBody(req); if (typeof b.avatar === 'string' && b.avatar.length > 900000) return send(res, 413, { error: 'avatarBig' });
    Q.setAvatar.run(b.avatar || null, u.id); return send(res, 200, { user: publicUser(Q.user.get(u.id)) });
  }
  if (path === '/auth/name' && M === 'POST') {
    const u = userFromAuth(req); if (!u) return send(res, 401, { error: 'noAuth' });
    const b = await readBody(req); Q.setName.run((b.name || '').trim() || u.username, u.id); return send(res, 200, { user: publicUser(Q.user.get(u.id)) });
  }
  if (path === '/auth/logout' && M === 'POST') { const h = req.headers['authorization'] || ''; if (h.startsWith('Bearer ')) Q.delSession.run(h.slice(7)); return send(res, 200, { ok: true }); }

  // ---------- бронь ----------
  if (path === '/reservations' && M === 'POST') {
    const u = userFromAuth(req); if (!u) return send(res, 401, { error: 'noAuth' });
    const b = await readBody(req); if (!b.product_id) return send(res, 400, { error: 'bad' });
    Q.insRes.run(u.id, u.telegram_id || null, b.city || 'katowice', b.product_id, b.product_name || '', b.flavor || '');
    Q.bumpDemand.run(b.product_id, 'reserve');
    if (u.telegram_id) sendMessage(u.telegram_id, `✅ Бронь принята: <b>${esc(b.product_name || b.product_id)}</b>${b.flavor ? ' — ' + esc(b.flavor) : ''}. Сообщим, как появится в наличии.`);
    return send(res, 200, { ok: true });
  }
  if (path === '/reservations' && M === 'GET') { const u = userFromAuth(req); if (!u) return send(res, 401, { error: 'noAuth' }); return send(res, 200, { items: Q.resByUser.all(u.id) }); }

  // ---------- заказы ----------
  if (path === '/orders' && M === 'POST') {
    const u = userFromAuth(req); if (!u) return send(res, 401, { error: 'noAuth' });
    const b = await readBody(req);
    Q.insOrder.run(u.id, u.telegram_id || null, b.city || 'katowice', JSON.stringify(b.items || []), Number(b.sum) || 0, b.delivery || 'pickup', b.address || '');
    (b.items || []).forEach(() => {}); Q.bumpDemand.run('_orders', 'order');
    return send(res, 200, { ok: true });
  }
  if (path === '/orders' && M === 'GET') { const u = userFromAuth(req); if (!u) return send(res, 401, { error: 'noAuth' }); return send(res, 200, { items: Q.ordersByUser.all(u.id) }); }

  // трекинг спроса (просмотр товара)
  if (path === '/track' && M === 'POST') { const b = await readBody(req); if (b.product_id && b.event) Q.bumpDemand.run(b.product_id, String(b.event).slice(0, 12)); return send(res, 200, { ok: true }); }

  // каталог из БД (источник для брони/будущей витрины на БД)
  if (path === '/catalog' && M === 'GET') {
    const city = url.searchParams.get('city') || 'katowice';
    return send(res, 200, { items: db.prepare('select * from products where city = ? order by category, name').all(city) });
  }

  // ---------- админка (только для telegram_id из allowlist) ----------
  if (path.startsWith('/admin/')) {
    const u = userFromAuth(req);
    if (!isAdmin(u)) return send(res, 403, { error: 'forbidden' });
    if (path === '/admin/overview') {
      const c = t => db.prepare('select count(*) n from ' + t).get().n;
      return send(res, 200, { users: c('users'), orders: c('orders'), reservations: c('reservations'),
        bot_users: c('bot_users'), waiting: db.prepare("select count(*) n from reservations where status='waiting'").get().n });
    }
    if (path === '/admin/orders') return send(res, 200, { items: Q.ordersAll.all().map(o => ({ ...o, items: safeJson(o.items) })) });
    if (path === '/admin/customers') return send(res, 200, { items: Q.usersAll.all() });
    if (path === '/admin/demand') return send(res, 200, { items: Q.demandTop.all() });
    if (path === '/admin/reservations') return send(res, 200, { items: db.prepare('select * from reservations order by id desc limit 300').all() });
    if (path === '/admin/broadcast' && M === 'POST') {
      const b = await readBody(req); const text = (b.text || '').trim(); if (!text) return send(res, 400, { error: 'empty' });
      Q.insBroadcast.run(u.id, text, b.audience || 'all');
      broadcast(text).then(r => {}); return send(res, 200, { ok: true, queued: Q.botUserList.all().length });
    }
    if (path === '/admin/sync' && M === 'POST') {
      try { const r = await sheets.syncSheets(); await notifyRestocks(); return send(res, 200, { ok: true, ...r }); }
      catch (e) { return send(res, 500, { error: String(e.message || e) }); }
    }
    return send(res, 404, { error: 'not found' });
  }

  return send(res, 404, { error: 'not found' });
}

const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const safeJson = s => { try { return JSON.parse(s); } catch { return []; } };

// ---- бот: входящие апдейты ----
const qProdName = db.prepare('select name from products where id = ? limit 1');
async function handleUpdate(upd) {
  const msg = upd.message;
  if (msg && msg.text && msg.text.startsWith('/start')) {
    const from = msg.from || {};
    Q.botUser.run(from.id, from.username || null, from.first_name || null, from.language_code || null);
    const param = (msg.text.split(' ')[1] || '').trim();
    // диплинк брони из мини-аппа: /start res_<productId>_<city>
    if (param.startsWith('res_')) {
      const rest = param.slice(4), i = rest.lastIndexOf('_');
      const pid = i > 0 ? rest.slice(0, i) : rest, city = i > 0 ? rest.slice(i + 1) : 'katowice';
      const p = qProdName.get(pid);
      Q.insRes.run(null, from.id, city, pid, (p && p.name) || pid, '');
      Q.bumpDemand.run(pid, 'reserve');
      await sendMessage(msg.chat.id, `✅ Бронь принята: <b>${esc((p && p.name) || pid)}</b>. Сообщим, как только появится в наличии.`);
      return;
    }
    const kb = MINIAPP_URL ? { inline_keyboard: [[{ text: '🛍 Открыть магазин', web_app: { url: MINIAPP_URL } }]] } : undefined;
    await sendMessage(msg.chat.id,
      'Привет! Это <b>KatoVape</b>. Открывай магазин кнопкой ниже, выбирай вкус, оформляй заказ и бронь — уведомим, когда товар появится.',
      kb ? { reply_markup: kb } : {});
  }
}

// ---- long polling: бот работает без домена и вебхука (только он на сервере) ----
async function pollLoop() {
  try { await deleteWebhook(); } catch (e) {}
  let offset = 0;
  console.log('бот: long polling');
  for (;;) {
    try {
      const r = await getUpdates(offset, 25);
      if (r && r.ok && r.result) for (const u of r.result) { offset = u.update_id + 1; handleUpdate(u).catch(() => {}); }
      else if (r && r.ok === false) await new Promise(res => setTimeout(res, 2000));
    } catch (e) { await new Promise(res => setTimeout(res, 3000)); }
  }
}

// ---- рассылка ----
async function broadcast(text) {
  const users = Q.botUserList.all(); let sent = 0, failed = 0;
  for (const u of users) {
    const r = await sendMessage(u.telegram_id, text);
    r && r.ok ? sent++ : failed++;
    await new Promise(r => setTimeout(r, 60));   // троттлинг под лимит Telegram
  }
  return { sent, failed };
}

// ---- уведомления о поступлении по брони ----
async function notifyRestocks() {
  const list = sheets.reservationsNowInStock ? sheets.reservationsNowInStock() : [];
  for (const r of list) {
    if (r.telegram_id) await sendMessage(r.telegram_id,
      `🔔 <b>${esc(r.product_name || r.product_id)}</b>${r.flavor ? ' — ' + esc(r.flavor) : ''} снова в наличии! Заходи в магазин.`);
    Q.resNotify.run(r.id);
  }
  return list.length;
}

// ---- старт ----
// API слушает только localhost — наружу его не выставляем, нет nginx/домена, сайт не трогаем
const server = createServer((req, res) => { route(req, res).catch(() => send(res, 500, { error: 'server' })); });
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'Порт ' + PORT + ' занят.' : e.message); process.exit(1); });
server.listen(PORT, process.env.KV_BIND || '127.0.0.1', async () => {
  console.log('KatoVape :' + PORT + (BOT_TOKEN ? ' (бот подключён)' : ' (без токена — бот спит)'));
  if (!BOT_TOKEN) return;
  if (MINIAPP_URL) { const m = await setMenuButton(MINIAPP_URL); console.log('menuButton:', m && m.ok ? 'ok' : JSON.stringify(m)); }
  if (BOT_MODE === 'webhook' && PUBLIC_URL) {
    const r = await setWebhook(`${PUBLIC_URL}/tg/webhook/${WEBHOOK_SECRET}`, WEBHOOK_SECRET);
    console.log('setWebhook:', r && r.ok ? 'ok' : JSON.stringify(r));
  } else {
    pollLoop();   // по умолчанию — long polling, домен не нужен
  }
});
