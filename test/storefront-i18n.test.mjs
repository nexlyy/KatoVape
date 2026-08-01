import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { repoFile } from './helpers/core-src.mjs';

// Both dictionaries are plain object literals, so they can be evaluated on their own.
// The closing brace is found by counting, because the strings themselves contain braces.
function dictOf(file, mark) {
  const src = repoFile(file);
  const start = src.indexOf(mark);
  assert.ok(start >= 0, 'словарь не найден в ' + file);
  let i = src.indexOf('{', start), depth = 0, quote = null;
  const open = i;
  for (; i < src.length; i++) {
    const c = src[i], prev = src[i - 1];
    if (quote) { if (c === quote && prev !== '\\') quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  const box = { out: null };
  vm.createContext(box);
  vm.runInContext('out = ' + src.slice(open, i + 1) + ';', box);
  return box.out;
}

const STR = dictOf('shared/core.js', 'const STR = {');
const AUTH = dictOf('shared/auth.js', 'const L = {');

for (const [name, dict] of [['витрина', STR], ['вход', AUTH]]) {
  test(name + ': языки описывают один и тот же набор строк', () => {
    const langs = Object.keys(dict);
    assert.deepEqual(langs, ['ru', 'uk', 'pl'], name + ': набор языков изменился');
    const base = Object.keys(dict.ru);
    assert.ok(base.length >= 30, name + ': строк подозрительно мало');
    for (const lang of ['uk', 'pl']) {
      const keys = Object.keys(dict[lang]);
      assert.deepEqual(base.filter((k) => !keys.includes(k)), [], name + ': нет перевода на ' + lang);
      assert.deepEqual(keys.filter((k) => !base.includes(k)), [], name + ': лишние ключи в ' + lang);
    }
  });

  test(name + ': нет пустых строк и дублей ключей', () => {
    for (const lang of Object.keys(dict)) {
      for (const [k, v] of Object.entries(dict[lang])) {
        assert.ok(String(v).trim().length, name + ' ' + lang + '.' + k + ' пустой');
      }
    }
  });

  test(name + ': подстановки совпадают между языками', () => {
    const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const k of Object.keys(dict.ru)) {
      for (const lang of ['uk', 'pl']) {
        assert.equal(vars(dict[lang][k]), vars(dict.ru[k]), name + ': разные подстановки в ' + lang + '.' + k);
      }
    }
  });

  test(name + ': польский перевод не остался русским', () => {
    const same = Object.keys(dict.ru).filter((k) => dict.pl[k] === dict.ru[k] && /[А-Яа-яЁё]/.test(dict.ru[k]));
    assert.deepEqual(same, [], name + ': эти строки не переведены на польский');
  });

  test(name + ': украинский перевод не остался русским', () => {
    // Эти слова в русском и украинском пишутся одинаково, совпадение здесь не ошибка.
    const SAME_BY_NATURE = new Set(['new', 'reserve', 'pcs', 'ml', 'password']);
    const same = Object.keys(dict.ru)
      .filter((k) => !SAME_BY_NATURE.has(k) && dict.uk[k] === dict.ru[k] && /[А-Яа-яЁё]/.test(dict.ru[k]));
    assert.deepEqual(same, [], name + ': эти строки не переведены на украинский');
  });
}
