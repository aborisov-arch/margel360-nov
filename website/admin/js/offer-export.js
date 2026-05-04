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

// Base party config by event id. `title` rewrites A15 so the offer reads
// correctly for non-Evening events; `start`/`end` populate Z8/AF8.
const EVENT_CONFIG = {
  evening:  { price:1280, title:'Парти /19:00–24:00/ за 5 часа до 40 човека -',           start:'19:00', end:'24:00', label:'Вечерно парти' },
  corp4:    { price:330,  title:'Корпоративно събитие /4 часа, 08:00–12:00/ до 40 човека -', start:'08:00', end:'12:00', label:'Корпоративно — 4 часа' },
  corp8:    { price:440,  title:'Корпоративно събитие /8 часа, 08:00–17:30/ до 40 човека -', start:'08:00', end:'17:30', label:'Корпоративно — 8 часа' },
  bday_day: { price:700,  title:'Детски рожден ден /дневно, до 17:30, 5 часа/ до 40 човека -', start:'12:00', end:'17:30', label:'Детски рожден ден — Дневно' },
  bday_eve: { price:970,  title:'Детски рожден ден /16:00–24:00, 5 часа/ до 40 човека -',  start:'16:00', end:'24:00', label:'Детски рожден ден — Вечерно' },
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

  // ── Event config: title row, base price, time slot, type label.
  const evId = enquiry.event_id;
  const cfg = EVENT_CONFIG[evId];
  if (cfg) {
    ws.getCell('A15').value  = cfg.title;
    ws.getCell('Q15').value  = cfg.price;
    if (cfg.start) ws.getCell('Z8').value  = cfg.start;
    if (cfg.end)   ws.getCell('AF8').value = cfg.end;
    ws.getCell('AA11').value = cfg.label;
  } else {
    ws.getCell('AA11').value = enquiry.event_type || '';
  }

  // ── Client info
  ws.getCell('E11').value = enquiry.full_name || '';
  ws.getCell('E12').value = enquiry.phone || '';
  ws.getCell('E13').value = enquiry.email || '';

  // ── Guests over 40 (extra-person fee)
  const guests = Number(enquiry.guests) || 0;
  ws.getCell('AA16').value = Math.max(0, guests - 40);

  // ── Addons → quantity cells. Furniture extras get charged only for
  // the count over the venue's free baseline (e.g. first 40 bar stools
  // included). Non-furniture services get qty=1 (yes/no checkbox in the
  // booking form). Anything not in the template falls into "Други услуги".
  const addons = Array.isArray(enquiry.addons) ? enquiry.addons : [];
  let otherTotal = 0;
  const unmapped = [];
  for (const a of addons) {
    const cell = ADDON_TO_CELL[a.id];
    if (cell) {
      const free = FURNITURE_FREE_UNTIL[a.id];
      const qty  = free != null ? Math.max(0, guests - free) : 1;
      ws.getCell(cell).value = qty;
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
