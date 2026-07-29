// Корзина витрины: оптовая ступень берётся по сумме всей модели, а не по одному вкусу.
// Раньше 3 Strawberry + 2 Mango + 5 Cola считались тремя отдельными позициями, и десять
// штук одной модели шли по розничной цене.
import test from 'node:test';
import assert from 'node:assert/strict';
import { slice, sandbox, plain } from './helpers/core-src.mjs';

const TIERS = [{ q: 1, p: 50 }, { q: 3, p: 45 }, { q: 5, p: 40 }, { q: 10, p: 35 }];
const ITEMS = {
  'model-a': {
    id: 'model-a', name: 'Model A', price: 50, tiers: TIERS,
    flavors: [{ name: 'Strawberry', qty: 99 }, { name: 'Mango', qty: 99 }, { name: 'Cola', qty: 99 }]
  },
  'model-b': {
    id: 'model-b', name: 'Model B', price: 50, tiers: TIERS,
    flavors: [{ name: 'Cola', qty: 99 }, { name: 'Ice', qty: 99 }]
  },
  plain: { id: 'plain', name: 'Plain', price: 30, qty: 99 }
};

const { api, box } = sandbox(
  [
    slice('function priceTiers(item)', '\n  // ==== повтор заказа'),
    slice('function cartLines()', 'function orderText()'),
    'function cartTotal() { return cartLines().reduce((s, l) => s + l.sum, 0); }'
  ],
  { cart: {}, find: (id) => ITEMS[id] },
  ['cartTotal', 'cartLines', 'unitWithCart', 'tierQtyByGroup']
);

// ключ корзины — `id::индексВкуса`, у товара без вкусов индекс пустой (как в cartAdd)
const setCart = (obj) => { box.cart = obj; };
const total = (obj) => { setCart(obj); return api.cartTotal(); };

test('десять одинаковых вкусов дают оптовую цену', () => {
  assert.equal(total({ 'model-a::0': 10 }), 350);
});

test('разные вкусы одной модели складываются: 3 + 2 + 5 = опт', () => {
  assert.equal(total({ 'model-a::0': 3, 'model-a::1': 2, 'model-a::2': 5 }), 350);
});

test('девяти штук для десятой ступени не хватает', () => {
  assert.equal(total({ 'model-a::0': 4, 'model-a::1': 5 }), 360);
});

test('разные модели не складываются: 5 + 5 остаются розницей', () => {
  assert.equal(total({ 'model-a::0': 5, 'model-b::0': 5 }), 400);
});

test('каждая модель получает свой опт независимо от соседней', () => {
  assert.equal(total({ 'model-a::0': 6, 'model-a::1': 4, 'model-b::0': 9, 'model-b::1': 1 }), 700);
});

test('граница ступени: три штуки тремя вкусами', () => {
  assert.equal(total({ 'model-a::0': 1, 'model-a::1': 1, 'model-a::2': 1 }), 135);
});

test('товар без ступеней считается по базовой цене', () => {
  assert.equal(total({ 'plain::': 10 }), 300);
});

test('смешанная корзина: опт по модели плюс товар без ступеней', () => {
  assert.equal(total({ 'model-a::0': 7, 'model-a::2': 3, 'plain::': 2 }), 410);
});

test('пустая корзина ничего не стоит', () => {
  assert.equal(total({}), 0);
});

test('изменение количества пересчитывает всю модель', () => {
  assert.equal(total({ 'model-a::0': 4, 'model-a::1': 5 }), 360);   // 9 штук
  assert.equal(total({ 'model-a::0': 5, 'model-a::1': 5 }), 350);   // добавили одну — опт
});

test('удаление позиции возвращает цену на прежнюю ступень', () => {
  assert.equal(total({ 'model-a::0': 5, 'model-a::1': 5 }), 350);
  assert.equal(total({ 'model-a::0': 7 }), 280);                    // вкус убрали, осталось 7
});

test('смена вкуса при том же количестве не сбрасывает скидку', () => {
  assert.equal(total({ 'model-a::0': 5, 'model-a::1': 5 }), 350);
  assert.equal(total({ 'model-a::0': 5, 'model-a::2': 5 }), 350);
  assert.equal(total({ 'model-a::0': 2, 'model-a::1': 3, 'model-a::2': 5 }), 350);
});

test('цена за штуку одинакова у всех вкусов модели', () => {
  setCart({ 'model-a::0': 3, 'model-a::1': 2, 'model-a::2': 5 });
  const lines = plain(api.cartLines());
  assert.equal(lines.length, 3);
  assert.deepEqual([...new Set(lines.map((l) => l.unit))], [35]);
  assert.deepEqual(lines.map((l) => l.sum), [105, 70, 175]);
});

test('карточка товара показывает цену с учётом того, что уже в корзине', () => {
  setCart({ 'model-a::0': 8 });
  assert.equal(api.unitWithCart(ITEMS['model-a'], 1), 40);   // станет 9 — ступень пятёрки
  assert.equal(api.unitWithCart(ITEMS['model-a'], 2), 35);   // станет 10 — оптовая
  assert.equal(api.unitWithCart(ITEMS['model-a'], 0), 40);   // текущая ступень
  setCart({});
  assert.equal(api.unitWithCart(ITEMS['model-a'], 1), 50);
  assert.equal(api.unitWithCart(ITEMS['model-a'], 10), 35);
});

test('количества считаются по группам раздельно', () => {
  setCart({ 'model-a::0': 6, 'model-b::0': 4 });
  const g = api.tierQtyByGroup();
  assert.equal(g['model-a'], 6);
  assert.equal(g['model-b'], 4);
});
