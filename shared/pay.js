// Online payment, loaded after auth.js.
// Website: Stripe Express Checkout Element. Mini app: Stripe Checkout in an external browser,
// because Stripe.js does not reliably offer wallets inside the Telegram webview.
// The amount and the order are created by the edge functions; the front only confirms the
// payment. Without PAYMENTS or STRIPE_PK in the config this module stays silent and checkout
// remains cash on pickup.
window.KVPay = (function () {
  const CFG = window.KV_CONFIG || {};
  const currency = String(CFG.PAYMENTS_CURRENCY || 'pln').toLowerCase();

  const tgApp = () => (window.Telegram && window.Telegram.WebApp) || null;
  const inMiniApp = () => { const a = tgApp(); return !!(a && a.initData); };
  // Card payment is off (CARD_OFF): instead of the Stripe form we show a button that says so
  // and leads to the manager. Keys and functions stay working; clearing the flag brings it back.
  const cardOff = () => !!(CFG.PAYMENTS_CARD_OFF);
  const cloudOn = () => CFG.BACKEND === 'supabase' && !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  // Payment is available when the flag, the cloud and the functions URL are set; the website
  // additionally needs the Stripe key.
  const enabled = () => !!(CFG.PAYMENTS && cloudOn() && CFG.FUNCTIONS_URL &&
    (cardOff() || inMiniApp() || CFG.STRIPE_PK));
  const fnUrl = p => CFG.FUNCTIONS_URL.replace(/\/$/, '') + p;

  // Stripe.js is loaded once from their domain: wallets require it to come from js.stripe.com.
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

  async function mountWeb(box, data, cb) {
    const lib = await loadStripe();
    stripe = stripe || lib(CFG.STRIPE_PK);
    // Deferred PaymentIntent: the element is created with an amount, the payment itself only
    // on 'confirm' once a wallet is chosen. The final amount is still computed by the server.
    const elements = stripe.elements({ mode: 'payment', amount: Math.max(data.amount | 0, 100), currency });
    const ece = elements.create('expressCheckout');
    ece.mount(box);
    ece.on('confirm', async () => {
      // The payment has started: the order dialog must not re-render underneath it.
      cb.onStart && cb.onStart();
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

  // Mini app: Stripe Checkout in an external browser. Telegram dropped Stripe from the
  // BotFather providers, so a native invoice is impossible. The result is learned by polling
  // the order status once the person comes back.
  function mountTg(box, data, cb) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'kvpay-btn';
    btn.textContent = KV.t('payNow', Math.round((data.amount | 0) / 100));
    const note = document.createElement('div');
    note.className = 'kvpay-note'; note.hidden = true;
    btn.onclick = async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      cb.onStart && cb.onStart();
      let out;
      try {
        out = await api('/create-checkout', Object.assign({ initData: tgApp().initData }, data));
      } catch (e) { btn.disabled = false; cb.onError((e && e.message) || 'pay'); return; }
      note.hidden = false;
      note.textContent = KV.t('payInBrowser');
      tgApp().openLink(out.url);
      pollOrder(out.orderId, cb, () => { btn.disabled = false; });
    };
    box.appendChild(btn);
    box.appendChild(note);
  }
  // Poll our own order for up to two minutes: paid means success, failed means error.
  // The poll stops itself when the payment dialog closes; it used to keep hitting the database
  // every three seconds after the person had left the screen.
  let pollTimer = null;
  function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  async function pollOrder(orderId, cb, onStop) {
    stopPoll();
    const token = window.KVAuth && KVAuth.accessToken ? await KVAuth.accessToken() : null;
    const url = CFG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/orders?id=eq.' + orderId + '&select=payment_status';
    const box = document.getElementById('kvc-pay');
    let tries = 0;
    const done = (fn, arg) => { stopPoll(); onStop && onStop(); fn && fn(arg); };
    pollTimer = setInterval(async () => {
      // The dialog was closed or re-rendered, so there is nobody left to poll for.
      if (box && !box.isConnected) { done(cb.onCancel); return; }
      if (++tries > 40) { done(cb.onCancel); return; }
      try {
        const res = await fetch(url, { headers: Object.assign({ apikey: CFG.SUPABASE_ANON_KEY }, token ? { Authorization: 'Bearer ' + token } : {}) });
        const rows = await res.json().catch(() => []);
        const st = rows && rows[0] && rows[0].payment_status;
        if (st === 'paid') done(cb.onSuccess);
        else if (st === 'failed') done(cb.onError, 'failed');
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
      // Card is off: the button is muted so it does not read as the primary action.
      '.kvpay-off{background:none;border:1px solid var(--kv-line,rgba(127,127,127,.35));color:var(--kv-muted,#889);font-weight:700}' +
      '.kvpay-note{margin-top:10px;font-size:12px;line-height:1.45;color:var(--kv-muted,#889)}';
    (document.head || document.documentElement).appendChild(s);
  }

  // Placeholder while card payment is off: one button instead of the payment form.
  function mountOff(box, cb) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'kvpay-btn kvpay-off';
    btn.textContent = KV.t('payCardBtn');
    let busy = false;
    btn.onclick = () => {
      if (busy) return;                     // a second tap must not open the chat twice
      busy = true; setTimeout(() => { busy = false; }, 1200);
      cb.onError('card_off');
      // The manager chat is opened inside the click handler: from a timer the browser would
      // treat it as a popup and block it.
      if (window.KV && KV.openManager) KV.openManager();
    };
    box.appendChild(btn);
  }

  // Mounts payment into the given container; cb: {onStart, onSuccess, onError, onCancel}.
  async function mount(box, data, cb) {
    injectCSS();
    box.innerHTML = '';
    try {
      if (cardOff()) mountOff(box, cb);
      else if (inMiniApp()) mountTg(box, data, cb);
      else await mountWeb(box, data, cb);
    } catch (e) { cb.onError((e && e.message) || 'pay'); }
  }

  return { enabled, inMiniApp, mount };
})();
