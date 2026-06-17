// Financials — per-event P&L.
//
// Single source of truth: the financial_events + financial_expenses rows
// that the bookkeeper saves. The enquiry is used only to PRE-FILL the
// income side on first selection (so the admin doesn't have to retype
// what the customer was quoted). After that, the summary and every
// figure on screen reads from the saved P&L rows. The employee owns the
// numbers.
//
// All edits are local draft until "Запази промените" is pressed. Until
// then the summary keeps showing the last-saved values.
//
// All amounts in EUR. BGN derived via the fixed peg 1.95583.

const BGN_RATE = 1.95583;

// Same EVENT_BASE + guest fee constants used by reservation.js etc.
const EVENT_BASE = { evening: 1280, wedding: 1500, corp4: 330, corp8: 440, bday_day: 700, bday_eve: 970 };
const VENUE_MIN_GUESTS = 40;
const EXTRA_GUEST_FEE_EUR = 15;

// Live drinks catalog (drinks-data.js is loaded before this script). Used to
// price P&L drink lines by id so website price changes flow straight through.
const drinkCatalogById = (typeof drinks !== 'undefined' && Array.isArray(drinks))
  ? new Map(drinks.map(d => [d.id, d]))
  : new Map();

// Income additional-service buckets (the 7 grouped categories the
// bookkeeper picks per service line). Kept in sync with the CHECK
// constraint on financial_income_items.category.
const INCOME_SERVICE_CATS = [
  { id: 'photo_video',   label: 'Фото / Видео' },
  { id: 'decoration',    label: 'Декорация' },
  { id: 'pyro_lighting', label: 'Пиро / Светлини' },
  { id: 'music_dj',      label: 'Музика / DJ' },
  { id: 'furniture',     label: 'Обзавеждане' },
  { id: 'staff_service', label: 'Персонал / Обслужване' },
  { id: 'other',         label: 'Други' },
];

// Expense categories — the 7 income buckets plus running-cost essentials.
// Kept in sync with the CHECK constraint on financial_expenses.category.
const EXPENSE_CATS = [
  { id: 'photo_video',   label: 'Фото / Видео' },
  { id: 'decoration',    label: 'Декорация' },
  { id: 'pyro_lighting', label: 'Пиро / Светлини' },
  { id: 'music_dj',      label: 'Музика / DJ' },
  { id: 'furniture',     label: 'Обзавеждане' },
  { id: 'staff_service', label: 'Персонал / Заплати' },
  { id: 'catering',      label: 'Кетъринг' },
  { id: 'drinks',        label: 'Напитки / алкохол' },
  { id: 'utilities',     label: 'Сметки / комунални' },
  { id: 'maintenance',   label: 'Поддръжка' },
  { id: 'marketing',     label: 'Маркетинг / реклама' },
  { id: 'other',         label: 'Други' },
];

