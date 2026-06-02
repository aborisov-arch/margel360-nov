// Financials page — monthly bookkeeping that mirrors Angel's Excel template
// plus category breakdown for both income and expenses.
//
// Income side: each event has 4 sub-amounts (rent / drinks / addons / other)
// so reports can show where the revenue came from. The legacy payment-method
// breakdown (cash/bank deposit + balance) is still there but hidden by
// default — toggle with "Детайли по плащане".
//
// Expense side: every row has a controlled-vocab category.
//
// All amounts in EUR. BGN derived live via the fixed peg 1.95583.
// XLSX export reproduces the original template layout plus a category
// breakdown block at the bottom.

const BGN_RATE = 1.95583;
const fmtEur = n => '€' + (Number(n) || 0).toFixed(2);
const fmtBgn = n => 'лв ' + (Number(n) || 0).toFixed(2);

// HTML-escape + date formatter. dashboard.js has its own copies but this
// page doesn't load that file, so we duplicate the small helpers here.
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('bg-BG', { day:'2-digit', month:'2-digit', year:'numeric' });
}

// Income breakdown categories (event-side). The DB column for rent is kept
// (income_rent_eur) but the UI labels it "Оферта" — the bookkeeper enters
// what the customer was quoted; drinks and addons are separate line items
// on top. Total = offer + drinks + addons. The income_other_eur column
// stays in the schema for backward compatibility but is no longer shown.
const INCOME_CATS = [
  { id: 'rent',   field: 'income_rent_eur',   label: 'Оферта' },
  { id: 'drinks', field: 'income_drinks_eur', label: 'Напитки' },
  { id: 'addons', field: 'income_addons_eur', label: 'Доп. услуги' },
];

// Expense categories (controlled vocab matching the CHECK constraint).
const EXPENSE_CATS = [
  { id: 'staff',       label: 'Заплати / хонорари' },
  { id: 'catering',    label: 'Кетъринг' },
  { id: 'drinks',      label: 'Напитки / алкохол' },
  { id: 'decoration',  label: 'Декорация' },
  { id: 'music',       label: 'DJ / музика' },
  { id: 'maintenance', label: 'Поддръжка' },
  { id: 'utilities',   label: 'Сметки / комунални' },
  { id: 'marketing',   label: 'Маркетинг / реклама' },
  { id: 'other',       label: 'Други' },
];
const EXPENSE_CAT_LABEL = Object.fromEntries(EXPENSE_CATS.map(c => [c.id, c.label]));

const EVENT_BASE = { evening: 1280, wedding: 1500, corp4: 330, corp8: 440, bday_day: 700, bday_eve: 970 };
// Venue covers up to 40 guests; each extra guest costs €15. Must match
// dashboard.js, offer-export.js, reservation.js and enquiry-email.ts.
const VENUE_MIN_GUESTS = 40;
const EXTRA_GUEST_FEE_EUR = 15;

