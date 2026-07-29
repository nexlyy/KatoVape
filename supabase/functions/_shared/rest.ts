// Обращения к PostgREST под service_role. Одна копия на все edge-функции: раньше этот
// же helper был отдельно в create-payment и create-checkout.
// service_role идёт мимо RLS, поэтому вызывать его можно только после того, как функция
// сама проверила, кто пришёл, и сама посчитала сумму.
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

// кто оформляет: достаём пользователя по его access-токену (тот же, что у supabase-js)
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

// профиль по telegram_id — чтобы заказ из мини-аппа лёг на тот же аккаунт, что и на сайте
export async function profileIdByTelegram(tgId: number): Promise<string | null> {
  try {
    const p = await rest("GET", "profiles?telegram_id=eq." + tgId + "&select=id&limit=1", undefined, "count=none");
    return Array.isArray(p) && p[0] ? p[0].id : null;
  } catch { return null; }
}
