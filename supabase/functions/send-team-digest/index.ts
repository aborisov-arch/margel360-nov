import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";

// Cron-triggered once each morning (Europe/Sofia). Scans enquiries and emails
// the team ONE digest with the things that need a human today:
//   1. Follow-ups due/overdue  (activates next_followup_at — previously a
//      column nothing ever read)
//   2. Stale leads             (new > 2d, contacted/quoted > 5d, untouched)
//   3. Unanswered new enquiries (pipeline_status = 'new')
//   4. Upcoming events         (confirmed/completed in the next 7 days)
//   5. Outstanding deposits    (upcoming confirmed events with no deposit
//      recorded in financial_events)
//
// A digest is a daily snapshot, so there is no per-row "sent" flag; if every
// section is empty we send nothing.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDR    = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
const FROM_EMAIL   = FROM_ADDR.includes("<") ? FROM_ADDR : `Margel360 <${FROM_ADDR}>`;
const SITE_URL     = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://margel360.bg").replace(/\/$/, "");
// Recipients: prefer the owner list (same as enquiry summaries); fall back to
// the team inbox so the digest never goes nowhere.
const OWNER_EMAILS = Deno.env.get("OWNER_EMAILS") ?? "";
const TEAM_EMAIL   = Deno.env.get("TEAM_EMAIL") ?? "";
// Shared secret required from the pg_cron caller. Without it anyone could
// trigger the function and drain the Resend quota.
const CRON_SECRET  = Deno.env.get("TEAM_DIGEST_CRON_SECRET") ?? "";

// Staleness thresholds (days since created_at, untouched in pipeline).
const STALE_NEW_DAYS = 2;
const STALE_WORKING_DAYS = 5;
// Look-ahead window for upcoming events / outstanding deposits.
const UPCOMING_DAYS = 7;
const DEPOSIT_WINDOW_DAYS = 14;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDateBg(stored: string): string {
  return String(stored ?? "").replaceAll("/", ".");
}

// preferred_date is stored as "DD/MM/YYYY". Parse to a Date anchored at
// midnight Sofia. For day-bucketing the exact offset is irrelevant.
function parsePreferredDate(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s ?? "");
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(`${y}-${mo}-${d}T00:00:00+02:00`);
}

function sofiaToday(): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === "year")!.value;
  const mo = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  return new Date(`${y}-${mo}-${d}T00:00:00+02:00`);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

async function sendResend(to: string[], subject: string, html: string, text: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`resend_failed: ${t}`);
  }
}

type Enquiry = {
  id: string;
  enquiry_number: number | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  event_type: string | null;
  preferred_date: string | null;
  pipeline_status: string | null;
  next_followup_at: string | null;
  created_at: string;
  edit_token: string | null;
};

type Row = { e: Enquiry; meta?: string };

function adminLink(e: Enquiry): string {
  // Admins open the edit page with ?admin=1. Falls back to the dashboard if
  // the token is somehow missing.
  return e.edit_token
    ? `${SITE_URL}/edit.html?token=${e.edit_token}&admin=1`
    : `${SITE_URL}/admin/dashboard.html`;
}

const PIPELINE_BG: Record<string, string> = {
  new: "Ново", contacted: "Свързан", quoted: "Оферирано",
  confirmed: "Потвърдено", completed: "Приключено", lost: "Загубено", archived: "Архив",
};

function label(e: Enquiry): string {
  const num = e.enquiry_number ? `#${e.enquiry_number} · ` : "";
  return `${num}${e.full_name || "—"}`;
}

