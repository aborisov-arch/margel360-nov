// booking.js — read-only keepsake view for a customer's booking.
// Same token flow as edit.html, but purely presentational; links out
// to edit.html?token=... if the customer wants to change anything.

const SUPABASE_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
const FN_GET = `${SUPABASE_URL}/functions/v1/get-enquiry-by-token`;

const $ = id => document.getElementById(id);

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDateBg(stored) {
  return String(stored || '').replaceAll('/', '.');
}

function fmtEur(n) {
  const v = Number(n);
  return Number.isFinite(v) ? `€${Math.round(v)}` : '—';
}

function show(id) {
  document.querySelectorAll('.spread').forEach(el => { el.hidden = true; });
  const el = $(id);
  if (el) el.hidden = false;
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) { show('state-not-found'); return; }

  try {
    const res = await fetch(FN_GET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.status === 404) return show('state-not-found');
    if (res.status === 410) return show('state-expired');
    if (res.status === 403) return show('state-expired');
    if (!res.ok) { show('state-not-found'); return; }

    renderProgram(body.enquiry, token);
  } catch (err) {
    console.error(err);
    show('state-not-found');
  }
}

function renderProgram(e, token) {
  const firstName = String(e.full_name || '').split(' ')[0] || '';
  const timeLabel = e.time_of_day === 'day' ? 'Дневно · до 17:30' : 'Вечерно · след 19:00';
  const humanDate = fmtDateBg(e.preferred_date);

  $('program-eyebrow').textContent = `Обобщение · ${e.event_type}`;
  $('program-title').innerHTML = `Ще ви очакваме <em>на ${humanDate}</em>.`;
  $('program-lead').textContent = firstName
    ? `Здравейте, ${firstName}. По-долу е потвърждението на резервацията ви в зала Маргел 360°.`
    : 'По-долу е потвърждението на вашата резервация в зала Маргел 360°.';
  $('colophon-date').textContent = humanDate;

  $('program-meta').innerHTML = `
    <div>
      <span class="label-caps">Събитие</span>
      <strong>${esc(e.event_type)}</strong>
    </div>
    <div>
      <span class="label-caps">Дата</span>
      <strong>${humanDate}</strong>
    </div>
    <div>
      <span class="label-caps">Час</span>
      <strong>${timeLabel}</strong>
    </div>
    <div>
      <span class="label-caps">Гости</span>
      <strong>${e.guests != null ? esc(e.guests) : '—'}</strong>
    </div>
    <div>
      <span class="label-caps">Телефон</span>
      <strong>${esc(e.phone)}</strong>
    </div>
    <div>
      <span class="label-caps">Имейл</span>
      <strong>${esc(e.email)}</strong>
    </div>
  `;

  const addons = Array.isArray(e.addons) ? e.addons : [];
  const addonList = $('program-addons');
  if (addons.length === 0) {
    addonList.innerHTML = `<li><span class="name" style="color:var(--muted)"><em>Без допълнителни услуги</em></span></li>`;
  } else {
    addonList.innerHTML = addons.map(a =>
      `<li><span class="name">${esc(a.name)}</span><span class="note">${fmtEur(a.price)}</span></li>`
    ).join('');
  }

  const drinksArr = Array.isArray(e.drinks) ? e.drinks : [];
  const drinksList = $('program-drinks');
  if (drinksArr.length === 0) {
    drinksList.innerHTML = `<li><span class="name" style="color:var(--muted)"><em>Без напитки</em></span></li>`;
  } else {
    drinksList.innerHTML = drinksArr.map(d => {
      const qty = Number.isInteger(Number(d.qty)) ? Number(d.qty) : 0;
      return `<li><span class="name">${esc(d.name)}</span><span class="note">× ${qty}</span></li>`;
    }).join('');
  }

  if (e.notes) {
    const notes = $('program-notes');
    notes.textContent = `„${e.notes}"`;
    notes.hidden = false;
  }

  const editLink = $('edit-link');
  editLink.href = `edit.html?token=${encodeURIComponent(token)}`;

  show('state-program');
}

document.addEventListener('DOMContentLoaded', main);
