import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { getIp, rateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Codes are generated from an unambiguous alphabet (no 0/O, no 1/I), so a
// real code can never contain 0, 1, I, or O. If we see any of those the
// customer mistyped — return a specific error so the UI can prompt for a
// retry rather than a generic "not found".
const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_RE = new RegExp(`^MG-[${ALPHA}]{4}-[${ALPHA}]{4}$`);
const CONFUSABLE_RE = /[01IO]/;

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = getIp(req);
  const rl = rateLimit(`dc-val:${ip}`, 20, 60_000);
  if (!rl.ok) return json({ valid: false, error: "rate_limited" }, 429);

  let payload: { code?: string };
  try { payload = await req.json(); } catch { return json({ valid: false, error: "bad_json" }, 400); }

  const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
  if (!code) return json({ valid: false, error: "invalid_format" });
  if (CONFUSABLE_RE.test(code)) {
    return json({ valid: false, error: "confusable_chars" });
  }
  if (!CODE_RE.test(code)) {
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
