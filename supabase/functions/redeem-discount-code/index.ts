import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { getIp, rateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const CODE_RE = /^MG-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = getIp(req);
  const rl = rateLimit(`dc-red:${ip}`, 10, 60_000);
  if (!rl.ok) return json({ error: "rate_limited" }, 429);

  let payload: { code?: string; enquiry_id?: string };
  try { payload = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
  const enquiryId = typeof payload.enquiry_id === "string" ? payload.enquiry_id : "";

  if (!CODE_RE.test(code)) return json({ error: "invalid_code" }, 400);
  if (!UUID_RE.test(enquiryId)) return json({ error: "invalid_enquiry_id" }, 400);

  // Atomic claim: only update rows that haven't been redeemed and aren't
  // expired. If no row was updated, the code is unavailable.
  const { data, error } = await sb
    .from("discount_codes")
    .update({
      redeemed_at: new Date().toISOString(),
      redeemed_for_enquiry_id: enquiryId,
    })
    .eq("code", code)
    .is("redeemed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("percent")
    .maybeSingle();

  if (error) { console.error(error); return json({ error: "server_error" }, 500); }
  if (!data)  return json({ error: "unavailable" }, 409);

  await sb.from("enquiries").update({
    applied_discount_code: code,
    applied_discount_percent: data.percent,
  }).eq("id", enquiryId);

  return json({ success: true, percent: data.percent });
});