const fmtEur = n => '€' + (Number(n) || 0).toFixed(2);
const fmtBgn = n => 'лв ' + (Number(n) || 0).toFixed(2);
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDateBg(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function parsePreferredDate(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Used ONLY to prefill a brand-new financial_events row on first
// selection. After that the row owns its numbers and breakdown is
// derived from fe.income_*.
function enquiryBreakdown(e) {
  const base = EVENT_BASE[e.event_id] || 0;
  const guests = Number(e.guests) || 0;
  const extraGuests = Math.max(0, guests - VENUE_MIN_GUESTS);
  const extraGuestsCost = extraGuests * EXTRA_GUEST_FEE_EUR;
  const addons = Array.isArray(e.addons)
    ? e.addons.reduce((s, a) => s + (Number(a.price) || 0), 0) : 0;
  const drinks = Array.isArray(e.drinks)
    ? e.drinks.reduce((s, d) => s + (Number(d.price_eur) || 0) * (Number(d.qty) || 0), 0) : 0;
  const pct = Number(e.applied_discount_percent || 0);
  const discount = pct > 0 ? base * pct / 100 : 0;
  const rent = base - discount + extraGuestsCost;
  return {
    rent:   Math.max(0, Math.round(rent * 100) / 100),
    drinks: Math.round(drinks * 100) / 100,
    addons: Math.round(addons * 100) / 100,
  };
}

// ────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────

let allEnquiries = [];
let occupiedDateSet = new Set();
let financialEventsById = new Map();
let financialEventByEnquiryId = new Map();
let expensesByEvent = new Map();
let incomeItemsByEvent = new Map();
let bookableEvents = [];
// Selection: at most ONE of these is non-null. selectedEnquiryId opens
// a P&L derived from an enquiry; selectedManualFeId opens a "manual"
// event the bookkeeper entered by hand (no enquiry link). Both render
// through the same detail panel.
let selectedEnquiryId = null;
let selectedManualFeId = null;
let userEmail = null;
let monthFilter = '';

// Draft state for the currently-open event. Cleared on event switch.
// dirtyFe: { field: value, ... } targeting financial_events row
// dirtyExpenses: Map<expenseId, { field: value }>
let dirtyFe = {};
let dirtyExpenses = new Map();
let dirtyIncomeItems = new Map();

const MONTH_NAMES_BG = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември'];
function monthLabel(ym) {
  if (!ym) return 'всички месеци';
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES_BG[Number(m) - 1]} ${y}`;
}
function enquiryMonth(e) {
  const iso = parsePreferredDate(e.preferred_date);
  return iso ? iso.slice(0, 7) : null;
}
function filteredEvents() {
  if (!monthFilter) return bookableEvents;
  return bookableEvents.filter(e => enquiryMonth(e) === monthFilter);
}
function isDirty() {
  return Object.keys(dirtyFe).length > 0 || dirtyExpenses.size > 0 || dirtyIncomeItems.size > 0;
}

// All financial_events that are NOT reachable through the enquiry list:
// hand-entered rows (no enquiry link — back-fills, walk-ins, cash bookings)
// PLUS rows whose enquiry has since left confirmed/completed (e.g. the
// admin unlocked it on the dashboard). Without the second group those
// orphaned rows kept inflating the month KPIs while being impossible to
// open, edit, or delete from the UI.
function manualFeRows() {
  const bookableIds = new Set(bookableEvents.map(e => e.id));
  const out = [];
  for (const fe of financialEventsById.values()) {
    if (!fe.enquiry_id || !bookableIds.has(fe.enquiry_id)) out.push(fe);
  }
  return out.sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''));
}
function filteredManualFeRows() {
  if (!monthFilter) return manualFeRows();
  return manualFeRows().filter(fe => fe.month === monthFilter);
}

// Unified "what's open right now" accessor used by everything below.
// Exactly one of enquiry/fe-only is set; the helper returns a normalised
// view so render & mutate code doesn't have to branch on selection kind.
function currentSelection() {
  if (selectedEnquiryId) {
    const enquiry = allEnquiries.find(e => e.id === selectedEnquiryId);
    if (!enquiry) return null;
    const fe = financialEventByEnquiryId.get(enquiry.id) || null;
    return { kind: 'enquiry', enquiry, fe };
  }
  if (selectedManualFeId) {
    const fe = financialEventsById.get(selectedManualFeId);
    if (!fe) return null;
    return { kind: 'manual', enquiry: null, fe };
  }
  return null;
}
function clearSelection() { selectedEnquiryId = null; selectedManualFeId = null; }

// ────────────────────────────────────────────────────────────────
// Saved-state accessors — used by the summary + left rail. They
// intentionally read ONLY from financial_events / financial_expenses
// rows, never from the enquiry, so the summary reflects what the
// employee saved.
// ────────────────────────────────────────────────────────────────

// Saved add-on income = sum of the event's itemized service lines. This
// replaces the old single income_addons_eur read; that column is now just
// a cached mirror kept in sync on save (see syncAddonsColumn).
function savedAddonsTotal(feId) {
  const rows = incomeItemsByEvent.get(feId) || [];
  return rows.reduce((s, x) => s + Number(x.amount_eur || 0), 0);
}

// Saved-state drinks total (summary + left rail). Uses the adjusted P&L list
// once it exists; otherwise live-prices the booking's order so the summary
// matches the open panel (and reflects catalog price changes), falling back
// to the cached prefill only when there's no linked enquiry.
function savedDrinksTotal(fe) {
  if (fe.pnl_drinks != null) return drinksTotalOf(fe.pnl_drinks);
  const enquiry = fe.enquiry_id ? allEnquiries.find(e => e.id === fe.enquiry_id) : null;
  if (enquiry) return drinksTotalOf(seedDrinksFromOrder(enquiry));
  return Number(fe.income_drinks_eur || 0);
}

function feIncome(fe) {
  if (!fe) return { rent: 0, drinks: 0, addons: 0, overtime: 0, dj: 0, employees: 0, total: 0 };
  const rent   = Number(fe.income_rent_eur   || 0);
  const drinks = savedDrinksTotal(fe);
  const addons = savedAddonsTotal(fe.id);
  const overtime = Number(fe.income_overtime_eur || 0);
  const dj = Number(fe.income_dj_eur || 0);
  const employees = Number(fe.income_employees_eur || 0);
  return { rent, drinks, addons, overtime, dj, employees, total: rent + drinks + addons + overtime + dj + employees };
}
function fePaid(fe) {
  if (!fe) return 0;
  return Number(fe.deposit_cash_eur || 0)
       + Number(fe.deposit_bank_eur || 0)
       + Number(fe.deposit_card_eur || 0)
       + Number(fe.balance_cash_eur || 0)
       + Number(fe.balance_bank_eur || 0)
       + Number(fe.balance_card_eur || 0)
       + Number(fe.payment3_cash_eur || 0)
       + Number(fe.payment3_bank_eur || 0)
       + Number(fe.payment3_card_eur || 0);
}
function feExpenseTotal(fe) {
  if (!fe) return 0;
  const rows = expensesByEvent.get(fe.id) || [];
  return rows.reduce((s, x) => s + Number(x.amount_eur || 0), 0);
}

// ────────────────────────────────────────────────────────────────
// Data loading
// ────────────────────────────────────────────────────────────────

async function loadAll() {
  const [
    { data: enq, error: enqErr },
    { data: occ, error: occErr },
    { data: fev, error: fevErr },
    { data: exp, error: expErr },
    { data: inc, error: incErr },
  ] = await Promise.all([
    db.from('enquiries').select('id,enquiry_number,full_name,preferred_date,event_type,event_id,pipeline_status,addons,drinks,applied_discount_percent,guests,payment_method,payment_tracking'),
    db.from('occupied_dates').select('date'),
    db.from('financial_events').select('*'),
    db.from('financial_expenses').select('*').not('event_id', 'is', null),
    db.from('financial_income_items').select('*').not('event_id', 'is', null),
  ]);
  if (enqErr) console.error(enqErr);
  if (occErr) console.error(occErr);
  if (fevErr) console.error(fevErr);
  if (expErr) console.error(expErr);
  if (incErr) console.error(incErr);

  allEnquiries = enq || [];
  occupiedDateSet = new Set((occ || []).map(r => r.date));

  financialEventsById = new Map();
  financialEventByEnquiryId = new Map();
  (fev || []).forEach(f => {
    financialEventsById.set(f.id, f);
    if (f.enquiry_id) financialEventByEnquiryId.set(f.enquiry_id, f);
  });

  expensesByEvent = new Map();
  (exp || []).forEach(x => {
    if (!expensesByEvent.has(x.event_id)) expensesByEvent.set(x.event_id, []);
    expensesByEvent.get(x.event_id).push(x);
  });

  incomeItemsByEvent = new Map();
  (inc || []).forEach(x => {
    if (!incomeItemsByEvent.has(x.event_id)) incomeItemsByEvent.set(x.event_id, []);
    incomeItemsByEvent.get(x.event_id).push(x);
  });

  bookableEvents = allEnquiries.filter(e => {
    if (!['confirmed', 'completed'].includes(e.pipeline_status)) return false;
    const iso = parsePreferredDate(e.preferred_date);
    return iso && occupiedDateSet.has(iso);
  }).sort((a, b) => {
    const ai = parsePreferredDate(a.preferred_date) || '';
    const bi = parsePreferredDate(b.preferred_date) || '';
    return bi.localeCompare(ai);
  });
}

// Find or create the financial_events row for an enquiry. First-time
// creation prefills the income breakdown from the enquiry so the admin
// starts with sane numbers instead of zero.
async function ensureFinancialEvent(enquiry) {
  let row = financialEventByEnquiryId.get(enquiry.id);
  if (row) return row;
  const b = enquiryBreakdown(enquiry);
  const iso = parsePreferredDate(enquiry.preferred_date);
  const month = iso ? iso.slice(0, 7) : null;
  // Paid-by-customer prefill: the Bank/Cash/Card amounts marked on the enquiry
  // (Enquiries section). They go into the deposit buckets — the enquiry has no
  // deposit/balance split, and the bookkeeper can reclassify before saving.
  const pt = enquiry.payment_tracking || {};
  const ptAmt = (k) => { const n = parseFloat(pt[k]); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
  const insertRow = {
    month,
    event_date: iso,
    customer_name: enquiry.full_name || '',
    offer_total_eur: b.rent + b.drinks + b.addons,
    income_rent_eur:   b.rent,
    income_drinks_eur: b.drinks,
    income_addons_eur: b.addons,
    deposit_cash_eur: ptAmt('cash'),
    deposit_bank_eur: ptAmt('bank'),
    deposit_card_eur: ptAmt('card'),
    enquiry_id: enquiry.id,
    confirmed_by: userEmail,
    confirmed_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('financial_events').insert(insertRow).select().single();
  if (error) { console.error('ensureFinancialEvent insert failed', error); return null; }
  financialEventsById.set(data.id, data);
  financialEventByEnquiryId.set(enquiry.id, data);

  // Seed one "Други" service line from the enquiry's add-on total so the
  // prefilled add-on income is visible (income now derives from items).
  // The bookkeeper can then split/recategorize it.
  if (b.addons > 0) {
    const { data: item, error: itemErr } = await db.from('financial_income_items').insert({
      event_id: data.id, month, category: 'other', amount_eur: b.addons,
      notes: 'Пренесено от офертата',
    }).select().single();
    if (itemErr) console.error('seed income item failed', itemErr);
    else incomeItemsByEvent.set(data.id, [item]);
  }
  return data;
}

// ────────────────────────────────────────────────────────────────
// Monthly summary (reads ONLY from saved fe + expenses)
// ────────────────────────────────────────────────────────────────

function renderMonthSummary() {
  // Iterate EVERY financial_event in the month filter — enquiry-linked
  // AND manual. This is the right scope because the summary should
  // reflect "money I actually saw this month", regardless of whether
  // each event came from the public form or a hand entry.
  const scopeFes = [];
  for (const fe of financialEventsById.values()) {
    if (!monthFilter || fe.month === monthFilter) scopeFes.push(fe);
  }
  let rent = 0, drinks = 0, addons = 0, overtime = 0, dj = 0, employees = 0, paid = 0, expense = 0;
  const expByCat = Object.fromEntries(EXPENSE_CATS.map(c => [c.id, 0]));

  scopeFes.forEach(fe => {
    const inc = feIncome(fe);
    rent   += inc.rent;
    drinks += inc.drinks;
    addons += inc.addons;
    overtime += inc.overtime;
    dj += inc.dj;
    employees += inc.employees;
    paid   += fePaid(fe);
    const rows = expensesByEvent.get(fe.id) || [];
    rows.forEach(x => {
      const amt = Number(x.amount_eur || 0);
      expense += amt;
      expByCat[x.category || 'other'] = (expByCat[x.category || 'other'] || 0) + amt;
    });
  });

  const income = rent + drinks + addons + overtime + dj + employees;
  const profit = income - expense;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('sum-month-label', monthLabel(monthFilter));
  set('sum-count',       `${scopeFes.length} ${scopeFes.length === 1 ? 'събитие' : 'събития'}`);
  set('sum-income-eur',  fmtEur(income));
  set('sum-income-bgn',  fmtBgn(income * BGN_RATE));
  set('sum-paid-eur',    fmtEur(paid));
  set('sum-paid-bgn',    fmtBgn(paid * BGN_RATE));
  set('sum-expense-eur', fmtEur(expense));
  set('sum-expense-bgn', fmtBgn(expense * BGN_RATE));
  set('sum-profit-eur',  fmtEur(profit));
  set('sum-profit-bgn',  fmtBgn(profit * BGN_RATE));
  const profitEl = document.getElementById('sum-profit-eur');
  if (profitEl) profitEl.className = 'kpi__value ' + (profit >= 0 ? 'is-positive' : 'is-negative');

  const incomeCats = { rent, drinks, addons, overtime, dj, employees };
  const INCOME_LABELS = [
    { id: 'rent',   label: 'Оферта' },
    { id: 'drinks', label: 'Напитки' },
    { id: 'addons', label: 'Доп. услуги' },
    { id: 'dj',     label: 'DJ' },
    { id: 'employees', label: 'Почистване' },
    { id: 'overtime', label: 'Извънреден час' },
  ];
  const incomeBreak = document.getElementById('income-cat-breakdown');
  if (incomeBreak) {
    incomeBreak.innerHTML = INCOME_LABELS.filter(c => incomeCats[c.id] > 0).map(c => `
      <div class="pill" data-cat="${esc(c.id)}">
        <div class="pill__label">${esc(c.label)}</div>
        <div class="pill__value">${fmtEur(incomeCats[c.id])}</div>
        <div class="pill__sub">${fmtBgn(incomeCats[c.id] * BGN_RATE)}${income ? ` <span class="pill__pct">${Math.round(incomeCats[c.id] / income * 100)}%</span>` : ''}</div>
      </div>
    `).join('');
  }
  const expenseBreak = document.getElementById('expense-cat-breakdown');
  if (expenseBreak) {
    const html = EXPENSE_CATS.filter(c => expByCat[c.id] > 0).map(c => `
      <div class="pill" data-cat="${esc(c.id)}">
        <div class="pill__label">${esc(c.label)}</div>
        <div class="pill__value">${fmtEur(expByCat[c.id])}</div>
        <div class="pill__sub">${fmtBgn(expByCat[c.id] * BGN_RATE)}${expense ? ` <span class="pill__pct">${Math.round(expByCat[c.id] / expense * 100)}%</span>` : ''}</div>
      </div>
    `).join('');
    expenseBreak.innerHTML = html || '<div class="empty-state">Няма разходи в този период.</div>';
  }
}

// ────────────────────────────────────────────────────────────────
// Left rail
// ────────────────────────────────────────────────────────────────

function renderEventsList(filter = '') {
  const wrap = document.getElementById('events-list');
  const cnt  = document.getElementById('events-list-count');
  const needle = filter.trim().toLowerCase();

  // Section 1 — enquiry-linked events (from public form).
  const monthScopedEnq = filteredEvents();
  const enqMatches = needle
    ? monthScopedEnq.filter(e => (e.full_name || '').toLowerCase().includes(needle))
    : monthScopedEnq;

  // Section 2 — manual events (bookkeeper-entered, no enquiry).
  const monthScopedManual = filteredManualFeRows();
  const manualMatches = needle
    ? monthScopedManual.filter(fe => (fe.customer_name || '').toLowerCase().includes(needle))
    : monthScopedManual;

  if (cnt) cnt.textContent = enqMatches.length + manualMatches.length;

  const renderEnq = e => {
    const fe = financialEventByEnquiryId.get(e.id);
    const inc = fe ? feIncome(fe).total : null;
    const exp = fe ? feExpenseTotal(fe) : 0;
    const net = inc != null ? (inc - exp) : null;
    const margin = (inc != null && inc > 0) ? Math.round((net / inc) * 100) : null;
    const selected = e.id === selectedEnquiryId ? ' is-selected' : '';
    const marginClass = margin == null ? '' : (margin >= 0 ? ' is-positive' : ' is-negative');
    const iso = parsePreferredDate(e.preferred_date);
    return `
      <button type="button" class="event-pnl__event${selected}" data-enquiry="${esc(e.id)}">
        <div class="event-pnl__event-name"><span class="enquiry-no">#${esc(e.enquiry_number ?? '—')}</span> ${esc(e.full_name || '—')}</div>
        <div class="event-pnl__event-meta">${fmtDateBg(iso)} · ${inc != null ? fmtEur(inc) : '—'}</div>
        <div class="event-pnl__event-margin${marginClass}">${margin == null ? '—' : margin + '%'}</div>
      </button>
    `;
  };

  const renderManual = fe => {
    const inc = feIncome(fe).total;
    const exp = feExpenseTotal(fe);
    const net = inc - exp;
    const margin = inc > 0 ? Math.round((net / inc) * 100) : null;
    const selected = fe.id === selectedManualFeId ? ' is-selected' : '';
    const marginClass = margin == null ? '' : (margin >= 0 ? ' is-positive' : ' is-negative');
    return `
      <button type="button" class="event-pnl__event${selected}" data-manual-fe="${esc(fe.id)}">
        <div class="event-pnl__event-name"><span class="enquiry-no enquiry-no--manual">M</span> ${esc(fe.customer_name || '—')}</div>
        <div class="event-pnl__event-meta">${fmtDateBg(fe.event_date)} · ${fmtEur(inc)}</div>
        <div class="event-pnl__event-margin${marginClass}">${margin == null ? '—' : margin + '%'}</div>
      </button>
    `;
  };

  const sectionLabel = (txt, count) =>
    `<div class="event-pnl__section-label">${esc(txt)} <span class="event-pnl__section-count">${count}</span></div>`;

  let html = '';

  if (enqMatches.length) {
    html += sectionLabel('От запитвания', enqMatches.length);
    html += enqMatches.map(renderEnq).join('');
  }
  // Manual events section — always show the header so the "+ Add manual"
  // button has a home, even when the list is empty.
  html += sectionLabel('Ръчни събития', manualMatches.length);
  if (manualMatches.length) {
    html += manualMatches.map(renderManual).join('');
  } else {
    html += '<div class="event-pnl__empty-tip">Натиснете „+ Добави ръчно събитие" за да внесете събитие, което не е минало през формата.</div>';
  }
  html += `<button type="button" class="event-pnl__add-manual" id="btn-add-manual-event">+ Добави ръчно събитие</button>`;

  if (!enqMatches.length && !manualMatches.length) {
    // No enquiries OR manual — still want the add button visible above.
    // Already added; nothing else to do.
  }

  wrap.innerHTML = html;
}

// ────────────────────────────────────────────────────────────────
// Right detail — P&L
// ────────────────────────────────────────────────────────────────

// Returns the current (dirty-aware) value of a fe field.
function feFieldValue(fe, field) {
  return field in dirtyFe ? dirtyFe[field] : fe?.[field];
}
// Returns the current (dirty-aware) value of an expense field.
function expFieldValue(row, field) {
  const dirty = dirtyExpenses.get(row.id);
  return dirty && (field in dirty) ? dirty[field] : row[field];
}
// Returns the current (dirty-aware) value of an income-service field.
function incItemFieldValue(row, field) {
  const dirty = dirtyIncomeItems.get(row.id);
  return dirty && (field in dirty) ? dirty[field] : row[field];
}
// Live (dirty-aware) sum of the open event's itemized service income.
function liveAddonsTotal(fe) {
  if (!fe) return 0;
  const rows = incomeItemsByEvent.get(fe.id) || [];
  return rows.reduce((s, r) => s + Number(incItemFieldValue(r, 'amount_eur') || 0), 0);
}

function liveIncomeTotals(fe) {
  const rent   = Number(feFieldValue(fe, 'income_rent_eur')   || 0);
  // Drinks come from the editable, live-priced P&L drink list (dirty-aware).
  const drinks = drinksTotalOf(getWorkingDrinks());
  const addons = liveAddonsTotal(fe);
  // Overtime € is the source of truth (editable). hours × rate just auto-fills
  // it (see setFeDirty), so reading the field here covers both flat and
  // computed entry without a fallback that could clobber a manual value.
  const overtime = Number(feFieldValue(fe, 'income_overtime_eur') || 0);
  const dj = Number(feFieldValue(fe, 'income_dj_eur') || 0);
  const employees = Number(feFieldValue(fe, 'income_employees_eur') || 0);
  return { rent, drinks, addons, overtime, dj, employees, total: rent + drinks + addons + overtime + dj + employees };
}
function livePaid(fe) {
  return Number(feFieldValue(fe, 'deposit_cash_eur') || 0)
       + Number(feFieldValue(fe, 'deposit_bank_eur') || 0)
       + Number(feFieldValue(fe, 'deposit_card_eur') || 0)
       + Number(feFieldValue(fe, 'balance_cash_eur') || 0)
       + Number(feFieldValue(fe, 'balance_bank_eur') || 0)
       + Number(feFieldValue(fe, 'balance_card_eur') || 0)
       + Number(feFieldValue(fe, 'payment3_cash_eur') || 0)
       + Number(feFieldValue(fe, 'payment3_bank_eur') || 0)
       + Number(feFieldValue(fe, 'payment3_card_eur') || 0);
}
function liveExpenseTotal(fe) {
  if (!fe) return 0;
  const rows = expensesByEvent.get(fe.id) || [];
  return rows.reduce((s, r) => s + Number(expFieldValue(r, 'amount_eur') || 0), 0);
}

// ────────────────────────────────────────────────────────────────
// P&L drinks — editable, live-priced list. The P&L keeps its own adjusted
// copy (financial_events.pnl_drinks); the booking's drinks are never
// mutated. All edits are draft (staged in dirtyFe.pnl_drinks +
// dirtyFe.income_drinks_eur) until Save, like the rest of the panel.
// ────────────────────────────────────────────────────────────────

function seedDrinksFromOrder(enquiry) {
  const arr = Array.isArray(enquiry?.drinks) ? enquiry.drinks : [];
  return arr.map(d => {
    const c = d.id ? drinkCatalogById.get(d.id) : null;
    return {
      id: d.id || null,
      name: c ? c.name_bg : (d.name || ''),   // prefer the BG catalog name
      qty: Number(d.qty) || 0,
      unit_price_eur: d.price_eur != null ? Number(d.price_eur) : null,
      manual: false,
    };
  });
}
// Dirty-aware working list for the open event.
function getWorkingDrinks() {
  if ('pnl_drinks' in dirtyFe) return dirtyFe.pnl_drinks || [];
  const sel = currentSelection();
  if (sel?.fe && sel.fe.pnl_drinks != null) return sel.fe.pnl_drinks;
  return seedDrinksFromOrder(sel?.enquiry);
}
// Promote the working list into a mutable draft staged on dirtyFe.
function ensureDrinksDraft() {
  if (!('pnl_drinks' in dirtyFe)) {
    dirtyFe.pnl_drinks = getWorkingDrinks().map(l => ({ ...l }));
  }
  return dirtyFe.pnl_drinks;
}
function drinkUnitPrice(line) {
  if (line.manual) return Number(line.unit_price_eur) || 0;
  const c = drinkCatalogById.get(line.id);
  if (c) return Number(c.price_eur) || 0;
  return Number(line.unit_price_eur) || 0;
}
function drinkLineTotal(line) { return drinkUnitPrice(line) * (Number(line.qty) || 0); }
function drinksTotalOf(arr) {
  if (!Array.isArray(arr)) return 0;
  return Math.round(arr.reduce((s, l) => s + drinkLineTotal(l), 0) * 100) / 100;
}

// Stage the draft array + recomputed cached total into dirtyFe.
function stageDrinks(arr) {
  dirtyFe.pnl_drinks = arr;
  dirtyFe.income_drinks_eur = drinksTotalOf(arr);
}
// Live refresh of line €/unit/subtotal/income WITHOUT rebuilding inputs (focus-safe).
function refreshDrinkTotals() {
  const arr = getWorkingDrinks();
  arr.forEach((l, i) => {
    const el = document.getElementById('pnl-drink-eur-' + i);
    if (el) el.textContent = fmtEur(drinkLineTotal(l));
    const unit = document.getElementById('pnl-drink-unit-' + i);
    if (unit) unit.textContent = fmtEur(drinkUnitPrice(l));
  });
  const tot = document.getElementById('pnl-drinks-total');
  if (tot) tot.textContent = fmtEur(drinksTotalOf(arr));
  updateDetailTotals();
}

function setDrinkQty(index, raw) {
  const arr = ensureDrinksDraft();
  if (!arr[index]) return;
  arr[index].qty = raw === '' ? 0 : Number(raw);
  stageDrinks(arr);
  refreshDrinkTotals();
}
function setDrinkSelect(index, drinkId) {
  const arr = ensureDrinksDraft();
  if (!arr[index]) return;
  const c = drinkCatalogById.get(drinkId);
  arr[index].id = drinkId;
  arr[index].manual = false;
  if (c) { arr[index].name = c.name_bg; arr[index].unit_price_eur = Number(c.price_eur); }
  stageDrinks(arr);
  renderDrinks();
  updateDetailTotals();
}
function setManualDrinkField(index, field, raw) {
  const arr = ensureDrinksDraft();
  if (!arr[index]) return;
  if (field === 'name') arr[index].name = raw;
  if (field === 'unit_price_eur') arr[index].unit_price_eur = raw === '' ? 0 : Number(raw);
  stageDrinks(arr);
  refreshDrinkTotals();
}
function addCatalogDrink() {
  if (!currentSelection()) return;
  const arr = ensureDrinksDraft();
  const first = (typeof drinks !== 'undefined' && Array.isArray(drinks) && drinks[0]) ? drinks[0] : null;
  arr.push(first
    ? { id: first.id, name: first.name_bg, qty: 1, unit_price_eur: Number(first.price_eur), manual: false }
    : { id: null, name: '', qty: 1, unit_price_eur: 0, manual: true });
  stageDrinks(arr);
  renderDrinks();
  updateDetailTotals();
}
function addManualDrink() {
  if (!currentSelection()) return;
  const arr = ensureDrinksDraft();
  arr.push({ id: null, name: '', qty: 1, unit_price_eur: 0, manual: true });
  stageDrinks(arr);
  renderDrinks();
  updateDetailTotals();
}
function deleteDrink(index) {
  const arr = ensureDrinksDraft();
  if (index < 0 || index >= arr.length) return;
  arr.splice(index, 1);
  stageDrinks(arr);
  renderDrinks();
  updateDetailTotals();
}

// Catalog <option> list grouped by category, preselecting `selId`.
function drinkCatalogOptions(selId) {
  if (typeof drinks === 'undefined' || !Array.isArray(drinks)) return '';
  const groups = (typeof drinkCategories !== 'undefined' && drinkCategories?.bg) ? drinkCategories.bg : [];
  return groups.map((g, ci) => {
    const opts = drinks.filter(d => d.cat === ci).map(d =>
      `<option value="${esc(d.id)}"${d.id === selId ? ' selected' : ''}>${esc(d.name_bg)} — ${fmtEur(d.price_eur)}</option>`
    ).join('');
    return opts ? `<optgroup label="${esc(g)}">${opts}</optgroup>` : '';
  }).join('');
}

function renderDrinks() {
  const wrap = document.getElementById('pnl-drinks-lines');
  if (!wrap) return;
  const arr = getWorkingDrinks();
  const tot = document.getElementById('pnl-drinks-total');
  if (tot) tot.textContent = fmtEur(drinksTotalOf(arr));
  if (!arr.length) {
    wrap.innerHTML = '<li class="empty-state">Няма напитки. Добавете от каталога или ръчно.</li>';
    return;
  }
  wrap.innerHTML = arr.map((l, i) => {
    const lineEur = fmtEur(drinkLineTotal(l));
    // Keep the <select>, the priced unit, and the stored id in agreement even
    // for a drink that has since left the catalog — otherwise the browser
    // silently auto-selects the first option while pricing the stored fallback.
    const inCatalog = !l.manual && l.id && drinkCatalogById.has(l.id);
    const selectOptions = inCatalog
      ? drinkCatalogOptions(l.id)
      : `<option value="${esc(l.id || '')}" selected>${esc(l.name || '—')} — ${fmtEur(drinkUnitPrice(l))} (извън каталога)</option>` + drinkCatalogOptions(null);
    if (l.manual) {
      return `
        <li class="event-pnl__line event-pnl__line--drink" data-drink-index="${i}">
          <div class="event-pnl__drink-row">
            <input type="text" class="event-pnl__drink-name" data-drink-f="name" value="${esc(l.name || '')}" placeholder="Напитка (ръчно)">
            <input type="number" step="0.01" min="0" class="event-pnl__drink-price" data-drink-f="unit_price_eur" value="${l.unit_price_eur ?? ''}" placeholder="€/бр" title="Цена за брой">
            <span class="event-pnl__drink-op" aria-hidden="true">×</span>
            <input type="number" step="1" min="0" class="event-pnl__drink-qty" data-drink-f="qty" value="${l.qty ?? ''}" placeholder="бр" aria-label="Брой">
            <span class="event-pnl__drink-op" aria-hidden="true">=</span>
            <span class="event-pnl__drink-eur" id="pnl-drink-eur-${i}">${lineEur}</span>
            <button type="button" class="del-btn" data-del-drink="${i}" title="Изтрий">×</button>
          </div>
        </li>`;
    }
    return `
      <li class="event-pnl__line event-pnl__line--drink" data-drink-index="${i}">
        <div class="event-pnl__drink-row">
          <select class="event-pnl__drink-select" data-drink-f="select" aria-label="Напитка">${selectOptions}</select>
          <span class="event-pnl__drink-unit" id="pnl-drink-unit-${i}">${fmtEur(drinkUnitPrice(l))}</span>
          <span class="event-pnl__drink-op" aria-hidden="true">×</span>
          <input type="number" step="1" min="0" class="event-pnl__drink-qty" data-drink-f="qty" value="${l.qty ?? ''}" placeholder="бр" aria-label="Брой">
          <span class="event-pnl__drink-op" aria-hidden="true">=</span>
          <span class="event-pnl__drink-eur" id="pnl-drink-eur-${i}">${lineEur}</span>
          <button type="button" class="del-btn" data-del-drink="${i}" title="Изтрий">×</button>
        </div>
      </li>`;
  }).join('');
}

function renderDetail() {
  const placeholder = document.getElementById('pnl-placeholder');
  const body = document.getElementById('pnl-body');
  const sel = currentSelection();
  if (!sel) { placeholder.hidden = false; body.hidden = true; return; }
  placeholder.hidden = true;
  body.hidden = false;

  const { kind, enquiry, fe } = sel;

  // Hero — enquiry path shows "#1001 Name + event type + guests".
  // Manual path shows "M Name + raw date" and an explicit "Ръчно" badge.
  if (kind === 'enquiry' && enquiry) {
    document.getElementById('pnl-customer').innerHTML =
      `<span class="enquiry-no">#${esc(enquiry.enquiry_number ?? '—')}</span> ${esc(enquiry.full_name || '—')}`;
    document.getElementById('pnl-date').textContent     = fmtDateBg(parsePreferredDate(enquiry.preferred_date));
    document.getElementById('pnl-event-type').textContent = enquiry.event_type || '—';
    document.getElementById('pnl-guests').textContent   = (enquiry.guests != null ? enquiry.guests + ' гости' : '—');
  } else {
    // Manual event — name + date are stored on the fe row itself.
    document.getElementById('pnl-customer').innerHTML =
      `<span class="enquiry-no enquiry-no--manual">M</span> ${esc(fe.customer_name || '—')}`;
    document.getElementById('pnl-date').textContent     = fmtDateBg(fe.event_date);
    document.getElementById('pnl-event-type').textContent = fe.event_type || 'Ръчно събитие';
    document.getElementById('pnl-guests').textContent   = '—';
  }

  // Fixed income lines — editable. Prefilled by ensureFinancialEvent from
  // the enquiry breakdown; admin can refine before saving. Drinks are an
  // itemized list below (#pnl-drinks-lines); additional services are itemized
  // in #pnl-income-lines-services.
  const linesHtml = [
    { lbl: 'Оферта (зала + гости)', field: 'income_rent_eur',   detail: null },
    { lbl: 'DJ',                     field: 'income_dj_eur',     detail: null },
    { lbl: 'Почистване',              field: 'income_employees_eur', detail: null },
    { lbl: 'Извънреден час (овъртайм)', field: 'income_overtime_eur', detail: null, hoursField: 'income_overtime_hours', rateField: 'income_overtime_rate_eur', computed: true },
  ].map(r => {
    const v = feFieldValue(fe, r.field);
    const hv = r.hoursField ? feFieldValue(fe, r.hoursField) : null;
    const rv = r.rateField ? feFieldValue(fe, r.rateField) : null;
    const items = Array.isArray(r.detail) ? r.detail : [];
    const expandable = items.length > 0;
    const open = expandable && r.open === true; // add-ons breakdown shown by default
    const expandedAttr = expandable ? ` data-expand="${esc(r.field)}"` : '';
    const chevron = expandable
      ? `<span class="event-pnl__expand-chevron" aria-hidden="true">›</span>`
      : '';
    const itemsList = expandable ? `
      <ul class="event-pnl__sub-items" id="sub-${esc(r.field)}"${open ? '' : ' hidden'}>
        ${items.map(it => {
          // Addons store LINE price as 'price'; drinks store unit price as 'price_eur' + qty.
          const name = it.name || it.id || '—';
          const qty = it.qty;
          const unit = it.price_eur != null ? Number(it.price_eur) : null;
          const linePrice = it.price != null ? Number(it.price)
                          : (unit != null && qty != null ? unit * qty : null);
          const qtyLabel = qty != null ? ` × ${qty}` : '';
          const priceLabel = linePrice != null ? fmtEur(linePrice) : '—';
          return `<li><span class="event-pnl__sub-name">${esc(name)}${qtyLabel}</span><span class="event-pnl__sub-val">${priceLabel}</span></li>`;
        }).join('')}
      </ul>
    ` : '';
    // Overtime line: hours × €/hour. Entering BOTH auto-fills the € amount
    // (income_overtime_eur) via setFeDirty. The € stays an EDITABLE input, so
    // a flat overtime can be typed directly and legacy values stay editable.
    if (r.computed) {
      return `
        <li class="event-pnl__line event-pnl__line--editable event-pnl__line--overtime">
          <span class="event-pnl__line-lbl">${esc(r.lbl)}</span>
          <span class="event-pnl__ot-calc">
            <input type="number" step="0.5" min="0" class="event-pnl__line-input event-pnl__line-hours"
                   data-fe-field="${esc(r.hoursField)}" value="${hv ? hv : ''}" placeholder="часа" aria-label="Часове извънреден труд">
            <span class="event-pnl__ot-op" aria-hidden="true">×</span>
            <input type="number" step="0.01" min="0" class="event-pnl__line-input event-pnl__line-rate"
                   data-fe-field="${esc(r.rateField)}" value="${rv ? rv : ''}" placeholder="€/час" aria-label="Ставка на час">
            <span class="event-pnl__ot-op" aria-hidden="true">=</span>
            <input type="number" step="0.01" id="pnl-overtime-eur-input" class="event-pnl__line-input event-pnl__ot-result-input"
                   data-fe-field="${r.field}" value="${v ?? ''}" placeholder="€" aria-label="Сума извънреден час">
          </span>
        </li>
      `;
    }
    return `
      <li class="event-pnl__line event-pnl__line--editable${expandable ? ' is-expandable' : ''}${open ? ' is-open' : ''}"${expandedAttr}>
        <span class="event-pnl__line-lbl">${chevron}${esc(r.lbl)}</span>
        <input type="number" step="0.01" class="event-pnl__line-input"
               data-fe-field="${r.field}" value="${v ?? ''}" placeholder="€">
      </li>
      ${itemsList}
    `;
  }).join('');
  document.getElementById('pnl-income-lines').innerHTML = linesHtml;

  // Drinks — editable, live-priced list (seeded from the booking).
  renderDrinks();

  // Additional services — itemized, categorized income lines. Mirrors the
  // expense-line UI (category + amount + note + delete). Above the editable
  // lines we show, read-only, what the customer originally added on the
  // booking form so the bookkeeper knows what to itemize.
  const incRows = fe ? (incomeItemsByEvent.get(fe.id) || []) : [];
  const pickedAddons = Array.isArray(enquiry?.addons) ? enquiry.addons : [];
  const pickedHint = pickedAddons.length ? `
    <li class="event-pnl__svc-ref">
      <div class="event-pnl__svc-ref-lbl">Клиентът добави към офертата:</div>
      <ul class="event-pnl__sub-items">
        ${pickedAddons.map(a => {
          const name = a.name || a.id || '—';
          const price = a.price != null ? fmtEur(Number(a.price)) : '—';
          return `<li><span class="event-pnl__sub-name">${esc(name)}</span><span class="event-pnl__sub-val">${price}</span></li>`;
        }).join('')}
      </ul>
    </li>` : '';
  const incItemsHtml = incRows.length
    ? incRows.map(x => {
        const cat   = incItemFieldValue(x, 'category');
        const amt   = incItemFieldValue(x, 'amount_eur');
        const notes = incItemFieldValue(x, 'notes');
        const opts = INCOME_SERVICE_CATS.map(c =>
          `<option value="${c.id}" ${cat === c.id ? 'selected' : ''}>${esc(c.label)}</option>`
        ).join('');
        return `
          <li class="event-pnl__line event-pnl__line--expense" data-income-id="${esc(x.id)}">
            <div class="event-pnl__line-row">
              <select data-fi="category">${opts}</select>
              <input type="number" step="0.01" data-fi="amount_eur" value="${amt ?? ''}" placeholder="€">
              <button type="button" class="del-btn" data-del-income="${esc(x.id)}" title="Изтрий">×</button>
              <textarea data-fi="notes" class="event-pnl__line-notes" rows="1" placeholder="Коментар (напр. кой достави услугата)">${esc(notes || '')}</textarea>
            </div>
          </li>`;
      }).join('')
    : '<li class="empty-state">Няма добавени услуги.</li>';
  const svcWrap = document.getElementById('pnl-income-lines-services');
  if (svcWrap) svcWrap.innerHTML = pickedHint + incItemsHtml;

  // Payments grid (also dirty-aware). Mirrors the 3 methods the
  // customer can pick on the public form: cash / bank transfer / card.
  // If we have an enquiry we also show the customer's stated preferred
  // method as a hint above the inputs so the bookkeeper knows which
  // bucket to expect.
  if (fe) {
    const v = f => {
      const x = feFieldValue(fe, f);
      return x == null ? '' : x;
    };
    const METHOD_LABELS_BG = { cash: 'Брой', transfer: 'Банков превод', card: 'Карта' };
    const prefMethod = enquiry?.payment_method;
    const prefHint = prefMethod
      ? `<div class="event-pnl__pay-pref">Клиентът избра: <strong>${esc(METHOD_LABELS_BG[prefMethod] || prefMethod)}</strong></div>`
      : '';
    // What was marked paid on the enquiry (Bank/Cash/Card). The deposit fields
    // are prefilled from this on first creation; this line lets the bookkeeper
    // reconcile if it was marked after the P&L was opened.
    const pt = enquiry?.payment_tracking || {};
    const ptAmt = (k) => { const n = parseFloat(pt[k]); return Number.isFinite(n) && n > 0 ? n : 0; };
    const markedHint = (enquiry && (ptAmt('cash') + ptAmt('bank') + ptAmt('card')) > 0)
      ? `<div class="event-pnl__pay-pref">Отбелязано в запитването: <strong>Брой ${fmtEur(ptAmt('cash'))} · Банка ${fmtEur(ptAmt('bank'))} · Карта ${fmtEur(ptAmt('card'))}</strong></div>`
      : '';
    document.getElementById('pnl-payments').innerHTML = `
      ${prefHint}
      ${markedHint}
      <div class="event-pnl__pay-grid event-pnl__pay-grid--3col">
        <div class="event-pnl__pay-head">Брой €</div>
        <div class="event-pnl__pay-head">Банка €</div>
        <div class="event-pnl__pay-head">Карта €</div>
        <input type="number" step="0.01" data-fe-field="deposit_cash_eur" value="${v('deposit_cash_eur')}" placeholder="Аванс">
        <input type="number" step="0.01" data-fe-field="deposit_bank_eur" value="${v('deposit_bank_eur')}" placeholder="Аванс">
        <input type="number" step="0.01" data-fe-field="deposit_card_eur" value="${v('deposit_card_eur')}" placeholder="Аванс">
        <input type="number" step="0.01" data-fe-field="balance_cash_eur" value="${v('balance_cash_eur')}" placeholder="Доплащане">
        <input type="number" step="0.01" data-fe-field="balance_bank_eur" value="${v('balance_bank_eur')}" placeholder="Доплащане">
        <input type="number" step="0.01" data-fe-field="balance_card_eur" value="${v('balance_card_eur')}" placeholder="Доплащане">
        <input type="number" step="0.01" data-fe-field="payment3_cash_eur" value="${v('payment3_cash_eur')}" placeholder="3-то плащане">
        <input type="number" step="0.01" data-fe-field="payment3_bank_eur" value="${v('payment3_bank_eur')}" placeholder="3-то плащане">
        <input type="number" step="0.01" data-fe-field="payment3_card_eur" value="${v('payment3_card_eur')}" placeholder="3-то плащане">
      </div>
      <div class="event-pnl__pay-dates">
        <label><span>Дата на аванса</span><input type="date" data-fe-field="deposit_date" value="${v('deposit_date')}"></label>
        <label><span>Дата на доплащането</span><input type="date" data-fe-field="balance_date" value="${v('balance_date')}"></label>
        <label><span>Дата на 3-то плащане</span><input type="date" data-fe-field="payment3_date" value="${v('payment3_date')}"></label>
      </div>
    `;
  } else {
    document.getElementById('pnl-payments').innerHTML = '<div class="empty-state">Зареждане…</div>';
  }

  // Expense lines — dirty-aware. One horizontal scrolling row per
  // expense: category, amount, delete, comment. The old standalone
  // 'description' field was removed; the comment textarea covers that
  // need with more room. Scroll right to reach the comment.
  const rows = fe ? (expensesByEvent.get(fe.id) || []) : [];
  document.getElementById('pnl-expense-lines').innerHTML = rows.length
    ? rows.map(x => {
        const cat   = expFieldValue(x, 'category');
        const amt   = expFieldValue(x, 'amount_eur');
        const notes = expFieldValue(x, 'notes');
        const opts = EXPENSE_CATS.map(c =>
          `<option value="${c.id}" ${cat === c.id ? 'selected' : ''}>${esc(c.label)}</option>`
        ).join('');
        return `
          <li class="event-pnl__line event-pnl__line--expense" data-id="${esc(x.id)}">
            <div class="event-pnl__line-row">
              <select data-f="category">${opts}</select>
              <input type="number" step="0.01" data-f="amount_eur" value="${amt ?? ''}" placeholder="€">
              <button type="button" class="del-btn" data-del="${esc(x.id)}" title="Изтрий">×</button>
              <textarea data-f="notes" class="event-pnl__line-notes" rows="1" placeholder="Коментар (напр. DJ за вечерта, телефон на доставчика, забележки…)">${esc(notes || '')}</textarea>
            </div>
          </li>
        `;
      }).join('')
    : '<li class="empty-state">Няма прикрепени разходи.</li>';

  // Hero totals + Save-button state. Computed in one place so the
  // live-typing path can refresh them WITHOUT rebuilding the inputs.
  updateDetailTotals();
}

