// Проверка подписи Telegram: initData мини-аппа и Login Widget на сайте.
// Одна копия на все edge-функции — раньше тот же код лежал отдельно в telegram-auth
// и create-checkout, и правку про поле signature пришлось бы вносить дважды.
import { enc, hmac, hmacHex, safeEqual, sha256, toHex } from "./crypto.ts";

const DAY = 86400;
const fresh = (authDate: unknown) => Number(authDate || 0) >= Math.floor(Date.now() / 1000) - DAY;

export interface TgUser {
  id: number;
  username: string | null;
  first_name: string | null;
  photo_url: string | null;
}

const userOf = (u: any): TgUser | null =>
  u && u.id
    ? {
      id: Number(u.id),
      username: u.username ? String(u.username) : null,
      first_name: u.first_name ? String(u.first_name) : null,
      photo_url: u.photo_url ? String(u.photo_url) : null,
    }
    : null;

// initData мини-аппа: secret = HMAC("WebAppData", token).
// Свежие клиенты добавляют поле signature, и часть версий не включает его в строку для
// хеша — пробуем оба варианта, иначе вход падал бы на новых телефонах.
export async function verifyInitDataUser(initData: string, token: string): Promise<TgUser | null> {
  if (!initData || !token) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get("hash") || "";
  const secret = await hmac(enc.encode("WebAppData"), token);
  const check = (skip: string[]) =>
    [...p.entries()].filter(([k]) => !skip.includes(k)).sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${k}=${v}`).join("\n");
  let ok = safeEqual(await hmacHex(secret, check(["hash"])), hash);
  if (!ok && p.has("signature")) ok = safeEqual(await hmacHex(secret, check(["hash", "signature"])), hash);
  // без проверки срока старый initData можно было бы переигрывать сколько угодно
  if (!ok || !fresh(p.get("auth_date"))) return null;
  try { return userOf(JSON.parse(p.get("user") || "{}")); } catch { return null; }
}

// когда нужен только идентификатор (оформление заказа и оплата)
export async function verifyInitData(initData: string, token: string): Promise<number | null> {
  const u = await verifyInitDataUser(initData, token);
  return u ? u.id : null;
}

// Login Widget на сайте: secret = SHA256(token), hash = HMAC(secret, data_check_string)
export async function verifyWidget(payload: Record<string, unknown>, token: string): Promise<TgUser | null> {
  if (!payload || !token) return null;
  const hash = String(payload.hash || "");
  const pairs = Object.keys(payload).filter((k) => k !== "hash").sort()
    .map((k) => `${k}=${payload[k]}`).join("\n");
  const secret = await sha256(enc.encode(token));
  if (!safeEqual(toHex(await hmac(secret, pairs)), hash)) return null;
  if (!fresh(payload.auth_date)) return null;
  return userOf(payload);
}
