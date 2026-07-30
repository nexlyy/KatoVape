// Registration by username, email or phone plus password.
// The client-side auth.signUp rejects synthetic addresses, so the account is created by the
// server through service_role, as with the Telegram login. After the availability check we
// create a confirmed user and return a one-time OTP.
// telegram_id is untouched here: only the Telegram function sets it, after verifying a signature.
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
  if (password.length < 8) return json({ error: "errPass" }, 400);
  if (email && !looksEmail(email)) return json({ error: "errEmail" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Availability check; the unique indexes give the final guarantee.
  const { data: av } = await admin.rpc("login_availability", {
    p_username: username, p_email: email || null, p_phone: phone || null,
  });
  const a = Array.isArray(av) ? av[0] : av;
  if (a) {
    if (a.username_taken) return json({ error: "takenUser" }, 409);
    if (a.email_taken) return json({ error: "takenEmail" }, 409);
    if (a.phone_taken) return json({ error: "takenPhone" }, 409);
  }

  // Synthetic address on a real TLD so auth.users accepts it.
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
