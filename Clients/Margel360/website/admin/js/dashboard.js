let allEnquiries = [];

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  const loadingEl = document.getElementById('loading');
  const wrapEl    = document.getElementById('enquiries-wrap');

  const { data: enquiries, error } = await db
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false });

  loadingEl.style.display = 'none';
  wrapEl.style.display = 'block';

  if (error) {
    wrapEl.innerHTML = `<p style="color:var(--accent);padding:20px 0">${t('dash_error')}</p>`;
    console.error('Failed to fetch enquiries:', error);
    return;
  }

  allEnquiries = enquiries || [];
  renderEnquiries(allEnquiries);

  // Bind the tbody click handler exactly once. Doing it inside
  // renderEnquiries caused listeners to stack on every language switch.
  bindTableHandlers();
});

// Called by admin-i18n.js when language is switched
function rerenderPage() {
  // Re-apply static i18n (handled by applyAdminLang already)
  // Re-render dynamic table so translated strings update
  renderEnquiries(allEnquiries);
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
        ${e.edit_locked ? `<span class="status-badge locked" style="margin-left:6px">${t('edit_locked_badge')}</span>` : ''}
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
            <div><strong>${t('detail_time')}:</strong> ${e.time_of_day === 'day' ? t('detail_time_day') : t('detail_time_eve')}</div>
            <div><strong>${t('detail_payment')}:</strong> ${esc(e.payment_method)}</div>
          </div>
          ${fmtAddons(e.addons)}
          ${fmtDrinks(e.drinks)}
          ${e.notes ? `<div class="detail-notes"><strong>${t('detail_notes')}:</strong> ${esc(e.notes)}</div>` : ''}
          ${renderPaymentTracking(e)}
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

  tbody.addEventListener('click', async evt => {
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
      const { error } = await db
        .from('enquiries')
        .update({ edit_locked: newLocked })
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
      if (enquiry) enquiry.edit_locked = newLocked;

      if (syncWarning) {
        alert(`${t('edit_lock_btn')}: ${syncWarning}`);
      }
      return;
    }
  });
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
    const priceStr = Number.isFinite(price) ? (price / 1.95583).toFixed(2) : '—';
    return `<li>${esc(a?.name)} — €${priceStr}</li>`;
  }).join('');
  return `<div class="detail-section"><strong>${t('detail_addons')}:</strong><ul>${items}</ul></div>`;
}

function fmtDrinks(drinks) {
  if (!Array.isArray(drinks) || !drinks.length) return '';
  const items = drinks.map(d => {
    const qty = Number(d?.qty);
    const qtyStr = Number.isInteger(qty) && qty >= 0 ? qty : '?';
    return `<li>${esc(d?.name)} × ${qtyStr}</li>`;
  }).join('');
  return `<div class="detail-section"><strong>${t('detail_drinks')}:</strong><ul>${items}</ul></div>`;
}
