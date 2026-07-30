// Card and wallet payment on the website. The client sends a cart, we price it ourselves
// (pricing.ts), create the order as pending and open a Stripe PaymentIntent. Only the
// client_secret goes out; the Stripe key stays in STRIPE_SECRET_KEY. Payment is confirmed by
// the webhook, never by the front end.
import { cors, json } from "../_shared/cors.ts";
import { priceCart, type Env } from "../_shared/pricing.ts";
import { rest, userFromToken } from "../_shared/rest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") || "";
const CATALOG_BASE = (Deno.env.get("CATALOG_BASE") || "").replace(/\/$/, "");
const env: Env = { SUPABASE_URL, SERVICE_KEY, CATALOG_BASE };

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
  // Card payment costs 10% more; cash on pickup keeps the plain price.
  priced.amount = Math.round(priced.amount * 1.1);
  priced.total_zl = Math.round(priced.total_zl * 1.1);

  // Create the order first so the webhook can find it by metadata.order_id.
  const ct = b.contact || {};
  let order;
  try {
    const rows = await rest("POST", "orders", {
      user_id: userId, city: b.city || "katowice",
      items: Array.isArray(b.items) ? b.items : [], sum: priced.total_zl,
      delivery: b.delivery || "pickup", address: b.address || null,
      // Comment and payment method are stored like on the cash path; without them a card
      // order shows up as pay-on-pickup and loses the customer's note.
      contact: ct, comment: b.comment || null, pay_way: "card", status: "new",
      promo: priced.promo.length ? priced.promo : null, discount: priced.discount,
      payment_status: "pending", payment_provider: "stripe",
      amount: priced.amount, currency: priced.currency,
    });
    order = Array.isArray(rows) ? rows[0] : rows;
  } catch (e) {
    return json({ error: "order failed" }, 500);
  }
  if (!order || !order.id) return json({ error: "order failed" }, 500);

  // PaymentIntent for the computed amount. automatic_payment_methods enables cards,
  // Google Pay and Apple Pay, which the front shows through the Express Checkout Element.
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
    console.error("stripe pi:", JSON.stringify(pi));
    await rest("PATCH", "orders?id=eq." + order.id, { payment_status: "failed" }, "return=minimal").catch(() => {});
    return json({ error: "stripe failed", detail: (pi && pi.error && pi.error.message) || null }, 502);
  }

  await rest("PATCH", "orders?id=eq." + order.id, { payment_ref: pi.id }, "return=minimal").catch(() => {});
  return json({ clientSecret: pi.client_secret, orderId: order.id, amount: priced.amount, currency: priced.currency });
});
