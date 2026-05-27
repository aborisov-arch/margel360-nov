import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";

// Cron-triggered: finds enquiries whose preferred_date was yesterday in
// Europe/Sofia time and have not yet received a feedback email, then sends
// one and marks feedback_sent_at so we never re-send.

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL    = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
const SITE_URL      = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://margel360.bg").replace(/\/$/, "");

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDateBg(stored: string): string {
  return String(stored ?? "").replaceAll("/", ".");
}

// preferred_date is stored as "DD/MM/YYYY". Parse to a Date in Europe/Sofia
// (we treat the date as midnight Sofia local).
function parsePreferredDate(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s ?? "");
  if (!m) return null;
  const [, d, mo, y] = m;
  // Construct as if midnight Sofia time. Sofia is UTC+2 or +3 depending on DST.
  // For day-bucketing this offset doesn't matter — the date in Sofia is what
  // we're comparing, not a precise instant.
  return new Date(`${y}-${mo}-${d}T00:00:00+02:00`);
}

function sofiaToday(): Date {
  // Format current UTC time as Sofia date by shifting via Intl.
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === "year")!.value;
  const mo = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  return new Date(`${y}-${mo}-${d}T00:00:00+02:00`);
}

function isYesterdayInSofia(eventDate: Date): boolean {
  const todaySofia = sofiaToday();
  const diffDays = Math.round((todaySofia.getTime() - eventDate.getTime()) / 86_400_000);
  return diffDays === 1;
}

async function sendResend(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`resend_failed: ${t}`);
  }
}

function renderFeedbackEmail(e: { full_name: string; event_type: string; preferred_date: string; feedback_token: string }) {
  const first = (e.full_name || "").split(" ")[0] || e.full_name || "";
  const url = `${SITE_URL}/feedback.html?token=${e.feedback_token}`;
  const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
  const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const subject = `Как премина събитието ви в Маргел 360°? · ${fmtDateBg(e.preferred_date)}`;
  const html = `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Manrope:wght@300;400;500;600;700&display=swap');</style>
</head><body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
      <tr><td style="padding:32px 44px 24px;border-bottom:1px solid rgba(185,137,74,0.35);font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;color:#1A1815;text-transform:uppercase">
        Маргел&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em>
      </td></tr>
      <tr><td style="padding:40px 44px 32px">
        <h1 style="margin:0 0 12px;font:400 38px/1.1 ${SERIF};color:#1A1815">Как премина <em style="font-style:italic;color:#B9894A">събитието</em> ви?</h1>
        <p style="margin:0 0 24px;font:16px/1.55 ${SANS};color:#2A2620">
          Здравейте, ${esc(first)}. Благодарим, че празнувахте при нас на ${fmtDateBg(e.preferred_date)}. Бихме искали да чуем впечатленията ви — отнема по-малко от минута.
        </p>
        <p style="margin:0 0 24px;padding:14px 18px;border-left:3px solid #B9894A;background:#F6F1E8;font:14px/1.55 ${SANS};color:#1A1815">
          <strong style="color:#B9894A">Подарък от нас:</strong> за всяка попълнена анкета получавате <strong>3% отстъпка</strong> от наема на залата при следващото ви събитие при нас.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td>
          <a href="${url}" style="display:inline-block;padding:14px 28px;background:#1A1815;color:#F6F1E8;font:600 12px/1 ${SANS};letter-spacing:0.14em;text-transform:uppercase;text-decoration:none">
            Споделете впечатления
          </a>
        </td></tr></table>
        <p style="margin:0;font:12px/1.5 ${SANS};color:#7A7568">
          Анкетата отнема около минута. Отстъпката се валидира автоматично при следваща резервация.
        </p>
      </td></tr>
      <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}">
        <strong style="color:#C9A86A;text-transform:uppercase;letter-spacing:0.16em">Маргел 360°</strong> · бул. Околовръстен път 155 · ет. 4 · София<br>
        <a href="mailto:360@margel.info" style="color:#F6F1E8;text-decoration:none">360@margel.info</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { subject, html };
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  // Pull recent enquiries (window of last 7 days for resilience if a cron run
  // was missed) that have not yet been emailed.
  const { data, error } = await sb
    .from("enquiries")
    .select("id, full_name, email, event_type, preferred_date, feedback_token, feedback_sent_at")
    .is("feedback_sent_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("query failed:", error);
    return json({ error: "query_failed" }, 500);
  }

  const toSend = (data ?? []).filter(e => {
    const d = parsePreferredDate(e.preferred_date);
    return d && isYesterdayInSofia(d) && !!e.email;
  });

  let sent = 0;
  for (const e of toSend) {
    try {
      const { subject, html } = renderFeedbackEmail(e);
      await sendResend(e.email!, subject, html);
      await sb.from("enquiries").update({ feedback_sent_at: new Date().toISOString() }).eq("id", e.id);
      sent++;
    } catch (err) {
      console.error(`failed for enquiry ${e.id}:`, err);
    }
  }

  return json({ scanned: data?.length ?? 0, eligible: toSend.length, sent });
});
