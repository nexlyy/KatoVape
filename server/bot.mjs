import { BOT_TOKEN, sendMessage, tgCall, getUpdates, deleteWebhook, setMenuButton } from './tg.mjs';
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
const sbUpsert = (t, rows, onConflict) => sb('POST', t + (onConflict ? '?on_conflict=' + onConflict : ''), rows, { Prefer: 'resolution=merge-duplicates,return=minimal' });
const sbRpc = (fn, args) => sb('POST', 'rpc/' + fn, args || {});

function warsaw() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit'
  }).formatToParts(new Date());
  const g = t => (parts.find(x => x.type === t) || {}).value || '';
  return { date: g('year') + '-' + g('month') + '-' + g('day'), hour: +g('hour') };
}
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
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());
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
  const st = await botUser(f.id);
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
  // менеджеру — текущие заказы, только просмотр (действия в веб-админке)
  if (text === '/orders') { if (await isManager(f.id)) await handleOrders(m.chat.id); return; }
  // не подтвердил 18+ — гейт; не заполнил профиль — принимаем ответ шага
  if (!st || !st.age_ok) { await sendAgeGate(m.chat.id, lang); return; }
  if (!st.onboarding_done) { await onboardingAnswer(m, st, lang, text); return; }
  // онбординг пройден: обычный текст игнорируем, вход в магазин — кнопкой
}

async function handleCallback(q) {
  const f = q.from || {};
  await tgCall('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
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
      await sendMessage(m.chat.id, tr(lang, 'resConfirmed', { name: esc(name), date }));
    } catch (e) {
      await sendMessage(m.chat.id, tr(lang, 'resFail'));
    }
  } else {
    await sbInsert('reservations', { telegram_id: f.id, city, product_id: pid, product_name: name, kind: 'notify', status: 'waiting' }).catch(() => {});
    await sbRpc('bump_demand', { p_product: pid, p_event: 'reserve' }).catch(() => {});
    await sendMessage(m.chat.id, tr(lang, 'resWaiting', { name: esc(name) }));
  }
}

// менеджер — из env KV_MANAGER_IDS (владелец) или из таблицы admins (выдаёт владелец/разработчик в панели)
async function isManager(tgId) {
  if (MANAGERS.includes(Number(tgId))) return true;
  const r = await sbSelect('admins', 'telegram_id=eq.' + tgId + '&select=telegram_id&limit=1').catch(() => null);
  return !!(r && r[0]);
}
// текущие заказы для менеджера: только чтение, статусы меняются в веб-админке
async function handleOrders(chat) {
  const rows = await sbSelect('orders',
    'status=in.(new,confirmed)&order=created_at.desc&limit=20&select=id,city,sum,status,payment_status,contact').catch(() => []);
  if (!rows || !rows.length) { await sendMessage(chat, 'Текущих заказов нет.'); return; }
  let buf = '<b>Текущие заказы</b> (' + rows.length + '):\n\n';
  for (const o of rows) {
    const c = o.contact || {};
    const pay = o.payment_status === 'paid' ? 'оплачен' : (o.payment_status === 'pending' ? 'ждёт оплаты' : 'при выдаче');
    const line = '<b>№' + o.id + '</b> · ' + esc(o.city) + ' · ' + (o.sum || 0) + ' zł · ' + pay + ' · ' + esc(o.status) +
      (c.name ? '\n' + esc(c.name) + (c.phone ? ', ' + esc(c.phone) : '') : '') + '\n\n';
    if (buf.length + line.length > 3800) { await sendMessage(chat, buf); buf = ''; }
    buf += line;
  }
  if (buf.trim()) await sendMessage(chat, buf);
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
    const when = (r.reserve_date || '') + (r.reserve_time ? ' ' + r.reserve_time : '');
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

async function notifyOrders() {
  // pending (карта/checkout начаты, но не оплачены) менеджеру не показываем — только
  // оплату при выдаче (unpaid) и уже оплаченные онлайн (paid)
  const list = await sbSelect('orders',
    'manager_notified_at=is.null&payment_status=in.(unpaid,paid)&select=id,city,items,sum,delivery,address,contact,payment_status,payment_provider,profiles(username,telegram_username,telegram_id)').catch(() => []);
  for (const o of list || []) {
    const items = (o.items || []).map((x, i) =>
      (i + 1) + ') ' + (typeof x === 'string' ? x : (x.name || x.id) + (x.flavor ? ', ' + x.flavor : '') + ' x' + (x.n || 1) + (x.sum ? ' = ' + x.sum + ' zl' : ''))).join('\n');
    const c = o.contact || {};
    const p = o.profiles || {};
    const who = [c.name, c.phone, c.email].filter(Boolean).join('\n');
    const tgLine = p.telegram_username ? '@' + p.telegram_username : (p.telegram_id ? 'tg id ' + p.telegram_id : (p.username || ''));
    const deliv = (o.delivery || '') + (o.address ? ', ' + o.address : '');
    const payLine = o.payment_status === 'paid'
      ? '\nОплачено онлайн (' + esc(o.payment_provider || 'stripe') + ')'
      : '\nОплата при выдаче';
    const text = '<b>Новый заказ №' + o.id + '</b> (' + esc(o.city) + ')\n' + esc(items) +
      '\nИтого: ' + (o.sum || 0) + ' zł' + payLine + '\nПолучение: ' + esc(deliv) +
      (who ? '\n\nКлиент:\n' + esc(who) : '') + (tgLine ? '\nTelegram: ' + esc(tgLine) : '');
    for (const mid of MANAGERS) await sendMessage(mid, text).catch(() => {});
    await sbUpdate('orders', 'id=eq.' + o.id, { manager_notified_at: new Date().toISOString() }).catch(() => {});
  }
}

async function notifyOrderStatus() {
  const list = await sbSelect('orders',
    'status=in.(confirmed,done,cancelled)&select=id,status,client_notified_status,profiles(telegram_id)').catch(() => []);
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
  const list = await sbSelect('broadcasts', 'status=eq.pending&select=id,text&order=id.asc').catch(() => []);
  for (const b of list || []) {
    await sbUpdate('broadcasts', 'id=eq.' + b.id, { status: 'sending' }).catch(() => {});
    // шлём всем, кто запускал бота: отписки нет, флаг opted_in не учитываем
    const users = await sbSelect('bot_users', 'select=telegram_id').catch(() => []);
    let sent = 0, failed = 0;
    for (const u of users || []) {
      const r = await sendMessage(u.telegram_id, b.text);
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
  if (batch.length) await sbUpsert('products', batch, 'id,city,flavor');
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
