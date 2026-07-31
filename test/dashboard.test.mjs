import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { repoFile } from './helpers/core-src.mjs';

const PANEL = repoFile('demos/admin/index.html');
const MIG = repoFile('supabase/migrations/0030_dashboard.sql');
const FIX = repoFile('supabase/migrations/0031_dashboard_guard_fix.sql');

// Chart maths and the period picker come straight out of the panel source.
function slice(from, to) {
  const a = PANEL.indexOf(from);
  const b = PANEL.indexOf(to, a);
  assert.ok(a >= 0 && b > a, 'не найден блок: ' + from);
  return PANEL.slice(a, b);
}
const box = {
  localStorage: { getItem: () => null, setItem: () => {} },
  L: (s) => s,
  esc: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  out: null
};
vm.createContext(box);
vm.runInContext(
  slice('const DASH_RANGES = [', 'async function renderDash(') +
  // dashRange объявлен через let, снаружи его не видно — отдаём сеттер из самой песочницы
  '\nout = { dashBounds, trend, lineChart, barChart, donut, money, nf, RING_COLORS,' +
  ' setRange: (r) => { dashRange = r; }, setCustom: (c) => { dashCustom = c; } };',
  box
);
const D = box.out;

test('период по умолчанию — 30 дней, границы согласованы', () => {
  const b = D.dashBounds();
  const from = new Date(b.from), to = new Date(b.to);
  assert.ok(from < to, 'начало периода позже конца');
  const days = Math.round((to - from) / 86400000);
  assert.equal(days, 30);
  assert.equal(b.bucket, 'day');
});

test('длинный период группируется по месяцам, короткий по дням', () => {
  D.setRange('year');
  assert.equal(D.dashBounds().bucket, 'month');
  D.setRange('7d');
  assert.equal(D.dashBounds().bucket, 'day');
  D.setRange('30d');
});

test('произвольный диапазон берётся из полей, а не из пресета', () => {
  D.setRange('custom');
  D.setCustom({ from: '2026-01-01', to: '2026-01-31' });
  const b = D.dashBounds();
  // выбранные даты локальные, а ISO уходит в UTC — сравниваем по смыслу, а не по строке
  const from = new Date(b.from), to = new Date(b.to);
  assert.equal(from.getFullYear() + '-' + String(from.getMonth() + 1).padStart(2, '0') + '-' + String(from.getDate()).padStart(2, '0'), '2026-01-01');
  assert.ok(to > from);
  assert.ok((to - from) / 86400000 > 29, 'диапазон января должен быть около месяца');
  D.setRange('30d');
});

test('сегодня и вчера не пересекаются', () => {
  D.setRange('today');
  const today = D.dashBounds();
  D.setRange('yesterday');
  const yest = D.dashBounds();
  assert.ok(new Date(yest.to) <= new Date(today.from), 'вчера залезает на сегодня');
  D.setRange('30d');
});

test('рост считается от предыдущего периода и не врёт на пустой истории', () => {
  assert.equal(D.trend(150, 100), 50);
  assert.equal(D.trend(50, 100), -50);
  assert.equal(D.trend(100, 100), 0);
  assert.equal(D.trend(0, 0), 0, 'ничего не было и не стало — это не падение');
  assert.equal(D.trend(500, 0), null, 'сравнивать не с чем, проценты показывать нельзя');
});

test('графики переживают пустые данные', () => {
  for (const html of [D.lineChart([], 'b', 'v', {}), D.barChart([], 'b', 'v', {}), D.donut([], 'b', 'v', D.RING_COLORS)]) {
    assert.match(html, /Нет данных за период/);
    assert.ok(!/NaN|Infinity|undefined/.test(html), 'в разметке мусор: ' + html.slice(0, 120));
  }
});

test('линия строится по точкам и не даёт NaN на одинаковых значениях', () => {
  const rows = [{ b: '01-01', v: 0 }, { b: '01-02', v: 0 }, { b: '01-03', v: 0 }];
  const html = D.lineChart(rows, 'b', 'v', {});
  assert.ok(!/NaN/.test(html), 'нулевой ряд ломает координаты');
  assert.match(html, /polyline/);
});

test('одна точка тоже рисуется', () => {
  const html = D.lineChart([{ b: '01-01', v: 10 }], 'b', 'v', { money: true });
  assert.ok(!/NaN/.test(html));
  assert.match(html, /10 zł/);
});

test('кольцевая диаграмма раскладывает доли без переполнения', () => {
  const html = D.donut([{ k: 'a', n: 3 }, { k: 'b', n: 1 }], 'k', 'n', D.RING_COLORS);
  const dashes = [...html.matchAll(/stroke-dasharray="([\d.]+) ([\d.]+)"/g)].map((m) => Number(m[1]));
  const circumference = 2 * Math.PI * 54;
  assert.equal(dashes.length, 2);
  assert.ok(Math.abs(dashes[0] + dashes[1] - circumference) < 0.5, 'сумма дуг не равна окружности');
});

test('суммы форматируются как деньги', () => {
  assert.match(D.money(1234), /zł/);
  assert.equal(D.money(null), '0 zł');
});

/* доступ */

test('каждая функция дашборда закрыта проверкой роли', () => {
  const funcs = [...MIG.matchAll(/create or replace function public\.(dash_\w+)/g)].map((m) => m[1]);
  assert.ok(funcs.length >= 5, 'функции дашборда не найдены');
  for (const f of funcs) {
    const body = MIG.slice(MIG.indexOf('function public.' + f), MIG.indexOf('$$;', MIG.indexOf('function public.' + f)));
    assert.match(body, /is_owner_or_dev\(\)/, f + ' без проверки роли');
  }
});

test('проверка роли не возвращает null, иначе guard пропускается', () => {
  assert.match(FIX, /coalesce\(public\.admin_role\(\) in \('owner', 'dev'\), false\)/);
});

test('вкладка дашборда скрыта от роли менеджера', () => {
  assert.match(PANEL, /const canDash = \(\) => !!\(overview && \['owner', 'dev'\]\.includes\(overview\.role\)\)/);
  assert.match(PANEL, /k !== 'dash' \|\| canDash\(\)/, 'вкладка не отфильтрована');
  assert.match(PANEL, /if \(!canDash\(\)\) \{ tab = 'orders'; return shell\(\); \}/, 'переход на вкладку не перекрыт');
});

test('системный раздел показывается только разработчику', () => {
  assert.match(PANEL, /const isDev = overview && overview\.role === 'dev'/);
  assert.match(PANEL, /if \(isDev\) calls\.push\(sb\.rpc\('dash_system'\)\)/);
});
