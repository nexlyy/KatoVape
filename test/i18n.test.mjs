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

// n-й аргумент вызова: режем по запятым верхнего уровня, не заглядывая внутрь скобок и строк
function topLevelArg(args, n) {
  const parts = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < args.length; i++) {
    const c = args[i];
    if (quote) { if (c === quote && args[i - 1] !== '\\') quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { parts.push(args.slice(start, i)); start = i + 1; }
  }
  parts.push(args.slice(start));
  return parts[n] || '';
}

// Ключи бот подставляет и через тернарник (tr(lang, card ? 'a' : 'b')), поэтому простой
// поиск tr(lang, 'ключ') такие места не видит: опечатка там уходит в чат клиента как
// голое имя ключа. Разбираем аргументы целиком.
test('все ключи, которые зовёт бот, есть в словаре', () => {
  const known = new Set(keysOf('ru'));
  const bad = new Set();
  for (const m of BOT.matchAll(/\btr\(/g)) {
    let depth = 1, i = m.index + m[0].length;
    while (i < BOT.length && depth > 0) {
      if (BOT[i] === '(') depth++;
      else if (BOT[i] === ')') depth--;
      i++;
    }
    // ключ: второй аргумент; третий это объект подстановок, литералы оттуда не ключи
    const args = BOT.slice(m.index + m[0].length, i - 1);
    const key = topLevelArg(args, 1)
      // сравнения вида x === 'card' ключами не являются
      .replace(/[=!]==\s*'[^']*'/g, ' ');
    for (const lit of key.matchAll(/'([^']*)'/g)) {
      if (!known.has(lit[1])) bad.add(lit[1]);
    }
  }
  assert.deepEqual([...bad], [], 'этих строк нет в i18n.mjs');
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

test('выбранный язык не затирается языком клиента телеграма', () => {
  // touchUser выполняется на каждое сообщение и нажатие. Если lang попадёт в этот upsert,
  // выбор в настройках проживёт до следующего тапа, именно так баг и выглядел.
  const block = BOT.match(/async function touchUser\(f\) \{[\s\S]*?\n\}/);
  assert.ok(block, 'touchUser не найден');
  const upsert = block[0].match(/sbUpsert\('bot_users', \{[\s\S]*?\}, 'telegram_id'\)/);
  assert.ok(upsert, 'upsert в touchUser не найден');
  assert.ok(!/lang/.test(upsert[0]), 'lang снова попал в upsert, который идёт на каждое действие');
  assert.ok(/!st\.lang/.test(block[0]), 'язык клиента должен ставиться только при первом контакте');
});

test('каждый экран бота берёт язык из состояния, а не из телеграма', () => {
  // pickLang(f.language_code) допустим только как запасной вариант рядом с st.lang
  const args = [...BOT.matchAll(/pickLang\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.ok(args.length, 'pickLang нигде не вызывается');
  for (const arg of args) {
    // допустимо: язык из сохранённого состояния, либо язык клиента как первый выбор
    const fromState = /\.lang\b/.test(arg);
    const firstContact = arg === 'f.language_code';
    assert.ok(fromState || firstContact, 'подозрительный источник языка: pickLang(' + arg + ')');
  }
});