// Refresh only the DERIVED figures (hero totals + Save button) for the
// open event. Reads dirty-aware values, touches no <input>, so it is
// safe to call on every keystroke — this is what stops the focus loss.
function updateDetailTotals() {
  const sel = currentSelection();
  if (!sel) return;
  const fe = sel.fe;

  const inc = liveIncomeTotals(fe);
  const expense = liveExpenseTotal(fe);
  const paid = livePaid(fe);
  const balance = inc.total - paid;
  const net = inc.total - expense;
  const margin = inc.total > 0 ? Math.round((net / inc.total) * 100) : null;

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('pnl-income-total',  fmtEur(inc.total));
  set('pnl-drinks-total',  fmtEur(drinksTotalOf(getWorkingDrinks())));
  set('pnl-services-total', fmtEur(liveAddonsTotal(fe)));
  set('pnl-expense-total', fmtEur(expense));
  set('pnl-paid-total',    fmtEur(paid));
  set('pnl-balance',       fmtEur(balance));
  set('pnl-net-eur',       fmtEur(net));
  set('pnl-net-bgn',       fmtBgn(net * BGN_RATE));
  const marginEl = document.getElementById('pnl-margin');
  if (marginEl) {
    marginEl.textContent = margin == null ? '—' : margin + '%';
    marginEl.className = 'event-pnl__hero-val ' + (margin == null ? '' : (margin >= 0 ? 'is-positive' : 'is-negative'));
  }

  const saveBtn = document.getElementById('btn-save-pnl');
  if (saveBtn) {
    saveBtn.disabled = !isDirty();
    saveBtn.textContent = isDirty()
      ? `Запази промените · ${Object.keys(dirtyFe).length + dirtyExpenses.size + dirtyIncomeItems.size} промени`
      : 'Запази промените';
  }
}

