// Login by username, email or phone plus password.
// The front used to resolve the address from the login itself, which handed a stranger the
// customer's real email: guess the login, learn the address. The mapping and the password
// check now live on the server and only a session goes out.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const looksEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
const normPhone = (s: string) => (s || "").replace(/[^\d+]/g, "");

// Wrong answers allowed inside the window, per address and per login. A person who mistypes a
// password a few times is not affected; a script running through a dictionary is.
const WINDOW_MIN = 15;
const MAX_PER_IP = 20;
const MAX_PER_ID = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let b: Record<string, string>;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const identifier = (b.identifier || "").trim();
  const password = b.password || "";
  if (!identifier || !password) return json({ error: "errEmpty" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Password guessing. GoTrue rate limits by address, but the attempt is forwarded from here,
  // so it only ever sees this function and never the visitor. Failures are counted in the
  // database: the function runs in several copies, and a counter in memory would not survive
  // the second one. Both keys are checked, so neither one address nor one login can be ground
  // down, however the attempts are spread out.
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ipKey = "ip:" + ip, idKey = "id:" + identifier.toLowerCase();
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();

  async function attempts(key: string): Promise<number> {
    const { count } = await admin.from("auth_attempts")
      .select("id", { count: "exact", head: true }).eq("key", key).gte("at", since);
    return count || 0;
  }
  try {
    const [byIp, byId] = await Promise.all([attempts(ipKey), attempts(idKey)]);
    if (byIp >= MAX_PER_IP || byId >= MAX_PER_ID) return json({ error: "tooMany" }, 429);
  } catch { /* the counter is down: an honest visitor must still get in */ }

// Three separate exact queries. The identifier must not be spliced into an .or filter
  // string: a comma inside it closes the condition and appends another, which allowed
  // signing into someone else's account. With .eq the value stays a value.
  async function findEmail(column: string, value: string): Promise<string | null> {
    if (!value) return null;
    const { data } = await admin.from("profiles")
      .select("auth_email").eq(column, value).limit(1).maybeSingle();
    return (data?.auth_email as string) || null;
  }
  // A miss is written down before the answer goes out, so guessing a login costs the same as
  // guessing a password and neither can be run through unlimited.
  async function miss() {
    await admin.from("auth_attempts").insert([{ key: ipKey }, { key: idKey }]).then(() => {}, () => {});
    return json({ error: "badCreds" }, 401);
  }

  let email = await findEmail("username", identifier);
  if (!email) email = await findEmail("email", identifier);
  if (!email) email = await findEmail("phone", normPhone(identifier));
  if (!email && looksEmail(identifier)) email = identifier.toLowerCase();
  // Answer identically for "no such user" and "wrong password" so the set of existing
  // logins cannot be probed.
  if (!email) return await miss();

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return await miss();
  const session = await res.json();
  if (!session?.access_token) return await miss();

  // Whoever got in is not the one being guessed at: clear their counter and take the chance to
  // drop rows nobody will look at again.
  await admin.from("auth_attempts").delete().eq("key", idKey).then(() => {}, () => {});
  if (Math.random() < 0.1) {
    await admin.from("auth_attempts").delete()
      .lt("at", new Date(Date.now() - 3600_000).toISOString()).then(() => {}, () => {});
  }
  return json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
  });
});
