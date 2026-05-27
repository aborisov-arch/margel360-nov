import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { getIp, rateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const SOURCES = new Set(["friends", "social", "google", "other"]);

function rate4(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 4) return null;
  return n;
}

function trimOrNull(v: unknown, max = 4000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = getIp(req);
  const rl = rateLimit(`fb-sub:${ip}`, 5, 60_000);
  if (!rl.ok) return json({ error: "rate_limited" }, 429);

  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const token = p.token;
  if (typeof token !== "string" || !token) return json({ error: "missing_token" }, 400);

  const experience_rating = rate4(p.experience_rating);
  const service_rating    = rate4(p.service_rating);
  const venue_rating      = rate4(p.venue_rating);
  const rebook_rating     = rate4(p.rebook_rating);
  if (!experience_rating || !service_rating || !venue_rating || !rebook_rating) {
    return json({ error: "invalid_ratings" }, 400);
  }

  const source = typeof p.source === "string" && SOURCES.has(p.source) ? p.source : null;
  if (!source) return json({ error: "invalid_source" }, 400);

  const row = {
    experience_rating,
    experience_comment: trimOrNull(p.experience_comment),
    service_rating,
    service_comment:    trimOrNull(p.service_comment),
    venue_rating,
    venue_comment:      trimOrNull(p.venue_comment),
    source,
    source_other:       source === "other" ? trimOrNull(p.source_other, 500) : null,
    rebook_rating,
    rebook_comment:     trimOrNull(p.rebook_comment),
  };

  const { data: e, error: lookupErr } = await sb
    .from("enquiries").select("id").eq("feedback_token", token).maybeSingle();
  if (lookupErr) { console.error(lookupErr); return json({ error: "server_error" }, 500); }
  if (!e) return json({ error: "not_found" }, 404);

  const { error: insErr } = await sb.from("event_feedback").insert({ enquiry_id: e.id, ...row });
  if (insErr) { console.error(insErr); return json({ error: "save_failed" }, 500); }

  return json({ success: true });
});
