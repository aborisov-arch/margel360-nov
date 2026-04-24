// edit.js — customer self-service edit page
// Loads an enquiry by token and lets the customer update a whitelist of fields.

const SUPABASE_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseHV0c3Vmcm9iem92ZHNpZWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDc3MDQsImV4cCI6MjA5MTQ4MzcwNH0.EY2j3lZRmfGlWcTTNy9CMIHZX1E-2jit11jZwP7UOJo';
const FN_GET = `${SUPABASE_URL}/functions/v1/get-enquiry-by-token`;
const FN_UPDATE = `${SUPABASE_URL}/functions/v1/update-enquiry-by-token`;

// Catalogs are loaded by reservation-catalog.js and drinks-data.js:
// => `addonServices`, `drinks` (global)

const state = { token: null, enquiry: null, occupiedDates: [], activeDrinkCat: 0, drinkQtys: {} };

function $(id) { return document.getElementById(id); }
function show(id) {
  document.querySelectorAll('.edit-state').forEach(el => el.classList.add('hidden'));
  $(id).classList.remove('hidden');
}
function fmtDateBg(stored) {
  // preferred_date is "DD/MM/YYYY" text — display as DD.MM.YYYY.
  return String(stored || '').replaceAll('/', '.');
}
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) { show('state-not-found'); return; }
  state.token = token;

  try {
    const res = await fetch(FN_GET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.status === 404) return show('state-not-found');
    if (res.status === 410) return show('state-expired');
    if (res.status === 403) return show('state-locked');
    if (!res.ok) { show('state-not-found'); return; }

    state.enquiry = body.enquiry;
    state.occupiedDates = await loadOccupiedDates();
    renderForm();
  } catch (err) {
    console.error(err);
    show('state-not-found');
  }
}

async function loadOccupiedDates() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/occupied_dates?select=date`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map(r => r.date) : [];
  } catch {
    return [];
  }
}

function renderForm() {
  const e = state.enquiry;

  $('edit-banner').innerHTML =
    `Редактирате резервация за <strong>${escapeHtml(e.event_type)}</strong> на <strong>${fmtDateBg(e.preferred_date)}</strong>.
     Всички промени ще бъдат изпратени на вашия имейл.`;

  const timeLabel = e.time_of_day === 'day' ? 'Дневно (до 17:30)' : 'Вечерно (след 19:00)';
  $('readonly-block').innerHTML = `
    <span>Събитие</span><strong>${escapeHtml(e.event_type)}</strong>
    <span>Час</span><strong>${timeLabel}</strong>
    <span>Имейл</span><strong>${escapeHtml(e.email)}</strong>
  `;

  $('field-guests').value = e.guests ?? '';
  $('field-phone').value = e.phone ?? '';
  $('field-notes').value = e.notes ?? '';

  initDatePicker();
  renderAddons();
  renderDrinks();

  $('edit-form').addEventListener('submit', onSave);

  show('state-form');
}

function initDatePicker() {
  const dateEl = $('field-date');
  if (!dateEl || typeof flatpickr === 'undefined') return;

  const current = state.enquiry.preferred_date; // "DD/MM/YYYY"
  // Convert occupied "YYYY-MM-DD" strings to local-midnight Dates, excluding the customer's own current date.
  const occupied = (state.occupiedDates || [])
    .filter(d => {
      if (!current) return true;
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}` !== current;
    })
    .map(d => {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day);
    });

  flatpickr(dateEl, {
    locale: (typeof flatpickr.l10ns !== 'undefined' && flatpickr.l10ns.bg) ? 'bg' : 'default',
    dateFormat: 'd/m/Y',
    minDate: 'today',
    disableMobile: true,
    animate: true,
    disable: occupied,
    defaultDate: current || undefined,
    onDayCreate(_dObj, _dStr, _fp, dayElem) {
      const d = dayElem.dateObj;
      if (!d) return;
      const isOccupied = occupied.some(od =>
        od.getFullYear() === d.getFullYear() &&
        od.getMonth() === d.getMonth() &&
        od.getDate() === d.getDate()
      );
      if (isOccupied) dayElem.classList.add('occupied-date');
    },
  });
}

function renderAddons() {
  const grid = $('addon-grid');
  grid.innerHTML = '';
  const selected = new Map((state.enquiry.addons ?? []).map(a => [a.id, a]));

  addonServices.forEach(svc => {
    const item = document.createElement('label');
    item.className = 'addon-item' + (selected.has(svc.id) ? ' selected' : '');

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = selected.has(svc.id);
    input.dataset.addonId = svc.id;

    const visual = document.createElement('div');
    if (svc.img) {
      visual.className = 'addon-img';
      const img = document.createElement('img');
      img.src = svc.img;
      img.alt = svc.name_bg;
      img.loading = 'lazy';
      visual.appendChild(img);
    } else {
      visual.className = 'addon-emoji';
      visual.textContent = '⭐';
      visual.setAttribute('aria-hidden', 'true');
    }

    const info = document.createElement('div');
    info.className = 'addon-info';
    info.innerHTML = `<div class="addon-name">${escapeHtml(svc.name_bg)}</div>
      <div class="addon-price">€${Math.round(svc.price)}</div>`;

    const check = document.createElement('div');
    check.className = 'addon-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';

    item.appendChild(input);
    item.appendChild(visual);
    item.appendChild(info);
    item.appendChild(check);

    item.addEventListener('change', () => item.classList.toggle('selected', input.checked));

    grid.appendChild(item);
  });
}

