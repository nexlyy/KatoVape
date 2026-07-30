// Payment inside the Telegram mini app through Stripe Checkout.
// Telegram dropped Stripe from the BotFather providers, so a native invoice is impossible.
// Instead the Stripe Checkout page is opened in an external browser, where Apple Pay, Google
// Pay and cards work without domain verification. initData is verified so nobody can order
// under another name, the server computes the amount and the webhook confirms payment.
import { cors, json } from "../_shared/cors.ts";
import { priceCart, type Env } from "../_shared/pricing.ts";
import { verifyInitData } from "../_shared/telegram.ts";
import { rest, profileIdByTelegram } from "../_shared/rest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") || "";
const CATALOG_BASE = (Deno.env.get("CATALOG_BASE") || "").replace(/\/$/, "");
// Where Stripe returns after payment; defaults back to the bot.
const RETURN_URL = Deno.env.get("PAY_RETURN_URL") || CATALOG_BASE || "https://t.me";
const env: Env = { SUPABASE_URL, SERVICE_KEY, CATALOG_BASE };

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
  // Card payment costs 10% more; cash on pickup keeps the plain price.
  priced.amount = Math.round(priced.amount * 1.1);
  priced.total_zl = Math.round(priced.total_zl * 1.1);

  // Attach the order to the same account as on the website so reviews link up later.
  const userId = await profileIdByTelegram(tgId);

  let order;
  try {
    const rows = await rest("POST", "orders", {
      user_id: userId, telegram_id: tgId, city: b.city || "katowice",
      items: Array.isArray(b.items) ? b.items : [], sum: priced.total_zl,
      delivery: b.delivery || "pickup", address: b.address || null,
      // Comment and payment method are stored like on the cash path; without them a card
      // order shows up as pay-on-pickup and loses the customer's note.
      contact: b.contact || {}, comment: b.comment || null, pay_way: "card", status: "new",
      promo: priced.promo.length ? priced.promo : null, discount: priced.discount,
      payment_status: "pending", payment_provider: "stripe",
      amount: priced.amount, currency: priced.currency,
    });
    order = Array.isArray(rows) ? rows[0] : rows;
  } catch { return json({ error: "order failed" }, 500); }
  if (!order || !order.id) return json({ error: "order failed" }, 500);

  // Checkout Session for the computed amount, one line item. metadata.order_id comes back in
  // the webhook; Stripe enables the wallets on its own page.
  const form = new URLSearchParams();
  form.set("mode", "payment");
  // Card is named explicitly (wallets ride on it): for PLN Stripe otherwise demands automatic
  // payment methods enabled in the dashboard, which a fresh account does not have.
  form.set("payment_method_types[0]", "card");
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
    console.error("stripe checkout:", JSON.stringify(sess));
    await rest("PATCH", "orders?id=eq." + order.id, { payment_status: "failed" }, "return=minimal").catch(() => {});
    return json({ error: "checkout failed", detail: (sess && sess.error && sess.error.message) || null }, 502);
  }

  return json({ url: sess.url, orderId: order.id });
});
