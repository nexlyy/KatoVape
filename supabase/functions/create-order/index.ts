// KatoVape: оформление заказа с оплатой при выдаче.
// Раньше витрина писала заказ прямо в таблицу и присылала сумму сама. Подменить её в
// запросе мог кто угодно: менеджер видел в панели ту цифру, которую прислал браузер, и
// выдавал товар по ней. Теперь состав корзины считает сервер той же priceCart, что и
// оплата картой, — цена в заказе всегда наша.
// Заходят двумя путями: сайт присылает access-токен, мини-апп — подписанный initData.
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
const RATE_LIMIT = Number(Deno.env.get("KV_ORDER_RATE_LIMIT") || 5);   // заказов в минуту на человека
const str = (v: unknown, max: number) => String(v == null ? "" : v).trim().slice(0, max);

// Контакты кладём в заказ обрезанными: это снимок для менеджера, а не поле для сочинений.
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

  // кто оформляет: токен сайта либо подпись мини-аппа, иначе не пускаем
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

  // Простой лимит: заказы этого же человека за последнюю минуту. Считаем по базе, а не в
  // памяти инстанса — edge-функция живёт в нескольких копиях, и локальный счётчик обошли бы
  // повторной отправкой. Заодно ловит двойной тап по кнопке оформления.
  const since = new Date(Date.now() - 60_000).toISOString();
  const who = userId ? "user_id=eq." + userId : "telegram_id=eq." + tgId;
  try {
    const recent = await rest("GET", "orders?" + who + "&created_at=gte." + since + "&select=id&limit=" + (RATE_LIMIT + 1), undefined, "count=none");
    if (Array.isArray(recent) && recent.length >= RATE_LIMIT) return json({ error: "too_many" }, 429);
  } catch { /* не смогли посчитать — не мешаем оформить заказ */ }

  const city = CITIES.includes(String(b.city)) ? String(b.city) : "katowice";
  const delivery = DELIVERY.includes(String(b.delivery)) ? String(b.delivery) : "pickup";

  // сумма, остатки, промокод и доставка — всё считает сервер по своему каталогу
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
      // самовывоз — без адреса, что бы ни прислал клиент
      delivery, address: delivery === "pickup" ? null : (str(b.address, 200) || null),
      contact, comment: str(b.comment, 500) || null,
      pay_way: "cash", status: "new",
      // оплата при выдаче: денег ещё нет, менеджеру заказ показывает джоба бота
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
