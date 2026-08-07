// Каталог витрины поверх базы: строки products решают, какие вкусы у товара есть.
//
// Раньше база только накладывалась на data/*.json: удалённый в панели вкус так и висел «в
// наличии» со старым остатком из файла, а вкус, заведённый у товара, у которого в файле
// вкусов нет, не появлялся вовсе. Заодно проверяем корзину: она помнит вкус номером, и
// удаление соседа не должно подменять человеку выбор.
import test from 'node:test';
import assert from 'node:assert/strict';
import { slice, sandbox, plain } from './helpers/core-src.mjs';

const TINTS = [{ id: 'berry', c: ['#ff5f7d', '#d22a4b'] }, { id: 'mint', c: ['#5ff3d0', '#25b195'] }];

// applyStock переставляет корзину, поэтому в песочницу идут и функции корзины. Хранилища
// в Node нет: подменяем его словарём, чтобы saveCart не падал.
function box(items, cart) {
  const store = {};
  const env = sandbox(
    [
      slice('function cartStoreKey()', 'function t(key, n)'),
      slice('function saveCart()', 'function cartCount()'),
      slice('function applyStock(rows)', '// вкусы показываем на английском'),
      slice('function flavorColors(f)', '// ==== "с этим берут"'),
      slice('const FLAVOR_HUES = [', 'function flavorColors(f)'),
      'function hashId(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }'
    ],
    {
      db: { categories: [{ id: 'c', items }] },
      city: 'katowice',
      cart: { ...cart },
      hooks: {},
      window: { KV_TINTS: TINTS },
      drawDrawer: () => {},
      localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); }
      },
      find: (id) => items.find((x) => x.id === id) || null
    },
    ['applyStock', 'flavorColors', 'loadCart', 'saveCart']
  );
  return env;
}

const row = (id, flavor, over) => Object.assign({ id, flavor, qty: 5 }, over || {});
// список вкусов собран внутри песочницы, у него чужой Array.prototype
const names = (it) => plain(it.flavors || []).map((f) => f.name);

test('вкус, удалённый в панели, уходит с витрины', () => {
  const items = [{ id: 'hqd', name: 'HQD', flavors: [
    { name: 'Watermelon', qty: 4 }, { name: 'Mango', qty: 3 }, { name: 'Grape', qty: 2 }] }];
  const { api } = box(items, {});
  api.applyStock([row('hqd', 'Watermelon', { qty: 4 }), row('hqd', 'Grape', { qty: 2 })]);
  assert.deepEqual(names(items[0]), ['Watermelon', 'Grape'], 'Mango удалили, а он остался');
});

test('товара нет в базе — на витрине он пустой, а не «в наличии» по файлу', () => {
  const items = [
    { id: 'hqd', name: 'HQD', flavors: [{ name: 'Mango', qty: 3 }] },
    { id: 'puffy', name: 'Puffy', flavors: [{ name: 'Bubble', qty: 7 }] },
    { id: 'plain', name: 'Plain', qty: 9 }
  ];
  const { api } = box(items, {});
  api.applyStock([row('hqd', 'Mango', { qty: 3 })]);
  assert.equal(items[1].flavors[0].qty, 0, 'удалённый товар остался на полке');
  assert.equal(items[2].qty, 0, 'товар без вкусов тоже должен обнулиться');
});

test('вкус, заведённый в панели, доезжает до товара без вкусов в файле', () => {
  const items = [{ id: 'plain', name: 'Plain', qty: 9 }];
  const { api } = box(items, {});
  api.applyStock([row('plain', 'Cola', { qty: 6 })]);
  assert.deepEqual(names(items[0]), ['Cola']);
  assert.equal(items[0].flavors[0].qty, 6);
});

test('порядок из файла сохраняется, новые вкусы идут в конец', () => {
  const items = [{ id: 'hqd', name: 'HQD', flavors: [
    { name: 'Watermelon', qty: 1 }, { name: 'Mango', qty: 1 }] }];
  const { api } = box(items, {});
  // база отдаёт свой порядок, витрина держится файла
  api.applyStock([row('hqd', 'Cola'), row('hqd', 'Mango'), row('hqd', 'Watermelon')]);
  assert.deepEqual(names(items[0]), ['Watermelon', 'Mango', 'Cola']);
});