// ────────────────────────────────────────────────────────────────
// Draft mutators (no DB until Save is pressed)
// ────────────────────────────────────────────────────────────────

function setFeDirty(field, raw) {
  let value = raw;
  if (field.endsWith('_eur')) value = raw === '' ? 0 : Number(raw);
  if (field.endsWith('_hours')) value = raw === '' ? null : Number(raw);
  if (field.endsWith('_date')) value = raw || null;
  dirtyFe[field] = value;
  // Overtime: when BOTH hours and rate are set, auto-fill the € amount
  // (hours × rate) into income_overtime_eur and reflect it in the € input.
  // When they're not both set we leave the € untouched, so a flat amount
  // typed directly (or a legacy value) is never clobbered.
  if (field === 'income_overtime_hours' || field === 'income_overtime_rate_eur') {
    const fe = currentSelection()?.fe;
    const hours = Number(feFieldValue(fe, 'income_overtime_hours') || 0);
    const rate  = Number(feFieldValue(fe, 'income_overtime_rate_eur') || 0);
    if (hours > 0 && rate > 0) {
      const computed = Math.round(hours * rate * 100) / 100;
      dirtyFe.income_overtime_eur = computed;
      const eurInput = document.getElementById('pnl-overtime-eur-input');
      if (eurInput) eurInput.value = computed;
    }
  }
  // Live-typing path: only refresh derived totals. Rebuilding the inputs
  // here (renderDetail) would destroy the field being typed into and drop
  // focus after every keystroke.
  updateDetailTotals();
}
function setExpenseDirty(id, field, raw) {
  let value = raw;
  if (field === 'amount_eur') value = raw === '' ? 0 : Number(raw);
  const current = dirtyExpenses.get(id) || {};
  current[field] = value;
  dirtyExpenses.set(id, current);
  // Same as setFeDirty: refresh totals only, keep the input alive.
  updateDetailTotals();
}
function setIncomeItemDirty(id, field, raw) {
  let value = raw;
  if (field === 'amount_eur') value = raw === '' ? 0 : Number(raw);
  const current = dirtyIncomeItems.get(id) || {};
  current[field] = value;
  dirtyIncomeItems.set(id, current);
  // Refresh totals only — never rebuild the line being typed into.
  updateDetailTotals();
}

