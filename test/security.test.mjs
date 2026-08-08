// Проверки безопасности: схема базы, права, клиентский код, функции и разметка.
//
// Набор устроен так, чтобы падать при появлении дыры, а не подтверждать, что её нет. Каждая
// проверка отвечает на один вопрос про один объект: таблицу, функцию, файл. Поэтому их много
// и добавление таблицы или функции само расширяет набор: забыть про новый объект нельзя.
//
// Чего этот набор НЕ делает: он читает исходники, а не опрашивает живую базу. Разошлась ли
// боевая база с миграциями, он не знает; для этого есть `supabase migration list --linked`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { repoFile } from './helpers/core-src.mjs';

const DIR = 'supabase/migrations/';
const FILES = readdirSync(new URL('../' + DIR, import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const SQL = FILES.map((f) => repoFile(DIR + f)).join('\n');

const CLIENT = {
  'shared/core.js': repoFile('shared/core.js'),
  'shared/auth.js': repoFile('shared/auth.js'),
  'shared/pay.js': repoFile('shared/pay.js'),
  'shared/config.js': repoFile('shared/config.js'),
  'shared/tints.js': repoFile('shared/tints.js'),
  'demos/admin/index.html': repoFile('demos/admin/index.html'),
  'demos/admin/export.js': repoFile('demos/admin/export.js'),
  'demos/vapor/site/index.html': repoFile('demos/vapor/site/index.html'),
  'demos/vapor/app/index.html': repoFile('demos/vapor/app/index.html'),
  'index.html': repoFile('index.html')
};
const PAGES = ['demos/admin/index.html', 'demos/vapor/site/index.html', 'demos/vapor/app/index.html', 'index.html'];
const EDGE = ['create-checkout', 'create-order', 'create-payment', 'login', 'signup', 'stripe-webhook', 'telegram-auth']
  .reduce((a, n) => (a[n] = repoFile('supabase/functions/' + n + '/index.ts'), a), {});

const TABLES = [...new Set([...SQL.matchAll(/create table if not exists public\.([a-z_]+)/g)].map((m) => m[1]))];

// Функции разбираем по заголовку до тела: там объявлены security и search_path.
const FUNCS = (() => {
  const out = new Map();
  for (const m of SQL.matchAll(/create (?:or replace )?function public\.([a-z_]+)\(([^)]*)\)[\s\S]{0,700}?\$\$/g)) {
    out.set(m[1], { head: m[0], args: m[2] });      // повторное объявление затирает прежнее
  }
  return out;
})();

// Итоговое право считаем прогоном по порядку: grant и revoke идут вперемешку по миграциям,
// и факт одного grant ничего не значит, если ниже стоит revoke. Так 0034 и 0036 закрыли
// функции, выданные анониму раньше.
function finalGrant(kind, name, role) {
  const re = kind === 'function'
    ? new RegExp('(grant|revoke) execute on function public\\.' + name + '\\([^)]*\\)\\s*(?:from|to)\\s*([^;]+);', 'g')
    : new RegExp('(grant|revoke) (?:select[^o]*|all[^o]*)on public\\.' + name + '\\s*(?:from|to)\\s*([^;]+);', 'g');
  let granted = false;
  for (const m of SQL.matchAll(re)) {
    if (!new RegExp('\\b' + role + '\\b').test(m[2])) continue;
    granted = m[1] === 'grant';
  }
  return granted;
}

/* ============ схема базы ============ */

for (const t of TABLES) {
  test(`RLS включён у таблицы ${t}`, () => {
    assert.match(SQL, new RegExp('alter table public\\.' + t + ' enable row level security'),
      t + ': без RLS строку читает кто угодно с публичным ключом');
  });

  // RLS без политик закрывает таблицу вообще для всех, кроме service_role. Для служебных
  // таблиц это осознанный выбор: к ним ходят только функции. Для остальных — забытая
  // настройка, поэтому список закрытых наглухо перечислен поимённо и растёт только руками.
  const SEALED = ['admins', 'admin_users', 'auth_attempts'];
  test(`доступ к таблице ${t} описан политиками или она закрыта намеренно`, () => {
    const has = new RegExp('create policy [a-z_]+ on public\\.' + t + '\\b').test(SQL);
    assert.ok(has || SEALED.includes(t),
      t + ': ни одной политики и нет в списке закрытых, скорее всего про неё забыли');
  });

  test(`право на таблицу ${t} не выдано анониму целиком`, () => {
    // Считаем итог, а не отдельные строки: grant и revoke идут вперемешку по миграциям,
    // и вся таблица, открытая когда-то, могла быть закрыта позже. Поимённая выдача
    // колонок допустима и желательна: так закрыта закупочная цена в products.
    const re = new RegExp('(grant|revoke) (select|all)([^;]*?)on (?:table )?public\\.' + t +
      '\\s*(?:to|from)\\s*([^;]+);', 'g');
    let open = false;
    for (const m of SQL.matchAll(re)) {
      if (!/\banon\b/.test(m[4])) continue;
      open = m[1] === 'grant' && !m[3].includes('(');   // без списка колонок значит «вся»
    }
    assert.equal(open, false,
      t + ': анониму выдана вся таблица, новая колонка утечёт в браузер сама собой');
  });
}

for (const [name, f] of FUNCS) {
  test(`search_path задан у функции ${name}`, () => {
    if (!/security definer/i.test(f.head)) return;   // invoker выполняется в правах вызвавшего
    assert.match(f.head, /set search_path\s*=\s*public/i,
      name + ': definer без search_path подменяется своей схемой в search_path вызывающего');
  });
}

test('в схеме не осталось функций с security definer и без явных прав', () => {
  const naked = [];
  for (const [name, f] of FUNCS) {
    if (!/security definer/i.test(f.head)) continue;
    // Триггерные функции зовёт движок при изменении строки, напрямую их вызвать нельзя,
    // и execute на них никому не выдаётся.
    if (/returns trigger/i.test(f.head)) continue;
    const granted = new RegExp('grant execute on function public\\.' + name + '\\b').test(SQL);
    const revoked = new RegExp('revoke execute on function public\\.' + name + '\\b').test(SQL);
    if (!granted && !revoked) naked.push(name);
  }
  // Без явной выдачи функция достаётся роли public по умолчанию, то есть и анониму тоже.
  assert.deepEqual(naked, [], 'этим функциям не назначены права, их зовёт кто угодно');
});

/* ============ права ============ */

const ANON_FUNCS = ['login_availability', 'resolve_login', 'bump_demand', 'audit', 'restock_list'];
for (const f of ANON_FUNCS) {
  test(`функция ${f} закрыта от анонима`, () => {
    if (!FUNCS.has(f)) return;
    assert.equal(finalGrant('function', f, 'anon'), false,
      f + ': аноним зовёт служебную функцию напрямую публичным ключом');
  });
}

test('promo_check закрыт от анонима: коды короткие и подбираются словарём', () => {
  assert.equal(finalGrant('function', 'promo_check', 'anon'), false);
});

test('каталог продолжает читаться анонимом: витрина работает без входа', () => {
  assert.match(SQL, /grant select \([^)]*\)\s*\n?\s*on public\.products to anon/);
});

