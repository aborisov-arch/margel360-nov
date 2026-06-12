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
    .from("enquiries").select("id, full_name, email").eq("feedback_token", token).maybeSingle();
  if (lookupErr) { console.error(lookupErr); return json({ error: "server_error" }, 500); }
  if (!e) return json({ error: "not_found" }, 404);

  const { error: insErr } = await sb.from("event_feedback").insert({ enquiry_id: e.id, ...row });
  if (insErr) { console.error(insErr); return json({ error: "save_failed" }, 500); }

  // Issue a 3% discount code if this enquiry hasn't already received one.
  // Idempotent: re-submitting feedback returns the same code rather than
  // generating a new one each time.
  const code = await issueDiscountCode(e.id);
  const emailDelivered = await sendDiscountEmail(e.email, e.full_name, code);

  return json({ success: true, discount_code: code, discount_percent: 3, email_delivered: emailDelivered });
});

async function issueDiscountCode(enquiryId: string): Promise<string> {
  const { data: existing } = await sb
    .from("discount_codes").select("code").eq("issued_for_enquiry_id", enquiryId).maybeSingle();
  if (existing?.code) return existing.code;

  // Format: MG-XXXX-YYYY where each block is 4 chars from an unambiguous
  // alphabet (no 0/O, 1/I). 32^8 = 1.1 trillion combos, more than enough.
  const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const code = "MG-" +
      Array.from(bytes.slice(0, 4)).map(b => ALPHA[b % 32]).join("") + "-" +
      Array.from(bytes.slice(4, 8)).map(b => ALPHA[b % 32]).join("");
    const { error } = await sb.from("discount_codes").insert({
      code, percent: 3, issued_for_enquiry_id: enquiryId,
    });
    if (!error) return code;
    if (!/duplicate|unique/i.test(error.message ?? "")) {
      console.error("code insert failed:", error);
      throw new Error("code_insert_failed");
    }
  }
  throw new Error("code_collision");
}

async function sendDiscountEmail(to: string, fullName: string, code: string): Promise<boolean> {
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
  const FROM_ADDR = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
  const FROM = FROM_ADDR.includes("<") ? FROM_ADDR : `Margel360 <${FROM_ADDR}>`;
  if (!RESEND_KEY || !to) return false;

  // full_name originates from the public reservation form — escape before
  // interpolating into the email HTML.
  const esc = (s: string) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const first = esc((fullName || "").split(" ")[0] || fullName || "");
  const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
  const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const subject = `Вашата 3% отстъпка · код ${code}`;
  const html = `<!doctype html><html lang="bg"><body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
  <tr><td style="padding:32px 44px 24px;border-bottom:1px solid rgba(185,137,74,0.35);font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;color:#1A1815;text-transform:uppercase">
    Маргел&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em>
  </td></tr>
  <tr><td style="padding:40px 44px 32px">
    <p style="margin:0 0 8px;font:600 11px/1.2 ${SANS};letter-spacing:0.2em;color:#B9894A;text-transform:uppercase">Благодарим за впечатленията</p>
    <h1 style="margin:0 0 18px;font:400 36px/1.1 ${SERIF};color:#1A1815">${first}, вашата <em style="font-style:italic;color:#B9894A">отстъпка</em> ви очаква.</h1>
    <p style="margin:0 0 24px;font:16px/1.55 ${SANS};color:#2A2620">
      Като благодарност за отделеното време ви подаряваме <strong>3% отстъпка</strong> от наема на залата за следващото ви събитие при нас.
    </p>
    <div style="margin:0 0 28px;padding:22px;border:2px dashed #B9894A;background:#F6F1E8;text-align:center">
      <p style="margin:0 0 6px;font:600 11px/1.2 ${SANS};letter-spacing:0.18em;color:#7A7568;text-transform:uppercase">Вашият промо код</p>
      <p style="margin:0;font:600 26px/1.1 ${SERIF};letter-spacing:0.06em;color:#1A1815">${code}</p>
    </div>
    <p style="margin:0;font:13px/1.6 ${SANS};color:#7A7568">
      Въведете кода при следваща резервация на нашия сайт. Валиден за една година, еднократна употреба.
    </p>
  </td></tr>
  <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}">
    <strong style="color:#C9A86A;text-transform:uppercase;letter-spacing:0.16em">Маргел 360°</strong> · бул. Околовръстен път 155 · ет. 4 · София<br>
    <a href="mailto:360@margel.info" style="color:#F6F1E8;text-decoration:none">360@margel.info</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!r.ok) {
      console.error("discount email rejected:", r.status, await r.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("discount email failed:", err);
    return false;
  }
}
