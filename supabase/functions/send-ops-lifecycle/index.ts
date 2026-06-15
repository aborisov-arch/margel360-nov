import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";

// Cron-triggered each morning (Europe/Sofia). Three operations/retention
// passes, each guarded by its own one-shot stamp:
//   A) Run sheet      — TEAM email the morning of each event (full detail).
//   B) Pre-event upsell — customer with a confirmed event 10-14 days out and
//      thin extras (no drinks / ≤1 paid addon) gets a "complete your event"
//      nudge to the site.
//   C) Anniversary win-back — past customer ~1 year on, with marketing
//      consent, invited back.
// Manual testing: POST {"dry_run": true} to preview without sending/stamping.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDR    = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
const FROM_EMAIL   = FROM_ADDR.includes("<") ? FROM_ADDR : `Margel360 <${FROM_ADDR}>`;
const SITE_URL     = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://margel360.bg").replace(/\/$/, "");
const OWNER_EMAILS = Deno.env.get("OWNER_EMAILS") ?? "";
const TEAM_EMAIL   = Deno.env.get("TEAM_EMAIL") ?? "";
// Shared internal cron secret (Vault: team_digest_cron_secret).
const CRON_SECRET  = Deno.env.get("TEAM_DIGEST_CRON_SECRET") ?? "";

const UPSELL_MIN_DAYS = 10, UPSELL_MAX_DAYS = 14;
// Anniversary window: fire once when the event is ~1 year ago (±7 days).
const ANNIV_MIN_DAYS = 358, ANNIV_MAX_DAYS = 372;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtDateBg(s: string): string { return String(s ?? "").replaceAll("/", "."); }
function parsePreferredDate(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s ?? "");
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(`${y}-${mo}-${d}T00:00:00+02:00`);
}
function sofiaToday(): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit" });
  const p = fmt.formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)!.value;
  return new Date(`${g("year")}-${g("month")}-${g("day")}T00:00:00+02:00`);
}
function daysBetween(a: Date, b: Date): number { return Math.round((a.getTime() - b.getTime()) / 86_400_000); }

async function sendResend(to: string | string[], subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY || !to || (Array.isArray(to) && !to.length)) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!r.ok) { console.error("resend rejected:", r.status, await r.text()); return false; }
  return true;
}

const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function shell(subject: string, bodyHtml: string): string {
  return `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Manrope:wght@300;400;500;600;700&display=swap');</style>
</head><body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
  <tr><td style="padding:32px 44px 24px;border-bottom:1px solid rgba(185,137,74,0.35);font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;text-transform:uppercase">Маргел&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em></td></tr>
  <tr><td style="padding:40px 44px 32px">${bodyHtml}</td></tr>
  <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}"><strong style="color:#C9A86A;text-transform:uppercase;letter-spacing:0.16em">Маргел 360°</strong> · бул. Околовръстен път 155 · ет. 4 · София<br><a href="mailto:360@margel.info" style="color:#F6F1E8;text-decoration:none">360@margel.info</a></td></tr>
</table></td></tr></table></body></html>`;
}

type Enquiry = {
  id: string; full_name: string | null; email: string | null; event_type: string | null;
  preferred_date: string | null; arrival_time: string | null; guests: number | null;
  pipeline_status: string | null; marketing_consent: boolean | null;
  addons: { id: string; name?: string }[] | null; drinks: { id: string; qty?: number }[] | null;
  run_sheet_sent_at: string | null; upsell_sent_at: string | null; winback_sent_at: string | null;
};

