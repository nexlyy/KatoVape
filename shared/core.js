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

  // строки для профиля, окна вкуса, отзывов и доставки. Держим их тут же,
  // рядом с базовыми, чтобы t() находил их без правки content.json
  const EXTRA = {
    ru: {
      profile: 'Профиль', guest: 'Гость', yourName: 'Ваше имя', save: 'Сохранить',
      myOrders: 'Мои заказы', myReviews: 'Мои отзывы', myFavs: 'Избранное',
      noFavs: 'Пока пусто. Жми на сердечко в карточке товара.',
      noReviews: 'Вы ещё не оставляли отзывов.', noOrders: 'Заказов пока нет.',
      clearData: 'Очистить мои данные', cleared: 'Данные очищены',
      ordersN: 'заказов', reviewsN: 'отзывов', favsN: 'в избранном',
      pickFlavor: 'Выберите вкус', selected: 'Выбрано', chooseFirst: 'Сначала выберите вкус',
      taste: 'Вкусовой профиль', sweet: 'Сладость', cool: 'Холодок', sour: 'Кислинка',
      flavorDesc: 'Описание вкуса', addFav: 'В избранное', inFav: 'В избранном',
      reviewAdd: 'Оставить отзыв', reviewName: 'Имя', reviewText: 'Что понравилось?',
      reviewSend: 'Отправить', reviewThanks: 'Спасибо за отзыв!', reviewYourRate: 'Ваша оценка',
      reviewNoText: 'Напишите пару слов', you: 'вы',
      delivery: 'Получение', delPickup: 'Самовывоз', delInpost: 'Доставка InPost',
      delCourier: 'Курьер', delFree: 'бесплатно', delivPay: 'Доставка',
      inpostPh: 'Номер посылкомата (напр. KAT01M)', courierPh: 'Адрес доставки',
      needAddr: 'Укажите адрес доставки', needPaczko: 'Укажите номер посылкомата',
      contactTitle: 'Данные для получения', fio: 'Фамилия и имя',
      phoneF: 'Телефон', emailF: 'Эл. почта', paczkoF: 'Пачкомат InPost',
      paczkoHint: 'нужен только при доставке InPost',
      tgPhone: 'Взять из Telegram',
      phoneAsked: 'Откройте бота и нажмите «Поделиться номером»',
      phoneGot: 'Номер подставлен из Telegram',
      edit: 'Изменить', apply: 'Применить',
      dataWarn: 'Проверьте данные внимательно: по ним оформляется отправка. Ошибка задержит посылку.',
      confirmTitle: 'Проверьте данные получателя', confirmOk: 'Всё верно, оформить',
      errFio: 'Укажите фамилию и имя', errPhone2: 'Телефон в формате +48 600 000 000',
      errEmail2: 'Проверьте адрес почты', errPaczko2: 'Номер пачкомата выглядит как KAT01M',
      savedOk: 'Сохранено', needLogin: 'Войдите, чтобы оформить заказ',
      orderDone: 'Заказ оформлен! Менеджер получил уведомление и свяжется с вами.',
      orderFail: 'Не получилось отправить заказ, попробуйте ещё раз',
      resTitle: 'Дата брони', resNote: 'Бронь держим до конца выбранного дня. Утром в день выдачи напомним в Telegram.',
      resOk: 'Забронировать', resDone: 'Бронь принята', resFail: 'Не получилось оформить бронь',
      resLimitCount: 'Больше трёх броней сразу держать нельзя. Выкупите или отмените одну.',
      resLimitQty: 'Одновременно можно держать до 5 единиц товара.',
      resNoshow: 'Три брони подряд остались невыкупленными, бронь временно закрыта. Напишите менеджеру.',
      resHeld: 'У вас в брони: {n} из 5',
      today: 'Сегодня', tomorrow: 'Завтра',
      myRes: 'Мои брони', resCancel: 'Отменить', resCancelled: 'Бронь отменена, позиция вернулась в наличие',
      revNeedBuy: 'Отзыв можно оставить на купленный вкус после выдачи заказа',
      noRevsYet: 'Отзывов пока нет. Ваш будет первым после покупки.',
      stNew: 'оформлен', stConfirmed: 'подтверждён', stDone: 'выдан', stCancelled: 'отменён',
      stActive: 'активна', stExpired: 'истекла', stNotified: 'ждёт выдачи',
      pickMap: 'Выбрать пачкомат',
      lockerTitle: 'Пачкоматы InPost', lockerSearch: 'Улица, район или код',
      lockerNone: 'Ничего не нашлось. Попробуйте название улицы.',
      lockerMore: 'Ещё {n} точек. Уточните поиск.',
      lockerLoad: 'Загружаем список точек…', lockerPicked: 'Выбран пачкомат'
    },
    uk: {
      profile: 'Профіль', guest: 'Гість', yourName: 'Ваше ім’я', save: 'Зберегти',
      myOrders: 'Мої замовлення', myReviews: 'Мої відгуки', myFavs: 'Обране',
      noFavs: 'Поки порожньо. Тисни на сердечко в картці товару.',
      noReviews: 'Ви ще не залишали відгуків.', noOrders: 'Замовлень поки немає.',
      clearData: 'Очистити мої дані', cleared: 'Дані очищено',
      ordersN: 'замовлень', reviewsN: 'відгуків', favsN: 'в обраному',
      pickFlavor: 'Оберіть смак', selected: 'Обрано', chooseFirst: 'Спочатку оберіть смак',
      taste: 'Смаковий профіль', sweet: 'Солодкість', cool: 'Холодок', sour: 'Кислинка',
      flavorDesc: 'Опис смаку', addFav: 'В обране', inFav: 'В обраному',
      reviewAdd: 'Залишити відгук', reviewName: 'Ім’я', reviewText: 'Що сподобалось?',
      reviewSend: 'Надіслати', reviewThanks: 'Дякуємо за відгук!', reviewYourRate: 'Ваша оцінка',
      reviewNoText: 'Напишіть кілька слів', you: 'ви',
      delivery: 'Отримання', delPickup: 'Самовивіз', delInpost: 'Доставка InPost',
      delCourier: 'Кур’єр', delFree: 'безкоштовно', delivPay: 'Доставка',
      inpostPh: 'Номер поштомата (напр. KAT01M)', courierPh: 'Адреса доставки',
      needAddr: 'Вкажіть адресу доставки', needPaczko: 'Вкажіть номер поштомата',
      contactTitle: 'Дані для отримання', fio: 'Прізвище та ім’я',
      phoneF: 'Телефон', emailF: 'Ел. пошта', paczkoF: 'Поштомат InPost',
      paczkoHint: 'потрібен лише при доставці InPost',
      tgPhone: 'Взяти з Telegram',
      phoneAsked: 'Відкрийте бота й натисніть «Поділитися номером»',
      phoneGot: 'Номер підставлено з Telegram',
      edit: 'Змінити', apply: 'Застосувати',
      dataWarn: 'Перевірте дані уважно: за ними оформлюється відправка. Помилка затримає посилку.',
      confirmTitle: 'Перевірте дані отримувача', confirmOk: 'Все вірно, оформити',
      errFio: 'Вкажіть прізвище та ім’я', errPhone2: 'Телефон у форматі +48 600 000 000',
      errEmail2: 'Перевірте адресу пошти', errPaczko2: 'Номер поштомата виглядає як KAT01M',
      savedOk: 'Збережено', needLogin: 'Увійдіть, щоб оформити замовлення',
      orderDone: 'Замовлення оформлено! Менеджер отримав сповіщення і зв’яжеться з вами.',
      orderFail: 'Не вдалося надіслати замовлення, спробуйте ще раз',
      resTitle: 'Дата броні', resNote: 'Бронь тримаємо до кінця обраного дня. Вранці в день видачі нагадаємо в Telegram.',
      resOk: 'Забронювати', resDone: 'Бронь прийнято', resFail: 'Не вдалося оформити бронь',
      resLimitCount: 'Більше трьох броней одразу тримати не можна. Викупіть або скасуйте одну.',
      resLimitQty: 'Одночасно можна тримати до 5 одиниць товару.',
      resNoshow: 'Три броні поспіль лишились невикупленими, бронь тимчасово закрита. Напишіть менеджеру.',
      resHeld: 'У вас у броні: {n} з 5',
      today: 'Сьогодні', tomorrow: 'Завтра',
      myRes: 'Мої броні', resCancel: 'Скасувати', resCancelled: 'Бронь скасовано, позиція повернулась у наявність',
      revNeedBuy: 'Відгук можна залишити на куплений смак після видачі замовлення',
      noRevsYet: 'Відгуків поки немає. Ваш буде першим після покупки.',
      stNew: 'оформлено', stConfirmed: 'підтверджено', stDone: 'видано', stCancelled: 'скасовано',
      stActive: 'активна', stExpired: 'минула', stNotified: 'чекає видачі',
      pickMap: 'Обрати поштомат',
      lockerTitle: 'Поштомати InPost', lockerSearch: 'Вулиця, район або код',
      lockerNone: 'Нічого не знайшлось. Спробуйте назву вулиці.',
      lockerMore: 'Ще {n} точок. Уточніть пошук.',
      lockerLoad: 'Завантажуємо список точок…', lockerPicked: 'Обрано поштомат'
    },
    pl: {
      profile: 'Profil', guest: 'Gość', yourName: 'Twoje imię', save: 'Zapisz',
      myOrders: 'Moje zamówienia', myReviews: 'Moje opinie', myFavs: 'Ulubione',
      noFavs: 'Na razie pusto. Kliknij serduszko w karcie produktu.',
      noReviews: 'Nie dodałeś jeszcze opinii.', noOrders: 'Brak zamówień.',
      clearData: 'Wyczyść moje dane', cleared: 'Dane wyczyszczone',
      ordersN: 'zamówień', reviewsN: 'opinii', favsN: 'w ulubionych',
      pickFlavor: 'Wybierz smak', selected: 'Wybrano', chooseFirst: 'Najpierw wybierz smak',
      taste: 'Profil smaku', sweet: 'Słodycz', cool: 'Chłodek', sour: 'Kwaśność',
      flavorDesc: 'Opis smaku', addFav: 'Do ulubionych', inFav: 'W ulubionych',
      reviewAdd: 'Dodaj opinię', reviewName: 'Imię', reviewText: 'Co Ci się podobało?',
      reviewSend: 'Wyślij', reviewThanks: 'Dziękujemy za opinię!', reviewYourRate: 'Twoja ocena',
      reviewNoText: 'Napisz kilka słów', you: 'ty',
      delivery: 'Odbiór', delPickup: 'Odbiór osobisty', delInpost: 'Dostawa InPost',
      delCourier: 'Kurier', delFree: 'gratis', delivPay: 'Dostawa',
      inpostPh: 'Numer paczkomatu (np. KAT01M)', courierPh: 'Adres dostawy',
      needAddr: 'Podaj adres dostawy', needPaczko: 'Podaj numer paczkomatu',
      contactTitle: 'Dane do odbioru', fio: 'Imię i nazwisko',
      phoneF: 'Telefon', emailF: 'E-mail', paczkoF: 'Paczkomat InPost',
      paczkoHint: 'potrzebny tylko przy dostawie InPost',
      tgPhone: 'Pobierz z Telegrama',
      phoneAsked: 'Otwórz bota i naciśnij „Udostępnij numer”',
      phoneGot: 'Numer pobrany z Telegrama',
      edit: 'Zmień', apply: 'Zastosuj',
      dataWarn: 'Sprawdź dane uważnie: na ich podstawie wysyłamy paczkę. Błąd opóźni dostawę.',
      confirmTitle: 'Sprawdź dane odbiorcy', confirmOk: 'Zgadza się, zamawiam',
      errFio: 'Podaj imię i nazwisko', errPhone2: 'Telefon w formacie +48 600 000 000',
      errEmail2: 'Sprawdź adres e-mail', errPaczko2: 'Numer paczkomatu wygląda jak KAT01M',
      savedOk: 'Zapisano', needLogin: 'Zaloguj się, aby złożyć zamówienie',
      orderDone: 'Zamówienie złożone! Manager dostał powiadomienie i odezwie się.',
      orderFail: 'Nie udało się wysłać zamówienia, spróbuj ponownie',
      resTitle: 'Data rezerwacji', resNote: 'Rezerwację trzymamy do końca wybranego dnia. Rano w dniu odbioru przypomnimy w Telegramie.',
      resOk: 'Zarezerwuj', resDone: 'Rezerwacja przyjęta', resFail: 'Nie udało się zarezerwować',
      resLimitCount: 'Nie można trzymać więcej niż trzech rezerwacji naraz. Odbierz lub anuluj jedną.',
      resLimitQty: 'Jednocześnie można trzymać do 5 sztuk towaru.',
      resNoshow: 'Trzy rezerwacje z rzędu nie zostały odebrane, rezerwacja jest chwilowo zamknięta. Napisz do managera.',
      resHeld: 'W rezerwacji masz: {n} z 5',
      today: 'Dziś', tomorrow: 'Jutro',
      myRes: 'Moje rezerwacje', resCancel: 'Anuluj', resCancelled: 'Rezerwacja anulowana, pozycja wróciła do asortymentu',
      revNeedBuy: 'Opinię można dodać o kupionym smaku po wydaniu zamówienia',
      noRevsYet: 'Brak opinii. Twoja będzie pierwsza po zakupie.',
      stNew: 'złożone', stConfirmed: 'potwierdzone', stDone: 'wydane', stCancelled: 'anulowane',
      stActive: 'aktywna', stExpired: 'wygasła', stNotified: 'czeka na odbiór',
      pickMap: 'Wybierz paczkomat',
      lockerTitle: 'Paczkomaty InPost', lockerSearch: 'Ulica, dzielnica lub kod',
      lockerNone: 'Nic nie znaleziono. Spróbuj nazwy ulicy.',
      lockerMore: 'Jeszcze {n} punktów. Doprecyzuj wyszukiwanie.',
      lockerLoad: 'Ładujemy listę punktów…', lockerPicked: 'Wybrano paczkomat'
    }
  };
  for (const l in EXTRA) Object.assign(STR[l], EXTRA[l]);

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
  let modal = null;                  // открытая карточка товара {id, fl, rate}
  let resLoad = null;                // сколько броней человек уже держит (для подсказки)
  let delivery = null;               // способ получения {method, addr}
  let profileName = '';              // имя из профиля (или из Telegram)
  let isApp = false;                 // true в мини-аппе Telegram (opts.app)
  const DELIVERY_DEF = [             // фолбэк, если в content.json нет блока delivery
    { id: 'pickup', fee: 0 },
    { id: 'inpost', fee: 12 },
    { id: 'courier', fee: 18 }
  ];

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
    // живые остатки и цены из облака поверх файла (файл остаётся запасным)
    try { applyStock(await cloudStock()); } catch (e) {}
  }

  // ---- ассортимент из Supabase: остатки и цены правит менеджер в админке ----
  async function cloudStock() {
    const cfg = window.KV_CONFIG || {};
    if (!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) || cfg.BACKEND !== 'supabase') return null;
    try {
      const res = await fetch(cfg.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/products?city=eq.' +
        encodeURIComponent(city) + '&select=id,flavor,price,qty', {
        headers: { apikey: cfg.SUPABASE_ANON_KEY }, cache: 'no-store'
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }
  function applyStock(rows) {
    if (!rows || !rows.length || !db) return;
    const byId = {};
    rows.forEach(r => { (byId[r.id] = byId[r.id] || []).push(r); });
    db.categories.forEach(cat => cat.items.forEach(it => {
      const rs = byId[it.id]; if (!rs) return;
      if (it.flavors && it.flavors.length) {
        it.flavors.forEach(f => {
          const r = rs.find(x => (x.flavor || '') === f.name);
          if (r) f.qty = r.qty;
        });
        // вкусы, которые менеджер завёл в облаке, а в файле их ещё нет
        rs.forEach(r => {
          if (r.flavor && !it.flavors.some(f => f.name === r.flavor))
            it.flavors.push({ name: r.flavor, qty: r.qty });
        });
      } else {
        const r = rs.find(x => !x.flavor) || rs[0];
        if (r && typeof r.qty === 'number') it.qty = r.qty;
      }
      const pr = rs.find(x => x.price != null);
      if (pr) it.price = pr.price;
    }));
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

  // оптовые цены: item.tiers = [{q:1,p:50},{q:3,p:45},{q:5,p:40}].
  // цена за штуку падает с количеством в одной позиции.
  function priceTiers(item) { return item.tiers && item.tiers.length ? item.tiers : null; }
  function tierPrice(item, n) {
    const ts = priceTiers(item);
    if (!ts) return item.price || 0;
    let p = ts[0].p;
    for (const t of ts) if (n >= t.q) p = t.p;
    return p;
  }

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
      lines.push({ key, item, flavor, n: cart[key], sum: tierPrice(item, cart[key]) * cart[key] });
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
    const fee = deliveryFee();
    const feeLine = fee ? '\n' + t('delivPay') + ': +' + fee + ' zł' : '';
    return t('order') + ' KatoVape (' + cityName(currentCity) + '):\n' + lines.join('\n') +
      discLine + feeLine + '\n' + t('total') + ': ' + grandTotal() + ' zł\n' + deliveryLine();
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

  // ---- проверки данных получателя ----
  function validFio(s) { return (s || '').trim().split(/\s+/).filter(Boolean).length >= 2; }
  function normPhonePl(s) {
    let d = (s || '').replace(/[^\d+]/g, '');
    if (/^\d{9}$/.test(d)) d = '+48' + d;       // 9 цифр без кода = польский номер
    if (/^48\d{9}$/.test(d)) d = '+' + d;
    return d;
  }
  function validPhone(s) { return /^\+\d{10,14}$/.test(normPhonePl(s)); }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim()); }
  function normPaczko(s) { return (s || '').trim().toUpperCase().replace(/\s+/g, ''); }
  function validPaczko(s) { return /^[A-Z]{3}\d{2,4}[A-Z]{0,2}$/.test(normPaczko(s)); }

  function checkout() {
    if (!cartCount()) return;
    const cur = currentDelivery();
    if (cur.method === 'courier' && !(cur.addr || '').trim()) { toast(t('needAddr')); openCart(); return; }
    const logged = window.KVAuth && KVAuth.loggedIn && KVAuth.loggedIn();
    const cloud = window.KVAuth && KVAuth.cloudOn && KVAuth.cloudOn();
    if (logged) { openConfirm(); return; }
    if (cloud) { toast(t('needLogin')); KVAuth.openModal(); return; }
    // демо без бэкенда: заказ уходит текстом в чат менеджера, как раньше
    if (cur.method === 'inpost' && !(cur.addr || '').trim()) { toast(t('needPaczko')); openCart(); return; }
    saveLastOrder();
    logOrder();
    track('checkout', { total: grandTotal(), delivery: cur.method });
    tgSend(orderText(), t('copied'));
  }

  // ---- подтверждение данных перед заказом ----
  // показываем ФИО, телефон, почту (и пачкомат при InPost), можно тут же поправить
  let confirmEdit = false;
  function ensureConfirm() {
    if (document.getElementById('kvc')) return;
    const d = document.createElement('div');
    d.id = 'kvc'; d.className = 'kvc'; d.hidden = true;
    d.innerHTML = '<div class="kvc-box"><button class="kvc-x" aria-label="close">&times;</button><div class="kvc-body"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('.kvc-x')) { closeConfirm(); return; }
      if (e.target.closest('.kvc-edit')) { confirmEdit = true; renderConfirm(); return; }
      if (e.target.closest('.kvc-apply')) { applyConfirm(); return; }
      if (e.target.closest('.kvc-tgphone')) { requestPhone(); return; }
      if (e.target.closest('.kvc-map')) { openGeo(); return; }
      if (e.target.closest('.kvc-go')) { placeOrder(); return; }
    });
  }
  function contactOf() {
    return (window.KVAuth && KVAuth.contact) ? KVAuth.contact() : { name: '', phone: '', email: '', paczkomat: '' };
  }
  function openConfirm() { confirmEdit = false; ensureConfirm(); renderConfirm(); document.getElementById('kvc').hidden = false; document.body.classList.add('kv-noscroll'); }
  function closeConfirm() {
    const d = document.getElementById('kvc'); if (d) d.hidden = true;
    const kvd = document.getElementById('kvd');
    if (!kvd || kvd.hidden) document.body.classList.remove('kv-noscroll');
  }
  function renderConfirm() {
    const d = document.getElementById('kvc'); if (!d) return;
    const ct = contactOf();
    const cur = currentDelivery();
    const inpost = cur.method === 'inpost';
    const need = [
      { k: 'name', lbl: t('fio'), v: ct.name },
      { k: 'phone', lbl: t('phoneF'), v: ct.phone },
      { k: 'email', lbl: t('emailF'), v: ct.email }
    ];
    if (inpost) need.push({ k: 'paczkomat', lbl: t('paczkoF'), v: ct.paczkomat });
    let inner;
    if (confirmEdit) {
      inner = need.map(f =>
        '<label class="kvc-f"><span>' + f.lbl + '</span>' +
        '<input data-ct="' + f.k + '" type="' + (f.k === 'email' ? 'email' : f.k === 'phone' ? 'tel' : 'text') + '" value="' + esc(f.v || '') + '"' +
        (f.k === 'phone' ? ' placeholder="+48 600 000 000"' : f.k === 'paczkomat' ? ' placeholder="KAT01M"' : '') + '></label>' +
        (f.k === 'phone' && tgPhoneReady() ? '<button class="kvc-tgphone" type="button">✈ ' + t('tgPhone') + '</button>' : '') +
        (f.k === 'paczkomat' && geoReady() ? '<button class="kvc-map" type="button">' + t('pickMap') + '</button>' : '')
      ).join('') +
        '<div class="kvc-warn">' + t('dataWarn') + '</div>' +
        '<button class="kvc-apply">' + t('apply') + '</button>';
    } else {
      inner = need.map(f =>
        '<div class="kvc-row"><span>' + f.lbl + '</span><b>' + (esc(f.v || '') || '<i class="kvc-none">—</i>') + '</b></div>').join('') +
        '<div class="kvc-sum"><span>' + t('total') + '</span><b>' + grandTotal() + ' zł</b></div>' +
        '<div class="kvc-row"><span>' + t('delivery') + '</span><b>' + deliveryLabel(cur.method) + '</b></div>' +
        '<div class="kvc-warn">' + t('dataWarn') + '</div>' +
        '<div class="kvc-btns"><button class="kvc-edit">' + t('edit') + '</button>' +
        '<button class="kvc-go">' + t('confirmOk') + '</button></div>';
    }
    d.querySelector('.kvc-body').innerHTML = '<h3 class="kvc-title">' + t('confirmTitle') + '</h3>' + inner;
  }
  async function applyConfirm() {
    const d = document.getElementById('kvc'); if (!d) return;
    const f = {};
    d.querySelectorAll('[data-ct]').forEach(i => { f[i.dataset.ct] = i.value; });
    const ct = Object.assign(contactOf(), f);
    const inpost = currentDelivery().method === 'inpost';
    if (!validFio(ct.name)) { toast(t('errFio')); return; }
    if (!validPhone(ct.phone)) { toast(t('errPhone2')); return; }
    if (!validEmail(ct.email)) { toast(t('errEmail2')); return; }
    if (inpost && !validPaczko(ct.paczkomat)) { toast(t('errPaczko2')); return; }
    ct.phone = normPhonePl(ct.phone);
    ct.paczkomat = normPaczko(ct.paczkomat);
    try {
      if (window.KVAuth && KVAuth.saveContact) await KVAuth.saveContact(ct);
    } catch (e) { toast((e && e.message) || t('orderFail')); return; }
    confirmEdit = false;
    toast(t('savedOk'));
    renderConfirm();
  }
  async function placeOrder() {
    const ct = contactOf();
    const cur = currentDelivery();
    const inpost = cur.method === 'inpost';
    if (!validFio(ct.name) || !validPhone(ct.phone) || !validEmail(ct.email) || (inpost && !validPaczko(ct.paczkomat))) {
      confirmEdit = true; renderConfirm();
      toast(!validFio(ct.name) ? t('errFio') : !validPhone(ct.phone) ? t('errPhone2')
        : !validEmail(ct.email) ? t('errEmail2') : t('errPaczko2'));
      return;
    }
    const items = cartLines().map(l => ({
      id: l.item.id, name: l.item.name,
      flavor: l.flavor ? l.flavor.name : '', n: l.n, sum: l.sum
    }));
    const data = {
      city, sum: grandTotal(), delivery: cur.method,
      address: inpost ? normPaczko(ct.paczkomat) : (cur.addr || ''),
      contact: { name: ct.name.trim(), phone: normPhonePl(ct.phone), email: ct.email.trim(),
        paczkomat: inpost ? normPaczko(ct.paczkomat) : '' },
      items
    };
    const btn = document.querySelector('#kvc .kvc-go');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    const ok = await KVAuth.apiOrder(data);
    if (btn) { btn.disabled = false; btn.textContent = t('confirmOk'); }
    if (!ok) { toast(t('orderFail')); return; }
    saveLastOrder();
    logOrder();
    track('checkout', { total: grandTotal(), delivery: cur.method });
    cart = {};
    saveCart();
    closeConfirm();
    const kvd = document.getElementById('kvd'); if (kvd) kvd.hidden = true;
    document.body.classList.remove('kv-noscroll');
    toast(t('orderDone'));
    if (hooks.cart) hooks.cart();
    loadMyReviewState();
  }

  // ---- телефон из Telegram ----
  // Ни виджет входа, ни initData номер не отдают: его может прислать только сам человек
  // боту кнопкой «Поделиться номером». В мини-аппе показываем нативное окно Telegram,
  // на сайте открываем бота, а дальше подтягиваем профиль, пока номер не появится.
  function tgPhoneReady() { return !!(window.KV_CONFIG && window.KV_CONFIG.TELEGRAM_BOT); }
  function requestPhone() {
    const tg = window.Telegram && window.Telegram.WebApp;
    const bot = window.KV_CONFIG && window.KV_CONFIG.TELEGRAM_BOT;
    if (tg && tg.initData && typeof tg.requestContact === 'function') {
      try { tg.requestContact(ok => { if (ok) pullPhone(8); }); return; } catch (e) {}
    }
    if (!bot) return;
    const url = 'https://t.me/' + bot + '?start=phone';
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
    toast(t('phoneAsked'));
    pullPhone(8);
  }
  async function pullPhone(tries) {
    const had = contactOf().phone;
    for (let i = 0; i < (tries || 4); i++) {
      await new Promise(r => setTimeout(r, 1800));
      if (!(window.KVAuth && KVAuth.refresh)) return;
      try { await KVAuth.refresh(); } catch (e) { continue; }
      const ph = contactOf().phone;
      if (ph && ph !== had) {
        toast(t('phoneGot'));
        // подставляем только номер: полная перерисовка стёрла бы то,
        // что человек уже набрал в соседних полях и ещё не применил
        const inputs = document.querySelectorAll('[data-ct="phone"]');
        if (inputs.length) inputs.forEach(i => { i.value = ph; });
        else {
          const p = document.getElementById('kvp'); if (p && !p.hidden) renderProfile();
          const c = document.getElementById('kvc'); if (c && !c.hidden) renderConfirm();
        }
        return;
      }
    }
  }

  // ---- выбор пачкомата InPost ----
  // Список точек лежит в data/inpost/<город>.json: он выгружен из открытого справочника
  // InPost (server/inpost-fetch.mjs), поэтому ни ключа, ни стороннего виджета не нужно.
  // Файл города подтягиваем только когда человек открыл выбор.
  let lockers = null, lockersCity = null, lockersBusy = false;
  function geoReady() { return true; }
  async function loadLockers(cid) {
    if (lockers && lockersCity === cid) return lockers;
    try {
      const r = await fetch(ROOT + 'data/inpost/' + cid + '.json');
      if (!r.ok) throw new Error(r.status);
      lockers = await r.json();
      lockersCity = cid;   // город запоминаем только при удачной загрузке,
    } catch (e) {          // иначе обрыв связи навсегда оставил бы пустой список
      lockers = [];
      lockersCity = null;
    }
    return lockers;
  }
  function ensureLockerBox() {
    let d = document.getElementById('kvg');
    if (d) return d;
    d = document.createElement('div');
    d.id = 'kvg'; d.className = 'kvg'; d.hidden = true;
    d.innerHTML = '<div class="kvg-box">' +
      '<div class="kvg-head"><b>' + t('lockerTitle') + '</b>' +
      '<button class="kvg-x" aria-label="close">&times;</button></div>' +
      '<input class="kvg-q" type="search" placeholder="' + t('lockerSearch') + '">' +
      '<div class="kvg-list"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('.kvg-x')) { d.hidden = true; document.body.classList.remove('kv-noscroll'); return; }
      const pick = e.target.closest('[data-locker]');
      if (pick) {
        const code = pick.dataset.locker;
        const addr = pick.dataset.addr || '';
        // только подставляем в поле: в профиль это уйдёт по кнопке «Применить»
        // вместе с остальным, что человек сейчас правит
        document.querySelectorAll('[data-ct="paczkomat"]').forEach(i => { i.value = code; });
        setDelivery(undefined, code);
        d.hidden = true;
        document.body.classList.remove('kv-noscroll');
        toast(t('lockerPicked') + ' ' + code + (addr ? ', ' + addr : ''));
      }
    });
    d.querySelector('.kvg-q').addEventListener('input', e => drawLockers(e.target.value));
    return d;
  }
  function drawLockers(q) {
    const box = document.querySelector('#kvg .kvg-list'); if (!box) return;
    const list = lockers || [];
    const s = (q || '').trim().toLowerCase();
    const hit = s
      ? list.filter(x => (x.c + ' ' + x.a + ' ' + (x.p || '') + ' ' + (x.d || '')).toLowerCase().indexOf(s) >= 0)
      : list;
    if (!hit.length) { box.innerHTML = '<p class="kvg-none">' + t('lockerNone') + '</p>'; return; }
    // рисуем первую сотню: в Варшаве точек больше полутора тысяч
    box.innerHTML = hit.slice(0, 100).map(x =>
      '<button class="kvg-i" type="button" data-locker="' + esc(x.c) + '" data-addr="' + esc(x.a) + '">' +
        '<b>' + esc(x.c) + '</b>' +
        '<span>' + esc(x.a) + (x.p ? ', ' + esc(x.p) : '') + '</span>' +
        (x.d ? '<i>' + esc(x.d) + '</i>' : '') +
      '</button>').join('') +
      (hit.length > 100 ? '<p class="kvg-none">' + t('lockerMore').replace('{n}', hit.length - 100) + '</p>' : '');
  }
  async function openGeo() {
    const d = ensureLockerBox();
    const box = d.querySelector('.kvg-list');
    d.hidden = false;
    document.body.classList.add('kv-noscroll');
    if (lockersBusy) return;
    if (!lockers || lockersCity !== city) {
      lockersBusy = true;
      box.innerHTML = '<p class="kvg-none">' + t('lockerLoad') + '</p>';
      await loadLockers(city);
      lockersBusy = false;
    }
    const q = d.querySelector('.kvg-q');
    q.value = '';
    drawLockers('');
    if (!isApp) setTimeout(() => q.focus(), 50);
  }

  // бронь всегда идёт через окно товара: там выбор вкуса и даты выдачи
  function reserve(id) {
    if (!modal || modal.id !== id) openProduct(id);
    if (!modal) return;
    modal.resOpen = true;
    renderModal();
  }
  async function confirmReserve() {
    const item = find(modal.id); if (!item) return;
    const hasFl = !!(item.flavors && item.flavors.length);
    const fl = hasFl && modal.fl >= 0 ? item.flavors[modal.fl] : null;
    if (hasFl && (!fl || fl.qty <= 0)) { toast(t('chooseFirst')); return; }
    const date = modal.resDate;
    const logged = window.KVAuth && KVAuth.loggedIn && KVAuth.loggedIn();
    // вошедший пользователь: бронь в базу, остаток спишется, бот подтвердит в личку
    if (logged && window.KVAuth.apiReserve) {
      const ok = await KVAuth.apiReserve({
        city, product_id: item.id,
        product_name: item.name + (fl ? ' ' + fl.name : ''),
        flavor: fl ? fl.name : '', qty: 1, reserve_date: date
      });
      if (ok !== true) {
        toast(t(ok === 'limitCount' ? 'resLimitCount' : ok === 'limitQty' ? 'resLimitQty'
          : ok === 'noshow' ? 'resNoshow' : 'resFail'));
        return;
      }
      if (fl) fl.qty = Math.max(0, fl.qty - 1); else if (item.qty) item.qty--;
      modal.resOpen = false;
      toast(t('resDone'));
      track('reserve', { id: item.id });
      renderModal();
      if (hooks.render) hooks.render();
      return;
    }
    const bot = window.KV_CONFIG && window.KV_CONFIG.TELEGRAM_BOT;
    if (bot) {
      // гость: бронь уходит боту диплинком, дата зашита в payload
      toast(t('resDone'));
      const url = 'https://t.me/' + bot + '?start=res_' + item.id + '_' + (date || '').replace(/-/g, '') + '_' + city;
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.initData) tg.openTelegramLink(url); else window.open(url, '_blank');
    } else {
      tgSend(t('reserve') + ': ' + item.name + (fl ? ', ' + flavorName(fl) : '') +
        (date ? ', ' + date : '') + '. ' + pickup(), t('reserved'));
    }
    modal.resOpen = false;
    renderModal();
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
      if (e.target.closest('.kvd-repeat')) repeatOrder();
      const dopt = e.target.closest('[data-deliv]');
      if (dopt) { setDelivery(dopt.dataset.deliv, undefined); drawDrawer(); }
      if (e.target.closest('.kvd-go')) checkout();
      if (e.target.closest('.kvd-clear')) { cart = {}; appliedPromo = null; saveCart(); }
    };
    // адрес доставки печатают в поле, полный перерисов сбил бы фокус
    d.addEventListener('input', e => {
      if (e.target.classList.contains('kvd-daddr')) setDelivery(undefined, e.target.value);
    });
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

    // блок промо и скидки, либо кнопка повтора заказа для пустой корзины
    const extra = d.querySelector('.kvd-extra');
    if (lines.length) {
      const disc = discount();
      const fee = deliveryFee();
      extra.innerHTML =
        deliveryHTML() +
        '<div class="kvd-promo"><input type="text" placeholder="' + ui('promoPh') +
          '" value="' + (appliedPromo ? appliedPromo.code : '') + '"><button class="kvd-promo-go">' + ui('promoApply') + '</button></div>' +
        (disc ? '<div class="kvd-disc"><span>' + ui('discount') + '</span><span>−' + disc + ' zł</span></div>' : '') +
        (fee ? '<div class="kvd-disc kvd-fee"><span>' + t('delivPay') + '</span><span>+' + fee + ' zł</span></div>' : '');
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
  // если рейтинга в meta нет, генерим стабильный по id: 4.3-4.9, чтобы демо
  // не выглядело пустым, но одна позиция всегда показывала одно и то же
  function hashId(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  // рейтинг считается только из настоящих отзывов; нет отзывов - нет звёзд
  function ratingOf(item) {
    const list = reviewsFor(item.id);
    if (!list.length) return null;
    const sum = list.reduce((s, x) => s + (x.stars || 5), 0);
    return { avg: +(sum / list.length).toFixed(1), count: list.length };
  }
  function starsHTML(item) {
    if (status(item) === 'out') return '';
    const r = ratingOf(item);
    if (!r) return '';
    const full = Math.round(r.avg);
    let s = '';
    for (let i = 1; i <= 5; i++) s += '<span class="kv-star' + (i <= full ? ' on' : '') + '">★</span>';
    return '<span class="kv-stars">' + s + '<i>' + r.avg.toFixed(1) + ' · ' + r.count + '</i></span>';
  }
  function reviewsHTML(item) {
    const list = reviewsFor(item.id);
    if (!list.length) return '';
    return '<div class="kv-revs"><b>' + ui('reviews') + '</b>' + list.map(rv =>
      '<div class="kv-rev"><span class="kv-rev-h">' + esc(rv.author || t('you')) +
      (rv.flavor ? ' <i class="kv-rev-fl">' + esc(rv.flavor) + '</i>' : '') +
      ' <em>' + '★'.repeat(rv.stars || 5) + '</em></span>' + esc(rv.body || '') + '</div>').join('') + '</div>';
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

  // Цветная метка вкуса вместо эмодзи: полоска с градиентом по «настроению» вкуса.
  // Фрукты идут раньше мяты, чтобы «Кавун Ментол» был арбузным, а не мятным,
  // а чистая «М’ята» всё равно попадала в мятный цвет.
  const FLAVOR_HUES = [
    [/черник|голубик|чорниц|лохин|blueberr|jagoda|borówk|ежевик|ожин|blackberr/, ['#7f8cff', '#4550cf']],
    [/виноград|grape|winogron/, ['#b46bff', '#7a3ecc']],
    [/арбуз|кавун|watermelon|вишн|cherry|wiśni|малин|raspberr|malin|клубник|полуниц|strawberr|truskaw|гранат|granat/, ['#ff5f7d', '#d22a4b']],
    [/персик|peach|brzoskwin|манго|mango|апельсин|orange|pomarań/, ['#ffa15c', '#e0662b']],
    [/ананас|pineapple|ananas|банан|banana|лимон|lemon|cytryn|лайм|lime|limonk|дын|melon|дин/, ['#ffd95e', '#dfa322']],
    [/яблок|apple|jabłk|груш|pear|gruszk|киви|kiwi/, ['#8fe264', '#4ea52c']],
    [/кола|cola|кофе|coffee|шоколад|chocolate|табак|tobacco|tytoń|карамел|caramel/, ['#c68d5c', '#8c5a2c']],
    [/энерг|energy|energetyk|мохито|mojito|тропик|tropic|микс|mix|барбарис/, ['#67dcf5', '#2b9cc4']],
    [/мят|mint|м’ят|м'ят|mięt|ментол|menthol|лёд|лед|лід|ice|холод|cool|fresh/, ['#5ff3d0', '#25b195']]
  ];
  function flavorColors(name) {
    const n = String(name || '').toLowerCase();
    for (const [re, c] of FLAVOR_HUES) if (re.test(n)) return c;
    // вкус не узнали — берём стабильный оттенок из названия, чтобы цвет не прыгал
    const h = hashId(n) % 360;
    return ['hsl(' + h + ' 78% 68%)', 'hsl(' + h + ' 66% 45%)'];
  }
  function flavorGrad(name) {
    const c = flavorColors(name);
    return 'linear-gradient(165deg,' + c[0] + ',' + c[1] + ')';
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
      '&text=' + encodeURIComponent('KatoVape, украинские вейпы в Польше');
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData) tg.openTelegramLink(url); else window.open(url, '_blank');
    toast(n >= r.need ? loc(r.done) : loc(r.progress).replace('{n}', n).replace('{need}', r.need));
    drawDrawer();
  }
  function discount() {
    const sub = cartTotal();
    let d = 0;
    if (appliedPromo) d += appliedPromo.type === 'percent' ? Math.round(sub * appliedPromo.value / 100) : appliedPromo.value;
    return Math.min(d, sub);
  }
  function grandTotal() { return Math.max(cartTotal() - discount(), 0) + deliveryFee(); }

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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ==== вкусовой профиль: сладость / холодок / кислинка (0..100) ====
  // считаем по названию вкуса. Если у вкуса задан taste в базе, берём его.
  function normTaste(o) {
    const c = v => Math.max(4, Math.min(100, Math.round(v || 0)));
    return { sweet: c(o.sweet), cool: c(o.cool), sour: c(o.sour) };
  }
  function tasteOf(item, flavor) {
    if (flavor && flavor.taste) return normTaste(flavor.taste);
    const nm = ((flavor && flavor.name) || item.name || '').toLowerCase();
    const has = re => re.test(nm);
    let sweet = 55, cool = 12, sour = 12;
    if (has(/лёд|лед|лід|ice|холод|frost/)) cool = 82;
    if (has(/мят|mint|м’ят|mięt|peppermint/)) cool = Math.max(cool, 68);
    if (has(/двойн|extra|ultra|max/)) cool += 6;
    if (has(/кисл|sour/)) sour = 78;
    if (has(/лайм|lime|лимон|lemon|cytryn|limonk/)) sour = Math.max(sour, 62);
    if (has(/грейпфрут|grapefruit|grejpfrut|клюкв|żurawin|журавлин|барбарис|berberys|смородин|porzeczk|вишн|cherry|wiśni|ежевик|jeżyn|ожин/)) sour = Math.max(sour, 46);
    if (has(/яблок|apple|jabłk/)) sour = Math.max(sour, 40);
    if (has(/сахар|цукр|sweet|cukr|жвачк|guma|жуйк|кола|cola|энергет|energy|energetyk|манго|mango|банан|banana|виноград|grape|winogron|клубник|truskaw|полуниц|персик|peach|brzoskwin|дын|melon|груш|pear|gruszk|ананас|pineapple|ananas|личи|liczi|лічі|питай|pitay/)) sweet = 82;
    if (has(/табак|tobacco|tytoń/)) { sweet = 30; cool = Math.min(cool, 18); }
    if (has(/мят|mint|mięt/) && !has(/жвачк|guma/)) sweet = Math.min(sweet, 44);
    const h = hashId(nm);
    sweet += (h % 7) - 3; cool += (h % 5) - 2; sour += (h % 5) - 2;
    return normTaste({ sweet, cool, sour });
  }
  function tasteBar(label, v) {
    const n = Math.max(1, Math.round(v / 10));   // шкала 1..10 как в эскизе
    return '<div class="kvm-bar"><span>' + label + '</span>' +
      '<div class="kvm-bar-track"><i style="width:' + (n * 10) + '%"></i></div>' +
      '<b>' + n + '<i>/10</i></b></div>';
  }

  // ==== описание вкуса, своё у каждой позиции ====
  // берём переведённое название вкуса и подбираем концовку по профилю.
  // без длинных тире, двоеточие вместо них
  const DESC_LEAD = {
    cool: { ru: 'ледяная свежесть и долгий холодок', uk: 'крижана свіжість і довгий холодок', pl: 'lodowa świeżość i długi chłodek' },
    sour: { ru: 'яркая кислинка и сочность', uk: 'яскрава кислинка й соковитість', pl: 'wyraźna kwaskowatość i soczystość' },
    sweet: { ru: 'насыщенный сладкий вкус', uk: 'насичений солодкий смак', pl: 'intensywny słodki smak' },
    balanced: { ru: 'мягкий сбалансированный вкус', uk: 'м’який збалансований смак', pl: 'łagodny, zrównoważony smak' },
    tobacco: { ru: 'тёплый табачный вкус без приторности', uk: 'теплий тютюновий смак без нудотності', pl: 'ciepły tytoniowy smak bez mdłości' }
  };
  function flavorDesc(item, flavor) {
    const ov = flavor && flavor.desc;
    if (ov) return typeof ov === 'string' ? ov : (ov[lang] || ov.ru);
    const nm = flavor ? flavorName(flavor) : '';
    const raw = ((flavor && flavor.name) || '').toLowerCase();
    const tp = tasteOf(item, flavor);
    let key = 'balanced';
    if (/табак|tobacco|tytoń/.test(raw)) key = 'tobacco';
    else if (tp.cool >= 65) key = 'cool';
    else if (tp.sour >= 58) key = 'sour';
    else if (tp.sweet >= 72) key = 'sweet';
    const lead = DESC_LEAD[key][lang] || DESC_LEAD[key].ru;
    if (!nm) return lead[0].toUpperCase() + lead.slice(1) + '.';
    return nm + ': ' + lead + '.';
  }

  // ==== избранное ====
  function favs() { try { return JSON.parse(localStorage.getItem('kv_favs') || '[]'); } catch (e) { return []; } }
  function isFav(id) { return favs().includes(id); }
  function toggleFav(id) {
    let f = favs();
    f = f.includes(id) ? f.filter(x => x !== id) : f.concat(id);
    localStorage.setItem('kv_favs', JSON.stringify(f));
    return f.includes(id);
  }

  // ==== отзывы: только настоящие, живут в Supabase ====
  // оставить отзыв можно на вкус из выданного заказа, витринных заглушек больше нет
  let cloudRevs = null;      // все отзывы магазина по товарам: {product_id: [строки]}
  let myRevs = [];           // мои отзывы (для раздела в профиле)
  let reviewables = null;    // какие пары товар+вкус мне можно оценить
  function reviewsFor(id) { return (cloudRevs && cloudRevs[id]) || []; }
  function canReviewNow(id, flName) {
    if (!reviewables) return false;
    return reviewables.some(r => r.product_id === id && (r.flavor || '') === (flName || ''));
  }
  async function loadReviews() {
    if (!(window.KVAuth && KVAuth.apiAllReviews)) { cloudRevs = {}; return; }
    const list = await KVAuth.apiAllReviews();
    const map = {};
    (list || []).forEach(r => { (map[r.product_id] = map[r.product_id] || []).push(r); });
    cloudRevs = map;
    if (hooks.render) hooks.render();
    const d = document.getElementById('kvm');
    if (d && !d.hidden) renderModal();
  }
  async function loadMyReviewState() {
    if (!(window.KVAuth && KVAuth.loggedIn && KVAuth.loggedIn())) { reviewables = null; myRevs = []; return; }
    const [rv, mine] = await Promise.all([
      KVAuth.apiReviewables ? KVAuth.apiReviewables() : null,
      KVAuth.apiMyReviews ? KVAuth.apiMyReviews() : null
    ]);
    reviewables = rv || [];
    myRevs = mine || [];
    const d = document.getElementById('kvm');
    if (d && !d.hidden) renderModal();
  }

  function starsRow(r) {
    const full = Math.round(r.avg);
    let s = '';
    for (let i = 1; i <= 5; i++) s += '<span class="kv-star' + (i <= full ? ' on' : '') + '">★</span>';
    return '<span class="kv-stars">' + s + '<i>' + r.avg.toFixed(1) + ' · ' + r.count + '</i></span>';
  }

  // ==== окно товара: выбор вкуса, профиль, описание, отзывы ====
  function ensureModal() {
    if (document.getElementById('kvm')) return;
    const d = document.createElement('div');
    d.id = 'kvm'; d.className = 'kvm'; d.hidden = true;
    d.innerHTML = '<div class="kvm-box"><button class="kvm-x" aria-label="close">&times;</button><div class="kvm-body"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', onModalClick);
    d.addEventListener('input', e => {
      if (!modal) return;
      if (e.target.classList.contains('kvm-rev-name')) modal.name = e.target.value;
      if (e.target.classList.contains('kvm-rev-text')) modal.text = e.target.value;
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !d.hidden) closeProduct();
    });
  }
  function openProduct(id) {
    const item = find(id); if (!item) return;
    const hasFl = !!(item.flavors && item.flavors.length);
    let fl = -1;
    if (hasFl) { fl = item.flavors.findIndex(f => f.qty > 0); if (fl < 0) fl = 0; }
    modal = { id, fl, rate: 0, name: profileName || '', text: '' };
    ensureModal();
    renderModal();
    const d = document.getElementById('kvm');
    d.hidden = false; d.querySelector('.kvm-box').scrollTop = 0;
    document.body.classList.add('kv-noscroll');
    track('open_product', { id });
  }
  function closeProduct() {
    const d = document.getElementById('kvm'); if (d) d.hidden = true;
    document.body.classList.remove('kv-noscroll');
    modal = null;
  }
  function renderModal() {
    const body = document.querySelector('#kvm .kvm-body'); if (!body || !modal) return;
    const prev = body.querySelector('.kvm-flavs');
    const sc = prev ? prev.scrollTop : 0;
    body.innerHTML = modalHTML(find(modal.id));
    const list = body.querySelector('.kvm-flavs');
    if (list) list.scrollTop = sc;
  }
  function modalHTML(item) {
    if (!item) return '';
    const hasFl = !!(item.flavors && item.flavors.length);
    const fl = hasFl && modal.fl >= 0 ? item.flavors[modal.fl] : null;
    const st = status(item);
    const r = ratingOf(item);
    const catObj = db.categories.find(c => c.id === item._cat);

    // компактная шапка: категория, название, рейтинг, сердечко
    const head =
      '<div class="kvm-head">' +
      '<div class="kvm-hmain">' +
        '<span class="kvm-cat">' + (catObj ? catName(catObj) : '') + '</span>' +
        '<h3 class="kvm-name">' + item.name + '</h3>' +
        badgesHTML(item) +
        '<div class="kvm-hrow"><span class="kvm-price">' + (price(item) || '') + '</span>' + (r ? starsRow(r) : '') + '</div>' +
      '</div>' +
      '<button class="kvm-fav' + (isFav(item.id) ? ' on' : '') + '" data-fav="' + item.id + '" aria-label="fav">' +
        (isFav(item.id) ? '♥' : '♡') + '</button>' +
      '</div>';

    // фото товара (в эскизе "фото с жижей")
    const bigPhoto = '<div class="kvm-photo-big">' + photo(item) + '</div>';

    // выбор вкуса: закрытая строка, по клику раскрывается список со скроллом
    const flavStrip = hasFl ?
      '<div class="kvm-fpick' + (modal.flOpen ? ' open' : '') + '">' +
        '<button class="kvm-fsel" type="button" data-fl-toggle="1">' +
          '<span class="kvm-fsel-bar"' + (fl ? ' style="background:' + flavorGrad(fl.name) + '"' : '') + '></span>' +
          '<span class="kvm-fsel-n">' + (modal.flPicked && fl ? flavorName(fl) : t('pickFlavor')) + '</span>' +
          '<span class="kvm-fsel-ch" aria-hidden="true">▼</span>' +
        '</button>' +
        '<div class="kvm-flavs">' + item.flavors.map((f, i) => {
          const have = f.qty > 0;
          const c = flavorColors(f.name);
          return '<button class="kvm-flav' + (i === modal.fl ? ' sel' : '') + (have ? '' : ' off') + '" data-fl-sel="' + i + '"' +
            ' style="--fl:' + c[0] + ';--fl2:' + c[1] + '"' + (have ? '' : ' disabled') + '>' +
            '<span class="kvm-flav-bar" style="background:' + flavorGrad(f.name) + '"></span>' +
            '<span class="kvm-flav-n">' + flavorName(f) + '</span>' +
            '<span class="kvm-flav-q">' + (have ? f.qty + ' ' + t('pcs') : t('qtyNone')) + '</span>' +
          '</button>';
        }).join('') + '</div>' +
      '</div>' : '';

    // профиль вкуса по шкале 1..10
    const tp = fl ? tasteOf(item, fl) : null;
    const taste = tp ?
      '<div class="kvm-taste"><b>' + t('taste') + '</b>' +
        tasteBar(t('sweet'), tp.sweet) + tasteBar(t('cool'), tp.cool) + tasteBar(t('sour'), tp.sour) +
      '</div>' : '';

    // описание выбранного вкуса
    const desc = fl ?
      '<div class="kvm-desc"><b>' + t('flavorDesc') + '</b><p>' + flavorDesc(item, fl) + '</p></div>' : '';

    const spec = specOf(item);
    const specLine = spec ? '<div class="kvm-spec">' + spec + '</div>' : '';

    // выбранный вкус отдельной карточкой
    const preview = hasFl ?
      '<div class="kvm-pick"><span class="kvm-pick-lbl">' + t('selected') + '</span>' +
        '<div class="kvm-pick-card' + (fl && fl.qty > 0 ? '' : ' off') + '">' +
          '<span class="kvm-pick-bar"' + (fl ? ' style="background:' + flavorGrad(fl.name) + '"' : '') + '></span>' +
          '<span class="kvm-pick-name">' + (fl ? flavorName(fl) : t('pickFlavor')) + '</span>' +
          (fl ? '<span class="kvm-pick-q">' + (fl.qty > 0 ? t('left', fl.qty) : t('qtyNone')) + '</span>' : '') +
        '</div></div>' : '';

    // кнопка в корзину и оптовая сетка цен
    const canAdd = hasFl ? !!(fl && fl.qty > 0) : qty(item) > 0;
    const addBtn = canAdd
      ? '<button class="kvm-add-cta" data-add="' + item.id + '"' + (hasFl ? ' data-fl="' + modal.fl + '"' : '') + '>' +
          t('add') + (item.price ? ' · ' + item.price + ' zł' : '') + '</button>'
      : (st === 'out'
          ? '<button class="kv-restock kvm-restock" data-notify="' + item.id + '">' + ui('notify') + '</button>'
          : '<button class="kvm-add-cta" disabled>' + t('chooseFirst') + '</button>');
    const tiers = priceTiers(item);
    const tiersHTML = tiers ?
      '<div class="kvm-tiers">' + tiers.map(x =>
        '<span class="kvm-tier"><b>' + x.q + '</b> ' + t('pcs') + '<em>' + x.p + ' zł</em></span>').join('') + '</div>' : '';
    const resBtn = st !== 'out' ? '<button class="kvm-res" data-res="' + item.id + '">' + t('reserve') + '</button>' : '';

    // панель брони: дата выдачи, не дальше недели от сегодня
    let resPanel = '';
    if (modal.resOpen && st !== 'out') {
      const days = [];
      const now = new Date();
      for (let i = 0; i <= 7; i++) {
        const dd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const iso = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
        const label = i === 0 ? t('today') : i === 1 ? t('tomorrow')
          : dd.getDate() + '.' + String(dd.getMonth() + 1).padStart(2, '0');
        days.push({ iso, label });
      }
      if (!modal.resDate) modal.resDate = days[0].iso;
      const heldNote = resLoad
        ? '<p class="kvm-rheld">' + t('resHeld').replace('{n}', resLoad.held_qty || 0) + '</p>' : '';
      resPanel = '<div class="kvm-resbox"><b>' + t('resTitle') + '</b>' +
        '<div class="kvm-rdays">' + days.map(x =>
          '<button class="kvm-rday' + (x.iso === modal.resDate ? ' sel' : '') + '" data-res-date="' + x.iso + '" type="button">' + x.label + '</button>').join('') + '</div>' +
        heldNote +
        '<p class="kvm-rnote">' + t('resNote') + '</p>' +
        '<button class="kvm-res-go" data-res-go="1" type="button">' + t('resOk') + '</button></div>';
    }
    const buy = '<div class="kvm-buy">' + preview + addBtn + tiersHTML + resBtn + resPanel + '</div>';

    // отзывы: показываем настоящие, форма только на купленный вкус
    const flavorKey = fl ? fl.name : '';
    const reviews = reviewsFor(item.id);
    const revList = reviews.length ? reviews.map(rv =>
      '<div class="kv-rev"><span class="kv-rev-h">' + esc(rv.author || t('you')) +
      (rv.flavor ? ' <i class="kv-rev-fl">' + esc(rv.flavor) + '</i>' : '') +
      ' <em>' + '★'.repeat(rv.stars || 5) + '</em></span>' + esc(rv.body || '') + '</div>').join('')
      : '<p class="kvm-norevs">' + t('noRevsYet') + '</p>';
    const starPick = [1, 2, 3, 4, 5].map(i =>
      '<button class="kvm-rstar' + (i <= (modal.rate || 0) ? ' on' : '') + '" data-star="' + i + '" type="button">★</button>').join('');
    const canRev = canReviewNow(item.id, flavorKey);
    const revForm = canRev
      ? '<div class="kvm-revform"><b>' + t('reviewAdd') + (fl ? ' · ' + flavorName(fl) : '') + '</b>' +
        '<div class="kvm-rrate"><span>' + t('reviewYourRate') + '</span><div class="kvm-rstars">' + starPick + '</div></div>' +
        '<textarea class="kvm-rev-text" placeholder="' + t('reviewText') + '" rows="2">' + esc(modal.text || '') + '</textarea>' +
        '<button class="kvm-rev-send" type="button">' + t('reviewSend') + '</button>' +
      '</div>'
      : '<p class="kvm-revnote">' + t('revNeedBuy') + '</p>';
    const reviewsBlock = '<div class="kvm-reviews"><div class="kvm-sec-t">' + ui('reviews') + ' · ' + reviews.length + '</div>' +
      revList + revForm + '</div>';

    // раскладка как в эскизе: слева фото/вкусы/отзывы, справа профиль/описание/корзина
    return head +
      '<div class="kvm-grid">' +
        '<div class="kvm-col kvm-col-l">' + bigPhoto + flavStrip + reviewsBlock + '</div>' +
        '<div class="kvm-col kvm-col-r">' + taste + desc + specLine + buy + '</div>' +
      '</div>' +
      relatedHTML(item);
  }
  function onModalClick(e) {
    const d = e.currentTarget;
    if (e.target === d || e.target.closest('.kvm-x')) { closeProduct(); return; }
    const ftog = e.target.closest('[data-fl-toggle]');
    if (ftog) { e.stopPropagation(); modal.flOpen = !modal.flOpen; renderModal(); return; }
    const sel = e.target.closest('[data-fl-sel]');
    // до первого выбора в закрытой строке стоит «Выберите вкус», после — сам вкус
    if (sel) { modal.fl = +sel.dataset.flSel; modal.flPicked = true; modal.flOpen = false; renderModal(); return; }
    const fav = e.target.closest('[data-fav]');
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); renderModal(); if (hooks.render) hooks.render(); return; }
    const add = e.target.closest('[data-add]');
    if (add) {
      e.stopPropagation();
      const ok = cartAdd(add.dataset.add, add.dataset.fl !== undefined ? +add.dataset.fl : undefined);
      toast(t(ok ? 'added' : 'maxQty'));
      if (ok) {
        track('add_to_cart', { id: add.dataset.add });
        // по ТЗ: после добавления сразу показываем корзину, а не оставляем её сзади
        closeProduct();
        openCart();
      } else renderModal();
      return;
    }
    const star = e.target.closest('[data-star]');
    if (star) { modal.rate = +star.dataset.star; renderModal(); return; }
    const send = e.target.closest('.kvm-rev-send');
    if (send) {
      e.stopPropagation();
      if (!modal.text || !modal.text.trim()) { toast(t('reviewNoText')); return; }
      sendReview();
      return;
    }
    const rdate = e.target.closest('[data-res-date]');
    if (rdate) { modal.resDate = rdate.dataset.resDate; renderModal(); return; }
    const rgo = e.target.closest('[data-res-go]');
    if (rgo) { e.stopPropagation(); confirmReserve(); return; }
    const res = e.target.closest('[data-res]');
    if (res) {
      e.stopPropagation();
      modal.resOpen = !modal.resOpen;
      renderModal();
      // подтягиваем, сколько человек уже держит, чтобы предупредить до отказа базы
      if (modal.resOpen && window.KVAuth && KVAuth.reservationLoad) {
        KVAuth.reservationLoad().then(l => {
          resLoad = l;
          const d = document.getElementById('kvm');
          if (l && d && !d.hidden && modal && modal.resOpen) renderModal();
        });
      }
      return;
    }
    const goto = e.target.closest('[data-goto]');
    if (goto) { e.stopPropagation(); openProduct(goto.dataset.goto); return; }
  }

  // отправка отзыва: он привязан к выбранному вкусу и уходит в облако
  async function sendReview() {
    const item = find(modal.id); if (!item) return;
    const fl = item.flavors && modal.fl >= 0 ? item.flavors[modal.fl] : null;
    if (!(window.KVAuth && KVAuth.apiReview)) return;
    const r = await KVAuth.apiReview({
      product_id: item.id,
      flavor: fl ? fl.name : '',
      product_name: item.name + (fl ? ' ' + fl.name : ''),
      author: profileName || t('you'),
      stars: modal.rate || 5,
      body: modal.text.trim()
    });
    if (r && r.error) { toast(t('revNeedBuy')); return; }
    modal.rate = 0; modal.text = '';
    toast(t('reviewThanks'));
    track('review', { id: item.id });
    await loadReviews();
    loadMyReviewState();
    renderModal();
    if (hooks.render) hooks.render();
  }

  // ==== профиль пользователя ====
  function tgUser() {
    const tg = window.Telegram && window.Telegram.WebApp;
    return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
  }
  function saveProfileName(name) {
    profileName = name;
    localStorage.setItem('kv_profile', JSON.stringify({ name }));
  }
  function orderLog() { try { return JSON.parse(localStorage.getItem('kv_orders') || '[]'); } catch (e) { return []; } }
  function logOrder() {
    const log = orderLog();
    log.unshift({ ts: Date.now(), city, n: cartCount(), total: grandTotal(),
      deliv: currentDelivery().method,
      items: cartLines().map(l => l.item.name + (l.flavor ? ' (' + flavorName(l.flavor) + ')' : '') + ' ×' + l.n) });
    localStorage.setItem('kv_orders', JSON.stringify(log.slice(0, 20)));
  }
  const PROF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
  function profileBtn(el) {
    el.innerHTML = '<button class="kv-prof" aria-label="' + t('profile') + '">' + PROF_ICON + '</button>';
    el.querySelector('button').onclick = openProfile;
  }
  function ensureProfile() {
    if (document.getElementById('kvp')) return;
    const d = document.createElement('div');
    d.id = 'kvp'; d.className = 'kvp'; d.hidden = true;
    d.innerHTML = '<div class="kvp-box"><div class="kvp-head"><b class="kvp-title"></b><button class="kvp-x" aria-label="close">&times;</button></div><div class="kvp-body"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('input', e => {
      if (e.target.classList.contains('kvp-name-i')) {
        const save = d.querySelector('.kvp-name-save');
        if (save) save.disabled = false;
      }
    });
    d.addEventListener('click', onProfileClick);
  }
  function openProfile() {
    ensureProfile();
    renderProfile();
    document.getElementById('kvp').hidden = false;
    document.body.classList.add('kv-noscroll');
    loadCloudProfile();
    track('open_profile');
  }
  // облачная часть профиля: заказы, брони и мои отзывы тянутся из Supabase
  let cloudProf = { orders: null, res: null };
  async function loadCloudProfile() {
    if (!(window.KVAuth && KVAuth.loggedIn && KVAuth.loggedIn())) {
      cloudProf = { orders: null, res: null };
      return;
    }
    const [o, r] = await Promise.all([
      KVAuth.apiMyOrders ? KVAuth.apiMyOrders() : null,
      KVAuth.apiMyReservations ? KVAuth.apiMyReservations() : null
    ]);
    cloudProf = { orders: o, res: r };
    await loadMyReviewState();
    const d = document.getElementById('kvp');
    if (d && !d.hidden) renderProfile();
  }
  // при выходе забываем всё, что относилось к прошлому человеку, иначе следующий
  // видит чужие подсказки (сколько броней держит, заказы, отзывы)
  function forgetUserState() {
    resLoad = null;
    cloudProf = { orders: null, res: null };
    myRevs = [];
    reviewables = null;
  }
  function stLabel(s) {
    const k = { new: 'stNew', confirmed: 'stConfirmed', done: 'stDone', cancelled: 'stCancelled',
      active: 'stActive', expired: 'stExpired', notified: 'stNotified' }[s];
    return k ? t(k) : s || '';
  }
  function closeProfile() {
    const d = document.getElementById('kvp'); if (d) d.hidden = true;
    if (!document.getElementById('kvm') || document.getElementById('kvm').hidden) document.body.classList.remove('kv-noscroll');
  }
  function renderProfile() {
    const d = document.getElementById('kvp'); if (!d) return;
    d.querySelector('.kvp-title').textContent = t('profile');
    const u = tgUser();
    const prof = window.KVAuth && KVAuth.profile;
    const name = profileName || (u && u.first_name) || '';
    const initial = (name || 'K').trim()[0].toUpperCase();
    // аватар: сперва фото из Telegram (мини-апп), затем сохранённый в профиле, иначе буква
    const avaSrc = (u && u.photo_url) || (prof && prof.avatar) || '';
    const avatar = avaSrc
      ? '<img src="' + esc(avaSrc) + '" alt="">'
      : '<span>' + esc(initial) + '</span>';
    const uname = u && u.username ? '@' + esc(u.username) : t('guest');
    const isAdm = window.KVAuth && KVAuth.isAdmin && KVAuth.isAdmin();

    const favList = favs().map(id => find(id)).filter(Boolean);
    const logged = window.KVAuth && KVAuth.loggedIn && KVAuth.loggedIn();

    // данные для получения посылки: просмотр или редактирование
    const ct = contactOf();
    let contactBlock = '';
    if (logged) {
      const fields = [
        { k: 'name', lbl: t('fio'), v: ct.name },
        { k: 'phone', lbl: t('phoneF'), v: ct.phone },
        { k: 'email', lbl: t('emailF'), v: ct.email },
        { k: 'paczkomat', lbl: t('paczkoF'), v: ct.paczkomat, hint: t('paczkoHint') }
      ];
      contactBlock = '<div class="kvp-sec kvp-ct"><b>' + t('contactTitle') + '</b>' +
        (profileEdit
          ? '<div class="kvp-ct-warn">' + t('dataWarn') + '</div>' +
            fields.map(f =>
              '<label class="kvp-ct-f"><span>' + f.lbl + (f.hint ? ' <i>' + f.hint + '</i>' : '') + '</span>' +
              '<input data-ct="' + f.k + '" type="' + (f.k === 'email' ? 'email' : f.k === 'phone' ? 'tel' : 'text') + '" value="' + esc(f.v || '') + '"' +
              (f.k === 'phone' ? ' placeholder="+48 600 000 000"' : f.k === 'paczkomat' ? ' placeholder="KAT01M"' : '') + '></label>' +
              (f.k === 'phone' && tgPhoneReady() ? '<button class="kvp-ct-tgphone" type="button">✈ ' + t('tgPhone') + '</button>' : '') +
              (f.k === 'paczkomat' && geoReady() ? '<button class="kvp-ct-map" type="button">' + t('pickMap') + '</button>' : '')
            ).join('') +
            '<button class="kvp-ct-apply">' + t('apply') + '</button>'
          : fields.map(f =>
              '<div class="kvp-ct-row"><span>' + f.lbl + '</span><b>' + (esc(f.v || '') || '—') + '</b></div>').join('') +
            '<button class="kvp-ct-edit">' + t('edit') + '</button>') +
        '</div>';
    }

    const favBlock = '<div class="kvp-sec"><b>' + t('myFavs') + ' · ' + favList.length + '</b>' +
      (favList.length
        ? '<div class="kvp-favs">' + favList.map(it =>
            '<button class="kvp-fav" data-goto="' + it.id + '">' +
              '<img src="' + ROOT + 'data/photos/' + it.id + '.jpg" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
              '<span>' + it.name + '</span><em>' + price(it) + '</em></button>').join('') + '</div>'
        : '<p class="kvp-empty">' + t('noFavs') + '</p>') + '</div>';

    // мои отзывы: полное название вкуса, звёзды и текст
    const revBlock = '<div class="kvp-sec"><b>' + t('myReviews') + ' · ' + myRevs.length + '</b>' +
      (myRevs.length
        ? myRevs.map(x => '<div class="kvp-rev"><span class="kvp-rev-h">' +
            esc(x.product_name || x.product_id) + ' <em>' + '★'.repeat(x.stars || 5) + '</em></span>' + esc(x.body || '') + '</div>').join('')
        : '<p class="kvp-empty">' + t('noReviews') + '</p>') + '</div>';

    // брони: активные можно отменить, позиция вернётся в наличие
    const resList = (cloudProf.res || []).filter(x => x.status !== 'cancelled');
    const resBlock = logged && resList.length
      ? '<div class="kvp-sec"><b>' + t('myRes') + ' · ' + resList.length + '</b>' +
        resList.map(x => '<div class="kvp-ord"><div class="kvp-ord-h"><span>' +
          esc(x.product_name || x.product_id) + '</span><b>' + (x.reserve_date || '') + '</b></div>' +
          '<p>' + stLabel(x.status) +
          (x.status === 'active' || x.status === 'notified'
            ? ' · <button class="kvp-res-cancel" data-res-cancel="' + x.id + '">' + t('resCancel') + '</button>' : '') +
          '</p></div>').join('') + '</div>'
      : '';

    // заказы: из облака со статусами, для гостя локальная история
    const cOrders = cloudProf.orders;
    let ordInner, ordCount;
    if (cOrders) {
      ordCount = cOrders.length;
      ordInner = cOrders.length
        ? cOrders.slice(0, 6).map(o => '<div class="kvp-ord"><div class="kvp-ord-h"><span>' +
            fmtDate(new Date(o.created_at).getTime()) + ' · <i class="kvp-st kvp-st-' + o.status + '">' + stLabel(o.status) + '</i></span><b>' + o.sum + ' zł</b></div>' +
            '<p>' + esc((o.items || []).map(i => typeof i === 'string' ? i : i.name + (i.flavor ? ' ' + i.flavor : '') + ' ×' + i.n).join(', ')) + '</p></div>').join('')
        : '<p class="kvp-empty">' + t('noOrders') + '</p>';
    } else {
      const orders = orderLog();
      ordCount = orders.length;
      ordInner = orders.length
        ? orders.slice(0, 6).map(o => '<div class="kvp-ord"><div class="kvp-ord-h"><span>' +
            fmtDate(o.ts) + '</span><b>' + o.total + ' zł</b></div><p>' + esc((o.items || []).join(', ')) + '</p></div>').join('') +
          (hasLastOrder() ? '<button class="kvp-repeat">' + ui('repeat') + '</button>' : '')
        : '<p class="kvp-empty">' + t('noOrders') + '</p>';
    }
    const ordBlock = '<div class="kvp-sec"><b>' + t('myOrders') + ' · ' + ordCount + '</b>' + ordInner + '</div>';

    d.querySelector('.kvp-body').innerHTML =
      '<div id="kvp-auth"></div>' +
      '<div class="kvp-stats">' +
        '<div><b>' + ordCount + '</b><span>' + t('ordersN') + '</span></div>' +
        '<div><b>' + favList.length + '</b><span>' + t('favsN') + '</span></div>' +
        '<div><b>' + myRevs.length + '</b><span>' + t('reviewsN') + '</span></div>' +
      '</div>' +
      contactBlock + favBlock + resBlock + revBlock + ordBlock;
    // блок входа/аккаунта рисует модуль auth.js, если он подключён
    if (window.KVAuth && window.KVAuth.decorateProfile)
      window.KVAuth.decorateProfile(d.querySelector('#kvp-auth'));
  }
  // auth.js зовёт это после входа/выхода, чтобы обновить имя и панель
  function setProfileName(name, persist) {
    profileName = name || '';
    if (persist) localStorage.setItem('kv_profile', JSON.stringify({ name: profileName }));
  }
  function refreshProfile() {
    const d = document.getElementById('kvp');
    if (d && !d.hidden) renderProfile();
    if (hooks.render) hooks.render();
    // после входа/выхода обновляем, какие вкусы можно оценить, и облачную часть профиля
    loadMyReviewState();
    if (d && !d.hidden) loadCloudProfile();
  }
  let profileEdit = false;   // режим правки данных получателя
  function onProfileClick(e) {
    const d = e.currentTarget;
    if (e.target === d || e.target.closest('.kvp-x')) { closeProfile(); return; }
    if (e.target.closest('.kvp-name-save')) {
      const inp = d.querySelector('.kvp-name-i');
      saveProfileName(inp.value.trim());
      toast(t('save'));
      renderProfile();
      return;
    }
    if (e.target.closest('.kvp-ct-edit')) { profileEdit = true; renderProfile(); return; }
    if (e.target.closest('.kvp-ct-tgphone')) { requestPhone(); return; }
    if (e.target.closest('.kvp-ct-map')) { openGeo(); return; }
    if (e.target.closest('.kvp-ct-apply')) { applyProfileContact(d); return; }
    const rc = e.target.closest('[data-res-cancel]');
    if (rc) { cancelReservation(+rc.dataset.resCancel); return; }
    const goto = e.target.closest('[data-goto]');
    if (goto) { closeProfile(); openProduct(goto.dataset.goto); return; }
    if (e.target.closest('.kvp-repeat')) { closeProfile(); repeatOrder(); return; }
  }
  async function applyProfileContact(d) {
    const f = {};
    d.querySelectorAll('[data-ct]').forEach(i => { f[i.dataset.ct] = i.value; });
    // пустые поля можно оставить на потом, заполненные проверяем строго
    if (f.name && !validFio(f.name)) { toast(t('errFio')); return; }
    if (f.phone && !validPhone(f.phone)) { toast(t('errPhone2')); return; }
    if (f.email && !validEmail(f.email)) { toast(t('errEmail2')); return; }
    if (f.paczkomat && !validPaczko(f.paczkomat)) { toast(t('errPaczko2')); return; }
    if (f.phone) f.phone = normPhonePl(f.phone);
    if (f.paczkomat) f.paczkomat = normPaczko(f.paczkomat);
    try {
      if (window.KVAuth && KVAuth.saveContact) await KVAuth.saveContact(f);
    } catch (e) { toast((e && e.message) || t('orderFail')); return; }
    profileEdit = false;
    toast(t('savedOk'));
    renderProfile();
  }
  async function cancelReservation(id) {
    if (!(window.KVAuth && KVAuth.apiCancelReservation)) return;
    const ok = await KVAuth.apiCancelReservation(id);
    if (!ok) { toast(t('resFail')); return; }
    toast(t('resCancelled'));
    loadCloudProfile();
    try { applyStock(await cloudStock()); if (hooks.render) hooks.render(); } catch (e) {}
  }

  // ==== способ получения: самовывоз / InPost / курьер ====
  function deliveryMethods() {
    return (content.delivery && content.delivery.methods) || DELIVERY_DEF;
  }
  function currentDelivery() {
    if (!delivery) { try { delivery = JSON.parse(localStorage.getItem('kv_delivery') || 'null'); } catch (e) {} }
    if (!delivery || !delivery.method) delivery = { method: 'pickup', addr: '' };
    if (!deliveryMethods().some(m => m.id === delivery.method)) delivery.method = 'pickup';
    return delivery;
  }
  function setDelivery(method, addr) {
    const cur = currentDelivery();
    if (method !== undefined) cur.method = method;
    if (addr !== undefined) cur.addr = addr;
    localStorage.setItem('kv_delivery', JSON.stringify(cur));
  }
  function deliveryFee() {
    const m = deliveryMethods().find(x => x.id === currentDelivery().method);
    return (m && m.fee) || 0;
  }
  function deliveryLabel(id) {
    const m = deliveryMethods().find(x => x.id === id);
    if (m && m.label) return loc(m.label);
    return t(id === 'inpost' ? 'delInpost' : id === 'courier' ? 'delCourier' : 'delPickup');
  }
  function deliveryLine() {
    const cur = currentDelivery();
    if (cur.method === 'pickup') return pickup();
    const fee = deliveryFee();
    return deliveryLabel(cur.method) + (cur.addr ? ': ' + cur.addr : '') + (fee ? ' (+' + fee + ' zł)' : '');
  }
  function deliveryHTML() {
    const cur = currentDelivery();
    const opts = deliveryMethods().map(m => {
      const fee = m.fee || 0;
      return '<button class="kvd-dopt' + (m.id === cur.method ? ' on' : '') + '" data-deliv="' + m.id + '" type="button">' +
        '<span>' + deliveryLabel(m.id) + '</span><i>' + (fee ? '+' + fee + ' zł' : t('delFree')) + '</i></button>';
    }).join('');
    let field = '';
    if (cur.method === 'inpost')
      field = '<input class="kvd-daddr" type="text" placeholder="' + t('inpostPh') + '" value="' + esc(cur.addr || '') + '">';
    else if (cur.method === 'courier')
      field = '<input class="kvd-daddr" type="text" placeholder="' + t('courierPh') + '" value="' + esc(cur.addr || '') + '">';
    else {
      const pc = content.pickup && content.pickup.cities && content.pickup.cities[city];
      field = pc ? '<div class="kvd-dnote">' + esc(pc.addr) + '</div>' : '';
    }
    return '<div class="kvd-deliv"><b>' + t('delivery') + '</b><div class="kvd-dopts">' + opts + '</div>' + field + '</div>';
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
.kvf-ic{margin-right:2px}
body.kv-noscroll{overflow:hidden}
.kvm{position:fixed;inset:0;z-index:150;background:rgba(6,6,10,.72);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:640px){.kvm{align-items:center;padding:24px}}
.kvm[hidden]{display:none}
.kvm-box{position:relative;width:min(560px,100%);max-height:92vh;overflow-y:auto;background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:20px 20px 0 0;padding:20px 18px 26px;box-shadow:var(--kv-shadow)}
@media(min-width:640px){.kvm-box{border-radius:20px}}
.kvm-x{position:absolute;top:12px;right:12px;z-index:2;width:34px;height:34px;border:none;background:var(--kv-surface);color:var(--kv-muted);border-radius:50%;font-size:22px;line-height:1;cursor:pointer}
.kvm-fav{position:absolute;top:12px;right:54px;z-index:2;width:34px;height:34px;border:1px solid var(--kv-line);background:var(--kv-surface);color:var(--kv-muted);border-radius:50%;font-size:16px;cursor:pointer}
.kvm-fav.on{color:#ff5c7a;border-color:#ff5c7a}
.kvm-head{display:flex;gap:14px;align-items:flex-start;padding-right:78px}
.kvm-head .kv-photo{width:76px;height:76px;flex:0 0 76px;border-radius:14px;overflow:hidden}
.kvm-head .kv-photo span{font-size:26px}
.kvm-hmain{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.kvm-cat{font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:var(--kv-muted);font-weight:800}
.kvm-name{font-size:18px;line-height:1.2}
.kvm-hrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.kvm-price{font-weight:900;font-size:16px;color:var(--kv-text)}
.kvm-pick{margin-top:16px}
.kvm-pick-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--kv-muted);font-weight:800}
.kvm-pick-card{display:flex;align-items:center;gap:10px;margin-top:6px;background:var(--kv-surface);border:1px solid var(--kv-accent);border-radius:12px;padding:11px 13px}
.kvm-pick-card.off{border-color:var(--kv-line);opacity:.65}
.kvm-pick-bar{width:5px;height:22px;border-radius:99px;background:var(--kv-line);flex-shrink:0}
.kvm-pick-name{flex:1;font-weight:800;font-size:14.5px}
.kvm-pick-q{font-size:11.5px;color:var(--kv-muted);font-weight:700}
.kvm-taste{margin-top:16px;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:12px;padding:13px 15px}
.kvm-taste>b,.kvm-desc>b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--kv-muted);margin-bottom:10px}
.kvm-bar{display:flex;align-items:center;gap:10px;margin:7px 0}
.kvm-bar>span{font-size:12.5px;width:78px;flex-shrink:0;color:var(--kv-text)}
.kvm-bar-track{flex:1;height:8px;border-radius:99px;background:var(--kv-line);overflow:hidden}
.kvm-bar-track i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--kv-accent),var(--kv-accent-2,var(--kv-accent)))}
.kvm-bar>b{font-size:11.5px;color:var(--kv-muted);width:26px;text-align:right;font-weight:700}
.kvm-desc{margin-top:14px}
.kvm-desc p{font-size:13.5px;line-height:1.6;color:var(--kv-text)}
.kvm-spec{margin-top:12px;font-size:12.5px;color:var(--kv-muted);line-height:1.5}
.kvm-sec-t{margin-top:18px;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--kv-muted);font-weight:800}
.kvm-fpick{position:relative}
.kvm-fsel{display:flex;align-items:center;gap:11px;width:100%;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:12px;padding:12px 14px;cursor:pointer;font-family:inherit;color:var(--kv-text)}
.kvm-fsel:hover{border-color:var(--kv-line)}
.kvm-fpick.open .kvm-fsel{border-color:var(--kv-accent)}
.kvm-fsel-bar{width:5px;height:20px;border-radius:99px;background:var(--kv-line);flex-shrink:0}
.kvm-fsel-n{flex:1;text-align:left;font-weight:800;font-size:14px}
.kvm-fsel-ch{color:var(--kv-muted);font-size:11px;transition:transform .2s}
.kvm-fpick.open .kvm-fsel-ch{transform:rotate(180deg)}
.kvm-flavs{display:none;margin-top:8px;max-height:270px;overflow-y:auto;flex-direction:column;gap:6px;
  background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:14px;padding:8px;overscroll-behavior:contain}
