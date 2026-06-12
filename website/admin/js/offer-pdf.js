// Offer PDF — builds a branded, customer-facing offer document client-side
// with pdfmake and returns a Blob. Used by the dashboard "Изпрати оферта"
// action (the PDF is attached to the customer email by the send-offer edge
// function). The .xlsx export stays separate for internal use.
//
// SYNC MAP: venue base prices, the +€15 extra-guest fee and the
// "discount applies to the venue base only" rule are duplicated here — keep
// in step with reservation-catalog.js / enquiry-email.ts / dashboard.js /
// financials.js / offer-export.js when pricing changes.

// Venue base config by event_id. Mirrors offer-export.js EVENT_CONFIG.
const PDF_EVENT_CONFIG = {
  evening:  { price: 1280, label: 'Вечерно парти',                 slot: '19:00–24:00' },
  corp4:    { price: 330,  label: 'Корпоративно събитие — 4 часа', slot: '08:00–12:00' },
  corp8:    { price: 440,  label: 'Корпоративно събитие — 8 часа', slot: '08:00–17:30' },
  bday_day: { price: 700,  label: 'Детски рожден ден — Дневно',    slot: '12:00–17:30' },
  bday_eve: { price: 970,  label: 'Детски рожден ден — Вечерно',   slot: '16:00–24:00' },
  wedding:  { price: 1500, label: 'Сватба',                        slot: '' },
};

const PDF_VENUE_MIN_GUESTS = 40;
const PDF_EXTRA_GUEST_FEE_EUR = 15;
const PDF_DEPOSIT_RATE = 0.5;       // template: AF90*0.5
const PDF_OFFER_VALID_DAYS = 2;     // template note: "валидна 2 дни"

// Old BGN addon prices (pre-2026-05-04). Same table as offer-export.js /
// enquiry-email.ts — detect-and-convert legacy BGN line prices to EUR.
const PDF_ADDON_BGN_PRICES = {
  dj: 587, photo2: 340, photo4: 580, booth2: 390, booth4: 560,
  arch: 760, wall_s: 355, wall_g: 355, flare_s: 440, flare_l: 790,
  fountain_s: 96, fountain_l: 160, led: 290, mic: 97, proj: 180,
  security: 196, hygiene: 156, wardrobe: 176, valet: 275,
  carpet_l: 148, candles_h: 100, numbers: 68,
};
function pdfAddonPriceEur(id, price) {
  const old = PDF_ADDON_BGN_PRICES[id];
  return old != null && price === old ? price / 1.95583 : price;
}

// Brand palette.
const INK = '#1A1815', GOLD = '#B9894A', MUTED = '#7A7568';
const CREAM = '#F6F1E8', RULE = '#E3D6C0', PAPER = '#FDFBF7';

const eur = (n) => '€' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const fmtDateBg = (s) => String(s ?? '').replaceAll('/', '.');

function parseDDMMYYYY(s) {
  if (!s || !/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return null;
  const [d, m, y] = s.split('/').map(Number);
  return new Date(y, m - 1, d);
}
function fmtDateObjBg(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}
function pdfOfferNumber(id) {
  if (!id) return Date.now().toString().slice(-6);
  const s = String(id).replace(/-/g, '');
  return parseInt(s.slice(-6), 16) % 1000000;
}

// Lazy-load pdfmake + its default (Roboto, Cyrillic-capable) vfs once.
let _pdfMakePromise = null;
function loadPdfMake() {
  if (_pdfMakePromise) return _pdfMakePromise;
  const inject = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('load failed: ' + src));
    document.head.appendChild(s);
  });
  _pdfMakePromise = inject('https://cdn.jsdelivr.net/npm/pdfmake@0.2.12/build/pdfmake.min.js')
    .then(() => inject('https://cdn.jsdelivr.net/npm/pdfmake@0.2.12/build/vfs_fonts.js'))
    .then(() => window.pdfMake);
  return _pdfMakePromise;
}

