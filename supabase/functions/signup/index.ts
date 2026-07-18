// KatoVape: регистрация по логину/почте/телефону + пароль.
// Клиентский auth.signUp отбраковывает синтетические адреса (валидация почты у GoTrue),
// поэтому аккаунт заводит сервер через service_role (admin.createUser), как и телеграм-вход.
// Проверив занятость логина, создаём подтверждённого пользователя и отдаём одноразовый OTP,
// который фронт меняет на сессию через verifyOtp. telegram_id тут не трогаем (ставит только
// телеграм-функция после проверки подписи).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const looksEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
const normPhone = (s: string) => (s || "").replace(/[^\d+]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const username = (b.username || "").trim();
  const password = b.password || "";
  const email = (b.email || "").trim();
  const phone = normPhone(b.phone || "");

  if (username.length < 3 || !/^[a-zA-Z0-9_.]+$/.test(username)) return json({ error: "errUser" }, 400);
  if (password.length < 6) return json({ error: "errPass" }, 400);
  if (email && !looksEmail(email)) return json({ error: "errEmail" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // занятость логина/почты/телефона (финальную гарантию дают уникальные индексы)
  const { data: av } = await admin.rpc("login_availability", {
    p_username: username, p_email: email || null, p_phone: phone || null,
  });
  const a = Array.isArray(av) ? av[0] : av;
  if (a) {
    if (a.username_taken) return json({ error: "takenUser" }, 409);
    if (a.email_taken) return json({ error: "takenEmail" }, 409);
    if (a.phone_taken) return json({ error: "takenPhone" }, 409);
  }

  // синтетический адрес на реальном TLD, чтобы был валиден и в auth.users
  const authEmail = email && looksEmail(email)
    ? email.toLowerCase()
    : "u_" + username.toLowerCase().replace(/[^a-z0-9_]/g, "") + "@users.katovape.pl";

  const { error: cErr } = await admin.auth.admin.createUser({
    email: authEmail,
    email_confirm: true,
    password,
    user_metadata: {
      username,
      email_real: email || null,
      phone: phone || null,
      display_name: username,
    },
  });
  if (cErr) {
    const m = String(cErr.message || "").toLowerCase();
    if (m.includes("already")) return json({ error: "takenUser" }, 409);
    return json({ error: "cannot create user" }, 500);
  }

  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: authEmail });
  if (lErr || !link?.properties?.email_otp) return json({ error: "cannot start session" }, 500);
  return json({ email: authEmail, otp: link.properties.email_otp });
});
