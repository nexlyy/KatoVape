// Выгрузка отчёта с дашборда: CSV, XLSX, DOCX и печать в PDF.
//
// Без единой сторонней библиотеки, и это не упрямство: панель грузится в браузере как есть,
// без сборки, а таблица и текстовый файл это ZIP с XML внутри. ZIP тут пишется без сжатия
// (способ «store»), такой архив открывают и Excel, и Word.
//
// PDF отдельным особняком. Настоящий PDF с кириллицей требует вшитого шрифта, а это сотни
// килобайт в каждой странице. Поэтому PDF делает сам браузер: открываем чистую страницу
// отчёта и зовём печать, человек выбирает «Сохранить как PDF». Текст при этом остаётся
// текстом, а не картинкой, и все три языка выглядят правильно.
(function () {
  'use strict';

  // ---------- словарь отчёта ----------
  // Отдельный от словаря панели: язык отчёта выбирают отдельно, чтобы владелец мог отправить
  // бухгалтеру польский документ, сидя в русском интерфейсе.
  const T = {
    ru: {
      report: 'Отчёт', shop: 'KatoVape', period: 'Период', made: 'Сформирован',
      from: 'с', to: 'по', allTime: 'всё время',
      money: 'Деньги за период', revenue: 'Доход', cogs: 'Себестоимость',
      gross: 'Валовая прибыль', payout: 'Доля менеджеров', expenses: 'Расходы',
      profit: 'Прибыль', avgCheck: 'Средний чек', discounts: 'Сумма скидок',
      orders: 'Заказы за период', ordersN: 'Заказов', done: 'Выдано', cancelled: 'Отменено',
      resConv: 'Броней выкуплено, %', promoUsed: 'Заказов с промокодом',
      clients: 'Клиенты за период', newUsers: 'Новых клиентов', activeUsers: 'Покупали в периоде',
      reviews: 'Отзывов', reviewsAvg: 'Средняя оценка',
      totals: 'Выручка нарастающим итогом', week: 'За неделю', month: 'За месяц',
      year: 'За год', allTimeSum: 'За всё время',
      byCity: 'По городам', city: 'Город', writeOffs: 'Списано',
      stock: 'Движение товара', stockNow: 'Остаток сейчас, шт', stockCost: 'Склад в закупке',
      inQty: 'Пришло, шт', inCost: 'Приход в деньгах', soldQty: 'Продано, шт',
      soldCost: 'Себестоимость проданного', offQty: 'Списано, шт', offCost: 'Убыток от списаний',
      goods: 'Товары', product: 'Товар', qty: 'Штук', sum: 'Сумма',
      topQty: 'Продаётся чаще всего', topRevenue: 'Приносит больше всего',
      managers: 'Менеджеры', manager: 'Менеджер', avgHours: 'Среднее время, ч',
      topClients: 'Самые активные покупатели', client: 'Клиент', spent: 'Куплено на',
      metric: 'Показатель', value: 'Значение', currency: 'zł', pcs: 'шт'
    },
    uk: {
      report: 'Звіт', shop: 'KatoVape', period: 'Період', made: 'Сформовано',
      from: 'з', to: 'по', allTime: 'увесь час',
      money: 'Гроші за період', revenue: 'Дохід', cogs: 'Собівартість',
      gross: 'Валовий прибуток', payout: 'Частка менеджерів', expenses: 'Витрати',
      profit: 'Прибуток', avgCheck: 'Середній чек', discounts: 'Сума знижок',
      orders: 'Замовлення за період', ordersN: 'Замовлень', done: 'Видано', cancelled: 'Скасовано',
      resConv: 'Броней викуплено, %', promoUsed: 'Замовлень із промокодом',
      clients: 'Клієнти за період', newUsers: 'Нових клієнтів', activeUsers: 'Купували в періоді',
      reviews: 'Відгуків', reviewsAvg: 'Середня оцінка',
      totals: 'Виторг наростаючим підсумком', week: 'За тиждень', month: 'За місяць',
      year: 'За рік', allTimeSum: 'За весь час',
      byCity: 'По містах', city: 'Місто', writeOffs: 'Списано',
      stock: 'Рух товару', stockNow: 'Залишок зараз, шт', stockCost: 'Склад у закупівлі',
      inQty: 'Надійшло, шт', inCost: 'Надходження у грошах', soldQty: 'Продано, шт',
      soldCost: 'Собівартість проданого', offQty: 'Списано, шт', offCost: 'Збиток від списань',
      goods: 'Товари', product: 'Товар', qty: 'Штук', sum: 'Сума',
      topQty: 'Продається найчастіше', topRevenue: 'Приносить найбільше',
      managers: 'Менеджери', manager: 'Менеджер', avgHours: 'Середній час, год',
      topClients: 'Найактивніші покупці', client: 'Клієнт', spent: 'Куплено на',
      metric: 'Показник', value: 'Значення', currency: 'zł', pcs: 'шт'
    },
    pl: {
      report: 'Raport', shop: 'KatoVape', period: 'Okres', made: 'Utworzono',
      from: 'od', to: 'do', allTime: 'cały czas',
      money: 'Pieniądze za okres', revenue: 'Przychód', cogs: 'Koszt własny',
      gross: 'Zysk brutto', payout: 'Udział menedżerów', expenses: 'Wydatki',
      profit: 'Zysk', avgCheck: 'Średni koszyk', discounts: 'Suma rabatów',
      orders: 'Zamówienia za okres', ordersN: 'Zamówień', done: 'Wydane', cancelled: 'Anulowane',
      resConv: 'Rezerwacji odebranych, %', promoUsed: 'Zamówień z kodem',
      clients: 'Klienci za okres', newUsers: 'Nowych klientów', activeUsers: 'Kupowało w okresie',
      reviews: 'Opinii', reviewsAvg: 'Średnia ocena',
      totals: 'Przychód narastająco', week: 'Za tydzień', month: 'Za miesiąc',
      year: 'Za rok', allTimeSum: 'Za cały czas',
      byCity: 'Po miastach', city: 'Miasto', writeOffs: 'Odpisano',
      stock: 'Ruch towaru', stockNow: 'Stan teraz, szt', stockCost: 'Magazyn w zakupie',
      inQty: 'Przyjęto, szt', inCost: 'Przyjęcie w pieniądzu', soldQty: 'Sprzedano, szt',
      soldCost: 'Koszt własny sprzedaży', offQty: 'Odpisano, szt', offCost: 'Strata na odpisach',
      goods: 'Towary', product: 'Towar', qty: 'Sztuk', sum: 'Kwota',
      topQty: 'Sprzedaje się najczęściej', topRevenue: 'Przynosi najwięcej',
      managers: 'Menedżerowie', manager: 'Menedżer', avgHours: 'Średni czas, godz',
      topClients: 'Najaktywniejsi klienci', client: 'Klient', spent: 'Kupił za',
      metric: 'Wskaźnik', value: 'Wartość', currency: 'zł', pcs: 'szt'
    }
  };
  const LANGS = [['ru', 'RU'], ['uk', 'UA'], ['pl', 'PL']];
  const tr = (lang, key) => (T[lang] && T[lang][key]) || T.ru[key] || key;

  // ---------- сборка отчёта ----------
  // На вход то, что дашборд уже загрузил, поэтому выгрузка не делает ни одного лишнего
  // запроса и показывает ровно те цифры, что человек видит на экране.
  function build(lang, d) {
    const t = (k) => tr(lang, k);
    const num = (v) => Number(v || 0);
    const cityName = (c) => (d.cityLabel && d.cityLabel[c]) || c;
    const k = d.kpi || {}, fin = d.fin || {}, mov = (d.stock && d.stock.totals) || {};
    const byCity = fin.by_city || [];
    const sum = (key) => byCity.reduce((a, c) => a + num(c[key]), 0);
    const shared = num(fin.shared_expenses);

    const sections = [];
    const kpi = (title, rows) => sections.push({ title, kind: 'kpi', head: [t('metric'), t('value')], rows });
    const table = (title, head, rows) => rows.length && sections.push({ title, kind: 'table', head, rows });

    kpi(t('money'), [
      [t('revenue'), num(k.revenue_period)], [t('cogs'), sum('cogs')],
      [t('gross'), sum('gross')], [t('payout'), sum('payout')],
      [t('expenses'), sum('expenses') + shared], [t('profit'), sum('profit') - shared],
      [t('avgCheck'), num(k.avg_check)], [t('discounts'), num(k.discount_total)]
    ]);
    kpi(t('orders'), [
      [t('ordersN'), num(k.orders)], [t('done'), num(k.orders_done)],
      [t('cancelled'), num(k.orders_cancelled)], [t('resConv'), num(k.res_conversion)],
      [t('promoUsed'), num(k.promo_used)]
    ]);
    kpi(t('clients'), [
      [t('newUsers'), num(k.users_new)], [t('activeUsers'), num(k.users_active)],
      [t('reviews'), num(k.reviews)], [t('reviewsAvg'), num(k.reviews_avg)]
    ]);
    kpi(t('totals'), [
      [t('week'), num(k.revenue_week)], [t('month'), num(k.revenue_month)],
      [t('year'), num(k.revenue_year)], [t('allTimeSum'), num(k.revenue_total)]
    ]);

    table(t('byCity'),
      [t('city'), t('ordersN'), t('revenue'), t('cogs'), t('gross'), t('payout'), t('expenses'), t('writeOffs'), t('profit')],
      byCity.map((c) => [cityName(c.city), num(c.orders), num(c.revenue), num(c.cogs),
        num(c.gross), num(c.payout), num(c.expenses), num(c.write_offs), num(c.profit)]));

    if (d.stock) {
      kpi(t('stock'), [
        [t('stockNow'), num(mov.stock_qty)], [t('stockCost'), num(mov.stock_cost)],
        [t('inQty'), num(mov.in_qty)], [t('inCost'), num(mov.in_cost)],
        [t('soldQty'), num(mov.sold_qty)], [t('soldCost'), num(mov.sold_cost)],
        [t('offQty'), num(mov.written_qty)], [t('offCost'), num(mov.written_cost)]
      ]);
    }

    const prod = d.products || {};
    table(t('topQty'), [t('product'), t('qty')],
      (prod.top_qty || []).map((r) => [r.name, num(r.qty)]));
    table(t('topRevenue'), [t('product'), t('sum')],
      (prod.top_revenue || []).map((r) => [r.name, num(r.revenue)]));

    table(t('managers'),
      [t('manager'), t('city'), t('ordersN'), t('done'), t('cancelled'), t('revenue'), t('avgHours')],
      ((d.managers || {}).managers || []).map((r) => [String(r.telegram_id), cityName(r.city),
        num(r.orders), num(r.done), num(r.cancelled), num(r.revenue), num(r.avg_hours)]));

    table(t('topClients'), [t('client'), t('ordersN'), t('done'), t('spent')],
      ((d.customers || {}).top || []).map((r) => [r.name, num(r.orders), num(r.done), num(r.spent)]));

    const period = d.from && d.to
      ? t('from') + ' ' + d.from + ' ' + t('to') + ' ' + d.to
      : t('allTime');
    return {
      lang,
      title: t('shop') + ' · ' + t('report'),
      period: t('period') + ': ' + period,
      made: t('made') + ': ' + new Date().toLocaleString('pl-PL'),
      sections
    };
  }

  // ---------- общие мелочи ----------
  const cell = (v) => (v == null ? '' : String(v));
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const xesc = (s) => cell(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

  function fileName(rep, ext) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return 'katovape-' + rep.lang + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.' + ext;
  }

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // ---------- ZIP без сжатия ----------
  // Способ «store»: данные кладутся как есть, поэтому не нужен ни deflate, ни библиотека.
  // Единственное, что приходится считать самому, это контрольная сумма CRC32.
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const utf8 = (s) => new TextEncoder().encode(s);

  function zip(files) {
    const enc = files.map((f) => ({ name: utf8(f.name), data: utf8(f.data) }));
    const parts = [], dir = [];
    let offset = 0;
    const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
    const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

    for (const f of enc) {
      const sum = crc32(f.data);
      const head = [].concat(
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(sum), u32(f.data.length), u32(f.data.length), u16(f.name.length), u16(0));
      parts.push(new Uint8Array(head), f.name, f.data);
      dir.push({ name: f.name, sum, size: f.data.length, offset });
      offset += head.length + f.name.length + f.data.length;
    }

    const central = [];
    let dirSize = 0;
    for (const e of dir) {
      const rec = [].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(e.sum), u32(e.size), u32(e.size), u16(e.name.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.offset));
      central.push(new Uint8Array(rec), e.name);
      dirSize += rec.length + e.name.length;
    }
    const end = new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0), u16(dir.length), u16(dir.length),
      u32(dirSize), u32(offset), u16(0)));

    const all = parts.concat(central, [end]);
    const total = all.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of all) { out.set(p, at); at += p.length; }
    return out;
  }

  // ---------- CSV ----------
  // Разделитель точка с запятой: с ним Excel в польской и русской локали открывает файл
  // сразу, без окна импорта. Метка BOM в начале, иначе кириллица приезжает кракозябрами.
  function csv(rep) {
    const q = (v) => {
      const s = cell(v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [q(rep.title), q(rep.period), q(rep.made), ''];
    for (const s of rep.sections) {
      lines.push(q(s.title));
      lines.push(s.head.map(q).join(';'));
      for (const r of s.rows) lines.push(r.map(q).join(';'));
      lines.push('');
    }
    return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  // ---------- XLSX ----------
  function sheetXml(s) {
    const rows = [s.head].concat(s.rows);
    const body = rows.map((r, i) =>
      '<row r="' + (i + 1) + '">' + r.map((v, j) => {
        const ref = colName(j) + (i + 1);
        if (isNum(v)) return '<c r="' + ref + '"><v>' + v + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xesc(v) + '</t></is></c>';
      }).join('') + '</row>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetData>' + body + '</sheetData></worksheet>';
  }
  function colName(i) {
    let s = '';
    for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  }
  // Имя листа в Excel: не длиннее 31 знака и без служебных символов.
  function sheetName(title, i, used) {
    let n = cell(title).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || ('Лист ' + (i + 1));
    let k = 1;
    while (used.has(n)) n = n.slice(0, 26) + ' ' + (++k);
    used.add(n);
    return n;
  }

  function xlsx(rep) {
    const used = new Set();
    const sheets = rep.sections.map((s, i) => ({ s, name: sheetName(s.title, i, used) }));
    const files = [
      { name: '[Content_Types].xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
            '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
          '</Types>' },
      { name: '_rels/.rels',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>' },
      { name: 'xl/workbook.xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
          sheets.map((x, i) => '<sheet name="' + xesc(x.name) + '" sheetId="' + (i + 1) +
            '" r:id="rId' + (i + 1) + '"/>').join('') +
          '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) +
            '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
            (i + 1) + '.xml"/>').join('') +
          '</Relationships>' }
    ];
    sheets.forEach((x, i) => files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(x.s) }));
    return new Blob([zip(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ---------- DOCX ----------
  function docx(rep) {
    const p = (text, style) => '<w:p>' + (style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : '') +
      '<w:r><w:t xml:space="preserve">' + xesc(text) + '</w:t></w:r></w:p>';
    const head = (text, size) => '<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:sz w:val="' + size + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xesc(text) + '</w:t></w:r></w:p>';
    const cellXml = (v, bold) => '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>' +
      '<w:p><w:r>' + (bold ? '<w:rPr><w:b/></w:rPr>' : '') +
      '<w:t xml:space="preserve">' + xesc(v) + '</w:t></w:r></w:p></w:tc>';
    const tableXml = (s) =>
      '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>' +
      '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
        .map((b) => '<w:' + b + ' w:val="single" w:sz="4" w:color="999999"/>').join('') +
      '</w:tblBorders></w:tblPr>' +
      '<w:tr>' + s.head.map((h) => cellXml(h, true)).join('') + '</w:tr>' +
      s.rows.map((r) => '<w:tr>' + r.map((v) => cellXml(cell(v))).join('') + '</w:tr>').join('') +
      '</w:tbl>';

    const body = head(rep.title, 36) + p(rep.period) + p(rep.made) +
      rep.sections.map((s) => head(s.title, 28) + tableXml(s) + p('')).join('');

    const files = [
      { name: '[Content_Types].xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '</Types>' },
      { name: '_rels/.rels',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '</Relationships>' },
      { name: 'word/document.xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
          '<w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
          '<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1134"/></w:sectPr>' +
          '</w:body></w:document>' }
    ];
    return new Blob([zip(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // ---------- PDF через печать ----------
  function printHTML(rep) {
    const th = (s) => '<th>' + xesc(s) + '</th>';
    const td = (v) => '<td' + (isNum(v) ? ' class="n"' : '') + '>' + xesc(cell(v)) + '</td>';
    const sections = rep.sections.map((s) =>
      '<section><h2>' + xesc(s.title) + '</h2><table><thead><tr>' +
      s.head.map(th).join('') + '</tr></thead><tbody>' +
      s.rows.map((r) => '<tr>' + r.map(td).join('') + '</tr>').join('') +
      '</tbody></table></section>').join('');
    return '<!doctype html><html lang="' + rep.lang + '"><head><meta charset="utf-8">' +
      '<title>' + xesc(rep.title) + '</title><style>' +
      // Схему задаём светлой явно. Без этого браузер с тёмной темой красит страницу тёмным,
      // а текст остаётся почти чёрным, и отчёт выглядит пустыми клетками.
      ':root{color-scheme:light}' +
      'html,body{background:#fff;color:#111}' +
      'body{font:13px/1.5 system-ui,Segoe UI,Arial,sans-serif;margin:24px;max-width:900px}' +
      'h1{font-size:20px;margin:0 0 4px;color:#111}h2{font-size:14px;margin:22px 0 8px;color:#111}' +
      '.meta{color:#555;font-size:12px;margin:0 0 4px}' +
      'table{width:100%;border-collapse:collapse;font-size:12px;background:#fff}' +
      'th,td{border:1px solid #bbb;padding:5px 8px;text-align:left;vertical-align:top;color:#111;background:#fff}' +
      'th{background:#eee;font-weight:600}td.n{text-align:right;font-variant-numeric:tabular-nums}' +
      'section{break-inside:auto}tr{break-inside:avoid}thead{display:table-header-group}' +
      '@page{margin:14mm}' +
      '@media print{body{margin:0}}' +
      '</style></head><body>' +
      '<h1>' + xesc(rep.title) + '</h1>' +
      '<p class="meta">' + xesc(rep.period) + '</p><p class="meta">' + xesc(rep.made) + '</p>' +
      sections + '</body></html>';
  }

  function toPrint(rep) {
    const w = window.open('', '_blank');
    if (!w) return false;                      // окно заблокировано браузером
    w.document.write(printHTML(rep));
    w.document.close();
    w.focus();
    // Даём странице разложиться, иначе печать ловит пустой лист.
    setTimeout(() => { try { w.print(); } catch (e) { /* человек напечатает сам */ } }, 400);
    return true;
  }

  window.KVExport = {
    LANGS, T, tr, build, csv, xlsx, docx, zip, crc32, printHTML, toPrint, download, fileName, colName, sheetName
  };
})();
