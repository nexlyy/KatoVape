// Stamps ?v=<hash> onto the shared scripts in every HTML page.
//
// Versions used to be bumped by hand in three files and were reliably forgotten, leaving
// people with a cached core.js and therefore the old pricing. The hash comes from the file
// contents, so a changed file changes the URL and the cache refreshes itself.
//
//   npm run stamp        write the versions
//   npm run stamp:check  verify only, for CI or a pre-commit hook
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

// Pages to walk and scripts to stamp in them.
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
    // Only inside src="...": the file name also appears in plain prose (a hint telling the
    // manager to fill in shared/config.js) and must not be stamped there.
    // Matches both an existing ?v=... and a link with no version at all.
    const re = new RegExp('(src=["\'][^"\']*shared/' + name.replace('.', '\\.') + ')(\\?v=[^"\']*)?', 'g');
    after = after.replace(re, '$1?v=' + v);
  }
  if (after === before) continue;
  changed++;
  if (!check) writeFileSync(new URL(page, ROOT), after);
  console.log((check ? 'устарело: ' : 'обновлено: ') + page);
}

// Отпечаток самой страницы панели.
//
// Скрипты обновляются сами, потому что у них в адресе хеш. С самой страницей так нельзя: её
// адрес фиксирован, а GitHub Pages отдаёт её с Cache-Control на десять минут, и браузер потом
// ещё долго держит копию. Отсюда повторяющееся «изменений нет»: человек смотрит на вчерашнюю
// панель. Поэтому рядом лежит version.json, который панель читает мимо кеша и сравнивает со
// своим отпечатком: не совпало, значит копия старая, и страница перезагружает себя один раз.
const PANEL = 'demos/admin/index.html';
const panelBody = read(PANEL).replace(/const BUILD = '[^']*'/, "const BUILD = ''");
const build = createHash('sha256').update(panelBody).digest('hex').slice(0, 8);

const stampedPanel = read(PANEL).replace(/const BUILD = '[^']*'/, "const BUILD = '" + build + "'");
if (stampedPanel !== read(PANEL)) {
  changed++;
  if (!check) writeFileSync(new URL(PANEL, ROOT), stampedPanel);
  console.log((check ? 'устарело: ' : 'обновлено: ') + PANEL + ' (отпечаток сборки)');
}
if (!check) writeFileSync(new URL('demos/admin/version.json', ROOT), JSON.stringify({ build }) + '\n');

if (!changed) {
  console.log('версии скриптов актуальны');
} else if (check) {
  console.error('\nВерсии скриптов отстали от содержимого. Запустите: npm run stamp');
  process.exit(1);
}