test('вкусы кончились, осталась строка без вкуса: карточка становится простой', () => {
  const items = [{ id: 'hqd', name: 'HQD', flavors: [{ name: 'Mango', qty: 3 }] }];
  const { api } = box(items, {});
  api.applyStock([row('hqd', '', { qty: 4 })]);
  assert.equal(items[0].flavors, undefined);
  assert.equal(items[0].qty, 4);
});

test('облако молчит — витрина живёт файлом', () => {
  const items = [{ id: 'hqd', name: 'HQD', flavors: [{ name: 'Mango', qty: 3 }] }];
  const { api } = box(items, {});
  api.applyStock(null);
  api.applyStock([]);
  assert.deepEqual(names(items[0]), ['Mango']);
  assert.equal(items[0].flavors[0].qty, 3);
});

test('корзина переезжает на новые номера вкусов', () => {
  const items = [{ id: 'hqd', name: 'HQD', flavors: [
    { name: 'Watermelon', qty: 4 }, { name: 'Mango', qty: 3 }, { name: 'Grape', qty: 2 }] }];
  // человек набрал Grape (номер 2) и Mango (номер 1)
  const { api, box: env } = box(items, { 'hqd::2': 1, 'hqd::1': 2 });
  api.applyStock([row('hqd', 'Watermelon'), row('hqd', 'Mango'), row('hqd', 'Grape')]);
  // удаляем первый вкус: остальные съезжают вверх
  api.applyStock([row('hqd', 'Mango'), row('hqd', 'Grape')]);
  assert.deepEqual(names(items[0]), ['Mango', 'Grape']);
  assert.deepEqual({ ...env.cart }, { 'hqd::1': 1, 'hqd::0': 2 }, 'корзина показывает на чужие вкусы');
});

test('удалили вкус из корзины — строка уходит, остальные остаются', () => {
  const items = [{ id: 'hqd', name: 'HQD', flavors: [
    { name: 'Watermelon', qty: 4 }, { name: 'Mango', qty: 3 }] }];
  const { api, box: env } = box(items, { 'hqd::0': 1, 'hqd::1': 2 });
  api.applyStock([row('hqd', 'Watermelon'), row('hqd', 'Mango')]);
  api.applyStock([row('hqd', 'Mango')]);
  assert.deepEqual({ ...env.cart }, { 'hqd::0': 2 });
});

test('отложенная корзина находит свой вкус после перезапуска', () => {
  const items = [{ id: 'hqd', name: 'HQD', flavors: [
    { name: 'Watermelon', qty: 4 }, { name: 'Mango', qty: 3 }] }];
  const { api, box: env } = box(items, { 'hqd::1': 2 });
  // saveCart кладёт рядом с корзиной названия вкусов
  api.applyStock([row('hqd', 'Watermelon'), row('hqd', 'Mango')]);
  env.cart['hqd::1'] = 2;
  api.saveCart();
  // назавтра менеджер удалил Watermelon, вкладку открыли заново
  api.applyStock([row('hqd', 'Mango')]);
  env.cart = { 'hqd::1': 2 };            // как будто прочитали старую корзину с диска
  api.loadCart();
  assert.deepEqual({ ...env.cart }, { 'hqd::0': 2 }, 'Mango должен остаться Mango');
});

test('гамма из панели главнее угаданной по названию', () => {
  const items = [{ id: 'hqd', name: 'HQD', flavors: [{ name: 'Mango', qty: 3 }] }];
  const { api } = box(items, {});
  api.applyStock([row('hqd', 'Mango', { tint: 'berry' })]);
  assert.equal(items[0].flavors[0].tint, 'berry');
  assert.deepEqual(plain(api.flavorColors(items[0].flavors[0])), TINTS[0].c);
});

test('без гаммы цвет по-прежнему подбирается по названию', () => {
  assert.deepEqual(plain(api0.flavorColors({ name: 'Mango', tint: '' })),
    plain(api0.flavorColors('Mango')), 'объект и строка должны давать один цвет');
  assert.deepEqual(plain(api0.flavorColors({ name: 'Mango', tint: 'нет-такой' })),
    plain(api0.flavorColors('Mango')), 'незнакомая гамма не должна ломать цвет');
});

const api0 = box([], {}).api;
