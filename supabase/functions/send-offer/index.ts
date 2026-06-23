// One-click "Send offer". Admin-authenticated (Supabase JWT + is_admin() RPC,
// same gate as update-enquiry-admin). The browser builds the offer XLSX with
// the existing client-side ExcelJS code and POSTs it here as base64; we email
// the customer a branded cover note with the spreadsheet attached, then stamp
// offer_sent_at.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { renderOfferEmail } from "../_shared/offer-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDR    = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
const FROM_EMAIL   = FROM_ADDR.includes("<") ? FROM_ADDR : `Margel360 <${FROM_ADDR}>`;
const SITE_URL     = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://margel360.bg").replace(/\/$/, "");

// Authorization is delegated to the DB's public.is_admin() — the single
// source of truth, the same function the RLS policies use. No admin email
// list is duplicated in this file.

// CORS locked to the admin-panel origins (defense-in-depth; the real gate
// is the JWT + is_admin() check below). Unknown origins get the apex.
const ADMIN_ORIGINS = new Set(["https://margel360.bg", "https://www.margel360.bg"]);
function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ADMIN_ORIGINS.has(origin) ? origin : "https://margel360.bg",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Cap the attachment so a malformed/oversized payload can't blow up Resend.
const MAX_ATTACH_B64_LEN = 6_000_000; // ~4.5 MB decoded

const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  const sbUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);
  // Authorization gate — single-source is_admin() under the caller's
  // identity. Fail closed on any error.
  const { data: isAdmin, error: adminErr } = await sbUser.rpc("is_admin");
  if (adminErr || isAdmin !== true) return json({ error: "forbidden" }, 403);

  let payload: { id?: string; attachment_base64?: string; xlsx_base64?: string; filename?: string };
  try { payload = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const id = payload.id;
  // `attachment_base64` is canonical (the dashboard sends a PDF); the old
  // `xlsx_base64` name is accepted for cached pre-rename dashboard JS.
  const attachB64 = payload.attachment_base64 ?? payload.xlsx_base64 ?? "";
  if (!id || typeof id !== "string") return json({ error: "missing_id" }, 400);
  if (!attachB64 || typeof attachB64 !== "string") return json({ error: "missing_attachment" }, 400);
  if (attachB64.length > MAX_ATTACH_B64_LEN) return json({ error: "attachment_too_large" }, 413);
  // Reject anything that isn't plain base64 (data: prefix, whitespace, etc.).
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(attachB64)) return json({ error: "bad_attachment" }, 400);

  const { data: enq, error: loadErr } = await sbAdmin
    .from("enquiries")
    .select("id, full_name, email, preferred_date, event_type, guests, edit_token")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) { console.error(loadErr); return json({ error: "server_error" }, 500); }
  if (!enq) return json({ error: "not_found" }, 404);
  if (!enq.email) return json({ error: "no_customer_email" }, 422);

  // ASCII-only attachment filename. Some Resend / SMTP paths reject a
  // non-ASCII (Cyrillic) attachment name, so we don't pass the customer's
  // raw filename through — a fixed Latin name is fine for the attached PDF.
  const safeName = (payload.filename && /^[\w.\- ]+\.(pdf|xlsx)$/.test(payload.filename))
    ? payload.filename
    : "Margel360-oferta.pdf";

  let subject: string, html: string;
  try {
    ({ subject, html } = renderOfferEmail(enq, SITE_URL));
  } catch (e) {
    console.error("renderOfferEmail threw:", e);
    return json({ error: "render_failed", detail: String(e) }, 500);
  }

  let r: Response;
  try {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: enq.email,
        subject,
        html,
        attachments: [{ filename: safeName, content: attachB64 }],
      }),
    });
  } catch (e) {
    console.error("resend fetch threw:", e);
    return json({ error: "send_failed", detail: String(e) }, 502);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("resend failed:", r.status, t);
    // Surface the real Resend status + reason instead of a generic failure,
    // so the dashboard can show WHY (was hiding attachment/validation errors).
    return json({ error: "send_failed", resend_status: r.status, detail: t.slice(0, 600) }, 502);
  }

  const stamp = new Date().toISOString();
  const { error: upErr } = await sbAdmin.from("enquiries").update({ offer_sent_at: stamp }).eq("id", id);
  if (upErr) console.error("offer_sent_at stamp failed (email already sent):", upErr);

  return json({ ok: true, sent_to: enq.email, offer_sent_at: stamp });
});
