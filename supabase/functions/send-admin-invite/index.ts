import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { json, preflight } from "../_shared/cors.ts";

// One-shot(ish) internal utility: emails a branded admin-panel invitation
// (same cream/Fraunces/Manrope shell as the customer emails). Guarded by the
// shared internal cron secret; POST { "to": "...", "name": "...", "role":
// "blog" } - role currently only "blog" (editor: everything except Финанси
// and Дневник, signs in with Google).

const RESEND_KEY  = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDR   = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
const FROM_EMAIL  = FROM_ADDR.includes("<") ? FROM_ADDR : `Margel360 <${FROM_ADDR}>`;
const SITE_URL    = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://margel360.bg").replace(/\/$/, "");
const CRON_SECRET = Deno.env.get("TEAM_DIGEST_CRON_SECRET") ?? "";

const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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

function renderBlogInvite(to: string, name: string): { subject: string; html: string } {
  const subject = "Покана за екипа · Блог на Маргел 360°";
  const hello = name ? `Здравейте, ${esc(name)}.` : "Здравейте.";
  const body = `
    <h1 style="margin:0 0 12px;font:400 34px/1.12 ${SERIF};color:#1A1815">Добре дошли в <em style="font-style:italic;color:#B9894A">екипа</em></h1>
    <p style="margin:0 0 20px;font:16px/1.55 ${SANS};color:#2A2620">
      ${hello} Каним ви в администраторския панел на Маргел 360° като <strong>редактор на блога</strong>. Акаунтът ви е готов — без парола, влизате директно с Google.
    </p>
    <p style="margin:0 0 8px;font:600 11px/1.2 ${SANS};letter-spacing:0.18em;text-transform:uppercase;color:#7A7568">Как да влезете</p>
    <p style="margin:0 0 20px;font:14px/1.7 ${SANS};color:#2A2620">
      1. Отворете панела от бутона по-долу.<br>
      2. Натиснете <strong>„Вход с Google"</strong> и изберете <strong>${esc(to)}</strong>.<br>
      3. В менюто отворете <strong>„Блог"</strong> → <strong>„Нова статия"</strong>.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px"><tr><td>
      <a href="${SITE_URL}/admin/login.html" style="display:inline-block;padding:14px 28px;background:#1A1815;color:#F6F1E8;font:600 12px/1 ${SANS};letter-spacing:0.14em;text-transform:uppercase;text-decoration:none">Вход в панела</a>
    </td></tr></table>
    <p style="margin:0 0 20px;padding:14px 18px;border-left:3px solid #B9894A;background:#F6F1E8;font:13px/1.6 ${SANS};color:#1A1815">
      <strong>Форматиране на статиите:</strong> празен ред = нов абзац · ред, започващ с „## " = подзаглавие · ред с „- " = точка от списък. Английският превод е незадължителен. Публикуваната статия се появява веднага на ${SITE_URL}/blog.html.
    </p>
    <p style="margin:0;font:13px/1.6 ${SANS};color:#7A7568">
      Достъпът ви покрива целия панел без разделите „Финанси" и „Дневник". Въпроси — отговорете на този имейл или пишете на <a href="mailto:360@margel.info" style="color:#B9894A">360@margel.info</a>.
    </p>`;
  return { subject, html: shell(subject, body) };
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!CRON_SECRET) { console.error("TEAM_DIGEST_CRON_SECRET not configured"); return json({ error: "not_configured" }, 500); }
  if ((req.headers.get("x-cron-secret") ?? "") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);

  let body: { to?: unknown; name?: unknown; role?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ error: "bad_recipient" }, 400);
  if (body.role !== "blog") return json({ error: "unknown_role" }, 400);

  const { subject, html } = renderBlogInvite(to, name);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!r.ok) {
    console.error("resend rejected:", r.status, await r.text());
    return json({ error: "send_failed" }, 502);
  }
  console.log(`admin invite (role=blog) sent to ${to}`);
  return json({ sent: true, to, subject });
});
