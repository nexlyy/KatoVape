// Проставляет ?v=<хеш> у общих скриптов во всех HTML.
//
// Раньше версии правились руками в трёх файлах, и это стабильно забывалось: у людей
// оставался старый core.js из кеша, то есть старый расчёт цен. Хеш считается от
// содержимого файла — поменялся файл, поменялась ссылка, кеш обновился сам.
//
//   npm run stamp        проставить версии
//   npm run stamp:check  только проверить (для CI и хука перед коммитом)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

// какие HTML обходим и какие скрипты в них штампуем
const PAGES = [
  'index.html',
  'demos/vapor/site/index.html',
  'demos/vapor/app/index.html',
  'demos/admin/index.html'
];
const ASSETS = ['config.js', 'core.js', 'auth.js', 'pay.js'];

const hash = (name) => createHash('sha256').update(read('shared/' + name)).digest('hex').slice(0, 8);
const check = process.argv.includes('--check');

const stamps = Object.fromEntries(ASSETS.map((a) => [a, hash(a)]));
let changed = 0;

for (const page of PAGES) {
  const before = read(page);
  let after = before;
  for (const [name, v] of Object.entries(stamps)) {
    // Только внутри src="...": имя файла встречается и в обычном тексте (подсказка
    // «заполните ключ в shared/config.js»), и туда версию дописывать нельзя.
    // Ловим и уже проставленный ?v=..., и ссылку вообще без версии.
    const re = new RegExp('(src=["\'][^"\']*shared/' + name.replace('.', '\\.') + ')(\\?v=[^"\']*)?', 'g');
    after = after.replace(re, '$1?v=' + v);
  }
  if (after === before) continue;
  changed++;
  if (!check) writeFileSync(new URL(page, ROOT), after);
  console.log((check ? 'устарело: ' : 'обновлено: ') + page);
}

if (!changed) {
  console.log('версии скриптов актуальны');
} else if (check) {
  console.error('\nВерсии скриптов отстали от содержимого. Запустите: npm run stamp');
  process.exit(1);
}
