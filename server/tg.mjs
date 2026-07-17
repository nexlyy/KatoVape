// Работа с Telegram: проверка подписи (initData + Login Widget) и Bot API.
// Токен бота живёт только в окружении TELEGRAM_BOT_TOKEN, в браузер не уходит.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API = t => `https://api.telegram.org/bot${t}`;
const DAY = 86400;

function safeEq(a, b) {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

// Login Widget на сайте: secret = SHA256(token), hash = HMAC(secret, data_check_string)
export function verifyWidget(payload, token = BOT_TOKEN) {
  if (!token || !payload || !payload.hash) return null;
  const pairs = Object.keys(payload).filter(k => k !== 'hash').sort()
    .map(k => `${k}=${payload[k]}`).join('\n');
  const secret = createHash('sha256').update(token).digest();
  const check = createHmac('sha256', secret).update(pairs).digest('hex');
  if (!safeEq(check, String(payload.hash))) return null;
  if (Number(payload.auth_date || 0) < Math.floor(Date.now() / 1000) - DAY) return null;
  return { id: Number(payload.id), username: payload.username || null, first_name: payload.first_name || null, photo_url: payload.photo_url || null };
}

// WebApp initData: secret = HMAC("WebAppData", token), hash = HMAC(secret, data_check_string)
export function verifyInitData(initData, token = BOT_TOKEN) {
  if (!token || !initData) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash') || '';
  const pairs = [...p.entries()].filter(([k]) => k !== 'hash').sort(([a], [b]) => a < b ? -1 : 1)
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const check = createHmac('sha256', secret).update(pairs).digest('hex');
  if (!safeEq(check, hash)) return null;
  if (Number(p.get('auth_date') || 0) < Math.floor(Date.now() / 1000) - DAY) return null;
  const u = JSON.parse(p.get('user') || '{}');
  return { id: Number(u.id), username: u.username || null, first_name: u.first_name || null, photo_url: u.photo_url || null };
}

// ---- Bot API ----
export async function tgCall(method, body, token = BOT_TOKEN) {
  if (!token) return { ok: false, error: 'no token' };
  const res = await fetch(`${API(token)}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return res.json().catch(() => ({ ok: false }));
}
export const sendMessage = (chat_id, text, extra = {}) =>
  tgCall('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

export async function setWebhook(url, secret) {
  return tgCall('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'] });
}
export async function deleteWebhook() { return tgCall('deleteWebhook', { drop_pending_updates: false }); }
export async function getUpdates(offset, timeout = 25) {
  return tgCall('getUpdates', { offset, timeout, allowed_updates: ['message', 'callback_query'] });
}
export async function setMenuButton(webAppUrl, text = 'Магазин') {
  return tgCall('setChatMenuButton', { menu_button: { type: 'web_app', text, web_app: { url: webAppUrl } } });
}
