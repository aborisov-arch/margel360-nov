// Offer export - populates the Margel360 Excel template with enquiry data
// and triggers a download. Admin opens the file in Excel/Google Sheets,
// edits if needed, then exports to PDF themselves.
//
// Template: admin/templates/offer-evening.xlsx (Evening Party layout)
// Fallback for other event types: same template with the base-fee row swapped.

// Map enquiry addon ids → template AA-column cell that holds the quantity.
// Items not present here fall through to "Други услуги" (row 80) as a sum.
const ADDON_TO_CELL = {
  proj:        'AA21',  // multimedia
  flipchart:   'AA24',
  mic:         'AA27',
  heater:      'AA30',  // gas patio heater
  wardrobe:    'AA37',
  hygiene:     'AA40',
  valet:       'AA43',
  dj:          'AA46',
  photo2:      'AA50',
  photo4:      'AA52',
  security:    'AA54',
  glow_table:  'AA59',  // RGB tables
  cocktail_t:  'AA62',  // stork tables Ø80
  bar_stool:   'AA65',
  rect_table:  'AA68',  // 180cm
  round_table: 'AA71',  // Ø152cm
  chiavari:    'AA74',
  conf_chair:  'AA77',
};

// Base party config by event id. `title` rewrites A15 so the offer reads
// correctly for non-Evening events; `start`/`end` populate Z8/AF8.
const EVENT_CONFIG = {
  evening:  { price:1350, title:'Парти /19:00-24:00/ за 5 часа до 40 човека -',           start:'19:00', end:'24:00', label:'Вечерно парти' },
  corp4:    { price:330,  title:'Корпоративно събитие /4 часа, 08:00-12:00/ до 40 човека -', start:'08:00', end:'12:00', label:'Корпоративно - 4 часа' },
  corp8:    { price:440,  title:'Корпоративно събитие /8 часа, 08:00-17:30/ до 40 човека -', start:'08:00', end:'17:30', label:'Корпоративно - 8 часа' },
  bday_day: { price:700,  title:'Детски рожден ден /дневно, до 17:30, 5 часа/ до 40 човека -', start:'12:00', end:'17:30', label:'Детски рожден ден - Дневно' },
  bday_eve: { price:970,  title:'Детски рожден ден /16:00-24:00, 5 часа/ до 40 човека -',  start:'16:00', end:'24:00', label:'Детски рожден ден - Вечерно' },
  wedding:  { price:1500, title:'Сватба до 40 човека -',                                    start:'',      end:'',      label:'Сватба' },
};

// Furniture extras: first N pieces are included free with the venue rental;
// only the count over this threshold is charged. Mirrors reservation-catalog.js.
const FURNITURE_FREE_UNTIL = {
  bar_stool:   40,
  conf_chair:  40,
  chiavari:    10,
  cocktail_t:  16,
  rect_table:   1,
  round_table:  1,
};

// Old BGN prices used by the public reservation form before 2026-05-04.
// If an addon's stored price matches its old BGN value, treat as BGN and
// convert to EUR. Otherwise treat as EUR.
const ADDON_BGN_PRICES = {
  dj: 587, photo2: 340, photo4: 580, booth2: 390, booth4: 560,
  arch: 760, wall_s: 355, wall_g: 355, flare_s: 440, flare_l: 790,
  fountain_s: 96, fountain_l: 160, led: 290, mic: 97, proj: 180,
  security: 196, hygiene: 156, wardrobe: 176, valet: 275,
  carpet_l: 148, candles_h: 100, numbers: 68,
};
function addonPriceEur(id, price) {
  const old = ADDON_BGN_PRICES[id];
  return old != null && price === old ? price / 1.95583 : price;
}

