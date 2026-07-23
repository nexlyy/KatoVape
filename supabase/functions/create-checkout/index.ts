// KatoVape: оплата в мини-аппе Telegram через Stripe Checkout.
// Telegram убрал Stripe из провайдеров BotFather, поэтому нативный инвойс со Stripe не собрать.
// Вместо него открываем страницу Stripe Checkout во внешнем браузере (tg.openLink): там
// Apple Pay / Google Pay / карта работают сами и БЕЗ верификации домена (страница на
// checkout.stripe.com). Проверяем подпись initData (иначе можно оформить от чужого имени),
// сумму считает сервер, факт оплаты подтверждает webhook (checkout.session.completed).
import { cors, json } from "../_shared/cors.ts";
import { priceCart, type Env } from "../_shared/pricing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") || "";
const CATALOG_BASE = (Deno.env.get("CATALOG_BASE") || "").replace(/\/$/, "");
// куда Stripe вернёт после оплаты; по умолчанию — назад к боту
const RETURN_URL = Deno.env.get("PAY_RETURN_URL") || CATALOG_BASE || "https://t.me";
const env: Env = { SUPABASE_URL, SERVICE_KEY, CATALOG_BASE };

const encTE = new TextEncoder();
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function hmac(keyBytes: Uint8Array, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encTE.encode(msg)));
}
const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

// та же проверка, что в telegram-auth: secret = HMAC("WebAppData", token)
async function verifyInitData(initData: string, token: string): Promise<number | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  const secret = await hmac(encTE.encode("WebAppData"), token);
  const check = (skip: string[]) =>
    [...params.entries()].filter(([k]) => !skip.includes(k)).sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${k}=${v}`).join("\n");
  let ok = safeEqual(toHex(await hmac(secret, check(["hash"]))), hash);
  if (!ok && params.has("signature")) ok = safeEqual(toHex(await hmac(secret, check(["hash", "signature"]))), hash);
  if (!ok) return null;
  if (Number(params.get("auth_date") || 0) < Math.floor(Date.now() / 1000) - 86400) return null;
  const u = JSON.parse(params.get("user") || "{}");
  return u && u.id ? Number(u.id) : null;
}

async function rest(method: string, path: string, body?: unknown, prefer = "return=representation") {
  const res = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json", Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error("rest " + res.status + " " + txt.slice(0, 200));
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!STRIPE_SECRET || !BOT_TOKEN) return json({ error: "payments not configured" }, 500);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (typeof b.initData !== "string") return json({ error: "bad request" }, 400);

  const tgId = await verifyInitData(b.initData, BOT_TOKEN);
  if (!tgId) return json({ error: "telegram signature invalid" }, 401);

  let priced;
  try { priced = await priceCart(env, b); }
  catch (e) { return json({ error: (e && (e as any).code) || "price" }, 400); }

  // заказ к тому же аккаунту, что и на сайте (по telegram_id), чтобы отзывы потом привязались
  let userId: string | null = null;
  try {
    const p = await rest("GET", "profiles?telegram_id=eq." + tgId + "&select=id&limit=1", undefined, "count=none");
    userId = Array.isArray(p) && p[0] ? p[0].id : null;
  } catch { userId = null; }

  let order;
  try {
    const rows = await rest("POST", "orders", {
      user_id: userId, telegram_id: tgId, city: b.city || "katowice",
      items: Array.isArray(b.items) ? b.items : [], sum: priced.total_zl,
      delivery: b.delivery || "pickup", address: b.address || null,
      contact: b.contact || {}, status: "new",
      payment_status: "pending", payment_provider: "stripe",
      amount: priced.amount, currency: priced.currency,
    });
    order = Array.isArray(rows) ? rows[0] : rows;
  } catch { return json({ error: "order failed" }, 500); }
  if (!order || !order.id) return json({ error: "order failed" }, 500);

  // Checkout Session на посчитанную сумму, одной строкой. metadata.order_id вернётся
  // в webhook. Apple Pay / Google Pay Stripe включит сам на своей странице.
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", RETURN_URL + (RETURN_URL.includes("?") ? "&" : "?") + "paid=1");
  form.set("cancel_url", RETURN_URL + (RETURN_URL.includes("?") ? "&" : "?") + "paid=0");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", priced.currency);
  form.set("line_items[0][price_data][unit_amount]", String(priced.amount));
  form.set("line_items[0][price_data][product_data][name]", priced.label);
  form.set("metadata[order_id]", String(order.id));
  form.set("payment_intent_data[metadata][order_id]", String(order.id));

  const sess = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: "Bearer " + STRIPE_SECRET, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }).then((r) => r.json()).catch(() => null);

  if (!sess || !sess.url) {
    await rest("PATCH", "orders?id=eq." + order.id, { payment_status: "failed" }, "return=minimal").catch(() => {});
    return json({ error: "checkout failed" }, 502);
  }

  return json({ url: sess.url, orderId: order.id });
});
