// edit.js — customer self-service edit page
// Fetches enquiry by magic-link token, renders the editorial form, and
// submits changes through the token-authenticated edge function.

const SUPABASE_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseHV0c3Vmcm9iem92ZHNpZWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDc3MDQsImV4cCI6MjA5MTQ4MzcwNH0.EY2j3lZRmfGlWcTTNy9CMIHZX1E-2jit11jZwP7UOJo';
const FN_GET    = `${SUPABASE_URL}/functions/v1/get-enquiry-by-token`;
const FN_UPDATE = `${SUPABASE_URL}/functions/v1/update-enquiry-by-token`;

// Catalogs loaded via reservation-catalog.js + drinks-data.js (window globals):
//   addonServices, drinks, drinkCategories

const state = { token: null, enquiry: null, occupiedDates: [], activeDrinkCat: 0, drinkQtys: {} };

const $ = id => document.getElementById(id);

function show(id) {
  document.querySelectorAll('.spread').forEach(el => { el.hidden = true; });
  const el = $(id);
  if (el) el.hidden = false;
  // Fade colophon in on any non-loading state
  if (id !== 'state-loading') $('venue-colophon').hidden = false;
}

function fmtDateBg(stored) {
  return String(stored || '').replaceAll('/', '.');
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Entry ───────────────────────────────────────────────────

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
  } catch { return []; }
}

// ── Form rendering ──────────────────────────────────────────

function renderForm() {
  const e = state.enquiry;
  const timeLabel = e.time_of_day === 'day' ? 'Дневно · до 17:30' : 'Вечерно · след 19:00';

  $('form-eyebrow').textContent = `Редактиране · ${e.event_type}`;
  $('form-headline').innerHTML = `Вашето събитие <em>на ${fmtDateBg(e.preferred_date)}</em>.`;
  $('colophon-date').textContent = fmtDateBg(e.preferred_date);

  $('readonly-block').innerHTML = `
    <div>
      <span class="label-caps">Събитие</span>
      <strong>${esc(e.event_type)}</strong>
    </div>
    <div>
      <span class="label-caps">Час</span>
      <strong>${timeLabel}</strong>
    </div>
    <div>
      <span class="label-caps">Имейл</span>
      <strong>${esc(e.email)}</strong>
    </div>
  `;

  $('field-guests').value = e.guests ?? '';
  $('field-phone').value = e.phone ?? '';
  $('field-notes').value = e.notes ?? '';
  $('saved-email').textContent = e.email || 'вашия имейл';

  initDatePicker();
  renderAddons();
  renderDrinks();

  $('edit-form').addEventListener('submit', onSave);
  $('btn-reload').addEventListener('click', () => window.location.reload());

  show('state-form');
}

function initDatePicker() {
  const dateEl = $('field-date');
  if (!dateEl || typeof flatpickr === 'undefined') return;

  const current = state.enquiry.preferred_date; // "DD/MM/YYYY"
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
    onDayCreate(_d, _s, _fp, dayElem) {
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
  const selected = new Set((state.enquiry.addons ?? []).map(a => a.id));

  addonServices.forEach(svc => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'addon-card' + (selected.has(svc.id) ? ' is-selected' : '');

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = selected.has(svc.id);
    input.dataset.addonId = svc.id;

    const visual = document.createElement('span');
    visual.className = 'addon-card__img';
    if (svc.img) {
      const img = document.createElement('img');
      img.src = svc.img;
      img.alt = '';
      img.loading = 'lazy';
      visual.appendChild(img);
    }

    const info = document.createElement('span');
    info.className = 'addon-card__info';
    info.innerHTML = `
      <span class="addon-card__name">${esc(svc.name_bg)}</span>
      <span class="addon-card__price">€${Math.round(svc.price)}</span>
    `;

    label.append(input, visual, info);
    input.addEventListener('change', () => label.classList.toggle('is-selected', input.checked));
    li.appendChild(label);
    grid.appendChild(li);
  });
}

function renderDrinks() {
  if (Object.keys(state.drinkQtys).length === 0) {
    (state.enquiry.drinks ?? []).forEach(d => { state.drinkQtys[d.id] = d.qty; });
  }
  renderDrinkTabs();
  renderDrinkTiles();
}

function renderDrinkTabs() {
  const tabs = $('drinks-tabs');
  tabs.innerHTML = '';
  const cats = (typeof drinkCategories !== 'undefined' ? drinkCategories.bg : []) || [];
  cats.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'drinks-nav__tab' + (i === state.activeDrinkCat ? ' is-active' : '');
    btn.textContent = name;
    btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => {
      state.activeDrinkCat = i;
      renderDrinkTabs();
      renderDrinkTiles();
    });
    tabs.appendChild(btn);
  });
}

function renderDrinkTiles() {
  const grid = $('drinks-grid');
  grid.innerHTML = '';
  const pool = typeof drinks !== 'undefined' ? drinks : [];
  pool.filter(d => d.cat === state.activeDrinkCat).forEach(drink => {
    const qty = state.drinkQtys[drink.id] || 0;

    const li = document.createElement('li');
    li.className = 'drink-tile' + (qty > 0 ? ' has-qty' : '');

    const img = document.createElement('span');
    img.className = 'drink-tile__img';
    if (drink.img) {
      const i = document.createElement('img');
      i.src = drink.img;
      i.alt = '';
      i.loading = 'lazy';
      img.appendChild(i);
    }

    const body = document.createElement('span');
    body.className = 'drink-tile__body';

    const name = document.createElement('span');
    name.className = 'drink-tile__name';
    name.textContent = drink.name_bg || drink.name_en || drink.id;

    const price = document.createElement('span');
    price.className = 'drink-tile__price';
    price.textContent = drink.price_eur != null ? `€${Math.round(drink.price_eur)}` : 'По запитване';

    const qtyWrap = document.createElement('span');
    qtyWrap.className = 'drink-qty';
    const minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Намали');
    const num = document.createElement('span');
    num.textContent = qty;
    const plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Увеличи');

    qtyWrap.append(minus, num, plus);
    body.append(name, price, qtyWrap);
    li.append(img, body);
    grid.appendChild(li);

    minus.addEventListener('click', () => {
      state.drinkQtys[drink.id] = Math.max(0, (state.drinkQtys[drink.id] || 0) - 1);
      num.textContent = state.drinkQtys[drink.id];
      li.classList.toggle('has-qty', state.drinkQtys[drink.id] > 0);
    });
    plus.addEventListener('click', () => {
      state.drinkQtys[drink.id] = (state.drinkQtys[drink.id] || 0) + 1;
      num.textContent = state.drinkQtys[drink.id];
      li.classList.add('has-qty');
    });
  });
}

// ── Save ────────────────────────────────────────────────────

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
    btn.textContent = 'Запазете промените';
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
    if (!res.ok) throw new Error(body?.detail || body?.error || 'server_error');

    show('state-saved');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    errEl.textContent = 'Нещо се обърка при запазването. Моля опитайте отново или се свържете с нас на 360@margel.info.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Запазете промените';
  }
}

document.addEventListener('DOMContentLoaded', main);
