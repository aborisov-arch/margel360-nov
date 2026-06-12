import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";

// Cron-triggered Monday mornings: one KPI email to the owners covering the
// past 7 days:
//   - new enquiries (created_at), split by event type
//   - won / lost (enquiry_status_log transitions to confirmed / lost)
//   - offers sent (offer_sent_at)
//   - events held (confirmed/completed with preferred_date in the window)
//   - feedback received (event_feedback.submitted_at) + average ratings
//   - live pipeline snapshot (current stage counts)
//   - events confirmed for the next 14 days
// Won/lost only counts transitions AFTER the status-log shipped
// (migration 20260613120000) — earlier history was never timestamped.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDR    = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
const FROM_EMAIL   = FROM_ADDR.includes("<") ? FROM_ADDR : `Margel360 <${FROM_ADDR}>`;
const OWNER_EMAILS = Deno.env.get("OWNER_EMAILS") ?? "";
const TEAM_EMAIL   = Deno.env.get("TEAM_EMAIL") ?? "";
// INTENTIONALLY shared with the other internal cron functions
// (Vault: team_digest_cron_secret) — rotate them together.
const CRON_SECRET  = Deno.env.get("TEAM_DIGEST_CRON_SECRET") ?? "";

const WINDOW_DAYS = 7;
const LOOKAHEAD_DAYS = 14;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function parsePreferredDate(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s ?? "");
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(`${y}-${mo}-${d}T00:00:00+02:00`);
}

