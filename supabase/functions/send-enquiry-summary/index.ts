import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { renderCustomerEmail, renderOwnerEmail } from "../_shared/enquiry-email.ts";
import type { DiffEntry } from "../_shared/diff.ts";
import { isUuid } from "../_shared/validate.ts";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY      = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL      = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
const OWNER_EMAILS    = (Deno.env.get("OWNER_EMAILS") ?? "").split(",").map(s => s.trim()).filter(Boolean);
const SITE_URL        = Deno.env.get("PUBLIC_SITE_URL") ?? "https://margel360.bg";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SHARED_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type InternalBody = { enquiry_id: string; reason: "created" | "updated"; diff?: DiffEntry[] };
type WebhookBody  = { type: string; table: string; record: { id: string } };

async function sendResend(to: string[] | string, subject: string, body: { html?: string; text?: string }) {
  const payload = {
    from: FROM_EMAIL,
    to,
    subject,
    ...(body.html ? { html: body.html } : {}),
    ...(body.text ? { text: body.text } : {}),
  };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const errBody = await r.text();
    console.error("Resend error:", errBody);
    throw new Error(`resend_failed: ${errBody}`);
  }
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: InternalBody | WebhookBody;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  // Resolve enquiry_id + reason + diff from either shape.
  //
  // Two authenticated entry points:
  //   1. DB webhook (Supabase `INSERT on enquiries`): payload is
  //      { type:"INSERT", table:"enquiries", record:{ id, ... } }.
  //      We accept it only when shape matches exactly.
  //   2. Internal call from update-enquiry-by-token: payload is
  //      { enquiry_id, reason, diff? } and must carry the shared secret
  //      in the X-Internal-Secret header, so external callers cannot
  //      spoof fake "updated" emails to the owner.
  let enquiryId: string;
  let reason: "created" | "updated";
  let diff: DiffEntry[] | null = null;

  const isWebhookShape = body
    && (body as WebhookBody).type === "INSERT"
    && (body as WebhookBody).table === "enquiries"
    && isUuid((body as WebhookBody).record?.id);

  if (isWebhookShape) {
    enquiryId = (body as WebhookBody).record.id;
    reason = "created";
  } else if ("enquiry_id" in body) {
    if (!INTERNAL_SECRET || req.headers.get("x-internal-secret") !== INTERNAL_SECRET) {
      return json({ error: "unauthorised" }, 401);
    }
    const b = body as InternalBody;
    if (!isUuid(b.enquiry_id)) return json({ error: "bad_enquiry_id" }, 400);
    if (b.reason !== "created" && b.reason !== "updated") {
      return json({ error: "bad_reason" }, 400);
    }
    enquiryId = b.enquiry_id;
    reason = b.reason;
    diff = Array.isArray(b.diff) ? b.diff : null;
  } else {
    return json({ error: "bad_payload" }, 400);
  }

  const { data: enquiry, error } = await sb
    .from("enquiries").select("*").eq("id", enquiryId).maybeSingle();
  if (error || !enquiry) {
    console.error("enquiry fetch:", error);
    return json({ error: "not_found" }, 404);
  }

  // Owner email (to all configured addresses)
  if (OWNER_EMAILS.length) {
    const owner = renderOwnerEmail(enquiry, reason, diff);
    await sendResend(OWNER_EMAILS, owner.subject, { text: owner.text });
  }

  // Customer email
  if (enquiry.email) {
    const cust = renderCustomerEmail(enquiry, SITE_URL);
    await sendResend(enquiry.email, cust.subject, { html: cust.html });
  }

  return json({ success: true });
});
