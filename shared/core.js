// Ядро витрин KatoVape. Тут живёт всё общее: база, языки, тема, корзина, бронь.
// Страницы подключают этот файл, рисуют каталог по-своему и дергают KV.*

window.KV = (function () {
  const MANAGER = 'https://t.me/KatoManager';
  const ROOT = '../../../';
  const NEW_DAYS = 14; // моложе двух недель = сам получает метку "новинка"

  const STR = {
    ru: {
      search: 'Поиск по наличию', only: 'только в наличии',
      in: 'в наличии', out: 'нет', new: 'новинка',
      left: 'осталось {n} шт', flavors: 'Вкусы', nic: 'крепость',
      add: 'В корзину', added: 'добавлено', reserve: 'Бронь',
      cart: 'Корзина', cartEmpty: 'Корзина пустая', total: 'Итого',
      checkout: 'Оформить заказ', clear: 'Очистить',
      copied: 'Заказ уже в сообщении, выбери чат менеджера',
      reserved: 'Бронь уже в сообщении, выбери чат менеджера',
      write: 'Написать менеджеру', order: 'Заказ',
      city: 'Город', pickup: 'Самовывоз', pay: 'Оплата: BLIK, перевод, наличные',
      adult: 'Продажа только совершеннолетним. Никотин вызывает зависимость.',
      gateText: 'Тут никотин. Заходи, только если тебе уже есть 18.',
      gateYes: 'Мне есть 18', gateNo: 'Мне нет 18',
      empty: 'Ничего не нашлось', updated: 'наличие на',
      inStockN: 'позиций в наличии', qtyNone: 'закончился', pcs: 'шт',
      maxQty: 'Больше нет на складе',
      ml: 'мл', vol: 'объём', saltnic: 'солевой никотин',
      puffs: 'затяжек', recharge: 'перезаряжаемая', mesh: 'mesh-испаритель'
    },
    uk: {
      search: 'Пошук по наявності', only: 'тільки в наявності',
      in: 'є в наявності', out: 'немає', new: 'новинка',
      left: 'залишилось {n} шт', flavors: 'Смаки', nic: 'міцність',
      add: 'До кошика', added: 'додано', reserve: 'Бронь',
      cart: 'Кошик', cartEmpty: 'Кошик порожній', total: 'Разом',
      checkout: 'Оформити замовлення', clear: 'Очистити',
      copied: 'Замовлення вже в повідомленні, обери чат менеджера',
      reserved: 'Бронь вже в повідомленні, обери чат менеджера',
      write: 'Написати менеджеру', order: 'Замовлення',
      city: 'Місто', pickup: 'Самовивіз', pay: 'Оплата: BLIK, переказ, готівка',
      adult: 'Продаж лише повнолітнім. Нікотин викликає залежність.',
      gateText: 'Тут нікотин. Заходь, тільки якщо тобі вже є 18.',
      gateYes: 'Мені є 18', gateNo: 'Мені немає 18',
      empty: 'Нічого не знайшлось', updated: 'наявність на',
      inStockN: 'позицій в наявності', qtyNone: 'закінчився', pcs: 'шт',
      maxQty: 'Більше немає на складі',
      ml: 'мл', vol: 'об’єм', saltnic: 'сольовий нікотин',
      puffs: 'затяжок', recharge: 'перезаряджувана', mesh: 'mesh-випарник'
    },
    pl: {
      search: 'Szukaj w asortymencie', only: 'tylko dostępne',
      in: 'dostępny', out: 'brak', new: 'nowość',
      left: 'zostało {n} szt', flavors: 'Smaki', nic: 'moc',
      add: 'Do koszyka', added: 'dodano', reserve: 'Rezerwacja',
      cart: 'Koszyk', cartEmpty: 'Koszyk jest pusty', total: 'Razem',
      checkout: 'Złóż zamówienie', clear: 'Wyczyść',
      copied: 'Zamówienie już w wiadomości, wybierz czat managera',
      reserved: 'Rezerwacja już w wiadomości, wybierz czat managera',
      write: 'Napisz do managera', order: 'Zamówienie',
      city: 'Miasto', pickup: 'Odbiór osobisty', pay: 'Płatność: BLIK, przelew, gotówka',
      adult: 'Sprzedaż tylko osobom pełnoletnim. Nikotyna uzależnia.',
      gateText: 'Tu jest nikotyna. Wejdź tylko, jeśli masz 18 lat.',
      gateYes: 'Mam 18 lat', gateNo: 'Nie mam 18',
      empty: 'Nic nie znaleziono', updated: 'stan na',
      inStockN: 'pozycji dostępnych', qtyNone: 'wyprzedany', pcs: 'szt',
      maxQty: 'Nie ma więcej na stanie',
      ml: 'ml', vol: 'pojemność', saltnic: 'sól nikotynowa',
      puffs: 'buchów', recharge: 'z ładowaniem', mesh: 'grzałka mesh'
    }
  };

  // словарь для перевода вкусов пословно: ключи в нижнем регистре, регистр
  // первой буквы восстанавливается автоматически. Английские и марочные слова
  // не трогаем (regex ловит только кириллицу).
  const GLOS = {
    uk: {
      'арбуз':'кавун','манго':'манго','лёд':'лід','виноград':'виноград','мята':'м’ята',
      'клубника':'полуниця','банан':'банан','черника':'чорниця','кола':'кола','персик':'персик',
      'ягодный':'ягідний','ягоды':'ягоди','микс':'мікс','малина':'малина','энергетик':'енергетик',
      'личи':'лічі','вишня':'вишня','смородина':'смородина','табак':'тютюн','барбарис':'барбарис',
      'дыня':'диня','груша':'груша','классик':'класик','жвачка':'жуйка','кислая':'кисла',
      'яблоко':'яблуко','лимон':'лимон','лайм':'лайм','двойное':'подвійне','голубика':'лохина',
      'киви':'ківі','тропик':'тропік','юбилейный':'ювілейний','сахарные':'цукрові','соты':'соти',
      'зимний':'зимовий','ночной':'нічний','ананас':'ананас','питайя':'пітайя','грейпфрут':'грейпфрут',
      'ежевика':'ожина','клюква':'журавлина'
    },
    pl: {
      'арбуз':'arbuz','манго':'mango','лёд':'lód','виноград':'winogrono','мята':'mięta',
      'клубника':'truskawka','банан':'banan','черника':'jagoda','кола':'cola','персик':'brzoskwinia',
      'ягодный':'jagodowy','ягоды':'jagody','микс':'mix','малина':'malina','энергетик':'energetyk',
      'личи':'liczi','вишня':'wiśnia','смородина':'porzeczka','табак':'tytoń','барбарис':'berberys',
      'дыня':'melon','груша':'gruszka','классик':'classic','жвачка':'guma','кислая':'kwaśna',
      'яблоко':'jabłko','лимон':'cytryna','лайм':'limonka','двойное':'podwójne','голубика':'borówka',
      'киви':'kiwi','тропик':'tropik','юбилейный':'jubileuszowy','сахарные':'cukrowe','соты':'plastry',
      'зимний':'zimowy','ночной':'nocny','ананас':'ananas','питайя':'pitaya','грейпфрут':'grejpfrut',
      'ежевика':'jeżyna','клюква':'żurawina'
    }
  };

  // язык при первом заходе: сохранённый выбор, иначе язык Telegram или браузера
  function detectLang() {
    const saved = localStorage.getItem('kv_lang');
    if (saved) return saved;
    const tg = window.Telegram && window.Telegram.WebApp;
    const cand = [];
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code)
      cand.push(tg.initDataUnsafe.user.language_code);
    if (navigator.languages) cand.push.apply(cand, navigator.languages);
    cand.push(navigator.language || '');
    for (const c of cand) {
      const p = String(c).toLowerCase().slice(0, 2);
      if (p === 'uk') return 'uk';
      if (p === 'pl') return 'pl';
      if (p === 'ru' || p === 'be') return 'ru';
    }
    return 'ru';
  }

  let db = null;
  let master = null;                 // мастер-каталог (главный город) + список городов
  let cities = [];
  let city = localStorage.getItem('kv_city') || 'katowice';
  let currentCity = null;
  let lang = detectLang();
  let cart = {};
  let hooks = { render: null, cart: null };

  // у каждого города своя корзина: один заказ уходит в один магазин
  function cartStoreKey() { return 'kv_cart_' + city; }
  function loadCart() {
    try { cart = JSON.parse(localStorage.getItem(cartStoreKey()) || '{}'); }
    catch (e) { cart = {}; }
  }

  function t(key, n) {
    let s = (STR[lang] && STR[lang][key]) || STR.ru[key] || key;
    if (n !== undefined) s = s.replace('{n}', n);
    return s;
  }

  function catName(c) { return c.name[lang] || c.name.ru; }

  function cityName(c) { return c && (c.name[lang] || c.name.ru) || ''; }

  // самовывоз с названием текущего города, идёт в футер и в текст заказа
  function pickup() { return t('pickup') + ': ' + cityName(currentCity); }

  function cityLogo() {
    return ROOT + 'data/photos/' + (currentCity && currentCity.logo || 'cat.png');
  }

  // загрузка каталога выбранного города: главный берём из мастера, остальные
  // тянем их файлом. Каждый файл самодостаточный, мержить не нужно.
  async function loadCity(id) {
    const c = cities.find(x => x.id === id) || cities[0];
    let data = master;
    if (!c.main) data = await (await fetch(ROOT + c.file, { cache: 'no-store' })).json();
    db = data;
    db.categories.forEach(cc => cc.items.forEach(it => { it._cat = cc.id; }));
    city = c.id;
    currentCity = c;
  }

  // перевод одного вкуса пословно
  function flavorName(f) {
    const name = typeof f === 'string' ? f : f.name;
    if (lang === 'ru') return name;
    const dict = GLOS[lang]; if (!dict) return name;
    return name.replace(/[А-Яа-яЁёІіЇїЄєҐґ’']+/g, w => {
      const tr = dict[w.toLowerCase()];
      if (!tr) return w;
      const cap = w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase();
      return cap ? tr[0].toUpperCase() + tr.slice(1) : tr;
    });
  }

  // единицы крепости: для польского приводим кириллические мг/г к mg/g
  function locNic(s) {
    if (!s) return s;
    if (lang === 'pl') return s.replace(/мг/g, 'mg').replace(/г/g, 'g');
    return s;
  }

  // характеристика товара для раскрытой карточки. Если у товара есть spec
  // (объект по языкам), берём его, иначе собираем строку из полей.
  function specOf(item) {
    if (item.spec) return item.spec[lang] || item.spec.ru;
    const cat = item._cat;
    const parts = [];
    if (cat === 'liquids') {
      parts.push(t('vol') + ' ' + (item.vol || 30) + ' ' + t('ml'));
      parts.push(t('saltnic'));
      if (item.nic) parts.push(t('nic') + ' ' + locNic(item.nic));
    } else if (cat === 'disposables') {
      let puffs;
      const k = item.name.match(/(\d+)\s*[KkКк]\b/);
      if (k) puffs = (+k[1]) * 1000;
      else { const m = item.name.match(/(\d{4,6})/); if (m) puffs = +m[1]; }
      if (puffs) parts.push(puffs.toLocaleString('ru-RU') + ' ' + t('puffs'));
      parts.push(t('recharge'));
      if (item.nic) parts.push(locNic(item.nic));
    } else {
      if (item.nic) parts.push(t('nic') + ' ' + locNic(item.nic));
    }
    return parts.join(' · ');
  }

  function qty(item) {
    if (item.flavors && item.flavors.length)
      return item.flavors.reduce((s, f) => s + f.qty, 0);
    return item.qty || 0;
  }

  function isNew(item) {
    if (!item.added || !qty(item)) return false;
    const days = (new Date(db.updated) - new Date(item.added)) / 86400000;
    return days <= NEW_DAYS;
  }

  function status(item) {
    if (!qty(item)) return 'out';
    return isNew(item) ? 'new' : 'in';
  }

  function match(item, q) {
    if (!q) return true;
    if (item.name.toLowerCase().includes(q)) return true;
    return (item.flavors || []).some(f =>
      f.name.toLowerCase().includes(q) || flavorName(f).toLowerCase().includes(q));
  }

  function find(id) {
    for (const c of db.categories)
      for (const it of c.items) if (it.id === id) return it;
    return null;
  }

  function price(item) { return item.price ? item.price + ' zł' : ''; }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function fmtDate(s) {
    const loc = { ru: 'ru-RU', uk: 'uk-UA', pl: 'pl-PL' }[lang];
    return new Date(s).toLocaleDateString(loc, { day: 'numeric', month: 'long' });
  }

  // фото кладутся в data/photos/<id>.jpg руками или скриптом.
  // пока файла нет, видна буква-заглушка, картинка сама встанет сверху когда появится
  function photo(item) {
    const letter = item.name.replace(/[^A-Za-zА-Яа-я]/g, '')[0] || '?';
    return '<div class="kv-photo"><span>' + letter + '</span>' +
      '<img src="' + ROOT + 'data/photos/' + item.id + '.jpg" alt="" ' +
      'loading="lazy" decoding="async" onerror="this.remove()"></div>';
  }

  // раскрытая часть карточки: характеристика, вкусы с остатками, кнопки
  function detailsHTML(item) {
    const st = status(item);
    let rows = '';
    if (item.flavors && item.flavors.length) {
      rows = '<div class="kvf-list">' + item.flavors.map((f, i) => {
        const have = f.qty > 0;
        return '<div class="kvf-row' + (have ? '' : ' off') + '">' +
          '<span class="kvf-name">' + flavorName(f) + '</span>' +
          '<span class="kvf-qty">' + (have ? t('left', f.qty) : t('qtyNone')) + '</span>' +
          (have ? '<button class="kvf-add" data-add="' + item.id + '" data-fl="' + i + '">' + t('add') + '</button>' : '') +
          '</div>';
      }).join('') + '</div>';
    } else if (st !== 'out') {
      rows = '<div class="kvf-list"><div class="kvf-row">' +
        '<span class="kvf-name">' + t('left', qty(item)) + '</span>' +
        '<button class="kvf-add" data-add="' + item.id + '">' + t('add') + '</button>' +
        '</div></div>';
    }
    const spec = specOf(item);
    const meta = spec ? '<div class="kvf-meta">' + spec + '</div>' : '';
    const res = st !== 'out'
      ? '<button class="kvf-res" data-res="' + item.id + '">' + t('reserve') + '</button>' : '';
    return '<div class="kv-details">' + meta + rows + res + '</div>';
  }

  // корзина хранится как "id::вкус" -> штук
  // сколько штук позиции реально есть на складе
  function availFor(key) {
    const [id, fl] = key.split('::');
    const item = find(id); if (!item) return 0;
    if (fl !== '' && item.flavors) return item.flavors[+fl] ? item.flavors[+fl].qty : 0;
    return qty(item);
  }

  function cartAdd(id, fl) {
    const key = id + '::' + (fl === undefined ? '' : fl);
    if ((cart[key] || 0) >= availFor(key)) return false;   // больше, чем есть, не продать
    cart[key] = (cart[key] || 0) + 1;
    saveCart();
    return true;
  }
  function cartSet(key, n) {
    if (n <= 0) delete cart[key]; else cart[key] = n;
    saveCart();
  }
  function saveCart() {
    localStorage.setItem(cartStoreKey(), JSON.stringify(cart));
    if (hooks.cart) hooks.cart();
    drawDrawer();
  }
  function cartCount() { return Object.values(cart).reduce((s, n) => s + n, 0); }
  function cartLines() {
    const lines = [];
    for (const key in cart) {
      const [id, fl] = key.split('::');
      const item = find(id); if (!item) continue;
      const flavor = fl !== '' && item.flavors ? item.flavors[+fl] : null;
      lines.push({ key, item, flavor, n: cart[key], sum: (item.price || 0) * cart[key] });
    }
    return lines;
  }
  function cartTotal() { return cartLines().reduce((s, l) => s + l.sum, 0); }

  function orderText() {
    const lines = cartLines().map((l, i) =>
      (i + 1) + ') ' + l.item.name + (l.flavor ? ', ' + flavorName(l.flavor) : '') +
      ' x' + l.n + (l.item.price ? ', ' + l.sum + ' zł' : ''));
    return t('order') + ' KatoVape (' + cityName(currentCity) + '):\n' + lines.join('\n') +
      '\n' + t('total') + ': ' + cartTotal() + ' zł\n' + pickup();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText)
      return navigator.clipboard.writeText(text).catch(() => copyFallback(text));
    copyFallback(text);
    return Promise.resolve();
  }
  function copyFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
  }

  // открываем Telegram так, чтобы сообщение уже было набрано. t.me/share/url
  // прокидывает текст в окно "поделиться", клиент выбирает чат менеджера и жмёт
  // отправить. Заодно кладём текст в буфер как запасной вариант.
  function tgSend(text, note) {
    copyText(text);
    toast(note);
    const url = 'https://t.me/share/url?url=' + encodeURIComponent(MANAGER) +
      '&text=' + encodeURIComponent(text);
    const tg = window.Telegram && window.Telegram.WebApp;
    setTimeout(() => {
      if (tg && tg.initData) tg.openTelegramLink(url);
      else window.open(url, '_blank');
    }, 350);
  }

  function checkout() {
    if (!cartCount()) return;
    tgSend(orderText(), t('copied'));
  }

  function reserve(id) {
    const item = find(id); if (!item) return;
    tgSend(t('reserve') + ': ' + item.name + '. ' + pickup(), t('reserved'));
  }

  function toast(msg) {
    let el = document.querySelector('.kv-toast');
    if (!el) { el = document.createElement('div'); el.className = 'kv-toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // выдвижная корзина, одна на все стили, каждый красит её своим CSS
  function ensureDrawer() {
    if (document.getElementById('kvd')) return;
    const d = document.createElement('div');
    d.id = 'kvd'; d.className = 'kvd'; d.hidden = true;
    d.innerHTML = '<div class="kvd-box">' +
      '<div class="kvd-head"><b class="kvd-title"></b><button class="kvd-x">&times;</button></div>' +
      '<div class="kvd-items"></div>' +
      '<div class="kvd-total"></div>' +
      '<button class="kvd-go"></button>' +
      '<button class="kvd-clear"></button></div>';
    document.body.appendChild(d);
    d.onclick = e => {
      if (e.target === d || e.target.closest('.kvd-x')) d.hidden = true;
      const minus = e.target.closest('[data-minus]');
      if (minus) cartSet(minus.dataset.minus, (cart[minus.dataset.minus] || 0) - 1);
      const plus = e.target.closest('[data-plus]');
      if (plus) {
        const k = plus.dataset.plus;
        if ((cart[k] || 0) >= availFor(k)) toast(t('maxQty'));
        else cartSet(k, (cart[k] || 0) + 1);
      }
      if (e.target.closest('.kvd-go')) checkout();
      if (e.target.closest('.kvd-clear')) { cart = {}; saveCart(); }
    };
  }

  function drawDrawer() {
    const d = document.getElementById('kvd'); if (!d) return;
    d.querySelector('.kvd-title').textContent = t('cart');
    d.querySelector('.kvd-go').textContent = t('checkout');
    d.querySelector('.kvd-clear').textContent = t('clear');
    const lines = cartLines();
    d.querySelector('.kvd-items').innerHTML = lines.length
      ? lines.map(l => '<div class="kvd-row">' +
          '<span class="kvd-name">' + l.item.name + (l.flavor ? '<small>' + flavorName(l.flavor) + '</small>' : '') + '</span>' +
          '<span class="kvd-ctr"><button data-minus="' + l.key + '">&minus;</button><b>' + l.n + '</b><button data-plus="' + l.key + '">+</button></span>' +
          '<span class="kvd-sum">' + l.sum + ' zł</span></div>').join('')
      : '<p class="kvd-empty">' + t('cartEmpty') + '</p>';
    d.querySelector('.kvd-total').textContent = lines.length ? t('total') + ': ' + cartTotal() + ' zł' : '';
    d.querySelector('.kvd-go').hidden = !lines.length;
    d.querySelector('.kvd-clear').hidden = !lines.length;
  }

  function openCart() { ensureDrawer(); drawDrawer(); document.getElementById('kvd').hidden = false; }

  // все выпадашки шапки в одном стиле, открыта максимум одна
  function closeMenus(except) {
    document.querySelectorAll('.kv-city-menu').forEach(m => { if (m !== except) m.hidden = true; });
  }

  // переключатель языка: та же выпадашка, что и город, чтобы шапка не пухла
  function langSwitch(el) {
    const SHORT = { ru: 'RU', uk: 'UA', pl: 'PL' };
    const FULL = { ru: 'Русский', uk: 'Українська', pl: 'Polski' };
    el.innerHTML =
      '<button class="kv-city" type="button">' + SHORT[lang] + '<span class="kv-city-car">▾</span></button>' +
      '<div class="kv-city-menu" hidden>' + ['ru', 'uk', 'pl'].map(l =>
        '<button data-lang="' + l + '"' + (l === lang ? ' class="on"' : '') + '>' + FULL[l] + '</button>').join('') + '</div>';
    const menu = el.querySelector('.kv-city-menu');
    el.querySelector('.kv-city').onclick = e => {
      e.stopPropagation();
      closeMenus(menu);
      menu.hidden = !menu.hidden;
    };
    menu.onclick = e => {
      const b = e.target.closest('[data-lang]'); if (!b) return;
      menu.hidden = true;
      if (b.dataset.lang === lang) return;
      lang = b.dataset.lang;
      localStorage.setItem('kv_lang', lang);
      langSwitch(el);
      const cs = document.getElementById('city');
      if (cs) citySwitch(cs);           // названия городов тоже переводим
      drawDrawer();
      if (hooks.render) hooks.render();
      if (hooks.cart) hooks.cart();
    };
  }

  // выбор города: кнопка с текущим городом и выпадающий список
  function citySwitch(el) {
    const cur = cities.find(c => c.id === city) || cities[0];
    el.innerHTML =
      '<button class="kv-city" type="button"><span class="kv-city-pin">◉</span>' +
      cityName(cur) + '<span class="kv-city-car">▾</span></button>' +
      '<div class="kv-city-menu" hidden>' + cities.map(c =>
        '<button data-city="' + c.id + '"' + (c.id === city ? ' class="on"' : '') + '>' +
        cityName(c) + (c.main ? ' ★' : '') + '</button>').join('') + '</div>';
    const menu = el.querySelector('.kv-city-menu');
    el.querySelector('.kv-city').onclick = e => { e.stopPropagation(); closeMenus(menu); menu.hidden = !menu.hidden; };
    menu.onclick = async e => {
      const b = e.target.closest('[data-city]'); if (!b) return;
      menu.hidden = true;
      if (b.dataset.city !== city) await setCity(b.dataset.city);
    };
  }

  async function setCity(id) {
    localStorage.setItem('kv_city', id);
    await loadCity(id);
    loadCart();
    const cs = document.getElementById('city');
    if (cs) citySwitch(cs);
    drawDrawer();
    if (hooks.render) hooks.render();
    if (hooks.cart) hooks.cart();
  }

  // шапка прячется при скролле вниз и возвращается при скролле вверх.
  // acc копит движение в одну сторону, чтобы шапку не дёргало на мелких рывках
  function autoHideHeader(el) {
    if (!el) return;
    let last = window.scrollY, acc = 0;
    window.addEventListener('scroll', () => {
      const y = Math.max(window.scrollY, 0);
      const d = y - last; last = y;
      if (document.querySelector('.kv-city-menu:not([hidden])')) return;
      acc = (d >= 0) === (acc >= 0) ? acc + d : d;
      if (y < 90 || acc < -14) el.classList.remove('kv-hidden');
      else if (acc > 18 && y > 160) el.classList.add('kv-hidden');
    }, { passive: true });
  }

  // тема: дефолт берём из <html data-theme>, выбор пользователя из localStorage.
  // общий для всех витрин: выставил светлую на одной, видишь светлую везде.
  function themeSwitch(el) {
    const def = document.documentElement.dataset.theme || 'light';
    let th = localStorage.getItem('kv_theme') || def;
    apply(th);
    draw();
    el.onclick = () => {
      th = th === 'dark' ? 'light' : 'dark';
      localStorage.setItem('kv_theme', th);
      apply(th); draw();
    };
    function apply(x) { document.documentElement.dataset.theme = x; }
    function draw() {
      el.innerHTML = '<button class="kv-theme" aria-label="theme">' +
        (th === 'dark' ? '☀' : '☾') + '</button>';
    }
  }

  // клики по кнопкам "в корзину" и "бронь" ловим один раз на документе
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const ok = cartAdd(add.dataset.add, add.dataset.fl !== undefined ? +add.dataset.fl : undefined);
      toast(t(ok ? 'added' : 'maxQty'));
    }
    const res = e.target.closest('[data-res]');
    if (res) reserve(res.dataset.res);
    // клик мимо выпадашек закрывает их
    if (!e.target.closest('#city') && !e.target.closest('#lang')) closeMenus();
  });

  async function init(opts) {
    hooks.render = opts.render;
    hooks.cart = opts.cart || null;
    try {
      const r = await fetch(ROOT + 'data/products.json', { cache: 'no-store' });
      master = await r.json();
    } catch (e) {
      if (opts.fail) opts.fail();
      return;
    }
    cities = master.cities || [{ id: master.city || 'katowice',
      name: { ru: 'Катовице', uk: 'Катовіце', pl: 'Katowice' }, main: true, logo: 'cat.png' }];
    if (!cities.some(c => c.id === city)) city = cities[0].id;
    try {
      await loadCity(city);
    } catch (e) {
      city = cities[0].id;
      await loadCity(city);            // сорвался файл города, откатываемся на главный
    }
    loadCart();
    ensureDrawer();
    drawDrawer();
    const cs = document.getElementById('city');
    if (cs) citySwitch(cs);
    const ts = document.getElementById('theme');
    if (ts) themeSwitch(ts);
    const ls = document.getElementById('lang');
    if (ls) langSwitch(ls);
    opts.render();
    if (hooks.cart) hooks.cart();
  }

  return {
    init, t, catName, cityName, pickup, cityLogo, flavorName, specOf, qty, status,
    isNew, match, find, price, plural, fmtDate, photo, detailsHTML, openCart, checkout,
    cartCount, cartTotal, toast, autoHideHeader,
    get db() { return db; }, get lang() { return lang; }, get city() { return city; },
    manager: MANAGER
  };
})();
