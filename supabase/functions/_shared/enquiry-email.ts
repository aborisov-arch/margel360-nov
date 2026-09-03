import type { DiffEntry } from "./diff.ts";
import { localizedItemName } from "./item-names.ts";

type Enquiry = {
  id: string;
  enquiry_number?: number | null;
  full_name: string;
  email: string;
  phone: string;
  event_type: string;
  event_id?: string | null;
  preferred_date: string;
  time_of_day: string;
  arrival_time?: string | null;
  guests: number | null;
  addons: Array<{ id: string; name: string; price: number }> | null;
  drinks: Array<{ id: string; name: string; qty: number; price_eur?: number | null }> | null;
  partner_interest?: Array<{ id: string; name: string; category: string }> | null;
  payment_method: string;
  notes: string | null;
  applied_discount_percent?: number | null;
  venue_price_eur?: number | string | null;
  edit_token: string;
  token_expires_at: string | null;
  lang?: string | null;   // 'bg' | 'en' — the language the customer used; defaults to 'bg'.
};

// Customer-email copy in both languages. The customer email is rendered in the
// language the customer used on the site (e.lang); item names come from the
// shared catalog (localizedItemName). Owner/team emails stay English below.
const EMAIL_T = {
  bg: {
    htmlLang: "bg", expiryLocale: "bg-BG", brand: "Маргел",
    timeDayFallback: "Дневно · до 17:30", timeEveningFallback: "Вечерно · след 19:00", timeEveningFrom: "Вечерно · от",
    venue: "Зала", upTo: "до", guests: "гости", extraGuests: "допълнителни гости",
    addons: "Допълнителни услуги", drinks: "Напитки", discount: "Отстъпка", total: "Обща сума",
    enquiry: "Запитване", hello: "Здравейте",
    received1: "Получихме вашето запитване", received2: ". Ще се свържем с вас до 24 часа за потвърждение.",
    details: "Детайли", l_event: "Събитие", l_date: "Дата", l_guests: "Гости", l_time: "Час", l_phone: "Телефон",
    notes: "Бележки", summary: "Обобщение", estimate: "Сумата е ориентировъчна и подлежи на потвърждение.",
    editCta: "Редактирай резервацията", linkValid: "Линкът е валиден до",
    footerAddress: "бул. Околовръстен път 155 · ет. 4 · София 1618",
    previewFor: "Запитване за", previewOn: "на", previewTotal: "общо",
  },
  en: {
    htmlLang: "en", expiryLocale: "en-GB", brand: "Margel",
    timeDayFallback: "Daytime · until 17:30", timeEveningFallback: "Evening · after 19:00", timeEveningFrom: "Evening · from",
    venue: "Venue", upTo: "up to", guests: "guests", extraGuests: "extra guests",
    addons: "Add-on services", drinks: "Drinks", discount: "Discount", total: "Total",
    enquiry: "Enquiry", hello: "Hello",
    received1: "We’ve received your enquiry", received2: ". We’ll be in touch within 24 hours to confirm.",
    details: "Details", l_event: "Event", l_date: "Date", l_guests: "Guests", l_time: "Time", l_phone: "Phone",
    notes: "Notes", summary: "Summary", estimate: "This is an estimate, subject to confirmation.",
    editCta: "Edit your reservation", linkValid: "This link is valid until",
    footerAddress: "155 Okolovrasten Pat Blvd · floor 4 · Sofia 1618",
    previewFor: "Enquiry for", previewOn: "on", previewTotal: "total",
  },
} as const;

// Event-type display names by event_id (parent ids + pricing variants). Stored
// event_type is always the English title; this overrides it in the customer's
// language. Unknown ids fall back to the stored value.
const EVENT_TITLES: Record<string, { bg: string; en: string }> = {
  evening:   { bg: "Вечерно събитие",      en: "Evening Event" },
  corporate: { bg: "Корпоративно събитие", en: "Corporate Event" },
  corp4:     { bg: "Корпоративно събитие", en: "Corporate Event" },
  corp8:     { bg: "Корпоративно събитие", en: "Corporate Event" },
  birthday:  { bg: "Детски рожден ден",    en: "Children's Birthday" },
  bday_day:  { bg: "Детски рожден ден",    en: "Children's Birthday" },
  bday_eve:  { bg: "Детски рожден ден",    en: "Children's Birthday" },
  wedding:   { bg: "Сватба",               en: "Wedding" },
};
function localizedEventType(e: { event_id?: string | null; event_type: string }, lang: "bg" | "en"): string {
  const entry = e.event_id ? EVENT_TITLES[e.event_id] : undefined;
  return entry ? entry[lang] : e.event_type;
}