function renderSection(title: string, rows: Row[]): { html: string; text: string } {
  if (!rows.length) return { html: "", text: "" };
  const SANS = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
  const items = rows.map(({ e, meta }) => {
    const date = e.preferred_date ? ` · ${fmtDateBg(e.preferred_date)}` : "";
    const ev = e.event_type ? ` · ${esc(e.event_type)}` : "";
    const ph = e.phone ? ` · ${esc(e.phone)}` : "";
    const m = meta ? ` <span style="color:#B9894A">${esc(meta)}</span>` : "";
    return `<tr><td style="padding:8px 0;border-bottom:1px solid rgba(185,137,74,0.18);font:14px/1.5 ${SANS};color:#2A2620">
      <a href="${adminLink(e)}" style="color:#1A1815;font-weight:600;text-decoration:none">${esc(label(e))}</a>${ev}${date}${ph}${m}
    </td></tr>`;
  }).join("");
  const html = `<tr><td style="padding:24px 44px 4px">
      <h2 style="margin:0 0 6px;font:500 13px/1.2 ${SANS};letter-spacing:0.14em;text-transform:uppercase;color:#B9894A">${esc(title)} · ${rows.length}</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>
    </td></tr>`;

  const textItems = rows.map(({ e, meta }) => {
    const parts = [label(e), e.event_type, e.preferred_date ? fmtDateBg(e.preferred_date) : null, e.phone, meta]
      .filter(Boolean).join(" · ");
    return `  - ${parts}\n    ${adminLink(e)}`;
  }).join("\n");
  const text = `${title} (${rows.length})\n${textItems}\n`;
  return { html, text };
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  if (!CRON_SECRET) {
    console.error("TEAM_DIGEST_CRON_SECRET not configured");
    return json({ error: "not_configured" }, 500);
  }
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (provided !== CRON_SECRET) return json({ error: "unauthorized" }, 401);

  const recipients = [...OWNER_EMAILS.split(","), ...TEAM_EMAIL.split(",")]
    .map(s => s.trim()).filter(Boolean);
  const uniqueRecipients = [...new Set(recipients)];
  if (!uniqueRecipients.length) {
    console.error("no digest recipients (OWNER_EMAILS / TEAM_EMAIL both empty)");
    return json({ error: "no_recipients" }, 500);
  }

  // Pull the working set: everything not archived. The venue does a handful of
  // enquiries a week, so 1000 is comfortably the whole live pipeline.
  const { data, error } = await sb
    .from("enquiries")
    .select("id, enquiry_number, full_name, email, phone, event_type, preferred_date, pipeline_status, next_followup_at, created_at, edit_token")
    .neq("pipeline_status", "archived")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("query failed:", error);
    return json({ error: "query_failed" }, 500);
  }

  const all = (data ?? []) as Enquiry[];
  const today = sofiaToday();
  const nowMs = Date.now();

  // 1. Follow-ups due/overdue (active leads only).
  const ACTIVE = new Set(["new", "contacted", "quoted", "confirmed"]);
  const followups: Row[] = all
    .filter(e => e.next_followup_at && Date.parse(e.next_followup_at) <= nowMs && ACTIVE.has(e.pipeline_status ?? ""))
    .sort((a, b) => Date.parse(a.next_followup_at!) - Date.parse(b.next_followup_at!))
    .map(e => {
      const overdue = daysBetween(today, new Date(Date.parse(e.next_followup_at!)));
      return { e, meta: overdue > 0 ? `просрочен с ${overdue} дн.` : "днес" };
    });

  // 2. Stale leads — untouched too long for their stage.
  const stale: Row[] = all
    .filter(e => {
      const ageDays = (nowMs - Date.parse(e.created_at)) / 86_400_000;
      const ps = e.pipeline_status ?? "";
      if (ps === "new") return ageDays > STALE_NEW_DAYS;
      if (ps === "contacted" || ps === "quoted") return ageDays > STALE_WORKING_DAYS;
      return false;
    })
    .map(e => {
      const ageDays = Math.floor((nowMs - Date.parse(e.created_at)) / 86_400_000);
      return { e, meta: `${PIPELINE_BG[e.pipeline_status ?? ""] ?? e.pipeline_status} · ${ageDays} дн.` };
    });

  // 3. Unanswered new enquiries — minus the ones already listed as stale or
  // due for follow-up, so one enquiry never inflates two sections.
  const listedIds = new Set([...stale, ...followups].map(r => r.e.id));
  const unanswered: Row[] = all
    .filter(e => (e.pipeline_status ?? "") === "new" && !listedIds.has(e.id))
    .map(e => ({ e }));

  // 4. Upcoming events (confirmed/completed within the window).
  const CONFIRMED = new Set(["confirmed", "completed"]);
  const upcoming: Row[] = all
    .filter(e => {
      if (!CONFIRMED.has(e.pipeline_status ?? "")) return false;
      const d = parsePreferredDate(e.preferred_date ?? "");
      if (!d) return false;
      const diff = daysBetween(d, today);
      return diff >= 0 && diff <= UPCOMING_DAYS;
    })
    .sort((a, b) => (parsePreferredDate(a.preferred_date!)!.getTime()) - (parsePreferredDate(b.preferred_date!)!.getTime()))
    .map(e => {
      const diff = daysBetween(parsePreferredDate(e.preferred_date!)!, today);
      return { e, meta: diff === 0 ? "днес" : diff === 1 ? "утре" : `след ${diff} дн.` };
    });

  // 5. Outstanding deposits — upcoming confirmed events with no deposit
  // recorded in financial_events (no row, or deposit cash+bank = 0).
  const confirmedSoon = all.filter(e => {
    if ((e.pipeline_status ?? "") !== "confirmed") return false;
    const d = parsePreferredDate(e.preferred_date ?? "");
    if (!d) return false;
    const diff = daysBetween(d, today);
    return diff >= 0 && diff <= DEPOSIT_WINDOW_DAYS;
  });
  let outstanding: Row[] = [];
  if (confirmedSoon.length) {
    const ids = confirmedSoon.map(e => e.id);
    const { data: fin, error: finErr } = await sb
      .from("financial_events")
      .select("enquiry_id, deposit_cash_eur, deposit_bank_eur")
      .in("enquiry_id", ids);
    if (finErr) {
      console.error("financial_events query failed (skipping deposit section):", finErr);
    } else {
      const depositByEnquiry = new Map<string, number>();
      for (const f of fin ?? []) {
        if (!f.enquiry_id) continue;
        depositByEnquiry.set(f.enquiry_id, (Number(f.deposit_cash_eur) || 0) + (Number(f.deposit_bank_eur) || 0));
      }
      outstanding = confirmedSoon
        .filter(e => (depositByEnquiry.get(e.id) ?? 0) <= 0)
        .sort((a, b) => parsePreferredDate(a.preferred_date!)!.getTime() - parsePreferredDate(b.preferred_date!)!.getTime())
        .map(e => {
          const hasRow = depositByEnquiry.has(e.id);
          return { e, meta: hasRow ? "няма записан депозит" : "няма P&L запис" };
        });
    }
  }

  const sections = [
    renderSection("Последващи контакти", followups),
    renderSection("Залежали запитвания", stale),
    renderSection("Нови без отговор", unanswered),
    renderSection("Предстоящи събития", upcoming),
    renderSection("Неполучени депозити", outstanding),
  ];

  const totalRows = followups.length + stale.length + unanswered.length + upcoming.length + outstanding.length;
  if (totalRows === 0) {
    return json({ scanned: all.length, rows: 0, sent: 0, note: "nothing to report" });
  }

  const dateBg = today.toLocaleDateString("bg-BG", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Sofia" });
  const SANS = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
  const subject = `Маргел 360° · дневен преглед · ${dateBg}`;
  const html = `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Manrope:wght@300;400;500;600;700&display=swap');</style>
</head><body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
      <tr><td style="padding:32px 44px 20px;border-bottom:1px solid rgba(185,137,74,0.35)">
        <div style="font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;color:#1A1815;text-transform:uppercase">Маргел&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em></div>
        <div style="margin-top:8px;font:400 30px/1.1 ${SERIF};color:#1A1815">Дневен <em style="font-style:italic;color:#B9894A">преглед</em></div>
        <div style="margin-top:4px;font:13px/1.5 ${SANS};color:#7A7568">${esc(dateBg)} · ${totalRows} за внимание</div>
      </td></tr>
      ${sections.map(s => s.html).join("")}
      <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}">
        <a href="${SITE_URL}/admin/dashboard.html" style="color:#F6F1E8;text-decoration:none;font-weight:600">Отвори таблото →</a><br>
        Автоматичен преглед · изпраща се всяка сутрин.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = `Маргел 360° · дневен преглед · ${dateBg}\n${totalRows} за внимание\n\n`
    + sections.map(s => s.text).filter(Boolean).join("\n")
    + `\nТабло: ${SITE_URL}/admin/dashboard.html\n`;

  try {
    await sendResend(uniqueRecipients, subject, html, text);
  } catch (err) {
    console.error("digest send failed:", err);
    return json({ error: "send_failed" }, 500);
  }

  return json({
    scanned: all.length,
    rows: totalRows,
    sections: {
      followups: followups.length, stale: stale.length, unanswered: unanswered.length,
      upcoming: upcoming.length, outstanding: outstanding.length,
    },
    sent: uniqueRecipients.length,
  });
});
