// Stripe calls this when a payment succeeded or failed. It is the only trusted source of
// that fact, because the customer may have closed the tab before the front end heard back.
// The signature is verified against the raw body with STRIPE_WEBHOOK_SECRET; without that
// anyone could post "paid" and collect an order for free.
import { enc, hmacHex, safeEqual } from "../_shared/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WH_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

// Stripe-Signature: "t=<ts>,v1=<hex>", signing the string "<ts>.<rawBody>".
async function verify(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"], v1 = parts["v1"];
  if (!t || !v1) return false;
  // Replay protection: a five minute window.
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > 300) return false;
  return safeEqual(await hmacHex(enc.encode(secret), t + "." + raw), v1);
}

async function patchOrder(id: string | number, patch: Record<string, unknown>) {
  await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/orders?id=eq." + id, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
}

// What we asked for when the order was created, in grosz. The promo codes come along because
// a card order spends them here, on payment, and not when it was merely started.
async function orderAmount(
  id: string | number,
): Promise<{ amount: number; currency: string; promo: string[]; user_id: string | null } | null> {
  const res = await fetch(
    SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/orders?id=eq." + id + "&select=amount,currency,promo,user_id",
    { headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } },
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  const o = Array.isArray(rows) ? rows[0] : null;
  return o
    ? {
      amount: Number(o.amount) || 0,
      currency: String(o.currency || "pln"),
      promo: Array.isArray(o.promo) ? o.promo : [],
      user_id: o.user_id || null,
    }
    : null;
}

// Расход промокода записывает сервер. Повторный вызов по тому же заказу ничего не удваивает,
// это проверяет сама promo_use_for, что важно: Stripe повторяет вебхук при любой заминке.
async function spendPromo(codes: string[], orderId: string | number, userId: string | null) {
  for (const code of codes) {
    await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/promo_use_for", {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY,
        "Content-Type": "application/json", Prefer: "count=none",
      },
      body: JSON.stringify({ p_code: code, p_order: orderId, p_user: userId }),
    }).catch(() => {});
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  if (!WH_SECRET) return new Response("not configured", { status: 500 });

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  let ok = false;
  try { ok = await verify(raw, sig, WH_SECRET); } catch { ok = false; }
  if (!ok) return new Response("bad signature", { status: 400 });

  let event: any;
  try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  // object is either a PaymentIntent (website buttons) or a Checkout Session (mini app).
  // order_id is put into metadata in both cases.
  const obj = event?.data?.object || {};
  const orderId = obj?.metadata?.order_id;
  // A Checkout session carries a payment status; if it is not paid yet, wait.
  const sessionPaid = event.type !== "checkout.session.completed" || obj.payment_status === "paid";

  if ((event.type === "payment_intent.succeeded" ||
       event.type === "checkout.session.completed") && orderId && sessionPaid) {
    // A signature only proves the message came from Stripe, not that it pays for this order
    // in full. Compare the money against what the order was created for, so a payment made
    // for a different, smaller amount cannot flip an order to paid and send the goods out.
    const paid = Number(obj.amount_total ?? obj.amount_received ?? obj.amount ?? 0);
    const cur = String(obj.currency || "").toLowerCase();
    const want = await orderAmount(orderId).catch(() => null);
    const short = want && want.amount > 0 && paid < want.amount;
    const wrongCurrency = want && cur && cur !== want.currency.toLowerCase();
    if (short || wrongCurrency) {
      // Left as it was, deliberately: the manager sees an order that never turned paid, and
      // the money is visible in Stripe. Flipping it to failed would hide a real payment.
      console.error("webhook: amount mismatch on order " + orderId +
        " paid=" + paid + " " + cur + " expected=" + (want?.amount) + " " + want?.currency);
      return new Response(JSON.stringify({ received: true, ignored: "amount" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    // Setting paid lets the notifyOrders bot job pick the order up for the manager.
    await patchOrder(orderId, {
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      amount: paid || null,
      payment_ref: obj.payment_intent || obj.id,
      updated_at: new Date().toISOString(),
    }).catch(() => {});
    if (want && want.promo.length) await spendPromo(want.promo, orderId, want.user_id);
  } else if ((event.type === "payment_intent.payment_failed" ||
              event.type === "checkout.session.expired") && orderId) {
    await patchOrder(orderId, { payment_status: "failed", updated_at: new Date().toISOString() }).catch(() => {});
  }

  // Always 200 on a valid signature, otherwise Stripe keeps retrying.
  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
