// Ссылки городов: канал и менеджер живут только в shared/config.js. Выбор одинаковый для
// всех городов (cityLink читает CITY_LINKS[город][вид]), поэтому проверяем саму таблицу —
// именно в ней был баг «связаться с менеджером всегда открывает Влада».
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { repoFile, CORE_SRC } from './helpers/core-src.mjs';

const box = { window: {} };
vm.createContext(box);
vm.runInContext(repoFile('shared/config.js'), box);
const CFG = box.window.KV_CONFIG;

// те же две строки, что в core.js (cityLink / managerName)
const cityLink = (city, kind) => ((CFG.CITY_LINKS || {})[city] || {})[kind] || '';
const nameOf = (url) => {
  const m = String(url).match(/t\.me\/@?([A-Za-z0-9_]+)/);
  return m ? '@' + m[1] : '';
};

const WANT = {
  katowice: { channel: 'https://t.me/+Dx0xgIyr4XkwOWEy', manager: '@KatoManager' },
  gliwice: { channel: 'https://t.me/+P-8bC9IvIn01YmQy', manager: '@KatoManagerGliwice' },
  warszawa: { channel: 'https://t.me/+iV43ZajefN0yMjEy', manager: '@KatoManagerWarszawa' }
};

for (const [city, want] of Object.entries(WANT)) {
  test(city + ': канал и менеджер', () => {
    assert.equal(cityLink(city, 'channel'), want.channel);
    assert.equal(nameOf(cityLink(city, 'manager')), want.manager);
  });
}

test('у городов разные менеджеры', () => {
  const mgrs = Object.keys(WANT).map((c) => cityLink(c, 'manager'));
  assert.equal(new Set(mgrs).size, 3, 'менеджер снова один на все города');
});

test('канал есть у каждого города', () => {
  assert.deepEqual(Object.keys(WANT).filter((c) => !cityLink(c, 'channel')), []);
});

test('неизвестный город не роняет выбор', () => {
  assert.equal(cityLink('krakow', 'channel'), '');
  assert.equal(cityLink('krakow', 'manager'), '');
});

test('города каталога покрыты ссылками', () => {
  const cities = JSON.parse(repoFile('data/products.json')).cities.map((c) => c.id);
  assert.deepEqual(cities.filter((c) => !CFG.CITY_LINKS[c]), []);
});

test('ссылка на менеджера нигде не захардкожена в витрине', () => {
  const site = repoFile('demos/vapor/site/index.html');
  assert.ok(!/t\.me\/KatoManager/.test(site), 'в site/index.html вернулась прямая ссылка');
  assert.ok(/managerLink\(\)/.test(site), 'подвал больше не берёт менеджера из конфига');
  assert.ok(/cityLink\('channel'\)/.test(CORE_SRC), 'попап подписки перестал вести в канал города');
});
