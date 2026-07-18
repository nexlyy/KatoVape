// KatoVape: проверка входа через Telegram.
// Токен бота живёт только тут (секрет TELEGRAM_BOT_TOKEN), в браузер не попадает.
// Работает и для Login Widget на сайте (mode: "widget"), и для мини-аппа (mode: "initdata").
// Проверив подпись Telegram, находим или заводим пользователя и отдаём одноразовый OTP,
// который фронт меняет на настоящую сессию через verifyOtp.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const enc = new TextEncoder();
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}
async function hmac(keyBytes: Uint8Array, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const DAY = 86400;

// Login Widget: secret = SHA256(botToken), hash = HMAC(secret, data_check_string)
async function verifyWidget(payload: Record<string, unknown>, token: string) {
  const hash = String(payload.hash || "");
  const pairs = Object.keys(payload).filter((k) => k !== "hash").sort()
    .map((k) => `${k}=${payload[k]}`).join("\n");
  const secret = await sha256(enc.encode(token));
  const check = toHex(await hmac(secret, pairs));
  if (!safeEqual(check, hash)) return null;
  if (Number(payload.auth_date || 0) < Math.floor(Date.now() / 1000) - DAY) return null;
  return {
    id: Number(payload.id),
    username: payload.username ? String(payload.username) : null,
    first_name: payload.first_name ? String(payload.first_name) : null,
    photo_url: payload.photo_url ? String(payload.photo_url) : null,
  };
}

// WebApp initData: secret = HMAC("WebAppData", botToken), hash = HMAC(secret, data_check_string)
async function verifyInitData(initData: string, token: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  const pairs = [...params.entries()].filter(([k]) => k !== "hash").sort(([a], [b]) => a < b ? -1 : 1)
    .map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac(enc.encode("WebAppData"), token);
  const check = toHex(await hmac(secret, pairs));
  if (!safeEqual(check, hash)) return null;
  if (Number(params.get("auth_date") || 0) < Math.floor(Date.now() / 1000) - DAY) return null;
  const u = JSON.parse(params.get("user") || "{}");
  return {
    id: Number(u.id),
    username: u.username ? String(u.username) : null,
    first_name: u.first_name ? String(u.first_name) : null,
    photo_url: u.photo_url ? String(u.photo_url) : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return json({ error: "bot token not configured" }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  let tgUser = null;
  if (body.mode === "widget" && body.payload) tgUser = await verifyWidget(body.payload as Record<string, unknown>, token);
  else if (body.mode === "initdata" && typeof body.initData === "string") tgUser = await verifyInitData(body.initData, token);
  else return json({ error: "bad request" }, 400);

  if (!tgUser || !tgUser.id) return json({ error: "telegram signature invalid" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const email = `tg_${tgUser.id}@telegram.katovape.pl`;

  // если такого телеграм-пользователя ещё нет, заводим. username делаем гарантированно
  // уникальным (tg_<id>), настоящий @username кладём отдельным полем.
  // ВАЖНО: telegram_id НЕ передаём в user_metadata — триггер профиля ему не доверяет
  // (клиент может подделать при обычном signUp). Привязку ставим ниже сами.
  const { data: existing } = await admin.from("profiles").select("id").eq("telegram_id", tgUser.id).maybeSingle();
  let userId = existing?.id as string | undefined;
  if (!existing) {
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
  if (userId) {
    const patch: Record<string, unknown> = {
      telegram_id: tgUser.id,
      telegram_username: tgUser.username,
    };
    if (tgUser.photo_url) {
      const { data: cur } = await admin.from("profiles").select("avatar").eq("id", userId).maybeSingle();
      if (!cur?.avatar) patch.avatar = tgUser.photo_url;
    }
    await admin.from("profiles").update(patch).eq("id", userId);
  }

  // одноразовый OTP, который фронт обменяет на сессию (verifyOtp, type: magiclink)
  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (lErr || !link || !link.properties || !link.properties.email_otp) {
    return json({ error: "cannot start session" }, 500);
  }
  return json({ email, otp: link.properties.email_otp });
});
