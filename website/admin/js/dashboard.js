let allEnquiries = [];
let notesByEnquiry = {}; // enquiry_id -> [{id, body, author_email, created_at}, ...]
// Tab filter on top of the dashboard. 'unanswered' = inbox view (default,
// what the team should be acting on next), 'answered' = archive of dealt
// with rows, 'all' = unfiltered.
let statusFilter = 'unanswered';

const PIPELINE_STAGES = ['new','contacted','quoted','confirmed','completed','lost','archived'];

function applyStatusFilter(list) {
  if (statusFilter === 'all') return list;
  if (statusFilter === 'answered')   return list.filter(e => e.status === 'answered');
  /* unanswered */                   return list.filter(e => e.status !== 'answered');
}

function renderStatusTabCounts() {
  const counts = { all: allEnquiries.length, answered: 0, unanswered: 0 };
  allEnquiries.forEach(e => {
    if (e.status === 'answered') counts.answered++;
    else counts.unanswered++;
  });
  const labelKey = { unanswered: 'tab_unanswered', answered: 'tab_answered', all: 'tab_all' };
  document.querySelectorAll('#status-tabs .status-tab').forEach(btn => {
    const f = btn.getAttribute('data-filter');
    const lbl = btn.querySelector('[data-tab-label]');
    const cnt = btn.querySelector('[data-count]');
    if (lbl) lbl.textContent = t(labelKey[f]);
    if (cnt) cnt.textContent = counts[f] ?? 0;
    btn.classList.toggle('is-active', f === statusFilter);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  const loadingEl = document.getElementById('loading');
  const wrapEl    = document.getElementById('enquiries-wrap');

  const [{ data: enquiries, error }, { data: notes, error: notesErr }] = await Promise.all([
    db.from('enquiries').select('*').order('created_at', { ascending: false }),
    db.from('enquiry_notes').select('*').order('created_at', { ascending: false }),
  ]);

  loadingEl.style.display = 'none';
  wrapEl.style.display = 'block';

  if (error) {
    wrapEl.innerHTML = `<p style="color:var(--accent);padding:20px 0">${t('dash_error')}</p>`;
    console.error('Failed to fetch enquiries:', error);
    return;
  }
  if (notesErr) console.error('Failed to fetch notes:', notesErr);

  allEnquiries = enquiries || [];
  notesByEnquiry = {};
  (notes || []).forEach(n => {
    (notesByEnquiry[n.enquiry_id] ||= []).push(n);
  });

  renderStatusTabCounts();
  renderEnquiries(applyStatusFilter(allEnquiries));

  // Bind the tbody click handler exactly once. Doing it inside
  // renderEnquiries caused listeners to stack on every language switch.
  bindTableHandlers();

  // Status tabs (Unanswered / Answered / All).
  document.getElementById('status-tabs')?.addEventListener('click', evt => {
    const btn = evt.target.closest('[data-filter]');
    if (!btn) return;
    statusFilter = btn.getAttribute('data-filter');
    renderStatusTabCounts();
    renderEnquiries(applyStatusFilter(allEnquiries));
  });
});

// Build a CSS class + readable label for the pipeline stage badge.
function pipelineBadge(stage) {
  const safe = PIPELINE_STAGES.includes(stage) ? stage : 'new';
  return { cls: `pipe-badge pipe-${safe}`, label: t('crm_status_' + safe) };
}

// Returns one of '', 'overdue', 'today' for a follow-up date string (ISO).
function followupClass(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(d); target.setHours(0,0,0,0);
  if (target < today) return 'overdue';
  if (target.getTime() === today.getTime()) return 'today';
  return '';
}

// YYYY-MM-DD from a timestamptz, for <input type=date> binding.
function dateInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// Normalised key for grouping enquiries by customer. Email wins when present
// (most reliable); fall back to phone digits.
function customerKey(e) {
  const em = (e.email || '').trim().toLowerCase();
  if (em) return 'e:' + em;
  const ph = (e.phone || '').replace(/\D/g, '');
  if (ph) return 'p:' + ph;
  return '';
}

// CRM panel: pipeline dropdown, follow-up date input, marketing-consent
// toggle, customer-history link, notes thread.
function renderCrmPanel(e) {
  const notes = notesByEnquiry[e.id] || [];
  const stageOpts = PIPELINE_STAGES.map(s =>
    `<option value="${s}" ${e.pipeline_status === s ? 'selected' : ''}>${t('crm_status_' + s)}</option>`
  ).join('');

  const followupVal = dateInputValue(e.next_followup_at);
  const fuClass = followupClass(e.next_followup_at);
  const fuLabel = fuClass === 'overdue' ? t('crm_followup_overdue')
              : fuClass === 'today'   ? t('crm_followup_today') : '';

  const notesHtml = notes.length
    ? notes.map(n => `
        <li class="crm-note" data-note-id="${n.id}">
          <div class="crm-note__meta">
            <span class="crm-note__time">${esc(fmtDate(n.created_at))}</span>
            ${n.author_email ? `<span class="crm-note__author">· ${esc(n.author_email)}</span>` : ''}
            <button class="crm-note__del" data-note-del="${n.id}" data-enquiry-id="${esc(e.id)}" title="${t('crm_note_delete')}">×</button>
          </div>
          <div class="crm-note__body">${esc(n.body)}</div>
        </li>
      `).join('')
    : `<li class="crm-note crm-note--empty">${t('crm_note_empty')}</li>`;

  const histKey = customerKey(e);
  const histLink = histKey
    ? `<a class="crm-history-link" href="customers.html?c=${encodeURIComponent(histKey)}" target="_blank" rel="noopener" title="${t('crm_view_history')}">📇 ${t('crm_customer_history')} →</a>`
    : '';

  return `
    <div class="crm-panel" data-id="${esc(e.id)}">
      <h4 class="crm-panel__title">${t('crm_status')} · ${t('crm_followup')} · ${t('crm_notes')}</h4>
      <div class="crm-panel__row">
        <label class="crm-field">
          <span>${t('crm_status')}</span>
          <select class="crm-stage-select" data-id="${esc(e.id)}">${stageOpts}</select>
        </label>
        <label class="crm-field">
          <span>${t('crm_followup')}${fuLabel ? ` · <em class="fu-${fuClass}">${fuLabel}</em>` : ''}</span>
          <span class="crm-followup-row">
            <input type="date" class="crm-followup-input" data-id="${esc(e.id)}" value="${followupVal}">
            ${followupVal ? `<button class="btn btn-sm btn-outline crm-followup-clear" data-id="${esc(e.id)}">${t('crm_followup_clear')}</button>` : ''}
          </span>
        </label>
        <label class="crm-field crm-field--check">
          <input type="checkbox" class="crm-consent-check" data-id="${esc(e.id)}" ${e.marketing_consent ? 'checked' : ''}>
          <span>${t('crm_marketing_consent')}</span>
        </label>
        ${histLink}
      </div>
      <div class="crm-notes">
        <ul class="crm-notes__list" id="notes-${esc(e.id)}">${notesHtml}</ul>
        <form class="crm-notes__form" data-id="${esc(e.id)}">
          <textarea class="crm-note-input" rows="2" maxlength="4000" placeholder="${esc(t('crm_note_placeholder'))}"></textarea>
          <button type="submit" class="btn btn-sm btn-primary">${t('crm_note_add')}</button>
        </form>
      </div>
    </div>
  `;
}

// Called by admin-i18n.js when language is switched
function rerenderPage() {
  // Re-apply static i18n (handled by applyAdminLang already)
  // Re-render dynamic table so translated strings update
  renderStatusTabCounts();
  renderEnquiries(applyStatusFilter(allEnquiries));
}

function renderEnquiries(enquiries) {
  const tbody = document.getElementById('enquiries-body');

  if (!enquiries || !enquiries.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${t('dash_empty')}</td></tr>`;
    return;
  }

  tbody.innerHTML = '';

  enquiries.forEach(e => {
    const isAnswered = e.status === 'answered';

    // Main summary row
    const tr = document.createElement('tr');
    if (isAnswered) tr.classList.add('row-answered');
    tr.innerHTML = `
      <td>${esc(e.full_name)}</td>
      <td>${esc(e.phone)}</td>
      <td>${esc(e.event_type)}</td>
      <td>${esc(e.preferred_date)}</td>
      <td>${esc(fmtDate(e.created_at))}</td>
      <td>${esc(e.last_edited_at ? fmtDate(e.last_edited_at) : t('edit_never'))}</td>
      <td>
        <span class="status-badge ${isAnswered ? 'answered' : 'new'}">
          ${isAnswered ? t('status_answered') : t('status_new')}
        </span>
        <span class="${pipelineBadge(e.pipeline_status).cls}" style="margin-left:6px">${pipelineBadge(e.pipeline_status).label}</span>
        ${e.edit_locked ? `<span class="status-badge locked" style="margin-left:6px">${t('edit_locked_badge')}</span>` : ''}
        ${e.next_followup_at ? `<span class="followup-chip ${followupClass(e.next_followup_at)}" title="${t('crm_followup')}">⏰ ${esc(dateInputValue(e.next_followup_at))}</span>` : ''}
      </td>
      <td><button class="btn-expand" aria-expanded="false" data-id="${esc(e.id)}">${t('btn_view')}</button></td>
    `;
    tbody.appendChild(tr);

    // Detail row (hidden by default)
    const detailTr = document.createElement('tr');
    detailTr.className = 'detail-row hidden';
    detailTr.id = `detail-${e.id}`;
    detailTr.innerHTML = `
      <td colspan="8">
        <div class="detail-panel">
          <div class="detail-grid">
            <div><strong>${t('detail_email')}:</strong> ${esc(e.email)}</div>
            <div><strong>${t('detail_guests')}:</strong> ${e.guests != null ? esc(e.guests) : '—'}</div>
            <div><strong>${t('detail_time')}:</strong> ${e.arrival_time ? `${esc(e.arrival_time)} (${t('detail_time_eve')})` : (e.time_of_day === 'day' ? t('detail_time_day') : t('detail_time_eve'))}</div>
            <div><strong>${t('detail_payment')}:</strong> ${esc(e.payment_method)}</div>
          </div>
          ${fmtAddons(e.addons)}
          ${fmtDrinks(e.drinks, e.id)}
          ${e.notes ? `<div class="detail-notes"><strong>${t('detail_notes')}:</strong> ${esc(e.notes)}</div>` : ''}
          ${renderTotals(e)}
          ${renderPaymentTracking(e)}
          ${renderCrmPanel(e)}
          <div class="detail-actions">
            <button class="btn btn-sm ${isAnswered ? 'btn-outline' : 'btn-primary'} btn-status"
              data-id="${esc(e.id)}"
              data-answered="${isAnswered ? 'true' : 'false'}">
              ${isAnswered ? t('btn_mark_new') : t('btn_mark_answered')}
            </button>
            <button class="btn btn-sm btn-outline btn-lock"
              data-id="${esc(e.id)}"
              data-locked="${e.edit_locked ? 'true' : 'false'}">
              ${e.edit_locked ? t('edit_unlock_btn') : t('edit_lock_btn')}
            </button>
            <span style="color:#888;font-size:0.9em;margin-left:auto">
              ${t('edit_count_label')}: ${e.edit_count ?? 0}
            </span>
            <a class="btn btn-sm btn-outline btn-edit-enquiry"
              href="../edit.html?admin=1&id=${esc(e.id)}"
              target="_blank" rel="noopener">
              ${t('btn_edit_enquiry')}
            </a>
            <button class="btn btn-sm btn-outline btn-export-offer"
              data-id="${esc(e.id)}">
              ${t('btn_export_offer')}
            </button>
            <button class="btn btn-sm btn-danger btn-delete-enquiry"
              data-id="${esc(e.id)}"
              data-name="${esc(e.full_name)}">
              ${t('delete_btn')}
            </button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(detailTr);
  });
}

