// Разбор списка, который вставляют в поставку. Логика мелкая, но цена ошибки высокая:
// нераспознанная строка либо не попадёт в документ, либо заведёт лишний товар на витрине.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { repoFile, plain } from './helpers/core-src.mjs';

const PANEL = repoFile('demos/admin/index.html');

const box = { out: null };
vm.createContext(box);
{
  const a = PANEL.indexOf('const SUP_SEP = ');
  const b = PANEL.indexOf('async function openSupply(', a);
  assert.ok(a >= 0 && b > a, 'не найден разбор списка поставки');
  vm.runInContext(PANEL.slice(a, b) + '\nout = { parseSupplyBulk, supNum };', box);
}
const { parseSupplyBulk, supNum } = box.out;

// каталог города: товар со вкусами и товар без них
const CAT = [
  { id: 'hqd', flavor: 'Mint' },
  { id: 'hqd', flavor: 'Cola' },
  { id: 'elf-bar-lux-2000', flavor: '' }
];
const parse = (t) => parseSupplyBulk(t, CAT);

test('четыре столбца через точку с запятой', () => {
  const [r] = parse('hqd;Mint;10;12.50');
  assert.equal(r.ok, true);
  assert.deepEqual([r.id, r.flavor, r.qty, r.cost], ['hqd', 'Mint', 10, 12.5]);
  assert.equal(r.err, undefined);
  assert.equal(r.warn, undefined);
});

test('три столбца это товар без вкуса', () => {
  const [r] = parse('elf-bar-lux-2000;5;18');
  assert.equal(r.ok, true);
  assert.deepEqual([r.id, r.flavor, r.qty, r.cost], ['elf-bar-lux-2000', '', 5, 18]);
});

test('пустой второй столбец тоже даёт товар без вкуса', () => {
  const [r] = parse('elf-bar-lux-2000;;5;18');
  assert.equal(r.ok, true);
  assert.equal(r.flavor, '');
});

test('вставка из таблицы: разделитель табуляция', () => {
  const [r] = parse('hqd\tCola\t7\t11');
  assert.equal(r.ok, true);
  assert.deepEqual([r.id, r.flavor, r.qty, r.cost], ['hqd', 'Cola', 7, 11]);
});

test('вертикальная черта тоже разделитель', () => {
  const [r] = parse('hqd|Mint|1|9');
  assert.equal(r.ok, true);
});

test('запятая в цене это дробная часть, а не разделитель столбцов', () => {
  const [r] = parse('hqd;Mint;3;12,50');
  assert.equal(r.ok, true);
  assert.equal(r.cost, 12.5);
});

test('лишнее вокруг числа не мешает', () => {
  const [r] = parse('hqd;Mint;10 шт;12,50 zl');
  assert.equal(r.ok, true);
  assert.deepEqual([r.qty, r.cost], [10, 12.5]);
});

test('пробел как разделитель тысяч не ломает цену', () => {
  assert.equal(supNum('1 234,50'), 1234.5);
});

test('опечатка во вкусе не проходит и подсказывает существующие', () => {
  const [r] = parse('hqd;Minr;10;12');
  assert.equal(r.ok, undefined);
  assert.equal(r.err, 'у этого товара нет такого вкуса');
  assert.equal(r.hint, 'Mint, Cola');
});

test('неизвестный товар пропускается, но помечен', () => {
  const [r] = parse('vozol-prime;Berry;4;20');
  assert.equal(r.ok, true);
  assert.equal(r.warn, 'товара нет в городе, поставка заведёт новый');
});

test('количество должно быть больше нуля', () => {
  assert.equal(parse('hqd;Mint;0;12')[0].err, 'не понял количество');
  assert.equal(parse('hqd;Mint;-5;12')[0].err, 'не понял количество');
  assert.equal(parse('hqd;Mint;;12')[0].err, 'не понял количество');
});

test('отрицательная закупка это ошибка, а не модуль числа', () => {
  assert.equal(parse('hqd;Mint;5;-12')[0].err, 'не понял закупочную цену');
});

test('нечисловая цена не превращается в ноль', () => {
  assert.equal(parse('hqd;Mint;5;уточнить')[0].err, 'не понял закупочную цену');
});

test('двух столбцов мало', () => {
  assert.equal(parse('hqd;10')[0].err, 'мало столбцов');
});

test('пустые строки пропускаются, нумерация идёт по значимым', () => {
  const rows = parse('\n  \nhqd;Mint;1;9\n\nhqd;Cola;2;9\n   ');
  assert.equal(rows.length, 2);
  assert.deepEqual(plain(rows.map((r) => r.n)), [1, 2]);
});

test('дробное количество округляется до штук', () => {
  assert.equal(parse('hqd;Mint;2.6;9')[0].qty, 3);
});

test('весь список целиком: считаются и годные, и битые', () => {
  const rows = parse([
    'hqd;Mint;10;12,50',
    'hqd;Minr;5;12',
    'elf-bar-lux-2000;3;18',
    'hqd;Cola;0;9'
  ].join('\n'));
  assert.equal(rows.length, 4);
  assert.equal(rows.filter((r) => r.ok).length, 2);
  assert.equal(rows.filter((r) => r.err).length, 2);
});
