// PostgREST access under service_role, shared by every edge function.
// service_role bypasses RLS, so it may only be used after the function has checked who is
// calling and computed the amount itself.
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";

export async function rest(method: string, path: string, body?: unknown, prefer = "return=representation") {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json", Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error("rest " + res.status + " " + txt.slice(0, 200));
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}

export async function userFromToken(auth: string | null): Promise<string | null> {
  const token = (auth || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: ANON, Authorization: "Bearer " + token },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  return (u && u.id) || null;
}

// Записать расход промокода. Делает это сервер сразу после того, как заказ лёг в таблицу:
// раньше расход отмечал браузер, и кто не отмечал, у того код не тратился, то есть лимиты
// «раз на человека» и «всего» держались только на честности покупателя.
export async function recordPromoUse(codes: string[], orderId: number | string, userId: string | null) {
  for (const code of codes || []) {
    try {
      await rest("POST", "rpc/promo_use_for", { p_code: code, p_order: orderId, p_user: userId }, "count=none");
    } catch { /* заказ уже создан, из-за счётчика его отменять нельзя */ }
  }
}

// Look up the profile by telegram_id so a mini-app order lands on the same account as the site.
export async function profileIdByTelegram(tgId: number): Promise<string | null> {
  try {
    const p = await rest("GET", "profiles?telegram_id=eq." + tgId + "&select=id&limit=1", undefined, "count=none");
    return Array.isArray(p) && p[0] ? p[0].id : null;
  } catch { return null; }
}