// Compute the priced line items + totals from the enquiry.
function computeOfferBreakdown(enquiry) {
  const cfg = PDF_EVENT_CONFIG[enquiry.event_id] || null;
  const venue = cfg ? cfg.price : 0;
  const guests = Number(enquiry.guests) || 0;
  const extraGuests = Math.max(0, guests - PDF_VENUE_MIN_GUESTS);
  const extraGuestsCost = extraGuests * PDF_EXTRA_GUEST_FEE_EUR;

  const addons = Array.isArray(enquiry.addons) ? enquiry.addons : [];
  const addonRows = addons.map(a => {
    // addon.price is the LINE price (qty folded in, furniture freeUntil applied).
    const line = pdfAddonPriceEur(a.id, Number(a.price) || 0);
    return { name: a.name || a.id, qty: Number(a.qty) > 0 ? Number(a.qty) : 1, line };
  });
  const addonsSum = addonRows.reduce((s, r) => s + r.line, 0);

  const drinks = Array.isArray(enquiry.drinks) ? enquiry.drinks : [];
  const drinkRows = drinks.map(d => {
    const unit = Number(d.price_eur != null ? d.price_eur : d.price) || 0;
    const qty = Number(d.qty) || 0;
    return { name: d.name || d.id, qty, unit, line: unit * qty };
  }).filter(r => r.qty > 0);
  const drinksSum = drinkRows.reduce((s, r) => s + r.line, 0);

  const discountPercent = Number(enquiry.applied_discount_percent) || 0;
  const discount = discountPercent > 0 ? Math.round(venue * discountPercent) / 100 : 0;

  const total = venue + extraGuestsCost + addonsSum + drinksSum - discount;
  const deposit = Math.round(total * PDF_DEPOSIT_RATE * 100) / 100;
  const balance = Math.round((total - deposit) * 100) / 100;

  return { cfg, venue, guests, extraGuests, extraGuestsCost, addonRows, drinkRows,
    discountPercent, discount, total, deposit, balance };
}

