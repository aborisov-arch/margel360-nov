// Customers view - groups enquiries by normalised email (then phone) so the
// team can see every contact and their full history in one place.
// Click a row to expand the enquiry list with status, date, guests, est.
// total spend per event.

let allEnquiries = [];
let grouped = []; // [{ key, label, contact, count, lastAt, lifetime, events:Set, marketing, enquiries:[...], codes, usedForeign }]
// Survey rewards: discount_codes rows (issued_for_enquiry_id = the event the
// customer reviewed, redeemed_for_enquiry_id = the booking that used it) and
// each enquiry's first survey answer. Loaded next to the enquiries.
let discountCodes = [];
let feedbackByEnquiry = new Map();
let perksError = null;

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
const EVENT_BASE = { evening: 1350, wedding: 1500, corp4: 330, corp8: 440, bday_day: 700, bday_eve: 970 };
function estimateTotal(e) {
  // Mirrors the reservation wizard / email math: addons store the LINE price
  // (qty already folded in), drinks store unit price_eur × qty, venue covers
  // 40 guests (+€15 each above), discount applies to the venue base only.
  // Stamped effective venue price (seasonal calendar) with legacy fallback
  // for pre-stamp rows (e.venue_price_eur is NULL).
  const base = e.venue_price_eur != null ? Number(e.venue_price_eur) : (EVENT_BASE[e.event_id] || 0);
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
    if (e.event_type) g.events.add(eventTypeBg(e));
    if (e.marketing_consent) g.marketing = true;
  });
  const groups = Array.from(map.values()).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  groups.forEach(g => {
    const ids = new Set(g.enquiries.map(e => e.id));
    g.codes = discountCodes.filter(c => ids.has(c.issued_for_enquiry_id));
    // A code earned by someone else but used on this customer's booking.
    g.usedForeign = discountCodes.filter(c => ids.has(c.redeemed_for_enquiry_id) && !ids.has(c.issued_for_enquiry_id));
    g.activeCode = g.codes.find(c => codeStatus(c) === 'active') || null;
  });
  return groups;
}

function codeStatus(c) {
  if (c.redeemed_at) return 'used';
  return Date.parse(c.expires_at) <= Date.now() ? 'expired' : 'active';
}

function enquiryRef(id) {
  const e = allEnquiries.find(x => x.id === id);
  return e ? `№${esc(e.enquiry_number)}${e.preferred_date ? ` (${esc(e.preferred_date)})` : ''}` : 'изтрито запитване';
}

function ratingsText(f) {
  return [f.experience_rating, f.service_rating, f.venue_rating, f.rebook_rating].map(n => n ?? '-').join('/');
}

// „Анкета и отстъпка“ block of the customer profile: every survey reward
// code with its status, surveys sent but not answered, and any code of
// another customer used on this customer's bookings.
function renderPerks(g) {
  if (perksError) return `<div class="cust-perks"><h3>Анкета и отстъпка</h3><p class="perk-muted">Анкетите и отстъпките не се заредиха.</p></div>`;
  const lines = [];
  g.codes.forEach(c => {
    const st = codeStatus(c);
    const fb = feedbackByEnquiry.get(c.issued_for_enquiry_id);
    const badge = st === 'active' ? `<span class="perk-status perk-active">Активен до ${esc(fmtDate(c.expires_at))}</span>`
      : st === 'used' ? `<span class="perk-status perk-used">Използван ${esc(fmtDate(c.redeemed_at))} за ${enquiryRef(c.redeemed_for_enquiry_id)}</span>`
      : `<span class="perk-status perk-expired">Изтекъл ${esc(fmtDate(c.expires_at))}</span>`;
    lines.push(`
      <div class="perk-row">
        <span class="perk-code">${esc(c.code)}</span>
        <span>${esc(c.percent)}% от наема на залата</span>
        ${badge}
        <small>Издаден ${esc(fmtDate(c.created_at))} след анкетата за ${enquiryRef(c.issued_for_enquiry_id)}${fb ? ` · оценки ${esc(ratingsText(fb))}` : ''}</small>
      </div>`);
  });
  g.enquiries.forEach(e => {
    const fb = feedbackByEnquiry.get(e.id);
    if (fb && !g.codes.some(c => c.issued_for_enquiry_id === e.id)) {
      lines.push(`<div class="perk-row"><span>Анкета за №${esc(e.enquiry_number)} попълнена ${esc(fmtDate(fb.submitted_at))} · оценки ${esc(ratingsText(fb))}</span><span class="perk-status perk-expired">Няма издаден код</span></div>`);
    } else if (!fb && e.feedback_sent_at) {
      lines.push(`<div class="perk-row"><span class="perk-muted">Анкетата за №${esc(e.enquiry_number)} е изпратена ${esc(fmtDate(e.feedback_sent_at))} — без отговор.</span></div>`);
    }
  });
  g.usedForeign.forEach(c => {
    const src = allEnquiries.find(x => x.id === c.issued_for_enquiry_id);
    lines.push(`<div class="perk-row perk-warn">⚠ Използван чужд код <span class="perk-code">${esc(c.code)}</span> (${esc(c.percent)}%) за ${enquiryRef(c.redeemed_for_enquiry_id)} — издаден на ${esc(src ? src.full_name : 'изтрито запитване')}${src ? ` (№${esc(src.enquiry_number)})` : ''}.</div>`);
  });
  return `
    <div class="cust-perks">
      <h3>Анкета и отстъпка</h3>
      ${lines.join('') || '<p class="perk-muted">Няма попълнени анкети и отстъпки.</p>'}
    </div>`;
}

