// Разовая выгрузка пачкоматов InPost в статические файлы data/inpost/<город>.json.
// Публичный справочник точек ShipX ключа не требует, поэтому витрине не нужен ни токен,
// ни виджет: список лежит в проекте и грузится по требованию.
// Запуск: node server/inpost-fetch.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'inpost');
const API = 'https://api-shipx-pl.easypack24.net/v1/points';
const CITIES = { katowice: 'Katowice', gliwice: 'Gliwice', warszawa: 'Warszawa' };

async function page(city, n) {
  const url = `${API}?city=${encodeURIComponent(city)}&type=parcel_locker&status=Operating&per_page=500&page=${n}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(city + ' страница ' + n + ': ' + res.status);
  return res.json();
}

mkdirSync(OUT, { recursive: true });
for (const [key, city] of Object.entries(CITIES)) {
  const all = [];
  let n = 1, pages = 1;
  do {
    const d = await page(city, n);
    pages = d.total_pages || 1;
    for (const it of d.items || []) {
      const a = it.address || {};
      const street = (a.line1 || '').trim();
      const post = ((a.line2 || '').match(/\d{2}-\d{3}/) || [''])[0];
      if (!it.name || !street) continue;
      all.push({ c: it.name, a: street, p: post, d: (it.location_description || '').trim().slice(0, 80) });
    }
    n++;
  } while (n <= pages);
  all.sort((x, y) => x.a.localeCompare(y.a, 'pl'));
  writeFileSync(join(OUT, key + '.json'), JSON.stringify(all), 'utf8');
  console.log(key + ': ' + all.length + ' пачкоматов');
}
console.log('готово, файлы в data/inpost/');
