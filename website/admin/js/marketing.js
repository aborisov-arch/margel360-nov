// Marketing export - deduplicates enquiries by email (then phone) and writes
// a CSV with one row per unique customer. Aggregates per-customer fields
// (count, last enquiry, event types, total est. spend, marketing consent).

let allEnquiries = [];

function customerKey(e) {
  const em = (e.email || '').trim().toLowerCase();
  if (em) return 'e:' + em;
  const ph = (e.phone || '').replace(/\D/g, '');
  if (ph) return 'p:' + ph;
  return '';
}

const EVENT_BASE = { evening: 1280, wedding: 1500, corp4: 330, corp8: 440, bday_day: 700, bday_eve: 970 };
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

function groupCustomers(enquiries) {
  const map = new Map();
  enquiries.forEach(e => {
    const key = customerKey(e); if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        key, name: e.full_name || '', email: e.email || '', phone: e.phone || '',
        count: 0, last: e.created_at, first: e.created_at,
        lifetime: 0, events: new Set(), pipelineStages: new Set(),
        marketing: false, lastNotes: e.notes || '',
      });
    }
    const g = map.get(key);
    g.count++;
    g.lifetime += estimateTotal(e);
    if (e.event_type) g.events.add(e.event_type);
    if (e.pipeline_status) g.pipelineStages.add(e.pipeline_status);
    if (e.marketing_consent) g.marketing = true;
    if (new Date(e.created_at) > new Date(g.last)) {
      g.last = e.created_at;
      g.name = e.full_name || g.name;
      g.email = e.email || g.email;
      g.phone = e.phone || g.phone;
    }
    if (new Date(e.created_at) < new Date(g.first)) g.first = e.created_at;
  });
  return Array.from(map.values()).sort((a, b) => new Date(b.last) - new Date(a.last));
}

function applyFilters() {
  const consentOnly = document.getElementById('filter-consent').checked;
  const stage = document.getElementById('filter-status').value;
  const evType = document.getElementById('filter-event').value;

  let matching = groupCustomers(allEnquiries);
  if (consentOnly) matching = matching.filter(g => g.marketing);
  if (stage)       matching = matching.filter(g => g.pipelineStages.has(stage));
  if (evType)      matching = matching.filter(g => g.events.has(evType));

  document.getElementById('match-count').textContent = matching.length;
  return matching;
}

function csvEscape(v) {
  let s = String(v ?? '');
  // Formula-injection guard: names/emails/phones come from the public form,
  // so a value like =HYPERLINK(...) would execute as a formula when the
  // admin opens the CSV in Excel/LibreOffice. A leading apostrophe forces
  // the cell to be treated as text (quoting alone does not prevent this).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadCsv() {
  const customers = applyFilters();
  const header = ['Име','Имейл','Телефон','Запитвания','Първо запитване','Последно запитване','Типове събития','Прогнозна стойност (€)','Етапи в пайплайна','Маркетинг съгласие'];
  const rows = customers.map(g => [
    g.name, g.email, g.phone,
    g.count,
    new Date(g.first).toISOString().slice(0, 10),
    new Date(g.last).toISOString().slice(0, 10),
    Array.from(g.events).join('; '),
    g.lifetime,
    Array.from(g.pipelineStages).join('; '),
    g.marketing ? 'Да' : 'Не',
  ]);
  const csv = [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');
  // BOM so Excel opens it as UTF-8 (Cyrillic intact).
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `margel360-customers-${stamp}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  const { data, error } = await db.from('enquiries').select('*');
  if (error) { console.error(error); document.getElementById('match-count').textContent = 'Грешка'; return; }
  allEnquiries = data || [];

  // Populate event-type filter from actual data.
  const types = Array.from(new Set(allEnquiries.map(e => e.event_type).filter(Boolean))).sort();
  const evSel = document.getElementById('filter-event');
  types.forEach(tp => {
    const o = document.createElement('option');
    o.value = tp; o.textContent = tp;
    evSel.appendChild(o);
  });

  applyFilters();
  ['filter-consent','filter-status','filter-event'].forEach(id =>
    document.getElementById(id).addEventListener('change', applyFilters));
  document.getElementById('download-csv').addEventListener('click', downloadCsv);
});

function rerenderPage() { applyFilters(); }