function buildDocDefinition(enquiry) {
  const b = computeOfferBreakdown(enquiry);
  const offerNo = pdfOfferNumber(enquiry.id);
  const issued = new Date();
  const validUntil = new Date(issued.getTime());
  validUntil.setDate(validUntil.getDate() + PDF_OFFER_VALID_DAYS);
  const eventLabel = b.cfg ? b.cfg.label : (enquiry.event_type || '');
  const slot = b.cfg && b.cfg.slot ? b.cfg.slot : '';

  // ── Line-item table body.
  const itemHeader = [
    { text: 'ОПИСАНИЕ', style: 'th' },
    { text: 'КОЛ.', style: 'th', alignment: 'center' },
    { text: 'СУМА', style: 'th', alignment: 'right' },
  ];
  const rows = [];
  rows.push([
    { text: `Наем на залата · ${eventLabel}${slot ? ' · ' + slot : ''}\nдо ${PDF_VENUE_MIN_GUESTS} гости`, style: 'td' },
    { text: '1', style: 'td', alignment: 'center' },
    { text: eur(b.venue), style: 'td', alignment: 'right' },
  ]);
  if (b.extraGuests > 0) {
    rows.push([
      { text: `Допълнителни гости (над ${PDF_VENUE_MIN_GUESTS}) · по ${eur(PDF_EXTRA_GUEST_FEE_EUR)}`, style: 'td' },
      { text: String(b.extraGuests), style: 'td', alignment: 'center' },
      { text: eur(b.extraGuestsCost), style: 'td', alignment: 'right' },
    ]);
  }
  for (const r of b.addonRows) {
    rows.push([
      { text: r.name, style: 'td' },
      { text: String(r.qty), style: 'td', alignment: 'center' },
      { text: eur(r.line), style: 'td', alignment: 'right' },
    ]);
  }
  for (const r of b.drinkRows) {
    rows.push([
      { text: `${r.name} · ${eur(r.unit)}/бр.`, style: 'td' },
      { text: String(r.qty), style: 'td', alignment: 'center' },
      { text: eur(r.line), style: 'td', alignment: 'right' },
    ]);
  }
  if (b.discount > 0) {
    rows.push([
      { text: `Отстъпка (${b.discountPercent}% от наема)`, style: 'tdGold' },
      { text: '', style: 'td' },
      { text: '− ' + eur(b.discount), style: 'tdGold', alignment: 'right' },
    ]);
  }

  const goldRule = (w) => ({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: w, y2: 0, lineWidth: 1, lineColor: GOLD }] });

  return {
    pageSize: 'A4',
    pageMargins: [44, 48, 44, 64],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: INK, lineHeight: 1.15 },
    background: () => ({ canvas: [{ type: 'rect', x: 0, y: 0, w: 595.28, h: 841.89, color: PAPER }] }),
    content: [
      // ── Masthead
      {
        columns: [
          { width: '*', stack: [
            { text: [{ text: 'МАРГЕЛ ', characterSpacing: 3, bold: true }, { text: '360°', color: GOLD, bold: true }], fontSize: 17 },
            { text: 'зала за събития · София', color: MUTED, fontSize: 8, margin: [0, 3, 0, 0], characterSpacing: 1 },
          ] },
          { width: 'auto', stack: [
            { text: `ОФЕРТА № ${offerNo}`, alignment: 'right', bold: true, fontSize: 11, characterSpacing: 1 },
            { text: `Издадена: ${fmtDateObjBg(issued)}`, alignment: 'right', color: MUTED, fontSize: 8, margin: [0, 3, 0, 0] },
            { text: `Валидна до: ${fmtDateObjBg(validUntil)}`, alignment: 'right', color: GOLD, fontSize: 8, margin: [0, 1, 0, 0] },
          ] },
        ],
      },
      { margin: [0, 14, 0, 0], ...goldRule(507) },

      // ── Cover blurb
      { text: 'Вашата персонална оферта', font: 'Roboto', fontSize: 20, margin: [0, 22, 0, 4] },
      { text: 'Благодарим, че се спряхте на Маргел 360°. По-долу ще намерите детайлите и цените за вашето събитие. С удоволствие ще го направим запомнящо се.',
        color: MUTED, fontSize: 9.5, margin: [0, 0, 0, 20] },

      // ── Client + event facts
      {
        columns: [
          { width: '*', stack: [
            { text: 'КЛИЕНТ', style: 'label' },
            { text: enquiry.full_name || '—', margin: [0, 3, 0, 0], bold: true },
            { text: enquiry.phone || '', color: MUTED, fontSize: 9, margin: [0, 2, 0, 0] },
            { text: enquiry.email || '', color: MUTED, fontSize: 9 },
          ] },
          { width: '*', stack: [
            { text: 'СЪБИТИЕ', style: 'label' },
            { text: eventLabel || '—', margin: [0, 3, 0, 0], bold: true },
            { text: `Дата: ${fmtDateBg(enquiry.preferred_date) || '—'}${slot ? '  ·  ' + slot : ''}`, color: MUTED, fontSize: 9, margin: [0, 2, 0, 0] },
            { text: `Гости: ${b.guests || '—'}`, color: MUTED, fontSize: 9 },
          ] },
        ],
        margin: [0, 0, 0, 22],
      },

      // ── Line items
      {
        table: { headerRows: 1, widths: ['*', 40, 70], body: [itemHeader, ...rows] },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.8 : 0.4,
          hLineColor: (i, node) => (i === 1 || i === node.table.body.length) ? GOLD : RULE,
          vLineWidth: () => 0,
          paddingTop: () => 6, paddingBottom: () => 6, paddingLeft: () => 2, paddingRight: () => 2,
        },
      },

      // ── Totals
      {
        margin: [0, 14, 0, 0],
        columns: [
          { width: '*', text: '' },
          {
            width: 230,
            layout: 'noBorders',
            table: {
              widths: ['*', 'auto'],
              body: [[
                { text: 'Общо', bold: true, fontSize: 13 },
                { text: eur(b.total), bold: true, fontSize: 13, color: GOLD, alignment: 'right' },
              ]],
            },
          },
        ],
      },

      // ── Payment terms
      { margin: [0, 22, 0, 0], ...goldRule(507) },
      { text: 'УСЛОВИЯ ЗА ПЛАЩАНЕ', style: 'label', margin: [0, 16, 0, 8] },
      {
        columns: [
          { width: '*', stack: [
            { text: `Депозит (${Math.round(PDF_DEPOSIT_RATE * 100)}%)`, color: MUTED, fontSize: 9 },
            { text: eur(b.deposit), bold: true, fontSize: 12, margin: [0, 2, 0, 0] },
          ] },
          { width: '*', stack: [
            { text: 'Остатък', color: MUTED, fontSize: 9 },
            { text: eur(b.balance), bold: true, fontSize: 12, margin: [0, 2, 0, 0] },
          ] },
          { width: '*', stack: [
            { text: 'Валидност', color: MUTED, fontSize: 9 },
            { text: `${PDF_OFFER_VALID_DAYS} дни`, bold: true, fontSize: 12, margin: [0, 2, 0, 0] },
          ] },
        ],
      },
      { text: 'Залата се счита за запазена след потвърждение по имейл и платен депозит. Напитките се заплащат 100% предварително. Всички цени са в EUR.',
        color: MUTED, fontSize: 8, italics: true, margin: [0, 14, 0, 0] },
    ],
    styles: {
      th: { bold: true, fontSize: 8, color: MUTED, characterSpacing: 1 },
      td: { fontSize: 9.5, color: INK },
      tdGold: { fontSize: 9.5, color: GOLD },
      label: { bold: true, fontSize: 8, color: GOLD, characterSpacing: 1.5 },
    },
    footer: (currentPage) => ({
      margin: [44, 12, 44, 0],
      columns: [
        { text: 'бул. Околовръстен път 155 · ет. 4 · София  ·  360@margel.info', color: MUTED, fontSize: 7.5 },
        { text: `${currentPage}`, alignment: 'right', color: MUTED, fontSize: 7.5 },
      ],
    }),
  };
}

// Build the offer PDF as { blob, filename }.
async function buildOfferPDFBlob(enquiry) {
  const pdfMake = await loadPdfMake();
  const docDef = buildDocDefinition(enquiry);
  const safeName = (enquiry.full_name || 'offer')
    .replace(/[^\p{L}\p{N}\s.-]/gu, '').trim().replace(/\s+/g, '_') || 'offer';
  const filename = `Оферта_${safeName}_${fmtDateObjBg(new Date())}.pdf`;
  const blob = await new Promise((resolve) => pdfMake.createPdf(docDef).getBlob(resolve));
  return { blob, filename };
}

window.buildOfferPDFBlob = buildOfferPDFBlob;
