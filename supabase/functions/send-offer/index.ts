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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Cap the attachment so a malformed/oversized payload can't blow up Resend.
const MAX_ATTACH_B64_LEN = 6_000_000; // ~4.5 MB decoded

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

  const safeName = (payload.filename && /^[\p{L}\p{N}_.\- ]+\.(pdf|xlsx)$/u.test(payload.filename))
    ? payload.filename
    : "Оферта.pdf";

  const { subject, html } = renderOfferEmail(enq, SITE_URL);

  const r = await fetch("https://api.resend.com/emails", {
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
  if (!r.ok) {
    const t = await r.text();
    console.error("resend failed:", t);
    return json({ error: "send_failed" }, 502);
  }

  const stamp = new Date().toISOString();
  const { error: upErr } = await sbAdmin.from("enquiries").update({ offer_sent_at: stamp }).eq("id", id);
  if (upErr) console.error("offer_sent_at stamp failed (email already sent):", upErr);

  return json({ ok: true, sent_to: enq.email, offer_sent_at: stamp });
});
