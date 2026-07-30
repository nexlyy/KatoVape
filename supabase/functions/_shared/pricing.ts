// Честная сумма заказа считается ТУТ, на сервере, а не берётся с фронта: иначе можно
// прислать свою цену и оплатить корзину за грош. Логика ровно как в shared/core.js
// (ступенчатая цена, промокод, доставка), источник — те же data/*.json, что видит сайт,
// плюс живые цены/остатки из таблицы products (менеджер правит их в админке).

type Tier = { q: number; p: number };
type Flavor = { name: string; qty?: number };
type Item = { id: string; name?: string; price?: number; tiers?: Tier[]; flavors?: Flavor[]; qty?: number; _cat?: string };
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
  // категорию помечаем прямо на товаре (как _cat во фронте): по ней промокод решает,
  // распространяется ли он на корзину
  for (const cat of data.categories || []) for (const it of cat.items || []) items.push({ ...it, _cat: cat.id });
  return items;
}

// живые цена/остаток/ступени из облака (как cloudStock во фронте): цена и ступени привязаны
// к id, остаток к id+вкус. Ступени обязательны в выборке: менеджер правит их в панели, и без
// них сервер считал бы опт по старым числам из файла, а витрина — по новым.
async function cloudOverrides(env: Env, city: string) {
  const url = env.SUPABASE_URL.replace(/\/$/, "") +
    "/rest/v1/products?city=eq." + encodeURIComponent(city) + "&select=id,flavor,price,qty,tiers";
  const res = await fetch(url, {
    headers: { apikey: env.SERVICE_KEY, Authorization: "Bearer " + env.SERVICE_KEY },
  });
  const priceById: Record<string, number> = {};
  const qtyByKey: Record<string, number> = {};
  const tiersById: Record<string, Tier[]> = {};
  if (res.ok) {
    for (const r of await res.json()) {
      if (r.price != null && priceById[r.id] == null) priceById[r.id] = Number(r.price);
      if (r.tiers && r.tiers.length && tiersById[r.id] == null) tiersById[r.id] = r.tiers;
      qtyByKey[r.id + "::" + (r.flavor || "")] = Number(r.qty);
    }
  }
  return { priceById, qtyByKey, tiersById };
}
type Overrides = Awaited<ReturnType<typeof cloudOverrides>>;

// Признак оптовой группы — тот же, что tierGroupOf в shared/core.js: модель. Расходиться
// эти два определения не должны, иначе витрина и списание посчитают по-разному.
const tierGroupOf = (item: Item) => item.id;

// n — количество по всей группе, а не по одной строке корзины
function unitPrice(item: Item, n: number, ov: Overrides): number {
  const tiers = ov.tiersById[item.id] || item.tiers;
  // есть ступени — цена целиком из них (базовую и облачную игнорируем, как tierPrice во фронте)
  if (tiers && tiers.length) {
    let p = tiers[0].p;
    for (const t of tiers) if (n >= t.q) p = t.p;
    return p;
  }
  const cloud = ov.priceById[item.id];
  return cloud != null ? cloud : (item.price || 0);
}

export interface Env {
  SUPABASE_URL: string;
  SERVICE_KEY: string;
  CATALOG_BASE: string;
}

// Скидку считает та же функция базы promo_check, что и корзина в браузере. Раньше тут был
// свой список из content.json: код из панели оплата не видела (списывала полную сумму),
// а старый демо-код KATO10 наоборот срабатывал и в любом регистре. Обе цены расходились
// с тем, что человек видел перед оплатой.
// Лимит «на человека» тут не проверяется: под service_role auth.uid() пуст, его считает
// promo_use после заказа.
async function promoDiscount(
  env: Env, code: string, city: string, sum: number, cats: string[],
): Promise<{ discount: number; stackable: boolean }> {
  const res = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/promo_check", {
    method: "POST",
    headers: {
      apikey: env.SERVICE_KEY, Authorization: "Bearer " + env.SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_code: code, p_city: city, p_sum: sum, p_categories: cats.length ? cats : null }),
  });
  if (!res.ok) throw new Error("promo_check " + res.status);
  const data = await res.json();
  const r = Array.isArray(data) ? data[0] : data;
  return {
    discount: r && r.ok ? Number(r.discount) || 0 : 0,
    stackable: !r || r.stackable !== false,
  };
}

