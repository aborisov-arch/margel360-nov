// Owner-only activity log viewer. Reads public.audit_log (RLS gates it to the
// two owners via is_owner()); we also check is_owner() up front for a clear
// "owners only" message instead of an empty list for non-owner admins.

const TABLE_LABELS = {
  financial_events:       'Финансово събитие (P&L)',
  financial_expenses:     'Разход',
  financial_income_items: 'Доп. услуга',
  enquiries:              'Запитване',
};
const ACTION_LABELS = { INSERT: 'Създаде', UPDATE: 'Промени', DELETE: 'Изтри' };
const ACTION_CLASS  = { INSERT: 'ins', UPDATE: 'upd', DELETE: 'del' };

const FIELD_LABELS = {
  // financial_events — income
  income_rent_eur: 'Оферта', income_drinks_eur: 'Напитки', income_addons_eur: 'Доп. услуги',
  income_dj_eur: 'DJ', income_employees_eur: 'Почистване',
  income_overtime_eur: 'Извънреден час €', income_overtime_hours: 'Извънреден час (часове)',
  income_overtime_rate_eur: 'Ставка/час', offer_total_eur: 'Оферта общо',
  pnl_drinks: 'Напитки (списък)',
  // financial_events — payments
  deposit_cash_eur: 'Аванс брой', deposit_bank_eur: 'Аванс банка', deposit_card_eur: 'Аванс карта',
  balance_cash_eur: 'Доплащане брой', balance_bank_eur: 'Доплащане банка', balance_card_eur: 'Доплащане карта',
  payment3_cash_eur: '3-то плащане брой', payment3_bank_eur: '3-то плащане банка', payment3_card_eur: '3-то плащане карта',
  deposit_date: 'Дата аванс', balance_date: 'Дата доплащане', payment3_date: 'Дата 3-то плащане',
  customer_name: 'Клиент', event_date: 'Дата събитие', event_type: 'Тип', notes: 'Бележки',
  // expenses / income items
  category: 'Категория', amount_eur: 'Сума', description: 'Описание',
  // enquiries
  pipeline_status: 'Статус', full_name: 'Име', email: 'Имейл', phone: 'Телефон',
  preferred_date: 'Дата', guests: 'Гости', payment_method: 'Плащане',
  applied_discount_percent: 'Отстъпка %', addons: 'Доп. услуги (списък)', drinks: 'Напитки (списък)',
  next_followup_at: 'Следващ контакт', payment_tracking: 'Плащания (отбелязани)',
};

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmt(iso) { if (!iso) return '—'; return new Date(iso).toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function fmtVal(key, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') {
    if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'елемент' : 'елемента'}`;
    return '(данни)';
  }
  if (typeof key === 'string' && key.endsWith('_eur') && Number.isFinite(Number(v))) return '€' + Number(v).toFixed(2);
  return String(v);
}

let allRows = [];

function renderList() {
  const userF = document.getElementById('filter-user').value;
  const tableF = document.getElementById('filter-table').value;
  const rows = allRows.filter(r =>
    (!userF || r.changed_by === userF) && (!tableF || r.table_name === tableF));

  document.getElementById('activity-count').textContent =
    `${rows.length} ${rows.length === 1 ? 'промяна' : 'промени'}`;

  if (!rows.length) {
    document.getElementById('list').innerHTML = '<p style="color:#777;padding:20px 0">Няма записи за този филтър.</p>';
    return;
  }

  document.getElementById('list').innerHTML = rows.map(r => {
    const tbl = TABLE_LABELS[r.table_name] || r.table_name;
    const actLbl = ACTION_LABELS[r.action] || r.action;
    const actCls = ACTION_CLASS[r.action] || 'upd';
    let body;
    if (r.action === 'UPDATE' && r.changes && typeof r.changes === 'object') {
      const entries = Object.entries(r.changes);
      body = '<ul class="audit-diff">' + entries.map(([f, d]) => {
        const dd = (d && typeof d === 'object') ? d : { old: undefined, new: d };
        return `<li>
          <span class="audit-diff__field">${esc(FIELD_LABELS[f] || f)}</span>
          <span class="audit-diff__old">${esc(fmtVal(f, dd.old))}</span>
          <span class="audit-diff__arrow">→</span>
          <span class="audit-diff__new">${esc(fmtVal(f, dd.new))}</span>
        </li>`;
      }).join('') + '</ul>';
    } else {
      body = `<div class="audit-row__summary">${r.action === 'INSERT' ? 'Нов запис' : 'Изтрит запис'}</div>`;
    }
    return `
      <div class="audit-row">
        <div class="audit-row__hdr">
          <span class="audit-row__who">${esc(r.changed_by || '—')}
            <span class="audit-row__act audit-row__act--${actCls}">${esc(actLbl)}</span></span>
          <span class="audit-row__meta">${fmt(r.changed_at)}</span>
        </div>
        <div class="audit-row__entity">${esc(tbl)}${r.label ? ' · <strong>' + esc(r.label) + '</strong>' : ''}</div>
        ${body}
      </div>`;
  }).join('');
}

function populateFilters() {
  const users = [...new Set(allRows.map(r => r.changed_by).filter(Boolean))].sort();
  const tables = [...new Set(allRows.map(r => r.table_name).filter(Boolean))].sort();
  const uSel = document.getElementById('filter-user');
  const tSel = document.getElementById('filter-table');
  uSel.innerHTML = '<option value="">Всички потребители</option>' +
    users.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
  tSel.innerHTML = '<option value="">Всички раздели</option>' +
    tables.map(t => `<option value="${esc(t)}">${esc(TABLE_LABELS[t] || t)}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  const loading = document.getElementById('loading');

  // Owner gate — clear message for non-owner admins (RLS would just return []).
  let isOwner = false;
  try { const { data } = await db.rpc('is_owner'); isOwner = !!data; } catch (_) { isOwner = false; }
  if (!isOwner) {
    loading.style.display = 'none';
    document.getElementById('no-access').style.display = 'block';
    return;
  }

  const { data, error } = await db
    .from('audit_log')
    .select('id, table_name, record_id, action, changed_by, label, changes, changed_at')
    .order('changed_at', { ascending: false })
    .limit(500);

  loading.style.display = 'none';
  document.getElementById('content').style.display = 'block';

  if (error) {
    document.getElementById('list').innerHTML =
      `<p style="color:var(--accent);padding:20px 0">Грешка: ${esc(error.message)}</p>`;
    return;
  }

  allRows = data ?? [];
  populateFilters();
  renderList();
  document.getElementById('filter-user').addEventListener('change', renderList);
  document.getElementById('filter-table').addEventListener('change', renderList);
});
