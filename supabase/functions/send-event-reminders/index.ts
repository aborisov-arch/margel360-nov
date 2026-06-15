import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";

// Cron-triggered each morning (Europe/Sofia). Sends two customer-facing
// reminders, each guarded by its own idempotency flag so it goes out once:
//   A) Day-before reminder   — confirmed/completed events happening tomorrow.
//   B) Deposit-due reminder  — confirmed events 2–14 days out with no deposit
//      recorded in financial_events.
//
// Manual testing: POST {"dry_run": true} to see who WOULD be emailed without
// sending or marking anything.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDR    = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
const FROM_EMAIL   = FROM_ADDR.includes("<") ? FROM_ADDR : `Margel360 <${FROM_ADDR}>`;
const SITE_URL     = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://margel360.bg").replace(/\/$/, "");
// INTENTIONALLY shared with send-team-digest: one secret guards both internal
// cron functions (Vault entry `team_digest_cron_secret`). If you rotate it,
// both functions and the Vault entry must move together.
const CRON_SECRET  = Deno.env.get("TEAM_DIGEST_CRON_SECRET") ?? "";

// Deposit reminder window: only chase events this many days out (and at least
// MIN days, so we don't ask for a deposit the day before — too late to matter).
const DEPOSIT_DUE_MIN_DAYS = 2;
const DEPOSIT_DUE_MAX_DAYS = 14;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtDateBg(stored: string): string {
  return String(stored ?? "").replaceAll("/", ".");
}
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

type Enquiry = {
  id: string;
  full_name: string | null;
  email: string | null;
  event_type: string | null;
  preferred_date: string | null;
  arrival_time: string | null;
  time_of_day: string | null;
  pipeline_status: string | null;
  reminder_sent_at: string | null;
  deposit_reminder_sent_at: string | null;
};

const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

