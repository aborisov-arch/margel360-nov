import type { DiffEntry } from "./diff.ts";

type Enquiry = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  event_type: string;
  event_id?: string | null;
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

// Venue base prices (EUR) keyed by event_id, mirroring the public reservation
// catalog. Kept here so emails can show a single grand total without a network
// round-trip; update both places if pricing changes.
const VENUE_BASE_PRICE_EUR: Record<string, number> = {
  evening: 1280,
  corp4: 330,
  corp8: 440,
  bday_day: 700,
  bday_eve: 970,
  wedding: 1500,
};

function venueBasePrice(eventId: string | null | undefined): number {
  if (!eventId) return 0;
  return VENUE_BASE_PRICE_EUR[eventId] ?? 0;
}

function computeTotals(e: Enquiry): {
  venue: number; addons: number; drinks: number; total: number;
} {
  const venue = venueBasePrice(e.event_id);
  const addons = (e.addons ?? []).reduce(
    (sum, a) => sum + addonPriceEur(a?.id, Number(a?.price) || 0), 0,
  );
  const drinks = (e.drinks ?? []).reduce(
    (sum, d) => sum + (Number(d?.price_eur) || 0) * (Number(d?.qty) || 0), 0,
  );
  return { venue, addons, drinks, total: venue + addons + drinks };
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Old BGN prices used by the public reservation form before 2026-05-04.
// Enquiries created before that cutover stored addon prices in BGN; everything
// since stores them in EUR directly. Both shapes still live in the DB, so the
// displayer detects which it has by checking whether the price matches the
// old BGN value for the addon's id.
const ADDON_BGN_PRICES: Record<string, number> = {
  dj: 587, photo2: 340, photo4: 580, booth2: 390, booth4: 560,
  arch: 760, wall_s: 355, wall_g: 355, flare_s: 440, flare_l: 790,
  fountain_s: 96, fountain_l: 160, led: 290, mic: 97, proj: 180,
  security: 196, hygiene: 156, wardrobe: 176, valet: 275,
  carpet_l: 148, candles_h: 100, numbers: 68,
};

function addonPriceEur(id: string | undefined, price: number): number {
  const oldBgn = id ? ADDON_BGN_PRICES[id] : undefined;
  return oldBgn != null && price === oldBgn ? price / 1.95583 : price;
}

function fmtEur(n: number, addonId?: string): string {
  return "€" + addonPriceEur(addonId, n).toFixed(2);
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
  const firstName = (e.full_name || "").split(" ")[0] || e.full_name || "";
  const timeLabel = e.time_of_day === "day" ? "Дневно · до 17:30" : "Вечерно · след 19:00";

  const FONT  = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const INK   = "#111111";
  const MUTED = "#666666";
  const LINE  = "#E5E5E5";
  const ACCENT = "#B9894A";

  const rowCell  = `padding:10px 0;border-bottom:1px solid ${LINE};font:14px/1.4 ${FONT};color:${INK}`;
  const rowPrice = `padding:10px 0;border-bottom:1px solid ${LINE};font:14px/1.4 ${FONT};color:${MUTED};text-align:right;white-space:nowrap`;

  const addonRows = (e.addons ?? []).map(a =>
    `<tr><td style="${rowCell}">${esc(a.name)}</td><td style="${rowPrice}">${fmtEur(a.price, a.id)}</td></tr>`
  ).join("");

  const drinkRows = (e.drinks ?? []).map(d => {
    const qty = Number.isInteger(Number(d.qty)) ? Number(d.qty) : 0;
    const lineTotal = (Number(d.price_eur) || 0) * qty;
    const lineLabel = lineTotal > 0 ? `× ${qty} — €${lineTotal.toFixed(2)}` : `× ${qty}`;
    return `<tr><td style="${rowCell}">${esc(d.name)}</td><td style="${rowPrice}">${lineLabel}</td></tr>`;
  }).join("");

  const totals = computeTotals(e);
  const totalRows = `
    ${totals.venue ? `<tr><td style="padding:8px 0;font:14px/1.4 ${FONT};color:${MUTED}">Зала · ${esc(e.event_type)}</td><td style="padding:8px 0;font:14px/1.4 ${FONT};color:${INK};text-align:right;white-space:nowrap">€${totals.venue.toFixed(2)}</td></tr>` : ""}
    ${totals.addons ? `<tr><td style="padding:8px 0;font:14px/1.4 ${FONT};color:${MUTED}">Допълнителни услуги</td><td style="padding:8px 0;font:14px/1.4 ${FONT};color:${INK};text-align:right;white-space:nowrap">€${totals.addons.toFixed(2)}</td></tr>` : ""}
    ${totals.drinks ? `<tr><td style="padding:8px 0;font:14px/1.4 ${FONT};color:${MUTED}">Напитки</td><td style="padding:8px 0;font:14px/1.4 ${FONT};color:${INK};text-align:right;white-space:nowrap">€${totals.drinks.toFixed(2)}</td></tr>` : ""}
    <tr><td style="padding:16px 0 0;border-top:1px solid ${INK};font:600 14px/1.4 ${FONT};color:${INK}">Обща сума</td><td style="padding:16px 0 0;border-top:1px solid ${INK};font:700 22px/1.2 ${FONT};color:${ACCENT};text-align:right;white-space:nowrap">€${totals.total.toFixed(2)}</td></tr>
  `;

  const sectionTitle = (txt: string) =>
    `<p style="margin:0 0 12px;font:600 11px/1.2 ${FONT};letter-spacing:0.12em;color:${MUTED};text-transform:uppercase">${txt}</p>`;

  const subject = `Маргел 360° · ${esc(e.event_type)} · ${fmtDateBg(e.preferred_date)} · €${totals.total.toFixed(2)}`;

  const html = `<!doctype html>
<html lang="bg"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title>
<style>
  @media only screen and (max-width:540px) {
    .email-wrap { padding: 16px 0 !important; }
    .email-card { width: 100% !important; max-width: 100% !important; }
    .email-body { padding: 28px 22px !important; }
    .h1 { font-size: 24px !important; }
    .email-cta { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    .meta-cell { display: block !important; width: 100% !important; padding: 8px 0 !important; border-bottom: 1px solid ${LINE} !important; }
    .meta-cell:last-child { border-bottom: 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:${FONT};color:${INK};-webkit-font-smoothing:antialiased">

<div style="display:none;font-size:1px;color:#F5F5F5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
  Запитване за ${esc(e.event_type)} на ${fmtDateBg(e.preferred_date)} · общо €${totals.total.toFixed(2)}.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-wrap" style="background:#F5F5F5;padding:32px 0">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background:#FFFFFF;max-width:560px;width:100%;border-radius:8px">

      <tr><td class="email-body" style="padding:40px 40px 32px">

        <p style="margin:0 0 32px;font:600 14px/1.2 ${FONT};letter-spacing:0.18em;color:${INK};text-transform:uppercase">
          МАРГЕЛ 360°
        </p>

        <h1 class="h1" style="margin:0 0 8px;font:600 28px/1.2 ${FONT};color:${INK}">
          Здравейте, ${esc(firstName)}
        </h1>
        <p style="margin:0 0 28px;font:16px/1.5 ${FONT};color:${MUTED}">
          Получихме вашето запитване. Ще се свържем с вас до 24 часа за потвърждение.
        </p>

        ${sectionTitle("Детайли")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">
          <tr>
            <td class="meta-cell" valign="top" style="padding:0 16px 0 0;width:33%">
              <p style="margin:0 0 4px;font:13px/1.4 ${FONT};color:${MUTED}">Събитие</p>
              <p style="margin:0;font:600 15px/1.4 ${FONT};color:${INK}">${esc(e.event_type)}</p>
            </td>
            <td class="meta-cell" valign="top" style="padding:0 16px 0 0;width:33%">
              <p style="margin:0 0 4px;font:13px/1.4 ${FONT};color:${MUTED}">Дата</p>
              <p style="margin:0;font:600 15px/1.4 ${FONT};color:${INK}">${fmtDateBg(e.preferred_date)}</p>
            </td>
            <td class="meta-cell" valign="top" style="width:34%">
              <p style="margin:0 0 4px;font:13px/1.4 ${FONT};color:${MUTED}">Гости</p>
              <p style="margin:0;font:600 15px/1.4 ${FONT};color:${INK}">${e.guests ?? "—"}</p>
            </td>
          </tr>
          <tr><td colspan="3" style="height:14px"></td></tr>
          <tr>
            <td class="meta-cell" valign="top" style="padding:0 16px 0 0;width:33%">
              <p style="margin:0 0 4px;font:13px/1.4 ${FONT};color:${MUTED}">Час</p>
              <p style="margin:0;font:15px/1.4 ${FONT};color:${INK}">${timeLabel}</p>
            </td>
            <td class="meta-cell" valign="top" colspan="2">
              <p style="margin:0 0 4px;font:13px/1.4 ${FONT};color:${MUTED}">Телефон</p>
              <p style="margin:0;font:15px/1.4 ${FONT};color:${INK}">${esc(e.phone)}</p>
            </td>
          </tr>
        </table>

        ${addonRows ? `
        ${sectionTitle("Допълнителни услуги")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">${addonRows}</table>` : ""}

        ${drinkRows ? `
        ${sectionTitle("Напитки")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">${drinkRows}</table>` : ""}

        ${e.notes ? `
        ${sectionTitle("Бележки")}
        <p style="margin:0 0 28px;padding:14px 16px;background:#F5F5F5;border-radius:6px;font:14px/1.5 ${FONT};color:${INK};white-space:pre-wrap">${esc(e.notes)}</p>` : ""}

        ${sectionTitle("Обобщение")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px">${totalRows}</table>
        <p style="margin:0 0 32px;font:12px/1.5 ${FONT};color:${MUTED}">
          Сумата е ориентировъчна и подлежи на потвърждение.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">
          <tr><td>
            <a class="email-cta" href="${editUrl}" style="display:inline-block;padding:14px 28px;background:${INK};color:#FFFFFF;font:600 14px/1 ${FONT};text-decoration:none;border-radius:6px">
              Редактирай резервацията
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font:12px/1.5 ${FONT};color:${MUTED}">
          Линкът е валиден до ${fmtExpiryBg(e.token_expires_at)}.
        </p>

      </td></tr>

      <tr><td style="padding:24px 40px;border-top:1px solid ${LINE};background:#FAFAFA;border-radius:0 0 8px 8px">
        <p style="margin:0 0 6px;font:600 13px/1.4 ${FONT};color:${INK}">Маргел 360°</p>
        <p style="margin:0;font:13px/1.6 ${FONT};color:${MUTED}">
          бул. Околовръстен път 155, ет. 4, София 1618<br>
          <a href="mailto:360@margel.info" style="color:${MUTED};text-decoration:underline">360@margel.info</a>
          &nbsp;·&nbsp;
          <a href="tel:+359888100042" style="color:${MUTED};text-decoration:underline">+359 888 100 042</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject, html };
}

type LineItem = { id?: string; name?: string; qty?: number; price?: number };

const FIELD_LABEL: Record<string, string> = {
  guests:         "Guests",
  phone:          "Phone",
  notes:          "Notes",
  addons:         "Add-on services",
  drinks:         "Drinks",
  preferred_date: "Date",
};

function fmtAddon(a: LineItem): string {
  const name  = String(a?.name ?? a?.id ?? "?");
  const qty   = typeof a?.qty   === "number" && a.qty   > 0 ? ` × ${a.qty}` : "";
  const price = typeof a?.price === "number" && a.price > 0 ? ` — ${fmtEur(a.price, a.id)}` : "";
  return `${name}${qty}${price}`;
}

function fmtDrink(d: LineItem): string {
  const name = String(d?.name ?? d?.id ?? "?");
  const qty  = typeof d?.qty === "number" ? ` × ${d.qty}` : "";
  return `${name}${qty}`;
}

/** Render an array-field diff as a human-readable Added / Removed / Changed list. */
function fmtArrayDiff(field: "addons" | "drinks", before: unknown, after: unknown): string {
  const b: LineItem[] = Array.isArray(before) ? before as LineItem[] : [];
  const a: LineItem[] = Array.isArray(after)  ? after  as LineItem[] : [];
  const bMap = new Map(b.filter(x => x?.id).map(x => [x.id!, x]));
  const aMap = new Map(a.filter(x => x?.id).map(x => [x.id!, x]));

  const removed = b.filter(x => x?.id && !aMap.has(x.id));
  const added   = a.filter(x => x?.id && !bMap.has(x.id));
  const changed = a
    .filter(x => x?.id && bMap.has(x.id))
    .map(x => ({ from: bMap.get(x.id!)!, to: x }))
    .filter(p => (p.from.qty ?? 0) !== (p.to.qty ?? 0)
              || (p.from.price ?? 0) !== (p.to.price ?? 0));

  const fmt = field === "addons" ? fmtAddon : fmtDrink;
  const lines: string[] = [];
  if (removed.length) {
    lines.push("    Removed:");
    for (const r of removed) lines.push(`      − ${fmt(r)}`);
  }
  if (added.length) {
    lines.push("    Added:");
    for (const x of added) lines.push(`      + ${fmt(x)}`);
  }
  if (changed.length) {
    lines.push("    Changed:");
    for (const c of changed) lines.push(`      • ${fmt(c.from)}  →  ${fmt(c.to)}`);
  }
  return lines.length ? lines.join("\n") : "    (no item-level differences)";
}

function fmtScalar(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v);
}

/** Render the owner email (plain text, with optional diff). */
export function renderOwnerEmail(
  e: Enquiry,
  reason: "created" | "updated",
  diff: DiffEntry[] | null,
): { subject: string; text: string } {
  const subjectPrefix = reason === "updated" ? "[Редактирана резервация] " : "";
  const totals = computeTotals(e);
  const subject = `${subjectPrefix}${e.full_name} — ${e.event_type} — ${e.preferred_date} — €${totals.total.toFixed(2)}`;

  const addonsText = (e.addons ?? []).map(a => `  - ${a.name}: ${fmtEur(a.price, a.id)}`).join("\n");
  const drinksText = (e.drinks ?? []).map(d => {
    const line = (Number(d.price_eur) || 0) * (Number(d.qty) || 0);
    return line > 0
      ? `  - ${d.name} × ${d.qty} — €${line.toFixed(2)}`
      : `  - ${d.name} × ${d.qty}`;
  }).join("\n");
  const timeLabel = e.time_of_day === "day" ? "Daytime (until 17:30)" : "Evening (after 19:00)";

  const totalsBlock = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "TOTAL",
    `  Venue base:     €${totals.venue.toFixed(2)}`,
    `  Add-ons:        €${totals.addons.toFixed(2)}`,
    `  Drinks:         €${totals.drinks.toFixed(2)}`,
    `  ──────────────────────────`,
    `  GRAND TOTAL:    €${totals.total.toFixed(2)}`,
    "",
  ];

  const diffBlock = reason === "updated" && diff && diff.length
    ? [
        "CHANGED FIELDS",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ...diff.flatMap(d => {
          const label = FIELD_LABEL[d.field] ?? d.field;
          if (d.field === "addons" || d.field === "drinks") {
            return [`  ${label}:`, fmtArrayDiff(d.field, d.before, d.after), ""];
          }
          return [
            `  ${label}:`,
            `    before: ${fmtScalar(d.before)}`,
            `    after:  ${fmtScalar(d.after)}`,
            "",
          ];
        }),
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
    ...totalsBlock,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");

  return { subject, text };
}
