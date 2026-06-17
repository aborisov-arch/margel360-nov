import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { getIp, rateLimitHit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = getIp(req);
  if (!await rateLimitHit(sb, `fb-get:ip:${ip}`, 10, 60)) return json({ error: "rate_limited" }, 429);

  let token: string | undefined;
  try { ({ token } = await req.json()); } catch { return json({ error: "bad_json" }, 400); }
  if (!token || typeof token !== "string") return json({ error: "missing_token" }, 400);

  const { data: e, error } = await sb
    .from("enquiries")
    .select("id, full_name, event_type, preferred_date")
    .eq("feedback_token", token)
    .maybeSingle();

  if (error) { console.error(error); return json({ error: "server_error" }, 500); }
  if (!e)    return json({ error: "not_found" }, 404);

  const { data: existing } = await sb
    .from("event_feedback")
    .select("experience_rating, experience_comment, service_rating, service_comment, venue_rating, venue_comment, source, source_other, rebook_rating, rebook_comment, submitted_at")
    .eq("enquiry_id", e.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return json({ enquiry: e, existing: existing ?? null });
});
