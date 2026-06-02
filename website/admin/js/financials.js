// Financials page — monthly bookkeeping that mirrors the existing Excel
// template Angel uses. Two manual tables (income events + expenses), plus
// an auto-suggested "from CRM" list of confirmed/completed enquiries for
// the month that the manager can promote into the report with one click.
//
// All amounts stored in EUR. BGN derived live using the fixed peg 1.95583.
// The XLSX export reproduces the original template layout one-to-one with
// the same column letters, totals, and (corrected) formulas.

const BGN_RATE = 1.95583;
const fmtEur = n => '€' + (Number(n) || 0).toFixed(2);
const fmtBgn = n => 'лв ' + (Number(n) || 0).toFixed(2);

// Mirrors the lifetime-value estimator in customers.js — used to prefill
// the offer amount on pending rows. Manager can edit it.
const EVENT_BASE = { evening: 1280, wedding: 1500, corp4: 330, corp8: 440, bday_day: 700, bday_eve: 970 };
function estimateEnquiryTotal(e) {
  let total = EVENT_BASE[e.event_id] || 0;
  if (Array.isArray(e.addons)) total += e.addons.reduce((s, a) => s + (Number(a.price) || 0) * (Number(a.qty) || 1), 0);
  if (Array.isArray(e.drinks)) total += e.drinks.reduce((s, d) => s + (Number(d.price) || 0) * (Number(d.qty) || 0), 0);
  const pct = Number(e.applied_discount_percent || 0);
  if (pct > 0) total = Math.round(total * (1 - pct / 100));
  return total;
}

