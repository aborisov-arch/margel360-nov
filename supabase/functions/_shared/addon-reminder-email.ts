// Customer-facing "did you miss anything?" reminder (BG/EN). Pure renderer —
// the caller supplies already-localized booking lines and the missing add-ons.

import { catalogName, type BookingLine, type ReminderAddon } from "./addon-reminder.ts";

export type ReminderInput = {
  firstName: string;
  preferredDate: string;      // "DD/MM/YYYY"
  daysToEvent: number;
  lang: "bg" | "en";
  siteUrl: string;
  editToken: string | null;   // null → booking is locked, no self-service button
  have: BookingLine[];
  drinkCount: number;
  missing: ReminderAddon[];
};

const MANAGER_PHONE_TEL = "+359888100042";
const MANAGER_PHONE_DISPLAY = "+359 888 100 042";
const PHONE_LINK = `<a href="tel:${MANAGER_PHONE_TEL}" style="color:#B9894A;text-decoration:none;white-space:nowrap">${MANAGER_PHONE_DISPLAY}</a>`;

const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const T = {
  bg: {
    subject: (d: string) => `Проверете резервацията си · Маргел 360° · ${d}`,
    h1: `Пропуснахте ли <em style="font-style:italic;color:#B9894A">нещо</em>?`,
    hello: "Здравейте",
    intro: (d: string, n: number) => `Събитието ви на <strong>${d}</strong> наближава — ${n === 1 ? "остава 1 ден" : `остават ${n} дни`}. Прегледайте резервацията си и добавете каквото ви липсва, за да е всичко готово навреме.`,
    have: "В резервацията ви",
    noAddons: "Няма добавени услуги",
    drinks: (n: number) => n > 0 ? `Напитки: ${n} ${n === 1 ? "позиция" : "позиции"}` : "Няма добавени напитки",
    missing: "Още не сте добавили",
    perPiece: " / бр.",
    cta: "Добави или премахни услуги",
    footer: `Отговорете на този имейл, пишете на <a href="mailto:360@margel.info" style="color:#B9894A">360@margel.info</a> или се обадете на управителя: ${PHONE_LINK} — ще добавим желаното вместо вас.`,
    address: "бул. Околовръстен път 155 · ет. 4 · София",
  },
  en: {
    subject: (d: string) => `Check your booking · Margel 360° · ${d}`,
    h1: `Missed <em style="font-style:italic;color:#B9894A">anything</em>?`,
    hello: "Hello",
    intro: (d: string, n: number) => `Your event on <strong>${d}</strong> is coming up — ${n === 1 ? "1 day" : `${n} days`} to go. Take a look at your booking and add whatever is missing so everything is ready in time.`,
    have: "In your booking",
    noAddons: "No add-on services yet",
    drinks: (n: number) => n > 0 ? `Drinks: ${n} ${n === 1 ? "item" : "items"}` : "No drinks added yet",
    missing: "Not added yet",
    perPiece: " / pc",
    cta: "Add or remove services",
    footer: `Reply to this email, write to <a href="mailto:360@margel.info" style="color:#B9894A">360@margel.info</a> or call our manager: ${PHONE_LINK} — and we will add it for you.`,
    address: "155 Okolovrasten Pat Blvd · floor 4 · Sofia",
  },
} as const;

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtDate(stored: string): string { return String(stored ?? "").replaceAll("/", "."); }
function fmtEur(n: number): string { return "€" + n.toFixed(2); }

function shell(lang: "bg" | "en", subject: string, bodyHtml: string): string {
  const t = T[lang];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Manrope:wght@300;400;500;600;700&display=swap');</style>
</head><body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
  <tr><td style="padding:32px 44px 24px;border-bottom:1px solid rgba(185,137,74,0.35);font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;text-transform:uppercase">${lang === "bg" ? "Маргел" : "Margel"}&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em></td></tr>
  <tr><td style="padding:40px 44px 32px">${bodyHtml}</td></tr>
  <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}"><strong style="color:#C9A86A;text-transform:uppercase;letter-spacing:0.16em">${lang === "bg" ? "Маргел" : "Margel"} 360°</strong> · ${t.address}<br><a href="mailto:360@margel.info" style="color:#F6F1E8;text-decoration:none">360@margel.info</a></td></tr>
</table></td></tr></table></body></html>`;
}

function row(label: string, value: string, sub = ""): string {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid rgba(185,137,74,0.2);font:14px/1.45 ${SANS};color:#1A1815;vertical-align:top">${label}${sub ? `<br><span style="font:12px/1.4 ${SANS};color:#7A7568">${sub}</span>` : ""}</td>
    <td align="right" style="padding:9px 0 9px 16px;border-bottom:1px solid rgba(185,137,74,0.2);font:500 14px/1.45 ${SANS};color:#1A1815;white-space:nowrap;vertical-align:top">${value}</td>
  </tr>`;
}
function sectionTitle(text: string): string {
  return `<p style="margin:26px 0 6px;font:600 11px/1.2 ${SANS};letter-spacing:0.18em;text-transform:uppercase;color:#7A7568">${text}</p>`;
}

export function renderAddonReminder(i: ReminderInput): { subject: string; html: string } {
  const t = T[i.lang];
  const date = fmtDate(i.preferredDate);
  const subject = t.subject(date);

  const haveRows = i.have.length
    ? i.have.map(l => row(esc(l.name) + (l.qty != null ? ` <span style="color:#7A7568">× ${esc(l.qty)}</span>` : ""), fmtEur(l.price))).join("")
    : row(`<span style="color:#7A7568">${t.noAddons}</span>`, "");
  const haveTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${haveRows}${row(`<span style="color:#7A7568">${t.drinks(i.drinkCount)}</span>`, "")}</table>`;

  const missingBlock = i.missing.length
    ? sectionTitle(t.missing) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${
        i.missing.map(a => {
          const hint = i.lang === "bg" ? a.hint_bg : a.hint_en;
          const isQty = a.free_until != null || a.max_qty != null;
          return row(esc(catalogName(a, i.lang)), fmtEur(a.price_eur) + (isQty ? t.perPiece : ""), hint ? esc(hint) : "");
        }).join("")
      }</table>`
    : "";

  const cta = i.editToken
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 20px"><tr><td>
        <a href="${i.siteUrl}/edit.html?token=${esc(i.editToken)}" style="display:inline-block;padding:14px 28px;background:#1A1815;color:#F6F1E8;font:600 12px/1 ${SANS};letter-spacing:0.14em;text-transform:uppercase;text-decoration:none">${t.cta}</a>
      </td></tr></table>`
    : `<div style="margin:28px 0 0"></div>`;

  const body = `
    <h1 style="margin:0 0 12px;font:400 34px/1.12 ${SERIF};color:#1A1815">${t.h1}</h1>
    <p style="margin:0 0 8px;font:16px/1.55 ${SANS};color:#2A2620">${t.hello}, ${esc(i.firstName)}. ${t.intro(date, i.daysToEvent)}</p>
    ${sectionTitle(t.have)}
    ${haveTable}
    ${missingBlock}
    ${cta}
    <p style="margin:0;font:13px/1.6 ${SANS};color:#7A7568">${t.footer}</p>`;

  return { subject, html: shell(i.lang, subject, body) };
}
