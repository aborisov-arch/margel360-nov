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
// validate / cors / rate-limit stay inlined here for historical reasons
// (kept in sync with the canonical copies under supabase/functions/_shared/*.ts).
// ../_shared imports do work — this file already pulls in weekday-promo.ts
// and catalog.ts below — as long as deploys use `--use-api`, which bundles
// _shared/ correctly (see CLAUDE.md's verify_jwt map for the deploy command).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { weekdayPromoPercent } from "../_shared/weekday-promo.ts";
import { loadCatalog, repriceAddons, repriceDrinks } from "../_shared/catalog.ts";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SHARED_SECRET") ?? "";
// Cloudflare Turnstile secret. When set, every submit must carry a valid
// turnstile_token; when unset the check is skipped (so a missing secret
// degrades to "no captcha" instead of blocking all bookings).
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
// Make the degraded state observable: if the secret is missing (rotation
// mistake / mis-deploy) the captcha check is skipped and only rate limiting
// protects the form. Warn loudly on cold start rather than throwing (which
// would block deploys before the secret is set).
if (!TURNSTILE_SECRET) {
  console.warn("[submit-enquiry] TURNSTILE_SECRET_KEY is unset — Turnstile verification is DISABLED; only rate limiting protects this endpoint.");
}
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// CORS wildcard — the endpoint is rate-limited and validates every
// field, so the origin restriction was pure defense-in-depth. The
// locked-down version was causing iOS Safari "Load failed" errors on
// the live margel360.bg form.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Rate limit (DB-backed, holds across isolates) ────────────────────
// public.rate_limit_hit upserts an atomic counter per key with a rolling
// window. Fails open on DB error so an outage can't block bookings.
async function rateLimitHit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await sb.rpc("rate_limit_hit", {
    p_key: key, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error) { console.error("rate_limit_hit failed:", error); return true; }
  return data === true;
}
function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? req.headers.get("cf-connecting-ip")
      ?? "unknown";
}

// ── Turnstile ────────────────────────────────────────────────────────
// Verifies the widget token with Cloudflare. Invalid/missing token →
// false. Infrastructure errors (siteverify unreachable, timeout, non-JSON
// response) FAIL CLOSED: when a captcha secret is configured an
// unverifiable token is treated as a failed challenge rather than waved
// through. A 10s timeout bounds a hung siteverify so the booking request
// returns a clean 403 instead of stalling until the platform kills it.
async function turnstileOk(token: unknown, ip: string): Promise<boolean> {
  if (typeof token !== "string" || !token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await r.json().catch(() => ({}));
    if (body.success !== true) {
      console.warn("turnstile rejected:", body["error-codes"]);
      return false;
    }
    return true;
  } catch (e) {
    console.error("turnstile verify failed (failing closed):", e);
    return false;
  }
}

// ── Validation ───────────────────────────────────────────────────────
const MAX_NAME = 200, MAX_NOTES = 2000, MAX_PHONE = 30, MAX_GUESTS = 200, MAX_ADDON_PRICE = 50000;
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
    // Absolute bound only - the real per-category caps (non-alcoholic 200 /
    // alcoholic 100) are enforced against the public.drinks catalog by
    // repriceDrinks() below via _shared/catalog.ts.
    if (!Number.isInteger(qty) || qty < 0 || qty > 200) return null;
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

// Wizard "Partners" step: array of partner uuids the customer marked
// interest in. Shape errors → 400; ids that don't resolve to an ACTIVE
// partner are silently dropped later (deactivated between page load and
// submit must never fail a booking).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PARTNER_IDS = 20;

function validatePartnerIds(raw: unknown): string[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_PARTNER_IDS) return null;
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || !UUID_RE.test(v)) return null;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

// ── Handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 20 submissions per IP per 10 minutes — comfortably above legit retry
  // patterns (typo fixes, browser refresh, drink qty edits) while still
  // blocking scripted floods.
  const ip = getIp(req);
  if (!await rateLimitHit(`submit-enquiry:ip:${ip}`, 20, 600)) {
    return json({ error: "rate_limited" }, 429);
  }

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  if (TURNSTILE_SECRET && !await turnstileOk(payload.turnstile_token, ip)) {
    return json({ error: "turnstile_failed" }, 403);
  }

  // Whitelist + validate every field. Reject the whole request on any
  // malformed value rather than silently truncating.
  const full_name = safeStr(payload.full_name, MAX_NAME);
  // 254 = RFC max email length; the client validator allows up to 254 too
  // (MAX_NAME=200 here used to reject valid long addresses the form accepted).
  const email_raw = safeStr(payload.email, 254);
  const phone     = safeStr(payload.phone, MAX_PHONE);
  const event_type   = safeStr(payload.event_type, MAX_NAME);
  const event_id     = safeStr(payload.event_id, 50);
  const preferred_date = safeStr(payload.preferred_date, 20);
  const time_of_day  = safeStr(payload.time_of_day, 20);
  const arrival_time = payload.arrival_time == null ? null : safeStr(payload.arrival_time, 20);
  const payment_method = safeStr(payload.payment_method, 20);
  const notes_raw = payload.notes == null ? null : safeStr(payload.notes, MAX_NOTES);
  // Optional marketing opt-in from the booking form. Only an explicit `true`
  // counts as consent (column defaults to false); anything else → false.
  const marketing_consent = payload.marketing_consent === true;
  // Language the customer used on the site — drives the language of the summary
  // email. Only 'en' is honoured; anything else (incl. absent) defaults to 'bg'.
  const lang = payload.lang === "en" ? "en" : "bg";

  if (!full_name)   return json({ error: "invalid_field", field: "full_name" }, 400);
  if (!email_raw || !EMAIL_RE.test(email_raw)) return json({ error: "invalid_field", field: "email" }, 400);
  if (!phone)       return json({ error: "invalid_field", field: "phone" }, 400);
  if (!event_type)  return json({ error: "invalid_field", field: "event_type" }, 400);
  if (!event_id || !EVENT_IDS.includes(event_id)) return json({ error: "invalid_field", field: "event_id" }, 400);
  if (!preferred_date || !DATE_RE.test(preferred_date)) return json({ error: "invalid_field", field: "preferred_date" }, 400);
  if (!time_of_day || !TIME_OF_DAY.includes(time_of_day)) return json({ error: "invalid_field", field: "time_of_day" }, 400);
  if (!payment_method || !PAYMENT_METHODS.includes(payment_method)) return json({ error: "invalid_field", field: "payment_method" }, 400);

  let guests: number | null = null;
  if (payload.guests != null) {
    const g = Number(payload.guests);
    if (!Number.isInteger(g) || g < 1 || g > MAX_GUESTS) return json({ error: "invalid_field", field: "guests" }, 400);
    guests = g;
  }

  const addons = validateAddons(payload.addons ?? []);
  if (addons == null) return json({ error: "invalid_field", field: "addons" }, 400);
  const drinks = validateDrinks(payload.drinks ?? []);
  if (drinks == null) return json({ error: "invalid_field", field: "drinks" }, 400);
  const partner_ids = validatePartnerIds(payload.partner_ids);
  if (partner_ids == null) return json({ error: "invalid_field", field: "partner_ids" }, 400);

  let discount_code: string | null = null;
  if (payload.discount_code != null) {
    const dc = safeStr(payload.discount_code, 40)?.toUpperCase() ?? null;
    if (dc && DISCOUNT_RE.test(dc)) discount_code = dc;
    // Silently ignore malformed discount codes (don't 400 — the rest
    // of the booking is still valid).
  }

  // Per-email cap: 10 bookings per address per 24h. The email lands in the
  // confirmation recipient field, so this bounds how much mail a single
  // address can be made to receive even with valid-looking submissions.
  if (!await rateLimitHit(`submit-enquiry:email:${email_raw.toLowerCase()}`, 10, 86400)) {
    return json({ error: "rate_limited" }, 429);
  }

  // Idempotency guard: if the same email + event + date was submitted within
  // the last 5 minutes, return that enquiry instead of inserting a duplicate.
  // Stops the "client saw an error but the row was actually created, so the
  // user retried" double-booking + double-email case (e.g. #1027/#1028).
  {
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: dup } = await sb
      .from("enquiries")
      .select("id, edit_token, enquiry_number")
      .eq("email", email_raw).eq("event_id", event_id).eq("preferred_date", preferred_date)
      .gte("created_at", since)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (dup) {
      return json({ ok: true, id: dup.id, enquiry_number: dup.enquiry_number, edit_token: dup.edit_token, discount_percent: null, deduped: true });
    }
  }

  // Reprice every item from the catalog tables - client-sent prices are
  // never trusted. Unknown/hidden items 400 (the shopper refreshes).
  // Placed after the rate-limit + idempotency checks (cheap, no DB catalog
  // read) so an already-rejected/deduped request never pays for the
  // catalog fetch.
  let catalog;
  try {
    catalog = await loadCatalog(sb);
  } catch (e) {
    console.error("catalog load failed:", e);
    return json({ error: "server_error" }, 500);
  }
  const repricedAddons = repriceAddons(addons, catalog);
  if (!repricedAddons.ok) return json({ error: "invalid_field", field: "addons", detail: repricedAddons.error }, 400);
  const repricedDrinks = repriceDrinks(drinks, catalog);
  if (!repricedDrinks.ok) return json({ error: "invalid_field", field: "drinks", detail: repricedDrinks.error }, 400);

  // Snapshot partner interest server-side: names/categories come from the
  // DB, not the client. Preserves the customer's selection order.
  let partner_interest: { id: string; name: string; category: string }[] = [];
  if (partner_ids.length) {
    const { data: partnerRows, error: pErr } = await sb
      .from("partners")
      .select("id, name, category")
      .in("id", partner_ids)
      .eq("active", true);
    if (pErr) console.error("partner lookup failed (continuing without):", pErr);
    const byId = new Map((partnerRows ?? []).map(p => [p.id as string, p]));
    partner_interest = partner_ids
      .filter(id => byId.has(id))
      .map(id => ({
        id,
        name: byId.get(id)!.name as string,
        category: byId.get(id)!.category as string,
      }));
  }

  const row = {
    full_name, email: email_raw, phone,
    event_type, event_id,
    preferred_date, time_of_day, arrival_time,
    guests, addons: repricedAddons.value, drinks: repricedDrinks.value,
    payment_method, notes: notes_raw,
    marketing_consent, lang,
    partner_interest,
  };

  const { data: inserted, error: insErr } = await sb
    .from("enquiries").insert(row).select("id, edit_token, enquiry_number").single();
  if (insErr || !inserted) {
    console.error("submit-enquiry insert failed:", insErr);
    return json({ error: "server_error" }, 500);
  }

  // Possible-duplicate advisory: if this customer (same email or same digits
  // of phone) already has a live (non-lost/archived) enquiry from the last
  // 90 days, drop a system note on the CRM thread so staff don't work the
  // same lead twice or mis-price. Best-effort, never blocks the booking.
  try {
    const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const phoneDigits = (phone ?? "").replace(/\D/g, "");
    let dupQ = sb.from("enquiries")
      .select("enquiry_number, email, phone")
      .neq("id", inserted.id)
      .not("pipeline_status", "in", "(lost,archived)")
      .gte("created_at", since90);
    dupQ = phoneDigits
      ? dupQ.or(`email.eq.${email_raw},phone.eq.${phone}`)
      : dupQ.eq("email", email_raw);
    const { data: priors } = await dupQ.order("created_at", { ascending: false }).limit(3);
    const others = (priors ?? []).filter(p =>
      (p.email && p.email.toLowerCase() === email_raw.toLowerCase()) ||
      (phoneDigits && (p.phone ?? "").replace(/\D/g, "") === phoneDigits));
    if (others.length) {
      const refs = others.map(p => `#${p.enquiry_number}`).join(", ");
      await sb.from("enquiry_notes").insert({
        enquiry_id: inserted.id,
        body: `⚠️ Възможен дубликат — този клиент има и: ${refs} (последните 90 дни).`,
        author_email: "system",
      });
    }
  } catch (e) {
    console.error("duplicate-check note failed (non-fatal):", e);
  }

  // Weekday promo vs discount code: the HIGHER percent wins (see
  // _shared/weekday-promo.ts - the authoritative campaign rule). We peek at
  // the code's percent WITHOUT claiming it first, so that when the weekday
  // promo wins the customer keeps their code for a future booking. The
  // claim itself stays atomic (redeemed_at IS NULL guard) - if someone
  // else claims the code between the peek and the claim, the claim just
  // returns nothing and the booking proceeds without the code discount.
  const weekday_percent = weekdayPromoPercent(preferred_date);
  let code_percent = 0;
  if (discount_code) {
    const { data: codeRow } = await sb
      .from("discount_codes")
      .select("percent")
      .eq("code", discount_code)
      .is("redeemed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    code_percent = (codeRow?.percent as number) ?? 0;
  }

  let discount_percent: number | null = null;
  if (weekday_percent > 0 && weekday_percent >= code_percent) {
    discount_percent = weekday_percent;
    const { error: promoErr } = await sb.from("enquiries").update({
      applied_discount_percent: weekday_percent,
    }).eq("id", inserted.id);
    if (promoErr) {
      console.error("weekday promo update failed:", promoErr);
      discount_percent = null;
    }
  } else if (discount_code && code_percent > 0) {
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
      const { error: codeErr } = await sb.from("enquiries").update({
        applied_discount_code: discount_code,
        applied_discount_percent: discount_percent,
      }).eq("id", inserted.id);
      if (codeErr) console.error("discount code update failed:", codeErr);
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