// ────────────────────────────────────────────────────────────────
// Save / cancel
// ────────────────────────────────────────────────────────────────

async function saveDraft() {
  const sel = currentSelection();
  if (!sel || !sel.fe) return;
  const fe = sel.fe;

  const ops = [];
  if (Object.keys(dirtyFe).length) {
    const patch = { ...dirtyFe, updated_at: new Date().toISOString() };
    ops.push(db.from('financial_events').update(patch).eq('id', fe.id).then(({ error }) => {
      if (error) throw error;
      Object.assign(fe, dirtyFe);
    }));
  }
  for (const [id, patchFields] of dirtyExpenses) {
    const patch = { ...patchFields, updated_at: new Date().toISOString() };
    ops.push(db.from('financial_expenses').update(patch).eq('id', id).then(({ error }) => {
      if (error) throw error;
      for (const [, rows] of expensesByEvent) {
        const r = rows.find(x => x.id === id);
        if (r) Object.assign(r, patchFields);
      }
    }));
  }
  for (const [id, patchFields] of dirtyIncomeItems) {
    const patch = { ...patchFields, updated_at: new Date().toISOString() };
    ops.push(db.from('financial_income_items').update(patch).eq('id', id).then(({ error }) => {
      if (error) throw error;
      const rows = incomeItemsByEvent.get(fe.id) || [];
      const r = rows.find(x => x.id === id);
      if (r) Object.assign(r, patchFields);
    }));
  }

  const btn = document.getElementById('btn-save-pnl');
  if (btn) { btn.disabled = true; btn.textContent = 'Запазване…'; }
  try {
    await Promise.all(ops);
    // Item edits are now applied in memory — refresh the cached column.
    await syncAddonsColumn(fe);
    dirtyFe = {};
    dirtyExpenses = new Map();
    dirtyIncomeItems = new Map();
    renderEventsList(document.getElementById('events-search').value);
    renderMonthSummary();
    renderDetail();
  } catch (err) {
    console.error('saveDraft failed', err);
    alert('Грешка при запис: ' + (err?.message || err));
    if (btn) { btn.disabled = false; btn.textContent = 'Запази промените'; }
  }
}