// Venue base prices (EUR) keyed by event_id, mirroring the public reservation
// catalog. `enquiries.venue_price_eur` (stamped by submit-enquiry) is the
// authoritative source for rows created after that stamp shipped; this map is
// only the legacy fallback for older rows where the column is NULL.
const VENUE_BASE_PRICE_EUR: Record<string, number> = {
  evening: 1350,
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

// Venue rental covers up to 40 guests; each guest above that is billed
// separately at the rate below. Keep these constants in sync with the
// admin dashboard and the public reservation form.
const VENUE_MIN_GUESTS = 40;
const EXTRA_GUEST_FEE_EUR = 15;

function computeTotals(e: Enquiry): {
  venue: number;
  extraGuests: number; extraGuestsCost: number;
  addons: number; drinks: number;
  discountPercent: number; discount: number; total: number;
} {
  const venue = e.venue_price_eur != null
    ? Number(e.venue_price_eur)
    : venueBasePrice(e.event_id);
  const guests = Number(e.guests) || 0;
  const extraGuests = Math.max(0, guests - VENUE_MIN_GUESTS);
  const extraGuestsCost = extraGuests * EXTRA_GUEST_FEE_EUR;
  const addons = (e.addons ?? []).reduce(
    (sum, a) => sum + addonPriceEur(a?.id, Number(a?.price) || 0), 0,
  );
  const drinks = (e.drinks ?? []).reduce(
    (sum, d) => sum + (Number(d?.price_eur) || 0) * (Number(d?.qty) || 0), 0,
  );
  // Discount applies to the venue base only — same scope as the public
  // wizard's price summary.
  const discountPercent = Number(e.applied_discount_percent) || 0;
  const discount = discountPercent > 0 ? Math.round(venue * discountPercent) / 100 : 0;
  return {
    venue, extraGuests, extraGuestsCost, addons, drinks, discountPercent, discount,
    total: venue + extraGuestsCost + addons + drinks - discount,
  };
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

export function addonPriceEur(id: string | undefined, price: number): number {
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

function fmtExpiry(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
}

/** Render the customer-facing HTML summary email (Bulgarian).
 *
 * Editorial "salon sauvage moderne" direction: cream paper, ink type,
 * warm bronzed gold rule lines, Fraunces display serif + Manrope body.
 * Reads like a hand-written invitation from the venue manager.
 */
export function renderCustomerEmail(e: Enquiry, siteUrl: string): { subject: string; html: string } {
  const lang: "bg" | "en" = e.lang === "en" ? "en" : "bg";
  const t = EMAIL_T[lang];
  const site = siteUrl.replace(/\/$/, "");
  const editUrl = `${site}/edit.html?token=${e.edit_token}`;
  const firstName = (e.full_name || "").split(" ")[0] || e.full_name || "";
  const timeLabel = e.arrival_time
    ? `${t.timeEveningFrom} ${e.arrival_time}`
    : (e.time_of_day === "day" ? t.timeDayFallback : t.timeEveningFallback);

  // Editorial palette — cream paper + ink + brand gold accent.
  const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
  const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const INK    = "#1A1815";
  const SOFT   = "#2A2620";
  const MUTED  = "#7A7568";
  const PAPER  = "#FDFBF7";
  const CREAM  = "#F6F1E8";
  const GOLD   = "#B9894A";
  const GOLD_LINE = "rgba(185,137,74,0.35)";
  const GOLD_DASH = "rgba(185,137,74,0.25)";

  const rowCell  = `padding:9px 0;border-bottom:1px dashed ${GOLD_DASH};font:14px/1.4 ${SANS};color:${INK}`;
  const rowPrice = `padding:9px 0;border-bottom:1px dashed ${GOLD_DASH};font:italic 14px/1.4 ${SERIF};color:${GOLD};text-align:right;white-space:nowrap`;

  const addonRows = (e.addons ?? []).map(a =>
    `<tr><td style="${rowCell}">${esc(localizedItemName(a, lang))}</td><td style="${rowPrice}">${fmtEur(a.price, a.id)}</td></tr>`
  ).join("");

  const drinkRows = (e.drinks ?? []).map(d => {
    const qty = Number.isInteger(Number(d.qty)) ? Number(d.qty) : 0;
    const lineTotal = (Number(d.price_eur) || 0) * qty;
    const lineLabel = lineTotal > 0 ? `× ${qty} — €${lineTotal.toFixed(2)}` : `× ${qty}`;
    return `<tr><td style="${rowCell}">${esc(localizedItemName(d, lang))}</td><td style="${rowPrice}">${lineLabel}</td></tr>`;
  }).join("");

  const partnerRows = (e.partner_interest ?? []).map(p =>
    `<tr><td style="${rowCell}">${esc(p.name)}</td><td style="${rowPrice}">${p.category === "catering" ? "Кетъринг" : "Артист"}</td></tr>`
  ).join("");

  const totals = computeTotals(e);
  const totalLabel = `padding:8px 0;font:14px/1.4 ${SANS};color:${SOFT}`;
  const totalValue = `padding:8px 0;font:italic 14px/1.4 ${SERIF};color:${GOLD};text-align:right;white-space:nowrap`;
  const totalRows = `
    ${totals.venue ? `<tr><td style="${totalLabel}">${t.venue} · ${esc(localizedEventType(e, lang))} <span style="color:${MUTED};font-size:12px">(${t.upTo} ${VENUE_MIN_GUESTS} ${t.guests})</span></td><td style="${totalValue}">€${totals.venue.toFixed(2)}</td></tr>` : ""}
    ${totals.extraGuests > 0 ? `<tr><td style="${totalLabel}">+${totals.extraGuests} ${t.extraGuests} <span style="color:${MUTED};font-size:12px">(× €${EXTRA_GUEST_FEE_EUR})</span></td><td style="${totalValue}">€${totals.extraGuestsCost.toFixed(2)}</td></tr>` : ""}
    ${totals.addons ? `<tr><td style="${totalLabel}">${t.addons}</td><td style="${totalValue}">€${totals.addons.toFixed(2)}</td></tr>` : ""}
    ${totals.drinks ? `<tr><td style="${totalLabel}">${t.drinks}</td><td style="${totalValue}">€${totals.drinks.toFixed(2)}</td></tr>` : ""}
    ${totals.discount > 0 ? `<tr><td style="${totalLabel}">${t.discount} (${totals.discountPercent}%)</td><td style="padding:8px 0;font:italic 14px/1.4 ${SERIF};color:#2F8F4F;text-align:right;white-space:nowrap">−€${totals.discount.toFixed(2)}</td></tr>` : ""}
    <tr>
      <td style="padding:14px 0 0;border-top:2px solid ${INK};font:700 12px/1.4 ${SANS};letter-spacing:0.16em;color:${INK};text-transform:uppercase">${t.total}</td>
      <td style="padding:14px 0 0;border-top:2px solid ${INK};font:22px/1.2 ${SERIF};color:${GOLD};text-align:right;white-space:nowrap">€${totals.total.toFixed(2)}</td>
    </tr>
  `;

  const sectionTitle = (txt: string) =>
    `<p style="margin:0 0 14px;font:600 11px/1.2 ${SANS};letter-spacing:0.18em;color:${GOLD};text-transform:uppercase">${txt}</p>`;

  // Reference number — "#1001" — gives the customer something to quote
  // when they call or email about this booking.
  const refNo = e.enquiry_number != null ? `#${e.enquiry_number}` : "";
  const subject = `${t.brand} 360° · ${refNo ? refNo + " · " : ""}${esc(localizedEventType(e, lang))} · ${fmtDateBg(e.preferred_date)} · €${totals.total.toFixed(2)}`;

  const html = `<!doctype html>
<html lang="${t.htmlLang}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Manrope:wght@300;400;500;600;700&display=swap');
  @media only screen and (max-width:540px) {
    .email-wrap { padding: 16px 0 !important; }
    .email-card { width: 100% !important; max-width: 100% !important; }
    .email-body { padding: 32px 24px !important; }
    .display { font-size: 30px !important; line-height: 1.1 !important; }
    .email-cta { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    .meta-cell { display: block !important; width: 100% !important; padding: 8px 0 !important; border-bottom: 1px dashed ${GOLD_DASH} !important; }
    .meta-cell:last-child { border-bottom: 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:${SANS};color:${INK};-webkit-font-smoothing:antialiased">

<div style="display:none;font-size:1px;color:${CREAM};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
  ${refNo ? `${t.enquiry} ${refNo} · ` : ""}${t.previewFor} ${esc(localizedEventType(e, lang))} ${t.previewOn} ${fmtDateBg(e.preferred_date)} · ${t.previewTotal} €${totals.total.toFixed(2)}.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-wrap" style="background:${CREAM};padding:32px 0">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-card" style="background:${PAPER};max-width:600px;width:100%">

      <tr><td style="padding:32px 44px 24px;border-bottom:1px solid ${GOLD_LINE}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" style="font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;color:${INK};text-transform:uppercase">
              ${t.brand}&nbsp;<em style="font-style:italic;color:${GOLD};font-weight:400">360°</em>
            </td>
            <td align="right" style="font:italic 12px/1.2 ${SERIF};color:${MUTED}">
              ${fmtDateBg(e.preferred_date)}
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td class="email-body" style="padding:40px 44px 32px">

        ${refNo ? `<p style="margin:0 0 12px;font:600 11px/1.2 ${SANS};letter-spacing:0.18em;color:${GOLD};text-transform:uppercase">${t.enquiry} ${refNo}</p>` : ""}
        <h1 class="display" style="margin:0 0 10px;font:400 38px/1.1 ${SERIF};letter-spacing:-0.02em;color:${INK}">
          ${t.hello}, <em style="font-style:italic;color:${GOLD}">${esc(firstName)}</em>
        </h1>
        <p style="margin:0 0 32px;font:16px/1.55 ${SANS};color:${SOFT}">
          ${t.received1}${refNo ? ` ${refNo}` : ""}${t.received2}
        </p>

        <hr style="border:0;border-top:1px solid ${GOLD_LINE};margin:0 0 28px">

        ${sectionTitle(t.details)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">
          <tr>
            <td class="meta-cell" valign="top" style="padding:0 16px 0 0;width:33%">
              <p style="margin:0 0 4px;font:10px/1.2 ${SANS};letter-spacing:0.18em;color:${MUTED};text-transform:uppercase">${t.l_event}</p>
              <p style="margin:0;font:17px/1.3 ${SERIF};color:${INK}">${esc(localizedEventType(e, lang))}</p>
            </td>
            <td class="meta-cell" valign="top" style="padding:0 16px 0 0;width:33%">
              <p style="margin:0 0 4px;font:10px/1.2 ${SANS};letter-spacing:0.18em;color:${MUTED};text-transform:uppercase">${t.l_date}</p>
              <p style="margin:0;font:17px/1.3 ${SERIF};color:${INK}">${fmtDateBg(e.preferred_date)}</p>
            </td>
            <td class="meta-cell" valign="top" style="width:34%">
              <p style="margin:0 0 4px;font:10px/1.2 ${SANS};letter-spacing:0.18em;color:${MUTED};text-transform:uppercase">${t.l_guests}</p>
              <p style="margin:0;font:17px/1.3 ${SERIF};color:${INK}">${e.guests ?? "—"}</p>
            </td>
          </tr>
          <tr><td colspan="3" style="height:18px"></td></tr>
          <tr>
            <td class="meta-cell" valign="top" style="padding:0 16px 0 0;width:33%">
              <p style="margin:0 0 4px;font:10px/1.2 ${SANS};letter-spacing:0.18em;color:${MUTED};text-transform:uppercase">${t.l_time}</p>
              <p style="margin:0;font:17px/1.3 ${SERIF};color:${INK}">${timeLabel}</p>
            </td>
            <td class="meta-cell" valign="top" colspan="2">
              <p style="margin:0 0 4px;font:10px/1.2 ${SANS};letter-spacing:0.18em;color:${MUTED};text-transform:uppercase">${t.l_phone}</p>
              <p style="margin:0;font:17px/1.3 ${SERIF};color:${INK}">${esc(e.phone)}</p>
            </td>
          </tr>
        </table>

        ${addonRows ? `
        ${sectionTitle(t.addons)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">${addonRows}</table>` : ""}

        ${drinkRows ? `
        ${sectionTitle(t.drinks)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">${drinkRows}</table>` : ""}

        ${partnerRows ? `
        ${sectionTitle("Интерес към партньори")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">${partnerRows}</table>
        <p style="margin:0 0 28px;font:11px/1.5 ${SANS};color:${MUTED}">Безплатно и необвързващо — ще ви свържем с избраните партньори.</p>` : ""}

        ${e.notes ? `
        ${sectionTitle(t.notes)}
        <p style="margin:0 0 28px;padding:16px 18px;border-left:2px solid ${GOLD};background:${CREAM};font:italic 16px/1.5 ${SERIF};color:${SOFT};white-space:pre-wrap">„${esc(e.notes)}"</p>` : ""}

        ${sectionTitle(t.summary)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px">${totalRows}</table>
        <p style="margin:0 0 32px;font:11px/1.5 ${SANS};color:${MUTED}">
          ${t.estimate}
        </p>

        <hr style="border:0;border-top:1px solid ${GOLD_LINE};margin:0 0 28px">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px">
          <tr><td>
            <a class="email-cta" href="${editUrl}" style="display:inline-block;padding:14px 28px;background:${INK};color:${CREAM};font:600 12px/1 ${SANS};letter-spacing:0.14em;text-transform:uppercase;text-decoration:none">
              ${t.editCta}
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font:11px/1.6 ${SANS};color:${MUTED}">
          ${t.linkValid} <em style="font-style:italic;font-family:${SERIF};color:${INK}">${fmtExpiry(e.token_expires_at, t.expiryLocale)}</em>.
        </p>

      </td></tr>

      <tr><td style="padding:24px 44px;background:${INK};color:#C9A86A;font:11px/1.6 ${SANS};letter-spacing:0.04em">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="top" style="color:#C9A86A;text-transform:uppercase;letter-spacing:0.16em;font-weight:600">
              ${t.brand}&nbsp;<em style="font-style:italic;color:${CREAM};font-weight:400">360°</em>
            </td>
            <td valign="top" align="right" style="color:${MUTED}">
              <a href="mailto:360@margel.info" style="color:${CREAM};text-decoration:none;border-bottom:1px solid rgba(201,168,106,0.5)">360@margel.info</a>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:10px;color:${MUTED}">
              ${t.footerAddress}
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
  const refNo = e.enquiry_number != null ? `#${e.enquiry_number} ` : "";
  const subject = `${subjectPrefix}${refNo}${e.full_name} — ${e.event_type} — ${e.preferred_date} — €${totals.total.toFixed(2)}`;

  const addonsText = (e.addons ?? []).map(a => `  - ${a.name}: ${fmtEur(a.price, a.id)}`).join("\n");
  const drinksText = (e.drinks ?? []).map(d => {
    const line = (Number(d.price_eur) || 0) * (Number(d.qty) || 0);
    return line > 0
      ? `  - ${d.name} × ${d.qty} — €${line.toFixed(2)}`
      : `  - ${d.name} × ${d.qty}`;
  }).join("\n");
  const partnersText = (e.partner_interest ?? []).map(p =>
    `  - ${p.name} (${p.category === "catering" ? "catering" : "artist"})`
  ).join("\n");
  const timeLabel = e.arrival_time
    ? `Evening · arrival ${e.arrival_time}`
    : (e.time_of_day === "day" ? "Daytime (until 17:30)" : "Evening (after 19:00)");

  const totalsBlock = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "TOTAL",
    `  Venue base (up to ${VENUE_MIN_GUESTS} guests): €${totals.venue.toFixed(2)}`,
    ...(totals.extraGuests > 0 ? [`  +${totals.extraGuests} extra guests × €${EXTRA_GUEST_FEE_EUR}:           €${totals.extraGuestsCost.toFixed(2)}`] : []),
    `  Add-ons:                          €${totals.addons.toFixed(2)}`,
    `  Drinks:                           €${totals.drinks.toFixed(2)}`,
    ...(totals.discount > 0 ? [`  Discount (${totals.discountPercent}%):                 −€${totals.discount.toFixed(2)}`] : []),
    `  ──────────────────────────`,
    `  GRAND TOTAL:                      €${totals.total.toFixed(2)}`,
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
    ...(partnersText ? ["Partner interest (no charge):", partnersText, ""] : []),
    ...(e.notes ? ["Notes:", e.notes, ""] : []),
    ...totalsBlock,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");

  return { subject, text };
}
