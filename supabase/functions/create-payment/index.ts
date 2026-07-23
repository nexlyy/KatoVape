// KatoVape: оплата картой/кошельком на сайте. Клиент присылает корзину, мы считаем сумму
// сами (pricing.ts), заводим заказ со статусом оплаты pending и создаём Stripe PaymentIntent.
// Наружу уходит только client_secret — фронт им подтверждает оплату (Express Checkout Element).
// Ключ Stripe живёт секретом STRIPE_SECRET_KEY, в браузер не попадает; факт оплаты
// подтверждает не фронт, а webhook (stripe-webhook), потому что фронту верить нельзя.
import { cors, json } from "../_shared/cors.ts";
import { priceCart, type Env } from "../_shared/pricing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") || "";
const CATALOG_BASE = (Deno.env.get("CATALOG_BASE") || "").replace(/\/$/, "");
const env: Env = { SUPABASE_URL, SERVICE_KEY, CATALOG_BASE };

// кто оформляет заказ: достаём пользователя по его access-токену (тот же, что у supabase-js)
async function userFromToken(auth: string | null): Promise<string | null> {
  const token = (auth || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { apikey: ANON, Authorization: "Bearer " + token },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  return (u && u.id) || null;
}

// вставка/правка через PostgREST под service_role (мимо RLS: сумму уже проверил сервер)
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
  if (!STRIPE_SECRET) return json({ error: "payments not configured" }, 500);

  const userId = await userFromToken(req.headers.get("authorization"));
  if (!userId) return json({ error: "auth required" }, 401);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  let priced;
  try {
    priced = await priceCart(env, b);
  } catch (e) {
    return json({ error: (e && (e as any).code) || "price" }, 400);
  }

  // заказ заводим сразу, чтобы webhook нашёл его по metadata.order_id
  const ct = b.contact || {};
  let order;
  try {
    const rows = await rest("POST", "orders", {
      user_id: userId, city: b.city || "katowice",
      items: Array.isArray(b.items) ? b.items : [], sum: priced.total_zl,
      delivery: b.delivery || "pickup", address: b.address || null,
      contact: ct, status: "new",
      payment_status: "pending", payment_provider: "stripe",
      amount: priced.amount, currency: priced.currency,
    });
    order = Array.isArray(rows) ? rows[0] : rows;
  } catch (e) {
    return json({ error: "order failed" }, 500);
  }
  if (!order || !order.id) return json({ error: "order failed" }, 500);

  // PaymentIntent на посчитанную сумму. automatic_payment_methods сам включает карты,
  // Google Pay и Apple Pay — фронт показывает их кнопками через Express Checkout Element.
  const form = new URLSearchParams();
  form.set("amount", String(priced.amount));
  form.set("currency", priced.currency);
  form.set("automatic_payment_methods[enabled]", "true");
  form.set("metadata[order_id]", String(order.id));
  form.set("metadata[user_id]", userId);

  const pi = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + STRIPE_SECRET,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  }).then((r) => r.json()).catch(() => null);

  if (!pi || !pi.client_secret) {
    await rest("PATCH", "orders?id=eq." + order.id, { payment_status: "failed" }, "return=minimal").catch(() => {});
    return json({ error: "stripe failed" }, 502);
  }

  await rest("PATCH", "orders?id=eq." + order.id, { payment_ref: pi.id }, "return=minimal").catch(() => {});
  return json({ clientSecret: pi.client_secret, orderId: order.id, amount: priced.amount, currency: priced.currency });
});
