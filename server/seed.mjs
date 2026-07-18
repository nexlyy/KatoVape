// Разовая заливка ассортимента из data/*.json в Supabase (таблица products).
// Дальше остатки и цены правит менеджер в админке, файлы остаются запасным каталогом.
// Запуск: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node server/seed.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUPA = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
if (!SUPA || !KEY) {
  console.error('нужны SUPABASE_URL и SUPABASE_SERVICE_KEY в окружении');
  process.exit(1);
}

const FILES = {
  katowice: 'data/products.json',
  gliwice: 'data/gliwice.json',
  warszawa: 'data/warszawa.json'
};

const rows = [];
for (const [city, file] of Object.entries(FILES)) {
  let db;
  try { db = JSON.parse(readFileSync(join(ROOT, file), 'utf8')); }
  catch (e) { console.error('пропускаю ' + file + ': ' + e.message); continue; }
  for (const cat of db.categories || []) {
    for (const it of cat.items || []) {
      const base = {
        id: it.id, city, category: cat.id, name: it.name,
        brand: (it.name || '').split(' ')[0], price: it.price || null,
        nic: it.nic || null, updated_at: new Date().toISOString()
      };
      if (it.flavors && it.flavors.length) {
        for (const f of it.flavors) rows.push({ ...base, flavor: f.name, qty: f.qty || 0 });
      } else {
        rows.push({ ...base, flavor: '', qty: it.qty || 0 });
      }
    }
  }
}

console.log('позиций к заливке: ' + rows.length);
const res = await fetch(SUPA + '/rest/v1/products?on_conflict=id,city,flavor', {
  method: 'POST',
  headers: {
    apikey: KEY, Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json', 'User-Agent': 'katovape-seed/1.0',
    Prefer: 'resolution=merge-duplicates,return=minimal'
  },
  body: JSON.stringify(rows)
});
if (!res.ok) {
  console.error('ошибка ' + res.status + ': ' + (await res.text()).slice(0, 300));
  process.exit(1);
}
console.log('готово, ассортимент в Supabase');