// Cells in the AA quantity column we may write to. Cleared at the start of
// each export so leftover values from a previous customer's offer don't
// silently auto-bill the new one (the supplied template has AA40=1 leftover
// hygienist, which is exactly this kind of trap).
const ADDON_QTY_CELLS = [
  'AA17',                               // hours past 24:00
  'AA21', 'AA24', 'AA27', 'AA30',
  'AA37', 'AA38',                       // wardrobe + overtime
  'AA40', 'AA41',                       // hygienist + overtime
  'AA43', 'AA44',                       // valet + overtime
  'AA46', 'AA47',                       // DJ + overtime
  'AA50', 'AA51', 'AA52',               // photographer 2/3/4h
  'AA54', 'AA55',                       // security + overtime
  'AA59', 'AA62', 'AA65', 'AA68',
  'AA71', 'AA74', 'AA77',
  'AA80', 'AA82',                       // other services / alcohol
];

// Lazy-load ExcelJS once. SRI hash pins the exact published bytes so a CDN
// compromise can't execute in the admin session.
let _excelJsPromise = null;
function loadExcelJS() {
  if (_excelJsPromise) return _excelJsPromise;
  _excelJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
    s.integrity = 'sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz';
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve(window.ExcelJS);
    s.onerror = () => reject(new Error('Failed to load ExcelJS'));
    document.head.appendChild(s);
  });
  return _excelJsPromise;
}