function bindTableHandlers() {
  const tbody = document.getElementById('enquiries-body');
  if (!tbody || tbody.dataset.bound === '1') return;
  tbody.dataset.bound = '1';

  // CRM: pipeline stage dropdown — save on change
  tbody.addEventListener('change', async evt => {
    const sel = evt.target.closest('.crm-stage-select');
    if (sel) {
      const id = sel.getAttribute('data-id');
      const newStage = sel.value;
      sel.disabled = true;
      const { error } = await db.from('enquiries').update({ pipeline_status: newStage }).eq('id', id);
      sel.disabled = false;
      if (error) { console.error('Pipeline save failed:', error); sel.style.outline = '2px solid #c62828'; setTimeout(() => sel.style.outline = '', 1500); return; }
      const enquiry = allEnquiries.find(x => String(x.id) === String(id));
      if (enquiry) enquiry.pipeline_status = newStage;
      // Update the summary-row badge live without re-rendering everything.
      const detailRow = sel.closest('tr.detail-row');
      const summaryRow = detailRow?.previousElementSibling;
      const badge = summaryRow?.querySelector('.pipe-badge');
      if (badge) { const b = pipelineBadge(newStage); badge.className = b.cls; badge.textContent = b.label; }
      sel.style.background = 'rgba(39,174,96,0.16)'; setTimeout(() => sel.style.background = '', 800);
      return;
    }

    // CRM: follow-up date input
    const fu = evt.target.closest('.crm-followup-input');
    if (fu) {
      const id = fu.getAttribute('data-id');
      const v = fu.value;
      const iso = v ? new Date(v + 'T00:00:00').toISOString() : null;
      fu.disabled = true;
      const { error } = await db.from('enquiries').update({ next_followup_at: iso }).eq('id', id);
      fu.disabled = false;
      if (error) { console.error('Follow-up save failed:', error); fu.style.outline = '2px solid #c62828'; setTimeout(() => fu.style.outline = '', 1500); return; }
      const enquiry = allEnquiries.find(x => String(x.id) === String(id));
      if (enquiry) enquiry.next_followup_at = iso;
      fu.style.background = 'rgba(39,174,96,0.16)'; setTimeout(() => fu.style.background = '', 800);
      return;
    }

    // CRM: marketing consent toggle
    const consent = evt.target.closest('.crm-consent-check');
    if (consent) {
      const id = consent.getAttribute('data-id');
      const checked = consent.checked;
      consent.disabled = true;
      const { error } = await db.from('enquiries').update({ marketing_consent: checked }).eq('id', id);
      consent.disabled = false;
      if (error) { console.error('Consent save failed:', error); consent.checked = !checked; return; }
      const enquiry = allEnquiries.find(x => String(x.id) === String(id));
      if (enquiry) enquiry.marketing_consent = checked;
      return;
    }

    const inp = evt.target.closest('.drink-qty-input');
    if (!inp) return;
    const id = inp.getAttribute('data-enquiry-id');
    const idx = parseInt(inp.getAttribute('data-drink-index'), 10);
    const enquiry = allEnquiries.find(x => String(x.id) === String(id));
    if (!enquiry || !Array.isArray(enquiry.drinks) || !enquiry.drinks[idx]) return;

    const next = Math.max(0, Math.min(999, Math.floor(Number(inp.value) || 0)));
    inp.value = next;
    enquiry.drinks[idx].qty = next;

    inp.disabled = true;
    const { error } = await db
      .from('enquiries')
      .update({ drinks: enquiry.drinks })
      .eq('id', id);
    inp.disabled = false;

    if (error) {
      console.error('Drink qty save failed:', error);
      inp.style.outline = '2px solid #c62828';
      setTimeout(() => { inp.style.outline = ''; }, 1500);
      return;
    }
    inp.style.background = 'rgba(39,174,96,0.16)';
    setTimeout(() => { inp.style.background = ''; }, 800);
  });
  tbody.addEventListener('keydown', evt => {
    if (evt.key === 'Enter' && evt.target.closest('.drink-qty-input')) {
      evt.preventDefault();
      evt.target.blur();
    }
  });

  // CRM: add note (form submit)
  tbody.addEventListener('submit', async evt => {
    const form = evt.target.closest('.crm-notes__form');
    if (!form) return;
    evt.preventDefault();
    const id = form.getAttribute('data-id');
    const ta = form.querySelector('.crm-note-input');
    const body = (ta.value || '').trim();
    if (!body) return;
    const sub = form.querySelector('button[type=submit]');
    sub.disabled = true;
    const author = (await db.auth.getSession())?.data?.session?.user?.email || null;
    const { data, error } = await db.from('enquiry_notes')
      .insert({ enquiry_id: id, body, author_email: author })
      .select().single();
    sub.disabled = false;
    if (error) { console.error('Note add failed:', error); ta.style.outline = '2px solid #c62828'; setTimeout(() => ta.style.outline = '', 1500); return; }
    (notesByEnquiry[id] ||= []).unshift(data);
    ta.value = '';
    // Re-render only this enquiry's notes list.
    const list = document.getElementById('notes-' + id);
    if (list) {
      const html = notesByEnquiry[id].map(n => `
        <li class="crm-note" data-note-id="${n.id}">
          <div class="crm-note__meta">
            <span class="crm-note__time">${esc(fmtDate(n.created_at))}</span>
            ${n.author_email ? `<span class="crm-note__author">· ${esc(n.author_email)}</span>` : ''}
            <button class="crm-note__del" data-note-del="${n.id}" data-enquiry-id="${esc(id)}" title="${t('crm_note_delete')}">×</button>
          </div>
          <div class="crm-note__body">${esc(n.body)}</div>
        </li>`).join('');
      list.innerHTML = html;
    }
  });

  tbody.addEventListener('click', async evt => {
    // CRM: delete note
    const noteDel = evt.target.closest('.crm-note__del');
    if (noteDel) {
      const noteId = noteDel.getAttribute('data-note-del');
      const enquiryId = noteDel.getAttribute('data-enquiry-id');
      noteDel.disabled = true;
      const { error } = await db.from('enquiry_notes').delete().eq('id', noteId);
      if (error) { console.error('Note delete failed:', error); noteDel.disabled = false; return; }
      notesByEnquiry[enquiryId] = (notesByEnquiry[enquiryId] || []).filter(n => String(n.id) !== String(noteId));
      const li = noteDel.closest('.crm-note');
      li?.remove();
      const list = document.getElementById('notes-' + enquiryId);
      if (list && !list.children.length) list.innerHTML = `<li class="crm-note crm-note--empty">${t('crm_note_empty')}</li>`;
      return;
    }

    // CRM: clear follow-up date
    const fuClear = evt.target.closest('.crm-followup-clear');
    if (fuClear) {
      const id = fuClear.getAttribute('data-id');
      const { error } = await db.from('enquiries').update({ next_followup_at: null }).eq('id', id);
      if (error) { console.error('Clear follow-up failed:', error); return; }
      const enquiry = allEnquiries.find(x => String(x.id) === String(id));
      if (enquiry) enquiry.next_followup_at = null;
      const fuInput = fuClear.parentElement.querySelector('.crm-followup-input');
      if (fuInput) fuInput.value = '';
      fuClear.remove();
      return;
    }

    // Expand button
    const expandBtn = evt.target.closest('.btn-expand');
    if (expandBtn) {
      const id        = expandBtn.getAttribute('data-id');
      const detailRow = document.getElementById(`detail-${id}`);
      const isOpen    = !detailRow.classList.contains('hidden');

      tbody.querySelectorAll('.detail-row').forEach(r => r.classList.add('hidden'));
      tbody.querySelectorAll('.btn-expand').forEach(b => {
        b.textContent = t('btn_view');
        b.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        detailRow.classList.remove('hidden');
        expandBtn.textContent = t('btn_close');
        expandBtn.setAttribute('aria-expanded', 'true');
      }
      return;
    }

    // Status toggle button
    const statusBtn = evt.target.closest('.btn-status');
    if (statusBtn) {
      const id          = statusBtn.getAttribute('data-id');
      const wasAnswered = statusBtn.getAttribute('data-answered') === 'true';
      const newStatus   = wasAnswered ? 'new' : 'answered';
      const isNowAnswered = newStatus === 'answered';

      // ── Optimistic UI update — apply immediately ──
      const detailRow  = statusBtn.closest('tr.detail-row');
      const summaryRow = detailRow.previousElementSibling;

      const badge = summaryRow.querySelector('.status-badge');
      if (badge) {
        badge.className   = `status-badge ${newStatus}`;
        badge.textContent = isNowAnswered ? t('status_answered') : t('status_new');
      }
      summaryRow.classList.toggle('row-answered', isNowAnswered);

      statusBtn.setAttribute('data-answered', isNowAnswered ? 'true' : 'false');
      statusBtn.className   = `btn btn-sm ${isNowAnswered ? 'btn-outline' : 'btn-primary'} btn-status`;
      statusBtn.textContent = isNowAnswered ? t('btn_mark_new') : t('btn_mark_answered');
      statusBtn.disabled    = true;

      // ── Persist to Supabase — revert on failure ──
      const { error } = await db
        .from('enquiries')
        .update({ status: newStatus })
        .eq('id', id);

      statusBtn.disabled = false;

      if (error) {
        console.error('Failed to update status:', error);
        // Revert UI
        const revertStatus = wasAnswered ? 'answered' : 'new';
        if (badge) {
          badge.className   = `status-badge ${revertStatus}`;
          badge.textContent = wasAnswered ? t('status_answered') : t('status_new');
        }
        summaryRow.classList.toggle('row-answered', wasAnswered);
        statusBtn.setAttribute('data-answered', wasAnswered ? 'true' : 'false');
        statusBtn.className   = `btn btn-sm ${wasAnswered ? 'btn-outline' : 'btn-primary'} btn-status`;
        statusBtn.textContent = wasAnswered ? t('btn_mark_new') : t('btn_mark_answered');
        return;
      }

      // Update local cache
      const enquiry = allEnquiries.find(e => String(e.id) === String(id));
      if (enquiry) enquiry.status = newStatus;
      renderStatusTabCounts();
      // If the row no longer matches the active filter, drop it from view.
      const isVisibleAfter = (statusFilter === 'all')
        || (statusFilter === 'answered'   && newStatus === 'answered')
        || (statusFilter === 'unanswered' && newStatus !== 'answered');
      if (!isVisibleAfter) renderEnquiries(applyStatusFilter(allEnquiries));
    }

    // Edit payment — switch to edit mode
    const editPayBtn = evt.target.closest('.btn-edit-payment');
    if (editPayBtn) {
      const wrap = editPayBtn.closest('.payment-tracking');
      wrap.classList.remove('is-view');
      wrap.classList.add('is-edit');
      editPayBtn.style.display = 'none';
      wrap.querySelector('.btn-cancel-payment').style.display = '';
      return;
    }

    // Cancel payment edit — revert to view mode, restore fields from cache
    const cancelPayBtn = evt.target.closest('.btn-cancel-payment');
    if (cancelPayBtn) {
      const id = cancelPayBtn.getAttribute('data-id');
      const wrap = cancelPayBtn.closest('.payment-tracking');
      const enquiry = allEnquiries.find(x => String(x.id) === String(id));
      const pt = enquiry?.payment_tracking || {};
      wrap.querySelectorAll('input[data-payment-key]').forEach(inp => {
        inp.value = pt[inp.getAttribute('data-payment-key')] || '';
      });
      wrap.classList.remove('is-edit');
      wrap.classList.add('is-view');
      wrap.querySelector('.btn-edit-payment').style.display = '';
      cancelPayBtn.style.display = 'none';
      return;
    }

    // Save payment tracking
    const payBtn = evt.target.closest('.btn-save-payment');
    if (payBtn) {
      const id = payBtn.getAttribute('data-id');
      const wrap = payBtn.closest('.payment-tracking');
      const statusEl = wrap.querySelector('.payment-status');
      const patch = {};
      wrap.querySelectorAll('input[data-payment-key]').forEach(inp => {
        const k = inp.getAttribute('data-payment-key');
        const v = inp.value.trim();
        if (v) patch[k] = v;
      });

      payBtn.disabled = true;
      statusEl.textContent = '';
      const { error } = await db
        .from('enquiries')
        .update({ payment_tracking: patch })
        .eq('id', id);
      payBtn.disabled = false;

      if (error) {
        console.error('Payment save failed:', error);
        statusEl.textContent = '⚠';
        return;
      }
      statusEl.textContent = '✓ ' + t('payment_saved');
      const enquiry = allEnquiries.find(x => String(x.id) === String(id));
      if (enquiry) enquiry.payment_tracking = patch;

      // Update view-mode display in place
      wrap.querySelectorAll('.payment-view-row').forEach((row, i) => {
        const key = ['bank', 'cash', 'card'][i];
        const strong = row.querySelector('strong');
        strong.textContent = patch[key] || t('payment_empty');
      });

      // Flip to view mode
      setTimeout(() => {
        statusEl.textContent = '';
        wrap.classList.remove('is-edit');
        wrap.classList.add('is-view');
        wrap.querySelector('.btn-edit-payment').style.display = '';
        wrap.querySelector('.btn-cancel-payment').style.display = 'none';
      }, 800);
      return;
    }

    // Export offer — generate populated .xlsx for download.
    const exportBtn = evt.target.closest('.btn-export-offer');
    if (exportBtn) {
      const id = exportBtn.getAttribute('data-id');
      const enquiry = allEnquiries.find(x => String(x.id) === String(id));
      if (!enquiry) return;

      const origText = exportBtn.textContent;
      exportBtn.disabled = true;
      exportBtn.textContent = t('export_working');

      try {
        const result = await window.exportOfferXLSX(enquiry);
        if (result?.unmapped?.length) {
          alert(t('export_unmapped').replace('{list}', result.unmapped.join(', ')));
        }
      } catch (err) {
        console.error('Offer export failed:', err);
        alert(t('export_failed'));
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = origText;
      }
      return;
    }

    // Delete enquiry — destructive, requires confirmation. Cleans up the
    // linked occupied_dates row too so the calendar doesn't keep a ghost.
    const delBtn = evt.target.closest('.btn-delete-enquiry');
    if (delBtn) {
      const id = delBtn.getAttribute('data-id');
      const name = delBtn.getAttribute('data-name') || '';
      const ok = window.confirm(t('delete_confirm').replace('{name}', name));
      if (!ok) return;

      delBtn.disabled = true;

      // Try to clean up the occupied_dates row first (best-effort; ignore if missing).
      const enquiry = allEnquiries.find(x => String(x.id) === String(id));
      const dd = enquiry?.preferred_date;
      if (dd && /^\d{2}\/\d{2}\/\d{4}$/.test(dd)) {
        const [d, m, y] = dd.split('/');
        const iso = `${y}-${m}-${d}`;
        await db.from('occupied_dates').delete().eq('date', iso);
      }

      const { error } = await db.from('enquiries').delete().eq('id', id);
      delBtn.disabled = false;

      if (error) {
        console.error('Delete failed:', error);
        alert(t('delete_failed'));
        return;
      }

      // Drop both rows from DOM and from the cache.
      const detailRow = delBtn.closest('tr.detail-row');
      const summaryRow = detailRow?.previousElementSibling;
      detailRow?.remove();
      summaryRow?.remove();
      const idx = allEnquiries.findIndex(x => String(x.id) === String(id));
      if (idx >= 0) allEnquiries.splice(idx, 1);

      if (allEnquiries.length === 0) renderEnquiries(allEnquiries);
      return;
    }

    // Lock toggle button — optimistic in-place update; do NOT re-render
    // (renderEnquiries re-binds the tbody click listener, stacking handlers).
    const lockBtn = evt.target.closest('.btn-lock');
    if (lockBtn) {
      const id = lockBtn.getAttribute('data-id');
      const wasLocked = lockBtn.getAttribute('data-locked') === 'true';
      const newLocked = !wasLocked;

      const detailRow = lockBtn.closest('tr.detail-row');
      const summaryRow = detailRow?.previousElementSibling;

      lockBtn.disabled = true;
      // "Потвърди резервация" now means: lock customer edits AND flip the
      // pipeline stage to 'confirmed' (so the auto-block-date trigger
      // marks the calendar). Undoing rolls the stage back to 'new' — we
      // don't try to remember the previous stage, since the explicit
      // pipeline dropdown above is the place to set anything finer.
      const patch = newLocked
        ? { edit_locked: true,  pipeline_status: 'confirmed' }
        : { edit_locked: false, pipeline_status: 'new' };
      const { error } = await db
        .from('enquiries')
        .update(patch)
        .eq('id', id);

      if (error) {
        console.error('Lock toggle failed:', error);
        lockBtn.disabled = false;
        return;
      }

      // Sync with occupied_dates: lock => mark date occupied, unlock => unmark.
      // preferred_date is stored as "DD/MM/YYYY"; occupied_dates uses "YYYY-MM-DD".
      // Partial-failure paths surface a visible warning so the admin doesn't
      // think the calendar is in sync when it isn't.
      const enquiry = allEnquiries.find(x => String(x.id) === String(id));
      const dd = enquiry?.preferred_date;
      let syncWarning = '';
      if (dd && /^\d{2}\/\d{2}\/\d{4}$/.test(dd)) {
        const [d, m, y] = dd.split('/');
        const iso = `${y}-${m}-${d}`;
        if (newLocked) {
          const { error: insErr } = await db.from('occupied_dates').insert({ date: iso });
          if (insErr && !/duplicate|unique/i.test(insErr.message ?? '')) {
            console.warn('Could not mark date occupied:', insErr);
            syncWarning = 'calendar sync failed';
          }
        } else {
          const { error: delErr } = await db.from('occupied_dates').delete().eq('date', iso);
          if (delErr) {
            console.warn('Could not unmark date:', delErr);
            syncWarning = 'calendar sync failed';
          }
        }
      }

      lockBtn.disabled = false;

      // Flip button label + data attr
      lockBtn.setAttribute('data-locked', newLocked ? 'true' : 'false');
      lockBtn.textContent = newLocked ? t('edit_unlock_btn') : t('edit_lock_btn');

      // Add or remove the "Заключено" badge on the summary row in place.
      if (summaryRow) {
        const statusCell = summaryRow.querySelector('td:nth-child(7)');
        const existing = statusCell?.querySelector('.status-badge.locked');
        if (newLocked && !existing && statusCell) {
          const badge = document.createElement('span');
          badge.className = 'status-badge locked';
          badge.style.marginLeft = '6px';
          badge.textContent = t('edit_locked_badge');
          statusCell.appendChild(badge);
        } else if (!newLocked && existing) {
          existing.remove();
        }
      }

      // Keep the cache in sync so a later render (e.g. language switch) is correct.
      if (enquiry) {
        enquiry.edit_locked = newLocked;
        enquiry.pipeline_status = newLocked ? 'confirmed' : 'new';
      }
      // Reflect the pipeline change on the summary-row badge + the dropdown
      // in the CRM panel, so the UI stays consistent without a full re-render.
      const pipeBadge = summaryRow?.querySelector('.pipe-badge');
      if (pipeBadge) {
        const b = pipelineBadge(newLocked ? 'confirmed' : 'new');
        pipeBadge.className = b.cls;
        pipeBadge.textContent = b.label;
      }
      const stageSel = detailRow?.querySelector('.crm-stage-select');
      if (stageSel) stageSel.value = newLocked ? 'confirmed' : 'new';

      if (syncWarning) {
        alert(`${t('edit_lock_btn')}: ${syncWarning}`);
      }
      return;
    }
  });
}

// Venue base prices (EUR) keyed by event_id, mirroring the public reservation
// catalog and the send-enquiry-summary edge function. Update all three places
// together if pricing changes.
const VENUE_BASE_PRICE_EUR = {
  evening: 1280,
  corp4: 330,
  corp8: 440,
  bday_day: 700,
  bday_eve: 970,
  wedding: 1500,
};

// Venue covers up to VENUE_MIN_GUESTS guests; each one above that is billed
// at EXTRA_GUEST_FEE_EUR. Keep in sync with the email module and the public
// reservation form.
const VENUE_MIN_GUESTS = 40;
const EXTRA_GUEST_FEE_EUR = 15;

function computeTotals(e) {
  const venue = VENUE_BASE_PRICE_EUR[e.event_id] || 0;
  const guests = Number(e.guests) || 0;
  const extraGuests = Math.max(0, guests - VENUE_MIN_GUESTS);
  const extraGuestsCost = extraGuests * EXTRA_GUEST_FEE_EUR;
  const addons = (e.addons || []).reduce(
    (sum, a) => sum + addonPriceEur(a?.id, Number(a?.price) || 0), 0,
  );
  const drinks = (e.drinks || []).reduce(
    (sum, d) => sum + (Number(d?.price_eur) || 0) * (Number(d?.qty) || 0), 0,
  );
  return {
    venue, extraGuests, extraGuestsCost, addons, drinks,
    total: venue + extraGuestsCost + addons + drinks,
  };
}

function renderTotals(e) {
  const totals = computeTotals(e);
  const row = (label, value) => `
    <div class="total-row">
      <span>${label}</span>
      <strong>€${value.toFixed(2)}</strong>
    </div>`;
  return `
    <div class="detail-totals">
      <h4 class="payment-heading">${t('total_heading')}</h4>
      ${totals.venue  ? row(`${t('total_venue')} · ${esc(e.event_type)} <span style="color:#888;font-size:0.78rem">(до ${VENUE_MIN_GUESTS} гости)</span>`, totals.venue) : ''}
      ${totals.extraGuests > 0 ? row(`+${totals.extraGuests} допълнителни гости <span style="color:#888;font-size:0.78rem">(× €${EXTRA_GUEST_FEE_EUR})</span>`, totals.extraGuestsCost) : ''}
      ${totals.addons ? row(t('total_addons'), totals.addons) : ''}
      ${totals.drinks ? row(t('total_drinks'), totals.drinks) : ''}
      <div class="total-row total-grand">
        <span>${t('total_grand')}</span>
        <strong>€${totals.total.toFixed(2)}</strong>
      </div>
    </div>
  `;
}

function renderPaymentTracking(e) {
  const pt = e.payment_tracking || {};
  const hasAny = !!(pt.bank || pt.cash || pt.card);
  const mode = hasAny ? 'view' : 'edit';
  return `
    <div class="payment-tracking ${mode === 'view' ? 'is-view' : 'is-edit'}" data-id="${esc(e.id)}">
      <div class="payment-header">
        <h4 class="payment-heading">${t('payment_heading')}</h4>
        <button class="btn btn-sm btn-outline btn-edit-payment" data-id="${esc(e.id)}"
                style="${mode === 'view' ? '' : 'display:none'}">
          ${t('payment_edit')}
        </button>
      </div>

      <div class="payment-view">
        <div class="payment-view-row"><span>${t('payment_bank')}:</span><strong>${pt.bank ? esc(pt.bank) : t('payment_empty')}</strong></div>
        <div class="payment-view-row"><span>${t('payment_cash')}:</span><strong>${pt.cash ? esc(pt.cash) : t('payment_empty')}</strong></div>
        <div class="payment-view-row"><span>${t('payment_card')}:</span><strong>${pt.card ? esc(pt.card) : t('payment_empty')}</strong></div>
      </div>

      <div class="payment-edit">
        <label class="payment-row">
          <span>${t('payment_bank')}:</span>
          <input type="text" data-payment-key="bank" value="${esc(pt.bank || '')}">
        </label>
        <label class="payment-row">
          <span>${t('payment_cash')}:</span>
          <input type="text" data-payment-key="cash" value="${esc(pt.cash || '')}">
        </label>
        <label class="payment-row">
          <span>${t('payment_card')}:</span>
          <input type="text" data-payment-key="card" value="${esc(pt.card || '')}">
        </label>
        <div class="payment-actions">
          <button class="btn btn-sm btn-primary btn-save-payment" data-id="${esc(e.id)}">${t('payment_save')}</button>
          <button class="btn btn-sm btn-outline btn-cancel-payment" data-id="${esc(e.id)}"${hasAny ? '' : ' style="display:none"'}>${t('payment_cancel')}</button>
          <span class="payment-status" aria-live="polite"></span>
        </div>
      </div>
    </div>
  `;
}

function esc(str) {
  if (str == null) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtAddons(addons) {
  if (!Array.isArray(addons) || !addons.length) return '';
  const items = addons.map(a => {
    const price = Number(a?.price);
    const priceStr = Number.isFinite(price) ? addonPriceEur(a?.id, price).toFixed(2) : '—';
    return `<li>${esc(a?.name)} — €${priceStr}</li>`;
  }).join('');
  return `<div class="detail-section"><strong>${t('detail_addons')}:</strong><ul>${items}</ul></div>`;
}

function fmtDrinks(drinks, enquiryId) {
  if (!Array.isArray(drinks) || !drinks.length) return '';
  // Editable: typable qty input per drink. Saves on blur via the
  // .drink-qty-input handler bound in bindTableHandlers().
  const items = drinks.map((d, i) => {
    const qty = Number(d?.qty);
    const qtyVal = Number.isInteger(qty) && qty >= 0 ? qty : 0;
    return `<li class="admin-drink-row">
      <span class="admin-drink-name">${esc(d?.name)}</span>
      <span class="admin-drink-qty">
        <span class="admin-drink-qty__times">×</span>
        <input type="number" class="drink-qty-input"
               data-enquiry-id="${esc(enquiryId)}"
               data-drink-index="${i}"
               value="${qtyVal}" min="0" max="999" step="1" inputmode="numeric"
               aria-label="Количество">
      </span>
    </li>`;
  }).join('');
  return `<div class="detail-section"><strong>${t('detail_drinks')}:</strong><ul class="admin-drink-list">${items}</ul></div>`;
}

