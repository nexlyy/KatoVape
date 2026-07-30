// KatoVape: проверка входа через Telegram.
// Токен бота живёт только тут (секрет TELEGRAM_BOT_TOKEN), в браузер не попадает.
// Работает и для Login Widget на сайте (mode: "widget"), и для мини-аппа (mode: "initdata").
// Проверив подпись Telegram, находим или заводим пользователя и отдаём одноразовый OTP,
// который фронт меняет на настоящую сессию через verifyOtp.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, json } from "../_shared/cors.ts";
import { verifyInitDataUser, verifyWidget } from "../_shared/telegram.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return json({ error: "bot token not configured" }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  let tgUser = null;
  if (body.mode === "widget" && body.payload) tgUser = await verifyWidget(body.payload as Record<string, unknown>, token);
  else if (body.mode === "initdata" && typeof body.initData === "string") tgUser = await verifyInitDataUser(body.initData, token);
  else return json({ error: "bad request" }, 400);

  if (!tgUser || !tgUser.id) return json({ error: "telegram signature invalid" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Аккаунт ищем по telegram_id, а адрес для OTP берём из самого профиля. Вычислять его
  // нельзя: домен синтетической почты со временем менялся, и на несовпадении generateLink
  // заводил второй пустой аккаунт, в который человек и попадал (без имени и аватара).
  const { data: existing } = await admin.from("profiles")
    .select("id, auth_email, display_name")
    .eq("telegram_id", tgUser.id).maybeSingle();
  let userId = existing?.id as string | undefined;
  const email = existing?.auth_email || `tg_${tgUser.id}@telegram.katovape.pl`;

  // если такого телеграм-пользователя ещё нет, заводим. username делаем гарантированно
  // уникальным (tg_<id>), настоящий @username кладём отдельным полем.
  // ВАЖНО: telegram_id НЕ передаём в user_metadata — триггер профиля ему не доверяет
  // (клиент может подделать при обычном signUp). Привязку ставим ниже сами.
  if (!userId) {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: {
        username: `tg_${tgUser.id}`,
        display_name: tgUser.first_name || tgUser.username || `tg_${tgUser.id}`,
      },
    });
    userId = created?.user?.id;
    // 422 = пользователь уже есть (гонка), это не ошибка для нас
    if (cErr && !String(cErr.message || "").toLowerCase().includes("already")) {
      return json({ error: "cannot create user" }, 500);
    }
    // добираем id, если создание попало в гонку
    if (!userId) {
      const { data: u } = await admin.auth.admin.listUsers();
      userId = u?.users?.find((x) => x.email === email)?.id;
    }
  }

  // привязку Telegram выставляет только сервер, после проверки подписи (доверенный путь).
  // аватар берём из photo_url телеги, но не затираем уже загруженный пользователем.
  // имя и логин дозаполняем, если профиль остался пустым после прежних сбоев.
  if (userId) {
    const { data: cur } = await admin.from("profiles")
      .select("avatar, display_name, username, full_name, phone, email, paczkomat, city").eq("id", userId).maybeSingle();
    // данные, собранные ботом при онбординге (хранятся у того же telegram_id)
    const { data: bu } = await admin.from("bot_users")
      .select("full_name, phone, email, paczkomat, city").eq("telegram_id", tgUser.id).maybeSingle();
    const patch: Record<string, unknown> = {
      telegram_id: tgUser.id,
      telegram_username: tgUser.username,
      updated_at: new Date().toISOString(),
    };
    if (tgUser.photo_url && !cur?.avatar) patch.avatar = tgUser.photo_url;
    if (!cur?.display_name) patch.display_name = tgUser.first_name || tgUser.username || `tg_${tgUser.id}`;
    if (!cur?.username) patch.username = `tg_${tgUser.id}`;
    // из онбординга дозаполняем пустые поля профиля; full_name/paczkomat без unique — сразу сюда
    if (!cur?.full_name && bu?.full_name) patch.full_name = bu.full_name;
    if (!cur?.paczkomat && bu?.paczkomat) patch.paczkomat = bu.paczkomat;
    // город из анкеты: по нему мини-апп откроется на нужном городе, а не на том,
    // что остался в памяти телефона от прошлого человека
    if (!cur?.city && bu?.city) patch.city = bu.city;
    await admin.from("profiles").update(patch).eq("id", userId);
    // телефон и почта уникальны: отдельным запросом, чтобы конфликт «занято» не сорвал привязку выше
    const contact: Record<string, unknown> = {};
    if (!cur?.phone && bu?.phone) contact.phone = bu.phone;
    if (!cur?.email && bu?.email) contact.email = bu.email;
    if (Object.keys(contact).length) {
      contact.updated_at = new Date().toISOString();
      await admin.from("profiles").update(contact).eq("id", userId);
    }
  }

  // вход через Telegram означает, что человек дошёл до бота: держим его в списке
  // рассылки. Мёртвые адреса бот сам пометит opted_in=false при первой неудаче.
  await admin.from("bot_users").upsert({
    telegram_id: tgUser.id,
    username: tgUser.username,
    first_name: tgUser.first_name,
  }, { onConflict: "telegram_id" });

  // одноразовый OTP, который фронт обменяет на сессию (verifyOtp, type: magiclink)
  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (lErr || !link || !link.properties || !link.properties.email_otp) {
    return json({ error: "cannot start session" }, 500);
  }
  return json({ email, otp: link.properties.email_otp });
});
