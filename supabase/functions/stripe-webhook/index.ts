// KatoVape: Stripe зовёт эту функцию, когда оплата на сайте прошла (или сорвалась).
// Единственный доверенный источник факта оплаты: фронт мог закрыть вкладку, не дождавшись
// ответа. Подпись проверяем секретом STRIPE_WEBHOOK_SECRET (whsec_...) по сырому телу —
// без этого кто угодно мог бы прислать «оплачено» и забрать заказ бесплатно.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WH_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const enc = new TextEncoder();

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Stripe-Signature: "t=<ts>,v1=<hex>"; подписывается строка "<ts>.<rawBody>"
async function verify(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"], v1 = parts["v1"];
  if (!t || !v1) return false;
  // защита от повтора старой подписи: окно 5 минут
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(t + "." + raw));
  const hex = Array.from(new Uint8Array(mac)).map((x) => x.toString(16).padStart(2, "0")).join("");
  return safeEqual(hex, v1);
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

  // object — либо PaymentIntent (встроенные кнопки на сайте), либо Checkout Session
  // (Stripe Checkout в мини-аппе). order_id кладём в metadata в обоих случаях.
  const obj = event?.data?.object || {};
  const orderId = obj?.metadata?.order_id;
  // у сессии Checkout бывает статус оплаты — если ещё не paid (асинхронный способ), ждём
  const sessionPaid = event.type !== "checkout.session.completed" || obj.payment_status === "paid";

  if ((event.type === "payment_intent.succeeded" ||
       event.type === "checkout.session.completed") && orderId && sessionPaid) {
    // paid ставит бот-джобу notifyOrders (она берёт unpaid/paid), менеджер узнает о заказе
    await patchOrder(orderId, {
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      amount: obj.amount_total ?? obj.amount_received ?? obj.amount ?? null,
      payment_ref: obj.payment_intent || obj.id,
      updated_at: new Date().toISOString(),
    }).catch(() => {});
  } else if ((event.type === "payment_intent.payment_failed" ||
              event.type === "checkout.session.expired") && orderId) {
    await patchOrder(orderId, { payment_status: "failed", updated_at: new Date().toISOString() }).catch(() => {});
  }

  // всегда 200 на валидную подпись: иначе Stripe будет долбить ретраями
  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
