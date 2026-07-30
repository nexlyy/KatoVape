import test from 'node:test';
import assert from 'node:assert/strict';
import { repoFile } from './helpers/core-src.mjs';
import { tr, pickLang, LANGS } from '../server/i18n.mjs';

const SRC = repoFile('server/i18n.mjs');
const BOT = repoFile('server/bot.mjs');

function keysOf(lang) {
  const block = SRC.match(new RegExp('\\n  ' + lang + ': \\{([\\s\\S]*?)\\n  \\}'));
  assert.ok(block, 'no dictionary for ' + lang);
  return [...block[1].matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]);
}

test('все языки описывают один и тот же набор строк', () => {
  const base = keysOf('ru');
  assert.ok(base.length > 100, 'словарь подозрительно мал');
  for (const lang of ['uk', 'pl']) {
    const keys = keysOf(lang);
    assert.deepEqual(base.filter((k) => !keys.includes(k)), [], 'в ' + lang + ' не хватает строк');
    assert.deepEqual(keys.filter((k) => !base.includes(k)), [], 'в ' + lang + ' есть лишние строки');
  }
});

test('в каждом языке нет пустых значений', () => {
  for (const lang of LANGS) {
    for (const key of keysOf(lang)) {
      const v = tr(lang, key);
      assert.ok(typeof v === 'string' && v.trim().length, lang + '.' + key + ' пустой');
    }
  }
});

test('подстановки совпадают между языками', () => {
  const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of keysOf('ru')) {
    const base = vars(tr('ru', key));
    for (const lang of ['uk', 'pl']) {
      assert.deepEqual(vars(tr(lang, key)), base, 'разные подстановки в ' + lang + '.' + key);
    }
  }
});

test('в боте не осталось русского текста мимо словаря', () => {
  const code = BOT.replace(/^\s*\/\/.*$/gm, '');
  const hits = [...code.matchAll(/'[^']*[А-Яа-яЁё][^']*'/g)].map((m) => m[0]);
  assert.deepEqual(hits, [], 'строки надо перенести в i18n.mjs');
});

test('язык распознаётся по коду телеграма', () => {
  assert.equal(pickLang('uk-UA'), 'uk');
  assert.equal(pickLang('pl'), 'pl');
  assert.equal(pickLang('ru-RU'), 'ru');
  assert.equal(pickLang('de'), 'ru', 'неизвестный язык падает на русский');
  assert.equal(pickLang(null), 'ru');
});

test('неизвестный ключ не роняет бота', () => {
  assert.equal(tr('pl', 'thereIsNoSuchKey'), 'thereIsNoSuchKey');
});
