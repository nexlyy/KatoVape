// Telegram login. The bot token lives only here and never reaches the browser.
// Handles both the website Login Widget (mode "widget") and the mini app (mode "initdata").
// After the signature checks out we find or create the user and return a one-time OTP that
// the front exchanges for a real session.
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

  // Find the account by telegram_id and take the OTP address from the profile itself.
  // Deriving it is unsafe: the synthetic mail domain changed over time, and on a mismatch
  // generateLink created a second empty account that the person then landed in.
  const { data: existing } = await admin.from("profiles")
    .select("id, auth_email, display_name")
    .eq("telegram_id", tgUser.id).maybeSingle();
  let userId = existing?.id as string | undefined;
  const email = existing?.auth_email || `tg_${tgUser.id}@telegram.katovape.pl`;

  // Create the user if this Telegram account is new. The username is made unique (tg_<id>)
  // and the real @username goes into its own column.
  // telegram_id is deliberately NOT passed in user_metadata: the profile trigger does not
  // trust it, since a client could forge it during an ordinary signUp. It is linked below.
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
    // 422 means the user already exists (a race), which is fine here.
    if (cErr && !String(cErr.message || "").toLowerCase().includes("already")) {
      return json({ error: "cannot create user" }, 500);
    }
    if (!userId) {
      const { data: u } = await admin.auth.admin.listUsers();
      userId = u?.users?.find((x) => x.email === email)?.id;
    }
  }

  // Only the server links Telegram, and only after the signature check.
  // The avatar comes from photo_url but never overwrites one the user uploaded; name and
  // username are filled in if the profile stayed empty after earlier failures.
  if (userId) {
    const { data: cur } = await admin.from("profiles")
      .select("avatar, display_name, username, full_name, phone, email, paczkomat, city").eq("id", userId).maybeSingle();
    // Data the bot collected during onboarding, stored under the same telegram_id.
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
    // Fill empty profile fields from onboarding; full_name and paczkomat have no unique index.
    if (!cur?.full_name && bu?.full_name) patch.full_name = bu.full_name;
    if (!cur?.paczkomat && bu?.paczkomat) patch.paczkomat = bu.paczkomat;
    // City from the questionnaire, so the mini app opens on the right one instead of whatever
    // the previous person left in this phone's storage.
    if (!cur?.city && bu?.city) patch.city = bu.city;
    await admin.from("profiles").update(patch).eq("id", userId);
    // Phone and email are unique: a separate request so a conflict cannot undo the link above.
    const contact: Record<string, unknown> = {};
    if (!cur?.phone && bu?.phone) contact.phone = bu.phone;
    if (!cur?.email && bu?.email) contact.email = bu.email;
    if (Object.keys(contact).length) {
      contact.updated_at = new Date().toISOString();
      await admin.from("profiles").update(contact).eq("id", userId);
    }
  }

  // Logging in through Telegram means the person reached the bot, so keep them on the
  // broadcast list. The bot marks dead ones opted_in=false on the first failure.
  await admin.from("bot_users").upsert({
    telegram_id: tgUser.id,
    username: tgUser.username,
    first_name: tgUser.first_name,
  }, { onConflict: "telegram_id" });

  // One-time OTP the front exchanges for a session.
  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (lErr || !link || !link.properties || !link.properties.email_otp) {
    return json({ error: "cannot start session" }, 500);
  }
  return json({ email, otp: link.properties.email_otp });
});
