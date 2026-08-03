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
  // Кириллица в польской строке почти всегда значит забытый перевод. Исключение: 
  // строки, где переводить нечего.
  const skip = new Set(['шт', 'Хит', 'Бренд', 'Код', 'Роль', 'Тип', 'Статус', 'Текст', 'Дата']);
  const cyrillic = Object.entries(DICT.pl)
    .filter(([k, v]) => !skip.has(k) && /[А-Яа-яЁё]/.test(v))
    .map(([k]) => k);
  assert.deepEqual(cyrillic, [], 'эти строки не переведены на польский');
});

// Прежний набор проверял только аргументы L('...'), поэтому строки, написанные в вёрстке
// напрямую, проходили мимо: кнопка рассылки, подсказки раздела «Доступ», подписи диапазонов
// дашборда и способы получения оставались русскими на украинском и польском.
// Правило простое: любой русский текст в коде панели обязан быть ключом словаря. Тогда он
// либо уже идёт через L(), либо это таблица исходных строк, которую переводят при выводе.
test('в панели нет русского текста мимо словаря', () => {
  const code = SRC.slice(SRC.indexOf('<script type="module">'), SRC.lastIndexOf('</script>'))
    // Блочный комментарий считаем только с начала строки: иначе accept="image/*" в разметке
    // открывает мнимый комментарий, и проверка молча пропускает всё до следующего «*/».
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, ' ')
    // комментарий до конца строки, но не «//» из адреса вроде https://
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(SRC.slice(SRC.indexOf('const DICT = '), SRC.indexOf('const ADM_LANGS')), ' ');
  // часть ключей заканчивается пробелом («Сохранено: »), к ним подставляют число
  const keys = new Set(Object.keys(DICT.uk).map((k) => k.trim()));
  const missed = new Set();
  // Режем по символам, которые не встречаются внутри подписи: кавычки, скобки шаблона,
  // теги. Остаются куски текста ровно того размера, каким они попадают на экран.
  for (const chunk of code.split(/['"`<>{}$\n]+/)) {
    const s = chunk.replace(/\s+/g, ' ').trim();
    if (/[А-Яа-яЁё]/.test(s) && !keys.has(s)) missed.add(s);
  }
  assert.deepEqual([...missed], [], 'эти строки не переводятся');
});

test('подписи не заморожены на языке загрузки', () => {
  // Константы уровня модуля считаются один раз, поэтому L() внутри них означает, что после
  // переключения языка статусы и роли останутся на прежнем. Русский тут должен быть исходником.
  for (const name of ['ROLE_RU', 'ST', 'DELIV_LABEL', 'DASH_RANGES', 'MOVE_RU']) {
    const m = SRC.match(new RegExp('const ' + name + ' = ([\\s\\S]*?);\\n'));
    assert.ok(m, name + ' не найден');
    assert.ok(!/\bL\(/.test(m[1]), name + ': L() в константе уровня модуля');
  }
});

test('переключатель языка знает про три языка', () => {
  const m = SRC.match(/const ADM_LANGS = (\[.*?\]);/s);
  assert.ok(m, 'список языков не найден');
  const box = { out: null };
  vm.createContext(box);
  vm.runInContext('out = ' + m[1] + ';', box);
  assert.equal(Array.from(box.out, (x) => x[0]).join(','), 'ru,uk,pl');
});