function runSheetHtml(e: Enquiry): string {
  const addons = Array.isArray(e.addons) ? e.addons : [];
  const drinks = Array.isArray(e.drinks) ? e.drinks : [];
  const addonList = addons.length ? addons.map(a => esc(a.name || a.id)).join(", ") : "—";
  const drinkList = drinks.length ? drinks.map(d => `${esc(d.id)}×${esc(d.qty ?? 1)}`).join(", ") : "—";
  const row = (l: string, v: string) => `<tr><td style="padding:5px 0;font:12px/1.4 ${SANS};color:#7A7568;width:120px">${l}</td><td style="padding:5px 0;font:13px/1.5 ${SANS};color:#1A1815">${v}</td></tr>`;
  return `<div style="margin:0 0 18px;padding:14px 16px;border-left:3px solid #B9894A;background:#F6F1E8">
    <p style="margin:0 0 8px;font:500 16px/1.2 ${SERIF};color:#1A1815">${esc(e.full_name || "—")}${e.event_type ? ` · ${esc(e.event_type)}` : ""}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${row("Час", esc(e.arrival_time || "—"))}
      ${row("Гости", esc(e.guests ?? "—"))}
      ${row("Добавки", addonList)}
      ${row("Напитки", drinkList)}
    </table>
  </div>`;
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!CRON_SECRET) { console.error("TEAM_DIGEST_CRON_SECRET not configured"); return json({ error: "not_configured" }, 500); }
  if ((req.headers.get("x-cron-secret") ?? "") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);

  let dryRun = false;
  if (req.method === "POST") { try { dryRun = !!(await req.json())?.dry_run; } catch { /* empty ok */ } }

  const today = sofiaToday();
  const COLS = "id, full_name, email, event_type, preferred_date, arrival_time, guests, pipeline_status, marketing_consent, addons, drinks, run_sheet_sent_at, upsell_sent_at, winback_sent_at";

  // Pull confirmed/completed (run sheet + upsell + anniversary all live here).
  const { data, error } = await sb.from("enquiries")
    .select(COLS).in("pipeline_status", ["confirmed", "completed"]).limit(2000);
  if (error) { console.error("query failed:", error); return json({ error: "query_failed" }, 500); }
  const all = (data ?? []) as Enquiry[];

  // A) Run sheet — events happening TODAY, not yet sent.
  const runSheet = all.filter(e => {
    if (e.run_sheet_sent_at || !e.preferred_date) return false;
    const d = parsePreferredDate(e.preferred_date);
    return !!d && daysBetween(d, today) === 0;
  });

  // B) Upsell — confirmed, 10-14 days out, thin extras, not yet upsold, email present.
  const upsell = all.filter(e => {
    if (e.upsell_sent_at || (e.pipeline_status ?? "") !== "confirmed" || !e.email) return false;
    const d = parsePreferredDate(e.preferred_date ?? "");
    if (!d) return false;
    const diff = daysBetween(d, today);
    if (diff < UPSELL_MIN_DAYS || diff > UPSELL_MAX_DAYS) return false;
    const paidAddons = (Array.isArray(e.addons) ? e.addons : []).filter(a => a.id !== "cleaning").length;
    const drinkCount = (Array.isArray(e.drinks) ? e.drinks : []).length;
    return drinkCount === 0 || paidAddons <= 1;
  });

  // C) Anniversary win-back — ~1 year on, marketing consent, not yet sent.
  const winback = all.filter(e => {
    if (e.winback_sent_at || !e.marketing_consent || !e.email) return false;
    const d = parsePreferredDate(e.preferred_date ?? "");
    if (!d) return false;
    const ago = daysBetween(today, d);
    return ago >= ANNIV_MIN_DAYS && ago <= ANNIV_MAX_DAYS;
  });

  if (dryRun) {
    return json({
      dry_run: true, scanned: all.length,
      run_sheet: runSheet.map(e => ({ id: e.id, name: e.full_name, date: e.preferred_date })),
      upsell: upsell.map(e => ({ id: e.id, name: e.full_name, date: e.preferred_date, email: e.email })),
      winback: winback.map(e => ({ id: e.id, name: e.full_name, date: e.preferred_date, email: e.email })),
    });
  }

  // A) Run sheet → one team email covering all of today's events.
  let runSheetSent = 0;
  if (runSheet.length) {
    const to = [...new Set([...OWNER_EMAILS.split(","), ...TEAM_EMAIL.split(",")].map(s => s.trim()).filter(Boolean))];
    if (to.length) {
      const dateBg = today.toLocaleDateString("bg-BG", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Sofia" });
      const subject = `Програма за деня · ${dateBg} · Маргел 360°`;
      const body = `<h1 style="margin:0 0 16px;font:400 30px/1.12 ${SERIF}">Днес — <em style="font-style:italic;color:#B9894A">${runSheet.length}</em> ${runSheet.length === 1 ? "събитие" : "събития"}</h1>${runSheet.map(runSheetHtml).join("")}`;
      try {
        await sendResend(to, subject, shell(subject, body));
        // Stamp all of today's events as sent (one email covered them).
        await sb.from("enquiries").update({ run_sheet_sent_at: new Date().toISOString() }).in("id", runSheet.map(e => e.id));
        runSheetSent = runSheet.length;
      } catch (err) { console.error("run-sheet send failed:", err); }
    }
  }

  // B) Upsell (stamp-first, roll back on failure).
  let upsellSent = 0;
  for (const e of upsell) {
    const { error: stampErr } = await sb.from("enquiries").update({ upsell_sent_at: new Date().toISOString() }).eq("id", e.id);
    if (stampErr) { console.error(`upsell stamp failed for ${e.id}:`, stampErr); continue; }
    try {
      const first = (e.full_name || "").split(" ")[0] || e.full_name || "";
      const subject = `Допълнете събитието си · Маргел 360°`;
      const body = `<h1 style="margin:0 0 12px;font:400 32px/1.15 ${SERIF}">Нека го направим <em style="font-style:italic;color:#B9894A">още по-добро</em></h1>
        <p style="margin:0 0 20px;font:16px/1.55 ${SANS};color:#2A2620">Здравейте, ${esc(first)}. Вашето събитие наближава! Ако желаете да добавите напитки, украса, DJ или фотограф, разгледайте опциите ни:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px"><tr><td><a href="${SITE_URL}/services.html" style="display:inline-block;padding:14px 28px;background:#1A1815;color:#F6F1E8;font:600 12px/1 ${SANS};letter-spacing:0.14em;text-transform:uppercase;text-decoration:none">Вижте услугите</a></td></tr></table>
        <p style="margin:0;font:13px/1.6 ${SANS};color:#7A7568">Просто отговорете на този имейл или ни пишете на <a href="mailto:360@margel.info" style="color:#B9894A">360@margel.info</a>, за да добавим нещо.</p>`;
      await sendResend(e.email!, subject, shell(subject, body));
      upsellSent++;
    } catch (err) {
      console.error(`upsell send failed for ${e.id}, rolling back:`, err);
      await sb.from("enquiries").update({ upsell_sent_at: null }).eq("id", e.id);
    }
  }

  // C) Win-back (stamp-first, roll back on failure).
  let winbackSent = 0;
  for (const e of winback) {
    const { error: stampErr } = await sb.from("enquiries").update({ winback_sent_at: new Date().toISOString() }).eq("id", e.id);
    if (stampErr) { console.error(`winback stamp failed for ${e.id}:`, stampErr); continue; }
    try {
      const first = (e.full_name || "").split(" ")[0] || e.full_name || "";
      const subject = `Една година по-късно · да празнуваме отново? · Маргел 360°`;
      const body = `<h1 style="margin:0 0 12px;font:400 32px/1.15 ${SERIF}">Мина <em style="font-style:italic;color:#B9894A">година</em>!</h1>
        <p style="margin:0 0 20px;font:16px/1.55 ${SANS};color:#2A2620">Здравейте, ${esc(first)}. Преди около година празнувахте при нас${e.event_type ? ` (${esc(e.event_type)})` : ""}. Беше удоволствие! Ако предстои нов повод, ще се радваме отново да сме ваши домакини.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px"><tr><td><a href="${SITE_URL}/reservation.html" style="display:inline-block;padding:14px 28px;background:#1A1815;color:#F6F1E8;font:600 12px/1 ${SANS};letter-spacing:0.14em;text-transform:uppercase;text-decoration:none">Проверете свободни дати</a></td></tr></table>
        <p style="margin:0;font:13px/1.6 ${SANS};color:#7A7568">Отговорете на този имейл за специална оферта за повторни гости.</p>`;
      await sendResend(e.email!, subject, shell(subject, body));
      winbackSent++;
    } catch (err) {
      console.error(`winback send failed for ${e.id}, rolling back:`, err);
      await sb.from("enquiries").update({ winback_sent_at: null }).eq("id", e.id);
    }
  }

  return json({
    scanned: all.length,
    run_sheet: { eligible: runSheet.length, sent: runSheetSent },
    upsell: { eligible: upsell.length, sent: upsellSent },
    winback: { eligible: winback.length, sent: winbackSent },
  });
});