// Used when promoting an enquiry — gives the manager a head start by
// splitting the lifetime-value estimate across the 3 categories. The
// "Оферта" (rent) line is the venue base + extra-guest surcharge, so the
// imported amount matches what the customer was actually quoted (e.g.
// €1500 wedding + 40 extra guests × €15 = €2100).
function enquiryBreakdown(e) {
  const base = EVENT_BASE[e.event_id] || 0;
  const guests = Number(e.guests) || 0;
  const extraGuests = Math.max(0, guests - VENUE_MIN_GUESTS);
  const extraGuestsCost = extraGuests * EXTRA_GUEST_FEE_EUR;
  // reservation.js serialises each addon with its LINE price (qty + freeUntil
  // already applied), so we sum a.price directly. Multiplying by qty here
  // double-counted. Drinks are stored with unit price as price_eur and a qty.
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
function estimateEnquiryTotal(e) {
  const b = enquiryBreakdown(e);
  return Math.round((b.rent + b.drinks + b.addons) * 100) / 100;
}

function parsePreferredDate(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

let currentMonth = '';
let allEnquiries = [];
let occupiedDateSet = new Set(); // ISO YYYY-MM-DD strings from `occupied_dates`
let events = [];
let expenses = [];
let userEmail = null;

function isoMonth(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function enquiriesForMonth(month) {
  return allEnquiries.filter(e => {
    if (!['confirmed', 'completed'].includes(e.pipeline_status)) return false;
    const d = parsePreferredDate(e.preferred_date);
    return d && d.startsWith(month);
  });
}
function pendingEnquiries() {
  const linked = new Set(events.map(ev => ev.enquiry_id).filter(Boolean));
  return enquiriesForMonth(currentMonth).filter(e => !linked.has(e.id));
}

// Per-row category total. This is what counts as actual income for the
// month (deposits/balances are just the payment timing).
function eventTotalEur(ev) {
  return INCOME_CATS.reduce((s, c) => s + Number(ev[c.field] || 0), 0);
}

// ────────────────────────────────────────────────────────────────────────
// Rendering
// ────────────────────────────────────────────────────────────────────────

function renderPending() {
  const list = document.getElementById('pending-list');
  if (!list) return;
  const items = pendingEnquiries();
  const cnt = document.getElementById('pending-count');
  if (cnt) cnt.textContent = items.length;
  if (!items.length) {
    list.innerHTML = `<div class="pending-row empty">Няма нови потвърдени запитвания за този месец.</div>`;
    return;
  }
  list.innerHTML = items.map(e => `
    <div class="pending-row">
      <span class="name">${esc(e.full_name || '—')}</span>
      <span class="meta">${esc(e.preferred_date || '')} · ${esc(e.event_type || '')}</span>
      <span class="est">~ €${estimateEnquiryTotal(e)}</span>
      <button class="btn btn-sm btn-primary" data-promote="${esc(e.id)}">Добави към отчета</button>
    </div>
  `).join('');
}

function eventRowHtml(ev, idx) {
  const total = eventTotalEur(ev);
  const linkTitle = ev.enquiry_id ? 'Свързано със събитие от CRM (смени)' : 'Свържи с минало събитие';
  return `
    <tr data-id="${esc(ev.id)}"${ev.enquiry_id ? ' class="is-linked"' : ''}>
      <td class="idx">${idx + 1}</td>
      <td><input type="text" data-f="customer_name" value="${esc(ev.customer_name || '')}"></td>
      <td><input type="date" data-f="event_date" value="${ev.event_date || ''}"></td>
      <td class="num col-cat"><input type="number" step="0.01" data-f="income_rent_eur"   value="${ev.income_rent_eur   || ''}"></td>
      <td class="num col-cat"><input type="number" step="0.01" data-f="income_drinks_eur" value="${ev.income_drinks_eur || ''}"></td>
      <td class="num col-cat"><input type="number" step="0.01" data-f="income_addons_eur" value="${ev.income_addons_eur || ''}"></td>
      <td class="num">${fmtEur(total)}</td>
      <td class="num col-bgn">${fmtBgn(total * BGN_RATE)}</td>
      <td class="pay-col"><input type="date" data-f="deposit_date" value="${ev.deposit_date || ''}"></td>
      <td class="num pay-col"><input type="number" step="0.01" data-f="deposit_cash_eur" value="${ev.deposit_cash_eur || ''}"></td>
      <td class="num pay-col"><input type="number" step="0.01" data-f="deposit_bank_eur" value="${ev.deposit_bank_eur || ''}"></td>
      <td class="pay-col"><input type="date" data-f="balance_date" value="${ev.balance_date || ''}"></td>
      <td class="num pay-col"><input type="number" step="0.01" data-f="balance_cash_eur" value="${ev.balance_cash_eur || ''}"></td>
      <td class="num pay-col"><input type="number" step="0.01" data-f="balance_bank_eur" value="${ev.balance_bank_eur || ''}"></td>
      <td class="actions-col"><div class="row-actions">
        <button type="button" class="btn-link-event ${ev.enquiry_id ? 'is-linked' : ''}" data-link-event="${esc(ev.id)}" title="${esc(linkTitle)}">🔗</button>
        <button type="button" class="del-btn" data-del-event="${esc(ev.id)}" title="Изтрий">×</button>
      </div></td>
    </tr>
  `;
}

function expenseRowHtml(ex) {
  const opts = EXPENSE_CATS.map(c =>
    `<option value="${c.id}" ${ex.category === c.id ? 'selected' : ''}>${esc(c.label)}</option>`
  ).join('');
  return `
    <tr data-id="${esc(ex.id)}" data-cat="${esc(ex.category || 'other')}">
      <td><input type="date" data-f="expense_date" value="${ex.expense_date || ''}"></td>
      <td><select data-f="category">${opts}</select></td>
      <td><input type="text" data-f="description" value="${esc(ex.description || '')}"></td>
      <td class="num"><input type="number" step="0.01" data-f="amount_eur" value="${ex.amount_eur || ''}"></td>
      <td class="num col-bgn">${fmtBgn((Number(ex.amount_eur) || 0) * BGN_RATE)}</td>
      <td><button class="del-btn" data-del-expense="${esc(ex.id)}" title="Изтрий">×</button></td>
    </tr>
  `;
}

function renderEvents() {
  const body = document.getElementById('events-body');
  const cnt = document.getElementById('events-count');
  if (cnt) cnt.textContent = events.length;
  if (body) {
    body.innerHTML =
      events.length ? events.map(eventRowHtml).join('')
                    : `<tr><td colspan="15" style="text-align:center;color:#999;padding:18px">Няма записи. Добавете от списъка отгоре или ръчно.</td></tr>`;
  }
  recalcTotals();
}

function renderExpenses() {
  const body = document.getElementById('expenses-body');
  const cnt = document.getElementById('expenses-count');
  if (cnt) cnt.textContent = expenses.length;
  if (body) {
    body.innerHTML =
      expenses.length ? expenses.map(expenseRowHtml).join('')
                      : `<tr><td colspan="6" style="text-align:center;color:#999;padding:18px">Няма записи.</td></tr>`;
  }
  recalcTotals();
}

function recalcTotals() {
  let rent = 0, drinks = 0, addons = 0;
  let depCash = 0, depBank = 0, balCash = 0, balBank = 0;
  events.forEach(e => {
    rent    += Number(e.income_rent_eur  || 0);
    drinks  += Number(e.income_drinks_eur|| 0);
    addons  += Number(e.income_addons_eur|| 0);
    depCash += Number(e.deposit_cash_eur || 0);
    depBank += Number(e.deposit_bank_eur || 0);
    balCash += Number(e.balance_cash_eur || 0);
    balBank += Number(e.balance_bank_eur || 0);
  });
  const incomeEur = rent + drinks + addons;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('ev-tot-rent',   fmtEur(rent));
  set('ev-tot-drinks', fmtEur(drinks));
  set('ev-tot-addons', fmtEur(addons));
  set('ev-tot-eur',    fmtEur(incomeEur));
  set('ev-tot-bgn',    fmtBgn(incomeEur * BGN_RATE));
  set('ev-tot-dep-cash', fmtEur(depCash));
  set('ev-tot-dep-bank', fmtEur(depBank));
  set('ev-tot-bal-cash', fmtEur(balCash));
  set('ev-tot-bal-bank', fmtEur(balBank));

  const expenseEur = expenses.reduce((s, x) => s + Number(x.amount_eur || 0), 0);
  set('ex-tot-eur', fmtEur(expenseEur));
  set('ex-tot-bgn', fmtBgn(expenseEur * BGN_RATE));

  const profitEur = incomeEur - expenseEur;
  set('sum-income-eur',   fmtEur(incomeEur));
  set('sum-income-bgn',   fmtBgn(incomeEur * BGN_RATE));
  set('sum-expense-eur',  fmtEur(expenseEur));
  set('sum-expense-bgn',  fmtBgn(expenseEur * BGN_RATE));
  set('sum-profit-eur',   fmtEur(profitEur));
  set('sum-profit-bgn',   fmtBgn(profitEur * BGN_RATE));
  const profitEl = document.getElementById('sum-profit-eur');
  if (profitEl) profitEl.className = 'kpi__value ' + (profitEur >= 0 ? 'is-positive' : 'is-negative');
  set('sum-taxable-eur',  fmtEur(profitEur));
  set('sum-taxable-bgn',  fmtBgn(profitEur * BGN_RATE));

  // Summary page nav-card mirrors
  set('nav-income-total', fmtEur(incomeEur));
  set('nav-income-count', String(events.length));
  set('nav-income-pending', String(pendingEnquiries().length));
  set('nav-expenses-total', fmtEur(expenseEur));
  set('nav-expenses-count', String(expenses.length));
  // Forward the current month to the detail pages so they open on the same window.
  const navIncome = document.getElementById('nav-income');
  const navExpenses = document.getElementById('nav-expenses');
  if (navIncome   && currentMonth) navIncome.href   = `financials-income.html?month=${encodeURIComponent(currentMonth)}`;
  if (navExpenses && currentMonth) navExpenses.href = `financials-expenses.html?month=${encodeURIComponent(currentMonth)}`;

  // Category breakdown pills
  const incomeCatBreakdown = document.getElementById('income-cat-breakdown');
  const expenseCatBreakdown = document.getElementById('expense-cat-breakdown');
  const incomeCats = { rent, drinks, addons };
  if (incomeCatBreakdown) incomeCatBreakdown.innerHTML = INCOME_CATS.map(c => `
    <div class="pill" data-cat="${esc(c.id)}">
      <div class="pill__label">${esc(c.label)}</div>
      <div class="pill__value">${fmtEur(incomeCats[c.id])}</div>
      <div class="pill__sub">${fmtBgn(incomeCats[c.id] * BGN_RATE)}${incomeEur ? ` <span class="pill__pct">${Math.round(incomeCats[c.id] / incomeEur * 100)}%</span>` : ''}</div>
    </div>
  `).join('');

  const expenseCatTotals = {};
  EXPENSE_CATS.forEach(c => expenseCatTotals[c.id] = 0);
  expenses.forEach(x => { expenseCatTotals[x.category || 'other'] = (expenseCatTotals[x.category || 'other'] || 0) + Number(x.amount_eur || 0); });
  if (expenseCatBreakdown) {
    expenseCatBreakdown.innerHTML = EXPENSE_CATS
      .filter(c => expenseCatTotals[c.id] > 0)
      .map(c => `
        <div class="pill" data-cat="${esc(c.id)}">
          <div class="pill__label">${esc(c.label)}</div>
          <div class="pill__value">${fmtEur(expenseCatTotals[c.id])}</div>
          <div class="pill__sub">${fmtBgn(expenseCatTotals[c.id] * BGN_RATE)}${expenseEur ? ` <span class="pill__pct">${Math.round(expenseCatTotals[c.id] / expenseEur * 100)}%</span>` : ''}</div>
        </div>
      `).join('') || '<div class="empty-state">Няма разходи в този месец.</div>';
  }
}

// ────────────────────────────────────────────────────────────────────────
// Persistence
// ────────────────────────────────────────────────────────────────────────

function showError(msg, err) {
  console.error(msg, err);
  showToast(msg + (err?.message ? ': ' + err.message : ''), 'error');
}

// On-page status toast so users see feedback even if console is closed and
// alerts are blocked (Safari has aggressive alert suppression on some pages).
function showToast(msg, kind) {
  let host = document.getElementById('fin-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'fin-toast-host';
    host.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:380px;';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  const bg = kind === 'error' ? '#dc2626' : (kind === 'ok' ? '#16a34a' : '#0a0a0a');
  t.style.cssText = `padding:12px 16px;border-radius:8px;background:${bg};color:#fff;font:500 0.875rem/1.4 'Inter',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.18);opacity:0;transform:translateY(-8px);transition:opacity .2s,transform .2s;`;
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-8px)'; setTimeout(() => t.remove(), 250); }, 3800);
}

async function loadMonth(month) {
  currentMonth = month;
  document.getElementById('fin-month').value = month;
  const [{ data: ev, error: evErr }, { data: ex, error: exErr }] = await Promise.all([
    db.from('financial_events').select('*').eq('month', month).order('event_date', { ascending: true }),
    db.from('financial_expenses').select('*').eq('month', month).order('expense_date', { ascending: true }),
  ]);
  if (evErr) showError('Грешка при зареждане на събитията', evErr);
  if (exErr) showError('Грешка при зареждане на разходите', exErr);
  events = ev || [];
  expenses = ex || [];
  renderPending();
  renderEvents();
  renderExpenses();
}

async function promoteEnquiry(enquiryId) {
  const e = allEnquiries.find(x => x.id === enquiryId);
  if (!e) return;
  const b = enquiryBreakdown(e);
  const row = {
    month: currentMonth,
    event_date: parsePreferredDate(e.preferred_date),
    customer_name: e.full_name || '—',
    offer_total_eur: estimateEnquiryTotal(e),
    income_rent_eur:   b.rent,
    income_drinks_eur: b.drinks,
    income_addons_eur: b.addons,
    enquiry_id: e.id,
    confirmed_by: userEmail,
    confirmed_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('financial_events').insert(row).select().single();
  if (error) { showError('Грешка при добавяне на ред', error); return; }
  events.push(data);
  renderPending(); renderEvents();
}

async function addManualEvent() {
  console.log('[fin] addManualEvent called', { currentMonth, hasDb: !!window.db });
  showToast('Добавяне на ред…');
  if (!currentMonth) { showError('Първо изберете месец', { message: 'currentMonth е празен' }); return; }
  const row = {
    month: currentMonth,
    customer_name: '',
    offer_total_eur: 0,
    income_rent_eur: 0, income_drinks_eur: 0, income_addons_eur: 0,
    confirmed_by: userEmail,
    confirmed_at: new Date().toISOString(),
  };
  try {
    const { data, error } = await db.from('financial_events').insert(row).select().single();
    if (error) { showError('Грешка при добавяне на ред', error); return; }
    events.push(data);
    renderEvents();
    showToast('Редът е добавен', 'ok');
  } catch (err) {
    showError('Неочаквана грешка', err);
  }
}
window.addManualEvent = addManualEvent;

async function addManualExpense() {
  console.log('[fin] addManualExpense called', { currentMonth, hasDb: !!window.db });
  showToast('Добавяне на разход…');
  if (!currentMonth) { showError('Първо изберете месец', { message: 'currentMonth е празен' }); return; }
  const row = { month: currentMonth, description: '', amount_eur: 0, category: 'other' };
  try {
    const { data, error } = await db.from('financial_expenses').insert(row).select().single();
    if (error) { showError('Грешка при добавяне на разход', error); return; }
    expenses.push(data);
    renderExpenses();
    showToast('Разходът е добавен', 'ok');
  } catch (err) {
    showError('Неочаквана грешка', err);
  }
}
window.addManualExpense = addManualExpense;

async function deleteEvent(id) {
  if (!confirm('Изтриване на този ред?')) return;
  const { error } = await db.from('financial_events').delete().eq('id', id);
  if (error) { showError('Грешка при изтриване', error); return; }
  events = events.filter(x => x.id !== id);
  renderPending(); renderEvents();
}

async function deleteExpense(id) {
  if (!confirm('Изтриване на този разход?')) return;
  const { error } = await db.from('financial_expenses').delete().eq('id', id);
  if (error) { showError('Грешка при изтриване', error); return; }
  expenses = expenses.filter(x => x.id !== id);
  renderExpenses();
}

// ── Enquiry picker modal ──────────────────────────────────────────────
// Two modes:
//   'link'   — invoked by per-row 🔗 button. Updates an existing
//              financial_events row to point at a chosen enquiry and
//              refills its breakdown. Lists confirmed/completed only.
//   'import' — invoked by the top-level "Импортирай от запитване"
//              button. Creates a brand-new financial_events row for the
//              chosen enquiry. Lists ALL enquiries (the bookkeeper
//              decides whether to import — they know if the event
//              happened, regardless of pipeline status).
let modalMode = null;       // 'link' | 'import' | null
let linkingEventId = null;  // only used in 'link' mode

function setModalTitle(text) {
  const el = document.getElementById('link-modal-title');
  if (el) el.textContent = text;
}

function openLinkModal(eventId) {
  const modal = document.getElementById('link-modal');
  if (!modal) return;
  modalMode = 'link';
  linkingEventId = eventId;
  setModalTitle('Свържи с минало събитие');
  modal.hidden = false;
  renderLinkModalList('');
  const search = document.getElementById('link-modal-search');
  if (search) { search.value = ''; search.focus(); }
}

function openImportModal() {
  const modal = document.getElementById('link-modal');
  if (!modal) return;
  modalMode = 'import';
  linkingEventId = null;
  setModalTitle('Импортирай от запитване');
  modal.hidden = false;
  renderLinkModalList('');
  const search = document.getElementById('link-modal-search');
  if (search) { search.value = ''; search.focus(); }
}
window.openImportModal = openImportModal;

function closeLinkModal() {
  const modal = document.getElementById('link-modal');
  if (!modal) return;
  modal.hidden = true;
  modalMode = null;
  linkingEventId = null;
}

function renderLinkModalList(q) {
  const list = document.getElementById('link-modal-list');
  if (!list) return;
  const needle = (q || '').trim().toLowerCase();
  // Both modes: confirmed/completed only AND the event date must be
  // blocked on the calendar (i.e. present in occupied_dates). That mirrors
  // the manager's mental model — "an enquiry exists in the books iff it's
  // a real booking on the calendar".
  const STAGE_RANK = { completed: 0, confirmed: 1, quoted: 2, contacted: 3, new: 4, lost: 5, archived: 6 };
  let pool = allEnquiries.filter(e => {
    if (!['confirmed', 'completed'].includes(e.pipeline_status)) return false;
    const iso = parsePreferredDate(e.preferred_date);
    return iso && occupiedDateSet.has(iso);
  });
  if (modalMode === 'import') {
    pool.sort((a, b) => (STAGE_RANK[a.pipeline_status] ?? 9) - (STAGE_RANK[b.pipeline_status] ?? 9));
  }
  const matches = needle
    ? pool.filter(e =>
        (e.full_name || '').toLowerCase().includes(needle) ||
        (e.event_type || '').toLowerCase().includes(needle) ||
        (e.preferred_date || '').includes(needle))
    : pool;
  if (!matches.length) {
    list.innerHTML = `<div class="empty-state">Няма съвпадения.</div>`;
    return;
  }
  list.innerHTML = matches.slice(0, 80).map(e => `
    <button type="button" class="link-modal__item" data-link-pick="${esc(e.id)}">
      <span class="name">${esc(e.full_name || '—')}</span>
      <span class="meta">${esc(e.preferred_date || '')} · ${esc(e.event_type || '')}</span>
      <span class="stage">${esc(e.pipeline_status)}</span>
    </button>
  `).join('');
}

async function pickLinkTarget(enquiryId) {
  const e = allEnquiries.find(x => x.id === enquiryId);
  if (!e) return;
  const b = enquiryBreakdown(e);

  if (modalMode === 'import') {
    // Create a brand-new financial_events row for the chosen enquiry,
    // using the enquiry's preferred_date to determine the month.
    const evDate = parsePreferredDate(e.preferred_date);
    const month = evDate ? evDate.slice(0, 7) : currentMonth;
    const row = {
      month,
      event_date: evDate,
      customer_name: e.full_name || '',
      offer_total_eur: estimateEnquiryTotal(e),
      income_rent_eur:   b.rent,
      income_drinks_eur: b.drinks,
      income_addons_eur: b.addons,
      enquiry_id: e.id,
      confirmed_by: userEmail,
      confirmed_at: new Date().toISOString(),
    };
    const { data, error } = await db.from('financial_events').insert(row).select().single();
    if (error) { showError('Грешка при импортиране', error); return; }
    closeLinkModal();
    // Jump to the imported row's month so the manager sees it immediately
    // instead of wondering where it went.
    if (data.month !== currentMonth) {
      showToast(`Превключване към ${data.month}`, 'ok');
      await loadMonth(data.month);
    } else {
      events.push(data);
      renderPending(); renderEvents();
      showToast('Импортирано в текущия месец', 'ok');
    }
    return;
  }

  // 'link' mode — update an existing row to point at the chosen enquiry.
  if (!linkingEventId) return;
  const patch = {
    enquiry_id: e.id,
    customer_name: e.full_name || '',
    event_date: parsePreferredDate(e.preferred_date),
    offer_total_eur: estimateEnquiryTotal(e),
    income_rent_eur:   b.rent,
    income_drinks_eur: b.drinks,
    income_addons_eur: b.addons,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('financial_events').update(patch).eq('id', linkingEventId);
  if (error) { showError('Грешка при свързване', error); return; }
  const ev = events.find(x => x.id === linkingEventId);
  if (ev) Object.assign(ev, patch);
  showToast('Редът е свързан със събитието', 'ok');
  closeLinkModal();
  renderPending(); renderEvents();
}

function bindInlineEdit() {
  const eventsBody = document.getElementById('events-body');
  const expensesBody = document.getElementById('expenses-body');
  eventsBody?.addEventListener('change', async evt => {
    const inp = evt.target.closest('[data-f]');
    if (!inp) return;
    const tr = inp.closest('tr[data-id]');
    const id = tr.dataset.id;
    const field = inp.dataset.f;
    let value = inp.value;
    if (inp.tagName === 'INPUT' && inp.type === 'number') value = value === '' ? 0 : Number(value);
    if (inp.tagName === 'INPUT' && inp.type === 'date')   value = value || null;
    inp.disabled = true;
    const patch = { [field]: value, updated_at: new Date().toISOString() };
    const { error } = await db.from('financial_events').update(patch).eq('id', id);
    inp.disabled = false;
    if (error) { showError('Грешка при запис', error); inp.style.outline = '2px solid #c62828'; setTimeout(() => inp.style.outline = '', 1500); return; }
    const ev = events.find(x => x.id === id);
    if (ev) ev[field] = value;
    // Recalc per-row total cells. New column layout:
    // 0:#  1:client  2:date  3:Оферта  4:Напитки  5:Доп.услуги  6:Общо€  7:Общолв
    const total = eventTotalEur(ev);
    tr.children[6].textContent = fmtEur(total);
    tr.children[7].textContent = fmtBgn(total * BGN_RATE);
    recalcTotals();
  });

  expensesBody?.addEventListener('change', async evt => {
    const inp = evt.target.closest('[data-f]');
    if (!inp) return;
    const tr = inp.closest('tr[data-id]');
    const id = tr.dataset.id;
    const field = inp.dataset.f;
    let value = inp.value;
    if (inp.tagName === 'INPUT' && inp.type === 'number') value = value === '' ? 0 : Number(value);
    if (inp.tagName === 'INPUT' && inp.type === 'date')   value = value || null;
    inp.disabled = true;
    const patch = { [field]: value, updated_at: new Date().toISOString() };
    const { error } = await db.from('financial_expenses').update(patch).eq('id', id);
    inp.disabled = false;
    if (error) { showError('Грешка при запис', error); inp.style.outline = '2px solid #c62828'; setTimeout(() => inp.style.outline = '', 1500); return; }
    const ex = expenses.find(x => x.id === id);
    if (ex) ex[field] = value;
    if (field === 'amount_eur') tr.children[4].textContent = fmtBgn((Number(value) || 0) * BGN_RATE);
    recalcTotals();
  });
}

// ────────────────────────────────────────────────────────────────────────
// XLSX export — template layout + category breakdown block
// ────────────────────────────────────────────────────────────────────────

function exportXlsx() {
  if (!window.XLSX) { alert('XLSX library не е заредена.'); return; }
  // Columns mirror the original Excel template, plus a category breakdown
  // block to the right of the expenses block (Оферта / Напитки / Доп.услуги).
  // The legacy "Друго €" category is no longer shown — the income split is
  // 3 categories only.
  const header = [
    'бр. събития', '', ' дата на събитие', 'клиент', 'сума по оферта',
    'дата на плащане', 'платено в брой аванс', 'платено  аванс по банка ', '',
    'дата на плащане', 'доплащане в брой', 'платено по банка ',
    'В €', 'в лв', '', '',
    'дата', 'категория', 'описание др. Разходи', 'други разходи сума лв', '', 'в €',
    '', 'Оферта €', 'Напитки €', 'Доп. услуги €',
  ];
  const dataRows = Math.max(events.length, expenses.length, 25);
  const aoa = [header];
  for (let i = 0; i < dataRows; i++) {
    const ev = events[i] || {};
    const ex = expenses[i] || {};
    const r = new Array(26).fill(null);
    r[0]  = i + 1;
    r[2]  = ev.event_date     ? new Date(ev.event_date)     : null;
    r[3]  = ev.customer_name  || null;
    // Column E "сума по оферта" is now the live total (rent+drinks+addons)
    r[4]  = (Number(ev.income_rent_eur || 0) + Number(ev.income_drinks_eur || 0) + Number(ev.income_addons_eur || 0)) || null;
    r[5]  = ev.deposit_date   ? new Date(ev.deposit_date)   : null;
    r[6]  = ev.deposit_cash_eur ?? null;
    r[7]  = ev.deposit_bank_eur ?? null;
    r[9]  = ev.balance_date   ? new Date(ev.balance_date)   : null;
    r[10] = ev.balance_cash_eur ?? null;
    r[11] = ev.balance_bank_eur ?? null;
    r[16] = ex.expense_date   ? new Date(ex.expense_date)   : null;
    r[17] = ex.category ? (EXPENSE_CAT_LABEL[ex.category] || ex.category) : null;
    r[18] = ex.description    || null;
    r[20] = ex.amount_eur ?? null;
    // Category breakdown columns X-Z (23-25) for events
    r[23] = ev.income_rent_eur   ?? null;
    r[24] = ev.income_drinks_eur ?? null;
    r[25] = ev.income_addons_eur ?? null;
    aoa.push(r);
  }

  const totalsRow = dataRows + 2;
  aoa.push(new Array(26).fill(null));

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (let i = 1; i <= dataRows; i++) {
    const r = i + 1;
    ws[`M${r}`] = { t: 'n', f: `X${r}+Y${r}+Z${r}` };
    ws[`N${r}`] = { t: 'n', f: `M${r}*${BGN_RATE}` };
    ws[`T${r}`] = { t: 'n', f: `V${r}*${BGN_RATE}` };
  }
  const tr = totalsRow;
  ws[`E${tr}`] = { t: 'n', f: `SUM(E2:E${dataRows + 1})` };
  ws[`G${tr}`] = { t: 'n', f: `SUM(G2:G${dataRows + 1})` };
  ws[`H${tr}`] = { t: 'n', f: `SUM(H2:H${dataRows + 1})` };
  ws[`K${tr}`] = { t: 'n', f: `SUM(K2:K${dataRows + 1})` };
  ws[`L${tr}`] = { t: 'n', f: `SUM(L2:L${dataRows + 1})` };
  ws[`X${tr}`] = { t: 'n', f: `SUM(X2:X${dataRows + 1})` };
  ws[`Y${tr}`] = { t: 'n', f: `SUM(Y2:Y${dataRows + 1})` };
  ws[`Z${tr}`] = { t: 'n', f: `SUM(Z2:Z${dataRows + 1})` };
  ws[`M${tr}`] = { t: 'n', f: `X${tr}+Y${tr}+Z${tr}` };
  ws[`N${tr}`] = { t: 'n', f: `M${tr}*${BGN_RATE}` };
  ws[`V${tr}`] = { t: 'n', f: `SUM(V2:V${dataRows + 1})` };
  ws[`T${tr}`] = { t: 'n', f: `V${tr}*${BGN_RATE}` };

  // Summary block immediately after totals row
  const ss = tr + 2;
  ws[`D${ss}`]   = { t: 's', v: 'приходи' };
  ws[`E${ss}`]   = { t: 'n', f: `M${tr}` };
  ws[`F${ss}`]   = { t: 'n', f: `N${tr}` };
  ws[`D${ss+1}`] = { t: 's', v: 'разходи' };
  ws[`E${ss+1}`] = { t: 'n', f: `V${tr}` };
  ws[`F${ss+1}`] = { t: 'n', f: `T${tr}` };
  ws[`D${ss+2}`] = { t: 's', v: 'печалба' };
  ws[`E${ss+2}`] = { t: 'n', f: `E${ss}-E${ss+1}` };
  ws[`F${ss+2}`] = { t: 'n', f: `F${ss}-F${ss+1}` };
  ws[`D${ss+3}`] = { t: 's', v: 'облагане заплата' };
  ws[`E${ss+3}`] = { t: 'n', f: `E${ss+2}` };
  ws[`F${ss+3}`] = { t: 'n', f: `F${ss+2}` };

  ws['!cols'] = [
    { wch: 9 }, { wch: 1 }, { wch: 12 }, { wch: 22 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 1 },
    { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 1 }, { wch: 1 },
    { wch: 11 }, { wch: 18 }, { wch: 32 }, { wch: 14 }, { wch: 1 }, { wch: 10 },
    { wch: 1 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const [y, m] = currentMonth.split('-');
  XLSX.writeFile(wb, `Отчет ${m}.${y}.xlsx`);
}

// ────────────────────────────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────────────────────────────

// ── Boot ──
// Click handlers are bound at the document level via delegation BEFORE the
// async auth/data load so they fire even if part of the init throws later.
// This was the symptom on the last build: an early error left the per-
// element listeners unwired and the +Add buttons silently did nothing.
document.addEventListener('click', evt => {
  if (evt.target.closest('#btn-add-event'))     { addManualEvent(); return; }
  if (evt.target.closest('#btn-add-expense'))   { addManualExpense(); return; }
  if (evt.target.closest('#btn-export-xlsx'))   { exportXlsx(); return; }
  if (evt.target.closest('#btn-toggle-pay')) {
    const table = document.getElementById('events-table');
    if (!table) return;
    table.classList.toggle('show-pay');
    const btn = evt.target.closest('#btn-toggle-pay');
    if (btn) btn.textContent = table.classList.contains('show-pay')
      ? 'Скрий разбивка по плащане'
      : 'Покажи разбивка по плащане';
    return;
  }
  const promote = evt.target.closest('[data-promote]');
  if (promote) { promoteEnquiry(promote.getAttribute('data-promote')); return; }
  const delEv = evt.target.closest('[data-del-event]');
  if (delEv)   { deleteEvent(delEv.getAttribute('data-del-event')); return; }
  const delEx = evt.target.closest('[data-del-expense]');
  if (delEx)   { deleteExpense(delEx.getAttribute('data-del-expense')); return; }
  const linkEv = evt.target.closest('[data-link-event]');
  if (linkEv)  { openLinkModal(linkEv.getAttribute('data-link-event')); return; }
  const linkPick = evt.target.closest('[data-link-pick]');
  if (linkPick) { pickLinkTarget(linkPick.getAttribute('data-link-pick')); return; }
  if (evt.target.closest('[data-close-modal]')) { closeLinkModal(); return; }
});

document.addEventListener('input', evt => {
  if (evt.target.id === 'link-modal-search') renderLinkModalList(evt.target.value);
});
document.addEventListener('keydown', evt => {
  if (evt.key === 'Escape') closeLinkModal();
});

document.addEventListener('change', evt => {
  if (evt.target.id === 'fin-month') loadMonth(evt.target.value);
});

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;
  userEmail = session.user?.email || null;

  // ?month=YYYY-MM in the URL wins (so navigating between summary and
  // detail pages stays on the same month). Otherwise default to the
  // previous calendar month — events get reconciled the month after.
  const urlParams = new URLSearchParams(location.search);
  const urlMonth = urlParams.get('month');
  if (urlMonth && /^\d{4}-\d{2}$/.test(urlMonth)) {
    currentMonth = urlMonth;
  } else {
    const now = new Date();
    const def = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    currentMonth = isoMonth(def);
  }
  const monthInput = document.getElementById('fin-month');
  if (monthInput) monthInput.value = currentMonth;

  const [{ data: enq, error }, { data: occ, error: occErr }] = await Promise.all([
    db.from('enquiries').select('id,full_name,preferred_date,event_type,event_id,pipeline_status,addons,drinks,applied_discount_percent,guests'),
    db.from('occupied_dates').select('date'),
  ]);
  if (error) { showError('Грешка при зареждане на запитванията', error); }
  if (occErr) { showError('Грешка при зареждане на заетите дати', occErr); }
  allEnquiries = enq || [];
  occupiedDateSet = new Set((occ || []).map(r => r.date));

  await loadMonth(currentMonth);
  bindInlineEdit();
});

function rerenderPage() { renderPending(); renderEvents(); renderExpenses(); }
