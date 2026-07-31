// The order total is computed here, on the server, never taken from the client: otherwise
// anyone could send their own price. The rules mirror shared/core.js (tier price, promo,
// delivery) and read the same data/*.json the storefront reads, plus live prices and stock
// from the products table.

type Tier = { q: number; p: number };
type Flavor = { name: string; qty?: number };
type Item = { id: string; name?: string; price?: number; tiers?: Tier[]; flavors?: Flavor[]; qty?: number; _cat?: string };
type CartLine = { id: string; flavor?: string; n: number };

// Delivery fallback when content.json has no delivery block; matches DELIVERY_DEF on the front.
const DELIVERY_DEF: Record<string, number> = { pickup: 0, inpost: 12, courier: 18 };

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw Object.assign(new Error("catalog " + res.status), { code: "catalog" });
  return res.json();
}

async function cityCatalog(base: string, city: string): Promise<Item[]> {
  const master = await getJson(base + "/data/products.json");
  const cities = master.cities || [{ id: master.city || "katowice", main: true }];
  const c = cities.find((x: any) => x.id === city) || cities[0];
  const data = c.main ? master : await getJson(base + "/" + c.file);
  const items: Item[] = [];
  // Tag the category onto the item (like _cat on the front): a promo code uses it to decide
  // whether it applies to this cart.
  for (const cat of data.categories || []) for (const it of cat.items || []) items.push({ ...it, _cat: cat.id });
  return items;
}

// Live price, stock and tiers from the cloud. Tiers must be selected: the manager edits them
// in the panel, and without them the server would price wholesale from the stale file numbers
// while the storefront used the new ones.
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

// Wholesale grouping key, same as tierGroupOf in shared/core.js: the model. These two
// definitions must not drift apart, or the cart and the charge disagree.
const tierGroupOf = (item: Item) => item.id;

// n is the quantity across the whole group, not one cart line.
function unitPrice(item: Item, n: number, ov: Overrides): number {
  const tiers = ov.tiersById[item.id] || item.tiers;
  // With tiers the price comes only from them, ignoring base and cloud price.
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

// The discount comes from the same promo_check database function the browser cart uses.
// This used to keep its own list in content.json, so a code created in the panel was
// invisible to checkout while an old demo code still applied — both ways the charge
// disagreed with what the customer saw.
// The per-user limit is not enforced here: auth.uid() is empty under service_role, so
// promo_use counts it after the order.
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

// Several codes may apply. Each is computed against the original goods total rather than
// the remainder after the previous one, so the order of entry cannot change the result and
// client and server agree. The combined discount never exceeds the cart.
// The database is the only source of truth: there is deliberately no fallback list. If the
// function does not answer, charging a best-guess amount would mean charging something the
// customer never saw, so the payment is refused instead.
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
    // A stackable=false code works alone. The storefront will not let such a pair be built,
    // but a request may arrive around it, and then the code is simply skipped.
    if (!r.stackable && codes.length > 1) continue;
    if (r.discount > 0) { disc += r.discount; applied.push(raw); }
  }
  return { discount: Math.min(Math.max(disc, 0), sum), applied };
}

// promo arrives as a string (legacy) or a list; clean it and drop repeats.
function promoList(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : [v];
  const out: string[] = [];
  for (const x of arr) {
    const s = String(x == null ? "" : x).trim();
    if (s && s.length <= 24 && !out.includes(s)) out.push(s);
  }
  return out.slice(0, 10);
}

export interface Priced {
  amount: number;       // charged amount in grosz (zł * 100)
  total_zl: number;     // charged amount in zloty
  currency: string;     // pln
  label: string;        // short line for the invoice
  discount: number;     // promo discount in zloty
  promo: string[];      // codes that actually applied; these go into the order
}

// Paying by card costs 10% more, cash on pickup keeps the plain price. The same constant is
// CARD_SURCHARGE in shared/core.js, which shows the customer the figure before they confirm.
// Rounding order matters: the zloty total is rounded first and the charge derived from it,
// exactly like cardTotal() on the front. Scaling the grosz amount separately drifted from the
// stored sum by up to 50 grosz, so the card was charged 115.50 for an order recorded as 116.
export const CARD_SURCHARGE = 0.10;
export function withCardSurcharge(p: Priced): Priced {
  const total_zl = Math.round(p.total_zl * (1 + CARD_SURCHARGE));
  return { ...p, total_zl, amount: total_zl * 100 };
}

// Prices a cart. Throws {code} on an unknown item, missing stock or an empty order.
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

  // Normalise quantities and sum them per group first: the price tier depends on the total
  // for the model, so a line price cannot be known without the whole cart.
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
    // Only check stock when it is actually known, so an honest order never fails on a gap.
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