function cancelDraft() {
  dirtyFe = {};
  dirtyExpenses = new Map();
  dirtyIncomeItems = new Map();
  renderDetail();
}

// Wipe the whole P&L for the selected event. Deletes the
// financial_events row and all expenses attached to it. The underlying
// enquiry is untouched, so the event will reappear in the list with a
// clean slate next time it's clicked (ensureFinancialEvent will create
// a fresh row prefilled from the enquiry).
async function deletePnl() {
  const sel = currentSelection();
  if (!sel || !sel.fe) return;
  const { kind, enquiry, fe } = sel;
  const label = enquiry ? (enquiry.full_name || '—') : (fe.customer_name || '—');
  const msg = kind === 'enquiry'
    ? `Изтриване на P&L за "${label}"?\nЗапитването НЕ се изтрива. Прикачените разходи се изтриват също.`
    : `Изтриване на ръчното събитие "${label}"?\nСамото събитие и всички прикачени разходи се изтриват.`;
  if (!confirm(msg)) return;

  // Delete expenses first: financial_expenses.event_id is ON DELETE SET NULL,
  // so dropping the fe row would null-orphan them rather than remove them.
  // Income items (financial_income_items.event_id is ON DELETE CASCADE) are
  // removed by the DB automatically — only the in-memory map needs clearing.
  const rows = expensesByEvent.get(fe.id) || [];
  if (rows.length) {
    const { error: exErr } = await db.from('financial_expenses').delete().eq('event_id', fe.id);
    if (exErr) { console.error(exErr); alert('Грешка при изтриване на разходите'); return; }
  }
  const { error: feErr } = await db.from('financial_events').delete().eq('id', fe.id);
  if (feErr) { console.error(feErr); alert('Грешка при изтриване на P&L'); return; }

  financialEventsById.delete(fe.id);
  if (enquiry) financialEventByEnquiryId.delete(enquiry.id);
  expensesByEvent.delete(fe.id);
  incomeItemsByEvent.delete(fe.id); // DB rows cascade with the fe delete
  dirtyFe = {};
  dirtyExpenses = new Map();
  dirtyIncomeItems = new Map();
  clearSelection();
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
}

