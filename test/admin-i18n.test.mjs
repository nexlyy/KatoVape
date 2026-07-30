import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { repoFile } from './helpers/core-src.mjs';

const SRC = repoFile('demos/admin/index.html');

const keys = [...new Set([...SRC.matchAll(/L\('([^']*)'\)/g)].map((m) => m[1]))];

const DICT = (() => {
  const start = SRC.indexOf('const DICT = ');
  const end = SRC.indexOf('const ADM_LANGS', start);
  const box = { out: null };
  vm.createContext(box);
  vm.runInContext(SRC.slice(start, end) + '\nout = DICT;', box);
  return box.out;
})();

test('панель переводит все свои строки на украинский и польский', () => {
  assert.ok(keys.length > 200, 'ключей подозрительно мало: ' + keys.length);
  for (const lang of ['uk', 'pl']) {
    const missing = keys.filter((k) => !(k in DICT[lang]));
    assert.deepEqual(missing, [], 'нет перевода на ' + lang);
  }
});

test('в словаре нет пустых переводов', () => {
  for (const lang of ['uk', 'pl']) {
    for (const [key, value] of Object.entries(DICT[lang])) {
      assert.ok(String(value).trim().length, lang + ': пустой перевод для «' + key + '»');
    }
  }
});

test('польский перевод не остался русским текстом', () => {
  // Кириллица в польской строке почти всегда значит забытый перевод. Исключение —
  // строки, где переводить нечего.
  const skip = new Set(['шт', 'Хит', 'Бренд', 'Код', 'Роль', 'Тип', 'Статус', 'Текст', 'Дата']);
  const cyrillic = Object.entries(DICT.pl)
    .filter(([k, v]) => !skip.has(k) && /[А-Яа-яЁё]/.test(v))
    .map(([k]) => k);
  assert.deepEqual(cyrillic, [], 'эти строки не переведены на польский');
});

test('переключатель языка знает про три языка', () => {
  const m = SRC.match(/const ADM_LANGS = (\[.*?\]);/s);
  assert.ok(m, 'список языков не найден');
  const box = { out: null };
  vm.createContext(box);
  vm.runInContext('out = ' + m[1] + ';', box);
  assert.equal(Array.from(box.out, (x) => x[0]).join(','), 'ru,uk,pl');
});
