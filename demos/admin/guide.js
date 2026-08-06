// Рисует руководство из текстов guide-ru/uk/pl.js и переключает язык.
//
// Страница знает только, какое руководство показывать: window.KV_GUIDE_KIND = 'manager' или
// 'owner'. Всё остальное приходит из текстов, поэтому добавить язык означает добавить файл,
// а не править вёрстку.
(function () {
  const LANGS = [['ru', 'RU'], ['uk', 'UA'], ['pl', 'PL']];
  const BOOKS = { ru: window.KV_GUIDE_RU, uk: window.KV_GUIDE_UK, pl: window.KV_GUIDE_PL };
  // Подписи самой страницы: их немного, держим рядом.
  const UI = {
    ru: { nav: 'Разделы', back: '← В панель', other: 'Руководство владельца', otherM: 'Руководство менеджера', foot: 'Не нашли ответ? Спросите владельца.' },
    uk: { nav: 'Розділи', back: '← До панелі', other: 'Керівництво власника', otherM: 'Керівництво менеджера', foot: 'Не знайшли відповідь? Запитайте власника.' },
    pl: { nav: 'Sekcje', back: '← Do panelu', other: 'Przewodnik właściciela', otherM: 'Przewodnik menedżera', foot: 'Nie ma odpowiedzi? Zapytaj właściciela.' }
  };

  const kind = window.KV_GUIDE_KIND === 'owner' ? 'owner' : 'manager';
  // Язык общий с панелью: человек выбрал его там, и руководство должно открыться на нём же.
  let lang = localStorage.getItem('kv_adm_lang');
  if (!LANGS.some(([l]) => l === lang)) {
    const nav = String(navigator.language || '').slice(0, 2).toLowerCase();
    lang = LANGS.some(([l]) => l === nav) ? nav : 'ru';
  }

  const esc = s => String(s == null ? '' : s)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function block(b) {
    const [kindOf] = b;
    if (kindOf === 'p') return '<p>' + esc(b[1]) + '</p>';
    if (kindOf === 'h3') return '<h3>' + esc(b[1]) + '</h3>';
    if (kindOf === 'ul') return '<ul>' + b[1].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    if (kindOf === 'steps') return '<ol class="steps">' + b[1].map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>';
    if (kindOf === 'note') {
      const cls = b[1] ? ' ' + b[1] : '';
      const lead = b[2] ? '<b>' + esc(b[2]) + '</b> ' : '';
      return '<div class="note' + cls + '">' + lead + esc(b[3]) + '</div>';
    }
    if (kindOf === 'table') {
      const head = '<tr>' + b[1].map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>';
      const rows = b[2].map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('');
      return '<div class="scroll"><table class="tbl">' + head + rows + '</table></div>';
    }
    return '';
  }

  function draw() {
    const book = BOOKS[lang] || BOOKS.ru;
    const g = book[kind];
    const ui = UI[lang] || UI.ru;
    document.documentElement.lang = lang;
    document.title = 'KatoVape · ' + g.title;

    document.getElementById('gt').textContent = g.title;
    document.getElementById('gs').textContent = g.sub;
    document.getElementById('gback').textContent = ui.back;

    document.getElementById('glangs').innerHTML = LANGS.map(([l, label]) =>
      '<button type="button" data-glang="' + l + '"' + (l === lang ? ' class="on"' : '') + '>' + label + '</button>').join('');

    const other = kind === 'manager'
      ? '<a class="gother" href="./guide-owner.html">' + esc(ui.other) + '</a>'
      : '<a class="gother" href="./guide.html">' + esc(ui.otherM) + '</a>';

    document.getElementById('gnav').innerHTML = '<b>' + esc(ui.nav) + '</b>' +
      g.sections.map(s => '<a href="#' + s.id + '">' + esc(s.h2) + '</a>').join('') + other;

    document.getElementById('gmain').innerHTML = g.sections.map(s =>
      '<section id="' + s.id + '"><h2>' + esc(s.h2) + '</h2>' +
      (s.lead ? '<p class="lead">' + esc(s.lead) + '</p>' : '') +
      s.blocks.map(block).join('') + '</section>').join('');

    document.getElementById('gfoot').textContent = ui.foot;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-glang]');
    if (!b) return;
    lang = b.dataset.glang;
    localStorage.setItem('kv_adm_lang', lang);
    draw();
    window.scrollTo(0, 0);
  });

  draw();
})();