// Shared branded shell — header, body, dark footer with the venue address.
function shell(subject: string, bodyHtml: string): string {
  return `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Manrope:wght@300;400;500;600;700&display=swap');</style>
</head><body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
      <tr><td style="padding:32px 44px 24px;border-bottom:1px solid rgba(185,137,74,0.35);font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;color:#1A1815;text-transform:uppercase">
        Маргел&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em>
      </td></tr>
      <tr><td style="padding:40px 44px 32px">${bodyHtml}</td></tr>
      <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}">
        <strong style="color:#C9A86A;text-transform:uppercase;letter-spacing:0.16em">Маргел 360°</strong> · бул. Околовръстен път 155 · ет. 4 · София<br>
        <a href="mailto:360@margel.info" style="color:#F6F1E8;text-decoration:none">360@margel.info</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function renderDayBefore(e: Enquiry): { subject: string; html: string } {
  const first = (e.full_name || "").split(" ")[0] || e.full_name || "";
  const arrival = e.arrival_time ? esc(e.arrival_time) : "";
  const subject = `До утре в Маргел 360° · ${fmtDateBg(e.preferred_date ?? "")}`;
  const arrivalLine = arrival
    ? `<p style="margin:0 0 24px;padding:14px 18px;border-left:3px solid #B9894A;background:#F6F1E8;font:14px/1.55 ${SANS};color:#1A1815"><strong style="color:#B9894A">Час на пристигане:</strong> ${arrival}</p>`
    : "";
  const body = `
    <h1 style="margin:0 0 12px;font:400 38px/1.1 ${SERIF};color:#1A1815">До <em style="font-style:italic;color:#B9894A">утре</em></h1>
    <p style="margin:0 0 24px;font:16px/1.55 ${SANS};color:#2A2620">
      Здравейте, ${esc(first)}. Очакваме ви утре, ${fmtDateBg(e.preferred_date ?? "")}, в Маргел 360°. Екипът ни е подготвил всичко за вашето събитие.
    </p>
    ${arrivalLine}
    <p style="margin:0 0 8px;font:14px/1.6 ${SANS};color:#2A2620">
      <strong>Адрес:</strong> бул. Околовръстен път 155, ет. 4, София.<br>
      <strong>Въпроси?</strong> Пишете ни на <a href="mailto:360@margel.info" style="color:#B9894A">360@margel.info</a> или отговорете на този имейл.
    </p>
    <p style="margin:24px 0 0;font:12px/1.5 ${SANS};color:#7A7568">До скоро!</p>`;
  return { subject, html: shell(subject, body) };
}

function renderDepositDue(e: Enquiry): { subject: string; html: string } {
  const first = (e.full_name || "").split(" ")[0] || e.full_name || "";
  const subject = `Депозит за резервацията ви · Маргел 360° · ${fmtDateBg(e.preferred_date ?? "")}`;
  const body = `
    <h1 style="margin:0 0 12px;font:400 34px/1.12 ${SERIF};color:#1A1815">Да <em style="font-style:italic;color:#B9894A">запазим</em> датата ви</h1>
    <p style="margin:0 0 24px;font:16px/1.55 ${SANS};color:#2A2620">
      Здравейте, ${esc(first)}. Радваме се, че избрахте Маргел 360° за събитието си на ${fmtDateBg(e.preferred_date ?? "")}. За да потвърдим окончателно датата, остава да получим депозита.
    </p>
    <p style="margin:0 0 24px;padding:14px 18px;border-left:3px solid #B9894A;background:#F6F1E8;font:14px/1.55 ${SANS};color:#1A1815">
      Свържете се с нас за детайли по плащането на <a href="mailto:360@margel.info" style="color:#B9894A">360@margel.info</a> или просто отговорете на този имейл.
    </p>
    <p style="margin:0;font:12px/1.5 ${SANS};color:#7A7568">Ако вече сте превели депозита, моля приемете нашите извинения и игнорирайте това съобщение.</p>`;
  return { subject, html: shell(subject, body) };
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  if (!CRON_SECRET) {
    console.error("TEAM_DIGEST_CRON_SECRET not configured");
    return json({ error: "not_configured" }, 500);
  }
  if ((req.headers.get("x-cron-secret") ?? "") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);

  let dryRun = false;
  if (req.method === "POST") {
    try { dryRun = !!(await req.json())?.dry_run; } catch { /* empty body ok */ }
  }

  const { data, error } = await sb
    .from("enquiries")
    .select("id, full_name, email, event_type, preferred_date, arrival_time, time_of_day, pipeline_status, reminder_sent_at, deposit_reminder_sent_at")
    .in("pipeline_status", ["confirmed", "completed"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("query failed:", error);
    return json({ error: "query_failed" }, 500);
  }

  const all = (data ?? []) as Enquiry[];
  const today = sofiaToday();

  // A) Day-before — event is tomorrow, not yet reminded.
  const dayBefore = all.filter(e => {
    if (e.reminder_sent_at || !e.email) return false;
    const d = parsePreferredDate(e.preferred_date ?? "");
    return !!d && daysBetween(d, today) === 1;
  });

  // B) Deposit-due — confirmed, 2–14 days out, not yet reminded, no deposit.
  const depositCandidates = all.filter(e => {
    if (e.deposit_reminder_sent_at || !e.email) return false;
    if ((e.pipeline_status ?? "") !== "confirmed") return false;
    const d = parsePreferredDate(e.preferred_date ?? "");
    if (!d) return false;
    const diff = daysBetween(d, today);
    return diff >= DEPOSIT_DUE_MIN_DAYS && diff <= DEPOSIT_DUE_MAX_DAYS;
  });

  let depositDue: Enquiry[] = [];
  if (depositCandidates.length) {
    const ids = depositCandidates.map(e => e.id);
    const { data: fin, error: finErr } = await sb
      .from("financial_events")
      .select("enquiry_id, deposit_cash_eur, deposit_bank_eur")
      .in("enquiry_id", ids);
    if (finErr) {
      console.error("financial_events query failed (skipping deposit reminders):", finErr);
    } else {
      const depositByEnquiry = new Map<string, number>();
      for (const f of fin ?? []) {
        if (!f.enquiry_id) continue;
        depositByEnquiry.set(f.enquiry_id, (Number(f.deposit_cash_eur) || 0) + (Number(f.deposit_bank_eur) || 0));
      }
      depositDue = depositCandidates.filter(e => (depositByEnquiry.get(e.id) ?? 0) <= 0);
    }
  }

  // Expiring discount-code nudge — unredeemed codes lapsing within 7 days,
  // not yet nudged. Recovers value the venue already minted from feedback.
  let expiringCodes: { code: string; expires_at: string; email: string; full_name: string }[] = [];
  {
    const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { data: codes, error: cErr } = await sb
      .from("discount_codes")
      .select("code, expires_at, issued_for_enquiry_id")
      .is("redeemed_at", null)
      .is("nudge_sent_at", null)
      .gt("expires_at", new Date().toISOString())
      .lt("expires_at", in7)
      .limit(100);
    if (cErr) {
      console.error("expiring-codes query failed (skipping):", cErr);
    } else if (codes?.length) {
      const ids = codes.map(c => c.issued_for_enquiry_id).filter(Boolean);
      const { data: ens } = ids.length
        ? await sb.from("enquiries").select("id, full_name, email").in("id", ids)
        : { data: [] };
      const byId = new Map((ens ?? []).map(e => [e.id, e]));
      expiringCodes = codes.map(c => {
        const en = c.issued_for_enquiry_id ? byId.get(c.issued_for_enquiry_id) : null;
        return { code: c.code, expires_at: c.expires_at, email: en?.email ?? "", full_name: en?.full_name ?? "" };
      }).filter(c => c.email);
    }
  }

  if (dryRun) {
    return json({
      dry_run: true,
      scanned: all.length,
      day_before: dayBefore.map(e => ({ id: e.id, name: e.full_name, date: e.preferred_date, email: e.email })),
      deposit_due: depositDue.map(e => ({ id: e.id, name: e.full_name, date: e.preferred_date, email: e.email })),
      expiring_codes: expiringCodes.map(c => ({ code: c.code, email: c.email, expires_at: c.expires_at })),
    });
  }

  // Stamp BEFORE sending. If the send then fails the flag is already set, so
  // the customer misses one reminder — strictly better than the reverse order,
  // where a failed stamp after a successful send emails the customer twice on
  // consecutive mornings. The stamp is rolled back on send failure (best
  // effort) so a transient Resend outage still gets retried tomorrow.
  let sentDayBefore = 0;
  for (const e of dayBefore) {
    const { error: stampErr } = await sb.from("enquiries")
      .update({ reminder_sent_at: new Date().toISOString() }).eq("id", e.id);
    if (stampErr) { console.error(`day-before stamp failed for ${e.id}:`, stampErr); continue; }
    try {
      const { subject, html } = renderDayBefore(e);
      await sendResend(e.email!, subject, html);
      sentDayBefore++;
    } catch (err) {
      console.error(`day-before send failed for ${e.id}, rolling back stamp:`, err);
      await sb.from("enquiries").update({ reminder_sent_at: null }).eq("id", e.id);
    }
  }

  let sentDeposit = 0;
  for (const e of depositDue) {
    const { error: stampErr } = await sb.from("enquiries")
      .update({ deposit_reminder_sent_at: new Date().toISOString() }).eq("id", e.id);
    if (stampErr) { console.error(`deposit-due stamp failed for ${e.id}:`, stampErr); continue; }
    try {
      const { subject, html } = renderDepositDue(e);
      await sendResend(e.email!, subject, html);
      sentDeposit++;
    } catch (err) {
      console.error(`deposit-due send failed for ${e.id}, rolling back stamp:`, err);
      await sb.from("enquiries").update({ deposit_reminder_sent_at: null }).eq("id", e.id);
    }
  }

  let sentCodes = 0;
  for (const c of expiringCodes) {
    const { error: stampErr } = await sb.from("discount_codes")
      .update({ nudge_sent_at: new Date().toISOString() }).eq("code", c.code);
    if (stampErr) { console.error(`code-nudge stamp failed for ${c.code}:`, stampErr); continue; }
    try {
      const { subject, html } = renderCodeExpiry(c);
      await sendResend(c.email, subject, html);
      sentCodes++;
    } catch (err) {
      console.error(`code-nudge send failed for ${c.code}, rolling back stamp:`, err);
      await sb.from("discount_codes").update({ nudge_sent_at: null }).eq("code", c.code);
    }
  }

  return json({
    scanned: all.length,
    day_before: { eligible: dayBefore.length, sent: sentDayBefore },
    deposit_due: { eligible: depositDue.length, sent: sentDeposit },
    code_nudge: { eligible: expiringCodes.length, sent: sentCodes },
  });
});

function renderCodeExpiry(c: { code: string; expires_at: string; full_name: string }): { subject: string; html: string } {
  const first = (c.full_name || "").split(" ")[0] || c.full_name || "";
  const exp = new Date(c.expires_at).toLocaleDateString("bg-BG", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Sofia" });
  const subject = `Отстъпката ви изтича скоро · Маргел 360°`;
  const body = `
    <h1 style="margin:0 0 12px;font:400 34px/1.12 ${SERIF};color:#1A1815">Не <em style="font-style:italic;color:#B9894A">пропускайте</em></h1>
    <p style="margin:0 0 20px;font:16px/1.55 ${SANS};color:#2A2620">
      Здравейте, ${esc(first)}. Вашата отстъпка от Маргел 360° е още активна, но изтича на <strong>${esc(exp)}</strong>.
    </p>
    <div style="margin:0 0 24px;padding:18px;border:2px dashed #B9894A;background:#F6F1E8;text-align:center">
      <p style="margin:0 0 6px;font:600 11px/1.2 ${SANS};letter-spacing:0.18em;color:#7A7568;text-transform:uppercase">Вашият код</p>
      <p style="margin:0;font:600 24px/1.1 ${SERIF};letter-spacing:0.06em;color:#1A1815">${esc(c.code)}</p>
    </div>
    <p style="margin:0;font:13px/1.6 ${SANS};color:#7A7568">Въведете кода при резервация на сайта ни или ни пишете на <a href="mailto:360@margel.info" style="color:#B9894A">360@margel.info</a>.</p>`;
  return { subject, html: shell(subject, body) };
}