// preferred_date is stored as "DD/MM/YYYY". Convert to "YYYY-MM-DD".
function parsePreferredDate(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

let currentMonth = ''; // 'YYYY-MM'
let allEnquiries = [];
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

// ────────────────────────────────────────────────────────────────────────
// Rendering
// ────────────────────────────────────────────────────────────────────────

function renderPending() {
  const list = document.getElementById('pending-list');
  const items = pendingEnquiries();
  document.getElementById('pending-count').textContent = items.length;
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
  const totalEur = Number(ev.deposit_cash_eur || 0) + Number(ev.deposit_bank_eur || 0)
                 + Number(ev.balance_cash_eur || 0) + Number(ev.balance_bank_eur || 0);
  const totalBgn = totalEur * BGN_RATE;
  return `
    <tr data-id="${esc(ev.id)}">
      <td>${idx + 1}</td>
      <td><input type="date" data-f="event_date" value="${ev.event_date || ''}"></td>
      <td><input type="text" data-f="customer_name" value="${esc(ev.customer_name || '')}"></td>
      <td class="num"><input type="number" step="0.01" data-f="offer_total_eur" value="${ev.offer_total_eur || ''}"></td>
      <td><input type="date" data-f="deposit_date" value="${ev.deposit_date || ''}"></td>
      <td class="num"><input type="number" step="0.01" data-f="deposit_cash_eur" value="${ev.deposit_cash_eur || ''}"></td>
      <td class="num"><input type="number" step="0.01" data-f="deposit_bank_eur" value="${ev.deposit_bank_eur || ''}"></td>
      <td><input type="date" data-f="balance_date" value="${ev.balance_date || ''}"></td>
      <td class="num"><input type="number" step="0.01" data-f="balance_cash_eur" value="${ev.balance_cash_eur || ''}"></td>
      <td class="num"><input type="number" step="0.01" data-f="balance_bank_eur" value="${ev.balance_bank_eur || ''}"></td>
      <td class="num">${fmtEur(totalEur)}</td>
      <td class="num col-bgn">${fmtBgn(totalBgn)}</td>
      <td><button class="del-btn" data-del-event="${esc(ev.id)}" title="Изтрий">×</button></td>
    </tr>
  `;
}

function expenseRowHtml(ex) {
  return `
    <tr data-id="${esc(ex.id)}">
      <td><input type="date" data-f="expense_date" value="${ex.expense_date || ''}"></td>
      <td><input type="text" data-f="description" value="${esc(ex.description || '')}"></td>
      <td class="num"><input type="number" step="0.01" data-f="amount_eur" value="${ex.amount_eur || ''}"></td>
      <td class="num col-bgn">${fmtBgn((Number(ex.amount_eur) || 0) * BGN_RATE)}</td>
      <td><button class="del-btn" data-del-expense="${esc(ex.id)}" title="Изтрий">×</button></td>
    </tr>
  `;
}

function renderEvents() {
  document.getElementById('events-count').textContent = events.length;
  document.getElementById('events-body').innerHTML =
    events.length ? events.map(eventRowHtml).join('')
                  : `<tr><td colspan="13" style="text-align:center;color:#999;padding:18px">Няма записи. Добавете от списъка отгоре или ръчно.</td></tr>`;
  recalcTotals();
}

function renderExpenses() {
  document.getElementById('expenses-count').textContent = expenses.length;
  document.getElementById('expenses-body').innerHTML =
    expenses.length ? expenses.map(expenseRowHtml).join('')
                    : `<tr><td colspan="5" style="text-align:center;color:#999;padding:18px">Няма записи.</td></tr>`;
  recalcTotals();
}

function recalcTotals() {
  let offer = 0, depCash = 0, depBank = 0, balCash = 0, balBank = 0;
  events.forEach(e => {
    offer   += Number(e.offer_total_eur  || 0);
    depCash += Number(e.deposit_cash_eur || 0);
    depBank += Number(e.deposit_bank_eur || 0);
    balCash += Number(e.balance_cash_eur || 0);
    balBank += Number(e.balance_bank_eur || 0);
  });
  const incomeEur = depCash + depBank + balCash + balBank;
  document.getElementById('ev-tot-offer').textContent     = fmtEur(offer);
  document.getElementById('ev-tot-dep-cash').textContent  = fmtEur(depCash);
  document.getElementById('ev-tot-dep-bank').textContent  = fmtEur(depBank);
  document.getElementById('ev-tot-bal-cash').textContent  = fmtEur(balCash);
  document.getElementById('ev-tot-bal-bank').textContent  = fmtEur(balBank);
  document.getElementById('ev-tot-eur').textContent       = fmtEur(incomeEur);
  document.getElementById('ev-tot-bgn').textContent       = fmtBgn(incomeEur * BGN_RATE);

  const expenseEur = expenses.reduce((s, x) => s + Number(x.amount_eur || 0), 0);
  document.getElementById('ex-tot-eur').textContent = fmtEur(expenseEur);
  document.getElementById('ex-tot-bgn').textContent = fmtBgn(expenseEur * BGN_RATE);

  const profitEur = incomeEur - expenseEur;
  document.getElementById('sum-income-eur').textContent   = fmtEur(incomeEur);
  document.getElementById('sum-income-bgn').textContent   = fmtBgn(incomeEur * BGN_RATE);
  document.getElementById('sum-expense-eur').textContent  = fmtEur(expenseEur);
  document.getElementById('sum-expense-bgn').textContent  = fmtBgn(expenseEur * BGN_RATE);
  document.getElementById('sum-profit-eur').textContent   = fmtEur(profitEur);
  document.getElementById('sum-profit-bgn').textContent   = fmtBgn(profitEur * BGN_RATE);
  document.getElementById('sum-profit-eur').className = 'val ' + (profitEur >= 0 ? 'profit' : 'loss');
  document.getElementById('sum-taxable-eur').textContent  = fmtEur(profitEur);
  document.getElementById('sum-taxable-bgn').textContent  = fmtBgn(profitEur * BGN_RATE);
}

// ────────────────────────────────────────────────────────────────────────
// Persistence
// ────────────────────────────────────────────────────────────────────────

async function loadMonth(month) {
  currentMonth = month;
  document.getElementById('fin-month').value = month;
  const [{ data: ev }, { data: ex }] = await Promise.all([
    db.from('financial_events').select('*').eq('month', month).order('event_date', { ascending: true }),
    db.from('financial_expenses').select('*').eq('month', month).order('expense_date', { ascending: true }),
  ]);
  events = ev || [];
  expenses = ex || [];
  renderPending();
  renderEvents();
  renderExpenses();
}

async function promoteEnquiry(enquiryId) {
  const e = allEnquiries.find(x => x.id === enquiryId);
  if (!e) return;
  const row = {
    month: currentMonth,
    event_date: parsePreferredDate(e.preferred_date),
    customer_name: e.full_name || '—',
    offer_total_eur: estimateEnquiryTotal(e),
    enquiry_id: e.id,
    confirmed_by: userEmail,
    confirmed_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('financial_events').insert(row).select().single();
  if (error) { console.error(error); alert('Грешка при добавяне.'); return; }
  events.push(data);
  renderPending(); renderEvents();
}

async function addManualEvent() {
  const row = {
    month: currentMonth,
    customer_name: '',
    offer_total_eur: 0,
    confirmed_by: userEmail,
    confirmed_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('financial_events').insert(row).select().single();
  if (error) { console.error(error); return; }
  events.push(data);
  renderEvents();
}

async function addManualExpense() {
  const row = { month: currentMonth, description: '', amount_eur: 0 };
  const { data, error } = await db.from('financial_expenses').insert(row).select().single();
  if (error) { console.error(error); return; }
  expenses.push(data);
  renderExpenses();
}

async function deleteEvent(id) {
  if (!confirm('Изтриване на този ред?')) return;
  const { error } = await db.from('financial_events').delete().eq('id', id);
  if (error) { console.error(error); return; }
  events = events.filter(x => x.id !== id);
  renderPending(); renderEvents();
}

async function deleteExpense(id) {
  if (!confirm('Изтриване на този разход?')) return;
  const { error } = await db.from('financial_expenses').delete().eq('id', id);
  if (error) { console.error(error); return; }
  expenses = expenses.filter(x => x.id !== id);
  renderExpenses();
}

// Inline-edit save: writes the changed field to Supabase on blur/change.
function bindInlineEdit() {
  document.getElementById('events-body').addEventListener('change', async evt => {
    const inp = evt.target.closest('input[data-f]');
    if (!inp) return;
    const tr = inp.closest('tr[data-id]');
    const id = tr.dataset.id;
    const field = inp.dataset.f;
    let value = inp.value;
    if (inp.type === 'number') value = value === '' ? null : Number(value);
    if (inp.type === 'date')   value = value || null;
    inp.disabled = true;
    const patch = { [field]: value, updated_at: new Date().toISOString() };
    const { error } = await db.from('financial_events').update(patch).eq('id', id);
    inp.disabled = false;
    if (error) { console.error(error); inp.style.outline = '2px solid #c62828'; setTimeout(() => inp.style.outline = '', 1500); return; }
    const ev = events.find(x => x.id === id);
    if (ev) ev[field] = value;
    // Recalc this row's totals without full re-render.
    const totalEur = Number(ev.deposit_cash_eur || 0) + Number(ev.deposit_bank_eur || 0)
                   + Number(ev.balance_cash_eur || 0) + Number(ev.balance_bank_eur || 0);
    tr.children[10].textContent = fmtEur(totalEur);
    tr.children[11].textContent = fmtBgn(totalEur * BGN_RATE);
    recalcTotals();
  });

  document.getElementById('expenses-body').addEventListener('change', async evt => {
    const inp = evt.target.closest('input[data-f]');
    if (!inp) return;
    const tr = inp.closest('tr[data-id]');
    const id = tr.dataset.id;
    const field = inp.dataset.f;
    let value = inp.value;
    if (inp.type === 'number') value = value === '' ? 0 : Number(value);
    if (inp.type === 'date')   value = value || null;
    inp.disabled = true;
    const patch = { [field]: value, updated_at: new Date().toISOString() };
    const { error } = await db.from('financial_expenses').update(patch).eq('id', id);
    inp.disabled = false;
    if (error) { console.error(error); inp.style.outline = '2px solid #c62828'; setTimeout(() => inp.style.outline = '', 1500); return; }
    const ex = expenses.find(x => x.id === id);
    if (ex) ex[field] = value;
    if (field === 'amount_eur') tr.children[3].textContent = fmtBgn((Number(value) || 0) * BGN_RATE);
    recalcTotals();
  });
}

// ────────────────────────────────────────────────────────────────────────
// XLSX export — mirrors Отчет 02.2026.xlsx layout
// ────────────────────────────────────────────────────────────────────────

function exportXlsx() {
  if (!window.XLSX) { alert('XLSX library не е заредена.'); return; }

  // Build the sheet as Array-of-Arrays so we control exact cell placement.
  // Header columns mirror the original template — extra columns left blank.
  const header = [
    'бр. събития', '', ' дата на събитие', 'клиент', 'сума по оферта',
    'дата на плащане', 'платено в брой аванс', 'платено  аванс по банка ', '',
    'дата на плащане', 'доплащане в брой', 'платено по банка ',
    'В €', 'в лв', '', '',
    'дата', 'описание др. Разходи', 'други разходи сума лв', '', 'в €',
  ];

  // Determine row span: at least 25 rows so the template feels familiar,
  // but extend if the data is bigger.
  const dataRows = Math.max(events.length, expenses.length, 25);

  const aoa = [header];
  for (let i = 0; i < dataRows; i++) {
    const ev = events[i] || {};
    const ex = expenses[i] || {};
    const r = new Array(21).fill(null);
    r[0]  = i + 1;                                        // A
    r[2]  = ev.event_date     ? new Date(ev.event_date)     : null;  // C
    r[3]  = ev.customer_name  || null;                    // D
    r[4]  = ev.offer_total_eur ?? null;                   // E
    r[5]  = ev.deposit_date   ? new Date(ev.deposit_date)   : null;  // F
    r[6]  = ev.deposit_cash_eur ?? null;                  // G
    r[7]  = ev.deposit_bank_eur ?? null;                  // H
    r[9]  = ev.balance_date   ? new Date(ev.balance_date)   : null;  // J
    r[10] = ev.balance_cash_eur ?? null;                  // K
    r[11] = ev.balance_bank_eur ?? null;                  // L
    // M (12) and N (13) are formula-driven (set below as formula cells).
    r[16] = ex.expense_date   ? new Date(ex.expense_date)   : null;  // Q
    r[17] = ex.description    || null;                    // R
    // S (18) — BGN expense, formula =U*1.95583 (per-row).
    r[20] = ex.amount_eur ?? null;                        // U
    aoa.push(r);
  }

  // Totals row (one after the last data row).
  const totalsRow = dataRows + 2; // 1-indexed Excel row; aoa includes header at row 1
  const totals = new Array(21).fill(null);
  // Income totals: E,G,H,K,L,M,N use SUMs / formulas; placed by formula below.
  aoa.push(totals);

  // Summary rows (5 rows after totals)
  const D29 = ['', '', '', 'приходи',          null, null, null, null, '', 'Ели',     null, null];
  const D30 = ['', '', '', 'разходи',          null, null, null, null, '', 'Шушма',   null, null];
  const D31 = ['', '', '', 'печалба',          null, null, null, null, '', 'Иван',    null, null];
  const D32 = ['', '', '', 'облагане заплата', null, null];
  aoa.push(D29, D30, D31, D32);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Add per-row formulas (М and Н for income, S for expense) and totals.
  for (let i = 1; i <= dataRows; i++) {
    const r = i + 1; // header is row 1
    ws[`M${r}`] = { t: 'n', f: `K${r}+L${r}+G${r}+H${r}` };
    ws[`N${r}`] = { t: 'n', f: `M${r}*${BGN_RATE}` };
    ws[`S${r}`] = { t: 'n', f: `U${r}*${BGN_RATE}` };
  }
  // Income totals row
  const tr = totalsRow;
  ws[`E${tr}`] = { t: 'n', f: `SUM(E2:E${dataRows + 1})` };
  ws[`G${tr}`] = { t: 'n', f: `SUM(G2:G${dataRows + 1})` };
  ws[`H${tr}`] = { t: 'n', f: `SUM(H2:H${dataRows + 1})` };
  ws[`K${tr}`] = { t: 'n', f: `SUM(K2:K${dataRows + 1})` };
  ws[`L${tr}`] = { t: 'n', f: `SUM(L2:L${dataRows + 1})` };
  ws[`M${tr}`] = { t: 'n', f: `K${tr}+L${tr}+G${tr}+H${tr}` };
  ws[`N${tr}`] = { t: 'n', f: `M${tr}*${BGN_RATE}` };
  // Expense totals
  ws[`U${tr}`] = { t: 'n', f: `SUM(U2:U${dataRows + 1})` };
  ws[`S${tr}`] = { t: 'n', f: `U${tr}*${BGN_RATE}` };

  // Summary block — row indexes (header at 1, data 2..dataRows+1, totals tr, then +2 rows of spacing? Template puts these immediately after; we put them right after totals).
  const sumStart = tr + 2;
  // приходи
  ws[`E${sumStart}`]   = { t: 'n', f: `M${tr}` };
  ws[`F${sumStart}`]   = { t: 'n', f: `N${tr}` };
  // разходи
  ws[`E${sumStart+1}`] = { t: 'n', f: `U${tr}` };
  ws[`F${sumStart+1}`] = { t: 'n', f: `S${tr}` };
  // печалба
  ws[`E${sumStart+2}`] = { t: 'n', f: `E${sumStart}-E${sumStart+1}` };
  ws[`F${sumStart+2}`] = { t: 'n', f: `F${sumStart}-F${sumStart+1}` };
  // облагане заплата
  ws[`E${sumStart+3}`] = { t: 'n', f: `E${sumStart+2}` };
  ws[`F${sumStart+3}`] = { t: 'n', f: `F${sumStart+2}` };

  // Column widths similar to the source.
  ws['!cols'] = [
    { wch: 9 }, { wch: 1 }, { wch: 12 }, { wch: 22 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 1 },
    { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 1 }, { wch: 1 },
    { wch: 11 }, { wch: 32 }, { wch: 14 }, { wch: 1 }, { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Filename mirrors the source ("Отчет 02.2026.xlsx").
  const [y, m] = currentMonth.split('-');
  const fname = `Отчет ${m}.${y}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// ────────────────────────────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;
  userEmail = session.user?.email || null;

  // Default to last completed month (events usually get reconciled the
  // month after they happened).
  const now = new Date();
  const def = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  currentMonth = isoMonth(def);
  document.getElementById('fin-month').value = currentMonth;

  const { data: enq, error } = await db.from('enquiries').select('id,full_name,preferred_date,event_type,event_id,pipeline_status,addons,drinks,applied_discount_percent');
  if (error) { console.error(error); return; }
  allEnquiries = enq || [];

  await loadMonth(currentMonth);
  bindInlineEdit();

  document.getElementById('fin-month').addEventListener('change', e => loadMonth(e.target.value));
  document.getElementById('btn-add-event').addEventListener('click', addManualEvent);
  document.getElementById('btn-add-expense').addEventListener('click', addManualExpense);
  document.getElementById('btn-export-xlsx').addEventListener('click', exportXlsx);

  document.getElementById('pending-list').addEventListener('click', evt => {
    const b = evt.target.closest('[data-promote]');
    if (b) promoteEnquiry(b.getAttribute('data-promote'));
  });
  document.getElementById('events-body').addEventListener('click', evt => {
    const b = evt.target.closest('[data-del-event]');
    if (b) deleteEvent(b.getAttribute('data-del-event'));
  });
  document.getElementById('expenses-body').addEventListener('click', evt => {
    const b = evt.target.closest('[data-del-expense]');
    if (b) deleteExpense(b.getAttribute('data-del-expense'));
  });
});

function rerenderPage() { renderPending(); renderEvents(); renderExpenses(); }