// "DD/MM/YYYY" → Date (local). Returns null if malformed.
function parseDDMMYYYY(s) {
  if (!s || !/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return null;
  const [d, m, y] = s.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function formatDDMMYY(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

// Use the last 6 hex chars of the enquiry uuid (% 1,000,000) as the offer
// number. Stable per-enquiry so re-exports give the same number, and 1-in-a-
// million collision odds across enquiries (vs ~1-in-10,000 with the prior
// 4-hex window - too tight for a multi-year customer log).
function offerNumberFromId(id) {
  if (!id) return Date.now().toString().slice(-6);
  const s = String(id).replace(/-/g, '');
  return parseInt(s.slice(-6), 16) % 1000000;
}

// Build the populated workbook as a Blob + filename, without downloading.
// Shared by exportOfferXLSX (download) and the "Send offer" action (attach to
// email). Returns { blob, filename, unmapped }.
async function buildOfferXLSXBlob(enquiry) {
  const ExcelJS = await loadExcelJS();

  // Fetch the template
  const res = await fetch('templates/offer-evening.xlsx');
  if (!res.ok) throw new Error('Template fetch failed: ' + res.status);
  const buf = await res.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('ОФЕРТА');
  if (!ws) throw new Error('ОФЕРТА sheet missing in template');

  // Reset every quantity cell we might write to. The supplied template
  // includes leftover values from a previous customer (notably AA40 = 1 for
  // hygienist) which would otherwise silently auto-bill the new customer.
  for (const c of ADDON_QTY_CELLS) {
    ws.getCell(c).value = null;
  }

  // ── Header: offer number + date
  // Prefer the sequential enquiry_number so XLSX and PDF carry the same
  // offer number; uuid-derived fallback only for legacy rows without one.
  ws.getCell('T6').value = enquiry.enquiry_number || offerNumberFromId(enquiry.id);
  ws.getCell('X6').value = formatDDMMYY(new Date());

  // ── Event details
  const evDate = parseDDMMYYYY(enquiry.preferred_date);
  if (evDate) ws.getCell('J8').value = evDate;

  // ── Event config: title row, base price, time slot, type label.
  const evId = enquiry.event_id;
  const cfg = EVENT_CONFIG[evId];
  if (cfg) {
    ws.getCell('A15').value  = cfg.title;
    // Stamped effective venue price (seasonal calendar) with legacy fallback
    // for pre-stamp rows (enquiry.venue_price_eur is NULL).
    ws.getCell('Q15').value  = enquiry.venue_price_eur != null ? Number(enquiry.venue_price_eur) : cfg.price;
    if (cfg.start) ws.getCell('Z8').value  = cfg.start;
    if (cfg.end)   ws.getCell('AF8').value = cfg.end;
    ws.getCell('AA11').value = cfg.label;
  } else {
    ws.getCell('AA11').value = enquiry.event_type || '';
  }

  // ── Promo discount → the template's native "TO%" cell on the venue row.
  // AG15 = (Q15 - Q15*AC15%) * AA15, row 87 is the labeled "отстъпка" line
  // (AG87 shows the discount amount) and the offer total AF90 = AG86 - AG87,
  // so deposit/balance recompute automatically. Cleared first so a leftover
  // percent from a previous export can't discount the next customer.
  const discountPct = Number(enquiry.applied_discount_percent) || 0;
  ws.getCell('AC15').value = discountPct > 0 ? discountPct : null;

  // ── Client info
  ws.getCell('E11').value = enquiry.full_name || '';
  ws.getCell('E12').value = enquiry.phone || '';
  ws.getCell('E13').value = enquiry.email || '';

  // ── Guests over 40 (extra-person fee)
  const guests = Number(enquiry.guests) || 0;
  ws.getCell('AA16').value = Math.max(0, guests - 40);

  // ── Addons → quantity cells. Quantities come from the ORDERED amount on
  // the enquiry (a.qty; legacy checkbox rows carry no qty → 1). Furniture
  // extras bill only the pieces above the venue's free baseline (their
  // stored qty is the total count). Anything not in the template falls
  // into "Други услуги" as a EUR sum of line prices.
  const addons = Array.isArray(enquiry.addons) ? enquiry.addons : [];
  let otherTotal = 0;
  const unmapped = [];
  for (const a of addons) {
    // The template has a dedicated always-on cleaning row (AA85 below), so a
    // cleaning addon on the enquiry (auto-added on every event) must not also
    // land in "Други услуги" - that double-charged the cleaning fee.
    if (a.id === 'cleaning') continue;
    const cell = ADDON_TO_CELL[a.id];
    if (cell) {
      const ordered = Number(a.qty) > 0 ? Number(a.qty) : 1;
      const free = FURNITURE_FREE_UNTIL[a.id];
      const qty  = free != null ? Math.max(0, ordered - free) : ordered;
      if (qty > 0) ws.getCell(cell).value = qty;
    } else {
      // Old enquiries (pre-2026-05-04) stored addon.price in BGN; new ones
      // in EUR. Detect and convert before summing into the offer's EUR total.
      const eur = addonPriceEur(a.id, Number(a.price) || 0);
      otherTotal += eur;
      unmapped.push(a.name || a.id);
    }
  }
  if (otherTotal > 0) {
    // AG80 formula is just =AA80, so we put the EUR amount directly there.
    ws.getCell('AA80').value = otherTotal;
  }

  // ── Cleaning fee always applies
  ws.getCell('AA85').value = 1;

  // Drinks: per user direction, alcohol stays "on standby" - the template
  // shows just a link to the drinks menu and the admin handles itemized
  // drinks separately (paid 100% in advance per template note). Do NOT set
  // AA82; setting it to 1 would charge €1 on the alcohol line.

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  // Allow Cyrillic + Latin letters, digits, dots and hyphens - \w would strip
  // Bulgarian names (Иван Петров → empty) and the file would be named "offer".
  const safeName = (enquiry.full_name || 'offer').replace(/[^\p{L}\p{N}\s.-]/gu, '').trim().replace(/\s+/g, '_') || 'offer';
  const filename = `Оферта_${safeName}_${formatDDMMYY(new Date())}.xlsx`;

  return { blob, filename, unmapped };
}

// Download path: build the workbook then trigger a browser download.
async function exportOfferXLSX(enquiry) {
  const { blob, filename, unmapped } = await buildOfferXLSXBlob(enquiry);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { unmapped };
}

// Expose for dashboard.js
window.exportOfferXLSX = exportOfferXLSX;
window.buildOfferXLSXBlob = buildOfferXLSXBlob;
