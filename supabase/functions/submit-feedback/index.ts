import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { getIp, rateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function clampRating(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = getIp(req);
  const rl = rateLimit(`fb-sub:${ip}`, 5, 60_000);
  if (!rl.ok) return json({ error: "rate_limited" }, 429);

  let payload: { token?: string; venue?: unknown; staff?: unknown; food?: unknown; comment?: unknown };
  try { payload = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const token = payload.token;
  if (!token || typeof token !== "string") return json({ error: "missing_token" }, 400);

  const venue = clampRating(payload.venue);
  const staff = clampRating(payload.staff);
  const food  = clampRating(payload.food);
  if (venue === null || staff === null || food === null) {
    return json({ error: "invalid_ratings" }, 400);
  }

  const comment = typeof payload.comment === "string" ? payload.comment.trim().slice(0, 4000) : null;

  const { data: e, error: lookupErr } = await sb
    .from("enquiries").select("id").eq("feedback_token", token).maybeSingle();
  if (lookupErr) { console.error(lookupErr); return json({ error: "server_error" }, 500); }
  if (!e) return json({ error: "not_found" }, 404);

  const { error: insErr } = await sb.from("event_feedback").insert({
    enquiry_id: e.id,
    venue_rating: venue,
    staff_rating: staff,
    food_rating: food,
    comment: comment || null,
  });
  if (insErr) { console.error(insErr); return json({ error: "save_failed" }, 500); }

  return json({ success: true });
});