// Кодов может быть несколько, и каждый считается от исходной суммы товаров, а не от
// остатка после предыдущего: так порядок ввода не влияет на итог, и клиент с сервером
// считают одинаково. Общая скидка не больше корзины.
// База — единственный источник правды. Запасного списка тут нет намеренно: если функция
// не ответила, посчитать «как получится» значит списать не ту сумму, которую человек видел.
// Лучше честно не дать оплатить и показать ошибку.
async function discountFor(
  env: Env, codes: string[], city: string, sum: number, cats: string[],
): Promise<{ discount: number; applied: string[] }> {
  const applied: string[] = [];
  let disc = 0;
  for (const raw of codes) {
    let r;
    try {
      r = await promoDiscount(env, raw, city, sum, cats);
    } catch (_e) {
      throw Object.assign(new Error("promo"), { code: "promo" });
    }
    // код с stackable=false действует только в одиночку. Витрина такую пару не даст
    // собрать, но запрос мог прийти и мимо неё — тогда просто не применяем его.
    if (!r.stackable && codes.length > 1) continue;
    if (r.discount > 0) { disc += r.discount; applied.push(raw); }
  }
  return { discount: Math.min(Math.max(disc, 0), sum), applied };
}

// promo приходит строкой (старый формат) или списком; чистим и убираем повторы
function promoList(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : [v];
  const out: string[] = [];
  for (const x of arr) {
    const s = String(x == null ? "" : x).trim();
    if (s && s.length <= 24 && !out.includes(s)) out.push(s);
  }
  return out.slice(0, 10);   // разумный потолок, чтобы не гонять сотню проверок
}

export interface Priced {
  amount: number;       // к списанию, в грошах (zł * 100)
  total_zl: number;     // к списанию, в злотых (для лейбла)
  currency: string;     // pln
  label: string;        // короткое описание для инвойса/чека
  discount: number;     // сколько скинули по промокодам, в злотых
  promo: string[];      // какие коды реально сработали — их и пишем в заказ
}

// Считает сумму по корзине. Кидает {code} на плохой товар / нехватку остатка / пустой заказ.
export async function priceCart(
  env: Env,
  body: { city?: string; items?: CartLine[]; delivery?: string; promo?: string | string[] },
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

  // Количества нормализуем и складываем по группам заранее: ступень цены зависит от суммы
  // по модели, поэтому цену строки нельзя посчитать, не зная всей корзины.
  const rows = lines.map((l) => {
    const item = byId[l.id];
    if (!item) throw Object.assign(new Error("bad_item"), { code: "bad_item", id: l.id });
    return {
      item,
      id: l.id,
      flavor: (l.flavor || "").toString(),
      n: Math.min(Math.max(Math.floor(Number(l.n) || 0), 1), 99),
    };
  });
  const groupQty: Record<string, number> = {};
  for (const r of rows) {
    const g = tierGroupOf(r.item);
    groupQty[g] = (groupQty[g] || 0) + r.n;
  }

  let sub = 0, count = 0;
  const cats = new Set<string>();
  for (const r of rows) {
    // остаток проверяем только когда точно знаем его: иначе честный заказ не должен падать
    const avail = ov.qtyByKey[r.id + "::" + r.flavor];
    if (avail != null && r.n > avail) throw Object.assign(new Error("out_of_stock"), { code: "out_of_stock", id: r.id });
    sub += unitPrice(r.item, groupQty[tierGroupOf(r.item)], ov) * r.n;
    count += r.n;
    if (r.item._cat) cats.add(r.item._cat);
  }

  const { discount: disc, applied } = await discountFor(env, promoList(body.promo), city, sub, [...cats]);

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
    discount: disc,
    promo: applied,
  };
}