.kvm-fpick.open .kvm-flavs{display:flex}
.kvm-flav{position:relative;overflow:hidden;display:flex;align-items:center;gap:11px;width:100%;text-align:left;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:11px;padding:10px 12px;cursor:pointer;font-family:inherit;color:var(--kv-text)}
/* цвет вкуса мягко растекается от обоих краёв, поэтому строка читается как «вкусовая» */
.kvm-flav::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.17;
  background:linear-gradient(90deg,var(--fl,transparent),transparent 34%,transparent 66%,var(--fl2,transparent))}
.kvm-flav > *{position:relative}
.kvm-flav:hover::before{opacity:.26}
.kvm-flav.sel{border-color:var(--kv-accent);box-shadow:inset 0 0 0 1px var(--kv-accent)}
.kvm-flav.sel::before{opacity:.3}
.kvm-flav.off{opacity:.45;cursor:default}
.kvm-flav.off::before{opacity:.06}
.kvm-flav.off .kvm-flav-bar{filter:grayscale(1)}
.kvm-flav-bar{width:5px;height:22px;border-radius:99px;flex-shrink:0;box-shadow:0 0 10px -2px var(--fl,transparent)}
.kvm-flav-n{flex:1;font-weight:700;font-size:13.5px}
.kvm-flav-q{font-size:10.5px;color:var(--kv-muted);font-weight:700;background:var(--kv-field);border-radius:99px;padding:4px 10px;white-space:nowrap;flex-shrink:0}
.kvm-actions{display:flex;flex-direction:column;gap:9px;margin-top:16px}
.kvm-add-cta{width:100%;background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:12px;padding:14px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}
.kvm-add-cta[disabled]{opacity:.5;cursor:default}
.kvm-res{width:100%;background:none;border:1px solid var(--kv-line);color:var(--kv-text);border-radius:12px;padding:11px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
.kvm-restock{margin-top:0}
.kvm-reviews{margin-top:4px}
.kvm-revform{margin-top:14px;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:12px;padding:13px 14px;display:flex;flex-direction:column;gap:9px}
.kvm-revform>b{font-size:13px}
.kvm-rrate{display:flex;align-items:center;gap:10px;justify-content:space-between}
.kvm-rrate>span{font-size:12px;color:var(--kv-muted)}
.kvm-rstars{display:flex;gap:3px}
.kvm-rstar{background:none;border:none;font-size:22px;line-height:1;color:var(--kv-line);cursor:pointer;padding:0}
.kvm-rstar.on{color:#ffb020}
.kvm-rev-name,.kvm-rev-text{background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:9px;padding:9px 11px;font-family:inherit;font-size:13px;width:100%;resize:vertical}
.kvm-rev-send{align-self:flex-start;background:var(--kv-surface2);border:1px solid var(--kv-accent);color:var(--kv-accent-2,var(--kv-accent));border-radius:9px;padding:9px 16px;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit}
.kvm-mine{color:var(--kv-accent-2,var(--kv-accent));font-weight:700}
.kvm-grid{display:grid;gap:16px;margin-top:16px;grid-template-columns:1fr}
@media(min-width:620px){.kvm-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.05fr)}}
.kvm-col{min-width:0;display:flex;flex-direction:column;gap:14px}
.kvm-col .kvm-taste,.kvm-col .kvm-desc,.kvm-col .kvm-reviews,.kvm-col .kvm-sec-t,.kvm-buy .kvm-pick{margin-top:0}
.kvm-photo-big{position:relative;align-self:start;width:100%;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#fff}
.kvm-photo-big .kv-photo{position:absolute;inset:0;width:100%;height:100%;display:grid;place-items:center;background:#fff}
.kvm-photo-big .kv-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.kvm-photo-big .kv-photo span{font-size:44px;color:#c9d2d2}
.kvm-flavstrip{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior-x:contain}
.kvm-flavstrip::-webkit-scrollbar{display:none}
.kvm-chip{flex:0 0 auto;min-width:98px;max-width:150px;text-align:left;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:12px;padding:9px 11px;cursor:pointer;font-family:inherit;color:var(--kv-text);display:flex;flex-direction:column;gap:2px}
.kvm-chip.sel{border-color:var(--kv-accent);box-shadow:inset 0 0 0 1px var(--kv-accent)}
.kvm-chip.off{opacity:.5;cursor:default}
.kvm-chip-ic{font-size:16px}
.kvm-chip-n{font-weight:700;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kvm-chip-q{font-size:10.5px;color:var(--kv-muted);font-weight:700}
.kvm-buy{display:flex;flex-direction:column;gap:9px}
.kvm-tiers{display:flex;gap:7px;flex-wrap:wrap}
.kvm-tier{flex:1;min-width:66px;text-align:center;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:10px;padding:7px 4px;font-size:11px;color:var(--kv-muted);font-weight:700}
.kvm-tier b{display:block;font-size:15px;color:var(--kv-text)}
.kvm-tier em{display:block;font-style:normal;color:var(--kv-accent-2,var(--kv-accent));font-weight:800;margin-top:1px}
.kvm-bar>b i{font-style:normal;font-size:9px;opacity:.6}
.kv-prof{width:34px;height:34px;border:1px solid var(--kv-line);background:var(--kv-surface);color:var(--kv-muted);border-radius:50%;cursor:pointer;display:grid;place-items:center;padding:0}
.kv-prof:hover{color:var(--kv-accent);border-color:var(--kv-accent)}
.kv-prof svg{width:17px;height:17px}
.kvp{position:fixed;inset:0;z-index:150;background:rgba(6,6,10,.72)}
.kvp[hidden]{display:none}
.kvp-box{position:absolute;top:0;right:0;bottom:0;width:min(400px,100%);background:var(--kv-surface2);border-left:1px solid var(--kv-line);display:flex;flex-direction:column;box-shadow:var(--kv-shadow)}
.kvp-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--kv-line)}
.kvp-title{font-size:17px}
.kvp-x{border:none;background:none;color:var(--kv-muted);font-size:26px;cursor:pointer}
.kvp-body{flex:1;overflow-y:auto;padding:18px 20px 30px;display:flex;flex-direction:column;gap:16px}
.kvp-user{display:flex;align-items:center;gap:13px}
.kvp-ava{width:52px;height:52px;border-radius:50%;overflow:hidden;background:var(--kv-accent);color:var(--kv-accent-ink);display:grid;place-items:center;font-weight:900;font-size:22px;flex-shrink:0}
.kvp-ava img{width:100%;height:100%;object-fit:cover}
.kvp-uinfo b{font-size:16px;display:block}
.kvp-uinfo span{font-size:12.5px;color:var(--kv-muted)}
.kvp-name{display:flex;gap:8px}
.kvp-name-i{flex:1;background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13.5px}
.kvp-name-save{background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:10px;padding:0 16px;font-weight:800;cursor:pointer;font-family:inherit;font-size:12.5px}
.kvp-name-save[disabled]{opacity:.45;cursor:default}
.kvp-stats{display:flex;gap:8px}
.kvp-stats>div{flex:1;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:12px;padding:12px 8px;text-align:center}
.kvp-stats b{display:block;font-size:19px;font-weight:900;color:var(--kv-accent-2,var(--kv-accent))}
.kvp-stats span{font-size:10.5px;color:var(--kv-muted)}
.kvp-sec>b{font-size:13px;display:block;margin-bottom:9px}
.kvp-empty{font-size:12.5px;color:var(--kv-muted);line-height:1.5}
.kvp-favs{display:flex;flex-direction:column;gap:7px}
.kvp-fav{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:11px;padding:8px 10px;cursor:pointer;font-family:inherit;color:var(--kv-text)}
.kvp-fav img{width:38px;height:38px;object-fit:contain;background:#fff;border-radius:8px;flex-shrink:0}
.kvp-fav span{flex:1;font-weight:700;font-size:13px}
.kvp-fav em{font-style:normal;font-size:12px;color:var(--kv-accent-2,var(--kv-accent));font-weight:800}
.kvp-rev,.kvp-ord{background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:11px;padding:10px 12px;margin-bottom:7px;font-size:12.5px;line-height:1.5;color:var(--kv-text)}
.kvp-rev-h{display:block;font-weight:700;margin-bottom:2px}
.kvp-rev-h em,.kvp-ord em{color:#ffb020;font-style:normal}
.kvp-ord-h{display:flex;justify-content:space-between;font-weight:700}
.kvp-ord-h b{color:var(--kv-accent-2,var(--kv-accent))}
.kvp-ord p{color:var(--kv-muted);margin-top:3px}
.kvp-repeat{width:100%;background:var(--kv-surface);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:11px;padding:11px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;margin-top:2px}
.kvp-clear{background:none;border:1px solid var(--kv-line);color:var(--kv-muted);border-radius:11px;padding:11px;font-size:12.5px;cursor:pointer;font-family:inherit}
.kvd-deliv{border:1px solid var(--kv-line);border-radius:12px;padding:12px 13px}
.kvd-deliv>b{font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:var(--kv-muted);display:block;margin-bottom:9px}
.kvd-dopts{display:flex;flex-direction:column;gap:7px}
.kvd-dopt{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--kv-surface);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:10px;padding:10px 12px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700}
.kvd-dopt.on{border-color:var(--kv-accent);box-shadow:inset 0 0 0 1px var(--kv-accent)}
.kvd-dopt i{font-style:normal;font-size:11.5px;color:var(--kv-muted);font-weight:700}
.kvd-dopt.on i{color:var(--kv-accent-2,var(--kv-accent))}
.kvd-daddr{width:100%;margin-top:9px;background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:9px;padding:10px 12px;font-family:inherit;font-size:13px}
.kvd-dnote{margin-top:9px;font-size:12px;color:var(--kv-muted);line-height:1.4}
.kvd-fee{color:var(--kv-muted)}
.kv-rev-fl{font-style:normal;font-size:11px;font-weight:700;color:var(--kv-accent-2,var(--kv-accent));background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:99px;padding:1px 7px;margin-left:4px}
.kvm-norevs,.kvm-revnote{font-size:12.5px;color:var(--kv-muted);line-height:1.5;padding:8px 0}
.kvm-revnote{border:1px dashed var(--kv-line);border-radius:10px;padding:10px 12px;margin-top:12px}
.kvm-resbox{border:1px solid var(--kv-line);border-radius:12px;padding:13px 14px;background:var(--kv-surface)}
.kvm-resbox>b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--kv-muted);margin-bottom:9px}
.kvm-rdays{display:flex;gap:6px;flex-wrap:wrap}
.kvm-rday{background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:9px;padding:7px 11px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.kvm-rday.sel{border-color:var(--kv-accent);color:var(--kv-accent-2,var(--kv-accent));box-shadow:inset 0 0 0 1px var(--kv-accent)}
.kvm-rnote{font-size:11.5px;color:var(--kv-muted);line-height:1.5;margin:9px 0}
.kvm-rheld{font-size:11.5px;font-weight:700;color:var(--kv-accent-2,var(--kv-accent));margin:9px 0 0}
.kvm-res-go{width:100%;background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:10px;padding:11px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}
.kvc{position:fixed;inset:0;z-index:170;background:rgba(6,6,10,.74);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:640px){.kvc{align-items:center;padding:24px}}
.kvc[hidden]{display:none}
.kvc-box{position:relative;width:min(420px,100%);max-height:92vh;overflow-y:auto;background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:20px 20px 0 0;padding:22px 20px 26px;box-shadow:var(--kv-shadow)}
@media(min-width:640px){.kvc-box{border-radius:20px}}
.kvc-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border:none;background:var(--kv-surface);color:var(--kv-muted);border-radius:50%;font-size:22px;cursor:pointer}
.kvc-title{font-size:17px;margin-bottom:14px;padding-right:40px}
.kvc-row,.kvc-sum{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--kv-line);font-size:13.5px}
.kvc-row span,.kvc-sum span{color:var(--kv-muted)}
.kvc-row b{text-align:right;word-break:break-word}
.kvc-sum b{color:var(--kv-accent-2,var(--kv-accent))}
.kvc-none{color:var(--kv-muted);font-style:normal}
.kvc-warn{margin-top:14px;background:rgba(255,176,32,.1);border:1px solid rgba(255,176,32,.35);color:#d29a2b;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.5}
.kvc-btns{display:flex;gap:9px;margin-top:14px}
.kvc-edit{flex:1;background:none;border:1px solid var(--kv-line);color:var(--kv-text);border-radius:11px;padding:12px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
.kvc-go{flex:2;background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:11px;padding:12px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}
.kvc-go[disabled]{opacity:.6;cursor:default}
.kvc-f{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;font-size:12px;font-weight:700;color:var(--kv-muted)}
.kvc-f input{background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:10px;padding:11px 13px;font-family:inherit;font-size:13.5px}
.kvc-f input:focus{outline:none;border-color:var(--kv-accent)}
.kvc-apply{width:100%;margin-top:6px;background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:11px;padding:12px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}
.kvc-map,.kvp-ct-map,.kvc-tgphone,.kvp-ct-tgphone{background:none;border:1px dashed var(--kv-line);color:var(--kv-accent-2,var(--kv-accent));border-radius:9px;padding:8px 12px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;margin-bottom:10px}
.kvc-tgphone,.kvp-ct-tgphone{border-color:#2aabee;color:#2aabee}
.kvp-ct-warn{background:rgba(255,176,32,.1);border:1px solid rgba(255,176,32,.35);color:#d29a2b;border-radius:10px;padding:9px 11px;font-size:11.5px;line-height:1.5;margin-bottom:10px}
.kvp-ct-f{display:flex;flex-direction:column;gap:4px;margin-bottom:9px;font-size:11.5px;font-weight:700;color:var(--kv-muted)}
.kvp-ct-f i{font-style:normal;font-weight:400;opacity:.8}
.kvp-ct-f input{background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:9px;padding:10px 12px;font-family:inherit;font-size:13px}
.kvp-ct-f input:focus{outline:none;border-color:var(--kv-accent)}
.kvp-ct-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--kv-line);font-size:12.5px}
.kvp-ct-row span{color:var(--kv-muted)}
.kvp-ct-row b{text-align:right;word-break:break-word}
.kvp-ct-edit,.kvp-ct-apply{width:100%;margin-top:9px;border-radius:10px;padding:10px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit}
.kvp-ct-edit{background:none;border:1px solid var(--kv-line);color:var(--kv-text)}
.kvp-ct-apply{background:var(--kv-accent);border:none;color:var(--kv-accent-ink);font-weight:800}
.kvp-st{font-style:normal;font-weight:700}
.kvp-st-new{color:#d29a2b}.kvp-st-confirmed{color:var(--kv-accent-2,var(--kv-accent))}
.kvp-st-done{color:#3dbb6e}.kvp-st-cancelled{color:var(--kv-muted)}
.kvp-res-cancel{background:none;border:none;color:#ff6a86;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;padding:0}
.kvg{position:fixed;inset:0;z-index:180;background:rgba(6,6,10,.8);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:640px){.kvg{align-items:center;padding:20px}}
.kvg[hidden]{display:none}
.kvg-box{display:flex;flex-direction:column;width:min(560px,100%);height:min(86vh,640px);background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:18px 18px 0 0;overflow:hidden}
@media(min-width:640px){.kvg-box{border-radius:18px}}
.kvg-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px}
.kvg-head b{font-size:16px}
.kvg-x{width:34px;height:34px;border:none;background:var(--kv-surface);color:var(--kv-muted);border-radius:50%;font-size:22px;line-height:1;cursor:pointer}
.kvg-q{margin:0 18px 12px;background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:11px;padding:11px 14px;font-family:inherit;font-size:14px}
.kvg-q:focus{outline:none;border-color:var(--kv-accent)}
.kvg-list{flex:1;overflow-y:auto;padding:0 12px 16px;display:flex;flex-direction:column;gap:6px}
.kvg-i{display:block;width:100%;text-align:left;background:var(--kv-surface);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:11px;padding:10px 13px;cursor:pointer;font-family:inherit}
.kvg-i:hover{border-color:var(--kv-accent)}
.kvg-i b{display:block;font-size:13px;font-weight:800;color:var(--kv-accent-2,var(--kv-accent))}
.kvg-i span{display:block;font-size:13px;margin-top:1px}
.kvg-i i{display:block;font-style:normal;font-size:11.5px;color:var(--kv-muted);margin-top:2px}
.kvg-none{padding:14px 6px;font-size:12.5px;color:var(--kv-muted);text-align:center;line-height:1.5}`;
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
    // переход к похожему товару: открыть его окно
    const goto = e.target.closest('[data-goto]');
    if (goto) openProduct(goto.dataset.goto);
    // аккордеон FAQ
    const faq = e.target.closest('.kv-q button');
    if (faq) {
      const a = faq.parentNode.querySelector('.kv-a');
      a.hidden = !a.hidden; faq.querySelector('span').textContent = a.hidden ? '+' : '-';
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
    isApp = !!opts.app;
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
    // имя из профиля, иначе имя из Telegram
    let savedProf = null;
    try { savedProf = JSON.parse(localStorage.getItem('kv_profile') || 'null'); } catch (e) {}
    profileName = (savedProf && savedProf.name) || (tgUser() && tgUser().first_name) || '';
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
    loadReviews();   // настоящие отзывы из облака, без блокировки отрисовки
    const cs = document.getElementById('city');
    if (cs) citySwitch(cs);
    const ts = document.getElementById('theme');
    if (ts) themeSwitch(ts);
    const ls = document.getElementById('lang');
    if (ls) langSwitch(ls);
    const pf = document.getElementById('profile');
    if (pf) profileBtn(pf);
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
    openProduct, openProfile, isFav, toggleFav, tasteOf, flavorDesc,
    setProfileName, refreshProfile, forgetUserState,
    get db() { return db; }, get lang() { return lang; }, get city() { return city; },
    manager: MANAGER
  };
})();
