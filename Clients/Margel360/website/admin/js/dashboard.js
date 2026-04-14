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
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${t('dash_empty')}</td></tr>`;
    return;
  }

  tbody.innerHTML = '';

  enquiries.forEach(e => {
    const isAnswered = e.status === 'answered';

    // Main summary row
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(e.full_name)}</td>
      <td>${esc(e.phone)}</td>
      <td>${esc(e.event_type)}</td>
      <td>${esc(e.preferred_date)}</td>
      <td>${fmtDate(e.created_at)}</td>
      <td>
        <span class="status-badge ${isAnswered ? 'answered' : 'new'}">
          ${isAnswered ? t('status_answered') : t('status_new')}
        </span>
      </td>
      <td><button class="btn-expand" aria-expanded="false" data-id="${esc(e.id)}">${t('btn_view')}</button></td>
    `;
    tbody.appendChild(tr);

    // Detail row (hidden by default)
    const detailTr = document.createElement('tr');
    detailTr.className = 'detail-row hidden';
    detailTr.id = `detail-${e.id}`;
    detailTr.innerHTML = `
      <td colspan="7">
        <div class="detail-panel">
          <div class="detail-grid">
            <div><strong>${t('detail_email')}:</strong> ${esc(e.email)}</div>
            <div><strong>${t('detail_guests')}:</strong> ${e.guests != null ? e.guests : '—'}</div>
            <div><strong>${t('detail_time')}:</strong> ${e.time_of_day === 'day' ? t('detail_time_day') : t('detail_time_eve')}</div>
            <div><strong>${t('detail_payment')}:</strong> ${esc(e.payment_method)}</div>
          </div>
          ${fmtAddons(e.addons)}
          ${fmtDrinks(e.drinks)}
          ${e.notes ? `<div class="detail-notes"><strong>${t('detail_notes')}:</strong> ${esc(e.notes)}</div>` : ''}
          <div class="detail-actions">
            <button class="btn btn-sm ${isAnswered ? 'btn-outline' : 'btn-primary'} btn-status"
              data-id="${esc(e.id)}"
              data-answered="${isAnswered ? 'true' : 'false'}">
              ${isAnswered ? t('btn_mark_new') : t('btn_mark_answered')}
            </button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(detailTr);
  });

  // Toggle expand/collapse
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
      const id         = statusBtn.getAttribute('data-id');
      const wasAnswered = statusBtn.getAttribute('data-answered') === 'true';
      const newStatus  = wasAnswered ? 'new' : 'answered';

      statusBtn.disabled = true;

      const { error } = await db
        .from('enquiries')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) {
        console.error('Failed to update status:', error);
        statusBtn.disabled = false;
        return;
      }

      // Update local cache
      const enquiry = allEnquiries.find(e => String(e.id) === String(id));
      if (enquiry) enquiry.status = newStatus;

      // Update the badge in the summary row
      const summaryRow = statusBtn.closest('tr.detail-row').previousElementSibling;
      const badge = summaryRow.querySelector('.status-badge');
      if (badge) {
        badge.className = `status-badge ${newStatus}`;
        badge.textContent = newStatus === 'answered' ? t('status_answered') : t('status_new');
      }

      // Update the button itself
      const isNowAnswered = newStatus === 'answered';
      statusBtn.setAttribute('data-answered', isNowAnswered ? 'true' : 'false');
      statusBtn.className = `btn btn-sm ${isNowAnswered ? 'btn-outline' : 'btn-primary'} btn-status`;
      statusBtn.textContent = isNowAnswered ? t('btn_mark_new') : t('btn_mark_answered');
      statusBtn.disabled = false;
    }
  });
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
  const items = addons.map(a => `<li>${esc(a.name)} — €${(a.price / 1.95583).toFixed(2)}</li>`).join('');
  return `<div class="detail-section"><strong>${t('detail_addons')}:</strong><ul>${items}</ul></div>`;
}

function fmtDrinks(drinks) {
  if (!Array.isArray(drinks) || !drinks.length) return '';
  const items = drinks.map(d => `<li>${esc(d.name)} × ${d.qty}</li>`).join('');
  return `<div class="detail-section"><strong>${t('detail_drinks')}:</strong><ul>${items}</ul></div>`;
}
