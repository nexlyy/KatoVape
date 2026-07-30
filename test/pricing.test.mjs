// Серверный расчёт заказа: та же ступень по модели, что и в корзине. Гоняем настоящий
// pricing.ts (его зовут create-order, create-payment и create-checkout), подменив только
// fetch — каталог, строки products и promo_check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { priceCart } from '../supabase/functions/_shared/pricing.ts';

const TIERS = [{ q: 1, p: 50 }, { q: 3, p: 45 }, { q: 5, p: 40 }, { q: 10, p: 35 }];
const CATALOG = {
  cities: [{ id: 'katowice', main: true }],
  categories: [{
    id: 'disposables',
    items: [
      { id: 'model-a', name: 'Model A', price: 50, tiers: TIERS,
        flavors: [{ name: 'Strawberry', qty: 99 }, { name: 'Mango', qty: 99 }, { name: 'Cola', qty: 99 }] },
      { id: 'model-b', name: 'Model B', price: 50, tiers: TIERS,
        flavors: [{ name: 'Cola', qty: 99 }, { name: 'Ice', qty: 99 }] },
      { id: 'plain', name: 'Plain', price: 30, qty: 99 }
    ]
  }]
};
const CONTENT = { delivery: { methods: [{ id: 'pickup', fee: 0 }, { id: 'inpost', fee: 12 }] } };
const PRODUCTS = [
  ...['Strawberry', 'Mango', 'Cola'].map((f) => ({ id: 'model-a', flavor: f, price: null, qty: 99, tiers: null })),
  ...['Cola', 'Ice'].map((f) => ({ id: 'model-b', flavor: f, price: null, qty: 99, tiers: null })),
  { id: 'plain', flavor: '', price: null, qty: 99, tiers: null }
];

let cloudTiers = null;          // «менеджер поправил опт в панели»
let promos = {};                // код -> ответ promo_check
let promoStatus = 200;          // 500 — база не ответила
const NO_PROMO = { ok: false, discount: 0, reason: 'not_found' };

globalThis.fetch = async (url, opts) => {
  const u = String(url);
  const ok = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (u.endsWith('/data/products.json')) return ok(CATALOG);
  if (u.endsWith('/data/content.json')) return ok(CONTENT);
  if (u.includes('/rest/v1/products')) return ok(cloudTiers ? PRODUCTS.map((r) => ({ ...r, tiers: cloudTiers })) : PRODUCTS);
  if (u.includes('/rest/v1/rpc/promo_check')) {
    const code = JSON.parse((opts && opts.body) || '{}').p_code;
    return ok([promos[code] || NO_PROMO], promoStatus);
  }
  throw new Error('нежданный fetch: ' + u);
};

const env = { SUPABASE_URL: 'https://x.supabase.co', SERVICE_KEY: 'k', CATALOG_BASE: 'https://cdn.test' };
const line = (id, flavor, n) => ({ id, flavor, n });
const sum = async (body) => (await priceCart(env, body)).total_zl;

test('десять одинаковых вкусов — оптовая цена', async () => {
  assert.equal(await sum({ items: [line('model-a', 'Strawberry', 10)] }), 350);
});

test('разные вкусы одной модели складываются', async () => {
  assert.equal(await sum({
    items: [line('model-a', 'Strawberry', 3), line('model-a', 'Mango', 2), line('model-a', 'Cola', 5)]
  }), 350);
});

test('девять штук — ступень пятёрки', async () => {
  assert.equal(await sum({ items: [line('model-a', 'Strawberry', 4), line('model-a', 'Mango', 5)] }), 360);
});

test('разные модели не складываются', async () => {
  assert.equal(await sum({ items: [line('model-a', 'Strawberry', 5), line('model-b', 'Cola', 5)] }), 400);
});

test('каждая модель получает свой опт', async () => {
  assert.equal(await sum({
    items: [line('model-a', 'Strawberry', 6), line('model-a', 'Mango', 4),
            line('model-b', 'Cola', 9), line('model-b', 'Ice', 1)]
  }), 700);
});

test('граница ступени', async () => {
  assert.equal(await sum({
    items: [line('model-a', 'Strawberry', 1), line('model-a', 'Mango', 1), line('model-a', 'Cola', 1)]
  }), 135);
});

test('товар без ступеней', async () => {
  assert.equal(await sum({ items: [line('plain', '', 10)] }), 300);
});

test('смешанная корзина', async () => {
  assert.equal(await sum({
    items: [line('model-a', 'Strawberry', 7), line('model-a', 'Cola', 3), line('plain', '', 2)]
  }), 410);
});

test('доставка добавляется поверх опта', async () => {
  assert.equal(await sum({ items: [line('model-a', 'Strawberry', 10)], delivery: 'inpost' }), 362);
});

