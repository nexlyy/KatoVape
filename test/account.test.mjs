// Проверка почты и изоляции личных данных между аккаунтами на одном устройстве.
// Функции берём из настоящего shared/core.js, а не переписываем.
import test from 'node:test';
import assert from 'node:assert/strict';
import { slice, sandbox, repoFile, CORE_SRC } from './helpers/core-src.mjs';

/* ---------- почта ---------- */

const { api: mail } = sandbox(
  [slice('const EMAIL_RE =', 'function validPaczko')],
  {},
  ['validEmail']
);

const GOOD = [
  'ivan@syn.cae', 'a.b@wp.pl', 'kato_vape+zamowienia@gmail.com',
  'user123@sub.domain.co.uk', 'x1@o2.pl',
  ' ivan@syn.cae ', 'IVAN@SYN.CAE'   // пробелы по краям и регистр не повод отказывать
];
const BAD = [
  '@!s1w', '@syn.cae', 'ivan@', 'ivan', 'ivan@localhost', 'ivan@syn',
  'ivan@.cae', 'ivan@syn.', 'ivan@syn..cae', 'iv an@syn.cae', 'ivan@syn.c',
  'ivan@-syn.cae', '.ivan@syn.cae', 'ivan.@syn.cae',
  'ivan@@syn.cae', 'ivan@syn.cae<script>', '', '   ', 'ivan@syn.123'
];

for (const v of GOOD) test('почта принимается: ' + v, () => assert.ok(mail.validEmail(v), v));
for (const v of BAD) test('почта отклоняется: ' + JSON.stringify(v), () => assert.ok(!mail.validEmail(v), v));

test('слишком длинный адрес отклоняется', () => {
  assert.ok(!mail.validEmail('a'.repeat(250) + '@syn.cae'));
});

test('витрина, регистрация и бот проверяют почту одинаково', () => {
  const re = String(CORE_SRC.match(/const EMAIL_RE = (\/.*\/);/)[1]);
  for (const [file, path] of [['auth.js', 'shared/auth.js'], ['bot.mjs', 'server/bot.mjs']]) {
    const m = repoFile(path).match(/const EMAIL_RE = (\/.*\/);/);
    assert.ok(m, 'в ' + file + ' нет общего правила почты');
    assert.equal(String(m[1]), re, 'правило почты в ' + file + ' разошлось с core.js');
  }
});

/* ---------- личные данные на устройстве ---------- */

// claimUser работает с localStorage, поэтому подкладываем минимальную реализацию
function makeStore(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  };
}
function claimSandbox(initial) {
  const store = makeStore(initial);
  const { api } = sandbox(
    [slice('  const OWNED = [', '  function stLabel')],
    {
      localStorage: store,
      hooks: {},
      profileName: '',
      appliedPromo: null,
      delivery: null,
      forgetUserState: () => {},
      drawDrawer: () => {}
    },
    ['claimUser', 'OWNED']
  );
  return { api, store };
}

const PERSONAL = { kv_favs: '["hqd"]', kv_contact: '{"name":"Иван Петров","phone":"+48600000000"}', kv_orders: '[{"id":1}]' };
const DEVICE = { kv_lang: 'pl', kv_theme: 'dark', kv_age: '1', kv_cart_katowice: '{"hqd::0":2}' };

test('смена аккаунта стирает избранное, контакты и заказы прошлого человека', () => {
  const { api, store } = claimSandbox(Object.assign({ kv_owner: 'user-A' }, PERSONAL, DEVICE));
  assert.equal(api.claimUser('user-B'), true, 'смена владельца не распознана');
  assert.equal(store.getItem('kv_favs'), null);
  assert.equal(store.getItem('kv_contact'), null, 'чужие контакты остались в форме доставки');
  assert.equal(store.getItem('kv_orders'), null);
  assert.equal(store.getItem('kv_owner'), 'user-B');
});

test('настройки самого устройства смена аккаунта не трогает', () => {
  const { api, store } = claimSandbox(Object.assign({ kv_owner: 'user-A' }, PERSONAL, DEVICE));
  api.claimUser('user-B');
  assert.equal(store.getItem('kv_lang'), 'pl');
  assert.equal(store.getItem('kv_theme'), 'dark');
  assert.equal(store.getItem('kv_age'), '1');
  assert.equal(store.getItem('kv_cart_katowice'), '{"hqd::0":2}');
});

test('тот же аккаунт ничего не теряет при повторном входе', () => {
  const { api, store } = claimSandbox(Object.assign({ kv_owner: 'user-A' }, PERSONAL));
  assert.equal(api.claimUser('user-A'), false);
  assert.equal(store.getItem('kv_favs'), '["hqd"]');
});

test('гость, который только что завёл аккаунт, сохраняет своё избранное', () => {
  const { api, store } = claimSandbox(PERSONAL);   // владельца ещё не было
  assert.equal(api.claimUser('user-A'), false);
  assert.equal(store.getItem('kv_favs'), '["hqd"]');
  assert.equal(store.getItem('kv_owner'), 'user-A');
});

test('выход из аккаунта тоже убирает личное', () => {
  const { api, store } = claimSandbox(Object.assign({ kv_owner: 'user-A' }, PERSONAL));
  assert.equal(api.claimUser(null), true);
  assert.equal(store.getItem('kv_favs'), null);
  assert.equal(store.getItem('kv_owner'), '');
});

test('город из выбора человека не считается личным ключом устройства', () => {
  const { api } = claimSandbox({ kv_owner: 'user-A' });
  const owned = [...api.OWNED];
  assert.ok(owned.includes('kv_city_picked'), 'отметка ручного выбора должна сбрасываться');
  assert.ok(!owned.includes('kv_lang'), 'язык — настройка устройства');
});