// ────────────────────────────────────────────────────────────────
// Add / delete expense (immediate, no draft)
// ────────────────────────────────────────────────────────────────

async function selectEnquiry(enquiryId) {
  if (isDirty()) {
    if (!confirm('Имате незапазени промени. Да ги отхвърля ли?')) return;
  }
  dirtyFe = {};
  dirtyExpenses = new Map();
  dirtyIncomeItems = new Map();
  selectedEnquiryId = enquiryId;
  selectedManualFeId = null;
  const enquiry = allEnquiries.find(e => e.id === enquiryId);
  if (enquiry) await ensureFinancialEvent(enquiry);
  renderEventsList(document.getElementById('events-search').value);
  renderDetail();
}

// Open a manual (no-enquiry) financial_event. Used when the bookkeeper
// clicks one in the "Ръчни събития" section of the left rail.
async function selectManual(feId) {
  if (isDirty()) {
    if (!confirm('Имате незапазени промени. Да ги отхвърля ли?')) return;
  }
  dirtyFe = {};
  dirtyExpenses = new Map();
  dirtyIncomeItems = new Map();
  selectedEnquiryId = null;
  selectedManualFeId = feId;
  renderEventsList(document.getElementById('events-search').value);
  renderDetail();
}

// Create a manual financial_events row from prompts. We don't bother
// with a custom modal — the inputs are: customer name, date, optional
// event type. Income fields stay at 0 so the bookkeeper fills them in
// via the normal P&L editor.
async function addManualEvent() {
  if (isDirty()) {
    if (!confirm('Имате незапазени промени. Да ги отхвърля ли?')) return;
  }
  const name = (prompt('Име на клиент:') || '').trim();
  if (!name) return;
  const defaultDate = monthFilter
    ? `${monthFilter}-${String(Math.min(new Date().getDate(), 28)).padStart(2,'0')}`
    : new Date().toISOString().slice(0, 10);
  const date = (prompt('Дата на събитието (YYYY-MM-DD):', defaultDate) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert('Невалидна дата (нужен формат YYYY-MM-DD)'); return; }
  const eventType = (prompt('Тип събитие (по избор):', '') || '').trim() || null;
  const month = date.slice(0, 7);

  const row = {
    month,
    event_date: date,
    customer_name: name,
    event_type: eventType,
    offer_total_eur: 0,
    income_rent_eur: 0,
    income_drinks_eur: 0,
    income_addons_eur: 0,
    enquiry_id: null,
    confirmed_by: userEmail,
    confirmed_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('financial_events').insert(row).select().single();
  if (error) { console.error('addManualEvent failed', error); alert('Грешка при добавяне: ' + (error.message || '')); return; }
  financialEventsById.set(data.id, data);
  selectedEnquiryId = null;
  selectedManualFeId = data.id;
  dirtyFe = {};
  dirtyExpenses = new Map();
  dirtyIncomeItems = new Map();
  // If the new event lands in a different month than the current filter,
  // jump the filter to its month so the user sees what they just created.
  if (data.month && data.month !== monthFilter) {
    monthFilter = data.month;
    const inp = document.getElementById('fin-month');
    if (inp) inp.value = data.month;
  }
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
}

async function addEventExpense() {
  const sel = currentSelection();
  if (!sel) return;
  // Enquiry selection might not have its fe created yet — lazily create.
  let fe = sel.fe;
  if (!fe && sel.enquiry) fe = await ensureFinancialEvent(sel.enquiry);
  if (!fe) return;
  const row = {
    month: fe.month,
    expense_date: fe.event_date || null,
    description: '',
    amount_eur: 0,
    category: 'other',
    event_id: fe.id,
  };
  const { data, error } = await db.from('financial_expenses').insert(row).select().single();
  if (error) { console.error(error); alert('Грешка при добавяне на разход'); return; }
  const arr = expensesByEvent.get(fe.id) || [];
  arr.push(data);
  expensesByEvent.set(fe.id, arr);
  renderDetail();
}

async function deleteExpense(id) {
  if (!confirm('Изтриване на този разход?')) return;
  const { error } = await db.from('financial_expenses').delete().eq('id', id);
  if (error) { console.error(error); alert('Грешка при изтриване'); return; }
  for (const [evId, rows] of expensesByEvent) {
    expensesByEvent.set(evId, rows.filter(x => x.id !== id));
  }
  dirtyExpenses.delete(id);
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
}

// ── Income service items ───────────────────────────────────────────
// Add/delete hit the DB immediately (like expenses); edits stay draft
// until Save. income_addons_eur is a cached mirror of the item sum.

// Keep income_addons_eur equal to the sum of the event's service lines.
// The UI reads the items directly; the column is synced for any external
// reader and so the value survives even if the items are reloaded.
async function syncAddonsColumn(fe) {
  if (!fe) return;
  const rows = incomeItemsByEvent.get(fe.id) || [];
  const sum = Math.round(rows.reduce((s, r) => s + Number(r.amount_eur || 0), 0) * 100) / 100;
  if (Number(fe.income_addons_eur || 0) === sum) return;
  fe.income_addons_eur = sum;
  const { error } = await db.from('financial_events')
    .update({ income_addons_eur: sum, updated_at: new Date().toISOString() })
    .eq('id', fe.id);
  if (error) console.error('syncAddonsColumn failed', error);
}

async function addIncomeService() {
  const sel = currentSelection();
  if (!sel) return;
  // Enquiry selection might not have its fe created yet — lazily create.
  let fe = sel.fe;
  if (!fe && sel.enquiry) fe = await ensureFinancialEvent(sel.enquiry);
  if (!fe) return;
  const row = {
    event_id: fe.id,
    month: fe.month,
    category: 'other',
    amount_eur: 0,
    notes: '',
  };
  const { data, error } = await db.from('financial_income_items').insert(row).select().single();
  if (error) { console.error(error); alert('Грешка при добавяне на услуга'); return; }
  const arr = incomeItemsByEvent.get(fe.id) || [];
  arr.push(data);
  incomeItemsByEvent.set(fe.id, arr);
  // New line starts at €0 — no need to touch the cached sum yet.
  renderDetail();
}

async function deleteIncomeItem(id) {
  if (!confirm('Изтриване на тази услуга?')) return;
  const { error } = await db.from('financial_income_items').delete().eq('id', id);
  if (error) { console.error(error); alert('Грешка при изтриване'); return; }
  let ownerFeId = null;
  for (const [evId, rows] of incomeItemsByEvent) {
    if (rows.some(x => x.id === id)) ownerFeId = evId;
    incomeItemsByEvent.set(evId, rows.filter(x => x.id !== id));
  }
  dirtyIncomeItems.delete(id);
  if (ownerFeId) {
    const fe = financialEventsById.get(ownerFeId);
    if (fe) await syncAddonsColumn(fe);
  }
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
}

// ────────────────────────────────────────────────────────────────
// Summary → event-list drill-down
// ────────────────────────────────────────────────────────────────

function scrollEventsIntoView() {
  const list = document.querySelector('.event-pnl');
  if (!list) return;
  list.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Briefly highlight events in the left rail whose linked expenses
// contain the given category. Useful for "who's eating the catering
// budget this month?".
function highlightEventsWithCategory(catId) {
  const matchingEnquiryIds = new Set();
  filteredEvents().forEach(e => {
    const fe = financialEventByEnquiryId.get(e.id);
    if (!fe) return;
    const rows = expensesByEvent.get(fe.id) || [];
    if (rows.some(x => (x.category || 'other') === catId)) {
      matchingEnquiryIds.add(e.id);
    }
  });
  document.querySelectorAll('[data-enquiry]').forEach(btn => {
    if (matchingEnquiryIds.has(btn.getAttribute('data-enquiry'))) {
      btn.classList.add('is-highlight');
    }
  });
  // Auto-fade the highlight so it's clearly transient.
  setTimeout(() => {
    document.querySelectorAll('[data-enquiry].is-highlight')
      .forEach(b => b.classList.remove('is-highlight'));
  }, 2600);
}

// ────────────────────────────────────────────────────────────────
// Event handlers
// ────────────────────────────────────────────────────────────────

document.addEventListener('click', evt => {
  const ev = evt.target.closest('[data-enquiry]');
  if (ev) { selectEnquiry(ev.getAttribute('data-enquiry')); return; }
  const manual = evt.target.closest('[data-manual-fe]');
  if (manual) { selectManual(manual.getAttribute('data-manual-fe')); return; }
  if (evt.target.closest('#btn-add-manual-event')) { addManualEvent(); return; }
  if (evt.target.closest('#btn-add-event-expense')) { addEventExpense(); return; }
  if (evt.target.closest('#btn-add-income-service')) { addIncomeService(); return; }
  if (evt.target.closest('#btn-add-drink'))          { addCatalogDrink(); return; }
  if (evt.target.closest('#btn-add-drink-manual'))   { addManualDrink(); return; }
  if (evt.target.closest('#btn-save-pnl'))          { saveDraft(); return; }
  if (evt.target.closest('#btn-cancel-pnl'))        { cancelDraft(); return; }
  if (evt.target.closest('#btn-delete-pnl'))        { deletePnl(); return; }

  // Click anywhere on the summary block to jump to the event list. Lets
  // the bookkeeper drill down from "Печалба €X" → "which events made
  // that?" without scrolling manually. Expense category pills also
  // highlight events that contain that category.
  const pill = evt.target.closest('#expense-cat-breakdown .pill');
  const kpi  = evt.target.closest('#month-summary .kpi');
  const sumHead = evt.target.closest('#month-summary .fin-section__head');
  if (pill) {
    highlightEventsWithCategory(pill.getAttribute('data-cat'));
    scrollEventsIntoView();
    return;
  }
  if (kpi || sumHead) {
    scrollEventsIntoView();
    return;
  }

  if (evt.target.closest('#btn-month-all')) {
    monthFilter = '';
    const inp = document.getElementById('fin-month');
    if (inp) inp.value = '';
    renderEventsList(document.getElementById('events-search').value);
    renderMonthSummary();
    return;
  }
  const delInc = evt.target.closest('[data-del-income]');
  if (delInc) { deleteIncomeItem(delInc.getAttribute('data-del-income')); return; }
  const delDrink = evt.target.closest('[data-del-drink]');
  if (delDrink) { deleteDrink(Number(delDrink.getAttribute('data-del-drink'))); return; }
  const del = evt.target.closest('[data-del]');
  if (del) { deleteExpense(del.getAttribute('data-del')); return; }

  // Expand/collapse the addon/drinks detail list inside the income side.
  const expandRow = evt.target.closest('[data-expand]');
  if (expandRow && !evt.target.closest('input,select,textarea,button')) {
    const field = expandRow.getAttribute('data-expand');
    const ul = document.getElementById('sub-' + field);
    if (ul) {
      ul.hidden = !ul.hidden;
      expandRow.classList.toggle('is-open', !ul.hidden);
    }
    return;
  }
});

// Use 'input' so the user sees the totals update live as they type, but
// nothing is persisted until Save.
document.addEventListener('input', evt => {
  if (evt.target.id === 'events-search') { renderEventsList(evt.target.value); return; }

  // Drink line field draft (qty / manual name / manual price). The catalog
  // <select> also carries data-drink-f but is handled in 'change'.
  const drinkInp = evt.target.closest('[data-drink-f]');
  if (drinkInp) {
    const li = drinkInp.closest('[data-drink-index]');
    if (li) {
      const idx = Number(li.dataset.drinkIndex);
      const f = drinkInp.dataset.drinkF;
      if (f === 'qty') setDrinkQty(idx, drinkInp.value);
      else if (f === 'name' || f === 'unit_price_eur') setManualDrinkField(idx, f, drinkInp.value);
      return;
    }
  }
  // Income service field draft
  const incInp = evt.target.closest('[data-fi]');
  if (incInp) {
    const li = incInp.closest('[data-income-id]');
    if (li) { setIncomeItemDirty(li.dataset.incomeId, incInp.dataset.fi, incInp.value); return; }
  }
  // Expense field draft
  const expInp = evt.target.closest('[data-f]');
  if (expInp) {
    const li = expInp.closest('[data-id]');
    if (li) { setExpenseDirty(li.dataset.id, expInp.dataset.f, expInp.value); return; }
  }
  // Financial-event field draft
  const feInp = evt.target.closest('[data-fe-field]');
  if (feInp) { setFeDirty(feInp.dataset.feField, feInp.value); return; }
});

document.addEventListener('change', evt => {
  // Drink catalog picker — swap the drink (and its live price) on the line.
  const drinkSel = evt.target.closest('[data-drink-f="select"]');
  if (drinkSel) {
    const li = drinkSel.closest('[data-drink-index]');
    if (li) { setDrinkSelect(Number(li.dataset.drinkIndex), drinkSel.value); return; }
  }
  if (evt.target.id === 'fin-month') {
    monthFilter = evt.target.value || '';
    renderEventsList(document.getElementById('events-search').value);
    renderMonthSummary();
  }
});

// ────────────────────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;
  userEmail = session.user?.email || null;

  await loadAll();
  const now = new Date();
  monthFilter = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthInp = document.getElementById('fin-month');
  if (monthInp) monthInp.value = monthFilter;

  renderEventsList('');
  renderMonthSummary();
  renderDetail();
});

function rerenderPage() {
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
}