test('закупочная цена не выдана анониму', () => {
  const hits = [...SQL.matchAll(/grant select \(([^)]*)\)\s*\n?\s*on public\.products to anon/g)];
  const cols = hits[hits.length - 1][1].split(',').map((s) => s.trim());
  assert.ok(!cols.includes('cost'), 'cost открыт витрине, маржа видна покупателю');
});

test('таблица заказов не открыта анониму на чтение', () => {
  assert.equal(finalGrant('table', 'orders', 'anon'), false);
});

test('профили не открыты анониму на чтение', () => {
  assert.equal(finalGrant('table', 'profiles', 'anon'), false);
});

test('править каталог может только сотрудник своего города', () => {
  // Право на таблицу у роли authenticated есть у всех вошедших, включая покупателя,
  // поэтому каталог держит политика, а не грант: без неё цену правят из консоли браузера.
  assert.match(SQL, /create policy products_admin_all on public\.products\s*\n?\s*for all using \(public\.admin_sees_city\(city\)\) with check \(public\.admin_sees_city\(city\)\)/);
});

test('заказ заводится функцией, а не вставкой из браузера', () => {
  assert.match(SQL, /revoke insert on table public\.orders from[^;]*authenticated/i,
    'иначе клиент присылает свою сумму');
  assert.match(SQL, /revoke insert on table public\.orders from[^;]*anon/i);
});

