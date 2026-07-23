// KatoVape: онлайн-оплата. Подключается после auth.js.
// Сайт — Stripe Express Checkout Element (Apple Pay / Google Pay / карта одной строкой).
// Мини-апп Telegram — нативный инвойс (кошельки Telegram показывает сам), потому что
// Stripe.js в вебвью Telegram не всегда даёт кошельки.
// Сумму и заказ создаёт сервер (edge-функции create-payment / create-checkout), фронт лишь
// подтверждает платёж. Пока в конфиге нет PAYMENTS/STRIPE_PK — модуль молчит, чекаут
// работает как раньше (оплата при выдаче).
window.KVPay = (function () {
  const CFG = window.KV_CONFIG || {};
  const currency = String(CFG.PAYMENTS_CURRENCY || 'pln').toLowerCase();

  const tgApp = () => (window.Telegram && window.Telegram.WebApp) || null;
  const inMiniApp = () => { const a = tgApp(); return !!(a && a.initData); };
  const cloudOn = () => CFG.BACKEND === 'supabase' && !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  // оплата доступна: включён флаг, есть облако и адрес функций; на сайте нужен ещё ключ Stripe
  const enabled = () => !!(CFG.PAYMENTS && cloudOn() && CFG.FUNCTIONS_URL && (inMiniApp() || CFG.STRIPE_PK));
  const fnUrl = p => CFG.FUNCTIONS_URL.replace(/\/$/, '') + p;

  // Stripe.js грузим с их домена один раз (для кошельков он обязан быть с js.stripe.com)
  let stripe = null;
  function loadStripe() {
    if (window.Stripe) return Promise.resolve(window.Stripe);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/'; s.async = true;
      s.onload = () => res(window.Stripe);
      s.onerror = () => rej(new Error('stripe load'));
      (document.head || document.documentElement).appendChild(s);
    });
  }

  async function api(path, body, headers) {
    const res = await fetch(fnUrl(path), {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY }, headers || {}),
      body: JSON.stringify(body)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'pay');
    return out;
  }

  // ---- сайт: Express Checkout Element ----
  async function mountWeb(box, data, cb) {
    const lib = await loadStripe();
    stripe = stripe || lib(CFG.STRIPE_PK);
    // Отложенный PaymentIntent: элемент создаём с суммой, сам платёж заводим на 'confirm',
    // когда человек уже выбрал кошелёк. Итоговую сумму всё равно считает сервер.
    const elements = stripe.elements({ mode: 'payment', amount: Math.max(data.amount | 0, 100), currency });
    const ece = elements.create('expressCheckout');
    ece.mount(box);
    ece.on('confirm', async () => {
      const sub = await elements.submit();
      if (sub.error) { cb.onError(sub.error.message); return; }
      let out;
      try {
        const token = window.KVAuth && KVAuth.accessToken ? await KVAuth.accessToken() : null;
        out = await api('/create-payment', data, token ? { Authorization: 'Bearer ' + token } : {});
      } catch (e) { cb.onError((e && e.message) || 'pay'); return; }
      const { error } = await stripe.confirmPayment({
        elements, clientSecret: out.clientSecret,
        confirmParams: { return_url: location.href.split('#')[0] },
        redirect: 'if_required'
      });
      if (error) { cb.onError(error.message); return; }
      cb.onSuccess();
    });
  }

  // ---- мини-апп: Stripe Checkout во внешнем браузере ----
  // Telegram убрал Stripe из провайдеров BotFather, поэтому нативный инвойс со Stripe не
  // собрать. Открываем страницу Stripe Checkout (там Apple Pay / Google Pay / карта, без
  // верификации домена), а итог оплаты узнаём опросом статуса заказа, когда человек вернётся.
  function mountTg(box, data, cb) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'kvpay-btn';
    btn.textContent = 'Оплатить ' + Math.round((data.amount | 0) / 100) + ' zł';
    const note = document.createElement('div');
    note.className = 'kvpay-note'; note.hidden = true;
    btn.onclick = async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      let out;
      try {
        out = await api('/create-checkout', Object.assign({ initData: tgApp().initData }, data));
      } catch (e) { btn.disabled = false; cb.onError((e && e.message) || 'pay'); return; }
      note.hidden = false;
      note.textContent = 'Оплата открыта в браузере. Заверши её и вернись — подтвердим здесь.';
      tgApp().openLink(out.url);
      pollOrder(out.orderId, cb, () => { btn.disabled = false; });
    };
    box.appendChild(btn);
    box.appendChild(note);
  }
  // опрашиваем свой заказ (RLS пускает своё) до 2 минут: paid -> успех, failed -> ошибка
  async function pollOrder(orderId, cb, onStop) {
    const token = window.KVAuth && KVAuth.accessToken ? await KVAuth.accessToken() : null;
    const url = CFG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/orders?id=eq.' + orderId + '&select=payment_status';
    let tries = 0;
    const timer = setInterval(async () => {
      if (++tries > 40) { clearInterval(timer); onStop && onStop(); cb.onCancel && cb.onCancel(); return; }
      try {
        const res = await fetch(url, { headers: Object.assign({ apikey: CFG.SUPABASE_ANON_KEY }, token ? { Authorization: 'Bearer ' + token } : {}) });
        const rows = await res.json().catch(() => []);
        const st = rows && rows[0] && rows[0].payment_status;
        if (st === 'paid') { clearInterval(timer); onStop && onStop(); cb.onSuccess(); }
        else if (st === 'failed') { clearInterval(timer); onStop && onStop(); cb.onError('failed'); }
      } catch (e) {}
    }, 3000);
  }

  function injectCSS() {
    if (document.getElementById('kvpay-css')) return;
    const s = document.createElement('style');
    s.id = 'kvpay-css';
    s.textContent = '.kvpay-btn{width:100%;background:#635bff;color:#fff;border:none;border-radius:12px;' +
      'padding:14px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}' +
      '.kvpay-btn[disabled]{opacity:.6;cursor:default}' +
      '.kvpay-note{margin-top:10px;font-size:12px;line-height:1.45;color:var(--kv-muted,#889)}';
    (document.head || document.documentElement).appendChild(s);
  }

  // монтируем оплату в переданный контейнер; cb: {onSuccess, onError, onCancel}
  async function mount(box, data, cb) {
    injectCSS();
    box.innerHTML = '';
    try {
      if (inMiniApp()) mountTg(box, data, cb);
      else await mountWeb(box, data, cb);
    } catch (e) { cb.onError((e && e.message) || 'pay'); }
  }

  return { enabled, inMiniApp, mount };
})();
