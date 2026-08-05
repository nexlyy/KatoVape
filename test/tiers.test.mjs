// Оптовая лесенка: владелец просил три ступени, 3/5/10, и чтобы они были у всего
// ассортимента, а не у пяти позиций, как было раньше.
import test from 'node:test';
import assert from 'node:assert/strict';
import { repoFile, CORE_SRC } from './helpers/core-src.mjs';

const FILES = ['data/products.json', 'data/gliwice.json', 'data/warszawa.json'];
const items = [];
for (const f of FILES) {
  const data = JSON.parse(repoFile(f));
  for (const cat of data.categories || []) {
    for (const it of cat.items || []) items.push({ file: f, ...it });
  }
}

test('ступени заданы у каждого товара с ценой', () => {
  const without = items
    .filter((it) => Number(it.price) > 0 && !(it.tiers && it.tiers.length))
    .map((it) => it.file + ':' + it.id);
  assert.deepEqual(without, [], 'у этих товаров нет оптовых ступеней');
});

test('ступени именно 3, 5 и 10', () => {
  const wrong = items.filter((it) => it.tiers && it.tiers.length).filter((it) => {
    const q = it.tiers.map((x) => +x.q).filter((n) => n > 1).sort((a, b) => a - b);
    return q.join(',') !== '3,5,10';
  }).map((it) => it.file + ':' + it.id);
  assert.deepEqual(wrong, [], 'лесенка отличается от 3/5/10');
});

test('чем больше берёшь, тем дешевле штука', () => {
  const bad = [];
  for (const it of items) {
    if (!(it.tiers && it.tiers.length)) continue;
    const sorted = [...it.tiers].sort((a, b) => a.q - b.q);
    for (let i = 1; i < sorted.length; i++) {
      if (Number(sorted[i].p) > Number(sorted[i - 1].p)) bad.push(it.file + ':' + it.id);
    }
  }
  assert.deepEqual([...new Set(bad)], [], 'у этих товаров опт дороже розницы');
});

test('розничная ступень совпадает с ценой товара', () => {
  const bad = items
    .filter((it) => it.tiers && it.tiers.length && Number(it.price) > 0)
    .filter((it) => {
      const one = it.tiers.find((x) => +x.q === 1);
      return one && Number(one.p) !== Number(it.price);
    })
    .map((it) => it.file + ':' + it.id);
  assert.deepEqual(bad, [], 'первая ступень разошлась с ценой');
});

// Кнопка «1 шт» из ряда убрана: это не ступень, а розница, и в ряду она читалась как
// четвёртый вариант количества.
test('витрина показывает только настоящие ступени', () => {
  const at = CORE_SRC.indexOf('const steps = tiers ?');
  assert.ok(at > 0, 'не найден расчёт ступеней в карточке товара');
  const line = CORE_SRC.slice(at, CORE_SRC.indexOf('\n', at));
  assert.match(line, /filter\(q => q > 1\)/, 'единица снова попала в ряд ступеней');
});
