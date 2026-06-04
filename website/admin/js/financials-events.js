// Per-event P&L: select a financial_event from the left rail, see its
// income breakdown on the left and the expenses attached to it on the
// right. Margin = (income − expenses) / income.
//
// Expenses with event_id = null are "общи разходи" — they don't appear
// here. They still show on the monthly expenses page.

const BGN_RATE = 1.95583;
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

let allEvents = [];
let expensesByEvent = new Map(); // event_id → expense rows
let selectedId = null;
let userEmail = null;

function eventIncome(ev) {
  return Number(ev.income_rent_eur || 0)
       + Number(ev.income_drinks_eur || 0)
       + Number(ev.income_addons_eur || 0);
}

function eventExpenseTotal(ev) {
  const rows = expensesByEvent.get(ev.id) || [];
  return rows.reduce((s, x) => s + Number(x.amount_eur || 0), 0);
}

// ── Left rail ───────────────────────────────────────────────

function renderEventsList(filter = '') {
  const wrap = document.getElementById('events-list');
  const cnt  = document.getElementById('events-list-count');
  const needle = filter.trim().toLowerCase();
  const matches = needle
    ? allEvents.filter(e => (e.customer_name || '').toLowerCase().includes(needle))
    : allEvents;
  if (cnt) cnt.textContent = matches.length;
  if (!matches.length) {
    wrap.innerHTML = '<div class="empty-state">Няма събития.</div>';
    return;
  }
  wrap.innerHTML = matches.map(ev => {
    const income = eventIncome(ev);
    const expense = eventExpenseTotal(ev);
    const net = income - expense;
    const margin = income > 0 ? Math.round((net / income) * 100) : null;
    const selected = ev.id === selectedId ? ' is-selected' : '';
    const marginClass = margin == null ? '' : (margin >= 0 ? ' is-positive' : ' is-negative');
    return `
      <button type="button" class="event-pnl__event${selected}" data-event="${esc(ev.id)}">
        <div class="event-pnl__event-name">${esc(ev.customer_name || '—')}</div>
        <div class="event-pnl__event-meta">${fmtDateBg(ev.event_date)} · ${fmtEur(income)}</div>
        <div class="event-pnl__event-margin${marginClass}">${margin == null ? '—' : margin + '%'}</div>
      </button>
    `;
  }).join('');
}

// ── Right detail ────────────────────────────────────────────

function renderDetail() {
  const placeholder = document.getElementById('pnl-placeholder');
  const body = document.getElementById('pnl-body');
  if (!selectedId) {
    placeholder.hidden = false;
    body.hidden = true;
    return;
  }
  const ev = allEvents.find(e => e.id === selectedId);
  if (!ev) { placeholder.hidden = false; body.hidden = true; return; }
  placeholder.hidden = true;
  body.hidden = false;

  document.getElementById('pnl-customer').textContent = ev.customer_name || '—';
  document.getElementById('pnl-date').textContent    = fmtDateBg(ev.event_date);
  document.getElementById('pnl-month').textContent   = ev.month || '—';

  const income = eventIncome(ev);
  const expense = eventExpenseTotal(ev);
  const net = income - expense;
  const margin = income > 0 ? Math.round((net / income) * 100) : null;

  document.getElementById('pnl-income-total').textContent = fmtEur(income);
  document.getElementById('pnl-expense-total').textContent = fmtEur(expense);
  document.getElementById('pnl-net-eur').textContent = fmtEur(net);
  document.getElementById('pnl-net-bgn').textContent = fmtBgn(net * BGN_RATE);
  const marginEl = document.getElementById('pnl-margin');
  marginEl.textContent = margin == null ? '—' : margin + '%';
  marginEl.className = 'event-pnl__hero-val ' + (margin == null ? '' : (margin >= 0 ? 'is-positive' : 'is-negative'));

  // Income lines (3 categories)
  document.getElementById('pnl-income-lines').innerHTML = [
    { lbl: 'Оферта',      val: ev.income_rent_eur   || 0 },
    { lbl: 'Напитки',     val: ev.income_drinks_eur || 0 },
    { lbl: 'Доп. услуги', val: ev.income_addons_eur || 0 },
  ].map(r => `
    <li class="event-pnl__line">
      <span class="event-pnl__line-lbl">${esc(r.lbl)}</span>
      <span class="event-pnl__line-val">${fmtEur(r.val)}</span>
    </li>
  `).join('');

  // Expense lines — editable amount + delete; category select inline.
  const rows = expensesByEvent.get(ev.id) || [];
  document.getElementById('pnl-expense-lines').innerHTML = rows.length
    ? rows.map(x => {
        const opts = EXPENSE_CATS.map(c =>
          `<option value="${c.id}" ${x.category === c.id ? 'selected' : ''}>${esc(c.label)}</option>`
        ).join('');
        return `
          <li class="event-pnl__line event-pnl__line--expense" data-id="${esc(x.id)}">
            <div class="event-pnl__line-row">
              <select data-f="category">${opts}</select>
              <input type="text" data-f="description" value="${esc(x.description || '')}" placeholder="Описание">
              <input type="number" step="0.01" data-f="amount_eur" value="${x.amount_eur || ''}" placeholder="€">
              <button type="button" class="del-btn" data-del="${esc(x.id)}" title="Изтрий">×</button>
            </div>
          </li>
        `;
      }).join('')
    : '<li class="empty-state">Няма прикрепени разходи.</li>';
}

