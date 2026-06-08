// Public reservation form entry point. Anon role no longer has any
// direct access to the enquiries table — the form posts here and this
// function inserts via service_role.
//
// Why an edge function instead of anon INSERT-with-RETURNING:
// the old shape needed an anon SELECT policy on enquiries so the
// reservation form could read back its own id + edit_token. That
// policy was bulk-readable (anon could SELECT every row's
// edit_token = full takeover of every booking). Routing through a
// service-role insert removes the SELECT path entirely.
//
// This file inlines validate / cors / rate-limit because the Supabase
// edge-function bundler can't follow ../_shared imports for this
// project's deploy path. Keep in sync with the canonical copies under
// supabase/functions/_shared/*.ts.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SHARED_SECRET") ?? "";
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// CORS — restrict the public mutation endpoint to our origins. Wildcard
// would let any third-party site spam the form from a victim browser.
const ALLOWED_ORIGINS = new Set([
  "https://margel360.bg",
  "https://www.margel360.bg",
  "https://margell360.netlify.app",
]);
function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://margel360.bg";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? corsHeadersFor(req) : {}), "Content-Type": "application/json" },
  });
}

// ── Rate limit (per-isolate, MVP) ────────────────────────────────────
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  b.count += 1;
  return b.count <= limit;
}
function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? req.headers.get("cf-connecting-ip")
      ?? "unknown";
}

// ── Validation ───────────────────────────────────────────────────────
const MAX_NAME = 200, MAX_NOTES = 2000, MAX_PHONE = 30, MAX_GUESTS = 200, MAX_ADDON_PRICE = 20000, MAX_DRINK_QTY = 1000;
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const EVENT_IDS = ["evening","wedding","corp4","corp8","bday_day","bday_eve"];
// Values match the reservation form's EVENT_TIME_OF_DAY map ('eve' is
// the legacy short form; 'evening' kept as a defensive synonym for any
// future change to the form).
const TIME_OF_DAY = ["day","eve","evening"];
// Radio buttons on reservation.html: cash | transfer | card.
const PAYMENT_METHODS = ["cash","transfer","card","bank"];
const DISCOUNT_RE = /^MG-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;

// Strip CR/LF + null bytes from any user-supplied string. Defeats email
// header injection and binary-poisoning attempts in audit / Resend.
function safeStr(v: unknown, max: number): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[\r\n\0]/g, "").trim();
  if (cleaned.length === 0 || cleaned.length > max) return null;
  return cleaned;
}

type AddonIn = { id?: unknown; name?: unknown; price?: unknown; qty?: unknown };
type DrinkIn = { id?: unknown; name?: unknown; qty?: unknown; price_eur?: unknown };

function validateAddons(raw: unknown): { id: string; name: string; price: number; qty?: number }[] | null {
  if (!Array.isArray(raw)) return null;
  const out: { id: string; name: string; price: number; qty?: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const a = item as AddonIn;
    const id = safeStr(a.id, 50);
    const name = safeStr(a.name, MAX_NAME);
    const price = Number(a.price);
    if (!id || !name) return null;
    if (!Number.isFinite(price) || price < 0 || price > MAX_ADDON_PRICE) return null;
    const entry: { id: string; name: string; price: number; qty?: number } = { id, name, price };
    if (a.qty != null) {
      const qty = Number(a.qty);
      if (!Number.isInteger(qty) || qty < 0 || qty > 999) return null;
      entry.qty = qty;
    }
    out.push(entry);
  }
  return out;
}

function validateDrinks(raw: unknown): { id: string; name: string; qty: number; price_eur: number | null }[] | null {
  if (!Array.isArray(raw)) return null;
  const out: { id: string; name: string; qty: number; price_eur: number | null }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const d = item as DrinkIn;
    const id = safeStr(d.id, 50);
    const name = safeStr(d.name, MAX_NAME);
    if (!id || !name) return null;
    const qty = Number(d.qty);
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_DRINK_QTY) return null;
    let price_eur: number | null = null;
    if (d.price_eur != null) {
      const p = Number(d.price_eur);
      if (!Number.isFinite(p) || p < 0) return null;
      price_eur = p;
    }
    out.push({ id, name, qty, price_eur });
  }
  return out;
}

// ── Handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, req);

  // 20 submissions per IP per 10 minutes — comfortably above legit retry
  // patterns (typo fixes, browser refresh, drink qty edits) while still
  // blocking scripted floods on a warm isolate.
  if (!rateLimit(`submit-enquiry:${getIp(req)}`, 20, 10 * 60_000)) {
    return json({ error: "rate_limited" }, 429, req);
  }

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: "bad_json" }, 400, req); }

  // Whitelist + validate every field. Reject the whole request on any
  // malformed value rather than silently truncating.
  const full_name = safeStr(payload.full_name, MAX_NAME);
  const email_raw = safeStr(payload.email, MAX_NAME);
  const phone     = safeStr(payload.phone, MAX_PHONE);
  const event_type   = safeStr(payload.event_type, MAX_NAME);
  const event_id     = safeStr(payload.event_id, 50);
  const preferred_date = safeStr(payload.preferred_date, 20);
  const time_of_day  = safeStr(payload.time_of_day, 20);
  const arrival_time = payload.arrival_time == null ? null : safeStr(payload.arrival_time, 20);
  const payment_method = safeStr(payload.payment_method, 20);
  const notes_raw = payload.notes == null ? null : safeStr(payload.notes, MAX_NOTES);

  if (!full_name)   return json({ error: "invalid_field", field: "full_name" }, 400, req);
  if (!email_raw || !EMAIL_RE.test(email_raw)) return json({ error: "invalid_field", field: "email" }, 400, req);
  if (!phone)       return json({ error: "invalid_field", field: "phone" }, 400, req);
  if (!event_type)  return json({ error: "invalid_field", field: "event_type" }, 400, req);
  if (!event_id || !EVENT_IDS.includes(event_id)) return json({ error: "invalid_field", field: "event_id" }, 400, req);
  if (!preferred_date || !DATE_RE.test(preferred_date)) return json({ error: "invalid_field", field: "preferred_date" }, 400, req);
  if (!time_of_day || !TIME_OF_DAY.includes(time_of_day)) return json({ error: "invalid_field", field: "time_of_day" }, 400, req);
  if (!payment_method || !PAYMENT_METHODS.includes(payment_method)) return json({ error: "invalid_field", field: "payment_method" }, 400, req);

  let guests: number | null = null;
  if (payload.guests != null) {
    const g = Number(payload.guests);
    if (!Number.isInteger(g) || g < 1 || g > MAX_GUESTS) return json({ error: "invalid_field", field: "guests" }, 400, req);
    guests = g;
  }

  const addons = validateAddons(payload.addons ?? []);
  if (addons == null) return json({ error: "invalid_field", field: "addons" }, 400, req);
  const drinks = validateDrinks(payload.drinks ?? []);
  if (drinks == null) return json({ error: "invalid_field", field: "drinks" }, 400, req);

  let discount_code: string | null = null;
  if (payload.discount_code != null) {
    const dc = safeStr(payload.discount_code, 40)?.toUpperCase() ?? null;
    if (dc && DISCOUNT_RE.test(dc)) discount_code = dc;
    // Silently ignore malformed discount codes (don't 400 — the rest
    // of the booking is still valid).
  }

  const row = {
    full_name, email: email_raw, phone,
    event_type, event_id,
    preferred_date, time_of_day, arrival_time,
    guests, addons, drinks,
    payment_method, notes: notes_raw,
  };

  const { data: inserted, error: insErr } = await sb
    .from("enquiries").insert(row).select("id, edit_token, enquiry_number").single();
  if (insErr || !inserted) {
    console.error("submit-enquiry insert failed:", insErr);
    return json({ error: "server_error" }, 500, req);
  }

  // Atomic discount claim, best-effort. If the code is taken/expired we
  // still keep the booking — the customer just doesn't get the discount.
  let discount_percent: number | null = null;
  if (discount_code) {
    const { data: claimed } = await sb
      .from("discount_codes")
      .update({
        redeemed_at: new Date().toISOString(),
        redeemed_for_enquiry_id: inserted.id,
      })
      .eq("code", discount_code)
      .is("redeemed_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("percent")
      .maybeSingle();
    if (claimed?.percent != null) {
      discount_percent = claimed.percent as number;
      await sb.from("enquiries").update({
        applied_discount_code: discount_code,
        applied_discount_percent: discount_percent,
      }).eq("id", inserted.id);
    }
  }

  // Fire notification emails directly with the shared secret instead of
  // depending on a Supabase DB webhook (which historically had no auth).
  // Both calls are fire-and-forget so a slow Resend response can't block
  // the customer's reservation success page.
  const notifyUrl  = `${SUPABASE_URL}/functions/v1/notify-enquiry`;
  const summaryUrl = `${SUPABASE_URL}/functions/v1/send-enquiry-summary`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SERVICE_ROLE}`,
    "X-Internal-Secret": INTERNAL_SECRET,
  };
  fetch(notifyUrl, {
    method: "POST", headers,
    body: JSON.stringify({ record: { ...row, id: inserted.id, enquiry_number: inserted.enquiry_number, created_at: new Date().toISOString() } }),
  }).catch(e => console.error("notify-enquiry dispatch failed:", e));
  fetch(summaryUrl, {
    method: "POST", headers,
    body: JSON.stringify({ enquiry_id: inserted.id, reason: "created" }),
  }).catch(e => console.error("send-enquiry-summary dispatch failed:", e));

  return json({
    ok: true,
    id: inserted.id,
    enquiry_number: inserted.enquiry_number,
    // edit_token is returned so the form can render a one-click edit
    // link in the success summary. The customer also receives it via
    // email (the canonical channel).
    edit_token: inserted.edit_token,
    discount_percent,
  });
});
