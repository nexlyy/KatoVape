// Telegram signature checks and Bot API calls.
// The bot token lives only in TELEGRAM_BOT_TOKEN and never reaches the browser.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API = t => `https://api.telegram.org/bot${t}`;
const DAY = 86400;

function safeEq(a, b) {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

// Website Login Widget: secret = SHA256(token), hash = HMAC(secret, data_check_string).
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

// Editing a sent message keeps the order list paging in place instead of flooding the chat.
export const editMessage = (chat_id, message_id, text, extra = {}) =>
  tgCall('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });

// Answer an inline button, otherwise its spinner never stops.
export const answerCallback = (id, text, alert) =>
  tgCall('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}), ...(alert ? { show_alert: true } : {}) });

// Broadcast photo. The panel sends a data: URL, so it goes as a multipart file: Telegram
// cannot fetch a data: link.
export async function sendPhoto(chat_id, photo, caption, extra = {}, token = BOT_TOKEN) {
  if (!token) return { ok: false, error: 'no token' };
  const body = new FormData();
  body.set('chat_id', String(chat_id));
  if (caption) { body.set('caption', caption.slice(0, 1024)); body.set('parse_mode', 'HTML'); }
  for (const [k, v] of Object.entries(extra)) body.set(k, typeof v === 'string' ? v : JSON.stringify(v));

  if (/^data:/.test(photo)) {
    const [head, b64] = photo.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const bin = Buffer.from(b64, 'base64');
    body.set('photo', new Blob([bin], { type: mime }), 'photo.jpg');
  } else {
    body.set('photo', photo);            // plain image URL
  }
  const res = await fetch(`${API(token)}/sendPhoto`, { method: 'POST', body });
  return res.json().catch(() => ({ ok: false }));
}

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
