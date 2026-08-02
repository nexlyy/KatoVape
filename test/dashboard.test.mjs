import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { repoFile } from './helpers/core-src.mjs';

const PANEL = repoFile('demos/admin/index.html');
const MIG = repoFile('supabase/migrations/0030_dashboard.sql');
const FIX = repoFile('supabase/migrations/0031_dashboard_guard_fix.sql');
const ROLES = repoFile('supabase/migrations/0041_roles_and_stock.sql');

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
  // dashRange объявлен через let, снаружи его не видно, отдаём сеттер из самой песочницы
  '\nout = { dashBounds, trend, lineChart, barChart, donut, money, nf, RING_COLORS,' +
  ' setRange: (r) => { dashRange = r; }, setCustom: (c) => { dashCustom = c; },' +
  ' fillSeries, dashLabel };',
  box
);
const D = box.out;

test('период по умолчанию: 30 дней, границы согласованы', () => {
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
  // выбранные даты локальные, а ISO уходит в UTC, сравниваем по смыслу, а не по строке
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
  assert.equal(D.trend(0, 0), 0, 'ничего не было и не стало, это не падение');
  assert.equal(D.trend(500, 0), null, 'сравнивать не с чем, проценты показывать нельзя');
});

test('графики переживают пустые данные', () => {
  for (const html of [D.lineChart([], 'v', {}), D.barChart([], 'b', 'v', {}), D.donut([], 'b', 'v', D.RING_COLORS)]) {
    assert.match(html, /Нет данных за период/);
    assert.ok(!/NaN|Infinity|undefined/.test(html), 'в разметке мусор: ' + html.slice(0, 120));
  }
});

test('линия строится по точкам и не даёт NaN на одинаковых значениях', () => {
  const rows = [{ label: '01-01-2026', v: 0 }, { label: '02-01-2026', v: 0 }, { label: '03-01-2026', v: 0 }];
  const html = D.lineChart(rows, 'v', {});
  assert.ok(!/NaN/.test(html), 'нулевой ряд ломает координаты');
  assert.match(html, /polyline/);
});

test('единственный день рисуется столбцом, а не точкой в пустоте', () => {
  const html = D.lineChart([{ label: '31-07-2026', v: 57 }], 'v', { money: true });
  assert.ok(!/NaN/.test(html));
  assert.match(html, /chart-bar/, 'одна точка должна становиться столбцом');
  assert.match(html, /57 zł/);
  assert.match(html, /31-07-2026/);
});

test('пустые дни заполняются нулями, а не выпадают из графика', () => {
  const from = new Date('2026-07-01T00:00:00').toISOString();
  const to = new Date('2026-07-30T23:59:59').toISOString();
  const filled = D.fillSeries([{ bucket: '2026-07-15', revenue: 57 }], from, to, 'day', ['revenue']);
  assert.equal(filled.length, 30, 'в июле должно быть 30 точек, а не одна');
  assert.equal(filled.filter((r) => r.revenue === 57).length, 1);
  assert.equal(filled.filter((r) => r.revenue === 0).length, 29);
});

test('подписи дат в формате ДД-ММ-ГГГГ', () => {
  assert.equal(D.dashLabel('2026-07-31', 'day'), '31-07-2026');
  assert.equal(D.dashLabel('2026-07-01', 'month'), '07-2026');
  const filled = D.fillSeries([], new Date('2026-03-05T00:00:00').toISOString(), new Date('2026-03-06T23:59:59').toISOString(), 'day', ['n']);
  assert.equal(filled[0].label, '05-03-2026');
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
  // 0031 закрыл трёхзначную логику, 0041 расширил набор ролей. coalesce обязан остаться:
  // без него admin_role() = null у постороннего снова проходит мимо guard.
  assert.match(FIX, /coalesce\(public\.admin_role\(\) in \(/);
  const full = ROLES.slice(ROLES.indexOf('function public.is_full_admin'));
  assert.match(full, /coalesce\(public\.admin_role\(\) in \('owner', 'owner_manager', 'dev'\), false\)/);
  assert.match(ROLES, /function public\.can_grant[\s\S]{0,400}?admin_role\(\) = 'owner'/,
    'права раздаёт только владелец');
});

test('полный доступ это три роли, менеджера среди них нет', () => {
  const m = PANEL.match(/const FULL_ROLES = (\[[^\]]*\])/);
  assert.ok(m, 'список ролей полного доступа не найден');
  assert.deepEqual(JSON.parse(m[1].replace(/'/g, '"')), ['owner', 'owner_manager', 'dev']);
});

test('закрытые разделы проверяются одним правилом', () => {
  const box = PANEL.slice(PANEL.indexOf('const TAB_ACCESS'), PANEL.indexOf('function closeMenu'));
  for (const tab of ['dash', 'stock', 'finance', 'managers']) {
    assert.match(box, new RegExp(tab + ':\\s*isFull'), tab + ' открыт не только полному доступу');
  }
  assert.match(box, /access:\s*\(\) => !!\(overview && overview\.can_grant\)/, 'раздел прав не привязан к can_grant');
  // одно правило и для меню, и для переключения вкладки
  assert.match(PANEL, /TABS\(\)\.filter\(\(\[k\]\) => tabAllowed\(k\)\)/, 'меню не фильтруется правилом');
  assert.match(PANEL, /if \(!tabAllowed\(tab\)\) \{ tab = 'orders'; return shell\(\); \}/, 'переход на вкладку не перекрыт');
});

test('системный раздел показывается только разработчику', () => {
  assert.match(PANEL, /const isDev = overview && overview\.role === 'dev'/);
  assert.match(PANEL, /if \(isDev\) calls\.push\(sb\.rpc\('dash_system'\)\)/);
});
