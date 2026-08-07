// Каталог читает витрина публичным ключом, поэтому право на products выдано поимённо по
// колонкам, кроме закупочной цены. Оборотная сторона: новая колонка окажется закрытой от
// витрины, и товар молча перестанет отдаваться, если её забудут дописать в список.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { repoFile } from './helpers/core-src.mjs';

const DIR = 'supabase/migrations/';
const files = readdirSync(new URL('../' + DIR, import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const all = files.map((f) => repoFile(DIR + f)).join('\n');

// Колонки products собираем из миграций: create table плюс каждое add column.
function productColumns() {
  const cols = [];
  const created = all.match(/create table if not exists public\.products \(([\s\S]*?)\n\);/);
  assert.ok(created, 'не нашлось создание таблицы products');
  for (const line of created[1].split('\n')) {
    const m = line.trim().match(/^([a-z_]+)\s+(text|integer|boolean|timestamptz|jsonb|numeric)/);
    if (m) cols.push(m[1]);
  }
  for (const m of all.matchAll(/alter table public\.products\s+add column if not exists ([a-z_]+)/g)) {
    if (!cols.includes(m[1])) cols.push(m[1]);
  }
  // Колонку могли и убрать: гамма пожила в products, пока не уехала в flavor_meta.
  for (const m of all.matchAll(/alter table public\.products\s+drop column if exists ([a-z_]+)/g)) {
    const at = cols.indexOf(m[1]);
    if (at >= 0) cols.splice(at, 1);
  }
  return cols;
}

// Выдач может быть несколько: колонку добавляют — список прав переписывают целиком.
// Действует последняя, миграции идут по порядку.
const GRANTS = [...all.matchAll(/grant select \(([^)]+)\)\s*\n?\s*on public\.products to anon/g)];
const GRANT = GRANTS[GRANTS.length - 1];

test('право на каталог выдано поимённо, а не на всю таблицу', () => {
  assert.ok(/revoke select on public\.products from anon/.test(all), 'общее право у анонима не забрано');
  assert.ok(GRANT, 'нет поколоночной выдачи прав анониму');
});

test('анониму открыто всё, кроме закупочной цены', () => {
  const granted = GRANT[1].split(',').map((s) => s.trim()).filter(Boolean);
  const cols = productColumns();
  assert.ok(cols.includes('cost'), 'в таблице нет колонки cost, тест устарел');
  assert.ok(!granted.includes('cost'), 'закупочная цена открыта витрине');
  const forgotten = cols.filter((c) => c !== 'cost' && !granted.includes(c));
  assert.deepEqual(forgotten, [], 'эти колонки закрыты от витрины: допишите их в 0053');
  const extra = granted.filter((c) => !cols.includes(c));
  assert.deepEqual(extra, [], 'в списке прав есть колонки, которых нет в таблице');
});

test('витрина не просит закупочную цену', () => {
  const core = repoFile('shared/core.js');
  const sel = core.match(/select=id,flavor,price,qty,tiers,hit,labels/);
  assert.ok(sel, 'не найден запрос каталога, проверьте, что он не начал брать всё подряд');
  assert.ok(!/products\?[^']*select=\*/.test(core), 'витрина просит все колонки, закупка утечёт');
  assert.ok(!/flavor_meta\?[^']*select=\*/.test(core), 'настройки вкуса тоже просим поимённо');
});
