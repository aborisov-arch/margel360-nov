import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { getIp, rateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function logAccess(
  enquiryId: string | null, tokenHash: string, ip: string, ua: string,
  action: "view" | "update" | "locked", success: boolean,
) {
  await sb.from("enquiry_edit_log").insert({
    enquiry_id: enquiryId, token_hash: tokenHash, ip, user_agent: ua, action, success,
  });
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = getIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const rl = rateLimit(`get:${ip}`, 10, 60_000);
  if (!rl.ok) return json({ error: "rate_limited" }, 429);

  let token: string | undefined;
  try { ({ token } = await req.json()); } catch { return json({ error: "bad_json" }, 400); }
  if (!token || typeof token !== "string") return json({ error: "missing_token" }, 400);

  const tokenHash = await sha256(token);

  const { data, error } = await sb
    .from("enquiries")
    .select("*")
    .eq("edit_token", token)
    .maybeSingle();

  if (error) {
    console.error("supabase error:", error);
    return json({ error: "server_error" }, 500);
  }
  if (!data) {
    await logAccess(null, tokenHash, ip, ua, "view", false);
    return json({ error: "not_found" }, 404);
  }

  if (data.edit_locked) {
    await logAccess(data.id, tokenHash, ip, ua, "view", false);
    return json({ error: "locked" }, 403);
  }

  if (data.token_expires_at && new Date(data.token_expires_at).getTime() < Date.now()) {
    await logAccess(data.id, tokenHash, ip, ua, "view", false);
    return json({ error: "expired" }, 410);
  }

  // Strip internal fields before returning. payment_tracking holds admin-only
  // bookkeeping notes (bank/cash/card) that the customer must not see.
  const { edit_token: _t, status: _s, payment_tracking: _pt, ...publicFields } = data;

  await logAccess(data.id, tokenHash, ip, ua, "view", true);
  return json({ enquiry: publicFields });
});
