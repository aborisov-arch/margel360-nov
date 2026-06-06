// Admin-side enquiry update. Mirrors update-enquiry-by-token but auth is
// the caller's Supabase JWT (admin session); bypasses EDIT_COUNT_CAP and
// edit_locked. Still fires send-enquiry-summary with reason="updated" so
// the diff email logic does not fork.
//
// Shared modules (validate.ts, diff.ts, cors.ts) are inlined here because
// the Supabase Edge Function deploy bundler doesn't currently follow
// `../_shared/*` imports through this project's deploy path.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY        = Deno.env.get("SUPABASE_ANON_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SHARED_SECRET") ?? "";

// Admin allowlist. Kept in sync with public.is_admin() in the DB.
// If the JWT email isn't in this list we 403, even if the user is
// authenticated. Without this gate, ANY signed-up Supabase user could
// rewrite enquiries via this endpoint.
const ADMIN_EMAILS = new Set([
  "aborisov@margel.info",
  "360@margel.info",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const EDITABLE_FIELDS = ["guests", "phone", "notes", "addons", "drinks", "preferred_date"] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

function diffEnquiry(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: { field: EditableField; before: unknown; after: unknown }[] = [];
  for (const f of EDITABLE_FIELDS) {
    if (JSON.stringify(before[f]) !== JSON.stringify(after[f])) {
      out.push({ field: f, before: before[f], after: after[f] });
    }
  }
  return out;
}

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const MAX_NOTES = 2000, MAX_PHONE = 30, MAX_GUESTS = 200, MAX_ADDON_PRICE = 20000, MAX_DRINK_QTY = 1000, MAX_NAME_LEN = 200;
type VR = { ok: true; value: unknown } | { ok: false; error: string };
function validateField(field: string, raw: unknown): VR {
  switch (field) {
    case "guests":
      if (!Number.isInteger(raw) || (raw as number) < 1 || (raw as number) > MAX_GUESTS)
        return { ok: false, error: `guests 1..${MAX_GUESTS}` };
      return { ok: true, value: raw };
    case "phone":
      if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_PHONE)
        return { ok: false, error: `phone <= ${MAX_PHONE}` };
      return { ok: true, value: raw };
    case "notes":
      if (raw === null) return { ok: true, value: null };
      if (typeof raw !== "string" || raw.length > MAX_NOTES)
        return { ok: false, error: `notes <= ${MAX_NOTES} or null` };
      return { ok: true, value: raw };
    case "preferred_date":
      if (typeof raw !== "string" || !DATE_RE.test(raw))
        return { ok: false, error: "preferred_date DD/MM/YYYY" };
      return { ok: true, value: raw };
    case "addons":
      if (!Array.isArray(raw)) return { ok: false, error: "addons array" };
      for (const a of raw) {
        if (!a || typeof a !== "object") return { ok: false, error: "addon object" };
        const o = a as Record<string, unknown>;
        if (typeof o.id !== "string" || o.id.length === 0 || o.id.length > 50) return { ok: false, error: "addon.id" };
        if (typeof o.name !== "string" || o.name.length > MAX_NAME_LEN) return { ok: false, error: "addon.name" };
        if (typeof o.price !== "number" || !Number.isFinite(o.price) || o.price < 0 || o.price > MAX_ADDON_PRICE) return { ok: false, error: "addon.price" };
        if (o.qty !== undefined && o.qty !== null) {
          if (!Number.isInteger(o.qty) || (o.qty as number) < 0 || (o.qty as number) > 999) return { ok: false, error: "addon.qty" };
        }
      }
      return { ok: true, value: raw };
    case "drinks":
      if (!Array.isArray(raw)) return { ok: false, error: "drinks array" };
      for (const d of raw) {
        if (!d || typeof d !== "object") return { ok: false, error: "drink object" };
        const o = d as Record<string, unknown>;
        if (typeof o.id !== "string" || o.id.length === 0 || o.id.length > 50) return { ok: false, error: "drink.id" };
        if (typeof o.name !== "string" || o.name.length > MAX_NAME_LEN) return { ok: false, error: "drink.name" };
        if (!Number.isInteger(o.qty) || (o.qty as number) < 0 || (o.qty as number) > MAX_DRINK_QTY) return { ok: false, error: "drink.qty" };
        if (o.price_eur !== null && o.price_eur !== undefined) {
          if (typeof o.price_eur !== "number" || !Number.isFinite(o.price_eur) || o.price_eur < 0) return { ok: false, error: "drink.price_eur" };
        }
      }
      return { ok: true, value: raw };
    default:
      return { ok: false, error: `unknown ${field}` };
  }
}

const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  const sbUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);
  // Admin allowlist gate. Authenticated ≠ authorized — must be on the
  // pre-approved email list.
  const email = (user.email || "").toLowerCase();
  if (!ADMIN_EMAILS.has(email)) return json({ error: "forbidden" }, 403);

  let payload: { id?: string; changes?: Record<string, unknown> };
  try { payload = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const id = payload.id;
  const changes = payload.changes ?? {};
  if (!id || typeof id !== "string") return json({ error: "missing_id" }, 400);

  const { data: current, error: loadErr } = await sbAdmin
    .from("enquiries").select("*").eq("id", id).maybeSingle();
  if (loadErr) { console.error(loadErr); return json({ error: "server_error" }, 500); }
  if (!current) return json({ error: "not_found" }, 404);

  const patch: Record<string, unknown> = {};
  for (const f of EDITABLE_FIELDS) {
    if (!(f in changes)) continue;
    const r = validateField(f, changes[f]);
    if (!r.ok) return json({ error: "invalid_field", field: f, detail: r.error }, 400);
    patch[f] = r.value;
  }
  if (!Object.keys(patch).length) return json({ error: "no_changes" }, 400);

  const diff = diffEnquiry(current, { ...current, ...patch });
  if (!diff.length) return json({ enquiry: current, diff: [] });

  const updateRow = {
    ...patch,
    last_edited_at: new Date().toISOString(),
    edited_by_admin: user.email ?? user.id,
  };
  const { data: updated, error: upErr } = await sbAdmin
    .from("enquiries").update(updateRow).eq("id", id).select("*").single();
  if (upErr) { console.error(upErr); return json({ error: "server_error" }, 500); }

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

  return json({ enquiry: updated, diff });
});
