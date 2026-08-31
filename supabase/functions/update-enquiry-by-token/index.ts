import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { getIp, rateLimitHit } from "../_shared/rate-limit.ts";
import { diffEnquiry, EDITABLE_FIELDS, EDIT_COUNT_CAP, lockedFieldChanges } from "../_shared/diff.ts";
import { validateField } from "../_shared/validate.ts";
import { weekdayPromoPercent } from "../_shared/weekday-promo.ts";
import { loadCatalog, repriceAddons, repriceDrinks } from "../_shared/catalog.ts";
import { effectiveVenuePrice } from "../_shared/seasonal-pricing.ts";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SHARED_SECRET") ?? "";

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

function pickAndValidate(
  changes: Record<string, unknown>,
): { ok: true; value: Record<string, unknown> } | { ok: false; field: string; error: string } {
  const out: Record<string, unknown> = {};
  for (const f of EDITABLE_FIELDS) {
    if (!(f in changes)) continue;
    const result = validateField(f, changes[f]);
    if (!result.ok) return { ok: false, field: f, error: result.error };
    out[f] = result.value;
  }
  return { ok: true, value: out };
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = getIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  if (!await rateLimitHit(sb, `update-enquiry:ip:${ip}`, 10, 60)) {
    return json({ error: "rate_limited" }, 429);
  }

  let payload: { token?: string; changes?: Record<string, unknown> };
  try { payload = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const token = payload.token;
  const changes = payload.changes ?? {};
  if (!token || typeof token !== "string") return json({ error: "missing_token" }, 400);

  const tokenHash = await sha256(token);

  // Load current state
  const { data: current, error: loadErr } = await sb
    .from("enquiries").select("*").eq("edit_token", token).maybeSingle();
  if (loadErr) { console.error(loadErr); return json({ error: "server_error" }, 500); }
  if (!current) {
    await logAccess(null, tokenHash, ip, ua, "update", false);
    return json({ error: "not_found" }, 404);
  }
  // Lifetime edit cap: a booking that burned all its edits is fully closed.
  if ((current.edit_count ?? 0) >= EDIT_COUNT_CAP) {
    await logAccess(current.id, tokenHash, ip, ua, "update", false);
    return json({ error: "locked" }, 403);
  }
  if (current.token_expires_at && new Date(current.token_expires_at).getTime() < Date.now()) {
    await logAccess(current.id, tokenHash, ip, ua, "update", false);
    return json({ error: "expired" }, 410);
  }

  // Enforce whitelist + per-field validation. Non-whitelisted fields are
  // silently dropped; malformed whitelisted fields reject the whole request.
  const picked = pickAndValidate(changes);
  if (!picked.ok) return json({ error: "invalid_field", field: picked.field, detail: picked.error }, 400);
  const patch = picked.value;
  if (!Object.keys(patch).length) return json({ error: "no_changes" }, 400);

  // Admin-locked (confirmed) booking: items-only mode. The lock protects the
  // date and guest count; add-ons/drinks/phone/notes stay editable (see
  // LOCKED_FROZEN_FIELDS in _shared/diff.ts).
  if (current.edit_locked) {
    const frozen = lockedFieldChanges(patch, current);
    if (frozen.length) {
      await logAccess(current.id, tokenHash, ip, ua, "locked", false);
      return json({ error: "locked_field", fields: frozen }, 403);
    }
  }

  // Reprice edited items from the catalog; items removed from the catalog
  // since booking are grandfathered against the stored enquiry (see
  // _shared/catalog.ts).
  if ("addons" in patch || "drinks" in patch) {
    let catalog;
    try {
      catalog = await loadCatalog(sb);
    } catch (e) {
      console.error("catalog load failed:", e);
      return json({ error: "server_error" }, 500);
    }
    if ("addons" in patch) {
      const r = repriceAddons(patch.addons as never[], catalog, (current.addons ?? []) as never[]);
      if (!r.ok) return json({ error: "invalid_field", field: "addons", detail: r.error }, 400);
      patch.addons = r.value;
    }
    if ("drinks" in patch) {
      const r = repriceDrinks(patch.drinks as never[], catalog, (current.drinks ?? []) as never[]);
      if (!r.ok) return json({ error: "invalid_field", field: "drinks", detail: r.error }, 400);
      patch.drinks = r.value;
    }
  }

  // Compute diff
  const diff = diffEnquiry(current, { ...current, ...patch });
  if (!diff.length) {
    await logAccess(current.id, tokenHash, ip, ua, "update", true);
    return json({ enquiry: current, diff: [] });
  }

  // Increment edit count, possibly lock
  const nextCount = (current.edit_count ?? 0) + 1;
  const willLock = nextCount >= EDIT_COUNT_CAP;
  const updateRow: Record<string, unknown> = {
    ...patch,
    edit_count: nextCount,
    last_edited_at: new Date().toISOString(),
    edit_locked: current.edit_locked || willLock, // never silently unlock an admin-locked booking
  };

  // The venue price follows the DATE (seasonal calendar) - re-stamp it
  // whenever the date changes. Event type is not editable, so current.event_id
  // is authoritative.
  // Only on a real date change - the edit page sends preferred_date on every save, and an unchanged date must never re-price a legacy (NULL-stamp) booking.
  if ("preferred_date" in patch && String(patch.preferred_date) !== String(current.preferred_date ?? "")) {
    updateRow.venue_price_eur = effectiveVenuePrice(String(current.event_id ?? ""), String(patch.preferred_date));
  }

  // Weekday promo follows the DATE. When the customer moves the event to a
  // different date, recompute the campaign discount - otherwise booking a
  // Monday and editing to a Saturday would keep the 20% (and vice versa a
  // legit move Tue->Wed would lose it). Only weekday-sourced discounts are
  // touched: a code-sourced discount (applied_discount_code set) is the
  // customer's own claimed code and stays as-is.
  if ("preferred_date" in patch && !current.applied_discount_code) {
    const pct = weekdayPromoPercent(String(patch.preferred_date));
    updateRow.applied_discount_percent = pct > 0 ? pct : null;
  }

  const { data: updated, error: upErr } = await sb
    .from("enquiries").update(updateRow).eq("edit_token", token).select("*").single();
  if (upErr) { console.error(upErr); return json({ error: "server_error" }, 500); }

  await logAccess(updated.id, tokenHash, ip, ua, "update", true);

  // Fire-and-forget the summary. Pass diff inline.
  const summaryUrl = `${SUPABASE_URL}/functions/v1/send-enquiry-summary`;
  fetch(summaryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "X-Internal-Secret": INTERNAL_SECRET,
    },
    body: JSON.stringify({ enquiry_id: updated.id, reason: "updated", diff }),
  }).catch(e => console.error("summary dispatch failed:", e));

  if (willLock) {
    await logAccess(updated.id, tokenHash, ip, ua, "locked", true);
  }

  // Scrub token + internal fields before returning — same set as
  // get-enquiry-by-token (feedback token, CRM pipeline/follow-up state).
  const {
    edit_token: _t, status: _s, payment_tracking: _pt,
    feedback_token: _ft, feedback_sent_at: _fs,
    pipeline_status: _ps, next_followup_at: _nf, edited_by_admin: _ea,
    ...publicFields
  } = updated;
  return json({ enquiry: publicFields, diff, locked: willLock });
});
