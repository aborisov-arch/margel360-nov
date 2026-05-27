import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { getIp, rateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const CODE_RE = /^MG-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = getIp(req);
  const rl = rateLimit(`dc-val:${ip}`, 20, 60_000);
  if (!rl.ok) return json({ valid: false, error: "rate_limited" }, 429);

  let payload: { code?: string };
  try { payload = await req.json(); } catch { return json({ valid: false, error: "bad_json" }, 400); }

  const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
  if (!code || !CODE_RE.test(code)) {
    return json({ valid: false, error: "invalid_format" });
  }

  const { data, error } = await sb
    .from("discount_codes")
    .select("code, percent, redeemed_at, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (error) { console.error(error); return json({ valid: false, error: "server_error" }, 500); }
  if (!data)                  return json({ valid: false, error: "not_found" });
  if (data.redeemed_at)       return json({ valid: false, error: "already_used" });
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return json({ valid: false, error: "expired" });
  }

  return json({ valid: true, percent: data.percent });
});