function renderRows(rows) {
  const tbody = document.getElementById('customers-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${t('customers_empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(g => `
    <tr data-key="${esc(g.key)}">
      <td><strong>${esc(g.label)}</strong>${g.marketing ? ' <span class="pipe-badge pipe-confirmed" title="Съгласие за маркетинг">✓</span>' : ''}${g.activeCode ? ` <span class="pipe-badge perk-badge" title="Неизползван код ${esc(g.activeCode.code)} · ${esc(g.activeCode.percent)}% от наема на залата">${esc(g.activeCode.percent)}% код</span>` : ''}</td>
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
        <strong>${esc(eventTypeBg(e) || '-')}</strong>
        <span>${esc(e.preferred_date || '')}</span>
        <span>${e.guests != null ? e.guests + ' гости' : ''}</span>
        <span class="pipe-badge pipe-${esc(e.pipeline_status || 'new')}">${esc(t('crm_status_' + (e.pipeline_status || 'new')))}</span>
        ${Number(e.applied_discount_percent) > 0 ? `<span class="perk-tag">−${esc(e.applied_discount_percent)}% наем${e.applied_discount_code ? ` · ${esc(e.applied_discount_code)}` : ' · ръчно'}</span>` : ''}
        <span style="margin-left:auto;color:#888;font-size:0.85em">${esc(fmtDate(e.created_at))}</span>
        <a href="dashboard.html#enquiry-${esc(e.id)}" style="color:var(--accent);text-decoration:none">→</a>
      </div>
    `).join('');
  wrap.innerHTML = `
    <div class="customer-detail">
      <h2>${esc(g.label)}</h2>
      <p class="sub">${esc(g.contact)} · ${g.count} запитвания · общо €${g.lifetime}</p>
      ${renderPerks(g)}
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
    Array.from(g.events).some(ev => (ev || '').toLowerCase().includes(q)) ||
    // A code read out over the phone finds whose it is (and who used it).
    g.codes.concat(g.usedForeign).some(c => c.code.toLowerCase().includes(q))
  );
  renderRows(filtered);
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  const [{ data, error }, codesRes, fbRes] = await Promise.all([
    db.from('enquiries').select('*').order('created_at', { ascending: false }),
    db.from('discount_codes').select('code, percent, created_at, expires_at, redeemed_at, issued_for_enquiry_id, redeemed_for_enquiry_id'),
    db.from('event_feedback').select('enquiry_id, submitted_at, experience_rating, service_rating, venue_rating, rebook_rating').order('submitted_at', { ascending: true }),
  ]);
  perksError = codesRes.error || fbRes.error || null;
  if (perksError) console.error('Survey rewards load failed:', perksError);
  discountCodes = codesRes.data || [];
  (fbRes.data || []).forEach(f => { if (!feedbackByEnquiry.has(f.enquiry_id)) feedbackByEnquiry.set(f.enquiry_id, f); });
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
