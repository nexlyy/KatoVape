// Проверка подписи Telegram WebApp. Одна копия на все edge-функции: раньше тот же код
// лежал отдельно в create-checkout, и правку про поле signature пришлось бы вносить дважды.
const enc = new TextEncoder();

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmac(keyBytes: Uint8Array, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

const DAY = 86400;

// initData подписан ботом: secret = HMAC("WebAppData", token). Возвращает telegram_id
// или null. Свежие клиенты добавляют поле signature, и часть версий не включает его в
// строку для хеша — поэтому пробуем оба варианта, иначе вход падал бы на новых телефонах.
export async function verifyInitData(initData: string, token: string): Promise<number | null> {
  if (!initData || !token) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  const secret = await hmac(enc.encode("WebAppData"), token);
  const check = (skip: string[]) =>
    [...params.entries()].filter(([k]) => !skip.includes(k)).sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${k}=${v}`).join("\n");
  let ok = safeEqual(toHex(await hmac(secret, check(["hash"]))), hash);
  if (!ok && params.has("signature")) ok = safeEqual(toHex(await hmac(secret, check(["hash", "signature"]))), hash);
  if (!ok) return null;
  // подпись без срока годности позволяла бы переиграть старый initData сколько угодно
  if (Number(params.get("auth_date") || 0) < Math.floor(Date.now() / 1000) - DAY) return null;
  try {
    const u = JSON.parse(params.get("user") || "{}");
    return u && u.id ? Number(u.id) : null;
  } catch { return null; }
}