function renderDrinks() {
  // Seed the qty map once from the enquiry so edits survive tab switches.
  if (Object.keys(state.drinkQtys).length === 0) {
    (state.enquiry.drinks ?? []).forEach(d => { state.drinkQtys[d.id] = d.qty; });
  }

  renderDrinkTabs();
  renderDrinkGrid();
}

function renderDrinkTabs() {
  const tabs = $('drinks-tabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  const cats = (typeof drinkCategories !== 'undefined' ? drinkCategories.bg : []) || [];
  cats.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'drinks-tab' + (i === state.activeDrinkCat ? ' active' : '');
    btn.textContent = name;
    btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => {
      state.activeDrinkCat = i;
      renderDrinkTabs();
      renderDrinkGrid();
    });
    tabs.appendChild(btn);
  });
}

function renderDrinkGrid() {
  const grid = $('drinks-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const pool = typeof drinks !== 'undefined' ? drinks : [];
  pool.filter(d => d.cat === state.activeDrinkCat).forEach(drink => {
    const qty = state.drinkQtys[drink.id] || 0;
    const item = document.createElement('div');
    item.className = 'drink-item' + (qty > 0 ? ' has-qty' : '');

    const img = document.createElement('img');
    img.src = drink.img;
    img.alt = drink.name_bg || drink.name_en || '';
    img.loading = 'lazy';

    const body = document.createElement('div');
    body.className = 'drink-body';
    const name = document.createElement('div');
    name.className = 'drink-name';
    name.textContent = drink.name_bg || drink.name_en || drink.id;
    const price = document.createElement('div');
    price.className = 'drink-price';
    price.textContent = drink.price_eur != null ? '€' + Math.round(drink.price_eur) : 'По запитване';

    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'drink-qty';
    const minus = document.createElement('button');
    minus.type = 'button'; minus.className = 'qty-btn'; minus.textContent = '−';
    minus.setAttribute('aria-label', 'Намали');
    const num = document.createElement('span');
    num.className = 'qty-num'; num.textContent = qty;
    const plus = document.createElement('button');
    plus.type = 'button'; plus.className = 'qty-btn'; plus.textContent = '+';
    plus.setAttribute('aria-label', 'Увеличи');

    qtyWrap.append(minus, num, plus);
    body.append(name, price, qtyWrap);
    item.append(img, body);
    grid.appendChild(item);

    minus.addEventListener('click', () => {
      state.drinkQtys[drink.id] = Math.max(0, (state.drinkQtys[drink.id] || 0) - 1);
      num.textContent = state.drinkQtys[drink.id];
      item.classList.toggle('has-qty', state.drinkQtys[drink.id] > 0);
    });
    plus.addEventListener('click', () => {
      state.drinkQtys[drink.id] = (state.drinkQtys[drink.id] || 0) + 1;
      num.textContent = state.drinkQtys[drink.id];
      item.classList.add('has-qty');
    });
  });
}

async function onSave(evt) {
  evt.preventDefault();
  const btn = $('btn-save');
  const errEl = $('edit-error');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Запазване…';

  const preferred_date = $('field-date').value.trim();
  const guests = parseInt($('field-guests').value, 10);
  const phone = $('field-phone').value.trim();
  const notes = $('field-notes').value.trim() || null;

  if (!preferred_date) {
    errEl.textContent = 'Моля, изберете дата.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Запази промените';
    return;
  }

  const addons = [];
  document.querySelectorAll('#addon-grid input[type=checkbox]').forEach(cb => {
    if (!cb.checked) return;
    const svc = addonServices.find(s => s.id === cb.dataset.addonId);
    if (svc) addons.push({ id: svc.id, name: svc.name_bg, price: svc.price });
  });

  const drinksOut = [];
  const drinkPool = typeof drinks !== 'undefined' ? drinks : [];
  Object.entries(state.drinkQtys).forEach(([id, qty]) => {
    if (!qty || qty <= 0) return;
    const d = drinkPool.find(x => x.id === id);
    if (d) drinksOut.push({ id: d.id, name: d.name_bg || d.name_en, qty, price_eur: d.price_eur ?? null });
  });

  try {
    const res = await fetch(FN_UPDATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: state.token,
        changes: { preferred_date, guests, phone, notes, addons, drinks: drinksOut },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'server_error');

    show('state-saved');
  } catch (err) {
    console.error(err);
    errEl.textContent = 'Нещо се обърка. Моля опитайте отново или се свържете с нас.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Запази промените';
  }
}

$('btn-reload')?.addEventListener('click', () => window.location.reload());

document.addEventListener('DOMContentLoaded', main);