// ── Mutations ───────────────────────────────────────────────

async function addEventExpense() {
  if (!selectedId) return;
  const ev = allEvents.find(e => e.id === selectedId);
  if (!ev) return;
  const row = {
    month: ev.month,
    expense_date: ev.event_date || null,
    description: '',
    amount_eur: 0,
    category: 'other',
    event_id: ev.id,
  };
  const { data, error } = await db.from('financial_expenses').insert(row).select().single();
  if (error) { console.error(error); alert('Грешка при добавяне на разход'); return; }
  const arr = expensesByEvent.get(ev.id) || [];
  arr.push(data);
  expensesByEvent.set(ev.id, arr);
  renderEventsList(document.getElementById('events-search').value);
  renderDetail();
}

async function patchExpense(id, field, raw) {
  let value = raw;
  if (field === 'amount_eur') value = raw === '' ? 0 : Number(raw);
  const patch = { [field]: value, updated_at: new Date().toISOString() };
  const { error } = await db.from('financial_expenses').update(patch).eq('id', id);
  if (error) { console.error(error); alert('Грешка при запис'); return; }
  // mutate in place
  for (const [, rows] of expensesByEvent) {
    const r = rows.find(x => x.id === id);
    if (r) { r[field] = value; break; }
  }
  renderEventsList(document.getElementById('events-search').value);
  renderDetail();
}

async function deleteExpense(id) {
  if (!confirm('Изтриване на този разход?')) return;
  const { error } = await db.from('financial_expenses').delete().eq('id', id);
  if (error) { console.error(error); alert('Грешка при изтриване'); return; }
  for (const [evId, rows] of expensesByEvent) {
    const next = rows.filter(x => x.id !== id);
    expensesByEvent.set(evId, next);
  }
  renderEventsList(document.getElementById('events-search').value);
  renderDetail();
}

// ── Boot ────────────────────────────────────────────────────

document.addEventListener('click', evt => {
  const ev = evt.target.closest('[data-event]');
  if (ev) {
    selectedId = ev.getAttribute('data-event');
    renderEventsList(document.getElementById('events-search').value);
    renderDetail();
    return;
  }
  if (evt.target.closest('#btn-add-event-expense')) { addEventExpense(); return; }
  const del = evt.target.closest('[data-del]');
  if (del) { deleteExpense(del.getAttribute('data-del')); return; }
});

document.addEventListener('change', evt => {
  const inp = evt.target.closest('[data-f]');
  if (!inp) return;
  const li = inp.closest('[data-id]');
  if (!li) return;
  patchExpense(li.dataset.id, inp.dataset.f, inp.value);
});

document.addEventListener('input', evt => {
  if (evt.target.id === 'events-search') renderEventsList(evt.target.value);
});

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;
  userEmail = session.user?.email || null;

  const [{ data: ev, error: evErr }, { data: ex, error: exErr }] = await Promise.all([
    db.from('financial_events').select('*').order('event_date', { ascending: false }),
    db.from('financial_expenses').select('*').not('event_id', 'is', null),
  ]);
  if (evErr) console.error(evErr);
  if (exErr) console.error(exErr);
  allEvents = ev || [];
  expensesByEvent = new Map();
  (ex || []).forEach(x => {
    if (!expensesByEvent.has(x.event_id)) expensesByEvent.set(x.event_id, []);
    expensesByEvent.get(x.event_id).push(x);
  });

  renderEventsList('');
  renderDetail();
});

function rerenderPage() { renderEventsList(document.getElementById('events-search').value); renderDetail(); }
