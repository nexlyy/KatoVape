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
      bulkContact: 'Связаться с менеджером', cardPlus: 'Картой +10%: {sum} zł',
      bulkNote: 'Больше 10 единиц оформляем через менеджера.',
      noChannel: 'Канал этого города скоро появится',
      payOff: 'Оплата картой временно недоступна. Свяжитесь с менеджером.',
      commentLabel: 'Комментарий к заказу', commentPh: 'Пожелания к заказу, необязательно',
      pickCity: 'Выберите город', pickCityNote: 'Из этого магазина будет ваш заказ. Город можно сменить в любой момент.',
      favTitle: 'Избранное', favEmpty: 'Пока пусто. Нажмите сердце на карточке товара.',
      favRemove: 'Убрать', qtyPick: 'Количество',
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
      bulkContact: 'Звʼязатися з менеджером', cardPlus: 'Карткою +10%: {sum} zł',
      bulkNote: 'Понад 10 одиниць оформлюємо через менеджера.',
      noChannel: 'Канал цього міста скоро зʼявиться',
      payOff: 'Оплата карткою тимчасово недоступна. Звʼяжіться з менеджером.',
      commentLabel: 'Коментар до замовлення', commentPh: 'Побажання до замовлення, необовʼязково',
      pickCity: 'Оберіть місто', pickCityNote: 'З цього магазину буде ваше замовлення. Місто можна змінити будь-коли.',
      favTitle: 'Обране', favEmpty: 'Поки порожньо. Натисніть сердечко на картці товару.',
      favRemove: 'Прибрати', qtyPick: 'Кількість',
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
      bulkContact: 'Skontaktuj się z menedżerem', cardPlus: 'Kartą +10%: {sum} zł',
      bulkNote: 'Powyżej 10 sztuk zamówienie prowadzi menedżer.',
      noChannel: 'Kanał tego miasta pojawi się wkrótce',
      payOff: 'Płatność kartą jest chwilowo niedostępna. Prosimy o kontakt z menedżerem.',
      commentLabel: 'Komentarz do zamówienia', commentPh: 'Uwagi do zamówienia, opcjonalnie',
      pickCity: 'Wybierz miasto', pickCityNote: 'Z tego sklepu będzie Twoje zamówienie. Miasto można zmienić w każdej chwili.',
      favTitle: 'Ulubione', favEmpty: 'Na razie pusto. Kliknij serce na karcie produktu.',
      favRemove: 'Usuń', qtyPick: 'Ilość',
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
      pickupCall: 'Точку выдачи подскажет менеджер: он свяжется с вами в Telegram сразу после заказа.',
      pickFlavor: 'Выберите вкус', selected: 'Выбрано', chooseFirst: 'Сначала выберите вкус',
      pickQtyFirst: 'Укажите количество', pickedN: 'Набрано: {n} шт',
      tierLadder: 'Чем больше, тем дешевле', addedPart: 'добавлено, часть не поместилась в остаток',
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
      dataWarn: 'Проверьте данные внимательно: по ним оформляется отправка. Посылка уйдёт туда, куда вы указали, и за последствия неверно введённых данных магазин ответственности не несёт.',
      paczkoWarn: 'Код вида KAT01M посмотрите в приложении или на сайте InPost и впишите точно, буква в букву. Проверить его за вас мы не можем.',
      confirmTitle: 'Проверьте данные получателя', confirmOk: 'Всё верно, оформить',
      payLater: 'Оплатить при выдаче', payTitle: 'Оплата', payCardBtn: 'Оплатить картой',
      promoWhy_not_found: 'Такого промокода нет', promoWhy_inactive: 'Промокод отключён',
      promoWhy_expired: 'Срок промокода истёк', promoWhy_not_started: 'Промокод ещё не начал действовать',
      promoWhy_other_city: 'Промокод действует в другом городе', promoWhy_other_category: 'Промокод на другую категорию',
      promoWhy_min_sum: 'Сумма заказа слишком мала для этого промокода', promoWhy_limit: 'Промокод уже исчерпан',
      promoWhy_used_by_you: 'Вы уже использовали этот промокод',
      promoWhy_need_login: 'Войдите, чтобы применить промокод',
      promoWhy_already: 'Этот код уже применён', remove: 'Убрать', hitBadge: 'Хит',
      uniqueBadge: 'Уникальный', restockBadge: 'Ждём поступления',
      promoWhy_no_stack: 'Этот код не складывается с другими', reviewEdit: 'Изменить отзыв',
      payNow: 'Оплатить {n} zł', payInBrowser: 'Оплата открыта в браузере. Завершите её и вернитесь, подтвердим здесь.',
      payWay: 'Способ оплаты', payCash: 'Наличными', payCard: 'Картой', payCardNote: '+10% к сумме', payFail: 'Оплата не прошла, попробуйте ещё раз',
      payDelivCard: 'Доставка оплачивается заранее: наличных при получении нет.',
      payDelivOff: 'Оплата картой сейчас недоступна, а доставку нужно оплатить заранее. Выберите самовывоз или напишите менеджеру.',
      payAskManager: 'Написать менеджеру',
      checkData: 'Проверьте данные:', fioPh: 'Фамилия и имя',
      errFio: 'Укажите фамилию и имя', errPhone2: 'Телефон в формате +48 600 000 000',
      errEmail2: 'Проверьте адрес почты', errPaczko2: 'Номер пачкомата выглядит как KAT01M',
      savedOk: 'Сохранено', needLogin: 'Войдите, чтобы оформить заказ',
      orderDone: 'Заказ оформлен! Менеджер получил уведомление и свяжется с вами.',
      orderFail: 'Не получилось отправить заказ, попробуйте ещё раз',
      stockChanged: 'Остатки изменились, корзину обновили',
      resTitle: 'Дата и время брони', resNote: 'Бронь держим до конца выбранного дня. Утром в день выдачи напомним в Telegram.',
      resOk: 'Забронировать', resDone: 'Бронь принята', resFail: 'Не получилось оформить бронь',
      resTimeLabel: 'Время самовывоза',
      resLimitCount: 'Больше трёх броней сразу держать нельзя. Выкупите или отмените одну.',
      resLimitQty: 'Одновременно можно держать до 10 единиц товара.',
      resNoshow: 'Три брони подряд остались невыкупленными, бронь временно закрыта. Напишите менеджеру.',
      resHeld: 'У вас в брони: {n} из 10',
      today: 'Сегодня', tomorrow: 'Завтра',
      myRes: 'Мои брони', resCancel: 'Отменить', resCancelled: 'Бронь отменена, позиция вернулась в наличие',
      revNeedBuy: 'Отзыв можно оставить на купленный вкус после выдачи заказа',
      noRevsYet: 'Отзывов пока нет. Ваш будет первым после покупки.',
      stNew: 'оформлен', stConfirmed: 'в обработке', stDone: 'выдан', stCancelled: 'отменён',
      stPacked: 'собран', stShipped: 'отправлен',
      stActive: 'активна', stExpired: 'истекла', stNotified: 'ждёт выдачи',
    },
    uk: {
      profile: 'Профіль', guest: 'Гість', yourName: 'Ваше ім’я', save: 'Зберегти',
      myOrders: 'Мої замовлення', myReviews: 'Мої відгуки', myFavs: 'Обране',
      noFavs: 'Поки порожньо. Тисни на сердечко в картці товару.',
      noReviews: 'Ви ще не залишали відгуків.', noOrders: 'Замовлень поки немає.',
      clearData: 'Очистити мої дані', cleared: 'Дані очищено',
      ordersN: 'замовлень', reviewsN: 'відгуків', favsN: 'в обраному',
      pickupCall: 'Точку видачі підкаже менеджер: він звʼяжеться з вами в Telegram одразу після замовлення.',
      pickFlavor: 'Оберіть смак', selected: 'Обрано', chooseFirst: 'Спочатку оберіть смак',
      pickQtyFirst: 'Вкажіть кількість', pickedN: 'Набрано: {n} шт',
      tierLadder: 'Що більше, то дешевше', addedPart: 'додано, частина не вмістилася в залишок',
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
      dataWarn: 'Перевірте дані уважно: за ними оформлюється відправка. Посилка піде туди, куди ви вказали, і за наслідки неправильно введених даних магазин відповідальності не несе.',
      paczkoWarn: 'Код виду KAT01M подивіться в застосунку або на сайті InPost і впишіть точно, літера в літеру. Перевірити його за вас ми не можемо.',
      confirmTitle: 'Перевірте дані отримувача', confirmOk: 'Все вірно, оформити',
      payLater: 'Оплата при отриманні', payTitle: 'Оплата', payCardBtn: 'Оплатити карткою',
      promoWhy_not_found: 'Такого промокоду немає', promoWhy_inactive: 'Промокод вимкнено',
      promoWhy_expired: 'Термін промокоду минув', promoWhy_not_started: 'Промокод ще не почав діяти',
      promoWhy_other_city: 'Промокод діє в іншому місті', promoWhy_other_category: 'Промокод на іншу категорію',
      promoWhy_min_sum: 'Сума замовлення замала для цього промокоду', promoWhy_limit: 'Промокод вичерпано',
      promoWhy_used_by_you: 'Ви вже використали цей промокод',
      promoWhy_need_login: 'Увійдіть, щоб застосувати промокод',
      promoWhy_already: 'Цей код уже застосовано', remove: 'Прибрати', hitBadge: 'Хіт',
      uniqueBadge: 'Унікальний', restockBadge: 'Чекаємо надходження',
      promoWhy_no_stack: 'Цей код не складається з іншими', reviewEdit: 'Змінити відгук',
      payNow: 'Сплатити {n} zł', payInBrowser: 'Оплата відкрита в браузері. Завершіть її та поверніться, підтвердимо тут.',
      payWay: 'Спосіб оплати', payCash: 'Готівкою', payCard: 'Карткою', payCardNote: '+10% до суми', payFail: 'Оплата не пройшла, спробуйте ще раз',
      payDelivCard: 'Доставка оплачується заздалегідь: готівки при отриманні немає.',
      payDelivOff: 'Оплата карткою зараз недоступна, а доставку треба оплатити заздалегідь. Оберіть самовивіз або напишіть менеджеру.',
      payAskManager: 'Написати менеджеру',
      checkData: 'Перевірте дані:', fioPh: 'Прізвище та ім’я',
      errFio: 'Вкажіть прізвище та ім’я', errPhone2: 'Телефон у форматі +48 600 000 000',
      errEmail2: 'Перевірте адресу пошти', errPaczko2: 'Номер поштомата виглядає як KAT01M',
      savedOk: 'Збережено', needLogin: 'Увійдіть, щоб оформити замовлення',
      orderDone: 'Замовлення оформлено! Менеджер отримав сповіщення і зв’яжеться з вами.',
      orderFail: 'Не вдалося надіслати замовлення, спробуйте ще раз',
      stockChanged: 'Залишки змінилися, кошик оновлено',
      resTitle: 'Дата і час броні', resNote: 'Бронь тримаємо до кінця обраного дня. Вранці в день видачі нагадаємо в Telegram.',
      resOk: 'Забронювати', resDone: 'Бронь прийнято', resFail: 'Не вдалося оформити бронь',
      resTimeLabel: 'Час самовивозу',
      resLimitCount: 'Більше трьох броней одразу тримати не можна. Викупіть або скасуйте одну.',
      resLimitQty: 'Одночасно можна тримати до 10 одиниць товару.',
      resNoshow: 'Три броні поспіль лишились невикупленими, бронь тимчасово закрита. Напишіть менеджеру.',
      resHeld: 'У вас у броні: {n} з 10',
      today: 'Сьогодні', tomorrow: 'Завтра',
      myRes: 'Мої броні', resCancel: 'Скасувати', resCancelled: 'Бронь скасовано, позиція повернулась у наявність',
      revNeedBuy: 'Відгук можна залишити на куплений смак після видачі замовлення',
      noRevsYet: 'Відгуків поки немає. Ваш буде першим після покупки.',
      stNew: 'оформлено', stConfirmed: 'в обробці', stDone: 'видано', stCancelled: 'скасовано',
      stPacked: 'зібрано', stShipped: 'відправлено',
      stActive: 'активна', stExpired: 'минула', stNotified: 'чекає видачі',
    },
    pl: {
      profile: 'Profil', guest: 'Gość', yourName: 'Twoje imię', save: 'Zapisz',
      myOrders: 'Moje zamówienia', myReviews: 'Moje opinie', myFavs: 'Ulubione',
      noFavs: 'Na razie pusto. Kliknij serduszko w karcie produktu.',
      noReviews: 'Nie dodałeś jeszcze opinii.', noOrders: 'Brak zamówień.',
      clearData: 'Wyczyść moje dane', cleared: 'Dane wyczyszczone',
      ordersN: 'zamówień', reviewsN: 'opinii', favsN: 'w ulubionych',
      pickupCall: 'Punkt odbioru wskaże menedżer: skontaktuje się z Tobą na Telegramie zaraz po zamówieniu.',
      pickFlavor: 'Wybierz smak', selected: 'Wybrano', chooseFirst: 'Najpierw wybierz smak',
      pickQtyFirst: 'Podaj ilość', pickedN: 'Wybrano: {n} szt',
      tierLadder: 'Im więcej, tym taniej', addedPart: 'dodano, część nie zmieściła się w stanie',
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
      dataWarn: 'Sprawdź dane uważnie: na ich podstawie wysyłamy paczkę. Przesyłka pojedzie tam, gdzie wskazałeś, a za skutki błędnie podanych danych sklep nie odpowiada.',
      paczkoWarn: 'Kod w rodzaju KAT01M sprawdź w aplikacji lub na stronie InPost i wpisz dokładnie, litera w literę. Nie możemy zweryfikować go za Ciebie.',
      confirmTitle: 'Sprawdź dane odbiorcy', confirmOk: 'Zgadza się, zamawiam',
      payLater: 'Płatność przy odbiorze', payTitle: 'Płatność', payCardBtn: 'Zapłać kartą',
      promoWhy_not_found: 'Nie ma takiego kodu', promoWhy_inactive: 'Kod jest wyłączony',
      promoWhy_expired: 'Kod wygasł', promoWhy_not_started: 'Kod jeszcze nie działa',
      promoWhy_other_city: 'Kod działa w innym mieście', promoWhy_other_category: 'Kod na inną kategorię',
      promoWhy_min_sum: 'Zbyt mała kwota zamówienia dla tego kodu', promoWhy_limit: 'Kod został wyczerpany',
      promoWhy_used_by_you: 'Ten kod już został przez Ciebie użyty',
      promoWhy_need_login: 'Zaloguj się, aby użyć kodu',
      promoWhy_already: 'Ten kod jest już zastosowany', remove: 'Usuń', hitBadge: 'Hit',
      uniqueBadge: 'Unikat', restockBadge: 'Czekamy na dostawę',
      promoWhy_no_stack: 'Tego kodu nie można łączyć z innymi', reviewEdit: 'Zmień opinię',
      payNow: 'Zapłać {n} zł', payInBrowser: 'Płatność otwarta w przeglądarce. Dokończ ją i wróć, potwierdzimy tutaj.',
      payWay: 'Sposób płatności', payCash: 'Gotówką', payCard: 'Kartą', payCardNote: '+10% do sumy', payFail: 'Płatność nie przeszła, spróbuj ponownie',
      payDelivCard: 'Dostawę opłaca się z góry: gotówki przy odbiorze nie ma.',
      payDelivOff: 'Płatność kartą jest teraz niedostępna, a dostawę trzeba opłacić z góry. Wybierz odbiór osobisty albo napisz do menedżera.',
      payAskManager: 'Napisz do menedżera',
      checkData: 'Sprawdź dane:', fioPh: 'Imię i nazwisko',
      errFio: 'Podaj imię i nazwisko', errPhone2: 'Telefon w formacie +48 600 000 000',
      errEmail2: 'Sprawdź adres e-mail', errPaczko2: 'Numer paczkomatu wygląda jak KAT01M',
      savedOk: 'Zapisano', needLogin: 'Zaloguj się, aby złożyć zamówienie',
      orderDone: 'Zamówienie złożone! Manager dostał powiadomienie i odezwie się.',
      orderFail: 'Nie udało się wysłać zamówienia, spróbuj ponownie',
      stockChanged: 'Stany się zmieniły, koszyk zaktualizowany',
      resTitle: 'Data i godzina rezerwacji', resNote: 'Rezerwację trzymamy do końca wybranego dnia. Rano w dniu odbioru przypomnimy w Telegramie.',
      resOk: 'Zarezerwuj', resDone: 'Rezerwacja przyjęta', resFail: 'Nie udało się zarezerwować',
      resTimeLabel: 'Godzina odbioru',
      resLimitCount: 'Nie można trzymać więcej niż trzech rezerwacji naraz. Odbierz lub anuluj jedną.',
      resLimitQty: 'Jednocześnie można trzymać do 10 sztuk towaru.',
      resNoshow: 'Trzy rezerwacje z rzędu nie zostały odebrane, rezerwacja jest chwilowo zamknięta. Napisz do managera.',
      resHeld: 'W rezerwacji masz: {n} z 10',
      today: 'Dziś', tomorrow: 'Jutro',
      myRes: 'Moje rezerwacje', resCancel: 'Anuluj', resCancelled: 'Rezerwacja anulowana, pozycja wróciła do asortymentu',
      revNeedBuy: 'Opinię można dodać o kupionym smaku po wydaniu zamówienia',
      noRevsYet: 'Brak opinii. Twoja będzie pierwsza po zakupie.',
      stNew: 'złożone', stConfirmed: 'w realizacji', stDone: 'wydane', stCancelled: 'anulowane',
      stPacked: 'skompletowane', stShipped: 'wysłane',
      stActive: 'aktywna', stExpired: 'wygasła', stNotified: 'czeka na odbiór',
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
    // автоматически поднимаем только русский и украинский, остальные языки получают
    // язык по умолчанию (польский выбирается вручную в меню)
    for (const c of cand) {
      const p = String(c).toLowerCase().slice(0, 2);
      if (p === 'uk') return 'uk';
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
  let content = {};                  // тексты разделов, промо, самовывоз
  // Описания вкусов от владельца: data/flavors.json, ключ товара -> имя вкуса -> ru/uk/pl.
  // Лежат отдельно от каталога, поэтому один и тот же текст работает во всех городах и
  // подхватывается сам, когда вкус заводят в панели.
  let flavorDescs = {};
  // применённые промокоды, по порядку ввода: [{code, type, value, discount}]
  // Раньше держали один: второй код вытеснял первый, и сложить скидки было нельзя.
  let appliedPromos = [];
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
  // слоты времени самовывоза для брони (дефолт; реальные часы подставим из content.json позже)
  const RES_SLOTS = (window.KV_CONFIG && window.KV_CONFIG.RES_SLOTS) || ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
  // оплата картой дороже на 10% (наличными при выдаче: цена та же). Наценку так же
  // считает сервер в create-payment/create-checkout, чтобы списанная сумма совпадала.
  const CARD_SURCHARGE = 0.10;
  const cardTotal = () => Math.round(grandTotal() * (1 + CARD_SURCHARGE));
  // способ оплаты выбирается в окне заказа: наличными при выдаче или картой (+10%)
  let payWay = localStorage.getItem('kv_payway') === 'card' ? 'card' : 'cash';
  const payTotal = () => (payWay === 'card' ? cardTotal() : grandTotal());
  // Платёж начат и ждёт ответа. Пока флаг поднят, окно заказа не перерисовывается:
  // перерисовка сносит форму Stripe вместе с начатым платежом, человек видит пустое место,
  // жмёт ещё раз, и в базе остаётся второй заказ в pending.
  let payBusy = false;

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
  // Рядом с корзиной лежат названия вкусов. Ключ корзины это номер вкуса в списке товара, а
  // список живой: менеджер удаляет вкус в панели, и всё, что было ниже, съезжает на позицию
  // вверх. Без названий человек вернулся бы к отложенной корзине и нашёл в ней соседний
  // вкус вместо выбранного, с той же ценой и без единого признака подмены.
  function cartNamesKey() { return 'kv_cartfl_' + city; }
  function cartFlavorNames() {
    const out = {};
    for (const key in cart) {
      const [id, fl] = key.split('::');
      if (fl === '') continue;
      const item = find(id);
      const f = item && item.flavors && item.flavors[+fl];
      if (f) out[key] = f.name;
    }
    return out;
  }
  // Переносит количества на нынешние номера вкусов. Вкуса больше нет — строка уходит.
  function reseatCart(names) {
    if (!names) return;
    const next = {};
    let moved = false;
    for (const key in cart) {
      const [id, fl] = key.split('::');
      const want = names[key];
      if (fl === '' || want == null) { next[key] = (next[key] || 0) + cart[key]; continue; }
      const item = find(id);
      const at = item && item.flavors ? item.flavors.findIndex(f => f.name === want) : -1;
      if (at < 0) { moved = true; continue; }
      if (at !== +fl) moved = true;
      next[id + '::' + at] = (next[id + '::' + at] || 0) + cart[key];
    }
    if (!moved) return;
    cart = next;
    saveCart();
  }
  function loadCart() {
    let names = null;
    try { cart = JSON.parse(localStorage.getItem(cartStoreKey()) || '{}'); }
    catch (e) { cart = {}; }
    try { names = JSON.parse(localStorage.getItem(cartNamesKey()) || 'null'); }
    catch (e) { names = null; }
    reseatCart(names);
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
    // Главный город лежит в master, и applyStock писал облачные остатки прямо в него:
    // при возврате в город поверх изменённого каталога ложились новые данные, а вкусы,
    // добавленные из облака, накапливались дублями. Работаем с копией, master не трогаем.
    let data = c.main ? structuredClone(master) : await (await fetch(ROOT + c.file, { cache: 'no-store' })).json();
    db = data;
    db.categories.forEach(cc => cc.items.forEach(it => { it._cat = cc.id; }));
    city = c.id;
    currentCity = c;
    // Корзина принадлежит городу, а читается она с диска уже после загрузки каталога. В этом
    // промежутке в памяти лежит корзина прежнего города, и любое сохранение ушло бы под ключ
    // нового: опустошаем сразу, чтобы чужие строки не переехали.
    cart = {};
    // живые остатки и цены из облака поверх файла (файл остаётся запасным)
    try { await loadCatalog(); } catch (e) {}
  }

  // ---- ассортимент из Supabase: остатки и цены правит менеджер в админке ----
  function cloudOn() {
    const cfg = window.KV_CONFIG || {};
    return cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && cfg.BACKEND === 'supabase' ? cfg : null;
  }
  async function cloudGet(path) {
    const cfg = cloudOn(); if (!cfg) return null;
    try {
      const res = await fetch(cfg.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, {
        headers: { apikey: cfg.SUPABASE_ANON_KEY }, cache: 'no-store'
      });
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }
  function cloudStock() {
    return cloudGet('products?city=eq.' + encodeURIComponent(city) +
      '&select=id,flavor,price,qty,tiers,hit,labels');
  }
  // Настройки вкуса общие для всех городов, поэтому запрос без города. Их немного, и
  // ходят они рядом с каталогом: цвет и описание нужны в тот же момент, что и остаток.
  function cloudMeta() {
    return cloudGet('flavor_meta?select=product_id,flavor,tint,taste,descr,photo');
  }
  // Каталог целиком: остатки города и настройки вкусов одним заходом.
  async function loadCatalog() {
    const [rows, meta] = await Promise.all([cloudStock(), cloudMeta()]);
    applyStock(rows, meta);
    return rows;
  }
  // Живой каталог это база; файл в data/ задаёт структуру и остаётся запасным на случай, когда
  // облако молчит. Поэтому состав вкусов берётся из базы целиком, а не накладывается поверх
  // файла: раньше вкус, удалённый в панели, продолжал висеть на витрине «в наличии» со старым
  // остатком из файла, а заведённый в панели вкус не появлялся у товара, у которого в файле
  // вкусов нет. Пока облако не ответило (rows == null), витрина живёт файлом, как и жила.
  // Настройки вкуса (цвет, профиль, описание) приходят второй таблицей и общие для всех
  // городов: «Apple Peach» одинаков везде, отличается только остаток на полке.
  // Разделитель ключа — символ, которого не бывает в названии. Пробел не годится: вкус
  // «Cola ice» у товара «a» и вкус «ice» у товара «a Cola» дали бы одну и ту же строку.
  const SEP = String.fromCharCode(0);
  const metaKey = (id, flavor) => id + SEP + flavor;
  function metaIndex(meta) {
    const by = {};
    (meta || []).forEach(m => { by[metaKey(m.product_id, m.flavor)] = m; });
    return by;
  }
  // Пустой объект описания это не описание: без проверки витрина показала бы undefined.
  const someText = o => !!o && typeof o === 'object' && ['ru', 'uk', 'pl'].some(l => o[l]);

  function applyStock(rows, meta) {
    if (!rows || !rows.length || !db) return;
    // на какие вкусы сейчас показывает корзина: состав ниже меняется, номера вместе с ним
    const seats = cartFlavorNames();
    const byMeta = metaIndex(meta);
    const byId = {};
    rows.forEach(r => { (byId[r.id] = byId[r.id] || []).push(r); });
    db.categories.forEach(cat => cat.items.forEach(it => {
      const rs = byId[it.id];
      // товара в базе нет вовсе: продавать нечего, карточка остаётся с нулём
      if (!rs) {
        if (it.flavors) it.flavors.forEach(f => { f.qty = 0; });
        it.qty = 0;
        return;
      }
      const named = rs.filter(r => r.flavor);
      if (named.length) {
        const was = {};
        (it.flavors || []).forEach(f => { was[f.name] = f; });
        // Порядок вкусов в файле подобран руками, база отдаёт свой: знакомые идут первыми и
        // в прежнем порядке, заведённые в панели дописываются в конец.
        const order = Object.keys(was);
        const seat = r => { const i = order.indexOf(r.flavor); return i < 0 ? order.length : i; };
        it.flavors = named.slice().sort((a, b) => seat(a) - seat(b)).map(r => {
          const f = Object.assign({}, was[r.flavor], { name: r.flavor, qty: r.qty });
          const m = byMeta[metaKey(it.id, r.flavor)];
          if (m) {
            // Пусто в базе значит «как раньше»: цвет по названию, профиль по названию,
            // описание из data/flavors.json или собранное по профилю. Поэтому пустое поле
            // не затирает то, что уже лежит во вкусе из файла каталога.
            if (m.tint) f.tint = m.tint;
            if (m.taste) f.taste = m.taste;
            if (someText(m.descr)) f.desc = m.descr;
            if (m.photo) f.photo = m.photo;
          }
          return f;
        });
      } else if (it.flavors) {
        // вкусы кончились, осталась строка без вкуса: карточка становится простой
        delete it.flavors;
        it.qty = Number(rs[0].qty) || 0;
      } else {
        const r = rs.find(x => !x.flavor) || rs[0];
        if (r && typeof r.qty === 'number') it.qty = r.qty;
      }
      const pr = rs.find(x => x.price != null);
      if (pr) it.price = Number(pr.price);
      // оптовые ступени из облака (правятся в админке) поверх файла
      const trw = rs.find(x => x.tiers && x.tiers.length);
      if (trw) it.tiers = trw.tiers;
      it.hit = rs.some(x => x.hit);
      // метки товара: hit оставлен ради старых данных, набор меток главнее
      it.labels = [...new Set([].concat(...rs.map(x => x.labels || [])))];
    }));
    reseatCart(seats);
  }

  // вкусы показываем на английском (решение заказчика): кириллические слова переводим
  // пословно, английские/марочные (Sour Apple, Blue Razz) не трогаем. В ЗАКАЗ и для
  // сопоставления отзывов уходит .name как есть: тут только отображение.
  const GLOS_EN = {
    'арбуз': 'watermelon', 'манго': 'mango', 'лёд': 'ice', 'лед': 'ice', 'виноград': 'grape',
    'мята': 'mint', 'клубника': 'strawberry', 'банан': 'banana', 'черника': 'blueberry',
    'кола': 'cola', 'персик': 'peach', 'ягодный': 'berry', 'ягодная': 'berry', 'ягоды': 'berries',
    'микс': 'mix', 'малина': 'raspberry', 'энергетик': 'energy', 'личи': 'lychee', 'вишня': 'cherry',
    'смородина': 'currant', 'табак': 'tobacco', 'барбарис': 'barberry', 'дыня': 'melon',
    'груша': 'pear', 'классик': 'classic', 'жвачка': 'gum', 'кислая': 'sour', 'кислое': 'sour',
    'яблоко': 'apple', 'лимон': 'lemon', 'лайм': 'lime', 'двойное': 'double', 'двойной': 'double',
    'голубика': 'blueberry', 'киви': 'kiwi', 'тропик': 'tropic', 'тропический': 'tropical',
    'юбилейный': 'jubilee', 'сахарные': 'sugar', 'сахарный': 'sugar', 'соты': 'honeycomb',
    'зимний': 'winter', 'ночной': 'night', 'ананас': 'pineapple', 'питайя': 'pitaya',
    'грейпфрут': 'grapefruit', 'ежевика': 'blackberry', 'клюква': 'cranberry', 'холодок': 'cool',
    'мороженое': 'ice cream', 'клубничный': 'strawberry', 'апельсин': 'orange', 'клюквенный': 'cranberry'
  };
  function flavorName(f) {
    const raw = typeof f === 'string' ? f : (f && f.name) || '';
    return raw.replace(/[А-Яа-яЁёІіЇїЄєҐґ]+/g, w => {
      const en = GLOS_EN[w.toLowerCase()];
      if (!en) return w;                                  // нет в словаре, оставляем как есть
      return w[0] === w[0].toUpperCase() ? en[0].toUpperCase() + en.slice(1) : en;
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

  // Порядок показа: хиты, новинки, остальное в наличии, закончившиеся в конце.
  // Хит поднимается наверх, но только пока он есть в наличии: пустой прилавок первым
  // в каталоге хуже, чем хит на второй строке.
  function sortRank(item) {
    const st = status(item);
    if (st === 'out') return 3;
    if (item.hit) return 0;
    return st === 'new' ? 1 : 2;
  }
  // Сортировка предсказуемая: при равном ранге сохраняется порядок каталога. Индекс в
  // сравнении держим явно, чтобы порядок не зависел от стабильности sort в движке.
  function sortItems(items) {
    return items
      .map((it, i) => ({ it, i }))
      .sort((a, b) => sortRank(a.it) - sortRank(b.it) || a.i - b.i)
      .map(x => x.it);
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

  // Деньги. Цены бывают с грошами (45,50), поэтому число печатается как в Польше: запятая
  // и два знака, но только когда гроши есть. Целая цена так и остаётся «40 zł», без хвоста.
  function money(n) {
    const v = Math.round(Number(n || 0) * 100) / 100;
    return (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')) + ' zł';
  }
  // Складывать деньги в двоичной дробью нельзя без округления: 0.1 + 0.2 даёт 0.30000000000000004,
  // и в корзине вылезал бы хвост. Округляем до грошей после каждого расчёта.
  const cash = n => Math.round(Number(n || 0) * 100) / 100;

  function price(item) { return item.price ? money(item.price) : ''; }

  // оптовые цены: item.tiers = [{q:1,p:50},{q:3,p:45},{q:5,p:40}].
  // Цена за штуку падает с количеством, набранным по всей модели: вкусы считаются вместе,
  // потому что опт у поставщика тоже на модель. 3 Strawberry + 2 Mango + 5 Cola это
  // десять штук одной модели и десятая цена, а не три отдельные позиции по одной штуке.
  function priceTiers(item) { return item.tiers && item.tiers.length ? item.tiers : null; }
  // Признак, по которому позиции складываются в одну оптовую группу. Сейчас это модель:
  // разные вкусы одного товара идут в одну группу, разные товары в разные. Понадобится
  // считать опт по бренду или категории: меняется только эта строка, расчёт не трогаем.
  function tierGroupOf(item) { return item.id; }
  function tierPrice(item, n) {
    const ts = priceTiers(item);
    if (!ts) return item.price || 0;
    let p = ts[0].p;
    for (const t of ts) if (n >= t.q) p = t.p;
    return p;
  }
  // сколько штук набрано в каждой оптовой группе: по этому числу и берётся ступень
  function tierQtyByGroup() {
    const acc = {};
    for (const key in cart) {
      const item = find(key.split('::')[0]); if (!item) continue;
      const g = tierGroupOf(item);
      acc[g] = (acc[g] || 0) + cart[key];
    }
    return acc;
  }
  // цена за штуку для модели с учётом того, что уже лежит в корзине (extra: сколько добавляем)
  function unitWithCart(item, extra) {
    const have = tierQtyByGroup()[tierGroupOf(item)] || 0;
    return tierPrice(item, have + (extra || 0));
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  // единый формат даты DD-MM-YYYY. Принимает и ISO-строку (2026-07-25: без сдвига по TZ),
  // и таймстамп в мс (created_at/ts заказов)
  function fmtDate(s) {
    if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.slice(0, 10).split('-');
      return d + '-' + m + '-' + y;
    }
    const dt = new Date(s), p = n => String(n).padStart(2, '0');
    return p(dt.getDate()) + '-' + p(dt.getMonth() + 1) + '-' + dt.getFullYear();
  }

  // фото кладутся в data/photos/<id>.jpg руками или скриптом.
  // пока файла нет, видна буква-заглушка, картинка сама встанет сверху когда появится
  // Адрес фото вкуса. В базе лежит только путь внутри корзины Storage: полный адрес привязан
  // к домену проекта и переехал бы вместе с ним.
  function flavorPhoto(f) {
    const cfg = cloudOn();
    const p = f && typeof f === 'object' ? f.photo : null;
    if (!cfg || !p) return null;
    return cfg.SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/public/flavors/' +
      p.split('/').map(encodeURIComponent).join('/');
  }
  // Фото товара, а при выбранном вкусе — его собственное, если менеджер такое загрузил.
  // Файл в data/photos остаётся запасным: он есть у всех позиций, снятых до появления
  // загрузки из панели.
  function photo(item, flavor) {
    const letter = item.name.replace(/[^A-Za-zА-Яа-я]/g, '')[0] || '?';
    const own = flavorPhoto(flavor);
    return '<div class="kv-photo"><span>' + letter + '</span>' +
      '<img src="' + (own || (ROOT + 'data/photos/' + item.id + '.jpg')) + '" alt="" ' +
      'loading="lazy" decoding="async" onerror="this.remove()"></div>';
  }

  // корзина хранится как "id::вкус" -> штук
  // сколько штук позиции реально есть на складе
  function availFor(key) {
    const [id, fl] = key.split('::');
    const item = find(id); if (!item) return 0;
    if (fl !== '' && item.flavors) return item.flavors[+fl] ? item.flavors[+fl].qty : 0;
    return qty(item);
  }

  // Положить сразу несколько вкусов одной модели: [{fl, n}]. Возвращает, сколько штук легло
  // и сколько не поместилось в остаток, чтобы карточка могла сказать об этом честно.
  function cartAddMany(id, picks) {
    let added = 0, short = 0;
    for (const p of picks || []) {
      const key = id + '::' + (p.fl === undefined || p.fl === '' ? '' : p.fl);
      const want = Math.max(1, Math.floor(p.n || 1));
      const have = cart[key] || 0;
      const room = Math.max(availFor(key) - have, 0);
      const take = Math.min(want, room);
      if (take > 0) { cart[key] = have + take; added += take; }
      short += want - take;
    }
    if (added) saveCart();
    return { added, short };
  }
  function cartSet(key, n) {
    if (n <= 0) delete cart[key]; else cart[key] = n;
    saveCart();
  }
  function saveCart() {
    localStorage.setItem(cartStoreKey(), JSON.stringify(cart));
    localStorage.setItem(cartNamesKey(), JSON.stringify(cartFlavorNames()));
    if (hooks.cart) hooks.cart();
    drawDrawer();
  }
  function cartCount() { return Object.values(cart).reduce((s, n) => s + n, 0); }
  function cartLines() {
    // ступень берём по сумме всей модели, поэтому количества сначала складываем,
    // и только потом считаем строки: вкус, добавленный последним, снижает цену и остальным
    const groups = tierQtyByGroup();
    const lines = [];
    for (const key in cart) {
      const [id, fl] = key.split('::');
      const item = find(id); if (!item) continue;
      const flavor = fl !== '' && item.flavors ? item.flavors[+fl] : null;
      const unit = tierPrice(item, groups[tierGroupOf(item)]);
      lines.push({ key, item, flavor, n: cart[key], unit, sum: cash(unit * cart[key]) });
    }
    return lines;
  }
  function cartTotal() { return cash(cartLines().reduce((s, l) => s + l.sum, 0)); }

  function orderText() {
    const lines = cartLines().map((l, i) =>
      (i + 1) + ') ' + l.item.name + (l.flavor ? ', ' + flavorName(l.flavor) : '') +
      ' x' + l.n + (l.item.price ? ', ' + money(l.sum) : ''));
    const disc = discount();
    const discLine = disc
      ? '\n' + ui('discount') + (appliedPromos.length ? ' ' + promoCodes().join(', ') : '') + ': −' + money(disc) : '';
    const fee = deliveryFee();
    const feeLine = fee ? '\n' + t('delivPay') + ': +' + money(fee) : '';
    return t('order') + ' KatoVape (' + cityName(currentCity) + '):\n' + lines.join('\n') +
      discLine + feeLine + '\n' + t('total') + ': ' + money(grandTotal()) + '\n' + deliveryLine();
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
  function tgSend(text, note, to) {
    copyText(text);
    toast(note);
    const url = (to || managerLink()) + '?text=' + encodeURIComponent(text);
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
  // Почта нужна рабочая: по ней уходит подтверждение заказа. Прежняя проверка
  // «что-то@что-то.что-то» пропускала мусор вида a@b.c и адреса со спецсимволами.
  // Требуем: разумное имя, домен из меток по буквам/цифрам/дефису и TLD от двух букв.
  const EMAIL_RE = /^[A-Za-z0-9]([A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
  function validEmail(s) {
    const v = (s || '').trim();
    if (v.length > 254 || v.includes('..')) return false;
    return EMAIL_RE.test(v);
  }
  function normPaczko(s) { return (s || '').trim().toUpperCase().replace(/\s+/g, ''); }
  function validPaczko(s) { return /^[A-Z]{3}\d{2,4}[A-Z]{0,2}$/.test(normPaczko(s)); }

  // ---- комментарий покупателя (бронь и заказ), с живым счётчиком символов ----
  const COMMENT_MAX = 500;
  function commentBox(kind, value) {
    const v = String(value || '').slice(0, COMMENT_MAX);
    return '<label class="kv-cmt"><span>' + t('commentLabel') +
      '<i class="kv-cmt-n" data-cmt-n="' + kind + '">' + v.length + ' / ' + COMMENT_MAX + '</i></span>' +
      '<textarea data-cmt="' + kind + '" rows="2" maxlength="' + COMMENT_MAX + '" placeholder="' +
      esc(t('commentPh')) + '">' + esc(v) + '</textarea></label>';
  }
  // общий обработчик ввода: держит значение и обновляет счётчик, не перерисовывая окно
  function onCommentInput(e) {
    const ta = e.target.closest('[data-cmt]'); if (!ta) return;
    const kind = ta.dataset.cmt;
    const val = ta.value.slice(0, COMMENT_MAX);
    if (kind === 'res' && modal) modal.resComment = val; else if (kind === 'order') orderComment = val;
    const n = document.querySelector('[data-cmt-n="' + kind + '"]');
    if (n) n.textContent = val.length + ' / ' + COMMENT_MAX;
  }
  let orderComment = '';

  // крупный опт (больше 10 единиц суммарно) обычным заказом не оформляем: такой заказ
  // ведёт менеджер города, ему уходит готовый состав корзины
  function bulkOrder() { return cartCount() > 10; }
  function checkout() {
    if (!cartCount()) return;
    if (bulkOrder()) { tgSend(orderText(), t('copied'), managerLink()); return; }
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
  let confirmErrors = [];   // что именно не так с данными получателя
  let confirmDraft = null;  // набранное в форме, чтобы не терялось при показе ошибок
  // собираем все проблемы разом: человек должен видеть весь список, а не по одной
  function contactProblems(ct, inpost) {
    const bad = [];
    if (!validFio(ct.name)) bad.push({ k: 'name', m: t('errFio') });
    if (!validPhone(ct.phone)) bad.push({ k: 'phone', m: t('errPhone2') });
    if (!validEmail(ct.email)) bad.push({ k: 'email', m: t('errEmail2') });
    if (inpost && !validPaczko(ct.paczkomat)) bad.push({ k: 'paczkomat', m: t('errPaczko2') });
    return bad;
  }
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
      const pw = e.target.closest('[data-payway]');
      if (pw) { payWay = pw.dataset.payway; localStorage.setItem('kv_payway', payWay); renderConfirm(); return; }
      if (e.target.closest('.kvc-later')) { placeOrder(); return; }   // оплата при выдаче
      if (e.target.closest('.kvc-go')) { placeOrder(); return; }
    });
    d.addEventListener('input', onCommentInput);
  }
  function contactOf() {
    return (window.KVAuth && KVAuth.contact) ? KVAuth.contact() : { name: '', phone: '', email: '', paczkomat: '' };
  }
  function openConfirm() {
    confirmErrors = []; confirmDraft = null;
    // если данных получателя нет или они неполные, сразу открываем форму с ошибками,
    // а не экран «всё верно» с пустыми полями
    const ct = contactOf();
    const inpost = currentDelivery().method === 'inpost';
    confirmEdit = contactProblems(ct, inpost).length > 0;
    ensureConfirm(); renderConfirm();
    document.getElementById('kvc').hidden = false; document.body.classList.add('kv-noscroll');
    // Перед оформлением сверяемся с базой: сначала остатки, потом промокод (его условия
    // зависят от суммы корзины). Обе проверки сервер повторит при оформлении, но узнать
    // об отказе лучше здесь, а не после ввода данных и нажатия «оплатить».
    recheckStock().then(recheckPromo);
  }
  // Остатки могли разойтись, пока корзина лежала открытой: кто-то забрал последнюю штуку.
  // Тянем свежие цифры и подрезаем корзину до того, что реально есть.
  async function recheckStock() {
    const rows = await loadCatalog().catch(() => null);
    if (!rows) return;
    let touched = false;
    for (const key in cart) {
      const av = availFor(key);
      if (av <= 0) { delete cart[key]; touched = true; }
      else if (cart[key] > av) { cart[key] = av; touched = true; }
    }
    if (!touched) return;
    saveCart();
    toast(t('stockChanged'));
    if (!cartCount()) { closeConfirm(); return; }
    const d = document.getElementById('kvc');
    if (d && !d.hidden) renderConfirm();
  }
  async function recheckPromo() {
    if (!appliedPromos.length || !(window.KVAuth && KVAuth.promoCheck && KVAuth.cloudOn && KVAuth.cloudOn())) return;
    const dropped = await recheckPromos();
    // говорим про каждый снятый код отдельно: причины у них разные
    dropped.forEach(d => toast(d.code + ': ' + t('promoWhy_' + (d.reason || 'not_found'))));
    drawDrawer();
    const d = document.getElementById('kvc');
    if (d && !d.hidden) renderConfirm();
  }
  function closeConfirm() {
    const d = document.getElementById('kvc'); if (d) d.hidden = true;
    const kvd = document.getElementById('kvd');
    if (!kvd || kvd.hidden) document.body.classList.remove('kv-noscroll');
  }
  function renderConfirm() {
    const d = document.getElementById('kvc'); if (!d) return;
    if (payBusy) return;   // платёж в работе, форму оплаты трогать нельзя
    const ct = contactOf();
    const cur = currentDelivery();
    const inpost = cur.method === 'inpost';
    const need = [
      { k: 'name', lbl: t('fio'), v: ct.name },
      { k: 'phone', lbl: t('phoneF'), v: ct.phone },
      { k: 'email', lbl: t('emailF'), v: ct.email }
    ];
    if (inpost) need.push({ k: 'paczkomat', lbl: t('paczkoF'), v: ct.paczkomat });
    // черновик держит то, что человек уже набрал, чтобы ошибка не стирала введённое
    if (confirmDraft) need.forEach(f => { if (confirmDraft[f.k] != null) f.v = confirmDraft[f.k]; });
    const errFor = k => confirmErrors.find(e => e.k === k);
    let inner;
    if (confirmEdit) {
      const errBox = confirmErrors.length
        ? '<div class="kvc-errbox"><b>' + t('checkData') + '</b><ul>' +
          confirmErrors.map(e => '<li>' + esc(e.m) + '</li>').join('') + '</ul></div>' : '';
      inner = errBox + need.map(f =>
        '<label class="kvc-f' + (errFor(f.k) ? ' bad' : '') + '"><span>' + f.lbl + '</span>' +
        '<input data-ct="' + f.k + '" type="' + (f.k === 'email' ? 'email' : f.k === 'phone' ? 'tel' : 'text') + '" value="' + esc(f.v || '') + '"' +
        (f.k === 'phone' ? ' placeholder="+48 600 000 000"' : f.k === 'paczkomat' ? ' placeholder="KAT01M"' : f.k === 'name' ? ' placeholder="' + esc(t('fioPh')) + '"' : '') + '></label>' +
        (f.k === 'phone' && tgPhoneReady() ? '<button class="kvc-tgphone" type="button">✈ ' + t('tgPhone') + '</button>' : '') +
        // Выбор пачкомата из списка убран: справочник InPost отдаёт точки по названию города,
        // и код из другого города в нём не находился, хотя он существует. Код вписывается
        // руками, а рядом сказано, где его взять и чем грозит опечатка.
        (f.k === 'paczkomat' ? '<p class="kvc-fhint">' + t('paczkoWarn') + '</p>' : '')
      ).join('') +
        '<div class="kvc-warn">' + t('dataWarn') + '</div>' +
        '<button class="kvc-apply">' + t('apply') + '</button>';
    } else {
      // если оплата подключена, показываем кнопки Apple Pay / Google Pay / карта (сайт)
      // или кнопку нативного инвойса (мини-апп); плюс запасной путь «оплата при выдаче»
      const pay = window.KVPay && KVPay.enabled();
      // наценку за карту показываем только когда оплата картой реально работает
      const cardOn = pay && !(window.KV_CONFIG || {}).PAYMENTS_CARD_OFF;
      // Наличные бывают только при самовывозе: посылку в пачкомат и курьера оплачивают
      // заранее, брать деньги на месте там некому. Раньше кнопка «наличными» предлагалась
      // и там, и заказ приходил менеджеру как неоплаченный, хотя платить было негде.
      const cashOk = cur.method === 'pickup';
      // Доставка при выключенной карте платить нечем. Оформлять такой заказ нельзя: он ушёл
      // бы менеджеру как неоплаченный, и посылку пришлось бы держать до выяснения.
      const payNone = !cashOk && !cardOn;
      // Пока карта отключена, оформление заказа должно оставаться главным действием:
      // кнопка карты идёт сверху приглушённой, под ней обычное «оформить».
      const actions = cardOn
        ? '<div id="kvc-pay" class="kvc-pay"></div>' +
          (cashOk ? '<button class="kvc-later">' + t('payLater') + '</button>' : '') +
          '<div class="kvc-btns kvc-btns-edit"><button class="kvc-edit">' + t('edit') + '</button></div>'
        : (pay ? '<div id="kvc-pay" class="kvc-pay"></div>' : '') +
          '<div class="kvc-btns"><button class="kvc-edit">' + t('edit') + '</button>' +
          (payNone ? '' : '<button class="kvc-go">' + t('confirmOk') + '</button>') + '</div>';
      // Способ оплаты выбирается тут же: наличными цена обычная, картой дороже на 10%.
      // Выбор влияет на итог, поэтому сумма пересчитывается сразу над кнопками.
      const ways = (cashOk ? [['cash', t('payCash'), grandTotal()]] : [])
        .concat([['card', t('payCard'), cardTotal()]]);
      // Если наличные недоступны, а карта выключена флагом, платить нечем. Молча оставлять
      // выбранными наличные нельзя: заказ ушёл бы неоплаченным.
      if (!cashOk && payWay !== 'card') { payWay = 'card'; localStorage.setItem('kv_payway', 'card'); }
      const payBox = payNone
        ? '<div class="kvc-paywarn">' + t('payDelivOff') +
            ' <a href="' + managerLink() + '" target="_blank" rel="noopener">' + t('payAskManager') + '</a></div>'
        : '<div class="kvc-pays"><span class="kvc-pays-t">' + t('payWay') + '</span>' +
          ways.map(([k, lbl, sum]) =>
            '<button class="kvc-pay-opt' + (payWay === k ? ' sel' : '') + '" data-payway="' + k + '" type="button">' +
            '<b>' + lbl + '</b><em>' + money(sum) + '</em>' +
            (k === 'card' ? '<i>' + t('payCardNote') + '</i>' : '') + '</button>').join('') +
          (cashOk ? '' : '<p class="kvc-paynote">' + t('payDelivCard') + '</p>') + '</div>';
      inner = need.map(f =>
        '<div class="kvc-row"><span>' + f.lbl + '</span><b>' + (esc(f.v || '') || '<i class="kvc-none">—</i>') + '</b></div>').join('') +
        '<div class="kvc-row"><span>' + t('delivery') + '</span><b>' + deliveryLabel(cur.method) + '</b></div>' +
        payBox +
        '<div class="kvc-sum"><span>' + t('total') + '</span><b>' + money(payTotal()) + '</b></div>' +
        commentBox('order', orderComment) +
        '<div class="kvc-warn">' + t('dataWarn') + '</div>' + actions;
    }
    d.querySelector('.kvc-body').innerHTML = '<h3 class="kvc-title">' + t('confirmTitle') + '</h3>' + inner;
    if (!confirmEdit) startPay();
  }
  async function applyConfirm() {
    const d = document.getElementById('kvc'); if (!d) return;
    const f = {};
    d.querySelectorAll('[data-ct]').forEach(i => { f[i.dataset.ct] = i.value; });
    confirmDraft = Object.assign({}, f);   // запоминаем набранное
    const ct = Object.assign(contactOf(), f);
    const inpost = currentDelivery().method === 'inpost';
    // все ошибки разом показываем в самом окне, а не тостом под ним
    confirmErrors = contactProblems(ct, inpost);
    if (confirmErrors.length) { renderConfirm(); return; }
    ct.phone = normPhonePl(ct.phone);
    ct.paczkomat = normPaczko(ct.paczkomat);
    try {
      if (window.KVAuth && KVAuth.saveContact) await KVAuth.saveContact(ct);
    } catch (e) { confirmErrors = [{ k: '', m: (e && e.message) || t('orderFail') }]; renderConfirm(); return; }
    confirmEdit = false; confirmDraft = null; confirmErrors = [];
    toast(t('savedOk'));
    renderConfirm();
  }
  // состав заказа + данные получателя, одинаково для оплаты онлайн и оплаты при выдаче
  function orderData() {
    const ct = contactOf();
    const cur = currentDelivery();
    const inpost = cur.method === 'inpost';
    const items = cartLines().map(l => ({
      id: l.item.id, name: l.item.name,
      flavor: l.flavor ? l.flavor.name : '', n: l.n, sum: l.sum
    }));
    return {
      city, sum: payTotal(), amount: payTotal() * 100, pay_way: payWay,
      delivery: cur.method, promo: promoCodes(),
      // у самовывоза адреса нет. Раньше сюда попадал cur.addr, оставшийся от прошлого
      // выбора курьера, и менеджер видел «pickup, Sucha 7b»: будто это доставка
      address: cur.method === 'pickup' ? '' : (inpost ? normPaczko(ct.paczkomat) : (cur.addr || '')),
      contact: { name: ct.name.trim(), phone: normPhonePl(ct.phone), email: ct.email.trim(),
        paczkomat: inpost ? normPaczko(ct.paczkomat) : '' },
      comment: (orderComment || '').slice(0, COMMENT_MAX) || null,
      items
    };
  }
  // общий финал: чистим корзину, закрываем окна, показываем «оформлено»
  function finishOrder() {
    saveLastOrder();
    logOrder();
    track('checkout', { total: grandTotal(), delivery: currentDelivery().method });
    cart = {};
    orderComment = '';
    // Расход кода записывает сервер: наличный заказ отмечает create-order, карточный
    // отмечается вебхуком по факту оплаты. Отсюда это делать нельзя, потому что отсюда можно
    // и не сделать, и тогда лимиты «всего» и «на человека» не значат ничего.
    // промокоды одноразовые: после заказа снимаем их, чтобы не тянулись в следующий
    appliedPromos = [];
    localStorage.removeItem('kv_promo');
    saveCart();
    closeConfirm();
    const kvd = document.getElementById('kvd'); if (kvd) kvd.hidden = true;
    document.body.classList.remove('kv-noscroll');
    toast(t('orderDone'));
    if (hooks.cart) hooks.cart();
    loadMyReviewState();
  }
  // оплата при выдаче: заказ пишется как раньше (status new, payment unpaid), деньги на месте
  async function placeOrder() {
    const ct = contactOf();
    const probs = contactProblems(ct, currentDelivery().method === 'inpost');
    if (probs.length) {
      // «оформить» с пустыми данными открывает форму со списком ошибок
      confirmEdit = true; confirmErrors = probs; renderConfirm();
      return;
    }
    const btn = document.querySelector('#kvc .kvc-go, #kvc .kvc-later');
    if (btn) { btn.disabled = true; btn.dataset.txt = btn.textContent; btn.textContent = '…'; }
    const ok = await KVAuth.apiOrder(orderData());
    if (btn) { btn.disabled = false; if (btn.dataset.txt) btn.textContent = btn.dataset.txt; }
    if (!ok) { toast(t('orderFail')); return; }
    finishOrder();   // промокод засчитывается там, общим путём для наличных и карты
  }
  // онлайн-оплата: монтируем кнопки Stripe (сайт) или инвойс Telegram (мини-апп) в окно
  function startPay() {
    if (!(window.KVPay && KVPay.enabled())) return;
    const box = document.getElementById('kvc-pay');
    if (!box || box.dataset.on) return;
    box.dataset.on = '1';   // один монтаж на показ окна, повтор при перерисовке не нужен
    // Оплата тут всегда карточная, а сервер всегда добавляет к ней свои 10%. Если человек
    // оставил выбранным «наличными», payTotal() ниже карточной суммы, и в кошельке была бы
    // одна цена, а в списании другая. Поэтому в оплату уходит именно карточный итог.
    const pay = Object.assign(orderData(), { pay_way: 'card', sum: cardTotal(), amount: cardTotal() * 100 });
    KVPay.mount(box, pay, {
      onStart: () => { payBusy = true; },
      onSuccess: () => { payBusy = false; finishOrder(); },
      // Пока онлайн-оплата не запущена, Stripe возвращает технические коды. Показывать их
      // покупателю бессмысленно: даём понятный текст и путь к менеджеру города.
      onError: code => {
        payBusy = false;
        // остаток разошёлся или промокод не удалось проверить: сумму пересчитает сервер,
        // человеку показываем обычную ошибку заказа, а не технический код Stripe
        if (code === 'out_of_stock' || code === 'promo') { toast(t('orderFail')); return; }
        // при отключённой карте чат менеджера открывает сам pay.js, внутри клика:
        // из таймера браузер посчитал бы это всплывающим окном и заблокировал
        toast(t('payOff'));
        if (code !== 'card_off') setTimeout(openManager, 900);
      },
      onCancel: () => { payBusy = false; }
    });
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
        flavor: fl ? fl.name : '', qty: 1, reserve_date: date, reserve_time: modal.resTime,
        comment: (modal.resComment || '').slice(0, COMMENT_MAX) || null
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
        const code = inp.value;
        applyPromo(code).then(r => {
          toast(r.ok ? ui('discount') : t('promoWhy_' + (r.reason || 'not_found')));
          if (r.ok) inp.value = '';   // поле освобождаем под следующий код
          drawDrawer();
        });
      }
      const pdel = e.target.closest('[data-promo]');
      if (pdel) { dropPromo(pdel.dataset.promo); drawDrawer(); }
      if (e.target.closest('.kvd-repeat')) repeatOrder();
      const dopt = e.target.closest('[data-deliv]');
      if (dopt) { setDelivery(dopt.dataset.deliv, undefined); drawDrawer(); }
      if (e.target.closest('.kvd-go')) checkout();
      if (e.target.closest('.kvd-clear')) { cart = {}; appliedPromos = []; savePromos(); saveCart(); }
    };
    // адрес доставки печатают в поле, полный перерисов сбил бы фокус
    d.addEventListener('input', e => {
      if (e.target.classList.contains('kvd-daddr')) setDelivery(undefined, e.target.value);
    });
  }

  function drawDrawer() {
    const d = document.getElementById('kvd'); if (!d) return;
    d.querySelector('.kvd-title').textContent = t('cart');
    d.querySelector('.kvd-go').textContent = bulkOrder() ? t('bulkContact') : t('checkout');
    d.querySelector('.kvd-clear').textContent = t('clear');
    const lines = cartLines();
    d.querySelector('.kvd-items').innerHTML = lines.length
      ? lines.map(l => '<div class="kvd-row">' +
          // цену за штуку показываем при количестве больше одного: так видно, что опт
          // посчитан по всей модели, и сумма строки перестаёт выглядеть случайной
          '<span class="kvd-name">' + esc(l.item.name) + (l.flavor ? '<small>' + esc(flavorName(l.flavor)) + '</small>' : '') +
            (l.n > 1 ? '<small>' + l.n + ' × ' + money(l.unit) + '</small>' : '') + '</span>' +
          '<span class="kvd-ctr"><button data-minus="' + l.key + '">&minus;</button><b>' + l.n + '</b><button data-plus="' + l.key + '">+</button></span>' +
          '<span class="kvd-sum">' + money(l.sum) + '</span></div>').join('')
      : '<p class="kvd-empty">' + t('cartEmpty') + '</p>';

    // подсказка, почему вместо оформления предлагается менеджер
    const goBtn = d.querySelector('.kvd-go');
    goBtn.classList.toggle('kvd-go-bulk', bulkOrder());
    goBtn.title = bulkOrder() ? t('bulkNote') : '';
    // блок промо и скидки, либо кнопка повтора заказа для пустой корзины
    const extra = d.querySelector('.kvd-extra');
    if (lines.length) {
      const disc = discount();
      const fee = deliveryFee();
      extra.innerHTML =
        deliveryHTML() +
        // поле всегда пустое: коды складываются, применённые показаны чипами под ним
        '<div class="kvd-promo"><input type="text" placeholder="' + ui('promoPh') +
          '" value=""><button class="kvd-promo-go">' + ui('promoApply') + '</button></div>' +
        (appliedPromos.length
          ? '<div class="kvd-promos">' + appliedPromos.map(p =>
              '<span class="kvd-promo-chip">' + esc(p.code) +
              '<i>−' + money(promoValue(p, cartTotal())) + '</i>' +
              '<button class="kvd-promo-del" data-promo="' + esc(p.code) + '" aria-label="' + t('remove') + '">&times;</button></span>').join('') +
            '</div>'
          : '') +
        (disc ? '<div class="kvd-disc"><span>' + ui('discount') + '</span><span>−' + money(disc) + '</span></div>' : '') +
        (fee ? '<div class="kvd-disc kvd-fee"><span>' + t('delivPay') + '</span><span>+' + money(fee) + '</span></div>' : '');
    } else {
      extra.innerHTML = hasLastOrder()
        ? '<button class="kvd-repeat">' + ui('repeat') + '</button>' : '';
    }

    const disc = discount();
    d.querySelector('.kvd-total').innerHTML = lines.length
      ? t('total') + ': ' + (disc ? '<s>' + money(cartTotal()) + '</s> ' : '') + money(grandTotal()) : '';
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
    // выбор человека едет в профиль: с другого телефона магазин откроется тем же городом
    if (window.KVAuth && KVAuth.saveCity) KVAuth.saveCity(id);
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

  // Город из анкеты в боте. Человек выбирает город при первом запуске бота, а мини-апп
  // открывался с тем городом, что остался в localStorage от прошлой сессии на этом
  // телефоне: то есть чужим. Профиль главнее, пока человек сам не переключит город
  // в шапке: тогда стоит kv_city_picked и мы не спорим с ручным выбором.
  async function adoptCity(id) {
    if (!id || id === city) return;
    if (!cities.some(c => c.id === id)) return;
    if (localStorage.getItem('kv_city_picked')) return;
    await setCity(id);
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

  // ==== ярлыки товара (10) ====
  // Реестр ярлыков: у каждого свой ключ, оформление, место в ряду и источник. Источник: 
  // единственное место, где решается, показывать ярлык или нет: «Хит» ставит менеджер в
  // панели (products.hit), «мало осталось» считается из остатка. Раньше ярлыки приходили
  // ещё и из data/meta.json: оттуда брался невидимый в панели «хит» у HQD, а после
  // включения галочки он же рисовался вторым. Теперь источник один на ярлык, поэтому
  // дубль невозможен по построению.
  // Новый ярлык («Акция», «Новинка») = одна запись в этом списке, рендер и сортировка
  // подхватят его сами.
  const BADGES = [
    { key: 'hit', cls: 'hit', rank: 0, label: () => t('hitBadge'),
      on: it => !!it.hit || (it.labels || []).includes('hit') },
    { key: 'unique', cls: 'unique', rank: 1, label: () => t('uniqueBadge'),
      on: it => (it.labels || []).includes('unique') },
    { key: 'restock', cls: 'restock', rank: 2, label: () => t('restockBadge'),
      on: it => (it.labels || []).includes('restock') },
    { key: 'few', cls: 'few', rank: 3, label: () => ui('lastFew'), on: it => { const q = qty(it); return q > 0 && q <= 3; } }
  ];
  // ярлыки товара в постоянном порядке, общий ответ для сайта, мини-аппа и карточки
  function badgesOf(item) {
    return BADGES.filter(b => b.on(item)).sort((a, b) => a.rank - b.rank);
  }
  function badgesHTML(item) {
    const out = badgesOf(item).map(b =>
      '<span class="kv-badge ' + b.cls + '">' + esc(b.label()) + '</span>');
    return out.length ? '<div class="kv-badges">' + out.join('') + '</div>' : '';
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
  // Цвет, выбранный в панели, главнее словаря: менеджер видел вкус своими глазами, а
  // словарь знает только слова. В базе хранится один цвет, второй конец градиента
  // считает shared/tints.js, общий с панелью.
  function tintColors(v) {
    return (v && window.KV_TINT && window.KV_TINT.pair(v)) || null;
  }
  // Принимает и объект вкуса, и просто название: у вкуса из файла каталога цвета нет.
  function flavorColors(f) {
    const picked = f && typeof f === 'object' ? tintColors(f.tint) : null;
    if (picked) return picked;
    const n = String((f && typeof f === 'object' ? f.name : f) || '').toLowerCase();
    for (const [re, c] of FLAVOR_HUES) if (re.test(n)) return c;
    // вкус не узнали, берём стабильный оттенок из названия, чтобы цвет не прыгал
    const h = hashId(n) % 360;
    return ['hsl(' + h + ' 78% 68%)', 'hsl(' + h + ' 66% 45%)'];
  }
  function flavorGrad(f) {
    const c = flavorColors(f);
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
        '<span>' + esc(x.name) + '</span><b>' + price(x) + '</b></button>').join('') + '</div></div>';
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
  // Промокоды живут в базе и правятся в панели. Скидку считает сервер (promo_check):
  // так нельзя подобрать чужой код или подкрутить процент из браузера.
  // content.promos остаётся запасом для демо без облака.
  function findPromo(code) {
    return (content.promos || []).find(p => p.code.toUpperCase() === String(code).trim().toUpperCase());
  }
  const promoCodes = () => appliedPromos.map(p => p.code);
  function savePromos() {
    if (appliedPromos.length) localStorage.setItem('kv_promo', JSON.stringify(promoCodes()));
    else localStorage.removeItem('kv_promo');
  }
  function dropPromo(code) {
    appliedPromos = appliedPromos.filter(p => p.code !== code);
    savePromos();
  }
  // Добавляет код к уже применённым. Регистр важен: KATOVAPE и katovape: разные коды.
  async function applyPromo(code) {
    const raw = String(code || '').trim();
    if (!raw) return { ok: false, reason: 'not_found' };
    if (appliedPromos.some(p => p.code === raw)) return { ok: false, reason: 'already' };
    if (window.KVAuth && KVAuth.promoCheck && KVAuth.cloudOn && KVAuth.cloudOn()) {
      const cats = [...new Set(cartLines().map(l => l.item._cat).filter(Boolean))];
      const res = await KVAuth.promoCheck(raw, city, cartTotal(), cats);
      if (res && res.ok) {
        // код с stackable=false работает только в одиночку: так фиксированная скидка
        // не суммируется с процентной, если магазин этого не хочет
        const stack = res.stackable !== false;
        const blocked = !stack ? appliedPromos.length > 0 : appliedPromos.some(p => p.stackable === false);
        if (blocked) return { ok: false, reason: 'no_stack' };
        appliedPromos.push({ code: raw, type: res.kind === 'percent' ? 'percent' : 'fixed', value: res.value, discount: res.discount, stackable: stack });
        savePromos();
        return { ok: true };
      }
      return { ok: false, reason: (res && res.reason) || 'not_found' };
    }
    const p = findPromo(raw);
    if (!p) return { ok: false, reason: 'not_found' };
    appliedPromos.push(p); savePromos();
    return { ok: true };
  }
  // Перепроверка всех кодов разом: условия у каждого свои (минимальная сумма, категория),
  // и после правки корзины часть могла перестать подходить. Отвалившиеся снимаем.
  async function recheckPromos() {
    if (!appliedPromos.length) return [];
    const codes = promoCodes();
    appliedPromos = [];
    const dropped = [];
    for (const code of codes) {
      const res = await applyPromo(code);
      if (!res.ok) dropped.push({ code, reason: res.reason });
    }
    savePromos();
    return dropped;
  }
  // Скидку пересчитываем от текущей корзины. Держать число, посчитанное при вводе кода,
  // нельзя: корзину после этого меняют, а процент обязан идти следом, иначе на витрине
  // одна сумма, а сервер перед оплатой считает другую. Формула та же, что в promo_check.
  // Несколько кодов складываются, и каждый считается от исходной суммы товаров, а не
  // от остатка после предыдущего: так порядок ввода не влияет на итог. Больше корзины
  // скидка не бывает: то же ограничение стоит и на сервере.
  // Процент считается до гроша, как в promo_check: десять процентов от 45,50 это 4,55,
  // а не пять. Округляли до злотого, пока цены были целыми, и с дробным прайсом витрина
  // обещала бы одну скидку, а сервер перед оплатой ставил другую.
  function promoValue(p, sub) {
    const v = Number(p.value);
    return p.type === 'percent' && Number.isFinite(v)
      ? cash(sub * v / 100)
      : (p.discount != null ? p.discount : v || 0);
  }
  function discount() {
    const sub = cartTotal();
    const d = appliedPromos.reduce((s, p) => s + promoValue(p, sub), 0);
    return cash(Math.min(Math.max(d, 0), sub));
  }
  function grandTotal() { return cash(Math.max(cartTotal() - discount(), 0) + deliveryFee()); }

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
  // Заявка «сообщить о поступлении»: пишем её в базу вместе с городом, и бот сам напишет
  // человеку, как только позиция появится в наличии именно в этом городе.
  // Гостю писать некуда, отправляем его в бота диплинком, там заявка оформится сама.
  async function notifyRestock(id) {
    const item = find(id); if (!item) return;
    const logged = window.KVAuth && KVAuth.loggedIn && KVAuth.loggedIn();
    if (logged && KVAuth.apiRestock) {
      const ok = await KVAuth.apiRestock({ city, product_id: item.id, product_name: item.name });
      toast(t(ok ? 'notifyOk' : 'notifyFail'));
      return;
    }
    const bot = (window.KV_CONFIG || {}).TELEGRAM_BOT;
    if (bot) {
      // res_<id>_<город> без даты бот понимает как заявку на поступление
      openTg('https://t.me/' + bot + '?start=res_' + encodeURIComponent(item.id) + '_' + city);
      toast(t('notifyOk'));
      return;
    }
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
      // Адрес и карту здесь не показываем: точек выдачи в городе несколько, и куда подъехать,
      // менеджер говорит сам после заказа. Одна улица на весь город отправляла бы людей не туда.
      (pc ? '<section class="kv-sec kv-pickup"><h3>' + loc(p.title) + ' · ' + cityName(currentCity) + '</h3>' +
        '<p class="kv-pick-addr">' + esc(t('pickupCall')) + '</p>' +
        '<p class="kv-pick-h">' + loc(p.hoursLabel) + ': ' + loc(pc.hours) + '</p></section>' : '') +
      (a ? '<section class="kv-sec kv-about"><h3>' + loc(a.title) + '</h3><p>' + loc(a.text) + '</p></section>' : '') +
      (f ? '<section class="kv-sec kv-faq"><h3>' + loc(f.title) + '</h3>' +
        f.items.map((q, i) => '<div class="kv-q" data-faq="' + i + '"><button>' + loc(q.q) + '<span>+</span></button>' +
          '<div class="kv-a" hidden>' + loc(q.a) + '</div></div>').join('') + '</section>' : '');
  }

  // ==== 18+ гейт с записью согласия + PL-предупреждение (21) ====
  // Первый запуск: подтверждение 18+, следом выбор города. Оба шага показываются один раз,
  // ответы лежат в localStorage (kv_age, kv_city_picked). Сменить город потом можно в шапке.
  function firstRun(afterAll) {
    const done = () => { if (afterAll) afterAll(); };
    const askCity = () => {
      if (localStorage.getItem('kv_city_picked') || cities.length < 2) { done(); return; }
      const g = document.createElement('div');
      g.className = 'kv-gate kv-gate-city';
      g.innerHTML = '<div class="kv-gate-box"><b class="kv-gate-t">' + t('pickCity') + '</b>' +
        '<p class="kv-gate-warn">' + t('pickCityNote') + '</p>' +
        '<div class="kv-gate-cities">' + cities.map(c =>
          '<button data-pick="' + c.id + '">' + cityName(c) + '</button>').join('') + '</div></div>';
      document.body.appendChild(g);
      g.onclick = async e => {
        const b = e.target.closest('[data-pick]'); if (!b) return;
        localStorage.setItem('kv_city_picked', '1');
        g.remove();
        // setCity сам перерисует каталог, шапку и всё, что зависит от города
        if (b.dataset.pick !== city) await setCity(b.dataset.pick);
        done();
      };
    };
    if (localStorage.getItem('kv_age')) { askCity(); return; }
    const g = document.createElement('div');
    g.className = 'kv-gate';
    g.innerHTML = '<div class="kv-gate-box"><div class="kv-gate-18">18+</div>' +
      '<p class="kv-gate-warn">' + loc(content.legal && content.legal.warn) + '</p>' +
      '<div class="kv-gate-row"><button class="kv-gate-yes">' + t('gateYes') + '</button>' +
      '<button class="kv-gate-no">' + t('gateNo') + '</button></div></div>';
    document.body.appendChild(g);
    g.querySelector('.kv-gate-yes').onclick = () => {
      localStorage.setItem('kv_age', JSON.stringify({ ok: true, ts: Date.now(), v: 1 }));
      g.remove();
      askCity();
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
    // Ведём в канал выбранного города: попап обещает поступления и акции, а они городские.
    // content.subscribe.url остаётся запасом, если у города канала ещё нет.
    const url = cityLink('channel') || s.url;
    const el = document.createElement('div');
    el.className = 'kv-sub';
    el.innerHTML = '<div class="kv-sub-box"><b>' + loc(s.title) + '</b><p>' + loc(s.text) + '</p>' +
      '<a class="kv-sub-go" href="' + esc(url) + '" target="_blank" rel="noopener">' + loc(s.btn) + '</a>' +
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
  // Имя вкуса из каталога и из справочника может отличаться регистром и пробелами
  // («Cola ice» против «Cola Ice»), поэтому сверяем по упрощённому виду.
  const descKey = s => String(s || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  function ownerDesc(item, flavor) {
    const book = flavorDescs[item && item.id];
    if (!book || !flavor || !flavor.name) return null;
    const want = descKey(flavor.name);
    for (const k in book) if (descKey(k) === want) {
      const v = book[k];
      return (v && (v[lang] || v.ru)) || null;
    }
    return null;
  }

  function flavorDesc(item, flavor) {
    const ov = flavor && flavor.desc;
    if (ov) return typeof ov === 'string' ? ov : (ov[lang] || ov.ru);
    // Текст владельца важнее собранного по вкусовому профилю: он про конкретный вкус.
    const own = ownerDesc(item, flavor);
    if (own) return own;
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
  // Список id хранится в localStorage, как и корзина, поэтому переживает перезагрузку и
  // не требует входа. Отдельная страница со списком открывается сердцем в шапке.
  function favs() { try { return JSON.parse(localStorage.getItem('kv_favs') || '[]'); } catch (e) { return []; } }
  function isFav(id) { return favs().includes(id); }
  function saveFavs(f) {
    localStorage.setItem('kv_favs', JSON.stringify(f));
    if (hooks.render) hooks.render();
    const d = document.getElementById('kvfav');
    if (d && !d.hidden) renderFavs();
  }
  function toggleFav(id) {
    let f = favs();
    const on = !f.includes(id);
    f = on ? f.concat(id) : f.filter(x => x !== id);
    saveFavs(f);
    return on;
  }
  function removeFav(id) { saveFavs(favs().filter(x => x !== id)); }

  function ensureFavs() {
    if (document.getElementById('kvfav')) return;
    const d = document.createElement('div');
    d.id = 'kvfav'; d.className = 'kvfav'; d.hidden = true;
    d.innerHTML = '<div class="kvfav-box"><div class="kvfav-head"><b class="kvfav-title"></b>' +
      '<button class="kvfav-x" aria-label="close">&times;</button></div><div class="kvfav-body"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('.kvfav-x')) { closeFavs(); return; }
      const rm = e.target.closest('[data-favrm]');
      if (rm) { e.stopPropagation(); removeFav(rm.dataset.favrm); return; }
      const go = e.target.closest('[data-favgo]');
      if (go) { closeFavs(); openProduct(go.dataset.favgo); return; }
    });
  }
  function renderFavs() {
    const d = document.getElementById('kvfav'); if (!d) return;
    d.querySelector('.kvfav-title').textContent = t('favTitle');
    // товар мог пропасть из каталога (сменили город): такие строки просто не показываем
    const list = favs().map(id => find(id)).filter(Boolean);
    d.querySelector('.kvfav-body').innerHTML = list.length
      ? list.map(it => {
          const st = status(it);
          return '<div class="kvfav-row"><button class="kvfav-i" data-favgo="' + esc(it.id) + '" type="button">' +
            '<img src="' + ROOT + 'data/photos/' + it.id + '.jpg" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
            '<span class="kvfav-n">' + esc(it.name) + '<i>' + (st === 'out' ? t('qtyNone') : price(it)) + '</i></span></button>' +
            '<button class="kvfav-rm" data-favrm="' + esc(it.id) + '" type="button" aria-label="' + t('favRemove') + '">&times;</button></div>';
        }).join('')
      : '<p class="kvfav-empty">' + t('favEmpty') + '</p>';
  }
  function openFavs() {
    ensureFavs(); renderFavs();
    document.getElementById('kvfav').hidden = false;
    document.body.classList.add('kv-noscroll');
  }
  function closeFavs() {
    const d = document.getElementById('kvfav'); if (d) d.hidden = true;
    if (!openLayers()) document.body.classList.remove('kv-noscroll');
  }
  // не снимаем блокировку скролла, если под нами осталось открытое окно
  function openLayers() {
    return ['kvm', 'kvd', 'kvp', 'kvc'].some(id => {
      const el = document.getElementById(id);
      return el && !el.hidden;
    });
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
  // Вкусы этой модели, которые человек реально получал в заказе. Форма отзыва работает
  // по этому списку, а не по вкусу, открытому в карточке: покупатель брал Mint, листал
  // Watermelon: и магазин отказывал в отзыве на то, что у него на руках.
  function reviewableFlavors(id) {
    if (!reviewables) return [];
    return [...new Set(reviewables.filter(r => r.product_id === id).map(r => r.flavor || ''))];
  }
  // какой вкус оценивается сейчас: выбранный в карточке, если он куплен, иначе первый купленный
  function reviewFlavor(id, viewing) {
    const list = reviewableFlavors(id);
    if (!list.length) return null;
    if (modal && modal.revFl != null && list.includes(modal.revFl)) return modal.revFl;
    if (list.includes(viewing || '')) return viewing || '';
    return list[0];
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
      onCommentInput(e);
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
    // counts: сколько штук набрано по каждому вкусу до отправки в корзину. Раньше вкус был
    // один за раз, и за тремя вкусами приходилось трижды открывать карточку.
    // Список вкусов сразу раскрыт: в нём теперь стоят счётчики, и прятать их незачем.
    modal = { id, fl, counts: {}, flOpen: hasFl, rate: 0, name: profileName || '', text: '' };
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
        '<h3 class="kvm-name">' + esc(item.name) + '</h3>' +
        badgesHTML(item) +
        '<div class="kvm-hrow"><span class="kvm-price">' + (price(item) || '') + '</span>' + (r ? starsRow(r) : '') + '</div>' +
      '</div>' +
      '<button class="kvm-fav' + (isFav(item.id) ? ' on' : '') + '" data-fav="' + item.id + '" aria-label="fav">' +
        (isFav(item.id) ? '♥' : '♡') + '</button>' +
      '</div>';

    // фото товара, а у выбранного вкуса своё, если его загрузили в панели
    const bigPhoto = '<div class="kvm-photo-big">' + photo(item, fl) + '</div>';

    // Набор вкусов. У каждой строки свой счётчик, поэтому три разных вкуса набираются за один
    // заход, а не тремя открытиями карточки подряд. Клик по самой строке по-прежнему делает
    // вкус «просматриваемым»: от него зависят профиль, описание и форма отзыва ниже.
    const countOf = i => Math.max(0, Math.floor(modal.counts[i] || 0));
    const inCart = i => cart[item.id + '::' + i] || 0;
    const picked = hasFl ? item.flavors.reduce((s, f, i) => s + countOf(i), 0) : countOf('');
    const flavStrip = hasFl ?
      '<div class="kvm-fpick' + (modal.flOpen ? ' open' : '') + '">' +
        '<button class="kvm-fsel" type="button" data-fl-toggle="1">' +
          '<span class="kvm-fsel-bar"' + (fl ? ' style="background:' + flavorGrad(fl) + '"' : '') + '></span>' +
          '<span class="kvm-fsel-n">' + esc(picked ? t('pickedN', picked) : t('pickFlavor')) + '</span>' +
          '<span class="kvm-fsel-ch" aria-hidden="true">▼</span>' +
        '</button>' +
        '<div class="kvm-flavs">' + item.flavors.map((f, i) => {
          const room = Math.max((f.qty || 0) - inCart(i), 0);
          const have = room > 0;
          const n = countOf(i);
          const c = flavorColors(f);
          return '<div class="kvm-flav' + (i === modal.fl ? ' sel' : '') + (have ? '' : ' off') +
            (n ? ' has' : '') + '" data-fl-sel="' + i + '" style="--fl:' + c[0] + ';--fl2:' + c[1] + '">' +
            '<span class="kvm-flav-bar" style="background:' + flavorGrad(f) + '"></span>' +
            '<span class="kvm-flav-n">' + esc(flavorName(f)) + '</span>' +
            '<span class="kvm-flav-q">' + (have ? room + ' ' + t('pcs') : t('qtyNone')) + '</span>' +
            (have
              ? '<span class="kvm-cnt">' +
                  '<button class="kvm-cnt-b" type="button" data-fl-minus="' + i + '"' +
                    (n ? '' : ' disabled') + ' aria-label="-">−</button>' +
                  '<b class="kvm-cnt-n">' + n + '</b>' +
                  '<button class="kvm-cnt-b" type="button" data-fl-plus="' + i + '"' +
                    (n >= room ? ' disabled' : '') + ' aria-label="+">+</button>' +
                '</span>'
              : '') +
          '</div>';
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
    // характеристика собирается из полей товара, а их правит менеджер в панели: без
    // экранирования разметка из названия или крепости попала бы в страницу покупателя
    const specLine = spec ? '<div class="kvm-spec">' + esc(spec) + '</div>' : '';

    // выбранный вкус отдельной карточкой
    const preview = hasFl ?
      '<div class="kvm-pick"><span class="kvm-pick-lbl">' + t('selected') + '</span>' +
        '<div class="kvm-pick-card' + (fl && fl.qty > 0 ? '' : ' off') + '">' +
          '<span class="kvm-pick-bar"' + (fl ? ' style="background:' + flavorGrad(fl) + '"' : '') + '></span>' +
          '<span class="kvm-pick-name">' + esc(fl ? flavorName(fl) : t('pickFlavor')) + '</span>' +
          (fl ? '<span class="kvm-pick-q">' + (fl.qty > 0 ? t('left', fl.qty) : t('qtyNone')) + '</span>' : '') +
        '</div></div>' : '';

    // Товар без вкусов набирается тем же счётчиком, только строка одна.
    const plainRoom = hasFl ? 0 : Math.max(qty(item) - (cart[item.id + '::'] || 0), 0);
    const plainCnt = hasFl ? 0 : countOf('');
    const plainBox = (!hasFl && plainRoom > 0)
      ? '<div class="kvm-plain"><span class="kvm-plain-l">' + t('qtyPick') + '</span>' +
          '<span class="kvm-cnt">' +
            '<button class="kvm-cnt-b" type="button" data-fl-minus=""' + (plainCnt ? '' : ' disabled') + ' aria-label="-">−</button>' +
            '<b class="kvm-cnt-n">' + plainCnt + '</b>' +
            '<button class="kvm-cnt-b" type="button" data-fl-plus=""' + (plainCnt >= plainRoom ? ' disabled' : '') + ' aria-label="+">+</button>' +
          '</span>' +
          '<span class="kvm-plain-q">' + t('left', plainRoom) + '</span></div>'
      : '';

    // Оптовая лесенка. Раньше это был выбор количества, теперь количество набирают
    // счётчиками, а лесенка осталась подсказкой: она показывает, почём выйдет штука на
    // каждой ступени и подсвечивает ту, до которой человек уже добрал.
    const tiers = priceTiers(item);
    const steps = tiers ? [...new Set(tiers.map(x => +x.q))].filter(q => q > 1).sort((a, b) => a - b) : [];
    // Ступень считается по всей модели: уже лежащее в корзине плюс набранное здесь.
    const inCartModel = Object.keys(cart)
      .filter(k => k.split('::')[0] === item.id)
      .reduce((s, k) => s + cart[k], 0);
    const totalQty = inCartModel + picked;
    const reached = steps.filter(q => totalQty >= q).pop() || 0;
    const unit = unitWithCart(item, Math.max(picked, 1)) || item.price || 0;
    const tiersHTML = steps.length
      ? '<div class="kvm-tiers"><span class="kvm-tiers-t">' + t('tierLadder') + '</span>' +
        steps.map(q => {
          const p = tierPrice(item, q) || item.price || 0;
          return '<span class="kvm-tier' + (q === reached ? ' sel' : '') + '">' +
            '<b>' + q + '</b> ' + t('pcs') + '<em>' + money(p) + '</em></span>';
        }).join('') + '</div>'
      : '';

    const addSum = picked * unit;
    const addBtn = picked > 0
      ? '<button class="kvm-add-cta" data-add-all="' + item.id + '">' + t('add') +
          ' · ' + picked + ' ' + t('pcs') + (addSum ? ' · ' + money(addSum) : '') + '</button>'
      : (st === 'out'
          ? '<button class="kv-restock kvm-restock" data-notify="' + item.id + '">' + ui('notify') + '</button>'
          : '<button class="kvm-add-cta" disabled>' + t(hasFl ? 'chooseFirst' : 'pickQtyFirst') + '</button>');
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
      if (!modal.resTime) modal.resTime = RES_SLOTS[0];
      const heldNote = resLoad
        ? '<p class="kvm-rheld">' + t('resHeld').replace('{n}', resLoad.held_qty || 0) + '</p>' : '';
      resPanel = '<div class="kvm-resbox"><b>' + t('resTitle') + '</b>' +
        '<div class="kvm-rdays">' + days.map(x =>
          '<button class="kvm-rday' + (x.iso === modal.resDate ? ' sel' : '') + '" data-res-date="' + x.iso + '" type="button">' + x.label + '</button>').join('') + '</div>' +
        '<p class="kvm-rnote kvm-rtlabel">' + t('resTimeLabel') + '</p>' +
        '<div class="kvm-rdays">' + RES_SLOTS.map(s =>
          '<button class="kvm-rday' + (s === modal.resTime ? ' sel' : '') + '" data-res-time="' + s + '" type="button">' + s + '</button>').join('') + '</div>' +
        heldNote +
        commentBox('res', modal.resComment || '') +
        '<p class="kvm-rnote">' + t('resNote') + '</p>' +
        '<button class="kvm-res-go" data-res-go="1" type="button">' + t('resOk') + '</button></div>';
    }
    const buy = '<div class="kvm-buy">' + preview + plainBox + tiersHTML + addBtn + resBtn + resPanel + '</div>';

    // отзывы: показываем настоящие, форма только на купленный вкус
    const flavorKey = fl ? fl.name : '';
    const reviews = reviewsFor(item.id);
    const revList = reviews.length ? reviews.map(rv =>
      '<div class="kv-rev"><span class="kv-rev-h">' + esc(rv.author || t('you')) +
      (rv.flavor ? ' <i class="kv-rev-fl">' + esc(flavorName(rv.flavor)) + '</i>' : '') +
      ' <em>' + '★'.repeat(rv.stars || 5) + '</em></span>' + esc(rv.body || '') + '</div>').join('')
      : '<p class="kvm-norevs">' + t('noRevsYet') + '</p>';
    const starPick = [1, 2, 3, 4, 5].map(i =>
      '<button class="kvm-rstar' + (i <= (modal.rate || 0) ? ' on' : '') + '" data-star="' + i + '" type="button">★</button>').join('');
    // Оценивать можно любой полученный вкус этой модели, независимо от того, какой
    // сейчас открыт в карточке. Когда куплено несколько: даём выбрать в самой форме.
    const revFlavors = reviewableFlavors(item.id);
    const revFl = reviewFlavor(item.id, flavorKey);
    const flTitle = n => n ? esc(flavorName({ name: n })) : esc(item.name);
    const revPick = revFlavors.length > 1
      ? '<div class="kvm-revpick">' + revFlavors.map(n =>
          '<button class="kvm-revpick-b' + (n === revFl ? ' sel' : '') + '" data-rev-fl="' + esc(n) + '" type="button">' +
          flTitle(n) + '</button>').join('') + '</div>'
      : '';
    const mine = myRevs.find(r => r.product_id === item.id && (r.flavor || '') === (revFl || ''));
    const revForm = revFl !== null
      ? '<div class="kvm-revform"><b>' + t(mine ? 'reviewEdit' : 'reviewAdd') +
          (revFl ? ' · ' + flTitle(revFl) : '') + '</b>' + revPick +
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
    const revPick = e.target.closest('[data-rev-fl]');
    if (revPick) { modal.revFl = revPick.dataset.revFl; modal.rate = 0; modal.text = ''; renderModal(); return; }
    // Счётчики вкусов. Плюс не пускает за остаток с учётом того, что уже лежит в корзине.
    const plus = e.target.closest('[data-fl-plus]');
    if (plus) {
      e.stopPropagation();
      const k = plus.dataset.flPlus;
      const it = find(modal.id);
      const room = k === ''
        ? Math.max(qty(it) - (cart[it.id + '::'] || 0), 0)
        : Math.max(((it.flavors[+k] || {}).qty || 0) - (cart[it.id + '::' + k] || 0), 0);
      const now = Math.max(0, Math.floor(modal.counts[k] || 0));
      if (now < room) modal.counts[k] = now + 1;
      if (k !== '') modal.fl = +k;
      renderModal();
      return;
    }
    const minus = e.target.closest('[data-fl-minus]');
    if (minus) {
      e.stopPropagation();
      const k = minus.dataset.flMinus;
      const now = Math.max(0, Math.floor(modal.counts[k] || 0));
      if (now <= 1) delete modal.counts[k]; else modal.counts[k] = now - 1;
      renderModal();
      return;
    }
    const sel = e.target.closest('[data-fl-sel]');
    // Клик по строке вкуса делает его просматриваемым: от него зависят профиль, описание и
    // форма отзыва. Список при этом не закрывается, иначе набирать несколько вкусов неудобно.
    if (sel) { modal.fl = +sel.dataset.flSel; modal.flPicked = true; renderModal(); return; }
    const fav = e.target.closest('[data-fav]');
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); renderModal(); if (hooks.render) hooks.render(); return; }
    const addAll = e.target.closest('[data-add-all]');
    if (addAll) {
      e.stopPropagation();
      const id = addAll.dataset.addAll;
      const picks = Object.keys(modal.counts)
        .map(k => ({ fl: k === '' ? undefined : +k, n: modal.counts[k] }))
        .filter(p => p.n > 0);
      const { added, short } = cartAddMany(id, picks);
      toast(t(added ? (short ? 'addedPart' : 'added') : 'maxQty'));
      if (added) {
        track('add_to_cart', { id, n: added });
        modal.counts = {};
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
    const rtime = e.target.closest('[data-res-time]');
    if (rtime) { modal.resTime = rtime.dataset.resTime; renderModal(); return; }
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
    if (!(window.KVAuth && KVAuth.apiReview)) return;
    // отзыв уходит на тот вкус, который выбран в самой форме, а не на открытый в карточке
    const viewing = item.flavors && modal.fl >= 0 ? item.flavors[modal.fl].name : '';
    const revFl = reviewFlavor(item.id, viewing);
    if (revFl === null) { toast(t('revNeedBuy')); return; }
    const r = await KVAuth.apiReview({
      product_id: item.id,
      flavor: revFl,
      product_name: item.name + (revFl ? ' ' + revFl : ''),
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
    // храним структуру, а не строку: по id позиция в истории открывает карточку товара
    log.unshift({ ts: Date.now(), city, n: cartCount(), total: grandTotal(),
      deliv: currentDelivery().method,
      items: cartLines().map(l => ({ id: l.item.id, name: l.item.name, flavor: l.flavor ? l.flavor.name : '', n: l.n })) });
    localStorage.setItem('kv_orders', JSON.stringify(log.slice(0, 20)));
  }
  const PROF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
  // открыть чат менеджера / канал (в мини-аппе: нативно, на сайте: новая вкладка)
  function openTg(url) {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData) tg.openTelegramLink(url); else window.open(url, '_blank');
  }
  // Ссылки берём из KV_CONFIG.CITY_LINKS по текущему городу: у каждого магазина свой чат
  // и свой канал. Всё в конфиге, поэтому смена города меняет ссылки сама.
  function cityLink(kind) {
    const cfg = window.KV_CONFIG || {};
    const byCity = (cfg.CITY_LINKS || {})[city] || {};
    return byCity[kind] || '';
  }
  function managerLink() { return cityLink('manager') || MANAGER; }
  function openManager() { openTg(managerLink()); }
  // @username менеджера города, для подписей в вёрстке, чтобы страницы не хранили его сами
  function managerName() {
    const m = String(managerLink()).match(/t\.me\/@?([A-Za-z0-9_]+)/);
    return m ? '@' + m[1] : '';
  }
  function openChannel() {
    const url = cityLink('channel');
    // для города ссылку ещё не дали, честно говорим об этом и не открываем чужой чат
    if (!url) { toast(t('noChannel')); return; }
    openTg(url);
  }
  // смена языка из бургер-меню (та же логика, что в langSwitch)
  function setLang(l) {
    if (l === lang) return;
    lang = l; localStorage.setItem('kv_lang', l);
    const cs = document.getElementById('city'); if (cs) citySwitch(cs);
    const ls = document.getElementById('lang'); if (ls) langSwitch(ls);
    const fp = document.getElementById('filters'); if (fp) filterPanel(fp);
    drawDrawer(); if (hooks.render) hooks.render(); renderInfo(); if (hooks.cart) hooks.cart();
  }
  const LANG_FULL = { ru: 'Русский', uk: 'Українська', pl: 'Polski' };
  const HX_ICON = {
    mgr: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    tg: '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><path d="M21.9 4.3 2.5 11.8c-.9.4-.9 1.2 0 1.5l4.9 1.5 1.9 5.9c.2.5.6.6 1 .3l2.7-2 4.8 3.5c.5.4 1.2.1 1.4-.5l3.4-16c.2-.9-.5-1.5-1.6-1.2z"/></svg>',
    burger: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    prof: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    fav: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.3 4.7 13a4.6 4.6 0 0 1 6.5-6.5l.8.8.8-.8A4.6 4.6 0 1 1 19.3 13z"/></svg>'
  };
  // Шапка мини-аппа: справа: менеджер, канал, бургер. Профиль/избранное/язык уезжают в
  // бургер-меню, чтобы элементы не толпились в строке и не было сдвига (корзина: свой #topCart).
  function mountHeaderExtras() {
    const prof = document.getElementById('profile');
    if (!prof || document.getElementById('kv-hx')) return;
    const langEl = document.getElementById('lang'); if (langEl) langEl.style.display = 'none';
    prof.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.id = 'kv-hx'; wrap.className = 'kv-hx';
    // порядок слева направо: избранное, менеджер, канал города, бургер: бургер крайний справа
    wrap.innerHTML =
      '<button class="kv-hx-b" id="kv-hx-fav" type="button" aria-label="' + t('favTitle') + '">' + HX_ICON.fav + '</button>' +
      '<button class="kv-hx-b" id="kv-hx-mgr" type="button" aria-label="' + t('write') + '">' + HX_ICON.mgr + '</button>' +
      '<button class="kv-hx-b" id="kv-hx-tg" type="button" aria-label="Telegram">' + HX_ICON.tg + '</button>' +
      '<div class="kv-burger-wrap">' +
        '<button class="kv-hx-b" id="kv-hx-burger" type="button" aria-label="Menu">' + HX_ICON.burger + '</button>' +
        '<div class="kv-burger" id="kv-burger" hidden></div></div>';
    // шапка заканчивается этим блоком, поэтому бургер оказывается у правого края панели
    prof.parentNode.appendChild(wrap);
    // корзину из шапки темы забираем в ту же группу, иначе она осталась бы висеть отдельно
    const topCart = document.getElementById('topCart');
    if (topCart) wrap.insertBefore(topCart, wrap.firstChild);
    document.getElementById('kv-hx-fav').onclick = openFavs;
    document.getElementById('kv-hx-mgr').onclick = openManager;
    document.getElementById('kv-hx-tg').onclick = openChannel;
    const burger = document.getElementById('kv-burger');
    document.getElementById('kv-hx-burger').onclick = e => {
      e.stopPropagation();
      if (burger.hidden) renderBurger();
      burger.hidden = !burger.hidden;
    };
    burger.onclick = e => {
      const b = e.target.closest('[data-b]');
      if (b) {
        burger.hidden = true;
        if (b.dataset.b === 'profile') openProfile(); else openFavs();
        return;
      }
      const bl = e.target.closest('[data-blang]');
      if (bl) { burger.hidden = true; setLang(bl.dataset.blang); }
    };
    document.addEventListener('click', () => { if (!burger.hidden) burger.hidden = true; });
  }
  function renderBurger() {
    const burger = document.getElementById('kv-burger'); if (!burger) return;
    burger.innerHTML =
      '<button data-b="profile">' + HX_ICON.prof + '<span>' + t('profile') + '</span></button>' +
      '<button data-b="favs">' + HX_ICON.fav + '<span>' + t('myFavs') + '</span></button>' +
      '<div class="kv-burger-sep"></div>' +
      ['ru', 'uk', 'pl'].map(l => '<button data-blang="' + l + '"' + (l === lang ? ' class="on"' : '') + '>' + LANG_FULL[l] + '</button>').join('');
  }
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

  // Личные данные в localStorage привязаны к устройству, а не к аккаунту. В мини-аппе
  // Telegram вход происходит сам по initData, без всякого «выйти», поэтому со сменой
  // аккаунта на том же телефоне следующий человек видел чужое: избранное, контакты для
  // доставки, свои же прошлые заказы. Держим владельца этих ключей и чистим их, когда
  // аккаунт сменился.
  // Настройки самого устройства (язык, тема, 18+, корзина) не трогаем: они общие.
  const OWNED = ['kv_favs', 'kv_contact', 'kv_orders', 'kv_profile', 'kv_promo',
    'kv_delivery', 'kv_city_picked'];
  function claimUser(uid) {
    const now = uid || '';
    const was = localStorage.getItem('kv_owner') || '';
    if (was === now) return false;
    localStorage.setItem('kv_owner', now);
    // с гостя на первый аккаунт переносим как есть: это тот же человек, который
    // только что зарегистрировался, забирать у него избранное незачем
    if (!was) return false;
    OWNED.forEach(k => localStorage.removeItem(k));
    profileName = '';
    appliedPromos = [];
    delivery = null;
    forgetUserState();
    if (hooks.render) hooks.render();
    if (hooks.cart) hooks.cart();
    drawDrawer();
    return true;
  }
  // packed и shipped завела миграция 0032: их пока никто не проставляет, но статус приходит
  // из базы, и показывать покупателю сырое английское слово нельзя
  function stLabel(s) {
    const k = { new: 'stNew', confirmed: 'stConfirmed', packed: 'stPacked', shipped: 'stShipped',
      done: 'stDone', cancelled: 'stCancelled',
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
              (f.k === 'phone' && tgPhoneReady() ? '<button class="kvp-ct-tgphone" type="button">✈ ' + t('tgPhone') + '</button>' : '')
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
              '<span>' + esc(it.name) + '</span><em>' + price(it) + '</em></button>').join('') + '</div>'
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
          esc(x.product_name || x.product_id) + '</span><b>' + (x.reserve_date ? fmtDate(x.reserve_date) + (x.reserve_time ? ' ' + esc(x.reserve_time) : '') : '') + '</b></div>' +
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
            // каждая позиция кликабельна: открывает карточку именно этого товара
            '<p class="kvp-ord-items">' + (o.items || []).map(i => typeof i === 'string'
              ? esc(i)
              : (i.id && find(i.id)
                  ? '<button class="kvp-ord-i" data-goto="' + esc(i.id) + '">' + esc(i.name + (i.flavor ? ' ' + flavorName(i.flavor) : '')) + ' ×' + (i.n || 1) + '</button>'
                  : esc(i.name + (i.flavor ? ' ' + flavorName(i.flavor) : '') + ' ×' + (i.n || 1)))
            ).join(' ') + '</p>' +
            // выдан: на каждый купленный товар кнопка отзыва (открывает карточку с нужным вкусом)
            (o.status === 'done'
              ? '<div class="kvp-revbtns">' + (o.items || []).filter(i => i && i.id).map(i =>
                  '<button class="kvp-review" data-review="' + esc(i.id) + '|' + esc(i.flavor || '') + '">' +
                  t('reviewAdd') + (i.flavor ? ' · ' + esc(flavorName(i.flavor)) : '') + '</button>').join('') + '</div>'
              : '') +
            '</div>').join('')
        : '<p class="kvp-empty">' + t('noOrders') + '</p>';
    } else {
      const orders = orderLog();
      ordCount = orders.length;
      ordInner = orders.length
        ? orders.slice(0, 6).map(o => '<div class="kvp-ord"><div class="kvp-ord-h"><span>' +
            fmtDate(o.ts) + '</span><b>' + o.total + ' zł</b></div>' +
            // старые записи хранят строки, новые: объекты с id: их делаем кликабельными
            '<p class="kvp-ord-items">' + (o.items || []).map(i => typeof i === 'string'
              ? esc(i)
              : (i.id && find(i.id)
                  ? '<button class="kvp-ord-i" data-goto="' + esc(i.id) + '">' + esc(i.name + (i.flavor ? ' ' + flavorName(i.flavor) : '')) + ' ×' + (i.n || 1) + '</button>'
                  : esc(i.name + (i.flavor ? ' ' + flavorName(i.flavor) : '') + ' ×' + (i.n || 1)))
            ).join(' ') + '</p></div>').join('') +
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
  // открыть карточку товара сразу с нужным вкусом и формой отзыва (кнопка на выданном заказе)
  function openReviewFor(id, flName) {
    const item = find(id); if (!item) return;
    openProduct(id);
    if (item.flavors && item.flavors.length && flName) {
      const idx = item.flavors.findIndex(f => f.name === flName);
      if (idx >= 0) { modal.fl = idx; modal.flPicked = true; }
    }
    if (!modal.rate) modal.rate = 5;
    renderModal();
    const rf = document.querySelector('#kvm .kvm-revform') || document.querySelector('#kvm .kvm-reviews');
    if (rf) rf.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
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
    if (e.target.closest('.kvp-ct-apply')) { applyProfileContact(d); return; }
    const rc = e.target.closest('[data-res-cancel]');
    if (rc) { cancelReservation(+rc.dataset.resCancel); return; }
    const rev = e.target.closest('[data-review]');
    if (rev) { const [id, fl] = rev.dataset.review.split('|'); closeProfile(); openReviewFor(id, fl); return; }
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
    try { await loadCatalog(); if (hooks.render) hooks.render(); } catch (e) {}
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
    return deliveryLabel(cur.method) + (cur.addr ? ': ' + cur.addr : '') + (fee ? ' (+' + money(fee) + ')' : '');
  }
  function deliveryHTML() {
    const cur = currentDelivery();
    const opts = deliveryMethods().map(m => {
      const fee = m.fee || 0;
      return '<button class="kvd-dopt' + (m.id === cur.method ? ' on' : '') + '" data-deliv="' + m.id + '" type="button">' +
        '<span>' + deliveryLabel(m.id) + '</span><i>' + (fee ? '+' + money(fee) : t('delFree')) + '</i></button>';
    }).join('');
    let field = '';
    if (cur.method === 'inpost')
      field = '<input class="kvd-daddr" type="text" placeholder="' + t('inpostPh') + '" value="' + esc(cur.addr || '') + '">';
    else if (cur.method === 'courier')
      field = '<input class="kvd-daddr" type="text" placeholder="' + t('courierPh') + '" value="' + esc(cur.addr || '') + '">';
    else {
      // Адрес самовывоза не показываем. Точек у магазина несколько, и какая из них удобна,
      // решают с менеджером: он пишет человеку сам после оформления. Раньше тут стояла одна
      // улица, и покупатель ехал туда, где его не ждали.
      field = '<div class="kvd-dnote kvd-dcall">' + esc(t('pickupCall')) + '</div>';
    }
    return '<div class="kvd-deliv"><b>' + t('delivery') + '</b><div class="kvd-dopts">' + opts + '</div>' + field + '</div>';
  }

  // ==== один общий стиль для всех новых компонентов ====
  // сайты только мапят палитру на нейтральные токены --kv-*, разметку красим тут
  function injectCSS() {
    if (document.getElementById('kv-shared')) return;
    const css = `
:root{--kv-radius:14px}
/* шторка языков/города в мини-аппе: якорим меню к своей кнопке и поднимаем над шапкой */
#lang,#city{position:relative}
.kv-city-menu{z-index:200}
/* правая группа шапки: раньше вправо её толкал #lang, теперь он живёт в бургер-меню */
.kv-hx{display:inline-flex;gap:2px;align-items:center;margin-left:auto}
.kv-hx .topcart{margin:0 2px 0 0}
.kv-hx-b{display:grid;place-items:center;width:34px;height:34px;border:none;background:none;color:var(--kv-text,currentColor);border-radius:50%;cursor:pointer;padding:0;opacity:.85}
.kv-hx-b:hover{opacity:1;background:var(--kv-surface,rgba(127,127,127,.12))}
.kv-burger-wrap{position:relative;display:inline-flex}
.kv-burger{position:absolute;top:calc(100% + 6px);right:0;z-index:210;min-width:186px;background:var(--kv-surface2,#fff);border:1px solid var(--kv-line,rgba(127,127,127,.25));border-radius:13px;padding:6px;box-shadow:0 18px 40px rgba(0,0,0,.28);display:flex;flex-direction:column;gap:2px}
.kv-burger[hidden]{display:none}
.kv-burger button{display:flex;align-items:center;gap:9px;background:none;border:none;color:var(--kv-text,inherit);font-family:inherit;font-size:13.5px;font-weight:700;padding:9px 11px;border-radius:9px;cursor:pointer;text-align:left;width:100%}
.kv-burger button:hover{background:var(--kv-surface,rgba(127,127,127,.12))}
.kv-burger button.on{color:var(--kv-accent-2,var(--kv-accent,inherit))}
.kv-burger-sep{height:1px;background:var(--kv-line,rgba(127,127,127,.2));margin:4px 2px}
.kvfav{position:fixed;inset:0;z-index:170;background:rgba(6,6,10,.74);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:640px){.kvfav{align-items:center;padding:24px}}
.kvfav[hidden]{display:none}
.kvfav-box{width:min(460px,100%);max-height:88vh;display:flex;flex-direction:column;background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:18px 18px 0 0;padding:16px 16px 20px}
@media(min-width:640px){.kvfav-box{border-radius:18px}}
.kvfav-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.kvfav-title{font-size:15px}
.kvfav-x{width:32px;height:32px;border:none;background:var(--kv-surface);color:var(--kv-muted);border-radius:50%;font-size:20px;cursor:pointer}
.kvfav-body{overflow-y:auto;display:flex;flex-direction:column;gap:8px}
.kvfav-row{display:flex;align-items:center;gap:8px}
.kvfav-i{flex:1;display:flex;align-items:center;gap:10px;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:12px;padding:8px 10px;cursor:pointer;text-align:left;font-family:inherit;color:var(--kv-text);min-width:0}
.kvfav-i img{width:44px;height:44px;object-fit:contain;background:#fff;border-radius:9px;flex-shrink:0}
.kvfav-n{display:flex;flex-direction:column;gap:2px;font-size:13px;font-weight:700;min-width:0}
.kvfav-n i{font-style:normal;font-size:12px;font-weight:600;color:var(--kv-muted)}
.kvfav-rm{width:34px;height:34px;flex-shrink:0;border:1px solid var(--kv-line);background:none;color:var(--kv-muted);border-radius:50%;font-size:18px;cursor:pointer}
.kvfav-empty{color:var(--kv-muted);font-size:12.5px;line-height:1.5;padding:8px 2px}
.kv-gate-cities{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.kv-gate-cities button{width:100%;background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:12px;padding:13px;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit}
.kv-gate-t{display:block;font-size:16px;margin-bottom:6px}
.kv-stars{display:inline-flex;align-items:center;gap:1px;font-size:12px}
.kv-star{color:var(--kv-line)}.kv-star.on{color:#ffb020}
.kv-stars i{font-style:normal;color:var(--kv-muted);font-size:11px;margin-left:5px}
.kv-badges{display:flex;gap:5px;flex-wrap:wrap}
.kv-badge{font-size:10px;font-weight:800;padding:3px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.4px}
.kv-badge.hit{background:#ff5c3322;color:#ff6a3d}
.kv-badge.choice{background:#8f6bff22;color:#9a7bff}
.kv-badge.few{background:#ffb02022;color:#e0920f}
.kv-badge.unique{background:#ff5c7a22;color:#ff5c7a}
.kv-badge.restock{background:#3dbb6e22;color:#3dbb6e}
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
/* применённые промокоды: чип на код, крестик снимает его отдельно */
.kvm-revpick{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 2px}
.kvm-revpick-b{background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-muted);border-radius:99px;
  padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.kvm-revpick-b.sel{border-color:var(--kv-accent);color:var(--kv-accent-2,var(--kv-accent))}
.kvd-promos{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.kvd-promo-chip{display:inline-flex;align-items:center;gap:6px;background:var(--kv-surface2,var(--kv-surface));
  border:1px solid var(--kv-line);border-radius:99px;padding:5px 6px 5px 11px;font-size:12px;font-weight:700;color:var(--kv-text)}
.kvd-promo-chip i{font-style:normal;font-weight:800;color:var(--kv-accent-2,var(--kv-accent))}
.kvd-promo-del{background:none;border:none;color:var(--kv-muted);font-size:15px;line-height:1;cursor:pointer;
  padding:0 4px;font-family:inherit}
.kvd-promo-del:hover{color:var(--kv-text)}
.kvd-disc{display:flex;justify-content:space-between;color:var(--kv-accent-2,var(--kv-accent));font-weight:700;font-size:13.5px}
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
.kvm-tiers{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.kvm-tiers-t{width:100%;font-size:11px;font-weight:800;color:var(--kv-muted);text-transform:uppercase;letter-spacing:.4px}
/* лесенка теперь подсказка, а не выбор количества: её не нажимают */
.kvm-tier{flex:1;min-width:66px;text-align:center;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:10px;padding:7px 4px;font-size:11px;color:var(--kv-muted);font-weight:700;font-family:inherit;transition:border-color .15s,background .15s}
/* счётчик вкуса: минус, число, плюс */
.kvm-cnt{display:flex;align-items:center;gap:2px;margin-left:auto;flex-shrink:0}
.kvm-cnt-b{width:30px;height:30px;display:grid;place-items:center;background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:9px;color:var(--kv-text);font-size:16px;font-weight:700;line-height:1;cursor:pointer;font-family:inherit;padding:0}
.kvm-cnt-b:hover:not([disabled]){border-color:var(--kv-accent);color:var(--kv-accent-2,var(--kv-accent))}
.kvm-cnt-b[disabled]{opacity:.32;cursor:default}
.kvm-cnt-n{min-width:22px;text-align:center;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
.kvm-flav.has{border-color:var(--kv-accent)}
.kvm-flav.has .kvm-cnt-n{color:var(--kv-accent-2,var(--kv-accent))}
/* товар без вкусов: тот же счётчик отдельной строкой */
.kvm-plain{display:flex;align-items:center;gap:11px;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:11px;padding:10px 12px;margin-bottom:9px}
.kvm-plain-l{font-size:11px;font-weight:800;color:var(--kv-muted);text-transform:uppercase;letter-spacing:.4px}
.kvm-plain-q{font-size:11.5px;color:var(--kv-muted);flex-shrink:0}
.kvm-tier.sel{border-color:var(--kv-accent);background:var(--kv-surface2)}
.kvm-tier.sel b{color:var(--kv-accent-2,var(--kv-accent))}
.kvm-tier.off{opacity:.4;cursor:default}
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
.kvp-ord-items{display:flex;flex-wrap:wrap;gap:5px}
.kvp-ord-i{background:var(--kv-surface2);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:8px;padding:5px 9px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left}
.kvp-ord-i:hover{border-color:var(--kv-accent)}
.kv-cmt{display:flex;flex-direction:column;gap:5px;margin-top:12px;font-size:12px;font-weight:700;color:var(--kv-muted)}
.kv-cmt>span{display:flex;justify-content:space-between;align-items:center;gap:8px}
.kv-cmt-n{font-style:normal;font-size:11px;font-weight:600;opacity:.8}
.kv-cmt textarea{background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:10px;padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical;min-height:52px;width:100%}
.kv-cmt textarea:focus{outline:none;border-color:var(--kv-accent)}
.kvp-revbtns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.kvp-review{background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:9px;padding:7px 11px;font-weight:800;font-size:11.5px;cursor:pointer;font-family:inherit}
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
.kvc-errbox{background:rgba(255,92,122,.12);border:1px solid rgba(255,92,122,.45);border-radius:11px;padding:11px 13px;margin-bottom:14px}
.kvc-errbox b{display:block;color:#ff6a86;font-size:13px;margin-bottom:5px}
.kvc-errbox ul{margin:0;padding-left:17px}
.kvc-errbox li{color:#ffa7b5;font-size:12.5px;line-height:1.5}
.kvc-f.bad input{border-color:#ff5c7a;background:rgba(255,92,122,.06)}
.kvc-f.bad>span{color:#ff8fa3}
.kvc-btns{display:flex;gap:9px;margin-top:14px}
.kvc-edit{flex:1;background:none;border:1px solid var(--kv-line);color:var(--kv-text);border-radius:11px;padding:12px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
.kvc-go{flex:2;background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:11px;padding:12px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}
.kvc-go[disabled]{opacity:.6;cursor:default}
.kvc-pay{margin-top:14px;min-height:44px}
.kvc-pays{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.kvc-paynote{width:100%;margin:2px 0 0;font-size:11.5px;color:var(--kv-muted)}
.kvc-paywarn{margin-top:14px;padding:11px 13px;border-radius:12px;font-size:12.5px;line-height:1.5;
  background:rgba(245,184,61,.1);border:1px solid rgba(245,184,61,.3);color:var(--kv-text)}
.kvc-paywarn a{color:var(--kv-accent-2);font-weight:700;white-space:nowrap}
.kvc-pays-t{width:100%;font-size:11px;font-weight:800;color:var(--kv-muted);text-transform:uppercase;letter-spacing:.4px}
.kvc-pay-opt{flex:1;min-width:120px;display:flex;flex-direction:column;gap:2px;align-items:flex-start;background:var(--kv-surface);border:1px solid var(--kv-line);border-radius:12px;padding:10px 12px;cursor:pointer;font-family:inherit;color:var(--kv-text)}
.kvc-pay-opt b{font-size:13px}
.kvc-pay-opt em{font-style:normal;font-size:14px;font-weight:800;color:var(--kv-accent-2,var(--kv-accent))}
.kvc-pay-opt i{font-style:normal;font-size:10.5px;color:var(--kv-muted)}
.kvc-pay-opt.sel{border-color:var(--kv-accent);background:var(--kv-surface2)}
.kvc-later{width:100%;margin-top:10px;background:none;border:1px solid var(--kv-line);color:var(--kv-muted);border-radius:11px;padding:11px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit}
.kvc-btns-edit{margin-top:8px}.kvc-btns-edit .kvc-edit{flex:1}
.kvc-f{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;font-size:12px;font-weight:700;color:var(--kv-muted)}
.kvc-f input{background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:10px;padding:11px 13px;font-family:inherit;font-size:13.5px}
.kvc-f input:focus{outline:none;border-color:var(--kv-accent)}
.kvc-apply{width:100%;margin-top:6px;background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:11px;padding:12px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}
.kvc-tgphone,.kvp-ct-tgphone{background:none;border:1px dashed var(--kv-line);color:var(--kv-accent-2,var(--kv-accent));border-radius:9px;padding:8px 12px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;margin-bottom:10px}
.kvc-fhint{margin:-4px 0 10px;font-size:11.5px;line-height:1.45;color:var(--kv-muted)}
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
.kvp-st-packed,.kvp-st-shipped{color:var(--kv-accent-2,var(--kv-accent))}
.kvp-st-done{color:#3dbb6e}.kvp-st-cancelled{color:var(--kv-muted)}
.kvp-res-cancel{background:none;border:none;color:#ff6a86;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;padding:0}`;
    const s = document.createElement('style');
    s.id = 'kv-shared'; s.textContent = css;
    document.head.appendChild(s);
  }

  // клики по кнопкам "бронь" и "сообщить о поступлении" ловим один раз на документе.
  // Кнопки «в корзину» тут больше нет: класть в корзину можно только из карточки товара,
  // где набирают вкусы и количество, и разбирает это onModalClick.
  document.addEventListener('click', e => {
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
    try {
      // data/meta.json больше не грузим: ярлыки задаются в панели управления, а других
      // данных в нём не осталось, лишний запрос на старте
      const [prod, c, fd] = await Promise.all([
        loadJSON('data/products.json'), loadJSON('data/content.json'), loadJSON('data/flavors.json')
      ]);
      if (!prod || !prod.categories) throw new Error('no products');
      master = prod; content = c || {}; flavorDescs = fd || {};
    } catch (e) {
      if (opts.fail) opts.fail();
      return;
    }
    // Восстанавливаем ранее введённые промокоды. Раньше тут лежала одна строка с кодом,
    // теперь список: старое значение читаем как единственный код.
    const savedPromo = localStorage.getItem('kv_promo');
    if (savedPromo) {
      let codes = [];
      try { const p = JSON.parse(savedPromo); codes = Array.isArray(p) ? p : [savedPromo]; }
      catch (e) { codes = [savedPromo]; }
      (async () => { for (const c of codes) await applyPromo(c); drawDrawer(); })();
    }
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
    if (isApp) mountHeaderExtras();          // избранное/менеджер/канал в шапке мини-аппа
    const fp = document.getElementById('filters');
    if (fp) filterPanel(fp);
    opts.render();
    renderInfo();
    if (hooks.cart) hooks.cart();
    // первый запуск (18+ и выбор города) проходят и сайт, и мини-апп;
    // cookie-баннер с попапом подписки остаются только на сайте
    firstRun(() => {
      if (!opts.app) { ensureCookie(); maybeSubscribe(); }
    });
    track('view');
  }

  return {
    init, t, ui, loc, catName, cityName, pickup, cityLogo, flavorName, specOf, qty, status,
    isNew, match, find, price, plural, fmtDate, photo, openCart, checkout,
    cartCount, cartTotal, grandTotal, toast, autoHideHeader, sortItems,
    starsHTML, badgesHTML, filterPass, searchSuggest, track,
    openProduct, openProfile, openFavs, isFav, toggleFav, removeFav, favs, tasteOf, flavorDesc,
    openManager, openChannel, managerLink, managerName, cityLink, bulkOrder,
    setProfileName, refreshProfile, forgetUserState, claimUser, adoptCity,
    get db() { return db; }, get lang() { return lang; }, get city() { return city; },
    manager: MANAGER
  };
})();
