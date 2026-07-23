// Честная сумма заказа считается ТУТ, на сервере, а не берётся с фронта: иначе можно
// прислать свою цену и оплатить корзину за грош. Логика ровно как в shared/core.js
// (ступенчатая цена, промокод, доставка), источник — те же data/*.json, что видит сайт,
// плюс живые цены/остатки из таблицы products (менеджер правит их в админке).

type Tier = { q: number; p: number };
type Flavor = { name: string; qty?: number };
type Item = { id: string; name?: string; price?: number; tiers?: Tier[]; flavors?: Flavor[]; qty?: number };
type CartLine = { id: string; flavor?: string; n: number };

// фолбэк доставки, если в content.json нет блока delivery (совпадает с DELIVERY_DEF во фронте)
const DELIVERY_DEF: Record<string, number> = { pickup: 0, inpost: 12, courier: 18 };

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw Object.assign(new Error("catalog " + res.status), { code: "catalog" });
  return res.json();
}

// каталог нужного города: главный город лежит в products.json, у остальных свой файл (cities[].file)
async function cityCatalog(base: string, city: string): Promise<Item[]> {
  const master = await getJson(base + "/data/products.json");
  const cities = master.cities || [{ id: master.city || "katowice", main: true }];
  const c = cities.find((x: any) => x.id === city) || cities[0];
  const data = c.main ? master : await getJson(base + "/" + c.file);
  const items: Item[] = [];
  for (const cat of data.categories || []) for (const it of cat.items || []) items.push(it);
  return items;
}

// живые цена/остаток из облака (как cloudStock во фронте): цена привязана к id, остаток к id+вкус
async function cloudOverrides(env: Env, city: string) {
  const url = env.SUPABASE_URL.replace(/\/$/, "") +
    "/rest/v1/products?city=eq." + encodeURIComponent(city) + "&select=id,flavor,price,qty";
  const res = await fetch(url, {
    headers: { apikey: env.SERVICE_KEY, Authorization: "Bearer " + env.SERVICE_KEY },
  });
  const priceById: Record<string, number> = {};
  const qtyByKey: Record<string, number> = {};
  if (res.ok) {
    for (const r of await res.json()) {
      if (r.price != null && priceById[r.id] == null) priceById[r.id] = Number(r.price);
      qtyByKey[r.id + "::" + (r.flavor || "")] = Number(r.qty);
    }
  }
  return { priceById, qtyByKey };
}

function unitPrice(item: Item, n: number, priceById: Record<string, number>): number {
  // есть ступени — цена целиком из них (базовую и облачную игнорируем, как tierPrice во фронте)
  if (item.tiers && item.tiers.length) {
    let p = item.tiers[0].p;
    for (const t of item.tiers) if (n >= t.q) p = t.p;
    return p;
  }
  const cloud = priceById[item.id];
  return cloud != null ? cloud : (item.price || 0);
}

export interface Env {
  SUPABASE_URL: string;
  SERVICE_KEY: string;
  CATALOG_BASE: string;
}

export interface Priced {
  amount: number;       // к списанию, в грошах (zł * 100)
  total_zl: number;     // к списанию, в злотых (для лейбла)
  currency: string;     // pln
  label: string;        // короткое описание для инвойса/чека
}

// Считает сумму по корзине. Кидает {code} на плохой товар / нехватку остатка / пустой заказ.
export async function priceCart(
  env: Env,
  body: { city?: string; items?: CartLine[]; delivery?: string; promo?: string },
): Promise<Priced> {
  const city = (body.city || "katowice").toString();
  const lines = Array.isArray(body.items) ? body.items : [];
  if (!lines.length) throw Object.assign(new Error("empty"), { code: "empty" });

  const [items, ov, content] = await Promise.all([
    cityCatalog(env.CATALOG_BASE, city),
    cloudOverrides(env, city),
    getJson(env.CATALOG_BASE + "/data/content.json").catch(() => ({})),
  ]);
  const byId: Record<string, Item> = {};
  for (const it of items) byId[it.id] = it;

  let sub = 0, count = 0;
  for (const l of lines) {
    const item = byId[l.id];
    if (!item) throw Object.assign(new Error("bad_item"), { code: "bad_item", id: l.id });
    const n = Math.min(Math.max(Math.floor(Number(l.n) || 0), 1), 99);
    const flavor = (l.flavor || "").toString();
    // остаток проверяем только когда точно знаем его: иначе честный заказ не должен падать
    const avail = ov.qtyByKey[l.id + "::" + flavor];
    if (avail != null && n > avail) throw Object.assign(new Error("out_of_stock"), { code: "out_of_stock", id: l.id });
    sub += unitPrice(item, n, ov.priceById) * n;
    count += n;
  }

  // промокод: percent — процент от корзины, иначе фикс; скидка не больше самой корзины
  let disc = 0;
  const promo = (content.promos || []).find(
    (p: any) => String(p.code).toUpperCase() === String(body.promo || "").trim().toUpperCase(),
  );
  if (promo) disc = promo.type === "percent" ? Math.round(sub * promo.value / 100) : promo.value;
  disc = Math.min(disc, sub);

  const methods: any[] = (content.delivery && content.delivery.methods) || null;
  const dm = String(body.delivery || "pickup");
  const fee = methods ? ((methods.find((m) => m.id === dm) || {}).fee || 0) : (DELIVERY_DEF[dm] || 0);

  const total_zl = Math.max(sub - disc, 0) + fee;
  if (total_zl <= 0) throw Object.assign(new Error("empty"), { code: "empty" });

  return {
    amount: Math.round(total_zl * 100),
    total_zl,
    currency: "pln",
    label: "KatoVape · " + count + " " + (count === 1 ? "товар" : "товара/ов"),
  };
}