const PIPELINE_BG: Record<string, string> = {
  new: "Нови", contacted: "Свързани", quoted: "Оферирани",
  confirmed: "Потвърдени", completed: "Приключени", lost: "Загубени", archived: "Архив",
};

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!CRON_SECRET) { console.error("TEAM_DIGEST_CRON_SECRET not configured"); return json({ error: "not_configured" }, 500); }
  if ((req.headers.get("x-cron-secret") ?? "") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);

  const recipients = [...OWNER_EMAILS.split(","), ...TEAM_EMAIL.split(",")].map(s => s.trim()).filter(Boolean);
  const unique = [...new Set(recipients)];
  if (!unique.length) return json({ error: "no_recipients" }, 500);

  const windowStart = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const windowStartIso = windowStart.toISOString();

  const [{ data: enq, error: enqErr }, { data: fb, error: fbErr }, { data: transitions, error: trErr }] = await Promise.all([
    sb.from("enquiries")
      .select("id, event_type, preferred_date, pipeline_status, created_at, offer_sent_at")
      .neq("pipeline_status", "archived")
      .limit(2000),
    sb.from("event_feedback")
      .select("experience_rating, service_rating, venue_rating, rebook_rating, submitted_at")
      .gte("submitted_at", windowStartIso),
    sb.from("enquiry_status_log")
      .select("enquiry_id, to_status")
      .in("to_status", ["confirmed", "lost"])
      .gte("changed_at", windowStartIso),
  ]);
  if (enqErr) { console.error("enquiries query failed:", enqErr); return json({ error: "query_failed" }, 500); }
  if (fbErr) console.error("feedback query failed (section skipped):", fbErr);
  if (trErr) console.error("status_log query failed (won/lost shows 0):", trErr);

  // Won / lost this week — distinct enquiries that ENTERED the stage during
  // the window (an enquiry bounced confirmed→lost in the same week counts in
  // both, which is the honest reading).
  const wonIds = new Set<string>(), lostIds = new Set<string>();
  for (const t of transitions ?? []) {
    if (t.to_status === "confirmed") wonIds.add(t.enquiry_id);
    else if (t.to_status === "lost") lostIds.add(t.enquiry_id);
  }

  const all = enq ?? [];
  const nowMs = Date.now();

  // New enquiries in window, split by event type.
  const fresh = all.filter(e => Date.parse(e.created_at) >= windowStart.getTime());
  const byType = new Map<string, number>();
  for (const e of fresh) byType.set(e.event_type ?? "—", (byType.get(e.event_type ?? "—") ?? 0) + 1);

  // Offers sent in window.
  const offersSent = all.filter(e => e.offer_sent_at && Date.parse(e.offer_sent_at) >= windowStart.getTime()).length;

  // Events held in window (confirmed/completed, event date within past 7 days).
  const CONFIRMED = new Set(["confirmed", "completed"]);
  const held = all.filter(e => {
    if (!CONFIRMED.has(e.pipeline_status ?? "")) return false;
    const d = parsePreferredDate(e.preferred_date ?? "");
    if (!d) return false;
    return d.getTime() >= windowStart.getTime() && d.getTime() <= nowMs;
  }).length;

  // Upcoming confirmed events (next LOOKAHEAD_DAYS).
  const upcoming = all.filter(e => {
    if (!CONFIRMED.has(e.pipeline_status ?? "")) return false;
    const d = parsePreferredDate(e.preferred_date ?? "");
    if (!d) return false;
    const diff = d.getTime() - nowMs;
    return diff >= 0 && diff <= LOOKAHEAD_DAYS * 86_400_000;
  }).length;

  // Pipeline snapshot.
  const snapshot = new Map<string, number>();
  for (const e of all) {
    const ps = e.pipeline_status ?? "new";
    snapshot.set(ps, (snapshot.get(ps) ?? 0) + 1);
  }

  // Feedback averages.
  const fbRows = fb ?? [];
  const avg = (k: "experience_rating" | "service_rating" | "venue_rating" | "rebook_rating") => {
    const vals = fbRows.map(r => Number(r[k])).filter(v => v > 0);
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null;
  };

  const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
  const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const dateBg = new Date().toLocaleDateString("bg-BG", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Sofia" });
  const subject = `Маргел 360° · седмичен отчет · ${dateBg}`;

  const kpiCell = (label: string, value: string) => `
    <td style="padding:14px 10px;text-align:center;border:1px solid rgba(185,137,74,0.25)">
      <div style="font:600 22px/1.1 ${SERIF};color:#1A1815">${esc(value)}</div>
      <div style="margin-top:4px;font:10px/1.4 ${SANS};letter-spacing:0.1em;text-transform:uppercase;color:#7A7568">${esc(label)}</div>
    </td>`;

  const typeRows = [...byType.entries()].sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `<tr><td style="padding:5px 0;font:13px/1.4 ${SANS};color:#2A2620">${esc(t)}</td><td style="padding:5px 0;font:600 13px/1.4 ${SANS};color:#1A1815;text-align:right">${n}</td></tr>`).join("");

  const snapRows = ["new", "contacted", "quoted", "confirmed", "completed", "lost"]
    .filter(ps => (snapshot.get(ps) ?? 0) > 0)
    .map(ps => `<tr><td style="padding:5px 0;font:13px/1.4 ${SANS};color:#2A2620">${PIPELINE_BG[ps]}</td><td style="padding:5px 0;font:600 13px/1.4 ${SANS};color:#1A1815;text-align:right">${snapshot.get(ps)}</td></tr>`).join("");

  const fbBlock = fbRows.length
    ? `<p style="margin:0 0 6px;font:13px/1.5 ${SANS};color:#2A2620"><strong>${fbRows.length}</strong> анкети тази седмица — Преживяване ${avg("experience_rating") ?? "—"} · Обслужване ${avg("service_rating") ?? "—"} · Зала ${avg("venue_rating") ?? "—"} · Повторно ${avg("rebook_rating") ?? "—"} (от 4)</p>`
    : `<p style="margin:0;font:13px/1.5 ${SANS};color:#7A7568">Няма получени анкети тази седмица.</p>`;

  const html = `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600&family=Manrope:wght@300;400;500;600;700&display=swap');</style>
</head><body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
  <tr><td style="padding:32px 44px 20px;border-bottom:1px solid rgba(185,137,74,0.35)">
    <div style="font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;text-transform:uppercase">Маргел&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em></div>
    <div style="margin-top:8px;font:400 30px/1.1 ${SERIF}">Седмичен <em style="font-style:italic;color:#B9894A">отчет</em></div>
    <div style="margin-top:4px;font:13px/1.5 ${SANS};color:#7A7568">последните ${WINDOW_DAYS} дни · ${esc(dateBg)}</div>
  </td></tr>
  <tr><td style="padding:24px 44px 8px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${kpiCell("Нови запитвания", String(fresh.length))}
        ${kpiCell("Спечелени", String(wonIds.size))}
        ${kpiCell("Загубени", String(lostIds.size))}
      </tr>
      <tr>
        ${kpiCell("Изпратени оферти", String(offersSent))}
        ${kpiCell("Проведени събития", String(held))}
        ${kpiCell(`Предстоящи ${LOOKAHEAD_DAYS} дни`, String(upcoming))}
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 44px 4px">
    <h2 style="margin:0 0 6px;font:500 13px/1.2 ${SANS};letter-spacing:0.14em;text-transform:uppercase;color:#B9894A">Нови по тип събитие</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${typeRows || `<tr><td style="font:13px/1.5 ${SANS};color:#7A7568">Няма нови запитвания.</td></tr>`}</table>
  </td></tr>
  <tr><td style="padding:16px 44px 4px">
    <h2 style="margin:0 0 6px;font:500 13px/1.2 ${SANS};letter-spacing:0.14em;text-transform:uppercase;color:#B9894A">Активен пайплайн</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${snapRows}</table>
  </td></tr>
  <tr><td style="padding:16px 44px 28px">
    <h2 style="margin:0 0 6px;font:500 13px/1.2 ${SANS};letter-spacing:0.14em;text-transform:uppercase;color:#B9894A">Обратна връзка</h2>
    ${fbBlock}
  </td></tr>
  <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}">
    <a href="https://margel360.bg/admin/dashboard.html" style="color:#F6F1E8;text-decoration:none;font-weight:600">Отвори таблото →</a><br>
    Автоматичен отчет · изпраща се всеки понеделник.
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = `Маргел 360° · седмичен отчет (${WINDOW_DAYS} дни)\n`
    + `Нови запитвания: ${fresh.length}\nСпечелени: ${wonIds.size}\nЗагубени: ${lostIds.size}\n`
    + `Изпратени оферти: ${offersSent}\nПроведени събития: ${held}\nПредстоящи ${LOOKAHEAD_DAYS} дни: ${upcoming}\n`
    + `Анкети: ${fbRows.length}\n`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: unique, subject, html, text }),
  });
  if (!r.ok) { console.error("resend failed:", await r.text()); return json({ error: "send_failed" }, 502); }

  return json({
    newEnquiries: fresh.length, won: wonIds.size, lost: lostIds.size,
    offersSent, eventsHeld: held, upcoming,
    feedback: fbRows.length, sent: unique.length,
  });
});
