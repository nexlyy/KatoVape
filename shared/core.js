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
  let meta = {};                     // доп-данные по товарам (рейтинги, бейджи, отзывы)
  let content = {};                  // тексты разделов, промо, самовывоз
  let appliedPromo = null;           // применённый промокод {code, type, value}
  let filters = { brand: '', maxPrice: 0 };

  // локализованное значение: объект {ru,uk,pl} -> строка текущего языка
  function loc(o) { return o ? (o[lang] || o.ru || '') : ''; }
  // строки интерфейса из content.ui с подстановкой {n}/{need}
  function ui(key, vars) {
    let s = loc(content.ui && content.ui[key]) || key;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }

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

  // порядок показа: новинки, потом в наличии, закончившиеся в конце
  function sortItems(items) {
    const w = { new: 0, in: 1, out: 2 };
    return items.slice().sort((a, b) => w[status(a)] - w[status(b)]);
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

  // раскрытая часть карточки: рейтинг, характеристика, вкусы, похожее, отзывы, кнопки
  function detailsHTML(item) {
    const st = status(item);
    let rows = '';
    if (item.flavors && item.flavors.length) {
      rows = '<div class="kvf-list">' + item.flavors.map((f, i) => {
        const have = f.qty > 0;
        return '<div class="kvf-row' + (have ? '' : ' off') + '">' +
          '<span class="kvf-name"><span class="kvf-ic">' + flavorIcon(f.name) + '</span>' + flavorName(f) + '</span>' +
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
    const metaLine = spec ? '<div class="kvf-meta">' + spec + '</div>' : '';
    const stars = st !== 'out' ? '<div class="kvf-rate">' + starsHTML(item) + '</div>' : '';
    const action = st === 'out'
      ? '<button class="kv-restock" data-notify="' + item.id + '">' + ui('notify') + '</button>'
      : '<button class="kvf-res" data-res="' + item.id + '">' + t('reserve') + '</button>';
    return '<div class="kv-details">' + stars + metaLine + rows +
      reviewsHTML(item) + relatedHTML(item) + action + '</div>';
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
    const disc = discount();
    const discLine = disc
      ? '\n' + ui('discount') + (appliedPromo ? ' ' + appliedPromo.code : '') + ': −' + disc + ' zł' : '';
    return t('order') + ' KatoVape (' + cityName(currentCity) + '):\n' + lines.join('\n') +
      discLine + '\n' + t('total') + ': ' + grandTotal() + ' zł\n' + pickup();
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

  // открываем сразу чат менеджера: t.me/<username>?text= подставляет текст
  // черновиком в поле ввода, клиенту остаётся нажать отправить. share/url не
  // годился: он показывал окно "Переслать", где менеджера ещё найти надо.
  // В буфер текст тоже кладём, на случай старого клиента без поддержки драфта.
  function tgSend(text, note) {
    copyText(text);
    toast(note);
    const url = MANAGER + '?text=' + encodeURIComponent(text);
    const tg = window.Telegram && window.Telegram.WebApp;
    setTimeout(() => {
      if (tg && tg.initData) tg.openTelegramLink(url);
      else window.open(url, '_blank');
    }, 350);
  }

  function checkout() {
    if (!cartCount()) return;
    saveLastOrder();
    track('checkout', { total: grandTotal() });
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
      '<div class="kvd-extra"></div>' +
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
      if (e.target.closest('.kvd-promo-go')) {
        const inp = d.querySelector('.kvd-promo input');
        toast(applyPromo(inp.value) ? ui('discount') : ui('promoBad'));
        drawDrawer();
      }
      if (e.target.closest('.kvd-ref button')) inviteFriend();
      if (e.target.closest('.kvd-repeat')) repeatOrder();
      if (e.target.closest('.kvd-go')) checkout();
      if (e.target.closest('.kvd-clear')) { cart = {}; appliedPromo = null; saveCart(); }
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

    // блок промо, скидки, реферала, либо кнопка повтора заказа для пустой корзины
    const extra = d.querySelector('.kvd-extra');
    if (lines.length) {
      const disc = discount();
      const r = content.referral;
      extra.innerHTML =
        '<div class="kvd-promo"><input type="text" placeholder="' + ui('promoPh') +
          '" value="' + (appliedPromo ? appliedPromo.code : '') + '"><button class="kvd-promo-go">' + ui('promoApply') + '</button></div>' +
        (disc ? '<div class="kvd-disc"><span>' + ui('discount') + '</span><span>−' + disc + ' zł</span></div>' : '') +
        (r ? '<div class="kvd-ref"><b>' + loc(r.title) + '</b>' + loc(r.text) +
          '<div class="kvd-ref-p">' + (referralReady() ? loc(r.done) : loc(r.progress).replace('{n}', invitedCount()).replace('{need}', r.need)) + '</div>' +
          (referralReady() ? '' : '<button>' + loc(r.invite) + '</button>') + '</div>' : '');
    } else {
      extra.innerHTML = hasLastOrder()
        ? '<button class="kvd-repeat">' + ui('repeat') + '</button>' : '';
    }

    const disc = discount();
    d.querySelector('.kvd-total').innerHTML = lines.length
      ? t('total') + ': ' + (disc ? '<s>' + cartTotal() + '</s> ' : '') + grandTotal() + ' zł' : '';
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
      const fp = document.getElementById('filters');
      if (fp) filterPanel(fp);
      drawDrawer();
      if (hooks.render) hooks.render();
      renderInfo();
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
    const fp = document.getElementById('filters');
    if (fp) filterPanel(fp);           // бренды у города свои
    drawDrawer();
    if (hooks.render) hooks.render();
    renderInfo();                      // самовывоз зависит от города
    if (hooks.cart) hooks.cart();
    track('city', { to: id });
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

  // ==== рейтинг и отзывы (8) ====
  // если рейтинга в meta нет, генерим стабильный по id: 4.3–4.9, чтобы демо
  // не выглядело пустым, но одна позиция всегда показывала одно и то же
  function hashId(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function ratingOf(item) {
    const m = meta[item.id];
    if (m && m.rating) return m.rating;
    const h = hashId(item.id);
    return { avg: +(4.3 + (h % 7) / 10).toFixed(1), count: 5 + (h % 55) };
  }
  function starsHTML(item) {
    if (status(item) === 'out') return '';
    const r = ratingOf(item), full = Math.round(r.avg);
    let s = '';
    for (let i = 1; i <= 5; i++) s += '<span class="kv-star' + (i <= full ? ' on' : '') + '">★</span>';
    return '<span class="kv-stars">' + s + '<i>' + r.avg.toFixed(1) + ' · ' + r.count + '</i></span>';
  }
  function reviewsHTML(item) {
    const m = meta[item.id];
    if (!m || !m.reviews || !m.reviews.length) return '';
    return '<div class="kv-revs"><b>' + ui('reviews') + '</b>' + m.reviews.map(rv =>
      '<div class="kv-rev"><span class="kv-rev-h">' + rv.a +
      ' <em>' + '★'.repeat(rv.r) + '</em></span>' + rv.t + '</div>').join('') + '</div>';
  }

  // ==== бейджи (10): хит / выбор менеджера / осталось мало ====
  function badgesHTML(item) {
    const m = meta[item.id], out = [];
    if (m && m.badges) m.badges.forEach(b => out.push('<span class="kv-badge ' + b + '">' + ui(b) + '</span>'));
    const q = qty(item);
    if (q > 0 && q <= 3) out.push('<span class="kv-badge few">' + ui('lastFew') + '</span>');
    return out.length ? '<div class="kv-badges">' + out.join('') + '</div>' : '';
  }

  // ==== иконки вкусов (13) ====
  const FLAVOR_ICONS = [
    [/лёд|лед|лід|ice/, '🧊'], [/арбуз|watermelon|кавун/, '🍉'], [/манго|mango/, '🥭'],
    [/клубник|полуниц|truskaw|strawberr/, '🍓'], [/виноград|grape|winogron/, '🍇'],
    [/черник|голубик|чорниц|лохин|blueberr|jagoda|borówk/, '🫐'], [/вишн|cherry|wiśni/, '🍒'],
    [/кола|cola/, '🥤'], [/энергетик|energy|energetyk/, '⚡'], [/мят|mint|м’ят|mięt/, '🌿'],
    [/лимон|лайм|lemon|lime|cytryn|limonk/, '🍋'], [/персик|peach|brzoskwin/, '🍑'],
    [/ананас|pineapple|ananas/, '🍍'], [/банан|banana/, '🍌'], [/яблок|apple|jabłk/, '🍏'],
    [/дын|melon|дин/, '🍈'], [/груш|pear|gruszk/, '🍐'], [/ежевик|blackberr|ожин|jeżyn/, '🫐'],
    [/малин|raspberr|malin/, '🍓'], [/табак|tobacco|tytoń/, '🚬'], [/энерг|барбарис|тропик|микс|mix/, '🍹']
  ];
  function flavorIcon(name) {
    const n = name.toLowerCase();
    for (const [re, ic] of FLAVOR_ICONS) if (re.test(n)) return ic + ' ';
    return '';
  }

  // ==== "с этим берут" (9) ====
  function relatedHTML(item) {
    const cat = db.categories.find(c => c.id === item._cat);
    if (!cat) return '';
    const rel = sortItems(cat.items.filter(x => x.id !== item.id && status(x) !== 'out')).slice(0, 3);
    if (!rel.length) return '';
    return '<div class="kv-rel"><b>' + ui('related') + '</b><div class="kv-rel-row">' +
      rel.map(x => '<button class="kv-rel-i" data-goto="' + x.id + '">' +
        '<img src="' + ROOT + 'data/photos/' + x.id + '.jpg" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
        '<span>' + x.name + '</span><b>' + price(x) + '</b></button>').join('') + '</div></div>';
  }

  // ==== бренд и фильтры (11) ====
  const BRAND_FIX = { 'Elf': 'Elf Bar', 'Lost': 'Lost Mary', 'Funky': 'Funky Monkey' };
  function brandOf(item) {
    if (item.brand) return item.brand;
    const w = item.name.replace(/^Elf Bar \| /, '').split(/[ |]/)[0];
    return BRAND_FIX[w] || w;
  }
  function allBrands() {
    const set = [];
    db.categories.forEach(c => c.items.forEach(it => { const b = brandOf(it); if (!set.includes(b)) set.push(b); }));
    return set.sort();
  }
  function filterPass(item) {
    if (filters.brand && brandOf(item) !== filters.brand) return false;
    if (filters.maxPrice && (item.price || 0) > filters.maxPrice) return false;
    return true;
  }
  function maxItemPrice() {
    let m = 0; db.categories.forEach(c => c.items.forEach(it => { if ((it.price || 0) > m) m = it.price; }));
    return Math.ceil(m / 10) * 10;
  }
  function filterPanel(el) {
    const brands = allBrands(), top = maxItemPrice();
    const cur = filters.maxPrice || top;
    el.innerHTML =
      '<button class="kv-fbtn" type="button">☰ ' + ui('filters') +
      (filters.brand || filters.maxPrice ? ' <i>●</i>' : '') + '</button>' +
      '<div class="kv-fpanel" hidden>' +
        '<label>' + ui('brand') + '<select class="kv-fbrand"><option value="">' + ui('all') + '</option>' +
          brands.map(b => '<option' + (b === filters.brand ? ' selected' : '') + '>' + b + '</option>').join('') + '</select></label>' +
        '<label>' + ui('priceUpTo', { n: '<b class="kv-fprice">' + cur + '</b>' }) +
          '<input type="range" class="kv-frange" min="20" max="' + top + '" step="5" value="' + cur + '"></label>' +
        '<button class="kv-freset" type="button">' + ui('reset') + '</button>' +
      '</div>';
    const panel = el.querySelector('.kv-fpanel');
    el.querySelector('.kv-fbtn').onclick = e => { e.stopPropagation(); panel.hidden = !panel.hidden; };
    el.querySelector('.kv-fbrand').onchange = e => { filters.brand = e.target.value; if (hooks.render) hooks.render(); };
    const range = el.querySelector('.kv-frange');
    range.oninput = e => { el.querySelector('.kv-fprice').textContent = e.target.value; };
    range.onchange = e => { filters.maxPrice = +e.target.value >= top ? 0 : +e.target.value; if (hooks.render) hooks.render(); };
    el.querySelector('.kv-freset').onclick = () => { filters = { brand: '', maxPrice: 0 }; panel.hidden = true; filterPanel(el); if (hooks.render) hooks.render(); };
  }

  // ==== промокод, реферал, скидка (4, 25) ====
  function findPromo(code) {
    return (content.promos || []).find(p => p.code.toUpperCase() === String(code).trim().toUpperCase());
  }
  function applyPromo(code) {
    const p = findPromo(code);
    if (!p) { appliedPromo = null; return false; }
    appliedPromo = p; localStorage.setItem('kv_promo', p.code);
    return true;
  }
  function invitedCount() { return +(localStorage.getItem('kv_invited') || 0); }
  function referralReady() {
    const r = content.referral;
    return r && invitedCount() >= r.need;
  }
  // ссылка-приглашение: свой же сайт с меткой ref
  function referralLink() { return location.origin + location.pathname + '?ref=' + (localStorage.getItem('kv_me') || 'me'); }
  function inviteFriend() {
    const r = content.referral; if (!r) return;
    // демо: каждый показ ссылки засчитываем как принятое приглашение, до нужного числа
    const n = Math.min(invitedCount() + 1, r.need);
    localStorage.setItem('kv_invited', n);
    copyText(referralLink());
    const url = 'https://t.me/share/url?url=' + encodeURIComponent(referralLink()) +
      '&text=' + encodeURIComponent('KatoVape — украинские вейпы в Польше');
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData) tg.openTelegramLink(url); else window.open(url, '_blank');
    toast(n >= r.need ? loc(r.done) : loc(r.progress).replace('{n}', n).replace('{need}', r.need));
    drawDrawer();
  }
  function discount() {
    const sub = cartTotal();
    let d = 0;
    if (appliedPromo) d += appliedPromo.type === 'percent' ? Math.round(sub * appliedPromo.value / 100) : appliedPromo.value;
    if (referralReady() && content.referral) d += content.referral.reward;
    return Math.min(d, sub);
  }
  function grandTotal() { return Math.max(cartTotal() - discount(), 0); }

  // ==== повтор заказа (3) ====
  function lastOrderKey() { return 'kv_last_' + city; }
  function saveLastOrder() {
    if (cartCount()) localStorage.setItem(lastOrderKey(), JSON.stringify(cart));
  }
  function hasLastOrder() {
    try { return Object.keys(JSON.parse(localStorage.getItem(lastOrderKey()) || '{}')).length > 0; }
    catch (e) { return false; }
  }
  function repeatOrder() {
    let last = {};
    try { last = JSON.parse(localStorage.getItem(lastOrderKey()) || '{}'); } catch (e) {}
    let added = false;
    for (const key in last) {
      const av = availFor(key); if (!av) continue;
      cart[key] = Math.min(last[key], av); added = true;
    }
    if (added) { saveCart(); openCart(); } else toast(t('maxQty'));
  }

  // ==== уведомить о поступлении (14) ====
  function notifyRestock(id) {
    const item = find(id); if (!item) return;
    tgSend(ui('notifyMsg') + item.name + ' (' + cityName(currentCity) + ')', ui('notify'));
  }

  // ==== аналитика (29): считаем события локально + в dataLayer, если есть ====
  function track(ev, data) {
    try {
      const s = JSON.parse(localStorage.getItem('kv_stats') || '{}');
      s[ev] = (s[ev] || 0) + 1;
      localStorage.setItem('kv_stats', JSON.stringify(s));
    } catch (e) {}
    if (window.dataLayer) window.dataLayer.push(Object.assign({ event: 'kv_' + ev, city: city }, data || {}));
  }

  // ==== поиск с подсказками и историей (30) ====
  function searchHistory() { try { return JSON.parse(localStorage.getItem('kv_searches') || '[]'); } catch (e) { return []; } }
  function pushHistory(q) {
    if (!q || q.length < 2) return;
    let h = searchHistory().filter(x => x !== q); h.unshift(q); h = h.slice(0, 6);
    localStorage.setItem('kv_searches', JSON.stringify(h));
  }
  // навешивается на input поиска, onPick(value) вызывается при выборе
  function searchSuggest(input, onPick) {
    const box = document.createElement('div');
    box.className = 'kv-sugg'; box.hidden = true;
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(box);
    function names() {
      const out = [];
      db.categories.forEach(c => c.items.forEach(it => {
        out.push(it.name);
        (it.flavors || []).forEach(f => out.push(flavorName(f)));
      }));
      return out;
    }
    function draw() {
      const q = input.value.trim().toLowerCase();
      let rows = [];
      if (!q) rows = searchHistory().map(h => ['↺', h]);
      else rows = names().filter(n => n.toLowerCase().includes(q))
        .filter((v, i, a) => a.indexOf(v) === i).slice(0, 6).map(n => ['🔍', n]);
      if (!rows.length) { box.hidden = true; return; }
      box.innerHTML = rows.map(([ic, n]) =>
        '<button data-sugg="' + n.replace(/"/g, '&quot;') + '"><span>' + ic + '</span>' + n + '</button>').join('');
      box.hidden = false;
    }
    input.addEventListener('focus', draw);
    input.addEventListener('input', draw);
    input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
    box.onclick = e => {
      const b = e.target.closest('[data-sugg]'); if (!b) return;
      input.value = b.dataset.sugg; pushHistory(input.value);
      box.hidden = true; onPick(input.value);
    };
  }

  // ==== информационные разделы (17,18,19,20) собираем в один контейнер ====
  function renderInfo() {
    const el = document.getElementById('kv-info'); if (!el || !content.howto) return;
    const h = content.howto, f = content.faq, a = content.about, p = content.pickup;
    const pc = p && p.cities && p.cities[city];
    el.innerHTML =
      '<section class="kv-sec kv-howto"><h3>' + loc(h.title) + '</h3><div class="kv-steps">' +
        h.steps.map(s => '<div class="kv-step"><span class="kv-step-n">' + s.ic + '</span>' +
          '<b>' + loc(s.t) + '</b><p>' + loc(s.d) + '</p></div>').join('') + '</div></section>' +
      (pc ? '<section class="kv-sec kv-pickup"><h3>' + loc(p.title) + ' · ' + cityName(currentCity) + '</h3>' +
        '<p class="kv-pick-addr">' + pc.addr + '</p>' +
        '<p class="kv-pick-h">' + loc(p.hoursLabel) + ': ' + loc(pc.hours) + '</p>' +
        '<a class="kv-pick-map" href="' + pc.map + '" target="_blank" rel="noopener">' + loc(p.mapLabel) + ' →</a></section>' : '') +
      (a ? '<section class="kv-sec kv-about"><h3>' + loc(a.title) + '</h3><p>' + loc(a.text) + '</p></section>' : '') +
      (f ? '<section class="kv-sec kv-faq"><h3>' + loc(f.title) + '</h3>' +
        f.items.map((q, i) => '<div class="kv-q" data-faq="' + i + '"><button>' + loc(q.q) + '<span>+</span></button>' +
          '<div class="kv-a" hidden>' + loc(q.a) + '</div></div>').join('') + '</section>' : '');
  }

  // ==== 18+ гейт с записью согласия + PL-предупреждение (21) ====
  function ensureGate() {
    if (localStorage.getItem('kv_age')) return;      // согласие уже дано и записано
    const g = document.createElement('div');
    g.className = 'kv-gate';
    g.innerHTML = '<div class="kv-gate-box"><div class="kv-gate-18">18+</div>' +
      '<p class="kv-gate-warn">' + loc(content.legal && content.legal.warn) + '</p>' +
      '<div class="kv-gate-row"><button class="kv-gate-yes">' + t('gateYes') + '</button>' +
      '<button class="kv-gate-no">' + t('gateNo') + '</button></div></div>';
    document.body.appendChild(g);
    g.querySelector('.kv-gate-yes').onclick = () => {
      localStorage.setItem('kv_age', JSON.stringify({ ok: true, ts: Date.now(), v: 1 }));
      g.remove(); maybeSubscribe();
    };
    g.querySelector('.kv-gate-no').onclick = () => { location.href = 'https://www.google.com'; };
  }

  // ==== cookie-баннер (22) ====
  function ensureCookie() {
    if (localStorage.getItem('kv_cookie') || !content.cookie) return;
    const c = document.createElement('div');
    c.className = 'kv-cookie';
    c.innerHTML = '<span>' + loc(content.cookie.text) + '</span><button>' + loc(content.cookie.ok) + '</button>';
    document.body.appendChild(c);
    c.querySelector('button').onclick = () => { localStorage.setItem('kv_cookie', '1'); c.remove(); };
  }

  // ==== попап подписки на канал (26), один раз ====
  function maybeSubscribe() {
    if (localStorage.getItem('kv_subbed') || !content.subscribe) return;
    if (localStorage.getItem('kv_age') == null) return;   // не поверх гейта
    const s = content.subscribe;
    const el = document.createElement('div');
    el.className = 'kv-sub';
    el.innerHTML = '<div class="kv-sub-box"><b>' + loc(s.title) + '</b><p>' + loc(s.text) + '</p>' +
      '<a class="kv-sub-go" href="' + s.url + '" target="_blank" rel="noopener">' + loc(s.btn) + '</a>' +
      '<button class="kv-sub-later">' + loc(s.later) + '</button></div>';
    document.body.appendChild(el);
    const close = () => { localStorage.setItem('kv_subbed', '1'); el.remove(); };
    el.querySelector('.kv-sub-later').onclick = close;
    el.querySelector('.kv-sub-go').onclick = () => { track('subscribe'); close(); };
    el.onclick = e => { if (e.target === el) close(); };
  }

  // ==== один общий стиль для всех новых компонентов ====
  // сайты только мапят палитру на нейтральные токены --kv-*, разметку красим тут
  function injectCSS() {
    if (document.getElementById('kv-shared')) return;
    const css = `
:root{--kv-radius:14px}
.kv-stars{display:inline-flex;align-items:center;gap:1px;font-size:12px}
.kv-star{color:var(--kv-line)}.kv-star.on{color:#ffb020}
.kv-stars i{font-style:normal;color:var(--kv-muted);font-size:11px;margin-left:5px}
.kv-badges{display:flex;gap:5px;flex-wrap:wrap}
.kv-badge{font-size:10px;font-weight:800;padding:3px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.4px}
.kv-badge.hit{background:#ff5c3322;color:#ff6a3d}
.kv-badge.choice{background:#8f6bff22;color:#9a7bff}
.kv-badge.few{background:#ffb02022;color:#e0920f}
.kv-revs{margin-top:12px}.kv-revs>b{font-size:12px;color:var(--kv-muted);display:block;margin-bottom:6px}
.kv-rev{font-size:12.5px;line-height:1.5;padding:7px 0;border-top:1px solid var(--kv-line)}
.kv-rev-h{display:block;font-weight:700}.kv-rev-h em{color:#ffb020;font-style:normal;font-size:11px}
.kv-rel{margin-top:12px}.kv-rel>b{font-size:12px;color:var(--kv-muted);display:block;margin-bottom:7px}
.kv-rel-row{display:flex;gap:8px}
.kv-rel-i{flex:1;min-width:0;background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:calc(var(--kv-radius) - 4px);padding:7px;cursor:pointer;text-align:center;font-family:inherit;color:var(--kv-text)}
.kv-rel-i img{width:100%;height:52px;object-fit:contain;background:#fff;border-radius:6px}
.kv-rel-i span{display:block;font-size:11px;font-weight:700;margin:5px 0 2px;line-height:1.2}
.kv-rel-i b{font-size:11px;color:var(--kv-accent-2,var(--kv-accent))}
.kv-restock{margin-top:10px;width:100%;border:1px dashed var(--kv-line);background:none;color:var(--kv-muted);border-radius:var(--kv-radius);padding:9px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}
.kv-restock:hover{color:var(--kv-accent);border-color:var(--kv-accent)}
#filters{position:relative}
.kv-fbtn{border:1px solid var(--kv-line);background:var(--kv-surface);color:var(--kv-text);padding:9px 15px;border-radius:99px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
.kv-fbtn i{color:var(--kv-accent-2,var(--kv-accent));font-style:normal}
.kv-fpanel{position:absolute;top:calc(100% + 8px);left:0;z-index:40;background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:var(--kv-radius);padding:16px;min-width:230px;box-shadow:var(--kv-shadow);display:flex;flex-direction:column;gap:12px}
.kv-fpanel[hidden]{display:none}
.kv-fpanel label{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:700;color:var(--kv-muted)}
.kv-fpanel select{background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:10px;padding:9px;font-family:inherit;font-size:13.5px}
.kv-frange{accent-color:var(--kv-accent)}
.kv-fprice{color:var(--kv-text)}
.kv-freset{background:none;border:none;color:var(--kv-accent-2,var(--kv-accent));font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;text-align:left;padding:0}
.kv-sugg{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:45;background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:var(--kv-radius);padding:5px;box-shadow:var(--kv-shadow)}
.kv-sugg[hidden]{display:none}
.kv-sugg button{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:none;border:none;color:var(--kv-text);padding:9px 11px;border-radius:9px;font-size:13.5px;cursor:pointer;font-family:inherit}
.kv-sugg button:hover{background:var(--kv-surface)}
.kv-sugg span{opacity:.6;font-size:12px}
.kvd-promo{display:flex;gap:7px;margin-top:4px}
.kvd-promo input{flex:1;min-width:0;background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:10px;padding:9px 12px;font-family:inherit;font-size:13px}
.kvd-promo button{background:var(--kv-surface);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:10px;padding:0 14px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit}
.kvd-disc{display:flex;justify-content:space-between;color:var(--kv-accent-2,var(--kv-accent));font-weight:700;font-size:13.5px}
.kvd-ref{border:1px dashed var(--kv-line);border-radius:var(--kv-radius);padding:12px;font-size:12.5px;color:var(--kv-muted);line-height:1.5}
.kvd-ref b{color:var(--kv-text);display:block;margin-bottom:4px}
.kvd-ref button{margin-top:8px;background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:10px;padding:9px 14px;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit}
.kvd-ref .kvd-ref-p{margin-top:6px;font-weight:700;color:var(--kv-text)}
.kvd-repeat{width:100%;background:var(--kv-surface);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:var(--kv-radius);padding:12px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
#kv-info{max-width:1100px;margin:0 auto;padding:10px 22px 40px;display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));position:relative;z-index:1}
.kv-sec{background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:var(--kv-radius);padding:20px 22px}
.kv-sec h3{font-size:16px;margin-bottom:12px;color:var(--kv-text)}
.kv-howto{grid-column:1/-1}
.kv-steps{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.kv-step{display:flex;flex-direction:column;gap:5px}
.kv-step-n{width:30px;height:30px;border-radius:50%;background:var(--kv-accent);color:var(--kv-accent-ink);display:grid;place-items:center;font-weight:900;margin-bottom:4px}
.kv-step b{font-size:14px;color:var(--kv-text)}.kv-step p{font-size:12.5px;color:var(--kv-muted);line-height:1.5}
.kv-pick-addr{font-size:14px;font-weight:700;color:var(--kv-text)}
.kv-pick-h{font-size:12.5px;color:var(--kv-muted);margin:6px 0 10px}
.kv-pick-map{color:var(--kv-accent-2,var(--kv-accent));text-decoration:none;font-weight:700;font-size:13px}
.kv-about p{font-size:13px;color:var(--kv-muted);line-height:1.6}
.kv-q button{width:100%;display:flex;justify-content:space-between;gap:10px;align-items:center;background:none;border:none;border-top:1px solid var(--kv-line);color:var(--kv-text);padding:12px 0;font-size:13.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit}
.kv-q:first-of-type button{border-top:none}
.kv-q button span{color:var(--kv-accent-2,var(--kv-accent));font-size:18px;flex-shrink:0}
.kv-a{font-size:12.5px;color:var(--kv-muted);line-height:1.6;padding:0 0 12px}
.kv-cookie{position:fixed;left:12px;right:12px;bottom:12px;z-index:130;background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:var(--kv-radius);padding:14px 16px;display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;box-shadow:var(--kv-shadow);font-size:12.5px;color:var(--kv-muted)}
.kv-cookie button{background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:10px;padding:9px 18px;font-weight:800;cursor:pointer;font-family:inherit;font-size:12.5px}
.kv-gate{position:fixed;inset:0;z-index:200;background:var(--kv-gate-bg,rgba(6,6,10,.96));display:flex;align-items:center;justify-content:center;padding:20px}
.kv-gate-box{background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:20px;padding:36px 32px;max-width:430px;text-align:center}
.kv-gate-18{font-size:46px;font-weight:900;color:var(--kv-accent);margin-bottom:12px}
.kv-gate-warn{color:var(--kv-muted);line-height:1.6;margin-bottom:24px;font-size:13.5px}
.kv-gate-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.kv-gate-row button{font-weight:800;font-size:14.5px;padding:13px 24px;border-radius:12px;cursor:pointer;border:1px solid var(--kv-line);background:none;color:var(--kv-muted);font-family:inherit}
.kv-gate-yes{background:var(--kv-accent)!important;border-color:var(--kv-accent)!important;color:var(--kv-accent-ink)!important}
.kv-sub{position:fixed;inset:0;z-index:140;background:rgba(6,6,10,.6);display:flex;align-items:center;justify-content:center;padding:20px}
.kv-sub-box{background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:20px;padding:28px;max-width:360px;text-align:center}
.kv-sub-box b{font-size:18px;color:var(--kv-text)}
.kv-sub-box p{color:var(--kv-muted);margin:10px 0 20px;line-height:1.5;font-size:13.5px}
.kv-sub-go{display:block;background:var(--kv-accent);color:var(--kv-accent-ink);text-decoration:none;font-weight:800;padding:13px;border-radius:12px;font-size:14px}
.kv-sub-later{background:none;border:none;color:var(--kv-muted);margin-top:12px;cursor:pointer;font-family:inherit;font-size:12.5px}
.kvf-ic{margin-right:2px}`;
    const s = document.createElement('style');
    s.id = 'kv-shared'; s.textContent = css;
    document.head.appendChild(s);
  }

  // клики по кнопкам "в корзину" и "бронь" ловим один раз на документе
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const ok = cartAdd(add.dataset.add, add.dataset.fl !== undefined ? +add.dataset.fl : undefined);
      toast(t(ok ? 'added' : 'maxQty'));
      if (ok) track('add_to_cart', { id: add.dataset.add });
    }
    const res = e.target.closest('[data-res]');
    if (res) reserve(res.dataset.res);
    const notify = e.target.closest('[data-notify]');
    if (notify) notifyRestock(notify.dataset.notify);
    // переход к похожему товару: подсветить и открыть его карточку
    const goto = e.target.closest('[data-goto]');
    if (goto) {
      const card = document.querySelector('[data-id="' + goto.dataset.goto + '"]');
      if (card) { card.classList.add('open'); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
    // аккордеон FAQ
    const faq = e.target.closest('.kv-q button');
    if (faq) {
      const a = faq.parentNode.querySelector('.kv-a');
      a.hidden = !a.hidden; faq.querySelector('span').textContent = a.hidden ? '+' : '–';
    }
    // клик мимо выпадашек и панели фильтров закрывает их
    if (!e.target.closest('#city') && !e.target.closest('#lang')) closeMenus();
    if (!e.target.closest('#filters')) {
      const fp = document.querySelector('.kv-fpanel'); if (fp) fp.hidden = true;
    }
  });

  function loadJSON(f) { return fetch(ROOT + f, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})); }

  async function init(opts) {
    hooks.render = opts.render;
    hooks.cart = opts.cart || null;
    injectCSS();
    if (!localStorage.getItem('kv_me')) localStorage.setItem('kv_me', Math.random().toString(36).slice(2, 8));
    try {
      const [prod, m, c] = await Promise.all([
        loadJSON('data/products.json'), loadJSON('data/meta.json'), loadJSON('data/content.json')
      ]);
      if (!prod || !prod.categories) throw new Error('no products');
      master = prod; meta = m || {}; content = c || {};
    } catch (e) {
      if (opts.fail) opts.fail();
      return;
    }
    // восстанавливаем ранее введённый промокод
    const savedPromo = localStorage.getItem('kv_promo');
    if (savedPromo) appliedPromo = findPromo(savedPromo) || null;
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
    const fp = document.getElementById('filters');
    if (fp) filterPanel(fp);
    opts.render();
    renderInfo();
    if (hooks.cart) hooks.cart();
    // гейт, cookie и попап подписки только на сайте: в мини-аппе Telegram лишние
    if (!opts.app) {
      ensureGate();
      ensureCookie();
      if (localStorage.getItem('kv_age')) maybeSubscribe();
    }
    track('view');
  }

  return {
    init, t, ui, loc, catName, cityName, pickup, cityLogo, flavorName, specOf, qty, status,
    isNew, match, find, price, plural, fmtDate, photo, detailsHTML, openCart, checkout,
    cartCount, cartTotal, toast, autoHideHeader, sortItems,
    starsHTML, badgesHTML, filterPass, searchSuggest, track,
    get db() { return db; }, get lang() { return lang; }, get city() { return city; },
    manager: MANAGER
  };
})();
