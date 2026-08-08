import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { repoFile } from './helpers/core-src.mjs';

const box = { window: {}, document: null, URL, Blob, TextEncoder, Date, Math, Number, String, Set, console };
box.globalThis = box;
vm.createContext(box);
vm.runInContext(repoFile('demos/admin/export.js'), box);
const X = box.window.KVExport;

const DATA = {
  from: '2026-07-01', to: '2026-07-31',
  cityLabel: { katowice: 'Katowice', gliwice: 'Gliwice' },
  kpi: { revenue_period: 12345, avg_check: 87, orders: 42, orders_done: 40, orders_cancelled: 2,
    res_conversion: 75, promo_used: 5, users_new: 9, users_active: 21, reviews: 4, reviews_avg: 4.5,
    revenue_week: 1000, revenue_month: 12345, revenue_year: 99999, revenue_total: 123456, discount_total: 300 },
  fin: { by_city: [
    { city: 'katowice', orders: 30, revenue: 9000, cogs: 5000, gross: 4000, payout: 400, expenses: 200, write_offs: 50, profit: 3350 },
    { city: 'gliwice', orders: 12, revenue: 3345, cogs: 1800, gross: 1545, payout: 150, expenses: 100, write_offs: 0, profit: 1295 }
  ], shared_expenses: 120 },
  stock: { totals: { stock_qty: 111, stock_cost: 4200, in_qty: 50, in_cost: 1500, sold_qty: 42, sold_cost: 1300, written_qty: 3, written_cost: 90 } },
  products: { top_qty: [{ name: 'Elf Liq «Peach»', qty: 12 }], top_revenue: [{ name: 'HQD', revenue: 800 }] },
  managers: { managers: [{ telegram_id: 855010368, city: 'gliwice', orders: 12, done: 11, cancelled: 1, revenue: 3345, avg_hours: 2.5 }] },
  customers: { top: [{ name: 'Иван <Петров> & Co', orders: 5, done: 5, spent: 900 }] }
};

const LANGS = ['ru', 'uk', 'pl'];

function unzip(bytes) {
  const buf = Buffer.from(bytes);
  const files = {};
  let at = 0;
  while (at + 4 <= buf.length && buf.readUInt32LE(at) === 0x04034b50) {
    const nameLen = buf.readUInt16LE(at + 26), extraLen = buf.readUInt16LE(at + 28);
    const size = buf.readUInt32LE(at + 18), crc = buf.readUInt32LE(at + 14);
    const method = buf.readUInt16LE(at + 8);
    const name = buf.slice(at + 30, at + 30 + nameLen).toString('utf8');
    const start = at + 30 + nameLen + extraLen;
    const data = buf.slice(start, start + size);
    assert.equal(method, 0, name + ': ожидали хранение без сжатия');
    assert.equal(typeof zlib.crc32, 'function', 'в этом Node нет zlib.crc32, проверка была бы пустой');
    assert.equal(zlib.crc32(data), crc, name + ': контрольная сумма не сошлась');
    files[name] = data.toString('utf8');
    at = start + size;
  }
  assert.equal(buf.readUInt32LE(at), 0x02014b50, 'после файлов должен идти каталог архива');
  return files;
}
const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

test('отчёт собирается на всех трёх языках и разделы совпадают', () => {
  const ids = LANGS.map((l) => X.build(l, DATA).sections.length);
  assert.ok(ids[0] >= 8, 'разделов подозрительно мало');
  assert.deepEqual(ids, [ids[0], ids[0], ids[0]], 'число разделов разошлось между языками');
  for (const l of LANGS) {
    const rep = X.build(l, DATA);
    assert.ok(rep.title.includes('KatoVape'));
    assert.ok(rep.period.includes('2026-07-01') && rep.period.includes('2026-07-31'));
    for (const s of rep.sections) {
      assert.ok(s.title && s.head.length, 'у раздела нет заголовка или шапки');
      for (const r of s.rows) assert.equal(r.length, s.head.length, s.title + ': строка не по шапке');
    }
  }
});

test('заголовки отчёта переведены, а не оставлены русскими', () => {
  const ru = X.build('ru', DATA).sections.map((s) => s.title).join('|');
  for (const l of ['uk', 'pl']) {
    assert.notEqual(X.build(l, DATA).sections.map((s) => s.title).join('|'), ru, l + ': заголовки не переведены');
  }
  const pl = JSON.stringify(X.build('pl', DATA).sections.map((s) => [s.title, s.head]));
  assert.ok(!/[А-Яа-яЁё]/.test(pl), 'в польском отчёте осталась кириллица');
});

test('CSV: разделитель, экранирование и метка кодировки', async () => {
  const blob = X.csv(X.build('ru', DATA));
  const raw = Buffer.from(await blob.arrayBuffer());
  assert.deepEqual([...raw.slice(0, 3)], [0xEF, 0xBB, 0xBF], 'нет метки кодировки, Excel покажет кракозябры');
  const text = await blob.text();
  assert.ok(text.includes(';'), 'ожидали точку с запятой как разделитель');
  assert.ok(text.includes('"Иван <Петров> & Co"') || text.includes('Иван <Петров> & Co'),
    'имя клиента потерялось');
  assert.ok(text.split('\r\n').length > 20, 'строк подозрительно мало');
});

test('CSV: кавычки внутри значения удваиваются', async () => {
  const rep = X.build('ru', { ...DATA, customers: { top: [{ name: 'Он сказал "да"; и ушёл', orders: 1, done: 1, spent: 10 }] } });
  const text = await X.csv(rep).text();
  assert.ok(text.includes('"Он сказал ""да""; и ушёл"'), 'кавычки и разделитель не экранированы');
});

