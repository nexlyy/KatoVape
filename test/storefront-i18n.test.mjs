import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { repoFile } from './helpers/core-src.mjs';

// Both dictionaries are plain object literals, so they can be evaluated on their own.
// The closing brace is found by counting, because the strings themselves contain braces.
// Текст объекта от его открывающей скобки до парной закрывающей, с оглядкой на кавычки.
function braceBlock(src, from) {
  let i = src.indexOf('{', from), depth = 0, quote = null;
  const open = i;
  for (; i < src.length; i++) {
    const c = src[i], prev = src[i - 1];
    if (quote) { if (c === quote && prev !== '\\') quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  return { text: src.slice(open, i + 1), open, close: i };
}

function dictOf(file, mark) {
  const src = repoFile(file);
  const start = src.indexOf(mark);
  assert.ok(start >= 0, 'словарь не найден в ' + file);
  const box = { out: null };
  vm.createContext(box);
  vm.runInContext('out = ' + braceBlock(src, start).text + ';', box);
  return box.out;
}

const STR = dictOf('shared/core.js', 'const STR = {');
// EXTRA это основной словарь интерфейса витрины: доставка, оплата, поля заказа, ошибки.
// Он не проверялся вовсе, хотя строк в нём в четыре раза больше, чем в STR, и именно в нём
// однажды разошлись языки и завёлся дубль ключа.
const EXTRA = dictOf('shared/core.js', 'const EXTRA = {');
const AUTH = dictOf('shared/auth.js', 'const L = {');

for (const [name, dict] of [['витрина', STR], ['витрина (интерфейс)', EXTRA], ['вход', AUTH]]) {
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
    // Слова, которые в русском и украинском пишутся одинаково. Список нужен, чтобы проверка
    // ловила настоящие пропуски перевода, а не совпадения языков.
    const SAME_BY_NATURE = new Set([
      'new', 'reserve', 'pcs', 'ml', 'password',
      'cool', 'sour', 'delInpost', 'delivPay', 'phoneF', 'payTitle', 'tomorrow', 'stActive',
      'pickedN',
    ]);
    const same = Object.keys(dict.ru)
      .filter((k) => !SAME_BY_NATURE.has(k) && dict.uk[k] === dict.ru[k] && /[А-Яа-яЁё]/.test(dict.ru[k]));
    assert.deepEqual(same, [], name + ': эти строки не переведены на украинский');
  });
}

// Дубль ключа в объекте JS не ошибка: побеждает последний, а прежний смысл тихо исчезает.
// Так уже случилось с paczkoHint, где новая длинная подсказка подменила короткую. После
// разбора объекта дубликата не видно вовсе, поэтому смотрим на исходный текст.
function dupKeysOf(file, mark) {
  const src = repoFile(file);
  const all = braceBlock(src, src.indexOf(mark)).text;
  const out = {};
  for (const lang of ['ru', 'uk', 'pl']) {
    const at = all.indexOf('\n    ' + lang + ': {');
    assert.ok(at >= 0, mark + ': не нашёлся язык ' + lang);
    // Строки выносим целиком: в них полно двоеточий и запятых, и опознать ключ по соседям
    // мимо них не выйдет.
    const body = braceBlock(all, at).text.replace(/'(?:[^'\\]|\\.)*'/g, "''");
    const seen = new Set(), dup = new Set();
    for (const m of body.matchAll(/([a-zA-Z][\w]*)\s*:/g)) {
      if (seen.has(m[1])) dup.add(m[1]); else seen.add(m[1]);
    }
    out[lang] = { keys: seen.size, dup: [...dup] };
  }
  return out;
}

for (const [name, mark, least] of [
  ['витрина', 'const STR = {', 40],
  ['витрина (интерфейс)', 'const EXTRA = {', 100],
]) {
  test(name + ': в словаре нет повторяющихся ключей', () => {
    const found = dupKeysOf('shared/core.js', mark);
    for (const [lang, r] of Object.entries(found)) {
      // Заодно ловим случай, когда разбор нашёл подозрительно мало: значит, он свернул не
      // туда, и «дублей нет» ничего не доказывает.
      assert.ok(r.keys >= least, lang + ': разобрано всего ' + r.keys + ' ключей, ожидалось от ' + least);
      assert.deepEqual(r.dup, [], lang + ': ключ объявлен дважды, победит последний');
    }
  });
}
