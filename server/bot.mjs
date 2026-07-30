import { BOT_TOKEN, sendMessage, sendPhoto, editMessage, answerCallback, tgCall, getUpdates, deleteWebhook, setMenuButton } from './tg.mjs';
import { tr, pickLang } from './i18n.mjs';

const SUPA = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const MINIAPP_URL = process.env.MINIAPP_URL || '';
const SHEETS = process.env.KV_SHEETS_CSV || '';
const JOBS_MS = Number(process.env.KV_JOBS_MS || 10000);
const MANAGERS = (process.env.KV_MANAGER_IDS || '5301671230').split(',').map(s => +s.trim()).filter(Boolean);
const ADMIN_URL = process.env.KV_ADMIN_URL || '';
const CITIES = ['katowice', 'gliwice', 'warszawa'];
const CITY_LABEL = { katowice: 'Katowice', gliwice: 'Gliwice', warszawa: 'Warszawa' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const enc = encodeURIComponent;

async function sb(method, path, body, extra) {
  const res = await fetch(SUPA + '/rest/v1/' + path, {
    method, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'User-Agent': 'katovape-bot/2.0', ...(extra || {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  if (!res.ok) throw new Error('supabase ' + res.status + ' ' + txt.slice(0, 200));
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}
const sbSelect = (t, q) => sb('GET', t + (q ? '?' + q : ''));
const sbInsert = (t, row) => sb('POST', t, row, { Prefer: 'return=representation' });
const sbUpdate = (t, q, patch) => sb('PATCH', t + '?' + q, patch, { Prefer: 'return=minimal' });
// то же, но возвращает изменённые строки: по ним видно, досталась задача нам или её
// уже забрал другой процесс
const sbClaim = (t, q, patch) => sb('PATCH', t + '?' + q, patch, { Prefer: 'return=representation' });
const sbUpsert = (t, rows, onConflict) => sb('POST', t + (onConflict ? '?on_conflict=' + onConflict : ''), rows, { Prefer: 'resolution=merge-duplicates,return=minimal' });
const sbRpc = (fn, args) => sb('POST', 'rpc/' + fn, args || {});

function warsaw() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date());
  const g = t => (parts.find(x => x.type === t) || {}).value || '';
  return { date: g('year') + '-' + g('month') + '-' + g('day'), hour: +g('hour'), minute: +g('minute') };
}
// дата в формате DD-MM-YYYY (из ISO YYYY-MM-DD)
const fmtDMY = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('-') : '';
function plusDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

// ---- проверки данных онбординга (те же правила, что во фронте) ----
function validName(s) { return (s || '').trim().split(/\s+/).filter(Boolean).length >= 2; }
function normPhone(s) {
  let d = (s || '').replace(/[^\d+]/g, '');
  if (/^\d{9}$/.test(d)) d = '+48' + d;      // 9 цифр без кода — польский номер
  if (/^48\d{9}$/.test(d)) d = '+' + d;
  return d;
}
const validPhone = s => /^\+\d{10,14}$/.test(s);
// то же правило, что на витрине (core.js validEmail): анкета в боте и оформление
// в мини-аппе не должны расходиться в том, какой адрес считается годным
const EMAIL_RE = /^[A-Za-z0-9]([A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const validEmail = s => {
  const v = (s || '').trim();
  return v.length <= 254 && !v.includes('..') && EMAIL_RE.test(v);
};
const normPaczko = s => (s || '').trim().toUpperCase().replace(/\s+/g, '');
const validPaczko = s => /^[A-Z]{3}\d{2,4}[A-Z]{0,2}$/.test(s);

// ---- состояние клиента в bot_users ----
// Любое сообщение боту значит, что человек его запустил и может получать рассылку.
// opted_in в payload не кладём: при вставке сработает значение по умолчанию.
async function rememberUser(f) {
  if (!f || !f.id) return;
  await sbUpsert('bot_users', {
    telegram_id: f.id, username: f.username || null,
    first_name: f.first_name || null, lang: f.language_code || null
  }, 'telegram_id');
}
async function botUser(id) {
  const r = await sbSelect('bot_users', 'telegram_id=eq.' + id + '&select=*&limit=1').catch(() => null);
  return (r && r[0]) || null;
}
async function setBotUser(id, patch) { await sbUpdate('bot_users', 'telegram_id=eq.' + id, patch).catch(() => {}); }
async function langOf(tg) {
  const r = await sbSelect('bot_users', 'telegram_id=eq.' + tg + '&select=lang&limit=1').catch(() => null);
  return pickLang(r && r[0] && r[0].lang);
}
// профиль уже заполнен (человек оформлялся через мини-апп) — тогда онбординг в боте не нужен
async function profileComplete(tgId) {
  const r = await sbSelect('profiles', 'telegram_id=eq.' + tgId + '&select=full_name,phone,email,paczkomat&limit=1').catch(() => null);
  const p = r && r[0];
  return !!(p && p.full_name && p.phone && p.email && p.paczkomat);
}

// ---- клавиатуры/шаги ----
function shopKb(lang) {
  return MINIAPP_URL ? { reply_markup: { inline_keyboard: [[{ text: tr(lang, 'shopBtn'), web_app: { url: MINIAPP_URL } }]] } } : {};
}
function sendWelcome(chat, lang) { return sendMessage(chat, tr(lang, 'welcome'), shopKb(lang)); }
function sendAgeGate(chat, lang) {
  return sendMessage(chat, tr(lang, 'ageGate'), { reply_markup: { inline_keyboard: [
    [{ text: tr(lang, 'ageYes'), callback_data: 'age:yes' }],
    [{ text: tr(lang, 'ageNo'), callback_data: 'age:no' }]
  ] } });
}
function askStep(chat, step, lang) {
  if (step === 'phone')
    return sendMessage(chat, tr(lang, 'askPhone'), { reply_markup: { keyboard: [[{ text: tr(lang, 'phoneBtn'), request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
  if (step === 'email') return sendMessage(chat, tr(lang, 'askEmail'), { reply_markup: { remove_keyboard: true } });
  if (step === 'city')
    return sendMessage(chat, tr(lang, 'askCity'), { reply_markup: { inline_keyboard: [CITIES.map(c => ({ text: CITY_LABEL[c], callback_data: 'city:' + c }))] } });
  if (step === 'paczkomat') return sendMessage(chat, tr(lang, 'askPaczko'), { reply_markup: { remove_keyboard: true } });
  return sendMessage(chat, tr(lang, 'askName'), { reply_markup: { remove_keyboard: true } });   // name
}

// ---- маршрутизация апдейтов ----
async function handleUpdate(u) {
  if (u.callback_query) { await handleCallback(u.callback_query).catch(() => {}); return; }
  const m = u.message; if (!m) return;
  if (!(m.chat && m.chat.type === 'private')) return;   // только личные чаты
  const f = m.from || {};
  await rememberUser(f).catch(() => {});
  let st = await botUser(f.id);
  const lang = pickLang((st && st.lang) || f.language_code);

  if (m.contact) { await onContact(m, st, lang).catch(() => {}); return; }
  if (!m.text) return;
  const text = m.text.trim();

  if (text.startsWith('/start')) {
    // возвращающийся клиент с уже заполненным профилем: не гоняем через онбординг заново
    if (!st || !st.age_ok || !st.onboarding_done) {
      if (await profileComplete(f.id)) { await setBotUser(f.id, { age_ok: true, onboarding_done: true, step: null }); st = Object.assign({}, st, { age_ok: true, onboarding_done: true }); }
    }
    if (!st || !st.age_ok) { await sendAgeGate(m.chat.id, lang); return; }
    if (!st.onboarding_done) { await sendMessage(m.chat.id, tr(lang, 'resume')); await askStep(m.chat.id, st.step || 'name', lang); return; }
    const param = (m.text.split(' ')[1] || '').trim();
    if (param.startsWith('res_')) { await handleReserveLink(m, param.slice(4), lang); return; }
    if (param === 'phone') { await askStep(m.chat.id, 'phone', lang); return; }
    await sendWelcome(m.chat.id, lang); return;
  }
  // менеджеру — ссылка на веб-панель (все действия там, из бота ассортиментом не правим)
  if (text === '/admin' && MANAGERS.includes(f.id) && ADMIN_URL) {
    await sendMessage(m.chat.id, tr(lang, 'adminPanel'), { reply_markup: { inline_keyboard: [[{ text: tr(lang, 'adminPanel'), web_app: { url: ADMIN_URL } }]] } });
    return;
  }
  // заказы менеджера: список кнопками, карточка и смена статуса прямо в боте
  if (text === '/reserves' || text === '/res') {
    if (!(await isManager(f.id))) return;
    const scr = await resScreen(f.id, 0, 'active');
    await sendMessage(m.chat.id, scr.text, { reply_markup: scr.markup });
    return;
  }
  if (text === '/orders') {
    if (!(await isManager(f.id))) return;
    const scr = await ordersScreen(f.id, 0, 'active');
    await sendMessage(m.chat.id, scr.text, { reply_markup: scr.markup });
    return;
  }
  // не подтвердил 18+ — гейт; не заполнил профиль — принимаем ответ шага
  if (!st || !st.age_ok) { await sendAgeGate(m.chat.id, lang); return; }
  if (!st.onboarding_done) { await onboardingAnswer(m, st, lang, text); return; }
  // онбординг пройден: обычный текст игнорируем, вход в магазин — кнопкой
}

async function handleCallback(q) {
  const f = q.from || {};
  const data0 = q.data || '';
  // Экраны заказов и броней отвечают на кнопку сами, с текстом результата. Отвечать тут
  // заранее нельзя: второй ответ Telegram уже игнорирует, и менеджер не увидит, что статус сменился.
  if (!data0.startsWith('o:') && !data0.startsWith('r:')) await answerCallback(q.id).catch(() => {});
  const chat = q.message && q.message.chat && q.message.chat.id; if (!chat) return;
  await rememberUser(f).catch(() => {});   // строка bot_users должна существовать до PATCH
  const st = await botUser(f.id);
  const lang = pickLang((st && st.lang) || f.language_code);
  const data = q.data || '';
  if (data === 'age:no') { await sendMessage(chat, tr(lang, 'ageDenied')); return; }
  if (data === 'age:yes') {
    if (st && st.onboarding_done) { await sendWelcome(chat, lang); return; }
    await setBotUser(f.id, { age_ok: true, step: 'name' });
    await sendMessage(chat, tr(lang, 'onbIntro'));
    await askStep(chat, 'name', lang);
    return;
  }
  if (data.startsWith('city:')) {
    if (!st || st.step !== 'city') return;
    const city = data.slice(5);
    if (!CITIES.includes(city)) return;
    await setBotUser(f.id, { city, step: 'paczkomat' });
    await askStep(chat, 'paczkomat', lang);
    return;
  }

  // ---- экраны заказов (только для менеджеров) ----
  // o:list:<страница>:<режим> | o:card:<id>:<режим> | o:set:<id>:<статус>:<режим>
  if (data.startsWith('o:')) {
    if (!(await isManager(f.id))) { await answerCallback(q.id, 'Нет доступа', true); return; }
    const mid = q.message && q.message.message_id;
    const [, kind, a, b, c] = data.split(':');
    if (kind === 'list') {
      await answerCallback(q.id).catch(() => {});
      const scr = await ordersScreen(f.id, Number(a) || 0, b || 'active');
      await editMessage(chat, mid, scr.text, { reply_markup: scr.markup });
      return;
    }
    if (kind === 'card') {
      await answerCallback(q.id).catch(() => {});
      const scr = await orderCard(f.id, a, b || 'active');
      await editMessage(chat, mid, scr.text, { reply_markup: scr.markup });
      return;
    }
    if (kind === 'set') {
      const note = await setOrderStatus(f.id, a, b, c || 'active');
      await answerCallback(q.id, note);
      const scr = await orderCard(f.id, a, c || 'active');
      await editMessage(chat, mid, scr.text, { reply_markup: scr.markup });
      return;
    }
  }

  // ---- экраны броней ----
  if (data.startsWith('r:')) {
    if (!(await isManager(f.id))) { await answerCallback(q.id, 'Нет доступа', true); return; }
    const mid = q.message && q.message.message_id;
    const [, kind, a, b, c] = data.split(':');
    if (kind === 'list') {
      await answerCallback(q.id).catch(() => {});
      const scr = await resScreen(f.id, Number(a) || 0, b || 'active');
      await editMessage(chat, mid, scr.text, { reply_markup: scr.markup });
      return;
    }
    if (kind === 'card') {
      await answerCallback(q.id).catch(() => {});
      const scr = await resCard(f.id, a, b || 'active');
      await editMessage(chat, mid, scr.text, { reply_markup: scr.markup });
      return;
    }
    if (kind === 'set') {
      const note = await setResStatus(f.id, a, b, c || 'active');
      await answerCallback(q.id, note);
      const scr = await resCard(f.id, a, c || 'active');
      await editMessage(chat, mid, scr.text, { reply_markup: scr.markup });
      return;
    }
  }
}

// шаги онбординга по порядку: имя -> телефон -> почта -> город -> почтомат
async function onboardingAnswer(m, st, lang, text) {
  const chat = m.chat.id, id = m.from.id, step = st.step || 'name';
  if (step === 'name') {
    if (!validName(text)) { await sendMessage(chat, tr(lang, 'badName')); return; }
    await setBotUser(id, { full_name: text.trim(), step: 'phone' });
    await askStep(chat, 'phone', lang); return;
  }
  if (step === 'phone') {
    const phone = normPhone(text);
    if (!validPhone(phone)) { await sendMessage(chat, tr(lang, 'badPhone')); return; }
    await setBotUser(id, { phone, step: 'email' });
    await askStep(chat, 'email', lang); return;
  }
  if (step === 'email') {
    if (!validEmail(text)) { await sendMessage(chat, tr(lang, 'badEmail')); return; }
    await setBotUser(id, { email: text.trim(), step: 'city' });
    await askStep(chat, 'city', lang); return;
  }
  if (step === 'city') { await askStep(chat, 'city', lang); return; }   // ждём кнопку города
  if (step === 'paczkomat') {
    const p = normPaczko(text);
    if (!validPaczko(p)) { await sendMessage(chat, tr(lang, 'badPaczko')); return; }
    await setBotUser(id, { paczkomat: p, step: null, onboarding_done: true });
    await sendMessage(chat, tr(lang, 'onbDone'), { reply_markup: { remove_keyboard: true } });
    await sendWelcome(chat, lang); return;
  }
}

// контакт кнопкой — только сам человек может прислать свой номер
async function onContact(m, st, lang) {
  const f = m.from || {}, c = m.contact || {}, chat = m.chat.id;
  if (c.user_id && Number(c.user_id) !== Number(f.id)) { await sendMessage(chat, tr(lang, 'phoneForeign')); return; }
  let phone = String(c.phone_number || '').replace(/[^\d+]/g, '');
  if (phone && phone[0] !== '+') phone = '+' + phone;
  if (!phone) { await sendMessage(chat, tr(lang, 'badPhone')); return; }
  // в онбординге контакт закрывает шаг телефона
  if (st && st.age_ok && !st.onboarding_done && st.step === 'phone') {
    await setBotUser(f.id, { phone, step: 'email' });
    await askStep(chat, 'email', lang); return;
  }
  // после онбординга — обновляем телефон и в bot_users, и в профиле
  await setBotUser(f.id, { phone });
  try { await sb('PATCH', 'profiles?telegram_id=eq.' + f.id, { phone, updated_at: new Date().toISOString() }, { Prefer: 'return=minimal' }); } catch (e) {}
  await sendMessage(chat, tr(lang, 'phoneSaved', { phone: esc(phone) }), { reply_markup: { remove_keyboard: true } });
}

// бронь диплинком t.me/<bot>?start=res_<id>_<yyyymmdd>_<city> (переработка сценария — Ф4)
async function handleReserveLink(m, rest, lang) {
  const f = m.from || {};
  const parts = rest.split('_');
  let city = 'katowice', dateRaw = null;
  if (parts.length >= 2) {
    city = parts.pop();
    if (parts.length > 1 && /^\d{8}$/.test(parts[parts.length - 1])) dateRaw = parts.pop();
  }
  const pid = parts.join('_');
  let name = pid;
  try {
    const p = await sbSelect('products', 'id=eq.' + encodeURIComponent(pid) + '&select=name&limit=1');
    if (p && p[0] && p[0].name) name = p[0].name;
  } catch {}
  if (dateRaw) {
    const today = warsaw().date;
    let date = dateRaw.slice(0, 4) + '-' + dateRaw.slice(4, 6) + '-' + dateRaw.slice(6, 8);
    if (date < today) date = today;
    if (date > plusDays(today, 7)) date = plusDays(today, 7);
    try {
      await sbInsert('reservations', {
        telegram_id: f.id, city, product_id: pid, product_name: name,
        kind: 'reserve', status: 'active', reserve_date: date,
        confirmed_at: new Date().toISOString()
      });
      await sbRpc('bump_demand', { p_product: pid, p_event: 'reserve' }).catch(() => {});
      await sendMessage(m.chat.id, tr(lang, 'resConfirmed', { name: esc(name), date: fmtDMY(date) }));
    } catch (e) {
      await sendMessage(m.chat.id, tr(lang, 'resFail'));
    }
  } else {
    await sbInsert('reservations', { telegram_id: f.id, city, product_id: pid, product_name: name, kind: 'notify', status: 'waiting' }).catch(() => {});
    await sbRpc('bump_demand', { p_product: pid, p_event: 'reserve' }).catch(() => {});
    await sendMessage(m.chat.id, tr(lang, 'resWaiting', { name: esc(name) }));
  }
}

// ---- доступ менеджеров: роль и город берём из таблицы admins ----
// Список меняется редко, а джобы ходят по нему часто, поэтому держим короткий кэш.
let adminsCache = { at: 0, rows: [] };
async function adminsList() {
  if (Date.now() - adminsCache.at < 60000) return adminsCache.rows;
  const rows = await sbSelect('admins', 'select=telegram_id,role,city').catch(() => null);
  if (rows) adminsCache = { at: Date.now(), rows };
  return adminsCache.rows;
}
// кому слать про город: владелец и разработчик получают всё, менеджер — только свой город.
// KV_MANAGER_IDS остаётся страховкой на случай пустой таблицы (первый запуск, сбой сети).
async function managersFor(city) {
  const rows = await adminsList();
  const ids = (rows || [])
    .filter(a => a.role === 'owner' || a.role === 'dev' || (a.role === 'manager' && a.city && a.city === city))
    .map(a => Number(a.telegram_id))
    .filter(Boolean);
  const uniq = [...new Set(ids)];
  return uniq.length ? uniq : MANAGERS;
}
async function adminOf(tgId) {
  const rows = await adminsList();
  return (rows || []).find(a => Number(a.telegram_id) === Number(tgId)) || null;
}
async function isManager(tgId) {
  if (MANAGERS.includes(Number(tgId))) return true;
  return !!(await adminOf(tgId));
}
// ---- заказы в боте: список кнопками, карточка заказа, смена статуса ----
// Менеджер города видит только свой город, владелец и разработчик — все.
const ORDER_PAGE = 6;
const ST_LABEL = { new: 'новый', confirmed: 'подтверждён', done: 'выдан', cancelled: 'отменён' };
// в сообщениях менеджеру способ получения писался кодом из базы («pickup»), а не по-русски
const DELIV_LABEL = { pickup: 'самовывоз', inpost: 'InPost', courier: 'курьер' };
const delivLine = o => (DELIV_LABEL[o.delivery] || o.delivery || '') + (o.address ? ', ' + o.address : '');
const PAY_LABEL = { paid: 'оплачен', pending: 'ждёт оплаты', unpaid: 'при выдаче', failed: 'оплата не прошла' };

async function cityFilterFor(tgId) {
  const me = await adminOf(tgId);
  return me && me.role === 'manager' && me.city ? me.city : null;
}

// список заказов страницами: каждая строка — кнопка, ведущая в карточку заказа
async function ordersScreen(tgId, page = 0, mode = 'active') {
  const onlyCity = await cityFilterFor(tgId);
  const statuses = mode === 'all' ? '' : '&status=in.(new,confirmed)';
  const rows = await sbSelect('orders',
    'select=id,city,sum,status,payment_status,contact,created_at' + statuses +
    (onlyCity ? '&city=eq.' + enc(onlyCity) : '') +
    '&order=id.desc&limit=' + (ORDER_PAGE + 1) + '&offset=' + (page * ORDER_PAGE)).catch(() => []);
  const list = (rows || []).slice(0, ORDER_PAGE);
  const hasMore = (rows || []).length > ORDER_PAGE;

  if (!list.length) {
    return { text: page ? 'Больше заказов нет.' : (mode === 'all' ? 'Заказов пока нет.' : 'Активных заказов нет.'),
      markup: { inline_keyboard: [[{ text: mode === 'all' ? '· Только активные ·' : '· Показать все ·', callback_data: 'o:list:0:' + (mode === 'all' ? 'active' : 'all') }]] } };
  }

  const kb = list.map(o => {
    const c = o.contact || {};
    return [{ text: '№' + o.id + ' · ' + (o.sum || 0) + ' zł · ' + (ST_LABEL[o.status] || o.status) +
      (c.name ? ' · ' + String(c.name).split(/\s+/)[0] : ''), callback_data: 'o:card:' + o.id + ':' + mode }];
  });
  const nav = [];
  if (page > 0) nav.push({ text: '‹ Назад', callback_data: 'o:list:' + (page - 1) + ':' + mode });
  if (hasMore) nav.push({ text: 'Дальше ›', callback_data: 'o:list:' + (page + 1) + ':' + mode });
  if (nav.length) kb.push(nav);
  kb.push([{ text: mode === 'all' ? '· Только активные ·' : '· Показать все ·', callback_data: 'o:list:0:' + (mode === 'all' ? 'active' : 'all') }]);

  const title = mode === 'all' ? 'Все заказы' : 'Активные заказы';
  return { text: '<b>' + title + '</b>' + (onlyCity ? ' · ' + esc(onlyCity) : '') +
    '\nВыберите заказ, чтобы посмотреть состав и сменить статус.', markup: { inline_keyboard: kb } };
}

// карточка одного заказа: состав, клиент, оплата и кнопки статусов
async function orderCard(tgId, id, mode = 'active') {
  const onlyCity = await cityFilterFor(tgId);
  const rows = await sbSelect('orders', 'id=eq.' + Number(id) +
    '&select=id,city,items,sum,status,payment_status,delivery,address,contact,comment,created_at,telegram_id').catch(() => []);
  const o = rows && rows[0];
  if (!o) return { text: 'Заказ не найден.', markup: { inline_keyboard: [[{ text: '‹ К списку', callback_data: 'o:list:0:' + mode }]] } };
  // менеджер чужого города не должен видеть карточку, даже зная номер
  if (onlyCity && o.city !== onlyCity) {
    return { text: 'Этот заказ относится к другому городу.', markup: { inline_keyboard: [[{ text: '‹ К списку', callback_data: 'o:list:0:' + mode }]] } };
  }

  const c = o.contact || {};
  const items = (o.items || []).map((x, i) => (i + 1) + ') ' +
    (typeof x === 'string' ? x : (x.name || x.id) + (x.flavor ? ', ' + x.flavor : '') + ' x' + (x.n || 1) +
      (x.sum ? ' = ' + x.sum + ' zł' : ''))).join('\n');
  const text = '<b>Заказ №' + o.id + '</b> · ' + esc(o.city) + '\n' +
    'Статус: <b>' + (ST_LABEL[o.status] || o.status) + '</b> · ' + (PAY_LABEL[o.payment_status] || o.payment_status) + '\n' +
    'Оформлен: ' + fmtDMY(o.created_at) + '\n\n' + esc(items) +
    '\n\nИтого: <b>' + (o.sum || 0) + ' zł</b>' +
    '\nПолучение: ' + esc(delivLine(o)) +
    (o.comment ? '\nКомментарий: ' + esc(o.comment) : '') +
    (c.name || c.phone ? '\n\nКлиент: ' + esc([c.name, c.phone, c.email].filter(Boolean).join(', ')) : '');

  const acts = [];
  if (o.status === 'new') acts.push({ text: 'Подтвердить', callback_data: 'o:set:' + o.id + ':confirmed:' + mode });
  if (o.status === 'new' || o.status === 'confirmed') {
    acts.push({ text: 'Выдан', callback_data: 'o:set:' + o.id + ':done:' + mode });
    acts.push({ text: 'Отменить', callback_data: 'o:set:' + o.id + ':cancelled:' + mode });
  }
  const kb = [];
  if (acts.length) kb.push(acts.slice(0, 2)), acts.length > 2 && kb.push(acts.slice(2));
  kb.push([{ text: '‹ К списку', callback_data: 'o:list:0:' + mode }]);
  return { text, markup: { inline_keyboard: kb } };
}

// смена статуса из бота: то же самое, что кнопки в панели, клиенту уходит уведомление джобой
async function setOrderStatus(tgId, id, status, mode) {
  const onlyCity = await cityFilterFor(tgId);
  const rows = await sbSelect('orders', 'id=eq.' + Number(id) + '&select=id,city,status').catch(() => []);
  const o = rows && rows[0];
  if (!o) return 'Заказ не найден.';
  if (onlyCity && o.city !== onlyCity) return 'Это заказ другого города.';
  if (!['confirmed', 'done', 'cancelled'].includes(status)) return 'Неизвестный статус.';
  try {
    await sbUpdate('orders', 'id=eq.' + Number(id), { status, updated_at: new Date().toISOString() });
    return 'Заказ №' + id + ': ' + (ST_LABEL[status] || status);
  } catch (e) { return 'Не удалось изменить статус.'; }
}

// ---- брони в боте: тот же вид, что у заказов ----
const RES_ST = { active: 'активна', notified: 'напомнили', done: 'выдана', cancelled: 'отменена', expired: 'просрочена', waiting: 'ждёт поступления' };

async function resScreen(tgId, page = 0, mode = 'active') {
  const onlyCity = await cityFilterFor(tgId);
  // active — то, что реально ждёт менеджера; all — вся история, включая заявки на поступление
  const filter = mode === 'all' ? '' : '&kind=eq.reserve&status=in.(active,notified)';
  const rows = await sbSelect('reservations',
    'select=id,city,product_name,product_id,flavor,qty,kind,status,reserve_date,reserve_time,telegram_id,created_at' + filter +
    (onlyCity ? '&city=eq.' + enc(onlyCity) : '') +
    '&order=id.desc&limit=' + (ORDER_PAGE + 1) + '&offset=' + (page * ORDER_PAGE)).catch(() => []);
  const list = (rows || []).slice(0, ORDER_PAGE);
  const hasMore = (rows || []).length > ORDER_PAGE;
  const swap = [{ text: mode === 'all' ? '· Только активные ·' : '· Показать все ·', callback_data: 'r:list:0:' + (mode === 'all' ? 'active' : 'all') }];

  if (!list.length) {
    return { text: page ? 'Больше броней нет.' : (mode === 'all' ? 'Броней пока нет.' : 'Активных броней нет.'),
      markup: { inline_keyboard: [swap] } };
  }
  const kb = list.map(r => [{
    text: '№' + r.id + ' · ' + String(r.product_name || r.product_id).slice(0, 22) +
      (r.reserve_date ? ' · ' + fmtDMY(r.reserve_date) + (r.reserve_time ? ' ' + r.reserve_time : '') : ' · заявка'),
    callback_data: 'r:card:' + r.id + ':' + mode
  }]);
  const nav = [];
  if (page > 0) nav.push({ text: '‹ Назад', callback_data: 'r:list:' + (page - 1) + ':' + mode });
  if (hasMore) nav.push({ text: 'Дальше ›', callback_data: 'r:list:' + (page + 1) + ':' + mode });
  if (nav.length) kb.push(nav);
  kb.push(swap);
  return { text: '<b>' + (mode === 'all' ? 'Все брони и заявки' : 'Активные брони') + '</b>' +
    (onlyCity ? ' · ' + esc(onlyCity) : '') + '\nВыберите бронь, чтобы посмотреть и отметить выдачу.',
    markup: { inline_keyboard: kb } };
}

async function resCard(tgId, id, mode = 'active') {
  const onlyCity = await cityFilterFor(tgId);
  const rows = await sbSelect('reservations', 'id=eq.' + Number(id) +
    '&select=id,city,product_name,product_id,flavor,qty,kind,status,reserve_date,reserve_time,comment,created_at,telegram_id,profiles(telegram_username,username,phone)').catch(() => []);
  const r = rows && rows[0];
  const back = [{ text: '‹ К списку', callback_data: 'r:list:0:' + mode }];
  if (!r) return { text: 'Бронь не найдена.', markup: { inline_keyboard: [back] } };
  if (onlyCity && r.city !== onlyCity) return { text: 'Эта бронь относится к другому городу.', markup: { inline_keyboard: [back] } };

  const p = r.profiles || {};
  const who = p.telegram_username ? '@' + p.telegram_username : (p.username || (r.telegram_id ? 'tg id ' + r.telegram_id : ''));
  const text = '<b>Бронь №' + r.id + '</b> · ' + esc(r.city) + '\n' +
    esc(r.product_name || r.product_id) + (r.flavor ? ', ' + esc(r.flavor) : '') + ' × ' + (r.qty || 1) + '\n' +
    'Статус: <b>' + (RES_ST[r.status] || r.status) + '</b>' +
    (r.kind === 'notify' ? ' (заявка на поступление)' : '') + '\n' +
    (r.reserve_date ? 'Выдача: ' + fmtDMY(r.reserve_date) + (r.reserve_time ? ' в ' + esc(r.reserve_time) : '') + '\n' : '') +
    'Оформлена: ' + fmtDMY(r.created_at) +
    (r.comment ? '\nКомментарий: ' + esc(r.comment) : '') +
    // телефон без имени тоже должен идти под заголовком «Клиент», иначе он повисает строкой ниже
    (who || p.phone ? '\n\nКлиент: ' + esc([who, p.phone].filter(Boolean).join(', ')) : '');

  const acts = [];
  if (r.kind === 'reserve' && (r.status === 'active' || r.status === 'notified')) {
    acts.push({ text: 'Выдана', callback_data: 'r:set:' + r.id + ':done:' + mode });
    acts.push({ text: 'Отменить', callback_data: 'r:set:' + r.id + ':cancelled:' + mode });
  }
  const kb = acts.length ? [acts, back] : [back];
  return { text, markup: { inline_keyboard: kb } };
}

async function setResStatus(tgId, id, status, mode) {
  const onlyCity = await cityFilterFor(tgId);
  const rows = await sbSelect('reservations', 'id=eq.' + Number(id) + '&select=id,city,status,kind').catch(() => []);
  const r = rows && rows[0];
  if (!r) return 'Бронь не найдена.';
  if (onlyCity && r.city !== onlyCity) return 'Это бронь другого города.';
  if (!['done', 'cancelled'].includes(status)) return 'Неизвестный статус.';
  try {
    // остаток вернёт триггер reservation_stock, если бронь отменяют
    await sbUpdate('reservations', 'id=eq.' + Number(id), { status });
    return 'Бронь №' + id + ': ' + (RES_ST[status] || status);
  } catch (e) { return 'Не удалось изменить статус.'; }
}

async function tgLoop() {
  await deleteWebhook().catch(() => {});
  let offset = 0;
  console.log('бот: long polling');
  for (;;) {
    try {
      const r = await getUpdates(offset, 25);
      if (r && r.ok && r.result) for (const u of r.result) { offset = u.update_id + 1; handleUpdate(u).catch(() => {}); }
      else if (r && r.ok === false) await sleep(2000);
    } catch { await sleep(3000); }
  }
}

async function confirmReservations() {
  const list = await sbSelect('reservations',
    'kind=eq.reserve&confirmed_at=is.null&select=id,product_name,reserve_date,reserve_time,telegram_id,profiles(telegram_id)').catch(() => []);
  for (const r of list || []) {
    const tg = r.telegram_id || (r.profiles && r.profiles.telegram_id);
    const when = fmtDMY(r.reserve_date) + (r.reserve_time ? ' ' + r.reserve_time : '');
    if (tg) { const lang = await langOf(tg); await sendMessage(tg, tr(lang, 'resConfirmed', { name: esc(r.product_name), date: when })).catch(() => {}); }
    await sbUpdate('reservations', 'id=eq.' + r.id, { confirmed_at: new Date().toISOString() }).catch(() => {});
  }
}

async function dayReminders() {
  const w = warsaw();
  if (w.hour < 10) return;
  const list = await sbSelect('reservations',
    'kind=eq.reserve&status=eq.active&day_notified_at=is.null&reserve_date=eq.' + w.date +
    '&select=id,product_name,city,telegram_id,profiles(telegram_id)').catch(() => []);
  for (const r of list || []) {
    const tg = r.telegram_id || (r.profiles && r.profiles.telegram_id);
    if (tg) { const lang = await langOf(tg); await sendMessage(tg, tr(lang, 'resReminder', { name: esc(r.product_name) })).catch(() => {}); }
    await sbUpdate('reservations', 'id=eq.' + r.id, { day_notified_at: new Date().toISOString(), status: 'notified' }).catch(() => {});
  }
}

async function expireReservations() {
  const w = warsaw();
  await sbUpdate('reservations',
    'kind=eq.reserve&status=in.(active,notified)&reserve_date=lt.' + w.date,
    { status: 'expired' }).catch(() => {});
}

// менеджеру — за час до времени брони (шлём один раз, флаг manager_reminded_at)
async function remindManagers() {
  const w = warsaw();
  const nowMin = w.hour * 60 + w.minute;
  const list = await sbSelect('reservations',
    'kind=eq.reserve&status=in.(active,notified)&manager_reminded_at=is.null&reserve_time=not.is.null&reserve_date=eq.' + w.date +
    '&select=id,product_name,reserve_time,city,telegram_id,profiles(telegram_username,username)').catch(() => []);
  for (const r of list || []) {
    const [rh, rm] = String(r.reserve_time).split(':').map(Number);
    const resMin = (rh || 0) * 60 + (rm || 0);
    if (nowMin < resMin - 60) continue;   // ещё больше часа до времени брони
    const p = r.profiles || {};
    const who = p.telegram_username ? '@' + p.telegram_username : (p.username || '');
    const text = 'Через час бронь: <b>' + esc(r.product_name) + '</b> на ' + esc(r.reserve_time) +
      ' (' + esc(r.city) + ')' + (who ? ', ' + esc(who) : '') + '.';
    for (const mid of await managersFor(r.city)) await sendMessage(mid, text).catch(() => {});
    await sbUpdate('reservations', 'id=eq.' + r.id, { manager_reminded_at: new Date().toISOString() }).catch(() => {});
  }
}

async function notifyOrders() {
  // pending (карта/checkout начаты, но не оплачены) менеджеру не показываем — только
  // оплату при выдаче (unpaid) и уже оплаченные онлайн (paid)
  const list = await sbSelect('orders',
    'manager_notified_at=is.null&payment_status=in.(unpaid,paid)&select=id,city,items,sum,delivery,address,contact,comment,payment_status,payment_provider,profiles(username,telegram_username,telegram_id)').catch(() => []);
  for (const o of list || []) {
    const items = (o.items || []).map((x, i) =>
      (i + 1) + ') ' + (typeof x === 'string' ? x : (x.name || x.id) + (x.flavor ? ', ' + x.flavor : '') + ' x' + (x.n || 1) + (x.sum ? ' = ' + x.sum + ' zl' : ''))).join('\n');
    const c = o.contact || {};
    const p = o.profiles || {};
    const who = [c.name, c.phone, c.email].filter(Boolean).join('\n');
    const tgLine = p.telegram_username ? '@' + p.telegram_username : (p.telegram_id ? 'tg id ' + p.telegram_id : (p.username || ''));
    const deliv = delivLine(o);
    const payLine = o.payment_status === 'paid'
      ? '\nОплачено онлайн (' + esc(o.payment_provider || 'stripe') + ')'
      : '\nОплата при выдаче';
    const text = '<b>Новый заказ №' + o.id + '</b> (' + esc(o.city) + ')\n' + esc(items) +
      '\nИтого: ' + (o.sum || 0) + ' zł' + payLine + '\nПолучение: ' + esc(deliv) +
      (o.comment ? '\nКомментарий: ' + esc(o.comment) : '') +
      (who ? '\n\nКлиент:\n' + esc(who) : '') + (tgLine ? '\nTelegram: ' + esc(tgLine) : '');
    // уведомление уходит менеджеру города заказа, а не всем менеджерам сразу
    for (const mid of await managersFor(o.city)) await sendMessage(mid, text).catch(() => {});
    await sbUpdate('orders', 'id=eq.' + o.id, { manager_notified_at: new Date().toISOString() }).catch(() => {});
  }
}

async function notifyOrderStatus() {
  // PostgREST не умеет сравнивать колонку с колонкой, поэтому отсеять уже оповещённые
  // фильтром нельзя. Без ограничения выборка растёт вместе с историей и джоба каждые
  // 10 секунд тянет весь архив заказов — берём только свежий хвост.
  const list = await sbSelect('orders',
    'status=in.(confirmed,done,cancelled)&select=id,status,client_notified_status,profiles(telegram_id)' +
    '&order=id.desc&limit=200').catch(() => []);
  for (const o of list || []) {
    if (o.client_notified_status === o.status) continue;
    const tg = o.profiles && o.profiles.telegram_id;
    if (tg) {
      const lang = await langOf(tg);
      let text, extra = {};
      if (o.status === 'confirmed') text = tr(lang, 'statusConfirmed', { id: o.id });
      else if (o.status === 'done') {
        text = tr(lang, 'statusDone', { id: o.id });
        // после выдачи — кнопка «Оставить отзыв», ведёт на форму в мини-аппе
        if (MINIAPP_URL) extra = { reply_markup: { inline_keyboard: [[{ text: tr(lang, 'reviewBtn'), web_app: { url: MINIAPP_URL + (MINIAPP_URL.includes('?') ? '&' : '?') + 'review=' + o.id } }]] } };
      } else text = tr(lang, 'statusCancelled', { id: o.id });
      await sendMessage(tg, text, extra).catch(() => {});
    }
    await sbUpdate('orders', 'id=eq.' + o.id, { client_notified_status: o.status }).catch(() => {});
  }
}

// «принят» клиенту — для заказов с оплатой при выдаче (unpaid); карточные примут после оплаты
async function notifyAccepted() {
  const list = await sbSelect('orders',
    'payment_status=eq.unpaid&client_notified_accepted=is.false&select=id,telegram_id,profiles(telegram_id)').catch(() => []);
  for (const o of list || []) {
    const tg = o.telegram_id || (o.profiles && o.profiles.telegram_id);
    if (tg) { const lang = await langOf(tg); await sendMessage(tg, tr(lang, 'orderAccepted', { id: o.id })).catch(() => {}); }
    await sbUpdate('orders', 'id=eq.' + o.id, { client_notified_accepted: true }).catch(() => {});
  }
}
// «оплачено» клиенту — для оплаченных онлайн заказов (paid проставляет webhook)
async function notifyPaid() {
  const list = await sbSelect('orders',
    'payment_status=eq.paid&client_notified_paid=is.false&select=id,telegram_id,profiles(telegram_id)').catch(() => []);
  for (const o of list || []) {
    const tg = o.telegram_id || (o.profiles && o.profiles.telegram_id);
    if (tg) { const lang = await langOf(tg); await sendMessage(tg, tr(lang, 'orderPaid', { id: o.id })).catch(() => {}); }
    await sbUpdate('orders', 'id=eq.' + o.id, { client_notified_paid: true }).catch(() => {});
  }
}

async function doBroadcasts() {
  // photo обязателен в выборке: без него бот не узнает о картинке и отправит только текст
  const list = await sbSelect('broadcasts', 'status=eq.pending&select=id,text,photo,city&order=id.asc').catch(() => []);
  for (const b of list || []) {
    // Забираем рассылку условием status=pending. Безусловный PATCH означал, что два
    // запущенных бота (перезапуск, второй сервер) оба считали её своей и слали дважды.
    const claimed = await sbClaim('broadcasts', 'id=eq.' + b.id + '&status=eq.pending', { status: 'sending' }).catch(() => null);
    if (!claimed || !claimed.length) continue;   // уже забрал кто-то другой
    // шлём всем, кто запускал бота: отписки нет, флаг opted_in не учитываем.
    // Если у рассылки задан город — только клиентам этого города (город из онбординга).
    const users = await sbSelect('bot_users',
      'select=telegram_id' + (b.city ? '&city=eq.' + enc(b.city) : '')).catch(() => []);
    let sent = 0, failed = 0, photoWarned = false;
    for (const u of users || []) {
      // фото Telegram иногда отклоняет (мелкая или битая картинка) — тогда шлём хотя бы текст
      let r = b.photo ? await sendPhoto(u.telegram_id, b.photo, b.text) : null;
      if (!r || !r.ok) {
        if (b.photo && r && !r.ok && !photoWarned) { photoWarned = true; console.error('рассылка: фото отклонено -', r.description || r.error); }
        r = await sendMessage(u.telegram_id, b.text);
      }
      if (r && r.ok) sent++; else failed++;   // 403 (заблокировал бота) просто считаем в failed
      await sleep(60);
    }
    await sbUpdate('broadcasts', 'id=eq.' + b.id, { status: 'done', sent, failed, sent_at: new Date().toISOString() }).catch(() => {});
  }
}
async function doSyncJobs() {
  const jobs = await sbSelect('sync_jobs', 'status=eq.pending&select=id&order=id.asc').catch(() => []);
  for (const j of jobs || []) {
    try { const n = await syncSheets(); await notifyRestocks(); await sbUpdate('sync_jobs', 'id=eq.' + j.id, { status: 'done', rows: n, done_at: new Date().toISOString() }).catch(() => {}); }
    catch (e) { await sbUpdate('sync_jobs', 'id=eq.' + j.id, { status: 'error', message: String(e.message || e), done_at: new Date().toISOString() }).catch(() => {}); }
  }
}
async function syncSheets() {
  if (!SHEETS) throw new Error('KV_SHEETS_CSV не задан (ассортимент правится в админке)');
  const res = await fetch(SHEETS, { redirect: 'follow' }); if (!res.ok) throw new Error('sheets ' + res.status);
  const rows = parseCSV(await res.text()); if (rows.length < 2) return 0;
  const head = rows[0].map(h => h.trim().toLowerCase()), ix = n => head.indexOf(n);
  const c = { city: ix('city'), category: ix('category'), id: ix('id'), name: ix('name'), brand: ix('brand'), flavor: ix('flavor'), price: ix('price'), qty: ix('qty'), nic: ix('nic') };
  const batch = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r], g = k => c[k] >= 0 ? (row[c[k]] || '').trim() : '', id = g('id'); if (!id) continue;
    batch.push({ id, city: g('city') || 'katowice', category: g('category'), name: g('name'), brand: g('brand'), flavor: g('flavor'), price: Number(g('price')) || null, qty: Number(g('qty')) || 0, nic: g('nic'), updated_at: new Date().toISOString() });
  }
  if (batch.length) {
    // Ярлык «Хит» и оптовые ступени задаются в панели, в таблице их нет. Upsert переписывает
    // строку целиком, и без этого шага каждый синк сбрасывал бы hit в false, а tiers в null:
    // менеджер ставил галочку, а она пропадала сама после ближайшей выгрузки.
    const keep = await sbSelect('products', 'select=id,city,hit,tiers&limit=10000').catch(() => null);
    if (keep) {
      const own = {};
      for (const r of keep) {
        const k = r.id + '::' + r.city;
        const o = own[k] || (own[k] = { hit: false, tiers: null });
        if (r.hit) o.hit = true;
        if (r.tiers && r.tiers.length) o.tiers = r.tiers;
      }
      for (const b of batch) {
        const o = own[b.id + '::' + b.city];
        if (o) { b.hit = o.hit; b.tiers = o.tiers; }
      }
    }
    await sbUpsert('products', batch, 'id,city,flavor');
  }
  return batch.length;
}
async function notifyRestocks() {
  const list = await sbRpc('restock_list').catch(() => []);
  for (const r of list || []) {
    if (r.telegram_id) { const lang = await langOf(r.telegram_id); await sendMessage(r.telegram_id, tr(lang, 'restock', { name: esc(r.product_name) })).catch(() => {}); }
    await sbUpdate('reservations', 'id=eq.' + r.id, { status: 'notified', notified_at: new Date().toISOString() }).catch(() => {});
  }
}
async function jobsLoop() {
  for (;;) {
    try {
      await confirmReservations();
      await dayReminders();
      await remindManagers();
      await expireReservations();
      await notifyOrders();
      await notifyOrderStatus();
      await notifyAccepted();
      await notifyPaid();
      await doBroadcasts();
      await doSyncJobs();
      await notifyRestocks();
    } catch {}
    await sleep(JOBS_MS);
  }
}

if (!(BOT_TOKEN && SUPA && KEY)) {
  console.error('bot.mjs: нужны TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY в .env');
  process.exit(1);
}
console.log('KatoVape bot (Supabase) стартовал, менеджеры: ' + MANAGERS.join(', '));
if (MINIAPP_URL) setMenuButton(MINIAPP_URL).then(r => console.log('menuButton:', r && r.ok ? 'ok' : JSON.stringify(r)));
tgLoop();
jobsLoop();
