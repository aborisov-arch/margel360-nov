import type { DiffEntry } from "./diff.ts";

type Enquiry = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  event_type: string;
  preferred_date: string;
  time_of_day: string;
  guests: number | null;
  addons: Array<{ id: string; name: string; price: number }> | null;
  drinks: Array<{ id: string; name: string; qty: number; price_eur?: number | null }> | null;
  payment_method: string;
  notes: string | null;
  edit_token: string;
  token_expires_at: string | null;
};

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtEur(n: number): string {
  // Mirror notify-enquiry format for consistency with the existing owner email.
  return "€" + (n / 1.95583).toFixed(2);
}

function fmtDateBg(stored: string): string {
  // preferred_date is stored as "DD/MM/YYYY" text (flatpickr d/m/Y from reservation.js).
  return String(stored ?? "").replaceAll("/", ".");
}

function fmtExpiryBg(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "long", year: "numeric" });
}

/** Render the customer-facing HTML summary email (Bulgarian).
 *
 * Editorial "salon sauvage moderne" direction: cream paper, ink type,
 * warm bronzed gold rule lines, Fraunces display serif + Manrope body.
 * Reads like a hand-written invitation from the venue manager.
 */
export function renderCustomerEmail(e: Enquiry, siteUrl: string): { subject: string; html: string } {
  const site = siteUrl.replace(/\/$/, "");
  const editUrl = `${site}/edit.html?token=${e.edit_token}`;
  const bookingUrl = `${site}/booking.html?token=${e.edit_token}`;
  const firstName = (e.full_name || "").split(" ")[0] || e.full_name || "";
  const timeLabel = e.time_of_day === "day" ? "Дневно · до 17:30" : "Вечерно · след 19:00";

  const addonRows = (e.addons ?? []).map(a =>
    `<tr>
       <td style="padding:9px 0;border-bottom:1px dashed rgba(185,137,74,0.25);font-family:Manrope,Arial,sans-serif;font-size:14px;color:#1A1815">${esc(a.name)}</td>
       <td style="padding:9px 0;border-bottom:1px dashed rgba(185,137,74,0.25);font-family:Fraunces,Georgia,serif;font-style:italic;font-size:14px;color:#B9894A;text-align:right;white-space:nowrap">${fmtEur(a.price)}</td>
     </tr>`
  ).join("");

  const drinkRows = (e.drinks ?? []).map(d => {
    const qty = Number.isInteger(Number(d.qty)) ? Number(d.qty) : 0;
    return `<tr>
       <td style="padding:9px 0;border-bottom:1px dashed rgba(185,137,74,0.25);font-family:Manrope,Arial,sans-serif;font-size:14px;color:#1A1815">${esc(d.name)}</td>
       <td style="padding:9px 0;border-bottom:1px dashed rgba(185,137,74,0.25);font-family:Fraunces,Georgia,serif;font-style:italic;font-size:14px;color:#B9894A;text-align:right;white-space:nowrap">× ${qty}</td>
     </tr>`;
  }).join("");

  const subject = `Вашата резервация в Маргел 360° · ${esc(e.event_type)} · ${fmtDateBg(e.preferred_date)}`;

  // Inline styles throughout for email-client compatibility. The <style>
  // block only handles mobile reflow (many clients strip <style>).
  const html = `<!doctype html>
<html lang="bg"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Manrope:wght@300;400;500;600;700&display=swap');
  @media only screen and (max-width:540px) {
    .email-wrap { padding: 0 !important; }
    .email-card { width: 100% !important; max-width: 100% !important; }
    .email-header { padding: 24px 24px !important; }
    .email-body { padding: 28px 22px 24px !important; }
    .display { font-size: 32px !important; line-height: 1.08 !important; }
    .lead { font-size: 15px !important; }
    .section-title { font-size: 11px !important; }
    .email-cta { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; padding: 16px 20px !important; }
    .email-footer { padding: 20px 22px !important; }
    .meta-cell { display: block !important; width: 100% !important; text-align: left !important; padding: 6px 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F6F1E8;font-family:Manrope,system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:#1A1815;-webkit-font-smoothing:antialiased">

<!-- Preheader: hidden in body but shown in email list preview -->
<div style="display:none;font-size:1px;color:#F6F1E8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
  Получихме запитването ви за ${esc(e.event_type)} на ${fmtDateBg(e.preferred_date)}. Благодарим, ${esc(firstName)}.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-wrap" style="background:#F6F1E8;padding:32px 0">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background:#FDFBF7;max-width:600px;width:100%">

      <!-- Masthead -->
      <tr><td class="email-header" style="padding:36px 44px 28px;border-bottom:1px solid rgba(185,137,74,0.35)">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" style="font-family:Fraunces,Georgia,serif;font-weight:500;font-size:18px;letter-spacing:0.18em;color:#1A1815;text-transform:uppercase">
              Маргел&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em>
            </td>
            <td align="right" style="font-family:Fraunces,Georgia,serif;font-style:italic;font-size:12px;color:#7A7568">
              ${fmtDateBg(e.preferred_date)}
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Letter -->
      <tr><td class="email-body" style="padding:44px 44px 36px">

        <p style="margin:0 0 10px;font-family:Manrope,Arial,sans-serif;font-weight:600;font-size:11px;letter-spacing:0.2em;color:#B9894A;text-transform:uppercase" class="section-title">
          Потвърждение на запитване
        </p>

        <h1 class="display" style="margin:0 0 22px;font-family:Fraunces,Georgia,serif;font-weight:400;font-size:42px;line-height:1.08;letter-spacing:-0.022em;color:#1A1815">
          Благодарим, <em style="font-style:italic;color:#B9894A">${esc(firstName)}</em>.
        </h1>

        <p class="lead" style="margin:0 0 28px;font-family:Manrope,Arial,sans-serif;font-weight:400;font-size:16px;line-height:1.55;color:#2A2620">
          Получихме вашето запитване за <strong style="font-weight:600">${esc(e.event_type)}</strong> на
          <strong style="font-weight:600">${fmtDateBg(e.preferred_date)}</strong>. По-долу е обобщение на избраното от вас — ще се свържем с вас в рамките на 24 часа за потвърждение и финалните детайли.
        </p>

        <hr style="border:0;border-top:1px solid rgba(185,137,74,0.35);margin:0 0 28px">

        <!-- Meta -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px">
          <tr>
            <td class="meta-cell" valign="top" style="padding:0 18px 0 0;width:33%">
              <p style="margin:0 0 4px;font-family:Manrope,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;color:#7A7568;text-transform:uppercase">Час</p>
              <p style="margin:0;font-family:Fraunces,Georgia,serif;font-size:17px;color:#1A1815">${timeLabel}</p>
            </td>
            <td class="meta-cell" valign="top" style="padding:0 18px 0 0;width:33%">
              <p style="margin:0 0 4px;font-family:Manrope,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;color:#7A7568;text-transform:uppercase">Гости</p>
              <p style="margin:0;font-family:Fraunces,Georgia,serif;font-size:17px;color:#1A1815">${e.guests ?? "—"}</p>
            </td>
            <td class="meta-cell" valign="top" style="width:34%">
              <p style="margin:0 0 4px;font-family:Manrope,Arial,sans-serif;font-size:10px;letter-spacing:0.18em;color:#7A7568;text-transform:uppercase">Телефон</p>
              <p style="margin:0;font-family:Fraunces,Georgia,serif;font-size:17px;color:#1A1815">${esc(e.phone)}</p>
            </td>
          </tr>
        </table>

        ${addonRows ? `
        <p style="margin:0 0 14px;font-family:Manrope,Arial,sans-serif;font-weight:600;font-size:11px;letter-spacing:0.18em;color:#1A1815;text-transform:uppercase" class="section-title">
          <span style="color:#B9894A;font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:400">i.</span>&nbsp;&nbsp;Допълнителни услуги
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">
          ${addonRows}
        </table>` : ""}

        ${drinkRows ? `
        <p style="margin:0 0 14px;font-family:Manrope,Arial,sans-serif;font-weight:600;font-size:11px;letter-spacing:0.18em;color:#1A1815;text-transform:uppercase" class="section-title">
          <span style="color:#B9894A;font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:400">ii.</span>&nbsp;&nbsp;Напитки
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">
          ${drinkRows}
        </table>` : ""}

        ${e.notes ? `
        <p style="margin:0 0 12px;font-family:Manrope,Arial,sans-serif;font-weight:600;font-size:11px;letter-spacing:0.18em;color:#1A1815;text-transform:uppercase" class="section-title">
          <span style="color:#B9894A;font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:400">iii.</span>&nbsp;&nbsp;Бележки
        </p>
        <p style="margin:0 0 28px;padding:16px 18px;border-left:2px solid #B9894A;background:#F6F1E8;font-family:Fraunces,Georgia,serif;font-style:italic;font-size:16px;line-height:1.5;color:#2A2620;white-space:pre-wrap">„${esc(e.notes)}"</p>` : ""}

        <hr style="border:0;border-top:1px solid rgba(185,137,74,0.35);margin:8px 0 28px">

        <!-- CTA -->
        <p style="margin:0 0 10px;font-family:Fraunces,Georgia,serif;font-style:italic;font-size:20px;color:#1A1815">
          Желаете промени?
        </p>
        <p style="margin:0 0 20px;font-family:Manrope,Arial,sans-serif;font-size:14px;line-height:1.55;color:#2A2620">
          Можете да обновите броя гости, услугите и датата директно. Всяка промяна ще бъде потвърдена с ново обобщение по имейл.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px">
          <tr>
            <td>
              <a class="email-cta" href="${editUrl}" style="display:inline-block;padding:14px 28px;background:#1A1815;color:#F6F1E8;font-family:Manrope,Arial,sans-serif;font-weight:600;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none">
                Редактирай резервацията
              </a>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 24px;font-family:Manrope,Arial,sans-serif;font-size:12px;line-height:1.55;color:#7A7568">
          Или разгледайте програмата си <a href="${bookingUrl}" style="color:#1A1815;border-bottom:1px solid #B9894A;text-decoration:none">тук</a>.
        </p>

        <p style="margin:0;font-family:Manrope,Arial,sans-serif;font-size:11px;line-height:1.6;color:#7A7568">
          Линкът е валиден до <em style="font-family:Fraunces,Georgia,serif;font-style:italic;color:#1A1815">${fmtExpiryBg(e.token_expires_at)}</em>. Ако трябва да променим датата извън този период, моля свържете се с нас.
        </p>

        <hr style="border:0;border-top:1px solid rgba(185,137,74,0.35);margin:32px 0 24px">

        <!-- Signature -->
        <p style="margin:0 0 2px;font-family:Fraunces,Georgia,serif;font-style:italic;font-size:17px;color:#1A1815">
          С най-добри пожелания,
        </p>
        <p style="margin:0;font-family:Manrope,Arial,sans-serif;font-weight:600;font-size:12px;letter-spacing:0.16em;color:#1A1815;text-transform:uppercase">
          — Екипът на Маргел&nbsp;360°
        </p>
      </td></tr>

      <!-- Colophon -->
      <tr><td class="email-footer" style="padding:28px 44px;background:#1A1815;color:#C9A86A;font-family:Manrope,Arial,sans-serif;font-size:11px;line-height:1.6;letter-spacing:0.04em">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="top" style="color:#C9A86A;text-transform:uppercase;letter-spacing:0.16em;font-weight:600">
              Маргел&nbsp;<em style="font-style:italic;color:#F6F1E8;font-weight:400">360°</em>
            </td>
            <td valign="top" align="right" style="color:#7A7568">
              <a href="mailto:360@margel.info" style="color:#F6F1E8;text-decoration:none;border-bottom:1px solid rgba(201,168,106,0.5)">360@margel.info</a>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:10px;color:#7A7568">
              бул. Околовръстен път 155 · ет. 4 · София 1618
            </td>
          </tr>
        </table>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject, html };
}