test('XLSX: архив собран правильно и лист на каждый раздел', async () => {
  const rep = X.build('pl', DATA);
  const files = unzip(await bytesOf(X.xlsx(rep)));
  assert.ok(files['[Content_Types].xml'], 'нет описания типов');
  assert.ok(files['_rels/.rels'], 'нет корневых связей');
  assert.ok(files['xl/workbook.xml'], 'нет книги');
  assert.ok(files['xl/_rels/workbook.xml.rels'], 'нет связей книги');
  for (let i = 1; i <= rep.sections.length; i++) {
    assert.ok(files['xl/worksheets/sheet' + i + '.xml'], 'нет листа ' + i);
  }
  const rels = files['xl/_rels/workbook.xml.rels'];
  for (let i = 1; i <= rep.sections.length; i++) {
    assert.ok(rels.includes('worksheets/sheet' + i + '.xml'), 'лист ' + i + ' не подключён к книге');
  }
  assert.equal((files['xl/workbook.xml'].match(/<sheet /g) || []).length, rep.sections.length);
});

test('XLSX: числа лежат числами, текст текстом и экранирован', async () => {
  const files = unzip(await bytesOf(X.xlsx(X.build('ru', DATA))));
  const all = Object.keys(files).filter((n) => n.startsWith('xl/worksheets/')).map((n) => files[n]).join('');
  assert.ok(all.includes('<v>12345</v>'), 'доход не записан числом');
  assert.ok(all.includes('t="inlineStr"'), 'текстовые ячейки не помечены');
  assert.ok(all.includes('&lt;Петров&gt;') && all.includes('&amp;'), 'угловые скобки и амперсанд не экранированы');
  assert.ok(!/<t[^>]*>[^<]*<[^/]/.test(all), 'в текст просочилась разметка');
});

test('XLSX: имена листов не длиннее 31 знака и не повторяются', () => {
  const used = new Set();
  const names = ['Очень длинный заголовок раздела, который Excel не примет', 'Одно и то же', 'Одно и то же']
    .map((t, i) => X.sheetName(t, i, used));
  for (const n of names) assert.ok(n.length <= 31, 'имя листа длиннее 31 знака: ' + n);
  assert.equal(new Set(names).size, names.length, 'имена листов повторяются');
});

test('буквы столбцов считаются как в Excel', () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52].map(X.colName), ['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
});

test('DOCX: архив собран и таблицы на месте', async () => {
  const rep = X.build('uk', DATA);
  const files = unzip(await bytesOf(X.docx(rep)));
  assert.ok(files['[Content_Types].xml'] && files['_rels/.rels'], 'нет служебных частей');
  const doc = files['word/document.xml'];
  assert.ok(doc, 'нет самого текста');
  assert.equal((doc.match(/<w:tbl>/g) || []).length, rep.sections.length, 'таблиц не столько, сколько разделов');
  assert.ok(doc.includes('KatoVape'), 'нет заголовка');
  assert.ok(doc.includes('&lt;Петров&gt;'), 'текст не экранирован');
  assert.ok(doc.endsWith('</w:document>'), 'документ не закрыт');
});

test('DOCX: в таблице столько строк, сколько в разделе', async () => {
  const rep = X.build('ru', DATA);
  const doc = unzip(await bytesOf(X.docx(rep)))['word/document.xml'];
  const rows = (doc.match(/<w:tr>/g) || []).length;
  const want = rep.sections.reduce((n, s) => n + s.rows.length + 1, 0);
  assert.equal(rows, want, 'строк в документе не столько, сколько данных');
});

test('страница печати: заголовки, таблицы и экранирование', () => {
  const html = X.printHTML(X.build('pl', DATA));
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('lang="pl"'), 'не проставлен язык страницы');
  assert.ok(html.includes('&lt;Петров&gt;'), 'текст не экранирован');
  assert.ok(html.includes('@page'), 'нет настроек печати');
  assert.equal((html.match(/<table>/g) || []).length, X.build('pl', DATA).sections.length);
});

test('имя файла содержит язык и дату', () => {
  const name = X.fileName(X.build('uk', DATA), 'xlsx');
  assert.match(name, /^katovape-uk-\d{8}\.xlsx$/);
});

test('панель подключает выгрузку и предлагает все четыре формата', () => {
  const panel = repoFile('demos/admin/index.html');
  assert.match(panel, /<script src="\.\/export\.js(\?v=[a-f0-9]+)?"/, 'export.js не подключён');
  for (const f of ['csv', 'xlsx', 'docx', 'pdf']) {
    assert.ok(panel.includes('data-exp="' + f + '"'), 'нет кнопки ' + f);
  }
  assert.ok(panel.includes('id="x_lang"'), 'нет выбора языка документа');
});

test('страница печати всегда светлая', () => {
  const html = X.printHTML(X.build('ru', DATA));
  assert.match(html, /color-scheme:\s*light/, 'не задана светлая схема');
  assert.match(html, /html,body\{background:#fff/, 'у страницы нет белого фона');
  assert.match(html, /td\{[^}]*background:#fff/, 'у ячеек нет белого фона');
});

test('выгрузка версионируется, иначе браузер отдаст вчерашнюю', () => {
  const panel = repoFile('demos/admin/index.html');
  assert.match(panel, /src="\.\/export\.js\?v=[a-f0-9]{8}"/, 'export.js подключён без отпечатка');
});
