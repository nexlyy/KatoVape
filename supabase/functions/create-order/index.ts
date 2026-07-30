// Cash-on-pickup order creation.
// The storefront used to write the order straight into the table and send the total itself,
// which anyone could forge: the manager saw whatever number the browser sent and handed the
// goods over for it. The cart is now priced by the same priceCart the card payment uses.
// Two entry paths: the website sends an access token, the mini app a signed initData.
import { cors, json } from "../_shared/cors.ts";
import { priceCart, type Env } from "../_shared/pricing.ts";
import { verifyInitData } from "../_shared/telegram.ts";
import { rest, userFromToken, profileIdByTelegram } from "../_shared/rest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const CATALOG_BASE = (Deno.env.get("CATALOG_BASE") || "").replace(/\/$/, "");
const env: Env = { SUPABASE_URL, SERVICE_KEY, CATALOG_BASE };

const DELIVERY = ["pickup", "inpost", "courier"];
const CITIES = ["katowice", "gliwice", "warszawa"];
const RATE_LIMIT = Number(Deno.env.get("KV_ORDER_RATE_LIMIT") || 5);   // orders per minute per person
const str = (v: unknown, max: number) => String(v == null ? "" : v).trim().slice(0, max);

// Contacts are stored trimmed: this is a snapshot for the manager, not a free-text field.
function contactOf(raw: any) {
  const c = raw && typeof raw === "object" ? raw : {};
  return {
    name: str(c.name, 120),
    phone: str(c.phone, 24),
    email: str(c.email, 160),
    paczkomat: str(c.paczkomat, 24),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  // Who is ordering: a website token or a mini-app signature, otherwise refuse.
  let userId: string | null = null;
  let tgId: number | null = null;
  if (typeof b.initData === "string" && b.initData) {
    if (!BOT_TOKEN) return json({ error: "telegram not configured" }, 500);
    tgId = await verifyInitData(b.initData, BOT_TOKEN);
    if (!tgId) return json({ error: "telegram signature invalid" }, 401);
    userId = await profileIdByTelegram(tgId);
  } else {
    userId = await userFromToken(req.headers.get("authorization"));
  }
  if (!userId && !tgId) return json({ error: "auth required" }, 401);

  // Rate limit by this person's orders in the last minute. Counted in the database rather
  // than in instance memory: the function runs in several copies, so a local counter would be
  // trivially bypassed. It also catches a double tap on the checkout button.
  const since = new Date(Date.now() - 60_000).toISOString();
  const who = userId ? "user_id=eq." + userId : "telegram_id=eq." + tgId;
  try {
    const recent = await rest("GET", "orders?" + who + "&created_at=gte." + since + "&select=id&limit=" + (RATE_LIMIT + 1), undefined, "count=none");
    if (Array.isArray(recent) && recent.length >= RATE_LIMIT) return json({ error: "too_many" }, 429);
  } catch { /* cannot count: do not block an honest order */ }

  const city = CITIES.includes(String(b.city)) ? String(b.city) : "katowice";
  const delivery = DELIVERY.includes(String(b.delivery)) ? String(b.delivery) : "pickup";

  // Total, stock, promo and delivery are all computed server-side from our own catalogue.
  let priced;
  try { priced = await priceCart(env, { ...b, city, delivery }); }
  catch (e) { return json({ error: (e && (e as any).code) || "price" }, 400); }

  const contact = contactOf(b.contact);
  if (!contact.name || !contact.phone) return json({ error: "contact" }, 400);
  if (delivery === "inpost" && !contact.paczkomat) return json({ error: "paczkomat" }, 400);

  try {
    const rows = await rest("POST", "orders", {
      user_id: userId, telegram_id: tgId,
      city, items: Array.isArray(b.items) ? b.items : [],
      sum: priced.total_zl,
      // Pickup carries no address, whatever the client sent.
      delivery, address: delivery === "pickup" ? null : (str(b.address, 200) || null),
      contact, comment: str(b.comment, 500) || null,
      // Codes and discount as they actually applied server-side, not as sent by the client.
      promo: priced.promo.length ? priced.promo : null, discount: priced.discount,
      pay_way: "cash", status: "new",
      // Cash on pickup: no money yet; the bot job shows the order to the manager.
      payment_status: "unpaid",
      amount: priced.amount, currency: priced.currency,
    });
    const order = Array.isArray(rows) ? rows[0] : rows;
    if (!order || !order.id) return json({ error: "order failed" }, 500);
    return json({ orderId: order.id, sum: priced.total_zl });
  } catch {
    return json({ error: "order failed" }, 500);
  }
});