/** Render the owner email (plain text, with optional diff). */
export function renderOwnerEmail(
  e: Enquiry,
  reason: "created" | "updated",
  diff: DiffEntry[] | null,
): { subject: string; text: string } {
  const subjectPrefix = reason === "updated" ? "[Редактирана резервация] " : "";
  const subject = `${subjectPrefix}${e.full_name} — ${e.event_type} — ${e.preferred_date}`;

  const addonsText = (e.addons ?? []).map(a => `  - ${a.name}: ${fmtEur(a.price)}`).join("\n");
  const drinksText = (e.drinks ?? []).map(d => `  - ${d.name} × ${d.qty}`).join("\n");
  const timeLabel = e.time_of_day === "day" ? "Daytime (until 17:30)" : "Evening (after 19:00)";

  const diffBlock = reason === "updated" && diff && diff.length
    ? [
        "CHANGED FIELDS",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ...diff.map(d => `  ${d.field}:\n    before: ${JSON.stringify(d.before)}\n    after:  ${JSON.stringify(d.after)}`),
        "",
      ]
    : [];

  const text = [
    reason === "updated"
      ? `Customer edited their enquiry at Margel 360°`
      : `New enquiry received at Margel 360°`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    ...diffBlock,
    `Name:           ${e.full_name}`,
    `Email:          ${e.email}`,
    `Phone:          ${e.phone}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    `Event:          ${e.event_type}`,
    `Date:           ${e.preferred_date}`,
    `Time:           ${timeLabel}`,
    `Guests:         ${e.guests ?? "—"}`,
    `Payment:        ${e.payment_method}`,
    "",
    ...(addonsText ? ["Add-on services:", addonsText, ""] : []),
    ...(drinksText ? ["Drinks:", drinksText, ""] : []),
    ...(e.notes ? ["Notes:", e.notes, ""] : []),
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");

  return { subject, text };
}
