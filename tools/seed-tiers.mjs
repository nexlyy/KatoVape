// Проставляет оптовые ступени 3/5/10 всем товарам в data/*.json.
//
// Владелец просил, чтобы схема была у всего ассортимента, а настоящие цены он потом
// выставит в панели. Ступени тут ЗАГОТОВКА: та же лесенка, что он уже задал руками у пяти
// позиций (минус 10, 17 и 25 процентов от розницы), округлённая до злотого.
//
// Живые цены всё равно приходят из базы и перекрывают файл, поэтому правка в панели
// отменяет эти числа, а не спорит с ними.
//
//   npm run tiers          проставить недостающие
//   npm run tiers -- --all перезаписать даже там, где ступени уже заданы
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const FILES = ['data/products.json', 'data/gliwice.json', 'data/warszawa.json'];
const STEPS = [[3, 0.10], [5, 0.17], [10, 0.25]];
const all = process.argv.includes('--all');

let touched = 0, skipped = 0, noPrice = 0;
for (const f of FILES) {
  const url = new URL(f, ROOT);
  const data = JSON.parse(readFileSync(url, 'utf8'));
  for (const cat of data.categories || []) {
    for (const it of cat.items || []) {
      if (it.tiers && it.tiers.length && !all) { skipped++; continue; }
      const base = Number(it.price);
      if (!Number.isFinite(base) || base <= 0) { noPrice++; continue; }
      it.tiers = [{ q: 1, p: base }].concat(
        STEPS.map(([q, off]) => ({ q, p: Math.round(base * (1 - off)) })),
      );
      touched++;
    }
  }
  writeFileSync(url, JSON.stringify(data, null, 2) + '\n');
}
console.log('ступени проставлены: ' + touched + ', пропущено (уже были): ' + skipped +
  (noPrice ? ', без цены: ' + noPrice : ''));
