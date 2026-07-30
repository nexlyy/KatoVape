// Подписи проверяют три функции: telegram-auth (вход), create-order/create-checkout
// (заказ из мини-аппа) и stripe-webhook (факт оплаты). Раньше у каждой была своя копия
// этих десяти строк — правка в одной не доезжала до остальных.
export const enc = new TextEncoder();

// Сравнение за постоянное время: обычное === выдаёт длину совпадающего префикса.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

export async function hmac(keyBytes: Uint8Array, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

export const hmacHex = async (keyBytes: Uint8Array, msg: string) => toHex(await hmac(keyBytes, msg));
