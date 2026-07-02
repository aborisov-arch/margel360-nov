// Customers view - groups enquiries by normalised email (then phone) so the
// team can see every contact and their full history in one place.
// Click a row to expand the enquiry list with status, date, guests, est.
// total spend per event.

let allEnquiries = [];
let grouped = []; // [{ key, label, contact, count, lastAt, lifetime, events:Set, marketing, enquiries:[...]}]

// dashboard.js owns the canonical esc/fmtDate. This page doesn't load
// dashboard.js, so re-declare the small helpers here.
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('bg-BG', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function customerKey(e) {
  const em = (e.email || '').trim().toLowerCase();
  if (em) return 'e:' + em;
  const ph = (e.phone || '').replace(/\D/g, '');
  if (ph) return 'p:' + ph;
  return '';
}

// Very rough event-price estimate from the catalog columns we already have.
// Mirrors the homepage prices; fine for ranking/marketing, not invoicing.
const EVENT_BASE = { evening: 1280, wedding: 1500, corp4: 330, corp8: 440, bday_day: 700, bday_eve: 970 };
function estimateTotal(e) {
  // Mirrors the reservation wizard / email math: addons store the LINE price
  // (qty already folded in), drinks store unit price_eur × qty, venue covers
  // 40 guests (+€15 each above), discount applies to the venue base only.
  const base = EVENT_BASE[e.event_id] || 0;
  const extraGuests = Math.max(0, (Number(e.guests) || 0) - 40);
  const addons = Array.isArray(e.addons) ? e.addons.reduce((s, a) => s + (Number(a.price) || 0), 0) : 0;
  const drinks = Array.isArray(e.drinks) ? e.drinks.reduce((s, d) => s + (Number(d.price_eur) || 0) * (Number(d.qty) || 0), 0) : 0;
  const pct = Number(e.applied_discount_percent || 0);
  const discount = pct > 0 ? base * pct / 100 : 0;
  return Math.round(base - discount + extraGuests * 15 + addons + drinks);
}

function groupEnquiries(enquiries) {
  const map = new Map();
  enquiries.forEach(e => {
    const key = customerKey(e);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        key, label: e.full_name || '-',
        contact: e.email || e.phone || '',
        count: 0, lastAt: e.created_at, lifetime: 0,
        events: new Set(), marketing: false, enquiries: [],
      });
    }
    const g = map.get(key);
    g.enquiries.push(e);
    g.count++;
    if (new Date(e.created_at) > new Date(g.lastAt)) {
      g.lastAt = e.created_at;
      g.label = e.full_name || g.label;
    }
    g.lifetime += estimateTotal(e);
    if (e.event_type) g.events.add(e.event_type);
    if (e.marketing_consent) g.marketing = true;
  });
  return Array.from(map.values()).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

function renderRows(rows) {
  const tbody = document.getElementById('customers-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${t('customers_empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(g => `
    <tr data-key="${esc(g.key)}">
      <td><strong>${esc(g.label)}</strong>${g.marketing ? ' <span class="pipe-badge pipe-confirmed" title="Marketing consent">✓</span>' : ''}</td>
      <td>${esc(g.contact)}</td>
      <td>${g.count}</td>
      <td>${esc(fmtDate(g.lastAt))}</td>
      <td>${Array.from(g.events).map(esc).join(', ') || '-'}</td>
      <td>€${g.lifetime}</td>
    </tr>
  `).join('');
}

function renderDetail(g) {
  const wrap = document.getElementById('customer-detail');
  if (!g) { wrap.innerHTML = ''; return; }
  const rows = g.enquiries
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(e => `
      <div class="enquiry-row">
        <strong>${esc(e.event_type || '-')}</strong>
        <span>${esc(e.preferred_date || '')}</span>
        <span>${e.guests != null ? e.guests + ' гости' : ''}</span>
        <span class="pipe-badge pipe-${esc(e.pipeline_status || 'new')}">${esc(e.pipeline_status || 'new')}</span>
        <span style="margin-left:auto;color:#888;font-size:0.85em">${esc(fmtDate(e.created_at))}</span>
        <a href="dashboard.html#enquiry-${esc(e.id)}" style="color:var(--accent);text-decoration:none">→</a>
      </div>
    `).join('');
  wrap.innerHTML = `
    <div class="customer-detail">
      <h2>${esc(g.label)}</h2>
      <p class="sub">${esc(g.contact)} · ${g.count} запитвания · общо €${g.lifetime}</p>
      ${rows}
    </div>
  `;
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function applyFilter() {
  const q = (document.getElementById('customers-search').value || '').trim().toLowerCase();
  if (!q) return renderRows(grouped);
  const filtered = grouped.filter(g =>
    (g.label || '').toLowerCase().includes(q) ||
    (g.contact || '').toLowerCase().includes(q) ||
    Array.from(g.events).some(ev => (ev || '').toLowerCase().includes(q))
  );
  renderRows(filtered);
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  const { data, error } = await db.from('enquiries').select('*').order('created_at', { ascending: false });
  document.getElementById('loading').style.display = 'none';
  document.getElementById('customers-wrap').style.display = 'block';
  if (error) {
    document.getElementById('customers-wrap').innerHTML = `<p style="color:#c62828">Грешка при зареждане.</p>`;
    console.error(error);
    return;
  }

  allEnquiries = data || [];
  grouped = groupEnquiries(allEnquiries);
  renderRows(grouped);

  document.getElementById('customers-search').addEventListener('input', applyFilter);

  document.getElementById('customers-body').addEventListener('click', evt => {
    const tr = evt.target.closest('tr[data-key]');
    if (!tr) return;
    const g = grouped.find(x => x.key === tr.dataset.key);
    renderDetail(g);
  });

  // Deep-link from dashboard: ?c=e:email@example.com
  const params = new URLSearchParams(location.search);
  const c = params.get('c');
  if (c) {
    const g = grouped.find(x => x.key === c);
    if (g) renderDetail(g);
  }
});

function rerenderPage() {
  renderRows(grouped);
}