/* ============ секреты ============ */

const SECRET_PATTERNS = [
  ['service_role ключ', /\bsb_secret_[A-Za-z0-9_-]{10,}/],
  ['ключ доступа Supabase', /\bsbp_[a-f0-9]{20,}/],
  ['ключ Stripe', /\bsk_(?:live|test)_[A-Za-z0-9]{10,}/],
  ['токен бота Telegram', /\b\d{8,12}:AA[A-Za-z0-9_-]{30,}/],
  ['пароль в строке подключения', /postgres(?:ql)?:\/\/[^\s'"]*:[^\s'"@]+@/],
  ['приватный ключ', /-----BEGIN [A-Z ]*PRIVATE KEY-----/]
];
for (const [file, src] of Object.entries(CLIENT)) {
  for (const [what, re] of SECRET_PATTERNS) {
    test(`в ${file} нет: ${what}`, () => {
      const m = src.match(re);
      assert.equal(m, null, file + ': найдено «' + (m && m[0].slice(0, 12)) + '…», это уходит в браузер');
    });
  }
}

test('в репозитории нет файла .env', () => {
  const root = readdirSync(new URL('../', import.meta.url));
  assert.ok(!root.includes('.env'), '.env не должен лежать в дереве проекта');
});

test('.gitignore закрывает секреты и базу бота', () => {
  const ig = repoFile('.gitignore');
  assert.match(ig, /^\.env$/m, 'без этой строки один git add -A выкладывает ключи в публичный репозиторий');
  assert.match(ig, /server\/\*\.db/, 'в базе бота лежат телефоны покупателей');
  assert.match(ig, /backup-\*\.sql|\*\.dump/, 'выгрузки базы не место в репозитории');
});

test('публичный ключ витрины именно публичный, а не служебный', () => {
  const cfg = CLIENT['shared/config.js'];
  const key = (cfg.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/) || [])[1] || '';
  assert.ok(key.startsWith('sb_publishable_') || key.startsWith('eyJ'),
    'в config.js лежит ключ неизвестного вида, проверьте, что это не service_role');
  assert.ok(!/service_role/.test(key));
});

/* ============ вывод данных в разметку ============ */

// Поля, которые заполняет не сотрудник, а покупатель: имя, телефон, адрес, комментарий,
// текст отзыва, название пачкомата. Именно они и опасны в разметке. Внутренние списки
// (статусы, роли, коды городов) в этот набор не входят намеренно: их значения задаёт код.
const FROM_CUSTOMER = [
  ['имя клиента', /esc\((?:c|ct|p)\.full_name|esc\(c\.name\)/],
  ['телефон', /esc\((?:c|ct|o\.contact|p)\.phone/],
  ['адрес доставки', /esc\(o\.address\)/],
  ['комментарий к заказу', /esc\(o\.comment\)/],
  ['почта', /esc\((?:c|ct|p)\.email/],
];

test('подсказки быстрого поиска экранируются целиком', () => {
  const src = CLIENT['demos/admin/index.html'];
  // В подсказку собираются имя, телефон и телеграм клиента, поэтому экранируется вся
  // строка разом, а не каждое поле по отдельности.
  assert.match(src, /class="gos-n">\$\{esc\(f\.title\)\}/);
  assert.match(src, /class="gos-s">\$\{esc\(f\.sub\)\}/);
});
for (const [what, re] of FROM_CUSTOMER) {
  test(`панель экранирует ${what}`, () => {
    assert.match(CLIENT['demos/admin/index.html'], re,
      what + ': это поле заполняет покупатель, в разметку оно обязано попадать экранированным');
  });
}

test('панель не подставляет значения покупателя в атрибут без обработки', () => {
  const src = CLIENT['demos/admin/index.html'];
  const risky = [...src.matchAll(/value="\$\{([^}]*)\}"/g)].map((m) => m[1].trim())
    .filter((x) => /\b(?:full_name|phone|email|address|comment|paczkomat|body|author)\b/.test(x))
    .filter((x) => !/^esc\(/.test(x));
  assert.deepEqual(risky, [], 'эти значения приходят от покупателя и попадают в атрибут как есть');
});

test('панель экранирует имена клиентов и товаров', () => {
  const src = CLIENT['demos/admin/index.html'];
  assert.ok(/function esc\(|const esc =/.test(src), 'в панели нет функции экранирования');
  // Имя клиента приходит из профиля, то есть от самого клиента.
  assert.match(src, /esc\(c\.full_name/);
  assert.match(src, /esc\(o\.address\)|esc\(o\.comment\)/);
});

test('витрина экранирует отзывы', () => {
  assert.match(CLIENT['shared/core.js'], /esc\((?:r\.body|rv\.body|x\.body)/,
    'текст отзыва пишет покупатель, он обязан экранироваться');
});

test('в панели нет вставки чужого HTML через document.write или eval', () => {
  const src = CLIENT['demos/admin/index.html'];
  assert.ok(!/document\.write\s*\(/.test(src));
  assert.ok(!/\beval\s*\(/.test(src));
  assert.ok(!/new Function\s*\(/.test(src));
});

/* ============ заголовки и ссылки ============ */

// GitHub Pages своих заголовков не даёт, поэтому политика идёт метой на каждой странице.
// Без неё внедрённый скрипт волен стучаться куда угодно и уносить содержимое страницы.
for (const page of PAGES) {
  test(`${page}: есть политика источников`, () => {
    assert.match(CLIENT[page], /http-equiv="Content-Security-Policy"/);
  });

  test(`${page}: политика запрещает всё, что не разрешено явно`, () => {
    const csp = (CLIENT[page].match(/Content-Security-Policy"\s*content="([\s\S]*?)"/) || [])[1] || '';
    assert.match(csp, /default-src 'none'/, page + ': без default-src запрет действует не на всё');
  });

  test(`${page}: страницу нельзя отправить формой на чужой адрес`, () => {
    const csp = (CLIENT[page].match(/Content-Security-Policy"\s*content="([\s\S]*?)"/) || [])[1] || '';
    assert.match(csp, /form-action 'none'/);
    assert.match(csp, /base-uri 'none'/, 'подменённый base уводит все относительные адреса на чужой хост');
  });

  test(`${page}: список хостов для запросов ограничен`, () => {
    const csp = (CLIENT[page].match(/Content-Security-Policy"\s*content="([\s\S]*?)"/) || [])[1] || '';
    const connect = (csp.match(/connect-src([^;]*)/) || [])[1] || '';
    assert.ok(connect.trim(), page + ': connect-src не задан, запрос уйдёт куда угодно');
    assert.ok(!/\*/.test(connect), page + ': в connect-src звёздочка, ограничения нет');
  });
}

test('панель не открывается внутри чужой страницы', () => {
  assert.match(CLIENT['demos/admin/index.html'], /frame-ancestors|top\s*!==\s*self|self\s*!==\s*top/,
    'без этого панель встраивают в чужой сайт и снимают нажатия');
});

for (const page of PAGES) {
  test(`${page}: внешние ссылки идут с rel="noopener"`, () => {
    const src = CLIENT[page];
    const blanks = [...src.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map((m) => m[0]);
    const bad = blanks.filter((a) => !/rel="[^"]*noopener/.test(a));
    assert.deepEqual(bad, [], page + ': открытая вкладка получает доступ к window.opener');
  });
}

for (const page of PAGES) {
  test(`${page}: скрипты со стороны подключены с проверкой целостности`, () => {
    const src = CLIENT[page];
    const ext = [...src.matchAll(/<script\b[^>]*src="(https?:\/\/[^"]+)"[^>]*>/g)];
    // Телеграм отдаёт свой скрипт меняющимся, на нём integrity не держится: он в исключении
    // осознанно, всё остальное обязано быть прибито хешем.
    const bad = ext.filter(([tag, url]) => !/telegram\.org/.test(url) && !/integrity=/.test(tag)).map(([, u]) => u);
    assert.deepEqual(bad, [], page + ': подменённый CDN выполнит свой код на странице');
  });
}

/* ============ функции на сервере ============ */

for (const [name, src] of Object.entries(EDGE)) {
  test(`функция ${name} не отдаёт наружу свои секреты`, () => {
    assert.ok(!/JSON\.stringify\(\s*(?:Deno\.)?env/.test(src));
    assert.ok(!/SERVICE_KEY[^;\n]*(?:return|json\()/.test(src), name + ': ключ уходит в ответ');
  });

  test(`функция ${name} берёт ключи из окружения, а не из кода`, () => {
    const hard = SECRET_PATTERNS.filter(([, re]) => re.test(src)).map(([w]) => w);
    assert.deepEqual(hard, [], name + ': секрет вписан в исходник');
  });
}

test('вход считает неудачные попытки', () => {
  assert.match(EDGE.login, /auth_attempts|attempts/i, 'без счётчика пароль подбирают перебором');
});

test('телеграм-вход проверяет подпись, а не верит полям', () => {
  assert.match(EDGE['telegram-auth'], /verifyWidget|verifyInitDataUser/,
    'функция обязана звать проверку подписи, а не читать поля запроса');
  // Сама проверка живёт в общем помощнике, оттуда её берут и функция, и бот.
  const tg = repoFile('supabase/functions/_shared/telegram.ts');
  assert.match(tg, /hmac|HMAC/i);
  assert.match(tg, /safeEqual/, 'сравнение подписи должно быть без утечки по времени');
  const cr = repoFile('supabase/functions/_shared/crypto.ts');
  assert.match(cr, /safeEqual/);
});

test('сравнение подписи не выходит из цикла на первом различии', () => {
  const cr = repoFile('supabase/functions/_shared/crypto.ts');
  const fn = (cr.match(/export function safeEqual[\s\S]*?\n}/) || [''])[0];
  assert.ok(fn, 'safeEqual не найдена');
  assert.ok(!/\breturn false\b/.test(fn.replace(/if \([^)]*length[^)]*\)[^\n]*\n/, '')),
    'ранний выход по различию выдаёт длину совпавшего куска по времени ответа');
});

test('оплата проверяет подпись Stripe', () => {
  assert.match(EDGE['stripe-webhook'], /constructEvent|signature|Stripe-Signature/i,
    'вебхук без проверки подписи оплачивает заказ по чужому запросу');
});

test('сумма заказа считается на сервере, а не берётся из запроса', () => {
  assert.match(EDGE['create-order'], /priceCart/);
  const pricing = repoFile('supabase/functions/_shared/pricing.ts');
  assert.match(pricing, /name: r\.item\.name \|\| r\.id/, 'название тоже берётся из каталога');
});

test('состав корзины нормализуется по количеству', () => {
  const pricing = repoFile('supabase/functions/_shared/pricing.ts');
  assert.match(pricing, /Math\.min\(Math\.max\(Math\.floor\(Number\(l\.n\)/,
    'без этого в заказ уходит отрицательное или дробное количество');
});

/* ============ хранилище картинок ============ */

test('корзина картинок принимает только изображения и ограничена по размеру', () => {
  assert.match(SQL, /allowed_mime_types\s*=?\s*array\['image\/jpeg'\]/);
  assert.match(SQL, /file_size_limit/);
});

test('в корзину картинок пишет только сотрудник панели', () => {
  assert.match(SQL, /create policy flavors_write on storage\.objects for insert[\s\S]{0,120}is_admin\(\)/);
  assert.match(SQL, /create policy flavors_delete on storage\.objects for delete[\s\S]{0,120}is_admin\(\)/);
});

test('путь картинки в базе не может увести за пределы корзины', () => {
  assert.match(SQL, /flavor_meta_photo_path[\s\S]{0,220}\\\.\\\.|flavor_meta_photo_path[\s\S]{0,220}!~/,
    'без запрета на .. путь вида ../ ссылается на чужой объект');
});

/* ============ бот ============ */

for (const f of ['server/bot.mjs', 'server/tg.mjs']) {
  test(`${f}: секретов в исходнике нет`, () => {
    const src = repoFile(f);
    const hard = SECRET_PATTERNS.filter(([, re]) => re.test(src)).map(([w]) => w);
    assert.deepEqual(hard, [], f + ': секрет вписан прямо в код');
  });
}

test('бот берёт токен из окружения', () => {
  assert.match(repoFile('server/tg.mjs'), /process\.env\.TELEGRAM_BOT_TOKEN/);
  assert.match(repoFile('server/bot.mjs'), /process\.env\.SUPABASE_SERVICE_KEY|process\.env\.[A-Z_]*KEY/);
});

test('бот принимает команды управления только от своих', () => {
  const bot = repoFile('server/bot.mjs');
  assert.match(bot, /MANAGER_IDS|ADMIN_IDS/, 'иначе /set и /price доступны любому, кто нашёл бота');
});

/* ============ ввод и ограничения в базе ============ */

const LIMITS = [
  ['бронь ограничена по количеству', /RES_LIMIT_QTY|qty\s*(?:<=|between)/],
  ['бронь ограничена по числу', /RES_LIMIT_COUNT/],
  ['время брони проверяется по формату', /\^\[0-2\]|~\s*'\^\\d\{2\}:/],
  ['промокод ограничен по длине', /length\(code\)|char_length\(code\)|maxlength="24"/],
  ['цвет вкуса только шестнадцатеричный', /flavor_meta_tint_hex/],
  ['профиль вкуса в пределах ноль-сто', /flavor_meta_taste_shape/],
  ['описание вкуса ограничено по размеру', /flavor_meta_descr_size/],
  ['скидка не превышает корзину', /if v_disc > p_sum then v_disc := p_sum/]
];
for (const [what, re] of LIMITS) {
  test(`ограничение в базе: ${what}`, () => {
    assert.ok(re.test(SQL) || re.test(CLIENT['demos/admin/index.html']), what + ': проверка не найдена');
  });
}

test('выдача прав закрыта от менеджера города', () => {
  assert.match(SQL, /can_grant\(\)[\s\S]{0,200}owner/,
    'раздавать доступ должен только владелец');
});

test('себя разжаловать нельзя', () => {
  assert.match(SQL, /SELF_REVOKE/);
});

test('менеджер видит только свой город', () => {
  assert.match(SQL, /admin_sees_city\(city\)/);
});

test('покупатель видит только свои заказы', () => {
  assert.match(SQL, /auth\.uid\(\) = user_id or public\.admin_sees_city\(city\)/);
});

test('заблокированный клиент не оформляет заказ', () => {
  assert.match(SQL, /blocked/);
});
