document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  const loadingEl = document.getElementById('loading');
  const wrapEl = document.getElementById('enquiries-wrap');

  const { data: enquiries, error } = await db
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false });

  loadingEl.style.display = 'none';
  wrapEl.style.display = 'block';

  if (error) {
    wrapEl.innerHTML = '<p style="color:#e63030;padding:20px 0">Failed to load enquiries. Check console.</p>';
    console.error('Failed to fetch enquiries:', error);
    return;
  }

  renderEnquiries(enquiries);
});

function renderEnquiries(enquiries) {
  const tbody = document.getElementById('enquiries-body');

  if (!enquiries || !enquiries.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No enquiries received yet.</td></tr>';
    return;
  }

  tbody.innerHTML = '';

  enquiries.forEach(e => {
    // Main summary row
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(e.full_name)}</td>
      <td>${esc(e.phone)}</td>
      <td>${esc(e.event_type)}</td>
      <td>${esc(e.preferred_date)}</td>
      <td>${fmtDate(e.created_at)}</td>
      <td><button class="btn-expand" aria-expanded="false" data-id="${esc(e.id)}">View</button></td>
    `;
    tbody.appendChild(tr);

    // Detail row (hidden by default)
    const detailTr = document.createElement('tr');
    detailTr.className = 'detail-row hidden';
    detailTr.id = `detail-${e.id}`;
    detailTr.innerHTML = `
      <td colspan="6">
        <div class="detail-panel">
          <div class="detail-grid">
            <div><strong>Email:</strong> ${esc(e.email)}</div>
            <div><strong>Guests:</strong> ${e.guests != null ? e.guests : '—'}</div>
            <div><strong>Time:</strong> ${e.time_of_day === 'day' ? 'Daytime (until 17:30)' : 'Evening (after 19:00)'}</div>
            <div><strong>Payment:</strong> ${esc(e.payment_method)}</div>
          </div>
          ${fmtAddons(e.addons)}
          ${fmtDrinks(e.drinks)}
          ${e.notes ? `<div class="detail-notes"><strong>Notes:</strong> ${esc(e.notes)}</div>` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(detailTr);
  });

  // Toggle expand/collapse via event delegation
  tbody.addEventListener('click', evt => {
    const btn = evt.target.closest('.btn-expand');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const detailRow = document.getElementById(`detail-${id}`);
    const isOpen = !detailRow.classList.contains('hidden');

    // Close all open rows first
    tbody.querySelectorAll('.detail-row').forEach(r => r.classList.add('hidden'));
    tbody.querySelectorAll('.btn-expand').forEach(b => {
      b.textContent = 'View';
      b.setAttribute('aria-expanded', 'false');
    });

    // Open this one if it was previously closed
    if (!isOpen) {
      detailRow.classList.remove('hidden');
      btn.textContent = 'Close';
      btn.setAttribute('aria-expanded', 'true');
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
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtAddons(addons) {
  if (!Array.isArray(addons) || !addons.length) return '';
  const items = addons
    .map(a => `<li>${esc(a.name)} — €${(a.price / 1.95583).toFixed(2)}</li>`)
    .join('');
  return `<div class="detail-section"><strong>Add-on services:</strong><ul>${items}</ul></div>`;
}

function fmtDrinks(drinks) {
  if (!Array.isArray(drinks) || !drinks.length) return '';
  const items = drinks
    .map(d => `<li>${esc(d.name)} × ${d.qty}</li>`)
    .join('');
  return `<div class="detail-section"><strong>Drinks:</strong><ul>${items}</ul></div>`;
}
