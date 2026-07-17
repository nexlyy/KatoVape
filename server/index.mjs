// KatoVape: локальный бэкенд регистрации для демо.
// Чистый Node (http + node:sqlite + node:crypto), без npm-зависимостей и сборки.
// Запуск: node index.mjs  (порт 8790).
// Это ДЕМО-сервер. В проде тот же контракт закрывает Supabase (см. AUTH_SETUP.md),
// а вход через Telegram проверяется подписью бот-токена на сервере.
import { createServer } from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db.mjs';

const PORT = process.env.PORT || 8790;
// кому открыта админка (Telegram ID). Совпадает со списком в shared/config.js.
const ADMIN_IDS = new Set([5301671230]);

// ---- пароли: scrypt + соль ----
function hashPass(pw) {
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, 64);
  return salt.toString('hex') + ':' + h.toString('hex');
}
function verifyPass(pw, stored) {
  if (!stored) return false;
  const [s, h] = stored.split(':');
  const hh = scryptSync(pw, Buffer.from(s, 'hex'), 64);
  const hb = Buffer.from(h, 'hex');
  return hh.length === hb.length && timingSafeEqual(hh, hb);
}
const newToken = () => randomBytes(32).toString('hex');
const normPhone = s => (s || '').replace(/[^\d+]/g, '');

// ---- доступ к данным ----
const qUser = db.prepare('select * from users where id = ?');
const qByName = db.prepare('select * from users where username = ? collate nocase');
const qByEmail = db.prepare('select * from users where email = ? collate nocase');
const qByPhone = db.prepare('select * from users where phone = ?');
const qByTg = db.prepare('select * from users where telegram_id = ?');
const insUser = db.prepare(
  `insert into users (username, email, phone, pass_hash, telegram_id, telegram_username, display_name, avatar)
   values (?, ?, ?, ?, ?, ?, ?, ?)`);
const insSession = db.prepare('insert into sessions (token, user_id) values (?, ?)');
const qSession = db.prepare('select * from sessions where token = ?');
const delSession = db.prepare('delete from sessions where token = ?');
const setAvatar = db.prepare('update users set avatar = ? where id = ?');
const setName = db.prepare('update users set display_name = ? where id = ?');

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, email: u.email, phone: u.phone,
    telegram_id: u.telegram_id, telegram_username: u.telegram_username,
    display_name: u.display_name, avatar: u.avatar, created_at: u.created_at,
    is_admin: !!(u.telegram_id && ADMIN_IDS.has(u.telegram_id))
  };
}
function startSession(userId) {
  const token = newToken();
  insSession.run(token, userId);
  return token;
}
function userFromAuth(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const s = qSession.get(token);
  if (!s) return null;
  return qUser.get(s.user_id);
}

// ---- http-хелперы ----
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
const send = (res, code, obj) =>
  res.writeHead(code, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(obj));
function readBody(req) {
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 1e7) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
}

// ---- маршруты ----
async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;

  if (req.method === 'OPTIONS') return res.writeHead(204, CORS).end();

  if (path === '/health') return send(res, 200, { ok: true });

  if (path === '/auth/availability' && req.method === 'POST') {
    const b = await readBody(req);
    return send(res, 200, {
      username_taken: !!(b.username && qByName.get(b.username)),
      email_taken: !!(b.email && qByEmail.get(b.email)),
      phone_taken: !!(b.phone && qByPhone.get(normPhone(b.phone)))
    });
  }

  if (path === '/auth/register' && req.method === 'POST') {
    const b = await readBody(req);
    const username = (b.username || '').trim();
    const password = b.password || '';
    const email = (b.email || '').trim().toLowerCase() || null;
    const phone = normPhone(b.phone) || null;
    if (username.length < 3) return send(res, 400, { error: 'errUser' });
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) return send(res, 400, { error: 'errUserChars' });
    if (password.length < 6) return send(res, 400, { error: 'errPass' });
    if (qByName.get(username)) return send(res, 409, { error: 'takenUser' });
    if (email && qByEmail.get(email)) return send(res, 409, { error: 'takenEmail' });
    if (phone && qByPhone.get(phone)) return send(res, 409, { error: 'takenPhone' });
    let info;
    try {
      info = insUser.run(username, email, phone, hashPass(password), null, null, username, null);
    } catch (e) {
      return send(res, 409, { error: 'takenUser' });  // гонка по уникальному индексу
    }
    const token = startSession(info.lastInsertRowid);
    return send(res, 200, { token, user: publicUser(qUser.get(info.lastInsertRowid)) });
  }

  if (path === '/auth/login' && req.method === 'POST') {
    const b = await readBody(req);
    const id = (b.identifier || '').trim();
    const password = b.password || '';
    if (!id || !password) return send(res, 400, { error: 'errEmpty' });
    const u = qByName.get(id) || qByEmail.get(id.toLowerCase()) || qByPhone.get(normPhone(id));
    if (!u || !verifyPass(password, u.pass_hash)) return send(res, 401, { error: 'badCreds' });
    const token = startSession(u.id);
    return send(res, 200, { token, user: publicUser(u) });
  }

  // Вход через Telegram. ДЕМО: доверяем полям как есть. В проде Edge Function
  // проверяет подпись бот-токеном (widget=SHA256, initData=HMAC WebAppData).
  if (path === '/auth/telegram' && req.method === 'POST') {
    const b = await readBody(req);
    const tgId = Number(b.id);
    if (!tgId) return send(res, 400, { error: 'tgFail' });
    let u = qByTg.get(tgId);
    if (!u) {
      const uname = 'tg_' + tgId;
      const info = insUser.run(uname, null, null, null, tgId, b.username || null,
        b.first_name || b.username || uname, b.photo_url || null);
      u = qUser.get(info.lastInsertRowid);
    } else if (b.photo_url && !u.avatar) {
      setAvatar.run(b.photo_url, u.id); u = qUser.get(u.id);
    }
    const token = startSession(u.id);
    return send(res, 200, { token, user: publicUser(u) });
  }

  if (path === '/auth/me' && req.method === 'GET') {
    const u = userFromAuth(req);
    return send(res, u ? 200 : 401, u ? { user: publicUser(u) } : { error: 'noAuth' });
  }

  if (path === '/auth/avatar' && req.method === 'POST') {
    const u = userFromAuth(req);
    if (!u) return send(res, 401, { error: 'noAuth' });
    const b = await readBody(req);
    if (typeof b.avatar === 'string' && b.avatar.length > 700000)
      return send(res, 413, { error: 'avatarBig' });
    setAvatar.run(b.avatar || null, u.id);
    return send(res, 200, { user: publicUser(qUser.get(u.id)) });
  }

  if (path === '/auth/name' && req.method === 'POST') {
    const u = userFromAuth(req);
    if (!u) return send(res, 401, { error: 'noAuth' });
    const b = await readBody(req);
    setName.run((b.name || '').trim() || u.username, u.id);
    return send(res, 200, { user: publicUser(qUser.get(u.id)) });
  }

  if (path === '/auth/logout' && req.method === 'POST') {
    const h = req.headers['authorization'] || '';
    if (h.startsWith('Bearer ')) delSession.run(h.slice(7));
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: 'not found' });
}

const server = createServer((req, res) => { route(req, res).catch(() => send(res, 500, { error: 'server' })); });
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error('Порт ' + PORT + ' уже занят. Закрой старый процесс (или задай PORT=8791).');
  else console.error(e.message);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => console.log('KatoVape auth demo слушает http://127.0.0.1:' + PORT));
