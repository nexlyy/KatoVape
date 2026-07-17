// Синхронизация ассортимента из Google Sheets.
// Проще всего: в таблице «Файл → Поделиться → Опубликовать в интернете → CSV»,
// полученный URL кладём в env KV_SHEETS_CSV. Здесь тянем CSV и заливаем в products.
// Колонки (первая строка — заголовки): city, category, id, name, brand, flavor, price, qty, nic
import { db } from './db.mjs';

const CSV_URL = process.env.KV_SHEETS_CSV || '';

// маленький разбор CSV с поддержкой кавычек
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length && r.some(x => x.trim() !== ''));
}

const upsert = db.prepare(
  `insert into products (id, city, category, name, brand, flavor, price, qty, nic, updated_at)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
   on conflict(id, city, flavor) do update set
     category=excluded.category, name=excluded.name, brand=excluded.brand,
     price=excluded.price, qty=excluded.qty, nic=excluded.nic, updated_at=datetime('now')`);

export function configured() { return !!CSV_URL; }

export async function syncSheets() {
  if (!CSV_URL) throw new Error('KV_SHEETS_CSV не задан');
  const res = await fetch(CSV_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error('sheets http ' + res.status);
  const rows = parseCSV(await res.text());
  if (rows.length < 2) return { rows: 0 };
  const head = rows[0].map(h => h.trim().toLowerCase());
  const idx = n => head.indexOf(n);
  const col = { city: idx('city'), category: idx('category'), id: idx('id'), name: idx('name'),
    brand: idx('brand'), flavor: idx('flavor'), price: idx('price'), qty: idx('qty'), nic: idx('nic') };
  let n = 0;
  const tx = db.prepare('begin'); const commit = db.prepare('commit');
  tx.run();
  try {
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r], get = c => (col[c] >= 0 ? (row[col[c]] || '').trim() : '');
      const id = get('id'); if (!id) continue;
      upsert.run(id, get('city') || 'katowice', get('category'), get('name'), get('brand'),
        get('flavor'), Number(get('price')) || null, Number(get('qty')) || 0, get('nic'));
      n++;
    }
    commit.run();
  } catch (e) { db.prepare('rollback').run(); throw e; }
  return { rows: n };
}

// после синка: позиции с qty>0, на которые есть ожидающая бронь
export function reservationsNowInStock() {
  return db.prepare(
    `select r.* from reservations r
     join products p on p.id = r.product_id and p.city = r.city
       and (r.flavor = '' or p.flavor = r.flavor)
     where r.status = 'waiting' and p.qty > 0
     group by r.id`).all();
}
