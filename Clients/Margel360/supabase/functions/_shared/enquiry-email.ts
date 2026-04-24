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

/** Render the customer-facing HTML summary email (Bulgarian). */
export function renderCustomerEmail(e: Enquiry, siteUrl: string): { subject: string; html: string } {
  const editUrl = `${siteUrl.replace(/\/$/, "")}/edit.html?token=${e.edit_token}`;
  const firstName = (e.full_name || "").split(" ")[0] || e.full_name || "";
  const timeLabel = e.time_of_day === "day" ? "Дневно (до 17:30)" : "Вечерно (след 19:00)";

  const addonRows = (e.addons ?? []).map(a =>
    `<tr><td style="padding:6px 0;color:#333">${esc(a.name)}</td><td style="padding:6px 0;text-align:right;color:#333">${fmtEur(a.price)}</td></tr>`
  ).join("");
  const drinkRows = (e.drinks ?? []).map(d =>
    `<tr><td style="padding:6px 0;color:#333">${esc(d.name)} × ${d.qty}</td><td></td></tr>`
  ).join("");

  const subject = `Обобщение на вашата резервация — ${esc(e.event_type)}, ${fmtDateBg(e.preferred_date)}`;

  const html = `<!doctype html>
<html lang="bg"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title>
<style>
  @media only screen and (max-width:520px) {
    .email-wrap { padding: 12px 0 !important; }
    .email-card { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
    .email-header { padding: 18px 20px !important; }
    .email-body { padding: 22px 20px !important; }
    .email-edit-box { padding: 16px 18px !important; }
    .email-cta { display: block !important; box-sizing: border-box !important; width: 100% !important; padding: 14px 18px !important; text-align: center !important; }
    .email-footer { padding: 16px 20px !important; line-height: 1.5 !important; }
    .email-h3 { font-size: 15px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-wrap" style="background:#f4f4f4;padding:24px 0">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-card" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
      <tr><td class="email-header" style="padding:24px 32px;background:#1a1a1a;color:#fff">
        <div style="font-size:20px;font-weight:700;letter-spacing:1px">МАРГЕЛ <span style="color:#c9a86a">360°</span></div>
      </td></tr>
      <tr><td class="email-body" style="padding:32px">
        <p style="margin:0 0 16px;font-size:16px;color:#333">Здравейте, ${esc(firstName)},</p>
        <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.5">
          Получихме вашето запитване. Ето обобщение на избраното от вас:
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#333">
          <tr><td style="padding:6px 0;color:#666">Събитие</td><td style="padding:6px 0;text-align:right"><strong>${esc(e.event_type)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666">Дата</td><td style="padding:6px 0;text-align:right">${fmtDateBg(e.preferred_date)}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Час</td><td style="padding:6px 0;text-align:right">${timeLabel}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Гости</td><td style="padding:6px 0;text-align:right">${e.guests ?? "—"}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Телефон</td><td style="padding:6px 0;text-align:right">${esc(e.phone)}</td></tr>
        </table>

        ${addonRows ? `
        <h3 class="email-h3" style="margin:24px 0 8px;font-size:14px;color:#1a1a1a">Допълнителни услуги</h3>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
          ${addonRows}
        </table>` : ""}

        ${drinkRows ? `
        <h3 class="email-h3" style="margin:24px 0 8px;font-size:14px;color:#1a1a1a">Напитки</h3>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
          ${drinkRows}
        </table>` : ""}

        ${e.notes ? `
        <h3 class="email-h3" style="margin:24px 0 8px;font-size:14px;color:#1a1a1a">Бележки</h3>
        <p style="margin:0;font-size:14px;color:#333;line-height:1.5;white-space:pre-wrap">${esc(e.notes)}</p>` : ""}

        <p style="margin:24px 0 0;font-size:14px;color:#555;line-height:1.5">
          Нашият екип ще се свърже с вас в рамките на 24 часа за потвърждение и финална цена.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;background:#f6f6f6;border-radius:6px">
          <tr><td class="email-edit-box" style="padding:20px;font-size:14px;color:#333">
            <strong>Искате да промените нещо?</strong><br>
            Можете да редактирате своята резервация — брой гости, допълнителни услуги, специални желания — директно от тази страница:
            <br><br>
            <a href="${editUrl}" class="email-cta" style="display:inline-block;padding:10px 18px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:4px;font-weight:500">
              Редактирай резервацията
            </a>
            <br><br>
            <span style="font-size:12px;color:#888">
              Линкът е валиден до ${fmtExpiryBg(e.token_expires_at)}. Ако трябва да промените датата, моля свържете се с нас.
            </span>
          </td></tr>
        </table>
      </td></tr>
      <tr><td class="email-footer" style="padding:20px 32px;background:#fafafa;font-size:12px;color:#888;text-align:center">
        МАРГЕЛ 360° &middot; бул. Околовръстен път 155, София 1618 &middot; <a href="mailto:360@margel.info" style="color:#666">360@margel.info</a>
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
