// Login by username, email or phone plus password.
// The front used to resolve the address from the login itself, which handed a stranger the
// customer's real email: guess the login, learn the address. The mapping and the password
// check now live on the server and only a session goes out.
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
  const identifier = (b.identifier || "").trim();
  const password = b.password || "";
  if (!identifier || !password) return json({ error: "errEmpty" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

// Three separate exact queries. The identifier must not be spliced into an .or filter
  // string: a comma inside it closes the condition and appends another, which allowed
  // signing into someone else's account. With .eq the value stays a value.
  async function findEmail(column: string, value: string): Promise<string | null> {
    if (!value) return null;
    const { data } = await admin.from("profiles")
      .select("auth_email").eq(column, value).limit(1).maybeSingle();
    return (data?.auth_email as string) || null;
  }
  let email = await findEmail("username", identifier);
  if (!email) email = await findEmail("email", identifier);
  if (!email) email = await findEmail("phone", normPhone(identifier));
  if (!email && looksEmail(identifier)) email = identifier.toLowerCase();
  // Answer identically for "no such user" and "wrong password" so the set of existing
  // logins cannot be probed.
  if (!email) return json({ error: "badCreds" }, 401);

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return json({ error: "badCreds" }, 401);
  const session = await res.json();
  if (!session?.access_token) return json({ error: "badCreds" }, 401);
  return json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
  });
});
