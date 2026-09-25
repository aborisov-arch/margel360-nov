import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { financeGaps, type DrinkLine, type FinEvent } from "../_shared/finance-gaps.ts";

// Month-end reminder to fill in missing finance data (electricity bills,
// bottle purchase prices). Cron runs daily on the 28th–31st; the function
// only sends on the LAST day of the month (Sofia time) unless the body has
// {"force": true}. The list matches „Липсващи данни“ on admin/financials.html.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDR    = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
const FROM_EMAIL   = FROM_ADDR.includes("<") ? FROM_ADDR : `Margel360 <${FROM_ADDR}>`;
const OWNER_EMAILS = Deno.env.get("OWNER_EMAILS") ?? "";
const TEAM_EMAIL   = Deno.env.get("TEAM_EMAIL") ?? "";
// Shared with the other internal crons (Vault: team_digest_cron_secret).
const CRON_SECRET  = Deno.env.get("TEAM_DIGEST_CRON_SECRET") ?? "";
const FINANCE_URL  = "https://margel360.bg/admin/financials.html";

const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONTHS_BG = ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"];

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function sofiaDate(d: Date): string { return d.toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" }); }
function monthBg(m: string): string { const [y, mo] = m.split("-").map(Number); return `${MONTHS_BG[mo - 1]} ${y}`; }

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!CRON_SECRET) { console.error("TEAM_DIGEST_CRON_SECRET not configured"); return json({ error: "not_configured" }, 500); }
  if ((req.headers.get("x-cron-secret") ?? "") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const now = new Date();
  const today = sofiaDate(now);
  const nowMonth = today.slice(0, 7);
  const isLastDay = sofiaDate(new Date(now.getTime() + 86_400_000)).slice(0, 7) !== nowMonth;
  if (!isLastDay && body?.force !== true) return json({ skipped: "not_last_day_of_month", today });

  const recipients = [...new Set([...OWNER_EMAILS.split(","), ...TEAM_EMAIL.split(",")].map(s => s.trim()).filter(Boolean))];
  if (!recipients.length) return json({ error: "no_recipients" }, 500);

  const [fes, elec, exp, enq] = await Promise.all([
    sb.from("financial_events").select("id, month, event_date, customer_name, enquiry_id, drinks_cost_in_expenses, income_drinks_eur, pnl_drinks"),
    sb.from("monthly_electricity").select("month"),
    sb.from("financial_expenses").select("event_id").eq("category", "drinks"),
    sb.from("enquiries").select("id, full_name, drinks"),
  ]);
  const err = fes.error || elec.error || exp.error || enq.error;
  if (err) { console.error("load failed:", err); return json({ error: "load_failed" }, 500); }

  type Enq = { id: string; full_name: string | null; drinks: unknown };
  const enquiries = (enq.data ?? []) as Enq[];
  const gaps = financeGaps({
    events: (fes.data ?? []) as FinEvent[],
    today, nowMonth,
    electricityMonths: new Set(((elec.data ?? []) as { month: string }[]).map(r => String(r.month).slice(0, 7))),
    enquiryDrinks: new Map(enquiries.map(e => [e.id, (Array.isArray(e.drinks) ? e.drinks : []) as DrinkLine[]])),
    eventsWithDrinksExpense: new Set(((exp.data ?? []) as { event_id: string | null }[]).map(r => r.event_id).filter((id): id is string => !!id)),
    names: new Map(enquiries.map(e => [e.id, e.full_name ?? ""])),
  });
  if (!gaps.length) return json({ sent: 0, gaps: 0 });

  const byMonth = new Map<string, string[]>();
  gaps.forEach(g => byMonth.set(g.month, [...(byMonth.get(g.month) ?? []), g.text]));
  const months = [...byMonth.keys()].sort().reverse();

  const subject = `Финанси: ${gaps.length} липсващи ${gaps.length === 1 ? "запис" : "записа"} — край на ${monthBg(nowMonth)}`;
  const sections = months.map(m => `
    <h2 style="margin:18px 0 6px;font:500 13px/1.2 ${SANS};letter-spacing:0.14em;text-transform:uppercase;color:#B9894A">${esc(monthBg(m))}</h2>
    <ul style="margin:0;padding-left:18px;font:14px/1.6 ${SANS};color:#1A1815">${byMonth.get(m)!.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`).join("");
  const html = `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
  <tr><td style="padding:32px 44px 20px;border-bottom:1px solid rgba(185,137,74,0.35)">
    <div style="font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;text-transform:uppercase">Маргел&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em></div>
    <div style="margin-top:8px;font:400 28px/1.1 ${SERIF}">Липсващи <em style="font-style:italic;color:#B9894A">финансови данни</em></div>
    <div style="margin-top:4px;font:13px/1.5 ${SANS};color:#7A7568">Край на ${esc(monthBg(nowMonth))} · попълнете, за да са пълни разходите и печалбата.</div>
  </td></tr>
  <tr><td style="padding:8px 44px 28px">${sections}</td></tr>
  <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}">
    <a href="${FINANCE_URL}" style="color:#F6F1E8;text-decoration:none;font-weight:600">Отвори Финанси →</a><br>
    Автоматично напомняне · изпраща се в последния ден на месеца.
  </td></tr>
</table></td></tr></table></body></html>`;
  const text = `Липсващи финансови данни — край на ${monthBg(nowMonth)}\n\n`
    + months.map(m => `${monthBg(m)}\n${byMonth.get(m)!.map(t => `  - ${t}`).join("\n")}`).join("\n\n")
    + `\n\nОтвори Финанси: ${FINANCE_URL}\n`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: recipients, subject, html, text }),
  });
  if (!r.ok) { console.error("resend failed:", await r.text()); return json({ error: "send_failed" }, 502); }
  return json({ sent: recipients.length, gaps: gaps.length });
});
