// Ярлыки товара и порядок каталога. Ярлык назначается только в панели (products.hit);
// раньше второй источник лежал в data/meta.json — оттуда брался «хит» у HQD, невидимый
// в панели, и он же рисовался вторым, когда галочку всё-таки ставили.
import test from 'node:test';
import assert from 'node:assert/strict';
import { slice, sandbox, repoFile, esc, plain, CORE_SRC } from './helpers/core-src.mjs';

const LBL = { hitBadge: 'Хит', lastFew: 'осталось мало' };
const { api, box } = sandbox(
  [
    slice('function qty(item)', 'function match(item, q)'),
    slice('const BADGES = [', '// Цветная метка вкуса'),
    slice('function applyStock(rows)', '// вкусы показываем на английском')
  ],
  {
    db: { updated: '2026-07-29', categories: [] },
    NEW_DAYS: 14,
    t: (k) => LBL[k] || k,
    ui: (k) => LBL[k] || k,
    esc
  },
  ['badgesOf', 'badgesHTML', 'sortItems', 'status', 'applyStock']
);

const prod = (id, over) => Object.assign({ id, name: id, qty: 50 }, over || {});
const keys = (it) => plain(api.badgesOf(it)).map((b) => b.key);
const ids = (list) => plain(list).map((x) => x.id);

test('без назначенного ярлыка карточка чистая', () => {
  assert.deepEqual(keys(prod('a')), []);
  assert.equal(api.badgesHTML(prod('a')), '');
});

test('ярлык из панели показывается', () => {
  assert.deepEqual(keys(prod('a', { hit: true })), ['hit']);
});

test('снятая галочка убирает ярлык', () => {
  assert.deepEqual(keys(prod('a', { hit: false })), []);
});

test('замена ярлыка: хит снят, зато остаток мал', () => {
  assert.deepEqual(keys(prod('a', { hit: false, qty: 2 })), ['few']);
});

test('несколько ярлыков идут в постоянном порядке', () => {
  assert.deepEqual(keys(prod('a', { hit: true, qty: 2 })), ['hit', 'few']);
});

test('у закончившегося товара «осталось мало» не показываем', () => {
  assert.deepEqual(keys(prod('a', { hit: true, qty: 0 })), ['hit']);
});

test('дублей нет: один «Хит» и один контейнер в разметке', () => {
  const html = api.badgesHTML(prod('a', { hit: true, qty: 2 }));
  assert.equal((html.match(/kv-badge hit/g) || []).length, 1);
  assert.equal((html.match(/kv-badges/g) || []).length, 1);
});

test('hit из базы приходит числом — ярлык всё равно включается', () => {
  assert.deepEqual(keys(prod('a', { hit: 1 })), ['hit']);
});

test('второго источника ярлыков в проекте не осталось', () => {
  assert.ok(!/meta\[/.test(CORE_SRC), 'core.js снова читает meta');
  assert.ok(!/data\/meta\.json'\)/.test(CORE_SRC), 'core.js снова грузит meta.json');
  assert.ok(!/"badges"/.test(repoFile('data/meta.json')), 'в meta.json вернулись badges');
});

test('хиты идут первыми, закончившиеся — последними', () => {
  const cat = [
    prod('p1', { qty: 10 }),
    prod('p2', { qty: 10, hit: true }),
    prod('p3', { qty: 0 }),
    prod('p4', { qty: 10, added: '2026-07-25' }),   // новинка
    prod('p5', { qty: 10, hit: true }),
    prod('p6', { qty: 0, hit: true })               // хит, но его нет
  ];
  assert.deepEqual(ids(api.sortItems(cat)), ['p2', 'p5', 'p4', 'p1', 'p3', 'p6']);
  assert.equal(ids(api.sortItems(cat)).at(-1), 'p6', 'закончившийся хит не должен лезть наверх');
  assert.deepEqual(cat.map((x) => x.id), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], 'исходный массив мутировали');
  const once = ids(api.sortItems(cat));
  assert.deepEqual(ids(api.sortItems(api.sortItems(cat))), once, 'порядок нестабилен');
  assert.deepEqual(plain(api.sortItems([])), []);
});

test('ярлык доезжает из базы до витрины по любой строке вкуса', () => {
  box.db.categories = [{
    id: 'c',
    items: [
      { id: 'hqd', name: 'HQD', flavors: [{ name: 'Black Dragon', qty: 5 }, { name: 'Mango', qty: 3 }] },
      { id: 'puffy', name: 'Puffy', flavors: [{ name: 'Bubble', qty: 4 }] }
    ]
  }];
  const byId = () => Object.fromEntries(box.db.categories[0].items.map((i) => [i.id, i]));

  api.applyStock([
    { id: 'hqd', flavor: 'Black Dragon', qty: 5, hit: false },
    { id: 'hqd', flavor: 'Mango', qty: 3, hit: true },        // галочка стоит на одной строке
    { id: 'puffy', flavor: 'Bubble', qty: 4, hit: false }
  ]);
  assert.deepEqual(keys(byId().hqd), ['hit']);
  assert.deepEqual(keys(byId().puffy), []);

  api.applyStock([
    { id: 'hqd', flavor: 'Black Dragon', qty: 5, hit: false },
    { id: 'hqd', flavor: 'Mango', qty: 3, hit: false }
  ]);
  assert.deepEqual(keys(byId().hqd), []);
});
