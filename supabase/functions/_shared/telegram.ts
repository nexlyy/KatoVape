// Telegram signature checks: mini-app initData and the website Login Widget.
// One copy for every edge function; the signature-field fix below used to be needed twice.
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

// Mini-app initData: secret = HMAC("WebAppData", token).
// Recent clients add a signature field and some versions leave it out of the hashed string,
// so both variants are tried; otherwise login fails on newer phones.
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
  // Without an age check an old initData could be replayed indefinitely.
  if (!ok || !fresh(p.get("auth_date"))) return null;
  try { return userOf(JSON.parse(p.get("user") || "{}")); } catch { return null; }
}

export async function verifyInitData(initData: string, token: string): Promise<number | null> {
  const u = await verifyInitDataUser(initData, token);
  return u ? u.id : null;
}

// Website Login Widget: secret = SHA256(token), hash = HMAC(secret, data_check_string).
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
