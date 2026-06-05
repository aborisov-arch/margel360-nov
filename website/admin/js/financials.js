// Financials — per-event P&L only.
//
// The standalone "Приходи" and "Разходи" pages were removed in favor of
// this view: every income figure is auto-derived from the matching
// enquiry (so the bookkeeper can't fall out of sync with what the
// customer was quoted), and every expense is attached to a specific
// event so we can answer questions like "how much did we pay the DJ for
// the Wedding on the 14th?".
//
// Event source: confirmed/completed enquiries whose preferred_date is
// blocked on the calendar. A matching financial_events row is created
// lazily the first time an event is selected — that row stores payment
// tracking (deposits + balance) and serves as the FK target for
// financial_expenses.event_id.
//
// All amounts in EUR. BGN derived via the fixed peg 1.95583.

const BGN_RATE = 1.95583;

// Same EVENT_BASE + guest fee constants used by reservation.js /
// dashboard.js / enquiry-email.ts. Keep in sync.
const EVENT_BASE = { evening: 1280, wedding: 1500, corp4: 330, corp8: 440, bday_day: 700, bday_eve: 970 };
const VENUE_MIN_GUESTS = 40;
const EXTRA_GUEST_FEE_EUR = 15;

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

// Mirrors the public-side total calculation used in reservation.js so
// imported figures match the customer's offer down to the cent.
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
let financialEventsById = new Map(); // financial_events.id → row
let financialEventByEnquiryId = new Map(); // enquiries.id → financial_events row
let expensesByEvent = new Map();     // financial_events.id → expense rows
let bookableEvents = [];             // enquiries that count as "events"
let selectedEnquiryId = null;
let userEmail = null;
// Month filter — '' = all months. Format: YYYY-MM.
let monthFilter = '';

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

// ────────────────────────────────────────────────────────────────
// Data loading
// ────────────────────────────────────────────────────────────────

