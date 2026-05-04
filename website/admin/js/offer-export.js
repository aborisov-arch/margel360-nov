// Offer export — populates the Margel360 Excel template with enquiry data
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

// Base party price by event id (overrides Q15 if not Evening).
const EVENT_BASE_PRICE = {
  evening:  1280,
  corp4:    330,
  corp8:    440,
  bday_day: 700,
  bday_eve: 970,
  wedding:  1500,
};

const EVENT_TYPE_LABEL = {
  evening:  { bg: 'Вечерно парти',                  en: 'Evening Party' },
  corp4:    { bg: 'Корпоративно събитие — 4 часа',  en: 'Corporate Event — 4 hours' },
  corp8:    { bg: 'Корпоративно събитие — 8 часа',  en: 'Corporate Event — 8 hours' },
  bday_day: { bg: 'Детски рожден ден — Дневно',     en: "Children's Birthday — Daytime" },
  bday_eve: { bg: 'Детски рожден ден — Вечерно',    en: "Children's Birthday — Evening" },
  wedding:  { bg: 'Сватба',                         en: 'Wedding' },
};

// Lazy-load ExcelJS once.
let _excelJsPromise = null;
function loadExcelJS() {
  if (_excelJsPromise) return _excelJsPromise;
  _excelJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
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

// Use the last 4 hex chars of the enquiry uuid as the offer number.
// Stable per-enquiry (so re-exports give the same number) and short enough
// to fit the template's offer-# field.
function offerNumberFromId(id) {
  if (!id) return Date.now().toString().slice(-4);
  const s = String(id).replace(/-/g, '');
  return parseInt(s.slice(-4), 16) % 10000;
}

async function exportOfferXLSX(enquiry) {
  const ExcelJS = await loadExcelJS();

  // Fetch the template
  const res = await fetch('templates/offer-evening.xlsx');
  if (!res.ok) throw new Error('Template fetch failed: ' + res.status);
  const buf = await res.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('ОФЕРТА');
  if (!ws) throw new Error('ОФЕРТА sheet missing in template');

  // ── Header: offer number + date
  ws.getCell('T6').value = offerNumberFromId(enquiry.id);
  ws.getCell('X6').value = formatDDMMYY(new Date());

  // ── Event details
  const evDate = parseDDMMYYYY(enquiry.preferred_date);
  if (evDate) ws.getCell('J8').value = evDate;

  // Time slot — evening default is 19:00–24:00; daytime is 11:00–17:30.
  // The DB stores time_of_day as 'day' or 'eve' (or null).
  const isDaytime = enquiry.time_of_day === 'day';
  ws.getCell('Z8').value  = isDaytime ? '11:00' : '19:00';
  ws.getCell('AF8').value = isDaytime ? '17:30' : '24:00';

  // Event type label
  const evId = enquiry.event_id;
  const evLabel = EVENT_TYPE_LABEL[evId] || { bg: enquiry.event_type || '', en: enquiry.event_type || '' };
  ws.getCell('AA11').value = evLabel.bg;

  // ── Client info
  ws.getCell('E11').value = enquiry.full_name || '';
  ws.getCell('E12').value = enquiry.phone || '';
  ws.getCell('E13').value = enquiry.email || '';

  // ── Base party price — override Q15 if event is not Evening (template default)
  if (evId && evId !== 'evening' && EVENT_BASE_PRICE[evId] != null) {
    ws.getCell('Q15').value = EVENT_BASE_PRICE[evId];
  }

  // ── Guests over 40 (extra-person fee)
  const guests = Number(enquiry.guests) || 0;
  ws.getCell('AA16').value = Math.max(0, guests - 40);

  // ── Addons → quantity cells. Anything that doesn't map gets summed
  // into AA80 ("Други услуги").
  const addons = Array.isArray(enquiry.addons) ? enquiry.addons : [];
  let otherTotal = 0;
  const unmapped = [];
  for (const a of addons) {
    const cell = ADDON_TO_CELL[a.id];
    if (cell) {
      ws.getCell(cell).value = 1;
    } else {
      otherTotal += Number(a.price) || 0;
      unmapped.push(a.name || a.id);
    }
  }
  if (otherTotal > 0) {
    // AG80 formula is just =AA80, so we put the EUR amount directly there.
    ws.getCell('AA80').value = otherTotal;
  }

  // ── Cleaning fee always applies
  ws.getCell('AA85').value = 1;

  // Drinks: template only has a link, no per-item rows. Mark AA82=1 if any
  // drinks were ordered so the line shows in the totals; admin handles
  // itemized drinks separately (paid 100% in advance per template note).
  const drinks = Array.isArray(enquiry.drinks) ? enquiry.drinks : [];
  if (drinks.length > 0) {
    ws.getCell('AA82').value = 1;
  }

  // ── Trigger download
  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const safeName = (enquiry.full_name || 'offer').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '_') || 'offer';
  const filename = `Оферта_${safeName}_${formatDDMMYY(new Date())}.xlsx`;

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
