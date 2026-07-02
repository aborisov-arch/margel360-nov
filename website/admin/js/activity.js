// Owner-only activity log viewer. Reads public.audit_log (RLS gates it to the
// two owners via is_owner()); we also check is_owner() up front for a clear
// "owners only" message instead of an empty list for non-owner admins.
// All labels are bilingual: static chrome via data-i18n/admin-i18n.js, the
// dynamic maps below keyed by getAdminLang() (bg fallback for unknown keys).

const TABLE_LABELS = {
  bg: {
    financial_events:       'Финансово събитие (P&L)',
    financial_expenses:     'Разход',
    financial_income_items: 'Доп. услуга',
    enquiries:              'Запитване',
  },
  en: {
    financial_events:       'Financial event (P&L)',
    financial_expenses:     'Expense',
    financial_income_items: 'Add-on service',
    enquiries:              'Enquiry',
  },
};
const ACTION_LABELS = {
  bg: { INSERT: 'Създаде', UPDATE: 'Промени', DELETE: 'Изтри' },
  en: { INSERT: 'Created', UPDATE: 'Changed', DELETE: 'Deleted' },
};
const ACTION_CLASS = { INSERT: 'ins', UPDATE: 'upd', DELETE: 'del' };

const FIELD_LABELS = {
  bg: {
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
    partner_interest: 'Партньори (интерес)',
  },
  en: {
    // financial_events — income
    income_rent_eur: 'Offer', income_drinks_eur: 'Drinks', income_addons_eur: 'Add-on services',
    income_dj_eur: 'DJ', income_employees_eur: 'Cleaning',
    income_overtime_eur: 'Overtime €', income_overtime_hours: 'Overtime (hours)',
    income_overtime_rate_eur: 'Rate/hour', offer_total_eur: 'Offer total',
    pnl_drinks: 'Drinks (list)',
    // financial_events — payments
    deposit_cash_eur: 'Deposit cash', deposit_bank_eur: 'Deposit bank', deposit_card_eur: 'Deposit card',
    balance_cash_eur: 'Balance cash', balance_bank_eur: 'Balance bank', balance_card_eur: 'Balance card',
    payment3_cash_eur: '3rd payment cash', payment3_bank_eur: '3rd payment bank', payment3_card_eur: '3rd payment card',
    deposit_date: 'Deposit date', balance_date: 'Balance date', payment3_date: '3rd payment date',
    customer_name: 'Customer', event_date: 'Event date', event_type: 'Type', notes: 'Notes',
    // expenses / income items
    category: 'Category', amount_eur: 'Amount', description: 'Description',
    // enquiries
    pipeline_status: 'Status', full_name: 'Name', email: 'Email', phone: 'Phone',
    preferred_date: 'Date', guests: 'Guests', payment_method: 'Payment',
    applied_discount_percent: 'Discount %', addons: 'Add-on services (list)', drinks: 'Drinks (list)',
    next_followup_at: 'Next follow-up', payment_tracking: 'Payments (marked)',
    partner_interest: 'Partners (interest)',
  },
};

// Language-aware label lookup: current language first, Bulgarian as the
// canonical fallback, raw key when neither map knows it.
function lbl(map, key) {
  const cur = map[getAdminLang()] || map.bg;
  return cur[key] ?? map.bg[key] ?? key;
}

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmt(iso) {
  if (!iso) return '—';
  const locale = getAdminLang() === 'en' ? 'en-GB' : 'bg-BG';
  return new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtVal(key, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') {
    if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? t('activity_item_one') : t('activity_item_many')}`;
    return t('activity_data');
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
    `${rows.length} ${rows.length === 1 ? t('activity_change_one') : t('activity_change_many')}`;

  if (!rows.length) {
    document.getElementById('list').innerHTML = `<p style="color:#777;padding:20px 0">${esc(t('activity_empty'))}</p>`;
    return;
  }

  document.getElementById('list').innerHTML = rows.map(r => {
    const tbl = lbl(TABLE_LABELS, r.table_name);
    const actLbl = lbl(ACTION_LABELS, r.action);
    const actCls = ACTION_CLASS[r.action] || 'upd';
    let body;
    if (r.action === 'UPDATE' && r.changes && typeof r.changes === 'object') {
      const entries = Object.entries(r.changes);
      body = '<ul class="audit-diff">' + entries.map(([f, d]) => {
        const dd = (d && typeof d === 'object') ? d : { old: undefined, new: d };
        return `<li>
          <span class="audit-diff__field">${esc(lbl(FIELD_LABELS, f))}</span>
          <span class="audit-diff__old">${esc(fmtVal(f, dd.old))}</span>
          <span class="audit-diff__arrow">→</span>
          <span class="audit-diff__new">${esc(fmtVal(f, dd.new))}</span>
        </li>`;
      }).join('') + '</ul>';
    } else {
      body = `<div class="audit-row__summary">${esc(r.action === 'INSERT' ? t('activity_new_record') : t('activity_deleted_record'))}</div>`;
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
  // Preserve the current selection across rebuilds (language switches).
  const uCur = uSel.value, tCur = tSel.value;
  uSel.innerHTML = `<option value="">${esc(t('activity_all_users'))}</option>` +
    users.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
  tSel.innerHTML = `<option value="">${esc(t('activity_all_sections'))}</option>` +
    tables.map(tn => `<option value="${esc(tn)}">${esc(lbl(TABLE_LABELS, tn))}</option>`).join('');
  uSel.value = uCur;
  tSel.value = tCur;
}

// admin-i18n.js calls this after a language switch (re-labels the dynamic
// filter options, count, action labels and dates in the current language).
// No-op until the list is actually shown (pre-load / owners-only screen).
function rerenderPage() {
  if (document.getElementById('content').style.display === 'none') return;
  populateFilters();
  renderList();
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
      `<p style="color:var(--accent);padding:20px 0">${esc(t('activity_error'))}: ${esc(error.message)}</p>`;
    return;
  }

  allRows = data ?? [];
  populateFilters();
  renderList();
  document.getElementById('filter-user').addEventListener('change', renderList);
  document.getElementById('filter-table').addEventListener('change', renderList);
});
