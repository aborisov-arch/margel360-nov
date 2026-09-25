// Financials - per-event P&L.
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
// All amounts in EUR (the admin panel is EUR-only; the public site keeps
// the dual EUR/BGN display required for customers).

// Same EVENT_BASE + guest fee constants used by reservation.js etc.
const EVENT_BASE = { evening: 1350, wedding: 1500, corp4: 330, corp8: 440, bday_day: 700, bday_eve: 970 };
const VENUE_MIN_GUESTS = 40;
const EXTRA_GUEST_FEE_EUR = 15;

// Stamped effective venue price (seasonal calendar) with legacy fallback.
function venueBaseOf(e) {
  return e && e.venue_price_eur != null ? Number(e.venue_price_eur) : (EVENT_BASE[e?.event_id] || 0);
}

// Legacy addon prices (pre-2026-05-04 the reservation form stored addon
// prices in BGN). If a stored price exactly matches its old BGN value we
// convert to EUR — same rule as offer-export.js / offer-pdf.js, so the
// read-only offer view matches the customer's real quote. Prefixed to avoid
// colliding with offer-export.js's addonPriceEur (not loaded on this page).
const OFFER_ADDON_BGN_PRICES = {
  dj: 587, photo2: 340, photo4: 580, booth2: 390, booth4: 560,
  arch: 760, wall_s: 355, wall_g: 355, flare_s: 440, flare_l: 790,
  fountain_s: 96, fountain_l: 160, led: 290, mic: 97, proj: 180,
  security: 196, hygiene: 156, wardrobe: 176, valet: 275,
  carpet_l: 148, candles_h: 100, numbers: 68,
};
function offerAddonPriceEur(id, price) {
  const old = OFFER_ADDON_BGN_PRICES[id];
  return old != null && price === old ? price / 1.95583 : price;
}
// Offer payment terms — kept in sync with offer-pdf.js (PDF_DEPOSIT_RATE /
// PDF_OFFER_VALID_DAYS) and the offer XLSX template per the CLAUDE.md sync map.
const OFFER_DEPOSIT_RATE = 0.5;
const OFFER_VALID_DAYS = 2;

// Drinks catalog is now DB-backed (public.drinks table). Used to
// price P&L drink lines by id so website price changes flow straight through.
// Populated from the DB catalog during page init (see the DOMContentLoaded
// handler below) - empty until window.loadCatalog() resolves.
let drinkCatalogById = new Map();

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

