// KatoVape авторизация. Подключается после core.js.
// Логин/почта/телефон + пароль и вход через Telegram живут в Supabase Auth:
// пароли хешируются (bcrypt), сессия в JWT, данные шифруются на стороне Supabase.
// Пока config.js пустой, модуль сидит тихо и сайт работает как гостевой демо.
window.KVAuth = (function () {
  const CFG = window.KV_CONFIG || {};
  // локальный бэкенд включаем, только когда сама страница открыта локально,
  // иначе публичный сайт (GitHub Pages) не должен стучаться на localhost
  const LOCAL = () => {
    if (CFG.BACKEND !== 'local' || !CFG.LOCAL_API) return false;
    const apiLocal = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)/.test(CFG.LOCAL_API);
    const hostLocal = /^(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])$/.test(location.hostname);
    return apiLocal ? hostLocal : true;
  };
  const configured = () => LOCAL() || !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  let sb = null;        // клиент supabase-js
  let user = null;      // запись из auth.users
  let profile = null;   // строка public.profiles
  let admin = false;    // текущий пользователь в списке админов
  let tab = 'login';    // вкладка в модалке
  let ready = false;

  const L = {
    ru: {
      account: 'Аккаунт', login: 'Вход', register: 'Регистрация', logout: 'Выйти',
      loginBtn: 'Войти или зарегистрироваться', or: 'или', tgLogin: 'Войти через Telegram',
      identifier: 'Логин, почта или телефон', password: 'Пароль',
      username: 'Логин', email: 'Почта (по желанию)', phone: 'Телефон (по желанию)',
      doLogin: 'Войти', doReg: 'Создать аккаунт', linked: 'Привязан Telegram',
      guestNote: 'Вы зашли как гость. Войдите, чтобы сохранять заказы и отзывы за собой.',
      notConfigured: 'Демо-режим: вход подключится после настройки Supabase (см. AUTH_SETUP.md).',
      pending: 'Проверьте почту и подтвердите регистрацию.', welcome: 'Готово, вы вошли',
      errUser: 'Логин от 3 символов', errUserChars: 'Логин: латиница, цифры, _ и .',
      errPass: 'Пароль от 6 символов', errEmail: 'Проверьте почту', errPhone: 'Проверьте телефон',
      errEmpty: 'Заполните поля', takenUser: 'Такой логин уже занят',
      takenEmail: 'Эта почта уже зарегистрирована', takenPhone: 'Этот телефон уже зарегистрирован',
      noAccount: 'Аккаунт не найден', badCreds: 'Неверный логин или пароль',
      noTg: 'Вход через Telegram не настроен', tgFail: 'Не вышло войти через Telegram',
      generic: 'Что-то пошло не так, попробуйте ещё раз', needTg: 'Открой в Telegram для входа',
      changeAvatar: 'Сменить фото', avatarBig: 'Фото слишком большое', hi: 'Привет',
      adminPanel: 'Панель управления', openTg: 'Открыть в Telegram',
      tgHint: 'Ещё проще без пароля в приложении Telegram: там магазин узнаёт вас сам.'
    },
    uk: {
      account: 'Акаунт', login: 'Вхід', register: 'Реєстрація', logout: 'Вийти',
      loginBtn: 'Увійти або зареєструватися', or: 'або', tgLogin: 'Увійти через Telegram',
      identifier: 'Логін, пошта або телефон', password: 'Пароль',
      username: 'Логін', email: 'Пошта (за бажанням)', phone: 'Телефон (за бажанням)',
      doLogin: 'Увійти', doReg: 'Створити акаунт', linked: 'Прив’язаний Telegram',
      guestNote: 'Ви зайшли як гість. Увійдіть, щоб зберігати замовлення й відгуки за собою.',
      notConfigured: 'Демо-режим: вхід підключиться після налаштування Supabase (див. AUTH_SETUP.md).',
      pending: 'Перевірте пошту й підтвердьте реєстрацію.', welcome: 'Готово, ви увійшли',
      errUser: 'Логін від 3 символів', errUserChars: 'Логін: латиниця, цифри, _ та .',
      errPass: 'Пароль від 6 символів', errEmail: 'Перевірте пошту', errPhone: 'Перевірте телефон',
      errEmpty: 'Заповніть поля', takenUser: 'Такий логін вже зайнятий',
      takenEmail: 'Ця пошта вже зареєстрована', takenPhone: 'Цей телефон вже зареєстрований',
      noAccount: 'Акаунт не знайдено', badCreds: 'Невірний логін або пароль',
      noTg: 'Вхід через Telegram не налаштований', tgFail: 'Не вдалося увійти через Telegram',
      generic: 'Щось пішло не так, спробуйте ще раз', needTg: 'Відкрий у Telegram для входу',
      changeAvatar: 'Змінити фото', avatarBig: 'Фото завелике', hi: 'Привіт',
      adminPanel: 'Панель керування', openTg: 'Відкрити в Telegram',
      tgHint: 'Ще простіше без пароля у застосунку Telegram: там магазин впізнає вас сам.'
    },
    pl: {
      account: 'Konto', login: 'Logowanie', register: 'Rejestracja', logout: 'Wyloguj',
      loginBtn: 'Zaloguj lub zarejestruj się', or: 'lub', tgLogin: 'Zaloguj przez Telegram',
      identifier: 'Login, e-mail lub telefon', password: 'Hasło',
      username: 'Login', email: 'E-mail (opcjonalnie)', phone: 'Telefon (opcjonalnie)',
      doLogin: 'Zaloguj', doReg: 'Utwórz konto', linked: 'Powiązany Telegram',
      guestNote: 'Jesteś gościem. Zaloguj się, aby zapisywać zamówienia i opinie.',
      notConfigured: 'Tryb demo: logowanie ruszy po konfiguracji Supabase (zob. AUTH_SETUP.md).',
      pending: 'Sprawdź e-mail i potwierdź rejestrację.', welcome: 'Gotowe, zalogowano',
      errUser: 'Login od 3 znaków', errUserChars: 'Login: litery, cyfry, _ i .',
      errPass: 'Hasło od 6 znaków', errEmail: 'Sprawdź e-mail', errPhone: 'Sprawdź telefon',
      errEmpty: 'Wypełnij pola', takenUser: 'Ten login jest już zajęty',
      takenEmail: 'Ten e-mail jest już zarejestrowany', takenPhone: 'Ten telefon jest już zarejestrowany',
      noAccount: 'Nie znaleziono konta', badCreds: 'Błędny login lub hasło',
      noTg: 'Logowanie przez Telegram nie jest skonfigurowane', tgFail: 'Nie udało się zalogować przez Telegram',
      generic: 'Coś poszło nie tak, spróbuj ponownie', needTg: 'Otwórz w Telegramie, aby się zalogować',
      changeAvatar: 'Zmień zdjęcie', avatarBig: 'Zdjęcie za duże', hi: 'Cześć',
      adminPanel: 'Panel zarządzania', openTg: 'Otwórz w Telegramie',
      tgHint: 'Jeszcze prościej bez hasła w aplikacji Telegram: sklep rozpozna Cię sam.'
    }
  };
  const lang = () => (window.KV && KV.lang) || 'ru';
  const tr = k => (L[lang()] || L.ru)[k] || k;
  const msg = k => ({ message: tr(k) });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- клиент supabase (SDK тянем с CDN один раз) ----
  async function client() {
    if (sb) return sb;
    const mod = await import('https://esm.sh/@supabase/supabase-js@2');
    sb = mod.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kv_sb_auth', detectSessionInUrl: false }
    });
    return sb;
  }

  // ---- нормализация и проверки ----
  const normPhone = s => (s || '').replace(/[^\d+]/g, '');
  const looksEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || '');
  const looksPhone = s => /^\+?\d[\d\s()-]{6,}$/.test(s || '');
  // если реальной почты нет, вход по синтетическому адресу (в auth.users нужен email).
  // домен на реальном TLD: .local зарезервирован и не проходит валидацию Supabase Auth.
  function authEmailFor(f) {
    if (f.email && looksEmail(f.email)) return f.email.toLowerCase();
    if (f.username) return 'u_' + f.username.toLowerCase().replace(/[^a-z0-9_]/g, '') + '@users.katovape.pl';
    if (f.phone) return 'p_' + normPhone(f.phone).replace(/\D/g, '') + '@users.katovape.pl';
    return null;
  }
  function mapErr(e) {
    const m = (e && e.message || '').toLowerCase();
    if (m.includes('already registered') || m.includes('already exists')) return msg('takenEmail');
    if (m.includes('invalid login')) return msg('badCreds');
    if (m.includes('email') && m.includes('confirm')) return msg('pending');
    return e && e.message ? e : msg('generic');
  }

  // ---- локальный SQL-бэкенд (демо, папка server/) ----
  function ltoken() { return localStorage.getItem('kv_local_token') || ''; }
  function setLtoken(t) { if (t) localStorage.setItem('kv_local_token', t); else localStorage.removeItem('kv_local_token'); }
  async function lapi(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, ltoken() ? { Authorization: 'Bearer ' + ltoken() } : {});
    const res = await fetch(CFG.LOCAL_API.replace(/\/$/, '') + path, Object.assign({ headers }, opts));
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw { message: out.error ? tr(out.error) : tr('generic'), code: out.error };
    return out;
  }

  // ---- регистрация ----
  async function signUp(form) {
    if (!configured()) throw msg('notConfigured');
    const username = (form.username || '').trim();
    const password = form.password || '';
    const email = (form.email || '').trim();
    const phone = normPhone(form.phone);
    if (username.length < 3) throw msg('errUser');
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) throw msg('errUserChars');
    if (password.length < 6) throw msg('errPass');
    if (email && !looksEmail(email)) throw msg('errEmail');
    if (phone && !looksPhone(phone)) throw msg('errPhone');
    if (LOCAL()) {
      const out = await lapi('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, email, phone }) });
      setLtoken(out.token); await afterAuth(); return { ok: true };
    }
    // аккаунт заводит edge-функция на service_role: клиентский signUp отбраковывает
    // синтетические адреса. Она проверяет занятость, создаёт юзера и отдаёт OTP.
    if (!CFG.FUNCTIONS_URL) throw msg('generic');
    const res = await fetch(CFG.FUNCTIONS_URL.replace(/\/$/, '') + '/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY },
      body: JSON.stringify({ username, email, phone, password })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.email || !out.otp) throw msg(out.error || 'generic');
    const c = await client();
    const { error } = await c.auth.verifyOtp({ email: out.email, token: out.otp, type: 'magiclink' });
    if (error) throw mapErr(error);
    await afterAuth();
    return { ok: true };
  }

  // ---- вход по логину / почте / телефону ----
  async function signIn(form) {
    if (!configured()) throw msg('notConfigured');
    const id = (form.identifier || '').trim();
    const password = form.password || '';
    if (!id || !password) throw msg('errEmpty');
    if (LOCAL()) {
      const out = await lapi('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: id, password }) });
      setLtoken(out.token); await afterAuth(); return { ok: true };
    }
    const c = await client();
    // сервер сам находит, какой auth-email стоит за этим логином/телефоном/почтой
    const r = await c.rpc('resolve_login', { p_identifier: looksPhone(id) ? normPhone(id) : id });
    let email = (r && r.data) || null;
    if (!email && looksEmail(id)) email = id.toLowerCase();
    if (!email) throw msg('noAccount');
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw mapErr(error);
    await afterAuth();
    return { ok: true };
  }

  // ---- Telegram: виджет на сайте и initData в мини-аппе ----
  async function telegramExchange(body) {
    if (LOCAL()) {
      // передаём подписанные данные как есть — сервер сам проверит подпись бот-токеном
      const out = await lapi('/auth/telegram', { method: 'POST', body: JSON.stringify(body) });
      setLtoken(out.token); await afterAuth(); return { ok: true };
    }
    if (!configured() || !CFG.FUNCTIONS_URL) throw msg('noTg');
    const res = await fetch(CFG.FUNCTIONS_URL.replace(/\/$/, '') + '/telegram-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.email || !out.otp) throw (out.error ? { message: out.error } : msg('tgFail'));
    const c = await client();
    const { error } = await c.auth.verifyOtp({ email: out.email, token: out.otp, type: 'magiclink' });
    if (error) throw mapErr(error);
    await afterAuth();
    return { ok: true };
  }
  function tgWidget(u) {  // колбэк Telegram Login Widget на сайте
    telegramExchange({ mode: 'widget', payload: u }).then(closeModal).catch(showErr);
  }
  async function tgInitData() {  // тихий авто-вход в мини-аппе
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.initData) return false;
    try { await telegramExchange({ mode: 'initdata', initData: tg.initData }); return true; }
    catch (e) { return false; }
  }

  async function signOut() {
    if (LOCAL()) { try { await lapi('/auth/logout', { method: 'POST' }); } catch (e) {} setLtoken(''); }
    else if (sb) { try { await sb.auth.signOut(); } catch (e) {} }
    user = null; profile = null; admin = false;
    if (window.KV) { KV.setProfileName('', true); }
    updateAll();
  }

  // ---- после входа: подтягиваем профиль и имя ----
  async function afterAuth() {
    if (LOCAL()) {
      try { const out = await lapi('/auth/me', {}); user = out.user; profile = out.user; }
      catch (e) { user = null; profile = null; setLtoken(''); }
      admin = !!(profile && profile.is_admin);
      const nm = profile && (profile.display_name || profile.username);
      if (window.KV && nm) KV.setProfileName(nm, true);
      updateAll(); return;
    }
    const c = await client();
    const g = await c.auth.getUser();
    user = (g && g.data && g.data.user) || null;
    profile = null; admin = false;
    if (user) {
      const pr = await c.from('profiles').select('*').eq('id', user.id).maybeSingle();
      profile = (pr && pr.data) || null;
      const nm = (profile && (profile.display_name || profile.username)) ||
        (user.user_metadata && user.user_metadata.username) || '';
      if (window.KV && nm) KV.setProfileName(nm, true);
      // спрашиваем сервер, админ ли — чтобы показать кнопку перехода в админку
      try { const a = await c.rpc('is_admin'); admin = !!(a && a.data); } catch (e) { admin = false; }
    }
    updateAll();
  }

  // ---- перерисовка аккаунт-блока, шапки и профиля ----
  function updateAll() {
    updateProfileBtn();
    const kvp = document.getElementById('kvp');
    if (kvp && !kvp.hidden && window.KV) { KV.refreshProfile(); return; }
    const mount = document.getElementById('kvp-auth');
    if (mount) decorateProfile(mount);
  }

  // иконка профиля в шапке: если есть аватар (из Telegram или загруженный) — показываем его
  const PROF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
  // фото профиля: сохранённый аватар, иначе живое фото из Telegram (в мини-аппе доступно сразу)
  function tgPhoto() {
    const tg = window.Telegram && window.Telegram.WebApp;
    return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.photo_url) || null;
  }
  function avatarOf() { return (profile && profile.avatar) || (user && user.avatar) || tgPhoto() || null; }
  // текущий пользователь — админ? (его telegram_id в списке ADMIN_IDS). Кнопку показываем
  // по этому флагу, реальный доступ всё равно проверяет is_admin() в базе.
  function isAdmin() {
    const ids = CFG.ADMIN_IDS || [];
    const tid = (profile && profile.telegram_id) || (user && user.telegram_id) ||
      (tgUserObj() && tgUserObj().id) || null;
    return !!tid && ids.map(Number).includes(Number(tid));
  }
  function tgUserObj() {
    const tg = window.Telegram && window.Telegram.WebApp;
    return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
  }
  function updateProfileBtn() {
    const btn = document.querySelector('#profile .kv-prof'); if (!btn) return;
    const av = avatarOf();
    btn.innerHTML = av ? '<img class="kv-prof-ava" src="' + esc(av) + '" alt="">' : PROF_ICON;
    btn.classList.toggle('has-ava', !!av);
  }

  // блок профиля: залогинен — аватар, имя, контакты, выход (и смена фото на сайте);
  // гость — только кнопка входа. Старый «Гость / Ваше имя / Сохранить» больше не нужен.
  function decorateProfile(el) {
    if (!el) return;
    const tg = window.Telegram && window.Telegram.WebApp;
    const inTg = !!(tg && tg.initData);
    if (user) {
      const p = profile || user;
      const name = p.display_name || p.username || '';
      const av = p.avatar || tgPhoto() || null;
      const initial = (name || 'K').trim()[0].toUpperCase();
      const avaInner = av ? '<img src="' + esc(av) + '" alt="">' : '<span>' + esc(initial) + '</span>';
      const rows = [];
      if (p.username && !/^tg_\d+$/.test(p.username)) rows.push('<span>@' + esc(p.username) + '</span>');
      if (p.email) rows.push('<span>' + esc(p.email) + '</span>');
      if (p.phone) rows.push('<span>' + esc(p.phone) + '</span>');
      if (p.telegram_id) rows.push('<span class="kva-tg">✈ ' + tr('linked') +
        (p.telegram_username ? ' @' + esc(p.telegram_username) : '') + '</span>');
      // админу — кнопка перехода в панель управления
      const adminBtn = (isAdmin() && CFG.ADMIN_URL)
        ? '<a class="kva-admin" href="' + esc(CFG.ADMIN_URL) + '" target="_blank" rel="noopener">⚙ ' + tr('adminPanel') + '</a>'
        : '';
      el.innerHTML =
        '<div class="kva-me">' +
          '<div class="kva-ava' + (inTg ? '' : ' editable') + '">' + avaInner +
            (inTg ? '' : '<span class="kva-ava-cam">✎</span><input type="file" accept="image/*" class="kva-ava-file" hidden>') +
          '</div>' +
          '<div class="kva-me-info"><b>' + esc(name) + '</b>' +
            '<div class="kva-me-rows">' + rows.join('') + '</div></div>' +
        '</div>' +
        adminBtn +
        '<button class="kva-logout">' + tr('logout') + '</button>';
      el.querySelector('.kva-logout').onclick = signOut;
      if (!inTg) {
        const ava = el.querySelector('.kva-ava'), file = el.querySelector('.kva-ava-file');
        ava.onclick = () => file.click();
        file.onchange = () => { if (file.files[0]) pickAvatar(file.files[0]); };
      }
    } else {
      el.innerHTML = '<div class="kva-guest"><p>' + tr('guestNote') + '</p>' +
        '<button class="kva-login-btn">' + tr('loginBtn') + '</button>' +
        (configured() ? '' : '<div class="kva-note">' + tr('notConfigured') + '</div>') + '</div>';
      el.querySelector('.kva-login-btn').onclick = openModal;
    }
  }

  // смена аватара на сайте: ужимаем до 256px, шлём как data-URL
  function pickAvatar(file) {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 256, sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        changeAvatar(cv.toDataURL('image/jpeg', 0.85))
          .catch(e => { if (window.KV) KV.toast((e && e.message) || tr('generic')); });
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  async function changeAvatar(dataUrl) {
    if (LOCAL()) {
      const out = await lapi('/auth/avatar', { method: 'POST', body: JSON.stringify({ avatar: dataUrl }) });
      user = out.user; profile = out.user; updateAll();
      if (window.KV) KV.toast(tr('changeAvatar'));
      return;
    }
    // supabase: кладём сжатый data-URL прямо в profiles.avatar (RLS пускает своё, грант на avatar есть)
    if (cloudOn() && user) {
      const c = await client();
      const { error } = await c.from('profiles').update({ avatar: dataUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw { message: error.message };
      if (profile) profile.avatar = dataUrl;
      updateAll();
      if (window.KV) KV.toast(tr('changeAvatar'));
    }
  }

  // ---- модалка входа/регистрации ----
  function ensureModal() {
    if (document.getElementById('kva')) return;
    const d = document.createElement('div');
    d.id = 'kva'; d.className = 'kva'; d.hidden = true;
    d.innerHTML = '<div class="kva-box"><button class="kva-x" aria-label="close">&times;</button>' +
      '<div class="kva-tabs"><button data-tab="login"></button><button data-tab="register"></button></div>' +
      '<div class="kva-body"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('.kva-x')) { closeModal(); return; }
      const tb = e.target.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; renderModal(); return; }
      if (e.target.closest('.kva-tg-demo')) { demoTelegramLogin(); return; }
      if (e.target.closest('.kva-submit')) { submit(); return; }
    });
    d.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }
  function renderModal() {
    const d = document.getElementById('kva'); if (!d) return;
    d.querySelector('[data-tab="login"]').textContent = tr('login');
    d.querySelector('[data-tab="login"]').className = tab === 'login' ? 'on' : '';
    d.querySelector('[data-tab="register"]').textContent = tr('register');
    d.querySelector('[data-tab="register"]').className = tab === 'register' ? 'on' : '';
    const notCfg = configured() ? '' : '<div class="kva-banner">' + tr('notConfigured') + '</div>';
    let form;
    if (tab === 'login') {
      form = '<input class="kva-f" data-k="identifier" type="text" placeholder="' + tr('identifier') + '" autocomplete="username">' +
        '<input class="kva-f" data-k="password" type="password" placeholder="' + tr('password') + '" autocomplete="current-password">' +
        '<button class="kva-submit">' + tr('doLogin') + '</button>';
    } else {
      form = '<input class="kva-f" data-k="username" type="text" placeholder="' + tr('username') + '" autocomplete="username">' +
        '<input class="kva-f" data-k="email" type="email" placeholder="' + tr('email') + '" autocomplete="email">' +
        '<input class="kva-f" data-k="phone" type="tel" placeholder="' + tr('phone') + '" autocomplete="tel">' +
        '<input class="kva-f" data-k="password" type="password" placeholder="' + tr('password') + '" autocomplete="new-password">' +
        '<button class="kva-submit">' + tr('doReg') + '</button>';
    }
    const tg = window.Telegram && window.Telegram.WebApp;
    const inTg = !!(tg && tg.initData);
    const localHost = /^(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])$/.test(location.hostname);
    const localDemo = LOCAL() && localHost;                       // локальный бэкенд на локальном хосте
    const realWidget = !!CFG.TELEGRAM_BOT && !inTg && !localDemo;  // виджет только на реальном домене бота
    // На десктопе даём и логин/пароль, и виджет Telegram (он реально логинит браузер;
    // ссылка на бота сессию сайта не авторизует). В мини-аппе вход идёт сам по initData.
    let tgBlock = '';
    if (!inTg && (realWidget || localDemo)) {
      tgBlock = '<div class="kva-or"><span>' + tr('or') + '</span></div>' +
        (localDemo
          ? '<button class="kva-tg-demo" type="button">✈ ' + tr('tgLogin') + '</button>'
          : '<div class="kva-tg" id="kva-tg-widget"></div>' +
            '<div class="kva-note kva-tg-hint">' + tr('tgHint') + '</div>');
    }
    d.querySelector('.kva-body').innerHTML = notCfg + '<div class="kva-form">' + form + '</div>' +
      '<div class="kva-err" hidden></div>' + tgBlock;
    if (realWidget) mountTgWidget();
  }
  // демо-вход через Telegram для локального показа (реальный виджет требует публичный домен).
  // Заводит стабильный демо-аккаунт с аватаром, чтобы показать поток и аватарку в шапке.
  function demoTelegramLogin() {
    let id = +localStorage.getItem('kv_demo_tg') || 0;
    if (!id) { id = 900000000 + Math.floor(Math.random() * 89999999); localStorage.setItem('kv_demo_tg', String(id)); }
    // аватар генерим локально (без внешних сервисов), чтобы всегда показывался
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">' +
      '<rect width="128" height="128" rx="64" fill="#2aabee"/>' +
      '<text x="64" y="86" font-size="58" text-anchor="middle" fill="#fff" font-family="Arial">✈</text></svg>';
    const u = { id: id, first_name: 'Telegram', username: 'demo_' + String(id).slice(-4),
      photo_url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))) };
    telegramExchange({ mode: 'demo', payload: u })
      .then(() => { closeModal(); if (window.KV) KV.toast(tr('welcome')); })
      .catch(showErr);
  }
  function mountTgWidget() {
    const box = document.getElementById('kva-tg-widget'); if (!box) return;
    box.innerHTML = '';
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', CFG.TELEGRAM_BOT);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-userpic', 'false');
    // без data-request-access=write: виджет делится только именем и фото, не просит
    // разрешение боту писать и не показывает телефон — так вход не пугает клиента
    s.setAttribute('data-onauth', 'KVAuth._tgWidget(user)');
    box.appendChild(s);
  }
  function readForm() {
    const d = document.getElementById('kva'), f = {};
    d.querySelectorAll('.kva-f').forEach(i => { f[i.dataset.k] = i.value; });
    return f;
  }
  function showErr(e) {
    const box = document.querySelector('#kva .kva-err'); if (!box) return;
    box.textContent = (e && e.message) || tr('generic'); box.hidden = false;
  }
  function submit() {
    const d = document.getElementById('kva'); if (!d || d.hidden) return;
    const btn = d.querySelector('.kva-submit'); if (btn && btn.disabled) return;
    const box = d.querySelector('.kva-err'); if (box) box.hidden = true;
    if (btn) { btn.disabled = true; btn.dataset.txt = btn.textContent; btn.textContent = '…'; }
    const done = () => { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.txt; } };
    const form = readForm();
    const run = tab === 'login' ? signIn(form) : signUp(form);
    run.then(res => {
      done();
      if (res && res.pending) { showErr(msg('pending')); return; }
      closeModal();
      if (window.KV) KV.toast(tr('welcome'));
    }).catch(e => { done(); showErr(e); });
  }
  function openModal() {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData && !user) {
      // в мини-аппе вход телеграмом идёт сам, руками ничего вводить не нужно
      tgInitData().then(ok => { if (!ok) { ensureModal(); tab = 'login'; renderModal(); reallyOpen(); } });
      return;
    }
    ensureModal(); renderModal(); reallyOpen();
  }
  function reallyOpen() {
    const d = document.getElementById('kva');
    d.hidden = false; document.body.classList.add('kv-noscroll');
  }
  function closeModal() {
    const d = document.getElementById('kva'); if (d) d.hidden = true;
    const kvp = document.getElementById('kvp');
    if (!kvp || kvp.hidden) document.body.classList.remove('kv-noscroll');
  }

  function injectCSS() {
    if (document.getElementById('kva-css')) return;
    const css = `
.kva{position:fixed;inset:0;z-index:160;background:rgba(6,6,10,.74);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:640px){.kva{align-items:center;padding:24px}}
.kva[hidden]{display:none}
.kva-box{position:relative;width:min(420px,100%);max-height:92vh;overflow-y:auto;background:var(--kv-surface2);border:1px solid var(--kv-line);border-radius:20px 20px 0 0;padding:22px 20px 26px;box-shadow:var(--kv-shadow)}
@media(min-width:640px){.kva-box{border-radius:20px}}
.kva-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border:none;background:var(--kv-surface);color:var(--kv-muted);border-radius:50%;font-size:22px;cursor:pointer}
.kva-tabs{display:flex;gap:6px;margin:2px 44px 16px 0}
.kva-tabs button{flex:1;background:none;border:none;border-bottom:2px solid transparent;color:var(--kv-muted);font-family:inherit;font-weight:800;font-size:15px;padding:8px 4px;cursor:pointer}
.kva-tabs button.on{color:var(--kv-text);border-bottom-color:var(--kv-accent)}
.kva-form{display:flex;flex-direction:column;gap:10px}
.kva-f{background:var(--kv-field);border:1px solid var(--kv-line);color:var(--kv-text);border-radius:11px;padding:12px 14px;font-family:inherit;font-size:14px;width:100%}
.kva-f:focus{outline:none;border-color:var(--kv-accent)}
.kva-submit{margin-top:4px;background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:12px;padding:14px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}
.kva-submit[disabled]{opacity:.6;cursor:default}
.kva-err{margin-top:12px;background:rgba(255,92,122,.12);border:1px solid rgba(255,92,122,.4);color:#ff6a86;border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.4}
.kva-err[hidden]{display:none}
.kva-banner,.kva-note{background:var(--kv-surface);border:1px solid var(--kv-line);color:var(--kv-muted);border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.5}
.kva-banner{margin-bottom:14px}
.kva-or{display:flex;align-items:center;gap:10px;margin:16px 0 12px;color:var(--kv-muted);font-size:12px}
.kva-or::before,.kva-or::after{content:"";flex:1;height:1px;background:var(--kv-line)}
.kva-tg{display:flex;justify-content:center;min-height:34px}
.kva-tg-demo{width:100%;background:#2aabee;color:#fff;border:none;border-radius:12px;padding:13px;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit}
.kva-tg-demo:hover{filter:brightness(1.06)}
.kva-tg-open{display:block;width:100%;text-align:center;background:#2aabee;color:#fff;border:none;border-radius:12px;padding:13px;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit;text-decoration:none}
.kva-tg-open:hover{filter:brightness(1.06)}
.kva-tg-hint{margin-top:10px}
.kva-admin{display:block;text-align:center;background:var(--kv-surface);border:1px solid var(--kv-accent);color:var(--kv-accent-2,var(--kv-accent));border-radius:11px;padding:11px;font-weight:800;font-size:13px;text-decoration:none;margin-bottom:10px}
.kva-admin:hover{background:var(--kv-accent);color:var(--kv-accent-ink)}
.kva-acc{border:1px solid var(--kv-line);border-radius:12px;padding:14px 15px;background:var(--kv-surface)}
.kva-acc>b{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--kv-muted);display:block;margin-bottom:9px}
.kva-acc-rows{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
.kva-acc-rows span{font-size:13.5px;color:var(--kv-text);font-weight:600}
.kva-acc-rows .kva-tg{justify-content:flex-start;color:var(--kv-accent-2,var(--kv-accent));font-weight:700;min-height:0}
.kva-logout{width:100%;background:none;border:1px solid var(--kv-line);color:var(--kv-muted);border-radius:10px;padding:10px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit}
.kva-guest p{font-size:12.5px;color:var(--kv-muted);line-height:1.5;margin-bottom:10px}
.kva-login-btn{width:100%;background:var(--kv-accent);color:var(--kv-accent-ink);border:none;border-radius:12px;padding:13px;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit}
.kva-note{margin-top:10px}
.kva-me{display:flex;align-items:center;gap:13px;margin-bottom:12px}
.kva-ava{position:relative;width:56px;height:56px;border-radius:50%;overflow:hidden;background:var(--kv-accent);color:var(--kv-accent-ink);display:grid;place-items:center;font-weight:900;font-size:22px;flex-shrink:0}
.kva-ava img{width:100%;height:100%;object-fit:cover}
.kva-ava.editable{cursor:pointer}
.kva-ava-cam{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;font-size:12px;color:#fff;background:linear-gradient(transparent 55%,rgba(0,0,0,.6));opacity:0;transition:.15s}
.kva-ava.editable:hover .kva-ava-cam{opacity:1}
.kva-me-info{min-width:0}
.kva-me-info>b{font-size:16px;display:block;line-height:1.2}
.kva-me-rows{display:flex;flex-direction:column;gap:2px;margin-top:3px}
.kva-me-rows span{font-size:12.5px;color:var(--kv-muted)}
.kva-me-rows .kva-tg{color:var(--kv-accent-2,var(--kv-accent));font-weight:700}
.kva-logout{width:100%;background:none;border:1px solid var(--kv-line);color:var(--kv-muted);border-radius:10px;padding:10px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit}
.kv-prof.has-ava{padding:0;overflow:hidden}
.kv-prof-ava{width:100%;height:100%;object-fit:cover;border-radius:50%}`;
    const s = document.createElement('style');
    s.id = 'kva-css'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  async function init() {
    injectCSS();
    if (!configured()) { ready = true; updateAll(); return; }
    if (LOCAL()) {
      try { if (ltoken()) await afterAuth(); else await tgInitData(); } catch (e) {}
      ready = true; updateAll(); return;
    }
    try {
      const c = await client();
      const s = await c.auth.getSession();
      if (s && s.data && s.data.session) { await afterAuth(); }
      else { await tgInitData(); }               // в мини-аппе войдёт сам
      c.auth.onAuthStateChange((_e, sess) => {
        if (!sess) { user = null; profile = null; updateAll(); }
      });
    } catch (e) { /* нет сети или SDK, остаёмся гостем */ }
    ready = true;
    updateAll();
  }

  // режим Supabase активен (не локальный демо-бэкенд и ключи заполнены)
  const cloudOn = () => !LOCAL() && !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  // ---- контактные данные получателя ----
  // живут в профиле (облако), для гостя копия в localStorage, чтобы форма не терялась
  function contact() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('kv_contact') || '{}'); } catch (e) {}
    const p = profile || {};
    return {
      name: p.full_name || saved.name || '',
      phone: p.phone || saved.phone || '',
      email: p.email || saved.email || '',
      paczkomat: p.paczkomat || saved.paczkomat || ''
    };
  }
  async function saveContact(f) {
    localStorage.setItem('kv_contact', JSON.stringify(f));
    if (!user || !cloudOn()) return { ok: true, local: true };
    const c = await client();
    const patch = {
      full_name: (f.name || '').trim() || null,
      phone: (f.phone || '').trim() || null,
      email: (f.email || '').trim() || null,
      paczkomat: (f.paczkomat || '').trim() || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await c.from('profiles').update(patch).eq('id', user.id);
    if (error) {
      const m = (error.message || '').toLowerCase();
      if (m.includes('phone')) throw msg('takenPhone');
      if (m.includes('email')) throw msg('takenEmail');
      throw { message: error.message };
    }
    if (profile) Object.assign(profile, patch);
    return { ok: true };
  }

  // ---- бронь: пишем в Supabase с датой выдачи, остаток спишет триггер ----
  async function apiReserve(data) {
    if (!user) return false;
    if (LOCAL()) {
      try { await lapi('/reservations', { method: 'POST', body: JSON.stringify(data) }); return true; }
      catch (e) { return false; }
    }
    try {
      const c = await client();
      const { error } = await c.from('reservations').insert({
        user_id: user.id,
        telegram_id: (profile && profile.telegram_id) || null,
        kind: 'reserve', status: 'active',
        city: data.city, product_id: data.product_id,
        product_name: data.product_name || data.product_id,
        flavor: data.flavor || '', qty: data.qty || 1,
        reserve_date: data.reserve_date
      });
      return !error;
    } catch (e) { return false; }
  }
  async function apiMyReservations() {
    if (!user || !cloudOn()) return null;
    try {
      const c = await client();
      const { data, error } = await c.from('reservations').select('*')
        .eq('kind', 'reserve').order('created_at', { ascending: false }).limit(20);
      return error ? null : data;
    } catch (e) { return null; }
  }
  async function apiCancelReservation(id) {
    if (!user || !cloudOn()) return false;
    try {
      const c = await client();
      const { data, error } = await c.rpc('cancel_reservation', { p_id: id });
      return !error && !!data;
    } catch (e) { return false; }
  }

  // ---- заказ: состав структурой + снимок контактов, статус ведёт менеджер ----
  async function apiOrder(data) {
    if (!user) return false;
    if (LOCAL()) {
      try { await lapi('/orders', { method: 'POST', body: JSON.stringify(data) }); return true; }
      catch (e) { return false; }
    }
    try {
      const c = await client();
      const { error } = await c.from('orders').insert({
        user_id: user.id, city: data.city, items: data.items, sum: data.sum,
        delivery: data.delivery, address: data.address || null,
        contact: data.contact || null, status: 'new'
      });
      return !error;
    } catch (e) { return false; }
  }
  async function apiMyOrders() {
    if (!user || !cloudOn()) return null;
    try {
      const c = await client();
      const { data, error } = await c.from('orders').select('*')
        .order('created_at', { ascending: false }).limit(30);
      return error ? null : data;
    } catch (e) { return null; }
  }

  // ---- отзывы: читают все, писать можно только на купленный вкус (RLS) ----
  async function apiAllReviews() {
    if (!cloudOn()) return null;
    try {
      const c = await client();
      const { data, error } = await c.from('reviews')
        .select('product_id,flavor,product_name,author,stars,body,created_at,user_id')
        .order('created_at', { ascending: false }).limit(1000);
      return error ? null : data;
    } catch (e) { return null; }
  }
  async function apiMyReviews() {
    if (!user || !cloudOn()) return null;
    try {
      const c = await client();
      const { data, error } = await c.from('reviews').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false });
      return error ? null : data;
    } catch (e) { return null; }
  }
  async function apiReviewables() {
    if (!user || !cloudOn()) return null;
    try {
      const c = await client();
      const { data, error } = await c.rpc('my_reviewables');
      return error ? null : data;
    } catch (e) { return null; }
  }
  async function apiReview(r) {
    if (!user || !cloudOn()) return { error: 'login' };
    try {
      const c = await client();
      const { error } = await c.from('reviews').upsert({
        user_id: user.id, product_id: r.product_id, flavor: r.flavor || '',
        product_name: r.product_name || r.product_id, author: r.author || '',
        stars: r.stars || 5, body: r.body || '', updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,product_id,flavor' });
      return { error: error ? error.message : null };
    } catch (e) { return { error: String(e && e.message || e) }; }
  }
  function loggedIn() { return !!user; }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    init, signUp, signIn, signOut, openModal, decorateProfile,
    apiReserve, apiOrder, loggedIn, contact, saveContact,
    apiMyReservations, apiCancelReservation, apiMyOrders,
    apiAllReviews, apiMyReviews, apiReviewables, apiReview, cloudOn,
    isAdmin, refresh: afterAuth,
    _tgWidget: tgWidget,
    get user() { return user; }, get profile() { return profile; },
    get configured() { return configured(); }
  };
})();