test('ступени из панели перекрывают файл каталога', async () => {
  cloudTiers = [{ q: 1, p: 50 }, { q: 10, p: 30 }];
  assert.equal(await sum({ items: [line('model-a', 'Strawberry', 5), line('model-a', 'Mango', 5)] }), 300);
  cloudTiers = null;
});

test('скидку по промокоду даёт база, а не файл', async () => {
  promos = { LATO10: { ok: true, discount: 35, reason: null } };
  assert.equal(await sum({ items: [line('model-a', 'Strawberry', 10)], promo: 'LATO10' }), 315);
  promos = { LATO10: { ok: false, discount: 0, reason: 'expired' } };
  assert.equal(await sum({ items: [line('model-a', 'Strawberry', 10)], promo: 'LATO10' }), 350);
  promos = {};
});

test('несколько кодов складываются, каждый считается от суммы товаров', async () => {
  // корзина 350: LETO10 — 20 zł фиксом, LETO11 — 10% (35 zł)
  promos = {
    LETO10: { ok: true, discount: 20, reason: null },
    LETO11: { ok: true, discount: 35, reason: null }
  };
  const cart = { items: [line('model-a', 'Strawberry', 10)] };
  assert.equal(await sum({ ...cart, promo: ['LETO10', 'LETO11'] }), 295);
  // порядок ввода на итог не влияет
  assert.equal(await sum({ ...cart, promo: ['LETO11', 'LETO10'] }), 295);
  // строкой по-прежнему можно прислать один код
  assert.equal(await sum({ ...cart, promo: 'LETO10' }), 330);
  promos = {};
});

test('негодный код в списке просто не применяется, остальные работают', async () => {
  promos = {
    LETO10: { ok: true, discount: 20, reason: null },
    STARY: { ok: false, discount: 0, reason: 'expired' }
  };
  assert.equal(await sum({ items: [line('model-a', 'Strawberry', 10)], promo: ['LETO10', 'STARY'] }), 330);
  promos = {};
});

test('в заказ пишутся только сработавшие коды и их общая скидка', async () => {
  promos = {
    LETO10: { ok: true, discount: 20, reason: null },
    STARY: { ok: false, discount: 0, reason: 'expired' }
  };
  const p = await priceCart(env, { items: [line('model-a', 'Strawberry', 10)], promo: ['LETO10', 'STARY'] });
  assert.deepEqual(p.promo, ['LETO10']);
  assert.equal(p.discount, 20);
  promos = {};
});

test('повторы и мусор в списке кодов отсеиваются', async () => {
  promos = { LETO10: { ok: true, discount: 20, reason: null } };
  const p = await priceCart(env, {
    items: [line('model-a', 'Strawberry', 10)],
    promo: ['LETO10', ' LETO10 ', '', null, 'LETO10']
  });
  assert.deepEqual(p.promo, ['LETO10'], 'один код не должен сработать дважды');
  assert.equal(p.discount, 20);
  promos = {};
});

test('код без права складываться работает только в одиночку', async () => {
  promos = {
    MINUS20: { ok: true, discount: 20, stackable: false, reason: null },
    PROC10: { ok: true, discount: 35, stackable: true, reason: null }
  };
  const cart = { items: [line('model-a', 'Strawberry', 10)] };
  assert.equal(await sum({ ...cart, promo: 'MINUS20' }), 330, 'в одиночку должен работать');
  // в паре с процентным фикс не применяется, остаётся только процент
  const p = await priceCart(env, { ...cart, promo: ['MINUS20', 'PROC10'] });
  assert.deepEqual(p.promo, ['PROC10']);
  assert.equal(p.discount, 35);
  promos = {};
});

test('общая скидка не превышает корзину', async () => {
  promos = {
    BIG1: { ok: true, discount: 300, reason: null },
    BIG2: { ok: true, discount: 300, reason: null }
  };
  // товаров на 350, доставка 12 — в минус уйти нельзя
  assert.equal(await sum({ items: [line('model-a', 'Strawberry', 10)], promo: ['BIG1', 'BIG2'], delivery: 'inpost' }), 12);
  promos = {};
});

test('если база не проверила код — оплату не пропускаем', async () => {
  promos = { LATO10: { ok: true, discount: 35, reason: null } };
  promoStatus = 500;
  await assert.rejects(
    () => priceCart(env, { items: [line('model-a', 'Strawberry', 10)], promo: 'LATO10' }),
    (e) => e.code === 'promo'
  );
  promoStatus = 200;
  promos = {};
});

test('чужой товар в корзине отклоняется', async () => {
  await assert.rejects(
    () => priceCart(env, { items: [line('нет-такого', '', 1)] }),
    (e) => e.code === 'bad_item'
  );
});

test('пустой заказ отклоняется', async () => {
  await assert.rejects(() => priceCart(env, { items: [] }), (e) => e.code === 'empty');
});