// Expense categories - the 7 income buckets plus running-cost essentials.
// Kept in sync with the CHECK constraint on financial_expenses.category.
const EXPENSE_CATS = [
  { id: 'ivan_fee', label: 'Иван хонорар' },
  { id: 'ivan_overtime', label: 'Иван овъртайм' },
  { id: 'eli_fee', label: 'Ели хонорар' },
  { id: 'eli_overtime', label: 'Ели овъртайм' },
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

// Income category labels - shared by the summary pills and the category
// drill-down modal.
const INCOME_LABELS = [
  { id: 'rent',   label: 'Оферта' },
  { id: 'drinks', label: 'Напитки' },
  { id: 'addons', label: 'Доп. услуги' },
  { id: 'dj',     label: 'DJ' },
  { id: 'employees', label: 'Почистване' },
  { id: 'overtime', label: 'Извънреден час' },
];

// Partner categories - the vocabulary of public.partners.category (CHECK in
// 20260914120000_partner_categories_and_commissions.sql) in the display
// order of the commission groups. Labels are BG like the rest of this page.
const PARTNER_CATS = [
  { id: 'catering',   label: 'Кетъринг',       icon: '🍽️' },
  { id: 'decoration', label: 'Декорация',      icon: '🎈' },
  { id: 'singer',     label: 'Певци',          icon: '🎤' },
  { id: 'band',       label: 'Групи',          icon: '🎸' },
  { id: 'dj',         label: 'DJ',             icon: '🎧' },
  { id: 'artist',     label: 'Артисти (общо)', icon: '🎭' },
];
// The venue's cut from a partner unless a per-partner rate is set
// (partner_commission_rates) or the bookkeeper overrides it on the entry.
const DEFAULT_COMMISSION_PCT = 10;

const fmtEur = n => '€' + (Number(n) || 0).toFixed(2);
let revenueWithoutVat = false;
const revenueForDisplay = n => (Number(n) || 0) / (revenueWithoutVat ? 1.2 : 1);
const fmtRevenue = n => fmtEur(revenueForDisplay(n));
document.addEventListener('click', event => {
  if (!event.target.closest('#fin-vat-toggle')) return;
  revenueWithoutVat = !revenueWithoutVat;
  const button = document.getElementById('fin-vat-toggle');
  button.setAttribute('aria-pressed', String(revenueWithoutVat));
  button.textContent = revenueWithoutVat ? 'Приходи: без ДДС' : 'Приходи: с ДДС';
  document.getElementById('fin-vat-note').textContent =
    (revenueWithoutVat ? 'Приходите са без ДДС 20% (сума ÷ 1,20).' : 'Приходите включват ДДС 20%.') +
    ' Плащанията, разходите и печалбата са по записаните суми.';
  renderMonthSummary();
});
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDateBg(iso) {
  if (!iso) return '-';
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
  const base = venueBaseOf(e);
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

// Partner commissions - the live partner list (public.partners, hidden rows
// included so a retired partner's history stays visible), per-partner default
// rates and the entries themselves. Loaded in loadAll, drawn by
// renderPartnerCommissions. Entries autosave on change - no draft state.
let partnersAll = [];
let commissionRateByPartner = new Map();
let commissions = [];

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
// hand-entered rows (no enquiry link - back-fills, walk-ins, cash bookings)
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
// Saved-state accessors - used by the summary + left rail. They
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
  return rows.reduce((s, x) => s + Number(x.amount_eur || 0), 0) + eventBottleCost(fe).auto;
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
    { data: prt, error: prtErr },
    { data: rates, error: ratesErr },
    { data: comm, error: commErr },
  ] = await Promise.all([
    db.from('enquiries').select('id,enquiry_number,full_name,preferred_date,event_type,event_id,pipeline_status,addons,drinks,applied_discount_percent,guests,payment_method,payment_tracking,venue_price_eur,last_edited_at'),
    db.from('occupied_dates').select('date'),
    db.from('financial_events').select('*'),
    db.from('financial_expenses').select('*').not('event_id', 'is', null),
    db.from('financial_income_items').select('*').not('event_id', 'is', null),
    // Partner commissions: the live partner list (hidden rows too, so past
    // commissions of a retired partner stay reachable), per-partner default
    // rates and the entries. RLS: partners via is_admin(), the other two
    // finance-only (is_finance_admin()).
    db.from('partners').select('id,name,category,active,sort_order,contact_name,phone'),
    db.from('partner_commission_rates').select('partner_id,percent'),
    db.from('partner_commissions').select('*'),
  ]);
  if (enqErr) console.error(enqErr);
  if (occErr) console.error(occErr);
  if (fevErr) console.error(fevErr);
  if (expErr) console.error(expErr);
  if (incErr) console.error(incErr);
  if (prtErr) console.error(prtErr);
  if (ratesErr) console.error(ratesErr);
  if (commErr) console.error(commErr);

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

  partnersAll = prt || [];
  commissionRateByPartner = new Map((rates || []).map(r => [r.partner_id, Number(r.percent)]));
  commissions = comm || [];

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

// Pure: computes the enquiry-derived seed values for a financial_events row
// (column values) plus the one income item to create if the enquiry has
// add-ons. Never writes to the DB — safe to call speculatively. Shared by
// ensureFinancialEvent (first-open create) and the enquiry-refresh action
// (Task 2) so both paths compute byte-identical numbers from the same
// enquiry snapshot.
function seedFromEnquiry(enq) {
  const b = enquiryBreakdown(enq);
  const iso = parsePreferredDate(enq.preferred_date);
  const month = iso ? iso.slice(0, 7) : null;
  // Paid-by-customer prefill: the Bank/Cash/Card amounts marked on the enquiry
  // (Enquiries section). They go into the deposit buckets - the enquiry has no
  // deposit/balance split, and the bookkeeper can reclassify before saving.
  const pt = enq.payment_tracking || {};
  const ptAmt = (k) => { const n = parseFloat(pt[k]); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
  const fields = {
    month,
    event_date: iso,
    customer_name: enq.full_name || '',
    offer_total_eur: b.rent + b.drinks + b.addons,
    income_rent_eur:   b.rent,
    income_drinks_eur: b.drinks,
    income_addons_eur: b.addons,
    deposit_cash_eur: ptAmt('cash'),
    deposit_bank_eur: ptAmt('bank'),
    deposit_card_eur: ptAmt('card'),
  };
  // Seed one "Други" service line from the enquiry's add-on total so the
  // prefilled add-on income is visible (income now derives from items).
  // The bookkeeper can then split/recategorize it. null when there's
  // nothing to seed (addons total is 0).
  const incomeItem = b.addons > 0
    ? { month, category: 'other', amount_eur: b.addons, notes: 'Пренесено от офертата' }
    : null;
  return { fields, incomeItem };
}

// Find or create the financial_events row for an enquiry. First-time
// creation prefills the income breakdown from the enquiry so the admin
// starts with sane numbers instead of zero.
async function ensureFinancialEvent(enquiry) {
  let row = financialEventByEnquiryId.get(enquiry.id);
  if (row) return row;
  const { fields, incomeItem } = seedFromEnquiry(enquiry);
  const now = new Date().toISOString();
  const insertRow = {
    ...fields,
    enquiry_id: enquiry.id,
    confirmed_by: userEmail,
    confirmed_at: now,
    enquiry_synced_at: now,
  };
  const { data, error } = await db.from('financial_events').insert(insertRow).select().single();
  if (error) { console.error('ensureFinancialEvent insert failed', error); return null; }
  financialEventsById.set(data.id, data);
  financialEventByEnquiryId.set(enquiry.id, data);

  if (incomeItem) {
    const { data: item, error: itemErr } = await db.from('financial_income_items').insert({
      event_id: data.id, ...incomeItem,
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
  // Iterate EVERY financial_event in the month filter - enquiry-linked
  // AND manual. This is the right scope because the summary should
  // reflect "money I actually saw this month", regardless of whether
  // each event came from the public form or a hand entry.
  const scopeFes = [];
  for (const fe of financialEventsById.values()) {
    if (!monthFilter || fe.month === monthFilter) scopeFes.push(fe);
  }
  // Revenue recognition: an event's income only lands in the realized
  // income/profit KPIs the day AFTER the event happens (Sofia date).
  // Events that haven't passed yet are summed into a separate "upcoming
  // (projected)" figure instead, so the headline numbers reflect money
  // from events that have actually taken place. Per-event P&L stays fully
  // editable beforehand (semi-automatic). Expenses are gated the same way,
  // so profit is a true realized P&L (income − expense, both past-only).
  // Only "paid" (cash actually received) is NOT date-gated.
  const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' });
  const hasHappened = fe => !fe.event_date || fe.event_date < todayISO;

  let rent = 0, drinks = 0, addons = 0, overtime = 0, dj = 0, employees = 0, paid = 0, expense = 0;
  let upcomingIncome = 0, upcomingCount = 0;
  const expByCat = Object.fromEntries(EXPENSE_CATS.map(c => [c.id, 0]));

  scopeFes.forEach(fe => {
    const inc = feIncome(fe);
    if (hasHappened(fe)) {
      rent   += inc.rent;
      drinks += inc.drinks;
      addons += inc.addons;
      overtime += inc.overtime;
      dj += inc.dj;
      employees += inc.employees;
      const bottleCost=eventBottleCost(fe);
      expense+=bottleCost.auto;
      expByCat.drinks+=bottleCost.auto;
      // Expenses count only once the event has happened too, so profit is
      // a realized figure (realized income − realized expense).
      const rows = expensesByEvent.get(fe.id) || [];
      rows.forEach(x => {
        const amt = Number(x.amount_eur || 0);
        expense += amt;
        expByCat[x.category || 'other'] = (expByCat[x.category || 'other'] || 0) + amt;
      });
    } else {
      upcomingIncome += inc.total;
      upcomingCount += 1;
    }
    paid   += fePaid(fe);
  });

  expense += electricityTotal();
  expByCat.utilities += electricityTotal();
  expense += managerPayTotal();
  expByCat.staff_service += managerPayTotal();
  renderElectricity();
  const income = rent + drinks + addons + overtime + dj + employees;
  const profit = income - expense;
  const realizedCount = scopeFes.length - upcomingCount;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('sum-month-label', monthLabel(monthFilter));
  set('sum-count',       `${realizedCount} ${realizedCount === 1 ? 'проведено' : 'проведени'}${upcomingCount ? ` · ${upcomingCount} предстоящи` : ''}`);
  set('sum-income-eur',  fmtRevenue(income));
  set('sum-upcoming-eur', fmtRevenue(upcomingIncome));
  set('sum-paid-eur',    fmtEur(paid));
  set('sum-expense-eur', fmtEur(expense));
  set('sum-profit-eur',  fmtEur(profit));
  const profitEl = document.getElementById('sum-profit-eur');
  if (profitEl) profitEl.className = 'kpi__value ' + (profit >= 0 ? 'is-positive' : 'is-negative');

  // Partner commissions KPI - a separate figure, NOT folded into income or
  // profit: those two are the event P&L the bookkeeper reconciles; the
  // commissions come in from partners on their own schedule. Same month scope.
  const comm = commissionTotals(commissionsInScope());
  set('sum-commission-eur', fmtEur(comm.total));
  set('sum-commission-sub', comm.count
    ? `${comm.count} ${comm.count === 1 ? 'запис' : 'записа'} · получени ${fmtEur(comm.received)}`
    : 'няма записи');

  const incomeCats = { rent, drinks, addons, overtime, dj, employees };
  renderFinanceCharts(incomeCats, expByCat);
  if(electricityError || managerPayError || incompleteBottleCostsInMonth()){
    set('sum-expense-eur','Непълни данни');set('sum-profit-eur','Непълни данни');
    const total = document.querySelector('[data-chart-total="expense"]');
    total.textContent='Непълни данни';total.classList.add('is-incomplete');
    total.closest('.finance-pie').querySelector('svg').setAttribute('aria-label','Разходи: непълни данни.');
  }
  renderManagerPay();
  renderStaffAllocations(expByCat);
  const incomeBreak = document.getElementById('income-cat-breakdown');
  if (incomeBreak) {
    incomeBreak.innerHTML = INCOME_LABELS.filter(c => incomeCats[c.id] > 0).map(c => `
      <div class="pill" data-cat="${esc(c.id)}" role="button" tabindex="0" style="cursor:pointer" title="Пълна разбивка по събития">
        <div class="pill__label">${esc(c.label)}</div>
        <div class="pill__value">${fmtRevenue(incomeCats[c.id])}</div>
        <div class="pill__sub">${income ? `<span class="pill__pct">${Math.round(incomeCats[c.id] / income * 100)}%</span>` : ''}</div>
      </div>
    `).join('');
  }
  const expenseBreak = document.getElementById('expense-cat-breakdown');
  if (expenseBreak) {
    const html = EXPENSE_CATS.filter(c => expByCat[c.id] > 0).map(c => `
      <div class="pill" data-cat="${esc(c.id)}" role="button" tabindex="0" style="cursor:pointer" title="Пълна разбивка по разходи">
        <div class="pill__label">${esc(c.label)}</div>
        <div class="pill__value">${fmtEur(expByCat[c.id])}</div>
        <div class="pill__sub">${expense ? `<span class="pill__pct">${Math.round(expByCat[c.id] / expense * 100)}%</span>` : ''}</div>
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

  // Section 1 - enquiry-linked events (from public form).
  const monthScopedEnq = filteredEvents();
  const enqMatches = needle
    ? monthScopedEnq.filter(e => (e.full_name || '').toLowerCase().includes(needle))
    : monthScopedEnq;

  // Section 2 - manual events (bookkeeper-entered, no enquiry).
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
    const margin = (inc != null && inc > 0 && !eventBottleCost(fe).missing) ? Math.round((net / inc) * 100) : null;
    const selected = e.id === selectedEnquiryId ? ' is-selected' : '';
    const marginClass = margin == null ? '' : (margin >= 0 ? ' is-positive' : ' is-negative');
    const iso = parsePreferredDate(e.preferred_date);
    return `
      <button type="button" class="event-pnl__event${selected}" data-enquiry="${esc(e.id)}">
        <div class="event-pnl__event-name"><span class="enquiry-no">#${esc(e.enquiry_number ?? '-')}</span> ${esc(e.full_name || '-')}</div>
        <div class="event-pnl__event-meta">${fmtDateBg(iso)} · ${inc != null ? fmtEur(inc) : '-'}</div>
        <div class="event-pnl__event-margin${marginClass}">${margin == null ? '-' : margin + '%'}</div>
      </button>
    `;
  };

  const renderManual = fe => {
    const inc = feIncome(fe).total;
    const exp = feExpenseTotal(fe);
    const net = inc - exp;
    const margin = inc > 0 && !eventBottleCost(fe).missing ? Math.round((net / inc) * 100) : null;
    const selected = fe.id === selectedManualFeId ? ' is-selected' : '';
    const marginClass = margin == null ? '' : (margin >= 0 ? ' is-positive' : ' is-negative');
    return `
      <button type="button" class="event-pnl__event${selected}" data-manual-fe="${esc(fe.id)}">
        <div class="event-pnl__event-name"><span class="enquiry-no enquiry-no--manual">M</span> ${esc(fe.customer_name || '-')}</div>
        <div class="event-pnl__event-meta">${fmtDateBg(fe.event_date)} · ${fmtEur(inc)}</div>
        <div class="event-pnl__event-margin${marginClass}">${margin == null ? '-' : margin + '%'}</div>
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
  // Manual events section - always show the header so the "+ Add manual"
  // button has a home, even when the list is empty.
  html += sectionLabel('Ръчни събития', manualMatches.length);
  if (manualMatches.length) {
    html += manualMatches.map(renderManual).join('');
  } else {
    html += '<div class="event-pnl__empty-tip">Натиснете „+ Добави ръчно събитие" за да внесете събитие, което не е минало през формата.</div>';
  }
  html += `<button type="button" class="event-pnl__add-manual" id="btn-add-manual-event">+ Добави ръчно събитие</button>`;

  if (!enqMatches.length && !manualMatches.length) {
    // No enquiries OR manual - still want the add button visible above.
    // Already added; nothing else to do.
  }

  wrap.innerHTML = html;
}

// ────────────────────────────────────────────────────────────────
// Right detail - P&L
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
  return rows.reduce((s, r) => s + Number(expFieldValue(r, 'amount_eur') || 0), 0) + eventBottleCost(fe,true).auto;
}

// ────────────────────────────────────────────────────────────────
// P&L drinks - editable, live-priced list. The P&L keeps its own adjusted
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
  // Keep the sale price actually used for this event, not today's catalog price.
  if(line.unit_price_eur!=null)return Number(line.unit_price_eur)||0;
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
  arr.forEach(l=>{if(l.unit_price_eur==null)l.unit_price_eur=drinkUnitPrice(l);});
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
  arr[index].unit_cost_eur = drinkPurchasePrices.get(drinkId) ?? null;
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
    ? { id: first.id, name: first.name_bg, qty: 1, unit_price_eur: Number(first.price_eur), unit_cost_eur:drinkPurchasePrices.get(first.id)??null, manual: false }
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
      `<option value="${esc(d.id)}"${d.id === selId ? ' selected' : ''}>${esc(d.name_bg)} - ${fmtEur(d.price_eur)}</option>`
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
    const costInput=`<label class="pay-note">Покупна цена · €/бутилка <input type="number" min="0" step="0.01" data-bottle-cost="${i}" value="${esc(l.unit_cost_eur??'')}" placeholder="Не е зададена" aria-label="Покупна цена за бутилка"></label>`;
    // Keep the <select>, the priced unit, and the stored id in agreement even
    // for a drink that has since left the catalog - otherwise the browser
    // silently auto-selects the first option while pricing the stored fallback.
    const inCatalog = !l.manual && l.id && drinkCatalogById.has(l.id);
    const selectOptions = inCatalog
      ? drinkCatalogOptions(l.id)
      : `<option value="${esc(l.id || '')}" selected>${esc(l.name || '-')} - ${fmtEur(drinkUnitPrice(l))} (извън каталога)</option>` + drinkCatalogOptions(null);
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
          ${costInput}
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
        ${costInput}
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

  // Hero - enquiry path shows "#1001 Name + event type + guests".
  // Manual path shows "M Name + raw date" and an explicit "Ръчно" badge.
  if (kind === 'enquiry' && enquiry) {
    document.getElementById('pnl-customer').innerHTML =
      `<span class="enquiry-no">#${esc(enquiry.enquiry_number ?? '-')}</span> ${esc(enquiry.full_name || '-')}`;
    document.getElementById('pnl-date').textContent     = fmtDateBg(parsePreferredDate(enquiry.preferred_date));
    document.getElementById('pnl-event-type').textContent = enquiry.event_type || '-';
    document.getElementById('pnl-guests').textContent   = (enquiry.guests != null ? enquiry.guests + ' гости' : '-');
  } else {
    // Manual event - name + date are stored on the fe row itself.
    document.getElementById('pnl-customer').innerHTML =
      `<span class="enquiry-no enquiry-no--manual">M</span> ${esc(fe.customer_name || '-')}`;
    document.getElementById('pnl-date').textContent     = fmtDateBg(fe.event_date);
    document.getElementById('pnl-event-type').textContent = fe.event_type || 'Ръчно събитие';
    document.getElementById('pnl-guests').textContent   = '-';
  }

  // Drift banner - the enquiry was edited (customer or admin) after this
  // P&L's numbers were last synced from it. Only applies to enquiry-linked
  // rows; manual events have no `enquiry` to drift from. NULL
  // enquiry_synced_at (legacy rows, pre-dating this column) falls back to
  // created_at so an old never-synced row is still comparable.
  const driftBanner = document.getElementById('pnl-drift-banner');
  if (driftBanner) {
    const isDrifted = !!(fe && enquiry && enquiry.last_edited_at &&
      new Date(enquiry.last_edited_at) > new Date(fe.enquiry_synced_at ?? fe.created_at));
    if (isDrifted) {
      driftBanner.hidden = false;
      driftBanner.innerHTML = `
        <span class="fin-drift-banner__text">${esc(t('fin_drift_warn'))}</span>
        <button type="button" class="btn btn-outline btn-sm" id="btn-drift-refresh">${esc(t('fin_drift_refresh'))}</button>
      `;
    } else {
      driftBanner.hidden = true;
      driftBanner.innerHTML = '';
    }
  }

  // Fixed income lines - editable. Prefilled by ensureFinancialEvent from
  // the enquiry breakdown; admin can refine before saving. Drinks are an
  // itemized list below (#pnl-drinks-lines); additional services are itemized
  // in #pnl-income-lines-services.
  const linesHtml = [
    { lbl: 'Оферта (зала + гости)', field: 'income_rent_eur',   detail: null, discountable: true },
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
          const name = it.name || it.id || '-';
          const qty = it.qty;
          const unit = it.price_eur != null ? Number(it.price_eur) : null;
          const linePrice = it.price != null ? Number(it.price)
                          : (unit != null && qty != null ? unit * qty : null);
          const qtyLabel = qty != null ? ` × ${qty}` : '';
          const priceLabel = linePrice != null ? fmtEur(linePrice) : '-';
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
    // Оферта: enquiry-linked rows get an inline hall-rent discount (%). The
    // percent is stored on the ENQUIRY (applied_discount_percent - the same
    // field promo codes and the dashboard control write), so offers, emails
    // and the dashboard stay in sync; only the venue base is reduced and
    // enquiryBreakdown re-derives the € amount. Manual rows (no linked
    // enquiry / unknown event type) fall through to the plain € input.
    if (r.discountable) {
      const enq = fe && fe.enquiry_id ? allEnquiries.find(e => e.id === fe.enquiry_id) : null;
      if (enq && venueBaseOf(enq) > 0) {
        const pct = Number(enq.applied_discount_percent || 0);
        return `
        <li class="event-pnl__line event-pnl__line--editable event-pnl__line--discount">
          <span class="event-pnl__line-lbl">${esc(r.lbl)}</span>
          <span class="event-pnl__ot-calc">
            <input type="number" step="1" min="0" max="100" id="pnl-discount-pct" class="event-pnl__line-input event-pnl__line-hours"
                   value="${pct > 0 ? pct : ''}" placeholder="0" aria-label="Отстъпка от наема (%)" title="Отстъпка от наема (%)">
            <span class="event-pnl__ot-op" aria-hidden="true">% =</span>
            <input type="number" step="0.01" class="event-pnl__line-input"
                   data-fe-field="${r.field}" value="${v ?? ''}" placeholder="€">
          </span>
        </li>
      `;
      }
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

  // Drinks - editable, live-priced list (seeded from the booking).
  renderDrinks();

  // Additional services - itemized, categorized income lines. Mirrors the
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
          const name = a.name || a.id || '-';
          const price = a.price != null ? fmtEur(Number(a.price)) : '-';
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

  // Expense lines - dirty-aware. One horizontal scrolling row per
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
  renderEventOvertime(fe);
}

// Refresh only the DERIVED figures (hero totals + Save button) for the
// open event. Reads dirty-aware values, touches no <input>, so it is
// safe to call on every keystroke - this is what stops the focus loss.
function updateDetailTotals() {
  const sel = currentSelection();
  if (!sel) return;
  const fe = sel.fe;

  const inc = liveIncomeTotals(fe);
  const expense = liveExpenseTotal(fe);
  const paid = livePaid(fe);
  const balance = inc.total - paid;
  const net = inc.total - expense;
  const costMissing=eventBottleCost(fe,true).missing;
  const margin = inc.total > 0 && !costMissing ? Math.round((net / inc.total) * 100) : null;

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('pnl-income-total',  fmtEur(inc.total));
  set('pnl-drinks-total',  fmtEur(drinksTotalOf(getWorkingDrinks())));
  set('pnl-services-total', fmtEur(liveAddonsTotal(fe)));
  set('pnl-expense-total', fmtEur(expense));
  set('pnl-paid-total',    fmtEur(paid));
  set('pnl-balance',       fmtEur(balance));
  set('pnl-net-eur',       fmtEur(net));
  if(costMissing){set('pnl-expense-total','Непълни данни');set('pnl-net-eur','Непълни данни');}
  renderBottleCostSummary(fe);
  const staffHost=document.getElementById('event-staff-taken');
  if(staffHost){const staff=(prefix)=>(expensesByEvent.get(fe?.id)||[]).filter(r=>[prefix+'_fee',prefix+'_overtime'].includes(expFieldValue(r,'category'))).reduce((s,r)=>s+Number(expFieldValue(r,'amount_eur')||0),0);staffHost.textContent=`Получено за вечерта — Иван: ${fmtEur(staff('ivan'))} · Ели: ${fmtEur(staff('eli'))}. Сумите са включени в разходите по-долу.`;}
  const marginEl = document.getElementById('pnl-margin');
  if (marginEl) {
    marginEl.textContent = margin == null ? '-' : margin + '%';
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
// Оферта discount (%) on an enquiry-linked P&L row. Persists the percent to
// the enquiry immediately (applied_discount_percent - shared with promo codes
// and the dashboard control), then recomputes the Оферта € via
// enquiryBreakdown and drops it into the dirty draft; the page's normal
// Запази flow persists the row like any other edit.
async function applyRentDiscount(inp) {
  const sel = currentSelection();
  const fe = sel?.fe;
  const enq = fe?.enquiry_id ? allEnquiries.find(e => e.id === fe.enquiry_id) : null;
  if (!enq) return;
  const raw = String(inp.value).trim();
  const num = raw === '' ? 0 : Number(raw);
  if (!Number.isInteger(num) || num < 0 || num > 100) {
    showToast('Въведете цяло число 0-100.', 'error');
    const prev = Number(enq.applied_discount_percent || 0);
    inp.value = prev > 0 ? prev : '';
    return;
  }
  const value = num > 0 ? num : null;
  const { error } = await db.from('enquiries')
    .update({ applied_discount_percent: value })
    .eq('id', enq.id);
  if (error) {
    console.error('Discount save failed:', error);
    showToast('Отстъпката не се записа.', 'error');
    return;
  }
  enq.applied_discount_percent = value;
  const rent = enquiryBreakdown(enq).rent;
  dirtyFe.income_rent_eur = rent;
  const rentInput = document.querySelector('.event-pnl__line-input[data-fe-field="income_rent_eur"]');
  if (rentInput) rentInput.value = rent;
  updateDetailTotals();
  showToast(value ? `Отстъпка ${value}% върху офертата.` : 'Отстъпката е премахната.', 'success');
}

// The system-seeded add-on income line is identified by this fixed notes
// marker - both ensureFinancialEvent and seedFromEnquiry always create it
// with exactly this text. Matching on notes ALONE (not category+notes) so
// a bookkeeper who recategorizes the seeded row (e.g. away from "other")
// is still recognized and updated in place by refreshFromEnquiry - matching
// on both fields would make a recategorized copy invisible to the matcher,
// causing a duplicate full-total row to be inserted alongside it (addons
// income double-counted). It is the only reliable seeded-vs-manual signal
// financial_income_items carries (there is no dedicated flag column, unlike
// pnl_drinks' per-line `manual` bool) - a bookkeeper item that happens to
// share this exact notes text would be indistinguishable and get replaced
// too. See task-2-report.md.
const SEEDED_INCOME_ITEM_NOTES = 'Пренесено от офертата';
function isSeededIncomeItem(item) {
  return item.notes === SEEDED_INCOME_ITEM_NOTES;
}

// „Опресни от заявката" - re-pulls the enquiry-derived numbers into an
// EXISTING financial_events row (the drift banner's action). Unlike
// ensureFinancialEvent (first-open create), this must preserve everything
// the bookkeeper independently owns: payments, expenses, notes,
// manually-typed drink lines and bookkeeper-added income items - see the
// Global Constraints in the task brief and the confirm-dialog copy itself
// (fin_drift_confirm), which promises exactly this. deposit_*_eur (money
// marked received) is therefore deliberately EXCLUDED from the patch even
// though seedFromEnquiry's `fields` includes it - that field only makes
// sense as a one-time prefill at creation, not on a refresh of a row the
// bookkeeper has been reconciling payments against.
async function refreshFromEnquiry() {
  const sel = currentSelection();
  if (!sel || sel.kind !== 'enquiry' || !sel.fe || !sel.enquiry) return;
  const fe = sel.fe;
  const enqId = sel.enquiry.id;

  if (isDirty()) {
    if (!confirm('Имате незапазени промени. Да ги отхвърля ли?')) return;
    // User confirmed the discard - actually discard, or a stale staged
    // value (e.g. a not-yet-saved deposit/rent edit) survives the refresh
    // and gets written over the freshly synced row on the next save.
    dirtyFe = {};
    dirtyExpenses = new Map();
    dirtyIncomeItems = new Map();
  }

  if (!confirm(t('fin_drift_confirm'))) return;

  const btn = document.getElementById('btn-drift-refresh');
  if (btn) btn.disabled = true;

  try {
    // Re-fetch the enquiry fresh rather than trust the page's load-time
    // cache - the whole point of this action is that it may have changed
    // since this admin session loaded.
    const { data: liveEnquiry, error: enqErr } = await db.from('enquiries')
      // venue_price_eur: seasonal stamp - keep in every enquiry select feeding enquiryBreakdown
      .select('id,enquiry_number,full_name,preferred_date,event_type,event_id,pipeline_status,addons,drinks,applied_discount_percent,guests,payment_method,payment_tracking,last_edited_at,venue_price_eur')
      .eq('id', enqId).single();
    if (enqErr) throw enqErr;
    if (!liveEnquiry) throw new Error('enquiry not found');

    const { fields, incomeItem } = seedFromEnquiry(liveEnquiry);

    // Drinks: if pnl_drinks is still null the row is untouched/live-tracking
    // already (savedDrinksTotal reads straight from enquiry.drinks in that
    // case) - nothing to write. Once frozen (non-null), re-derive the
    // catalog-linked lines from the live order and keep every manual:true
    // line byte-for-byte. LIMITATION: a catalog drink the bookkeeper picked
    // by hand inside the P&L (+ Добави напитка) is also stored as
    // manual:false with no back-reference to the enquiry, so it is
    // indistinguishable from an enquiry-seeded line and gets replaced too -
    // see task-2-report.md.
    let drinksPatch = {};
    if (fe.pnl_drinks != null) {
      const preservedManual = fe.pnl_drinks.filter(l => l && l.manual === true);
      const freshFromOrder = seedDrinksFromOrder(liveEnquiry);
      freshFromOrder.forEach(line=>{const previous=fe.pnl_drinks.find(l=>!l.manual&&l.id===line.id);if(previous?.unit_cost_eur!=null)line.unit_cost_eur=previous.unit_cost_eur;});
      const nextDrinks = [...freshFromOrder, ...preservedManual];
      drinksPatch = { pnl_drinks: nextDrinks, income_drinks_eur: drinksTotalOf(nextDrinks) };
    }

    const patch = {
      month: fields.month,
      event_date: fields.event_date,
      customer_name: fields.customer_name,
      offer_total_eur: fields.offer_total_eur,
      income_rent_eur: fields.income_rent_eur,
      ...drinksPatch,
      updated_at: new Date().toISOString(),
    };
    const { data: updated, error: feErr } = await db.from('financial_events')
      .update(patch).eq('id', fe.id).select().single();
    if (feErr) throw feErr;
    Object.assign(fe, updated);

    // Income items: re-fetch this event's items FRESH from the DB (never
    // the page-load cache) so a retry after an earlier partial failure is
    // self-healing instead of compounding it. The atomic path below never
    // pairs an insert with a delete for the common (0-or-1-seeded-row)
    // case, so there is no window where a duplicate or a gap can exist:
    //  - 0 old seeded rows -> plain insert.
    //  - 1 old seeded row  -> UPDATE it in place (no insert+delete at all).
    //  - 2+ old seeded rows (itself evidence of a prior partial failure) ->
    //    delete the extras FIRST, then update the survivor. Failure order
    //    is delete-before-update, so a failure here can only ever leave
    //    the seeded row missing (the next refresh recreates it) or still
    //    duplicated (the next refresh retries the same cleanup) - never
    //    MORE duplicated than what was already on disk.
    const { data: freshItems, error: itemsFetchErr } = await db
      .from('financial_income_items').select('*').eq('event_id', fe.id);
    if (itemsFetchErr) throw itemsFetchErr;
    const oldSeeded = (freshItems || []).filter(isSeededIncomeItem);
    const kept = (freshItems || []).filter(x => !isSeededIncomeItem(x));

    let survivor = null;
    if (oldSeeded.length > 1) {
      const [keep, ...extras] = oldSeeded;
      const { error: delExtraErr } = await db.from('financial_income_items')
        .delete().in('id', extras.map(x => x.id));
      if (delExtraErr) throw delExtraErr;
      extras.forEach(x => dirtyIncomeItems.delete(x.id));
      survivor = keep;
    } else if (oldSeeded.length === 1) {
      survivor = oldSeeded[0];
    }

    let newSeededItem = null;
    if (incomeItem) {
      if (survivor) {
        const { data, error: updErr } = await db.from('financial_income_items')
          .update({ month: incomeItem.month, category: incomeItem.category, amount_eur: incomeItem.amount_eur, notes: incomeItem.notes })
          .eq('id', survivor.id).select().single();
        if (updErr) throw updErr;
        dirtyIncomeItems.delete(survivor.id);
        newSeededItem = data;
      } else {
        const { data, error: insErr } = await db.from('financial_income_items')
          .insert({ event_id: fe.id, ...incomeItem }).select().single();
        if (insErr) throw insErr;
        newSeededItem = data;
      }
    } else if (survivor) {
      // Live addons total is now 0 (customer removed them) - nothing to
      // seed. Remove the stale seeded row instead of leaving it behind.
      const { error: delErr } = await db.from('financial_income_items')
        .delete().eq('id', survivor.id);
      if (delErr) throw delErr;
      dirtyIncomeItems.delete(survivor.id);
    }
    incomeItemsByEvent.set(fe.id, newSeededItem ? [...kept, newSeededItem] : kept);

    // income_addons_eur is a cached mirror of the item rows (see
    // syncAddonsColumn) - recompute it from the just-updated items rather
    // than writing seedFromEnquiry's addons figure directly, so a
    // bookkeeper-added service line's contribution is never lost.
    await syncAddonsColumn(fe);

    // Stamp LAST: only reached if every write above succeeded, so a
    // failure never leaves a stale enquiry_synced_at pointing past data
    // that didn't actually get refreshed.
    const stampedAt = new Date().toISOString();
    const { error: stampErr } = await db.from('financial_events')
      .update({ enquiry_synced_at: stampedAt }).eq('id', fe.id);
    if (stampErr) throw stampErr;
    fe.enquiry_synced_at = stampedAt;

    // Drop any unsaved draft on the fields this refresh just overwrote in
    // the DB directly, so a stale typed value can't shadow (and later
    // overwrite on Save) what was just synced.
    delete dirtyFe.income_rent_eur;
    delete dirtyFe.pnl_drinks;
    delete dirtyFe.income_drinks_eur;

    // Keep the page's enquiry cache in step so the hero/guest-count/
    // "customer added to the offer" hint reflect the live data too.
    Object.assign(sel.enquiry, liveEnquiry);

    showToast(t('fin_drift_done'), 'success');
    renderEventsList(document.getElementById('events-search').value);
    renderMonthSummary();
    renderDetail();
  } catch (err) {
    console.error('refreshFromEnquiry failed', err);
    showToast(t('fin_drift_failed'), 'error');
  } finally {
    const btnAfter = document.getElementById('btn-drift-refresh');
    if (btnAfter) btnAfter.disabled = false;
  }
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
  // Refresh totals only - never rebuild the line being typed into.
  updateDetailTotals();
}

// ────────────────────────────────────────────────────────────────
// Save / cancel
// ────────────────────────────────────────────────────────────────

let pnlSaving = false;
function removeSavedFields(draft, saved) {
  for(const [key,value] of Object.entries(saved))if(JSON.stringify(draft[key])===JSON.stringify(value))delete draft[key];
}
function removeSavedMapFields(drafts,saved) {
  for(const [id,fields] of saved){const current=drafts.get(id);if(!current)continue;removeSavedFields(current,fields);if(!Object.keys(current).length)drafts.delete(id);}
}
async function saveDraft() {
  if(pnlSaving)return;
  if(dirtyFe.pnl_drinks?.some(l=>!Number.isInteger(Number(l.qty))||Number(l.qty)<0||(l.unit_cost_eur!=null&&(!Number.isFinite(Number(l.unit_cost_eur))||Number(l.unit_cost_eur)<0||Number(l.unit_cost_eur)>=1000000)))){showToast('Проверете бутилките: количеството трябва да е цяло и неотрицателно, а покупната цена — валидна положителна сума или 0.','error');return;}
  const sel = currentSelection();
  if (!sel || !sel.fe) return;
  const fe = sel.fe;
  const savedFe=structuredClone(dirtyFe),savedExpenses=structuredClone(dirtyExpenses),savedIncome=structuredClone(dirtyIncomeItems);
  pnlSaving=true;
  const panel=document.querySelector('.event-pnl');if(panel)panel.inert=true;
  const ops = [];
  if (Object.keys(savedFe).length) {
    const patch = { ...savedFe, updated_at: new Date().toISOString() };
    ops.push(db.from('financial_events').update(patch).eq('id', fe.id).then(({ error }) => {
      if (error) throw error;
      Object.assign(fe, savedFe);
    }));
  }
  for (const [id, patchFields] of savedExpenses) {
    const patch = { ...patchFields, updated_at: new Date().toISOString() };
    ops.push(db.from('financial_expenses').update(patch).eq('id', id).then(({ error }) => {
      if (error) throw error;
      for (const [, rows] of expensesByEvent) {
        const r = rows.find(x => x.id === id);
        if (r) Object.assign(r, patchFields);
      }
    }));
  }
  for (const [id, patchFields] of savedIncome) {
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
    const results=await Promise.allSettled(ops);
    const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
    // Item edits are now applied in memory - refresh the cached column.
    await syncAddonsColumn(fe);
    if(currentSelection()?.fe?.id===fe.id){removeSavedFields(dirtyFe,savedFe);removeSavedMapFields(dirtyExpenses,savedExpenses);removeSavedMapFields(dirtyIncomeItems,savedIncome);}
    renderEventsList(document.getElementById('events-search').value);
    renderMonthSummary();
    renderDetail();
  } catch (err) {
    console.error('saveDraft failed', err);
    alert('Грешка при запис: ' + (err?.message || err));
    if (btn) { btn.disabled = false; btn.textContent = 'Запази промените'; }
  } finally {
    pnlSaving=false;if(panel)panel.inert=false;
  }
}

function cancelDraft() {
  if(pnlSaving)return;
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
  if(pnlSaving)return;
  const sel = currentSelection();
  if (!sel || !sel.fe) return;
  const { kind, enquiry, fe } = sel;
  const label = enquiry ? (enquiry.full_name || '-') : (fe.customer_name || '-');
  const msg = kind === 'enquiry'
    ? `Изтриване на P&L за "${label}"?\nЗапитването НЕ се изтрива. Прикачените разходи се изтриват също.`
    : `Изтриване на ръчното събитие "${label}"?\nСамото събитие и всички прикачени разходи се изтриват.`;
  if (!confirm(msg)) return;

  const { error: feErr } = await db.rpc('delete_financial_pnl', { target_event: fe.id });
  if (feErr) { console.error(feErr); alert(feErr.code === '23503' ? 'Събитието има записи за извънреден труд. Финансовата история е запазена.' : 'Грешка при изтриване на P&L'); return; }

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
  if(pnlSaving){showToast('Изчакайте записът да приключи.');return;}
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
  if(pnlSaving){showToast('Изчакайте записът да приключи.');return;}
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
// with a custom modal - the inputs are: customer name, date, optional
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

async function addEventExpense(category = 'other') {
  if(pnlSaving)return;
  const sel = currentSelection();
  if (!sel) return;
  // Enquiry selection might not have its fe created yet - lazily create.
  let fe = sel.fe;
  if (!fe && sel.enquiry) fe = await ensureFinancialEvent(sel.enquiry);
  if (!fe) return;
  const row = {
    month: fe.month,
    expense_date: fe.event_date || null,
    description: '',
    amount_eur: 0,
    category,
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
  // Enquiry selection might not have its fe created yet - lazily create.
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
  // New line starts at €0 - no need to touch the cached sum yet.
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
// Partner commissions
// The partner list is read live from public.partners, so whatever the
// manager does on admin/partners.html (add, rename, recategorise, hide)
// shows up here on the next load - nothing is copied. Each partner gets
// its own card; entries are typed in by hand and autosave on change.
// ────────────────────────────────────────────────────────────────

function partnerCat(id) {
  return PARTNER_CATS.find(c => c.id === id) || { id, label: id || '-', icon: '🤝' };
}
function partnerRate(partnerId) {
  const r = commissionRateByPartner.get(partnerId);
  return r != null && Number.isFinite(r) ? r : DEFAULT_COMMISSION_PCT;
}
function commissionsInScope() {
  return monthFilter ? commissions.filter(c => c.month === monthFilter) : commissions;
}
function commissionTotals(rows) {
  let total = 0, received = 0;
  rows.forEach(c => {
    const amt = Number(c.commission_eur || 0);
    total += amt;
    if (c.received) received += amt;
  });
  return { total: Math.round(total * 100) / 100, received: Math.round(received * 100) / 100, count: rows.length };
}
// base × % rounded to cents.
function calcCommission(base, pct) {
  return Math.round((Number(base) || 0) * (Number(pct) || 0)) / 100;
}
function pluralEntries(n) { return `${n} ${n === 1 ? 'запис' : 'записа'}`; }

// Event picker for an entry: every P&L row in the entry's month (enquiry-
// linked and manual), plus the currently linked one even if its month
// differs, so a stored link is never silently dropped by the <select>.
function commissionEventOptions(c) {
  const rows = [];
  for (const fe of financialEventsById.values()) {
    if (fe.month === c.month || fe.id === c.event_id) rows.push(fe);
  }
  rows.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));
  const opts = rows.map(fe => {
    const enq = fe.enquiry_id ? allEnquiries.find(e => e.id === fe.enquiry_id) : null;
    const badge = enq ? `#${enq.enquiry_number ?? '-'}` : 'M';
    const name = enq ? (enq.full_name || '-') : (fe.customer_name || '-');
    return `<option value="${esc(fe.id)}"${fe.id === c.event_id ? ' selected' : ''}>${esc(badge)} ${esc(name)} · ${esc(fmtDateBg(fe.event_date))}</option>`;
  });
  return `<option value=""${c.event_id ? '' : ' selected'}>— без събитие —</option>` + opts.join('');
}

function commissionRowHtml(c) {
  return `
    <tr data-pc-id="${esc(c.id)}"${c.received ? ' class="pc-row--received"' : ''}>
      <td><input type="date" data-pc-f="commission_date" value="${esc(c.commission_date || '')}" aria-label="Дата"></td>
      <td><select data-pc-f="event_id" aria-label="Събитие">${commissionEventOptions(c)}</select></td>
      <td><input type="number" step="0.01" min="0" data-pc-f="base_amount_eur" value="${c.base_amount_eur ?? ''}" placeholder="€" aria-label="Основа - сметка на партньора €" title="Сумата, която партньорът е фактурирал на клиента"></td>
      <td><input type="number" step="0.5" min="0" max="100" class="pc-pct" data-pc-f="commission_percent" value="${c.commission_percent ?? ''}" placeholder="%" aria-label="Комисион %"></td>
      <td><input type="number" step="0.01" min="0" class="pc-comm" data-pc-f="commission_eur" value="${c.commission_eur ?? ''}" placeholder="€" aria-label="Комисион €" title="Изчислява се от основа × %, но може да се въведе и директно"></td>
      <td class="pc-td-check"><input type="checkbox" data-pc-f="received"${c.received ? ' checked' : ''} aria-label="Получен"></td>
      <td><input type="text" maxlength="500" data-pc-f="notes" value="${esc(c.notes || '')}" placeholder="Бележка (напр. клиент, фактура №)"></td>
      <td><button type="button" class="del-btn" data-pc-del="${esc(c.id)}" title="Изтрий">×</button></td>
    </tr>`;
}

function partnerTotalsHtml(tot) {
  if (!tot.count) return '<span>без записи</span>';
  return `<span>${pluralEntries(tot.count)}</span> · <strong>${fmtEur(tot.total)}</strong>`
    + (tot.received > 0 ? ` <span class="pc-card__recv">получени ${fmtEur(tot.received)}</span>` : '');
}

function partnerCardHtml(p, rows) {
  const cat = partnerCat(p.category);
  const tot = commissionTotals(rows);
  const table = rows.length ? `
    <div class="pc-table-wrap">
      <table class="pc-table">
        <thead><tr>
          <th>Дата</th><th>Събитие</th><th>Основа €</th><th>%</th><th>Комисион €</th><th>Получен</th><th>Бележка</th><th></th>
        </tr></thead>
        <tbody>${rows.map(commissionRowHtml).join('')}</tbody>
      </table>
    </div>` : '<div class="empty-state pc-empty">Няма записани комисиони за този период.</div>';
  const contact = [p.contact_name, p.phone].filter(Boolean).join(' · ');
  return `
    <div class="pc-card${p.active ? '' : ' pc-card--hidden'}" data-pc-partner="${esc(p.id)}">
      <div class="pc-card__head">
        <span class="pc-card__icon" aria-hidden="true">${cat.icon}</span>
        <div class="pc-card__title">
          <strong>${esc(p.name)}</strong>
          <span class="pc-card__cat">${esc(cat.label)}</span>
          ${p.active ? '' : '<span class="pc-card__badge">скрит на сайта</span>'}
          ${contact ? `<div class="pc-card__contact">${esc(contact)}</div>` : ''}
        </div>
        <label class="pc-card__rate" title="Ставка по подразбиране за НОВИ записи на този партньор. Вече въведените записи не се променят.">
          Ставка
          <input type="number" step="0.5" min="0" max="100" data-pc-rate="${esc(p.id)}" value="${partnerRate(p.id)}">
          %
        </label>
        <div class="pc-card__totals" id="pc-totals-${esc(p.id)}">${partnerTotalsHtml(tot)}</div>
      </div>
      ${table}
      <button type="button" class="btn-add btn-sm" data-pc-add="${esc(p.id)}">+ Добави комисион</button>
    </div>`;
}

function commissionsByPartner(rows) {
  const map = new Map();
  rows.forEach(c => {
    if (!map.has(c.partner_id)) map.set(c.partner_id, []);
    map.get(c.partner_id).push(c);
  });
  for (const list of map.values()) {
    list.sort((a, b) => (a.commission_date || '').localeCompare(b.commission_date || '')
      || (a.created_at || '').localeCompare(b.created_at || ''));
  }
  return map;
}

function renderPartnerCommissions() {
  const wrap = document.getElementById('pc-groups');
  if (!wrap) return;
  const scope = commissionsInScope();
  const byPartner = commissionsByPartner(scope);
  const tot = commissionTotals(scope);
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('pc-month-label', monthLabel(monthFilter));
  set('pc-count', `${pluralEntries(tot.count)} · ${fmtEur(tot.total)}${tot.received ? ` · получени ${fmtEur(tot.received)}` : ''}`);

  if (!partnersAll.length) {
    wrap.innerHTML = '<div class="empty-state">Няма партньори. Добавете ги от раздел „Партньори“ - ще се появят тук автоматично.</div>';
    return;
  }
  // Hidden (inactive) partners stay listed only while they have entries in
  // the current scope: history must stay reachable, but a partner the
  // manager retired should not clutter the page in months it earned nothing.
  const visible = partnersAll.filter(p => p.active || byPartner.has(p.id));
  // Known categories first, in order; an unknown value from the DB trails so
  // a partner never disappears because this page has not caught up yet.
  const cats = [...new Set([...PARTNER_CATS.map(c => c.id), ...visible.map(p => p.category)])];
  const html = cats.map(catId => {
    const inCat = visible
      .filter(p => p.category === catId)
      .sort((a, b) => ((Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)) || String(a.name).localeCompare(String(b.name), 'bg'));
    if (!inCat.length) return '';
    const cat = partnerCat(catId);
    return `
      <div class="pc-group">
        <div class="pc-group__title">${esc(cat.label)} <span class="pc-group__count">${inCat.length}</span></div>
        ${inCat.map(p => partnerCardHtml(p, byPartner.get(p.id) || [])).join('')}
      </div>`;
  }).join('');
  wrap.innerHTML = html || '<div class="empty-state">Няма активни партньори.</div>';
}

// Refresh only the DERIVED figures (card totals, section head, KPI tile)
// after an autosave - touches no <input>, same focus-safety rule as
// updateDetailTotals.
function refreshCommissionTotals() {
  const scope = commissionsInScope();
  const byPartner = commissionsByPartner(scope);
  document.querySelectorAll('[data-pc-partner]').forEach(card => {
    const pid = card.getAttribute('data-pc-partner');
    const el = document.getElementById('pc-totals-' + pid);
    if (el) el.innerHTML = partnerTotalsHtml(commissionTotals(byPartner.get(pid) || []));
  });
  const tot = commissionTotals(scope);
  const cnt = document.getElementById('pc-count');
  if (cnt) cnt.textContent = `${pluralEntries(tot.count)} · ${fmtEur(tot.total)}${tot.received ? ` · получени ${fmtEur(tot.received)}` : ''}`;
  renderMonthSummary();
}

async function addCommission(partnerId) {
  const p = partnersAll.find(x => x.id === partnerId);
  if (!p) return;
  // Land the entry in the month being looked at (or the current one), dated
  // today when today is inside that month, else on its 1st.
  const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' });
  const month = monthFilter || todayISO.slice(0, 7);
  const commission_date = todayISO.slice(0, 7) === month ? todayISO : `${month}-01`;
  const row = {
    partner_id: partnerId,
    month,
    commission_date,
    event_id: null,
    base_amount_eur: 0,
    commission_percent: partnerRate(partnerId),
    commission_eur: 0,
    received: false,
    notes: null,
    created_by: userEmail,
  };
  const { data, error } = await db.from('partner_commissions').insert(row).select().single();
  if (error) {
    console.error('addCommission failed', error);
    showToast('Грешка при добавяне на комисион: ' + (error.message || ''), 'error');
    return;
  }
  commissions.push(data);
  renderPartnerCommissions();
  renderMonthSummary();
  const inp = document.querySelector(`[data-pc-id="${data.id}"] [data-pc-f="base_amount_eur"]`);
  if (inp) inp.focus();
}

async function deleteCommission(id) {
  const c = commissions.find(x => x.id === id);
  if (!c) return;
  if (!confirm('Изтриване на този запис за комисион?')) return;
  const { error } = await db.from('partner_commissions').delete().eq('id', id);
  if (error) { console.error('deleteCommission failed', error); showToast('Грешка при изтриване.', 'error'); return; }
  commissions = commissions.filter(x => x.id !== id);
  renderPartnerCommissions();
  renderMonthSummary();
}

// Autosave one field of an entry (fired on 'change' = blur/Enter, not per
// keystroke). base × % re-derives the commission € unless the € itself was
// the field edited - the same "computed but still editable" rule as the
// overtime line in the P&L.
async function setCommissionField(id, field, raw, inputEl) {
  const c = commissions.find(x => x.id === id);
  if (!c) return;
  const revert = (key) => { if (inputEl) inputEl.value = c[key] ?? ''; };
  const patch = {};
  if (field === 'received') {
    patch.received = !!raw;
  } else if (field === 'event_id') {
    patch.event_id = raw || null;
  } else if (field === 'notes') {
    patch.notes = String(raw).trim() || null;
  } else if (field === 'commission_date') {
    const v = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    patch.commission_date = v;
    if (v) patch.month = v.slice(0, 7);   // the entry follows its date into that month
  } else if (field === 'commission_percent') {
    const n = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) { showToast('Процентът трябва да е между 0 и 100.', 'error'); revert('commission_percent'); return; }
    patch.commission_percent = n;
    patch.commission_eur = calcCommission(c.base_amount_eur, n);
  } else if (field === 'base_amount_eur') {
    const n = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0) { showToast('Въведете валидна сума.', 'error'); revert('base_amount_eur'); return; }
    patch.base_amount_eur = Math.round(n * 100) / 100;
    patch.commission_eur = calcCommission(patch.base_amount_eur, c.commission_percent);
  } else if (field === 'commission_eur') {
    const n = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0) { showToast('Въведете валидна сума.', 'error'); revert('commission_eur'); return; }
    patch.commission_eur = Math.round(n * 100) / 100;
  } else {
    return;
  }

  const { error } = await db.from('partner_commissions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('setCommissionField failed', error);
    showToast('Промяната не се записа: ' + (error.message || ''), 'error');
    renderPartnerCommissions();   // drop the unsaved edit from the inputs
    return;
  }
  Object.assign(c, patch);
  // Reflect a recomputed € in its input without rebuilding the row.
  if ('commission_eur' in patch && field !== 'commission_eur') {
    const eurInp = document.querySelector(`[data-pc-id="${id}"] [data-pc-f="commission_eur"]`);
    if (eurInp) eurInp.value = patch.commission_eur;
  }
  const tr = document.querySelector(`[data-pc-id="${id}"]`);
  if (tr) tr.classList.toggle('pc-row--received', !!c.received);
  // A date edit that moves the entry out of the filtered month: re-render so
  // the row leaves this month's card (it is still there under its new month).
  if ('month' in patch && monthFilter && patch.month !== monthFilter) {
    showToast(`Записът е преместен в ${monthLabel(patch.month)}.`, 'success');
    renderPartnerCommissions();
    renderMonthSummary();
    return;
  }
  refreshCommissionTotals();
}

// Live preview while typing base / %: the € input follows as you type;
// nothing is saved until the field is left (change).
function previewCommission(id, field, raw) {
  const c = commissions.find(x => x.id === id);
  if (!c) return;
  const base = field === 'base_amount_eur'   ? (Number(raw) || 0) : (Number(c.base_amount_eur) || 0);
  const pct  = field === 'commission_percent' ? (Number(raw) || 0) : (Number(c.commission_percent) || 0);
  const eurInp = document.querySelector(`[data-pc-id="${id}"] [data-pc-f="commission_eur"]`);
  if (eurInp) eurInp.value = calcCommission(base, pct);
}

// Per-partner default rate (partner_commission_rates). Applies to NEW entries
// only - existing rows keep the % they were saved with.
async function setPartnerRate(partnerId, raw, inputEl) {
  const n = raw === '' ? DEFAULT_COMMISSION_PCT : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    showToast('Ставката трябва да е между 0 и 100.', 'error');
    if (inputEl) inputEl.value = partnerRate(partnerId);
    return;
  }
  const { error } = await db.from('partner_commission_rates')
    .upsert({ partner_id: partnerId, percent: n, updated_by: userEmail, updated_at: new Date().toISOString() }, { onConflict: 'partner_id' });
  if (error) {
    console.error('setPartnerRate failed', error);
    showToast('Ставката не се записа: ' + (error.message || ''), 'error');
    if (inputEl) inputEl.value = partnerRate(partnerId);
    return;
  }
  commissionRateByPartner.set(partnerId, n);
  if (inputEl) inputEl.value = n;
  showToast(`Ставка ${n}% за новите записи на партньора.`, 'success');
}

// KPI tile drill-down: one row per entry in the month scope, partner first.
// Clicking a row scrolls to that partner's card.
function openCommissionBreakdown() {
  lastDrill = { kind: 'metric', metric: 'commissions' };
  const rows = commissionsInScope()
    .map(c => ({ c, amt: Number(c.commission_eur || 0) }))
    .filter(r => r.amt > 0)
    .sort((a, b) => b.amt - a.amt);
  const total = rows.reduce((s, r) => s + r.amt, 0);
  const title = document.getElementById('drill-title');
  if (title) title.textContent = `Комисиони от партньори · ${monthLabel(monthFilter)}`;
  const body = document.getElementById('drill-body');
  if (body) {
    body.innerHTML = rows.length
      ? `<div class="link-modal__list">${rows.map(r => {
          const p = partnersAll.find(x => x.id === r.c.partner_id);
          const fe = r.c.event_id ? financialEventsById.get(r.c.event_id) : null;
          const enq = fe?.enquiry_id ? allEnquiries.find(e => e.id === fe.enquiry_id) : null;
          const detail = fe
            ? ` · ${enq ? `#${enq.enquiry_number ?? '-'} ${enq.full_name || '-'}` : (fe.customer_name || '-')}`
            : (r.c.notes ? ` · ${r.c.notes}` : '');
          return `<button type="button" class="drill-row" data-pc-jump="${esc(r.c.partner_id)}"
              style="display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 12px;border:1px solid var(--fin-border,#e6e1d6);border-radius:8px;background:var(--fin-bg,#fff);cursor:pointer;font:inherit;color:inherit">
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><strong>${esc(p ? p.name : '-')}</strong><span style="opacity:.75">${esc(detail)}</span></span>
              <span style="opacity:.7;font-size:.85em;white-space:nowrap">${esc(fmtDateBg(r.c.commission_date))}${r.c.received ? ' · получен' : ''}</span>
              <span style="font-weight:700;white-space:nowrap">${fmtEur(r.amt)}</span>
            </button>`;
        }).join('')}</div>
         <div style="display:flex;justify-content:space-between;margin-top:14px;padding-top:10px;border-top:2px solid var(--fin-border,#e6e1d6);font-weight:800">
           <span>Общо · ${pluralEntries(rows.length)}</span><span>${fmtEur(total)}</span>
         </div>`
      : '<div class="empty-state">Няма комисиони в този период.</div>';
  }
  const m = document.getElementById('drill-modal');
  if (m) m.removeAttribute('hidden');
}
function jumpToPartnerCard(partnerId) {
  closeDrill();
  const card = document.querySelector(`[data-pc-partner="${partnerId}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('is-flash');
  setTimeout(() => card.classList.remove('is-flash'), 1600);
}

// ────────────────────────────────────────────────────────────────
// Summary → event-list drill-down
// ────────────────────────────────────────────────────────────────

function scrollEventsIntoView() {
  const list = document.querySelector('.event-pnl');
  if (!list) return;
  list.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ────────────────────────────────────────────────────────────────
// Event handlers
// ────────────────────────────────────────────────────────────────

// ── KPI drill-down ──────────────────────────────────────────────
// Click a summary box → modal listing every event that makes up that
// figure (same month scope + same date gate as renderMonthSummary).
function eventHasHappened(fe) {
  const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' });
  return !fe.event_date || fe.event_date < todayISO;
}
function closeDrill() {
  const m = document.getElementById('drill-modal');
  if (m) m.setAttribute('hidden', '');
}
// Records the list currently behind the offer view so "← back" can restore
// it. Set by openMetricBreakdown / openCategoryBreakdown at entry.
let lastDrill = null;
function drillRowHtml(fe, amt, signed) {
  const enq = fe.enquiry_id ? allEnquiries.find(e => e.id === fe.enquiry_id) : null;
  const name = enq ? (enq.full_name || '-') : (fe.customer_name || '-');
  const badge = enq ? `#${esc(enq.enquiry_number ?? '-')}` : 'M';
  const sel = enq ? `data-enquiry="${esc(fe.enquiry_id)}"` : `data-manual-fe="${esc(fe.id)}"`;
  const negColor = signed && amt < 0 ? 'color:#c0392b;' : '';
  return `<button type="button" class="drill-row" ${sel}
      style="display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 12px;border:1px solid var(--fin-border,#e6e1d6);border-radius:8px;background:var(--fin-bg,#fff);cursor:pointer;font:inherit;color:inherit">
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="enquiry-no">${badge}</span> ${esc(name)}</span>
      <span style="opacity:.7;font-size:.85em;white-space:nowrap">${esc(fmtDateBg(fe.event_date))}</span>
      <span style="font-weight:700;white-space:nowrap;${negColor}">${fmtEur(amt)}</span>
    </button>`;
}
function openMetricBreakdown(metric) {
  if(incompleteBottleCostsInMonth() && ['expense','profit'].includes(metric)){showToast('Липсват покупни цени за бутилки. Попълнете ги по събития.','error');return;}
  if(electricityError && ['expense','profit'].includes(metric)){showToast('Непълни данни за електроенергията. Презаредете страницата.','error');return;}
  if(managerPayError && ['expense','profit'].includes(metric)){showToast('Непълни данни за заплатите. Презаредете страницата.','error');return;}
  if (metric === 'commissions') { openCommissionBreakdown(); return; }
  lastDrill = { kind: 'metric', metric };
  const TITLES = { income: 'Приходи (реализирани)', upcoming: 'Очаквани (предстоящи)', paid: 'Платено от клиенти', expense: 'Разходи', profit: 'Печалба' };
  const scopeFes = [];
  for (const fe of financialEventsById.values()) {
    if (!monthFilter || fe.month === monthFilter) scopeFes.push(fe);
  }
  const amountOf = (fe) => {
    const past = eventHasHappened(fe);
    switch (metric) {
      case 'income':   return past  ? revenueForDisplay(feIncome(fe).total) : null;
      case 'upcoming': return !past ? revenueForDisplay(feIncome(fe).total) : null;
      case 'paid':     return fePaid(fe) || null;
      case 'expense':  return past  ? (feExpenseTotal(fe) || null) : null;
      case 'profit':   return past  ? (feIncome(fe).total - feExpenseTotal(fe)) : null;
      default:         return null;
    }
  };
  const rows = scopeFes
    .map(fe => ({ fe, amt: amountOf(fe) }))
    .filter(r => r.amt != null && (['profit','expense'].includes(metric) ? r.amt !== 0 : r.amt > 0))
    .sort((a, b) => b.amt - a.amt);
  const overheadTotal = electricityTotal() + managerPayTotal();
  const overhead = metric === 'expense' ? overheadTotal : metric === 'profit' ? -overheadTotal : 0;
  const overheadRows = ['expense','profit'].includes(metric) ? electricityDrillRows(metric==='profit'?-1:1) + managerPayDrillRows(metric==='profit'?-1:1) : '';
  const total = rows.reduce((s, r) => s + r.amt, 0) + overhead;
  const title = document.getElementById('drill-title');
  if (title) title.textContent = `${TITLES[metric] || 'Разбивка'}${['income','upcoming'].includes(metric) ? (revenueWithoutVat ? ' · без ДДС' : ' · с ДДС') : ''} · ${monthLabel(monthFilter)}`;
  const body = document.getElementById('drill-body');
  if (body) {
    body.innerHTML = rows.length || overheadRows
      ? `<div class="link-modal__list">${rows.map(r => drillRowHtml(r.fe, r.amt, metric === 'profit')).join('')}${overheadRows}</div>
         <div style="display:flex;justify-content:space-between;margin-top:14px;padding-top:10px;border-top:2px solid var(--fin-border,#e6e1d6);font-weight:800">
           <span>Общо · ${rows.length} събития${overheadRows?' + месечни разходи':''}</span><span>${fmtEur(total)}</span>
         </div>`
      : '<div class="empty-state">Няма събития в този период.</div>';
  }
  const m = document.getElementById('drill-modal');
  if (m) m.removeAttribute('hidden');
}

// ── Category drill-down ─────────────────────────────────────────
// Click an income/expense category pill → same modal, full breakdown of
// that category: income = one row per event; expense = one row per
// expense line (event + note + amount). Rows jump to the event's P&L.
// Same month scope + realized-only gate as renderMonthSummary, so the
// modal total always matches the pill.
function expenseDrillRowHtml(fe, x, amt) {
  const enq = fe.enquiry_id ? allEnquiries.find(e => e.id === fe.enquiry_id) : null;
  const name = enq ? (enq.full_name || '-') : (fe.customer_name || '-');
  const badge = enq ? `#${esc(enq.enquiry_number ?? '-')}` : 'M';
  const sel = enq ? `data-enquiry="${esc(fe.enquiry_id)}"` : `data-manual-fe="${esc(fe.id)}"`;
  const note = x.notes ? ` · <span style="opacity:.75">${esc(x.notes)}</span>` : '';
  return `<button type="button" class="drill-row" ${sel} data-expense-id="${esc(x.id)}"
      style="display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 12px;border:1px solid var(--fin-border,#e6e1d6);border-radius:8px;background:var(--fin-bg,#fff);cursor:pointer;font:inherit;color:inherit">
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="enquiry-no">${badge}</span> ${esc(name)}${note}</span>
      <span style="opacity:.7;font-size:.85em;white-space:nowrap">${esc(fmtDateBg(fe.event_date))}</span>
      <span style="font-weight:700;white-space:nowrap">${fmtEur(amt)}</span>
    </button>`;
}
function openCategoryBreakdown(kind, catId) {
  if(kind==='expense' && catId==='drinks' && incompleteBottleCostsInMonth()){showToast('Липсват покупни цени за бутилки. Попълнете ги по събития.','error');return;}
  if(electricityError && kind==='expense' && catId==='utilities'){showToast('Непълни данни за електроенергията. Презаредете страницата.','error');return;}
  if(managerPayError && kind==='expense' && catId==='staff_service'){showToast('Непълни данни за заплатите. Презаредете страницата.','error');return;}
  lastDrill = { kind: 'cat', catKind: kind, catId };
  const scopeFes = [];
  for (const fe of financialEventsById.values()) {
    if ((!monthFilter || fe.month === monthFilter) && eventHasHappened(fe)) scopeFes.push(fe);
  }
  let label, rowsHtml, lineCount;
  let total = 0;
  const eventIds = new Set();
  if (kind === 'income') {
    label = (INCOME_LABELS.find(c => c.id === catId) || {}).label || catId;
    const rows = scopeFes
      .map(fe => ({ fe, amt: revenueForDisplay(feIncome(fe)[catId] || 0) }))
      .filter(r => r.amt !== 0)
      .sort((a, b) => b.amt - a.amt);
    rows.forEach(r => { total += r.amt; eventIds.add(r.fe.id); });
    lineCount = rows.length;
    rowsHtml = rows.map(r => drillRowHtml(r.fe, r.amt, false) + (catId === 'overtime' ? `<p class="pay-note">Към клиента: <strong>${Number(r.fe.income_overtime_hours || 0)} ч.</strong> × ${fmtEur(r.fe.income_overtime_rate_eur || 0)} · Управител: <strong>${managerOvertimeRows.filter(x => x.event_id === r.fe.id).reduce((s,x) => s + Number(x.hours), 0)} ч.</strong></p>` : '')).join('');
  } else {
    label = (EXPENSE_CATS.find(c => c.id === catId) || {}).label || catId;
    const rows = [];
    scopeFes.forEach(fe => {
      (expensesByEvent.get(fe.id) || []).forEach(x => {
        const amt = Number(x.amount_eur || 0);
        if ((x.category || 'other') === catId && amt !== 0) rows.push({ fe, x, amt });
      });
    });
    rows.sort((a, b) => b.amt - a.amt);
    rows.forEach(r => { total += r.amt; eventIds.add(r.fe.id); });
    lineCount = rows.length;
    rowsHtml = rows.map(r => expenseDrillRowHtml(r.fe, r.x, r.amt)).join('');
  }
  const title = document.getElementById('drill-title');
  if (title) title.textContent = `${label}${kind === 'income' ? (revenueWithoutVat ? ' · без ДДС' : ' · с ДДС') : ''} · ${monthLabel(monthFilter)}`;
  if(kind==='expense'&&catId==='drinks'){scopeFes.forEach(fe=>{const cost=eventBottleCost(fe);if(cost.auto){rowsHtml+=bottleCostDrillRow(fe);total+=cost.auto;lineCount++;eventIds.add(fe.id);}});}
  if(kind==='expense' && catId==='utilities'){rowsHtml+=electricityDrillRows();total+=electricityTotal();lineCount+=electricityScope().filter(r=>Number(r.amount_eur)!==0).length;}
  if(kind==='expense' && catId==='staff_service'){rowsHtml+=managerPayDrillRows();total+=managerPayTotal();lineCount+=managerPayScope().filter(r=>managerPayAmount(r)!==0).length;}
  const body = document.getElementById('drill-body');
  if (body) {
    const n = eventIds.size;
    const linePart = kind === 'expense' && lineCount !== n
      ? `${lineCount} ${lineCount === 1 ? 'разход' : 'разхода'} · ` : '';
    body.innerHTML = lineCount
      ? `<div class="link-modal__list">${rowsHtml}</div>
         <div style="display:flex;justify-content:space-between;margin-top:14px;padding-top:10px;border-top:2px solid var(--fin-border,#e6e1d6);font-weight:800">
           <span>Общо · ${linePart}${n} ${n === 1 ? 'събитие' : 'събития'}</span><span>${fmtEur(total)}</span>
         </div>`
      : '<div class="empty-state">Няма записи в тази категория за периода.</div>';
  }
  const m = document.getElementById('drill-modal');
  if (m) m.removeAttribute('hidden');
}
function pillBreakdownFromTarget(pill) {
  const kind = pill.closest('#income-cat-breakdown') ? 'income' : 'expense';
  openCategoryBreakdown(kind, pill.getAttribute('data-cat'));
}

// ── Offer drill-down ────────────────────────────────────────────
// Click an event row inside the drill modal → read-only breakdown of that
// customer's full offer (оферта), rendered in the SAME modal. Mirrors the
// canonical quote in offer-pdf.js: venue + extra guests + drinks + addons
// (cleaning rides as a normal addon) − discount (venue base only) → total,
// deposit 50%, balance, 2-day validity. Read-only: never mutates saved P&L.
function computeOffer(enq) {
  const venue = venueBaseOf(enq);
  const guests = Number(enq.guests) || 0;
  const extraGuests = Math.max(0, guests - VENUE_MIN_GUESTS);
  const extraGuestsCost = extraGuests * EXTRA_GUEST_FEE_EUR;

  const drinkRows = (Array.isArray(enq.drinks) ? enq.drinks : [])
    .map(d => {
      const qty = Number(d.qty) || 0;
      const unit = d.price_eur != null ? Number(d.price_eur) : (Number(d.price) || 0);
      return { name: d.name || d.id || '-', qty, unit, line: unit * qty };
    })
    .filter(d => d.qty > 0);
  const drinksSum = drinkRows.reduce((s, d) => s + d.line, 0);

  const addonRows = (Array.isArray(enq.addons) ? enq.addons : [])
    .map(a => ({
      name: a.name || a.id || '-',
      qty: a.qty != null ? Number(a.qty) : null,
      line: offerAddonPriceEur(a.id, Number(a.price) || 0),
    }));
  const addonsSum = addonRows.reduce((s, a) => s + a.line, 0);

  const pct = Number(enq.applied_discount_percent || 0);
  const discount = pct > 0 ? Math.round(venue * pct) / 100 : 0; // % of venue base only
  const total = venue + extraGuestsCost + addonsSum + drinksSum - discount;
  const deposit = Math.round(total * OFFER_DEPOSIT_RATE * 100) / 100;
  return {
    venue, extraGuests, extraGuestsCost,
    drinkRows, drinksSum, addonRows, addonsSum,
    discountPct: pct, discount,
    total: Math.round(total * 100) / 100,
    deposit, balance: Math.round((total - deposit) * 100) / 100,
  };
}
function offerViewHtml(enq, o) {
  const rowCss = 'display:flex;justify-content:space-between;gap:12px;padding:6px 0';
  const subCss = 'display:flex;justify-content:space-between;gap:12px;padding:4px 0 4px 16px;opacity:.85;font-size:.94em';
  const grpCss = 'padding:8px 0 2px;font-weight:700;font-size:.9em;opacity:.8';
  const row = (l, v, extra = '') => `<div style="${rowCss}"><span>${l}</span><span style="white-space:nowrap;font-weight:600;${extra}">${v}</span></div>`;
  const sub = (l, v) => `<div style="${subCss}"><span style="flex:1;min-width:0">${l}</span><span style="white-space:nowrap">${v}</span></div>`;

  const parts = [];
  parts.push(row(`Наем на залата · ${esc(enq.event_type || '-')}`, fmtEur(o.venue)));
  if (o.extraGuests > 0) parts.push(row(`Допълнителни гости (${o.extraGuests} × ${fmtEur(EXTRA_GUEST_FEE_EUR)})`, fmtEur(o.extraGuestsCost)));
  if (o.drinkRows.length) {
    parts.push(`<div style="${grpCss}">Напитки</div>`);
    o.drinkRows.forEach(d => parts.push(sub(`${esc(d.name)} · ${fmtEur(d.unit)}/бр. × ${d.qty}`, fmtEur(d.line))));
  }
  if (o.addonRows.length) {
    parts.push(`<div style="${grpCss}">Допълнителни услуги</div>`);
    o.addonRows.forEach(a => parts.push(sub(`${esc(a.name)}${a.qty != null ? ` · ×${a.qty}` : ''}`, fmtEur(a.line))));
  }
  if (o.discount > 0) parts.push(row(`Отстъпка (${o.discountPct}% от наема)`, `− ${fmtEur(o.discount)}`, 'color:var(--fin-accent,#b8923a)'));

  const dateStr = esc(fmtDateBg(parsePreferredDate(enq.preferred_date)));
  const guestsStr = enq.guests != null ? `${esc(enq.guests)} гости` : '-';
  return `
    <button type="button" class="btn btn-ghost btn-sm" data-drill-back style="margin-bottom:12px">← Назад към разбивката</button>
    <div style="font-weight:800;font-size:1.05em"><span class="enquiry-no">#${esc(enq.enquiry_number ?? '-')}</span> ${esc(enq.full_name || '-')}</div>
    <div style="opacity:.7;font-size:.9em;margin-bottom:12px">${esc(enq.event_type || '-')} · ${dateStr} · ${guestsStr}</div>
    <div>${parts.join('')}</div>
    <div style="${rowCss};margin-top:12px;padding-top:10px;border-top:2px solid var(--fin-border,#e6e1d6);font-weight:800;font-size:1.05em">
      <span>Общо</span><span style="white-space:nowrap">${fmtEur(o.total)}</span></div>
    <div style="${rowCss};opacity:.85"><span>Депозит (50%)</span><span style="white-space:nowrap">${fmtEur(o.deposit)}</span></div>
    <div style="${rowCss};opacity:.85"><span>Остатък</span><span style="white-space:nowrap">${fmtEur(o.balance)}</span></div>
    <div style="${rowCss};opacity:.7;font-size:.9em"><span>Валидна</span><span>${OFFER_VALID_DAYS} дни</span></div>
    <p class="pay-note">След 5-ия час: €160/час за залата + €20/час при присъствие на хигиенист. Отделно от стандартната такса за почистване. Не е включено в офертата; начислява се според реалното ползване.</p>
    <button type="button" class="btn btn-primary btn-sm" data-offer-open-pnl="${esc(enq.id)}" style="margin-top:16px;width:100%">Отвори пълния P&amp;L</button>
  `;
}
function openOfferView(enqId) {
  const enq = allEnquiries.find(e => e.id === enqId);
  if (!enq) return;
  const title = document.getElementById('drill-title');
  if (title) title.textContent = `Оферта № ${enq.enquiry_number ?? '-'}`;
  const body = document.getElementById('drill-body');
  if (body) body.innerHTML = offerViewHtml(enq, computeOffer(enq));
  const m = document.getElementById('drill-modal');
  if (m) m.removeAttribute('hidden');
}
function reopenLastDrill() {
  if (!lastDrill) { closeDrill(); return; }
  if (lastDrill.kind === 'metric') openMetricBreakdown(lastDrill.metric);
  else if (lastDrill.kind === 'cat') openCategoryBreakdown(lastDrill.catKind, lastDrill.catId);
}
async function openPnlFromOffer(enqId) {
  closeDrill();
  // An enquiry that was confirmed then unlocked keeps its financial_events
  // row but drops out of the bookable list, so the left rail shows it as a
  // "manual" event. Open it the same way the rail would (selectManual) so the
  // rail highlights it; a still-bookable enquiry opens normally.
  const fe = financialEventByEnquiryId.get(enqId);
  const bookable = bookableEvents.some(e => e.id === enqId);
  if (fe && !bookable) await selectManual(fe.id);
  else await selectEnquiry(enqId);
  scrollEventsIntoView();
}
async function openManualPnlFromDrill(feId) {
  closeDrill();
  await selectManual(feId);
  scrollEventsIntoView();
}
document.addEventListener('keydown', evt => {
  if (evt.key === 'Escape') { closeDrill(); return; }
  if (evt.key === 'Enter' || evt.key === ' ') {
    const kpi = evt.target.closest && evt.target.closest('#month-summary .kpi[data-metric]');
    if (kpi) { evt.preventDefault(); openMetricBreakdown(kpi.getAttribute('data-metric')); return; }
    const pill = evt.target.closest && evt.target.closest('#month-summary .pill[data-cat]');
    if (pill) { evt.preventDefault(); pillBreakdownFromTarget(pill); }
  }
});

document.addEventListener('click', evt => {
  if (evt.target.closest('[data-drill-close]')) { closeDrill(); return; }

  // Partner commissions: add / delete an entry, jump from the KPI drill-down.
  const pcJump = evt.target.closest('[data-pc-jump]');
  if (pcJump) { jumpToPartnerCard(pcJump.getAttribute('data-pc-jump')); return; }
  const pcAdd = evt.target.closest('[data-pc-add]');
  if (pcAdd) { addCommission(pcAdd.getAttribute('data-pc-add')); return; }
  const pcDel = evt.target.closest('[data-pc-del]');
  if (pcDel) { deleteCommission(pcDel.getAttribute('data-pc-del')); return; }

  // Inside the drill modal: enquiry rows open the read-only offer view
  // in-place; manual rows have no customer offer, so drop straight into
  // their P&L (scrolled). "← back" restores the list; the offer's
  // "open P&L" button opens the editable panel. These are scoped to
  // #drill-modal so the left-rail event list keeps its own behavior.
  const drillEnqRow = evt.target.closest('#drill-modal [data-enquiry]');
  if (drillEnqRow) { if (lastDrill?.kind === 'cat') { openCategoryEvent(drillEnqRow.getAttribute('data-enquiry'), null, drillEnqRow.dataset.expenseId); } else openOfferView(drillEnqRow.getAttribute('data-enquiry')); return; }
  const drillManualRow = evt.target.closest('#drill-modal [data-manual-fe]');
  if (drillManualRow) { if (lastDrill?.kind === 'cat') openCategoryEvent(null, drillManualRow.getAttribute('data-manual-fe'), drillManualRow.dataset.expenseId); else openManualPnlFromDrill(drillManualRow.getAttribute('data-manual-fe')); return; }
  if (evt.target.closest('[data-drill-back]')) { reopenLastDrill(); return; }
  const offerPnlBtn = evt.target.closest('[data-offer-open-pnl]');
  if (offerPnlBtn) { openPnlFromOffer(offerPnlBtn.getAttribute('data-offer-open-pnl')); return; }

  const ev = evt.target.closest('[data-enquiry]');
  if (ev) { closeDrill(); selectEnquiry(ev.getAttribute('data-enquiry')); return; }
  const manual = evt.target.closest('[data-manual-fe]');
  if (manual) { closeDrill(); selectManual(manual.getAttribute('data-manual-fe')); return; }
  if (evt.target.closest('#btn-add-manual-event')) { addManualEvent(); return; }
  if (evt.target.closest('#btn-add-event-expense')) { addEventExpense(); return; }
  if (evt.target.closest('#btn-add-income-service')) { addIncomeService(); return; }
  if (evt.target.closest('#btn-add-drink'))          { addCatalogDrink(); return; }
  if (evt.target.closest('#btn-add-drink-manual'))   { addManualDrink(); return; }
  if (evt.target.closest('#btn-save-pnl'))          { saveDraft(); return; }
  if (evt.target.closest('#btn-cancel-pnl'))        { cancelDraft(); return; }
  if (evt.target.closest('#btn-delete-pnl'))        { deletePnl(); return; }
  if (evt.target.closest('#btn-drift-refresh'))     { refreshFromEnquiry(); return; }

  // Summary drill-downs: KPI boxes open the per-event metric breakdown,
  // category pills open the per-category breakdown in the same modal.
  const pill = evt.target.closest('#month-summary .pill[data-cat]');
  const kpi  = evt.target.closest('#month-summary .kpi');
  const sumHead = evt.target.closest('#month-summary .fin-section__head');
  if (pill) {
    pillBreakdownFromTarget(pill);
    return;
  }
  if (kpi) {
    openMetricBreakdown(kpi.getAttribute('data-metric'));
    return;
  }
  if (sumHead) {
    scrollEventsIntoView();
    return;
  }

  if (evt.target.closest('#btn-month-all')) {
    monthFilter = '';
    const inp = document.getElementById('fin-month');
    if (inp) inp.value = '';
    renderEventsList(document.getElementById('events-search').value);
    renderMonthSummary();
    renderPartnerCommissions();
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

  // Commission entry: base / % typed -> preview the € live; saved on change.
  const pcInp = evt.target.closest('[data-pc-f]');
  if (pcInp) {
    const tr = pcInp.closest('[data-pc-id]');
    const f = pcInp.dataset.pcF;
    if (tr && (f === 'base_amount_eur' || f === 'commission_percent')) previewCommission(tr.dataset.pcId, f, pcInp.value);
    return;
  }

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
  // Partner commissions - every field autosaves on change (blur / Enter /
  // pick); the per-partner default rate likewise.
  const pcInp = evt.target.closest('[data-pc-f]');
  if (pcInp) {
    const tr = pcInp.closest('[data-pc-id]');
    if (tr) {
      const f = pcInp.dataset.pcF;
      setCommissionField(tr.dataset.pcId, f, f === 'received' ? pcInp.checked : pcInp.value, pcInp);
    }
    return;
  }
  const rateInp = evt.target.closest('[data-pc-rate]');
  if (rateInp) { setPartnerRate(rateInp.dataset.pcRate, rateInp.value, rateInp); return; }

  // Оферта discount (%) - applies on blur/Enter, not per keystroke.
  const pctInp = evt.target.closest('#pnl-discount-pct');
  if (pctInp) { applyRentDiscount(pctInp); return; }
  // Drink catalog picker - swap the drink (and its live price) on the line.
  const drinkSel = evt.target.closest('[data-drink-f="select"]');
  if (drinkSel) {
    const li = drinkSel.closest('[data-drink-index]');
    if (li) { setDrinkSelect(Number(li.dataset.drinkIndex), drinkSel.value); return; }
  }
  if (evt.target.id === 'fin-month') {
    monthFilter = evt.target.value || '';
    renderEventsList(document.getElementById('events-search').value);
    renderMonthSummary();
    renderPartnerCommissions();
  }
});

// ────────────────────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;
  userEmail = session.user?.email || null;

  // Drink catalog from the DB (public.drinks) - prices the P&L drink
  // drilldown. Best-effort: a failed load degrades to payload prices.
  try {
    await window.loadCatalog();
    if (typeof drinks !== 'undefined' && Array.isArray(drinks)) {
      drinkCatalogById = new Map(drinks.map(d => [d.id, d]));
    }
  } catch (e) {
    console.warn('drink catalog load failed - P&L drink pricing falls back to payload prices:', e);
  }

  await loadAll();
  await loadManagerPay();
  await loadElectricity();
  await loadDrinkPurchasePrices();
  const now = new Date();
  monthFilter = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthInp = document.getElementById('fin-month');
  if (monthInp) monthInp.value = monthFilter;

  renderEventsList('');
  renderMonthSummary();
  renderDetail();
  renderPartnerCommissions();
});

function rerenderPage() {
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
  renderPartnerCommissions();
}