async function loadAll() {
  const [
    { data: enq, error: enqErr },
    { data: occ, error: occErr },
    { data: fev, error: fevErr },
    { data: exp, error: expErr },
  ] = await Promise.all([
    db.from('enquiries').select('id,full_name,preferred_date,event_type,event_id,pipeline_status,addons,drinks,applied_discount_percent,guests'),
    db.from('occupied_dates').select('date'),
    db.from('financial_events').select('*'),
    db.from('financial_expenses').select('*').not('event_id', 'is', null),
  ]);
  if (enqErr) console.error(enqErr);
  if (occErr) console.error(occErr);
  if (fevErr) console.error(fevErr);
  if (expErr) console.error(expErr);

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

  // The event list = confirmed/completed enquiries with a locked date.
  // Anything else isn't a real booking — don't surface it in financials.
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

// Find or lazily create the financial_events row for an enquiry. We
// avoid creating rows for every enquiry on boot — only when the
// bookkeeper actually opens one in this view.
async function ensureFinancialEvent(enquiry) {
  let row = financialEventByEnquiryId.get(enquiry.id);
  if (row) return row;
  const b = enquiryBreakdown(enquiry);
  const iso = parsePreferredDate(enquiry.preferred_date);
  const month = iso ? iso.slice(0, 7) : null;
  const insertRow = {
    month,
    event_date: iso,
    customer_name: enquiry.full_name || '',
    offer_total_eur: b.rent + b.drinks + b.addons,
    income_rent_eur:   b.rent,
    income_drinks_eur: b.drinks,
    income_addons_eur: b.addons,
    enquiry_id: enquiry.id,
    confirmed_by: userEmail,
    confirmed_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('financial_events').insert(insertRow).select().single();
  if (error) { console.error('ensureFinancialEvent insert failed', error); return null; }
  financialEventsById.set(data.id, data);
  financialEventByEnquiryId.set(enquiry.id, data);
  return data;
}

// ────────────────────────────────────────────────────────────────
// Left rail — list of events
// ────────────────────────────────────────────────────────────────

function eventIncome(e) {
  const b = enquiryBreakdown(e);
  return b.rent + b.drinks + b.addons;
}
function eventExpenseTotal(enquiry) {
  const fe = financialEventByEnquiryId.get(enquiry.id);
  if (!fe) return 0;
  const rows = expensesByEvent.get(fe.id) || [];
  return rows.reduce((s, x) => s + Number(x.amount_eur || 0), 0);
}
function eventPaidTotal(enquiry) {
  const fe = financialEventByEnquiryId.get(enquiry.id);
  if (!fe) return 0;
  return Number(fe.deposit_cash_eur || 0)
       + Number(fe.deposit_bank_eur || 0)
       + Number(fe.balance_cash_eur || 0)
       + Number(fe.balance_bank_eur || 0);
}

function renderEventsList(filter = '') {
  const wrap = document.getElementById('events-list');
  const cnt  = document.getElementById('events-list-count');
  const needle = filter.trim().toLowerCase();
  const monthScoped = filteredEvents();
  const matches = needle
    ? monthScoped.filter(e => (e.full_name || '').toLowerCase().includes(needle))
    : monthScoped;
  if (cnt) cnt.textContent = matches.length;
  if (!matches.length) {
    wrap.innerHTML = '<div class="empty-state">Няма потвърдени събития със заети дати.</div>';
    return;
  }
  wrap.innerHTML = matches.map(e => {
    const income  = eventIncome(e);
    const expense = eventExpenseTotal(e);
    const net = income - expense;
    const margin = income > 0 ? Math.round((net / income) * 100) : null;
    const selected = e.id === selectedEnquiryId ? ' is-selected' : '';
    const marginClass = margin == null ? '' : (margin >= 0 ? ' is-positive' : ' is-negative');
    const iso = parsePreferredDate(e.preferred_date);
    return `
      <button type="button" class="event-pnl__event${selected}" data-enquiry="${esc(e.id)}">
        <div class="event-pnl__event-name">${esc(e.full_name || '—')}</div>
        <div class="event-pnl__event-meta">${fmtDateBg(iso)} · ${fmtEur(income)}</div>
        <div class="event-pnl__event-margin${marginClass}">${margin == null ? '—' : margin + '%'}</div>
      </button>
    `;
  }).join('');
}

// ────────────────────────────────────────────────────────────────
// Monthly summary
// ────────────────────────────────────────────────────────────────

function renderMonthSummary() {
  const scope = filteredEvents();
  let income = 0, drinks = 0, addons = 0, rent = 0;
  let paid = 0, expense = 0;
  const expByCat = Object.fromEntries(EXPENSE_CATS.map(c => [c.id, 0]));

  scope.forEach(e => {
    const b = enquiryBreakdown(e);
    rent += b.rent; drinks += b.drinks; addons += b.addons;
    income += b.rent + b.drinks + b.addons;
    paid   += eventPaidTotal(e);
    const fe = financialEventByEnquiryId.get(e.id);
    if (fe) {
      const rows = expensesByEvent.get(fe.id) || [];
      rows.forEach(x => {
        const amt = Number(x.amount_eur || 0);
        expense += amt;
        expByCat[x.category || 'other'] = (expByCat[x.category || 'other'] || 0) + amt;
      });
    }
  });

  const profit = income - expense;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('sum-month-label', monthLabel(monthFilter));
  set('sum-count',       `${scope.length} ${scope.length === 1 ? 'събитие' : 'събития'}`);
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

  const incomeCats = { rent, drinks, addons };
  const INCOME_LABELS = [
    { id: 'rent',   label: 'Оферта' },
    { id: 'drinks', label: 'Напитки' },
    { id: 'addons', label: 'Доп. услуги' },
  ];
  const incomeBreak = document.getElementById('income-cat-breakdown');
  if (incomeBreak) {
    incomeBreak.innerHTML = INCOME_LABELS.map(c => `
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
// Right detail — P&L
// ────────────────────────────────────────────────────────────────

function renderDetail() {
  const placeholder = document.getElementById('pnl-placeholder');
  const body = document.getElementById('pnl-body');
  if (!selectedEnquiryId) { placeholder.hidden = false; body.hidden = true; return; }
  const enquiry = allEnquiries.find(e => e.id === selectedEnquiryId);
  if (!enquiry) { placeholder.hidden = false; body.hidden = true; return; }
  placeholder.hidden = true;
  body.hidden = false;

  const fe = financialEventByEnquiryId.get(enquiry.id);
  const b = enquiryBreakdown(enquiry);
  const income = b.rent + b.drinks + b.addons;
  const expense = eventExpenseTotal(enquiry);
  const paid = eventPaidTotal(enquiry);
  const balance = income - paid;
  const net = income - expense;
  const margin = income > 0 ? Math.round((net / income) * 100) : null;

  document.getElementById('pnl-customer').textContent = enquiry.full_name || '—';
  document.getElementById('pnl-date').textContent     = fmtDateBg(parsePreferredDate(enquiry.preferred_date));
  document.getElementById('pnl-event-type').textContent = enquiry.event_type || '—';
  document.getElementById('pnl-guests').textContent   = (enquiry.guests != null ? enquiry.guests + ' гости' : '—');
  document.getElementById('pnl-income-total').textContent = fmtEur(income);
  document.getElementById('pnl-expense-total').textContent = fmtEur(expense);
  document.getElementById('pnl-paid-total').textContent = fmtEur(paid);
  document.getElementById('pnl-balance').textContent = fmtEur(balance);
  document.getElementById('pnl-net-eur').textContent = fmtEur(net);
  document.getElementById('pnl-net-bgn').textContent = fmtBgn(net * BGN_RATE);
  const marginEl = document.getElementById('pnl-margin');
  marginEl.textContent = margin == null ? '—' : margin + '%';
  marginEl.className = 'event-pnl__hero-val ' + (margin == null ? '' : (margin >= 0 ? 'is-positive' : 'is-negative'));

  // Income breakdown — derived from enquiry. Read-only.
  document.getElementById('pnl-income-lines').innerHTML = [
    { lbl: 'Оферта (зала + гости)', val: b.rent },
    { lbl: 'Напитки',                val: b.drinks },
    { lbl: 'Доп. услуги',            val: b.addons },
  ].map(r => `
    <li class="event-pnl__line">
      <span class="event-pnl__line-lbl">${esc(r.lbl)}</span>
      <span class="event-pnl__line-val">${fmtEur(r.val)}</span>
    </li>
  `).join('');

  // Payments received — editable on the financial_events row. Bookkeeper
  // records the four buckets as cash comes in.
  if (fe) {
    document.getElementById('pnl-payments').innerHTML = `
      <div class="event-pnl__pay-grid">
        <label><span>Аванс брой €</span><input type="number" step="0.01" data-fe-field="deposit_cash_eur" value="${fe.deposit_cash_eur || ''}"></label>
        <label><span>Аванс банка €</span><input type="number" step="0.01" data-fe-field="deposit_bank_eur" value="${fe.deposit_bank_eur || ''}"></label>
        <label><span>Дата аванс</span><input type="date" data-fe-field="deposit_date" value="${fe.deposit_date || ''}"></label>
        <label><span>Доплащ. брой €</span><input type="number" step="0.01" data-fe-field="balance_cash_eur" value="${fe.balance_cash_eur || ''}"></label>
        <label><span>Доплащ. банка €</span><input type="number" step="0.01" data-fe-field="balance_bank_eur" value="${fe.balance_bank_eur || ''}"></label>
        <label><span>Дата доплащане</span><input type="date" data-fe-field="balance_date" value="${fe.balance_date || ''}"></label>
      </div>
    `;
  } else {
    document.getElementById('pnl-payments').innerHTML = '<div class="empty-state">Зареждане…</div>';
  }

  // Expense lines — per-vendor cost
  const rows = fe ? (expensesByEvent.get(fe.id) || []) : [];
  document.getElementById('pnl-expense-lines').innerHTML = rows.length
    ? rows.map(x => {
        const opts = EXPENSE_CATS.map(c =>
          `<option value="${c.id}" ${x.category === c.id ? 'selected' : ''}>${esc(c.label)}</option>`
        ).join('');
        return `
          <li class="event-pnl__line event-pnl__line--expense" data-id="${esc(x.id)}">
            <div class="event-pnl__line-row">
              <select data-f="category">${opts}</select>
              <input type="text" data-f="description" value="${esc(x.description || '')}" placeholder="Описание (напр. DJ за вечерта)">
              <input type="number" step="0.01" data-f="amount_eur" value="${x.amount_eur || ''}" placeholder="€">
              <button type="button" class="del-btn" data-del="${esc(x.id)}" title="Изтрий">×</button>
            </div>
            <textarea data-f="notes" class="event-pnl__line-notes" rows="1" placeholder="Коментар (телефон на доставчика, краен срок, забележки…)">${esc(x.notes || '')}</textarea>
          </li>
        `;
      }).join('')
    : '<li class="empty-state">Няма прикрепени разходи.</li>';
}

// ────────────────────────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────────────────────────

async function selectEnquiry(enquiryId) {
  selectedEnquiryId = enquiryId;
  const enquiry = allEnquiries.find(e => e.id === enquiryId);
  if (enquiry) await ensureFinancialEvent(enquiry);
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
}

async function addEventExpense() {
  if (!selectedEnquiryId) return;
  const enquiry = allEnquiries.find(e => e.id === selectedEnquiryId);
  const fe = await ensureFinancialEvent(enquiry);
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
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
}

async function patchExpense(id, field, raw) {
  let value = raw;
  if (field === 'amount_eur') value = raw === '' ? 0 : Number(raw);
  const patch = { [field]: value, updated_at: new Date().toISOString() };
  const { error } = await db.from('financial_expenses').update(patch).eq('id', id);
  if (error) { console.error(error); alert('Грешка при запис'); return; }
  for (const [, rows] of expensesByEvent) {
    const r = rows.find(x => x.id === id);
    if (r) { r[field] = value; break; }
  }
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
}

async function deleteExpense(id) {
  if (!confirm('Изтриване на този разход?')) return;
  const { error } = await db.from('financial_expenses').delete().eq('id', id);
  if (error) { console.error(error); alert('Грешка при изтриване'); return; }
  for (const [evId, rows] of expensesByEvent) {
    expensesByEvent.set(evId, rows.filter(x => x.id !== id));
  }
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
}

async function patchFinancialEvent(field, raw) {
  if (!selectedEnquiryId) return;
  const enquiry = allEnquiries.find(e => e.id === selectedEnquiryId);
  if (!enquiry) return;
  const fe = financialEventByEnquiryId.get(enquiry.id);
  if (!fe) return;
  let value = raw;
  if (field.endsWith('_eur')) value = raw === '' ? 0 : Number(raw);
  if (field.endsWith('_date')) value = raw || null;
  const patch = { [field]: value, updated_at: new Date().toISOString() };
  const { error } = await db.from('financial_events').update(patch).eq('id', fe.id);
  if (error) { console.error(error); alert('Грешка при запис'); return; }
  fe[field] = value;
  renderEventsList(document.getElementById('events-search').value);
  renderMonthSummary();
  renderDetail();
}

// ────────────────────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────────────────────

document.addEventListener('click', evt => {
  const ev = evt.target.closest('[data-enquiry]');
  if (ev) { selectEnquiry(ev.getAttribute('data-enquiry')); return; }
  if (evt.target.closest('#btn-add-event-expense')) { addEventExpense(); return; }
  const del = evt.target.closest('[data-del]');
  if (del) { deleteExpense(del.getAttribute('data-del')); return; }
});

document.addEventListener('change', evt => {
  // Expense inline edit
  const expInp = evt.target.closest('[data-f]');
  if (expInp) {
    const li = expInp.closest('[data-id]');
    if (li) { patchExpense(li.dataset.id, expInp.dataset.f, expInp.value); return; }
  }
  // Payment fields on the financial_events row
  const feInp = evt.target.closest('[data-fe-field]');
  if (feInp) { patchFinancialEvent(feInp.dataset.feField, feInp.value); return; }
});

document.addEventListener('input', evt => {
  if (evt.target.id === 'events-search') renderEventsList(evt.target.value);
});

// Month picker — restricts both the event list and the summary block.
document.addEventListener('change', evt => {
  if (evt.target.id === 'fin-month') {
    monthFilter = evt.target.value || '';
    renderEventsList(document.getElementById('events-search').value);
    renderMonthSummary();
  }
});
document.addEventListener('click', evt => {
  if (evt.target.closest('#btn-month-all')) {
    monthFilter = '';
    const inp = document.getElementById('fin-month');
    if (inp) inp.value = '';
    renderEventsList(document.getElementById('events-search').value);
    renderMonthSummary();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;
  userEmail = session.user?.email || null;

  await loadAll();
  // Default to the current calendar month so the summary opens with
  // something meaningful instead of an aggregated all-time blob.
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
