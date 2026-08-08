import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { slice, sandbox, repoFile } from './helpers/core-src.mjs';
import { priceCart } from '../supabase/functions/_shared/pricing.ts';

const ADMIN = repoFile('demos/admin/index.html');
const cut = (from, to) => {
  const a = ADMIN.indexOf(from);
  assert.ok(a >= 0, 'не нашёл в панели начало: ' + from);
  const b = ADMIN.indexOf(to, a);
  assert.ok(b > a, 'не нашёл в панели конец: ' + to);
  return ADMIN.slice(a, b);
};
const A = (() => {
  const box = { out: null };
  vm.createContext(box);
  vm.runInContext(
    cut('const moneyIn = raw =>', '// Growth against the previous window') +
    cut('function buildTiers(', 'function changedItems()') +
    '\nout = { moneyIn, moneyOut, buildTiers };', box);
  return box.out;
})();

test('панель принимает цену и через запятую, и через точку', () => {
  assert.equal(A.moneyIn('45,50'), 45.5);
  assert.equal(A.moneyIn('45.50'), 45.5);
  assert.equal(A.moneyIn(' 45,5 '), 45.5);
  assert.equal(A.moneyIn('40'), 40);
});

test('пустое поле это «цены нет», а не ноль', () => {
  assert.equal(A.moneyIn(''), null);
  assert.equal(A.moneyIn('   '), null);
  assert.equal(A.moneyIn(null), null);
});

test('нечисло видно, а не превращается молча в ноль', () => {
  assert.ok(Number.isNaN(A.moneyIn('дёшево')));
  assert.ok(Number.isNaN(A.moneyIn('45,5,5')));
});

test('лишние знаки режутся сразу: в базе всё равно два', () => {
  assert.equal(A.moneyIn('45,505'), 45.51);
  assert.equal(A.moneyIn('45,504'), 45.5);
});

test('обратно в поле цена печатается по-польски и без лишних нулей', () => {
  assert.equal(A.moneyOut(45.5), '45,50');
  assert.equal(A.moneyOut(40), '40');
  assert.equal(A.moneyOut(null), '');
  assert.equal(A.moneyOut(''), '');
});

test('дробные ступени доезжают до опта', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(A.buildTiers(45.5, 42.5, null, 38.99))),
    [{ q: 1, p: 45.5 }, { q: 3, p: 42.5 }, { q: 10, p: 38.99 }]);
  assert.equal(A.buildTiers(45.5, null, null, null), null, 'одна база это не ступени');
});


const TIERS = [{ q: 1, p: 45.5 }, { q: 3, p: 42.5 }, { q: 10, p: 39.9 }];
const ITEMS = {
  'model-a': { id: 'model-a', name: 'Model A', price: 45.5, tiers: TIERS,
    flavors: [{ name: 'Strawberry', qty: 99 }, { name: 'Mango', qty: 99 }] }
};
const { api, box } = sandbox(
  [
    slice('function money(n)', '\n  // ==== повтор заказа'),
    slice('function cartLines()', 'function orderText()')
  ],
  { cart: {}, find: (id) => ITEMS[id], appliedPromos: [], deliveryFee: () => 0 },
  ['cartTotal', 'grandTotal', 'discount', 'promoValue', 'money']
);
const setCart = (obj) => { box.cart = obj; };

test('гроши не копят хвост при сложении', () => {
  setCart({ 'model-a::0': 3 });
  assert.equal(api.cartTotal(), 127.5);         // 3 × 42,50
  setCart({ 'model-a::0': 1, 'model-a::1': 1 });
  assert.equal(api.cartTotal(), 91);            // 2 × 45,50
  setCart({ 'model-a::0': 7 });
  assert.equal(api.cartTotal(), 297.5);
});

test('цена печатается запятой, целая остаётся без хвоста', () => {
  assert.equal(api.money(45.5), '45,50 zł');
  assert.equal(api.money(40), '40 zł');
  assert.equal(api.money(0.1 + 0.2), '0,30 zł');
});

test('процент считается до гроша, как в базе', () => {
  assert.equal(api.promoValue({ type: 'percent', value: 10 }, 45.5), 4.55);
  setCart({ 'model-a::0': 1 });
  box.appliedPromos = [{ code: 'LATO10', type: 'percent', value: 10 }];
  assert.equal(api.discount(), 4.55);
  assert.equal(api.grandTotal(), 40.95);
  box.appliedPromos = [];
});


const CATALOG = {
  cities: [{ id: 'katowice', main: true }],
  categories: [{ id: 'disposables', items: [
    { id: 'model-a', name: 'Model A', price: 45.5, tiers: TIERS,
      flavors: [{ name: 'Strawberry', qty: 99 }, { name: 'Mango', qty: 99 }] }] }]
};
const PRODUCTS = ['Strawberry', 'Mango'].map((f) =>
  ({ id: 'model-a', flavor: f, price: 45.5, qty: 99, tiers: TIERS }));
let promo = { ok: false, discount: 0, reason: 'not_found' };

globalThis.fetch = async (url) => {
  const u = String(url);
  const ok = (body) => new Response(JSON.stringify(body),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u.endsWith('/data/products.json')) return ok(CATALOG);
  if (u.endsWith('/data/content.json')) return ok({ delivery: { methods: [{ id: 'pickup', fee: 0 }] } });
  if (u.includes('/rest/v1/products')) return ok(PRODUCTS);
  if (u.includes('/rest/v1/rpc/promo_check')) return ok([promo]);
  throw new Error('нежданный fetch: ' + u);
};
const env = { SUPABASE_URL: 'https://x.supabase.co', SERVICE_KEY: 'k', CATALOG_BASE: 'https://cdn.test' };

test('сервер считает дробную цену без хвоста и совпадает с корзиной', async () => {
  const p = await priceCart(env, { items: [{ id: 'model-a', flavor: 'Strawberry', n: 3 }] });
  assert.equal(p.total_zl, 127.5);
  assert.equal(p.amount, 12750, 'списание в грошах должно быть целым');
  setCart({ 'model-a::0': 3 });
  assert.equal(p.total_zl, api.cartTotal(), 'витрина и сервер разошлись');
});

test('дробная скидка не ломает сумму', async () => {
  promo = { ok: true, discount: 4.55, stackable: true, reason: null };
  const p = await priceCart(env, { items: [{ id: 'model-a', flavor: 'Strawberry', n: 1 }], promo: 'LATO10' });
  assert.equal(p.discount, 4.55);
  assert.equal(p.total_zl, 40.95);
  assert.equal(p.amount, 4095);
  promo = { ok: false, discount: 0, reason: 'not_found' };
});
