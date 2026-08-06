// Описания вкусов от владельца: data/flavors.json. Тексты живут отдельно от каталога, потому
// что один и тот же вкус продаётся в нескольких городах, а описание у него одно.
import test from 'node:test';
import assert from 'node:assert/strict';
import { repoFile, CORE_SRC } from './helpers/core-src.mjs';

const BOOK = JSON.parse(repoFile('data/flavors.json'));
const products = Object.entries(BOOK).filter(([k]) => k !== '_');
const entries = products.flatMap(([pid, book]) =>
  Object.entries(book).map(([flavor, v]) => ({ pid, flavor, v })));

test('справочник не пуст и разложен по товарам', () => {
  assert.ok(products.length >= 2, 'товаров в справочнике подозрительно мало');
  assert.ok(entries.length >= 70, 'описаний меньше, чем прислал владелец');
});

test('у каждого вкуса есть все три языка', () => {
  const bad = entries
    .filter((e) => !['ru', 'uk', 'pl'].every((l) => typeof e.v[l] === 'string' && e.v[l].trim()))
    .map((e) => e.pid + '/' + e.flavor);
  assert.deepEqual(bad, [], 'у этих вкусов не хватает языка');
});

test('перевод не остался русским', () => {
  const same = entries
    .filter((e) => e.v.uk === e.v.ru || e.v.pl === e.v.ru)
    .map((e) => e.pid + '/' + e.flavor);
  assert.deepEqual(same, [], 'эти описания не переведены');
});

test('в польском тексте нет кириллицы', () => {
  const bad = entries.filter((e) => /[А-Яа-яЁёІіЇїЄє]/.test(e.v.pl)).map((e) => e.pid + '/' + e.flavor);
  assert.deepEqual(bad, [], 'в польский текст затесалась кириллица');
});

test('описания не обрублены', () => {
  const short = entries
    .filter((e) => ['ru', 'uk', 'pl'].some((l) => e.v[l].length < 40 || !/[.!?]$/.test(e.v[l].trim())))
    .map((e) => e.pid + '/' + e.flavor);
  assert.deepEqual(short, [], 'эти описания слишком коротки или без точки в конце');
});

test('имена вкусов не повторяются внутри товара', () => {
  for (const [pid, book] of products) {
    const norm = Object.keys(book).map((k) => k.toLowerCase().replace(/[\s_-]+/g, ' ').trim());
    assert.equal(new Set(norm).size, norm.length, pid + ': вкус описан дважды');
  }
});

// Каталог пишет вкусы как придётся («Cola ice» против «Cola Ice»), поэтому сверка идёт по
// упрощённому виду. Если это правило уберут, описания молча перестанут находиться.
test('витрина ищет описание без оглядки на регистр и пробелы', () => {
  const at = CORE_SRC.indexOf('const descKey =');
  assert.ok(at > 0, 'не найдено приведение имени вкуса');
  const line = CORE_SRC.slice(at, CORE_SRC.indexOf('\n', at));
  assert.match(line, /toLowerCase\(\)/, 'регистр перестал приводиться');
  assert.match(line, /replace\(/, 'пробелы перестали приводиться');
});

test('описание владельца важнее собранного по вкусовому профилю', () => {
  const at = CORE_SRC.indexOf('function flavorDesc(');
  const body = CORE_SRC.slice(at, CORE_SRC.indexOf('\n  }', at));
  assert.ok(body.indexOf('ownerDesc') < body.indexOf('DESC_LEAD'),
    'сборка по профилю не должна опережать текст владельца');
});
