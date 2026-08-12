// edit.js - customer self-service edit page
// Fetches enquiry by magic-link token, renders the editorial form, and
// submits changes through the token-authenticated edge function.

const SUPABASE_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseHV0c3Vmcm9iem92ZHNpZWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDc3MDQsImV4cCI6MjA5MTQ4MzcwNH0.EY2j3lZRmfGlWcTTNy9CMIHZX1E-2jit11jZwP7UOJo';
const FN_GET         = `${SUPABASE_URL}/functions/v1/get-enquiry-by-token`;
const FN_UPDATE      = `${SUPABASE_URL}/functions/v1/update-enquiry-by-token`;
const FN_ADMIN_UPDATE = `${SUPABASE_URL}/functions/v1/update-enquiry-admin`;
// When the page is opened from the admin dashboard ("Edit" button) it
// runs in admin mode: auth is the admin's Supabase session, load is a
// direct REST select on enquiries by id, save goes through
// update-enquiry-admin which bypasses the edit-token + locked guards.
let adminMode = false;
let adminToken = null;  // Supabase access token of the logged-in admin

// Catalog loaded via js/catalog-db.js (window globals): addonServices, drinks,
// drinkCategories. Keep this file ordered AFTER it in edit.html.

// addonQtys: id -> integer count. Furniture addons (freeUntil) and inventory
// qty addons (heater etc.) get a stepper; everything else keeps the checkbox
// UI and stores qty:1 when selected.
const state = { token: null, enquiry: null, occupiedDates: [], activeDrinkCat: 0, drinkQtys: {}, addonQtys: {} };

// Addons that use a +/- typeable qty input instead of an on/off toggle.
// Inventory caps come from the catalog's max_qty column (admin-editable);
// furniture uses freeUntil. Everything else is an on/off checkbox.
function isQtyAddon(svc) { return svc.freeUntil != null || svc.maxQty != null; }
function addonMaxQty(svc) { return svc.maxQty ?? 999; }
// Same line-price model as the wizard: furniture bills only above the included
// baseline; everything else is qty × unit price (checkbox items have qty 1).
function addonLinePrice(svc, qty) {
  if (!qty || qty < 1) return 0;
  if (svc.freeUntil != null) return Math.max(0, qty - svc.freeUntil) * svc.price;
  return qty * svc.price;
}

// Mandatory hall cleaning - added on every event, same rule as the wizard.

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
  try {
    await window.loadCatalog();   // populates addonServices/drinks globals
  } catch (err) {
    console.error('catalog load failed:', err);
    show('state-catalog-error');
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const isAdmin = params.get('admin') === '1' && id;
  const token = params.get('token');

  if (isAdmin) {
    await mainAdmin(id);
    return;
  }
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

// Admin entry: requires a Supabase session (the admin must be logged in
// at /admin/). Loads the enquiry by id via REST using the admin's JWT
// (RLS policies on `enquiries` allow authenticated reads), then renders
// the same edit form. On submit it routes through update-enquiry-admin.
async function mainAdmin(id) {
  adminMode = true;
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    show('state-not-found'); return;
  }
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: 'sb-wlxutsufrobzovdsiecb-auth-token', persistSession: true },
  });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    // Send them to login and bounce back to this edit URL afterwards.
    const ret = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/admin/login.html?return=${ret}`;
    return;
  }
  adminToken = session.access_token;

  const { data, error } = await sb.from('enquiries').select('*').eq('id', id).maybeSingle();
  if (error || !data) { console.error(error); show('state-not-found'); return; }

  state.enquiry = data;
  state.occupiedDates = await loadOccupiedDates();
  renderForm();
  // Visual cue so the admin knows they're editing on the customer's behalf.
  const eyebrow = document.getElementById('form-eyebrow');
  if (eyebrow) eyebrow.textContent = `Админ редакция · ${data.event_type}`;
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
  seedDrinkQtys();
  setupDrinksToggle();

  $('edit-form').addEventListener('submit', onSave);
  $('btn-reload').addEventListener('click', () => window.location.reload());

  show('state-form');
}

// Drinks are always hidden behind a CTA so the form opens shorter. If the
// customer already has drinks saved we surface a count on the button instead
// of auto-expanding, so they still notice there are items to review.
function setupDrinksToggle() {
  const btn = $('btn-toggle-drinks');
  const panel = $('drinks-panel');
  const wrap = $('drinks-toggle-wrap');
  const prompt = wrap?.querySelector('.drinks-toggle-prompt');
  if (!btn || !panel) return;

  const existing = Array.isArray(state.enquiry.drinks) ? state.enquiry.drinks : [];
  const existingCount = existing.reduce((n, d) => n + (Number(d.qty) || 0), 0);

  if (existingCount > 0 && prompt) {
    prompt.textContent = `Имате ${existingCount} избрани напитки. Желаете ли да ги прегледате или промените?`;
    btn.textContent = 'Покажи напитките';
  }

  btn.addEventListener('click', () => {
    if (wrap) wrap.hidden = true;
    panel.hidden = false;
    renderDrinks();
  }, { once: true });
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

  // Seed state.addonQtys from saved enquiry once. Stepper rows persist qty
  // explicitly; older checkbox rows are treated as qty=1 when present. Clamp
  // to the current inventory cap in case an older booking exceeds it.
  if (Object.keys(state.addonQtys).length === 0) {
    (state.enquiry.addons ?? []).forEach(a => {
      const q = Number.isFinite(Number(a.qty)) && Number(a.qty) > 0 ? Number(a.qty) : 1;
      const svc = addonServices.find(s => s.id === a.id);
      state.addonQtys[a.id] = svc ? Math.min(q, addonMaxQty(svc)) : q;
    });
  }

  addonServices.forEach(svc => {
    const li = document.createElement('li');
    const qty = state.addonQtys[svc.id] || 0;

    if (isQtyAddon(svc)) {
      // Quantity card - typeable input similar to the drinks tiles.
      li.className = 'addon-card addon-card--qty' + (qty > 0 ? ' is-selected' : '');

      const visual = document.createElement('span');
      visual.className = 'addon-card__img';
      if (svc.img) {
        const img = document.createElement('img');
        img.src = svc.img; img.alt = ''; img.loading = 'lazy';
        visual.appendChild(img);
      }

      const info = document.createElement('span');
      info.className = 'addon-card__info';
      info.innerHTML = `
        <span class="addon-card__name">${esc(svc.name_bg)}</span>
        <span class="addon-card__price">€${Math.round(svc.price)} / бр.</span>
        ${svc.freeUntil != null ? `<span class="addon-card__hint">Първите ${svc.freeUntil} са включени</span>` : ''}
      `;

      const qtyWrap = document.createElement('span');
      qtyWrap.className = 'addon-qty';
      const minus = document.createElement('button');
      minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Намали');
      const num = document.createElement('input');
      num.type = 'number'; num.min = '0'; num.max = String(addonMaxQty(svc)); num.step = '1';
      num.inputMode = 'numeric'; num.value = qty;
      num.setAttribute('aria-label', 'Количество');
      const plus = document.createElement('button');
      plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Увеличи');
      qtyWrap.append(minus, num, plus);

      li.append(visual, info, qtyWrap);
      grid.appendChild(li);

      const setQty = (next) => {
        const n = Math.max(0, Math.min(addonMaxQty(svc), Math.floor(Number(next) || 0)));
        state.addonQtys[svc.id] = n;
        num.value = n;
        li.classList.toggle('is-selected', n > 0);
      };
      minus.addEventListener('click', () => setQty((state.addonQtys[svc.id] || 0) - 1));
      plus.addEventListener('click',  () => setQty((state.addonQtys[svc.id] || 0) + 1));
      num.addEventListener('input', () => setQty(num.value));
      num.addEventListener('focus', () => num.select());
      num.addEventListener('blur',  () => { if (num.value === '' || isNaN(Number(num.value))) setQty(0); });
      return;
    }

    // Standard checkbox card for everything else.
    const label = document.createElement('label');
    label.className = 'addon-card' + (qty > 0 ? ' is-selected' : '');

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = qty > 0;
    input.dataset.addonId = svc.id;

    const visual = document.createElement('span');
    visual.className = 'addon-card__img';
    if (svc.img) {
      const img = document.createElement('img');
      img.src = svc.img; img.alt = ''; img.loading = 'lazy';
      visual.appendChild(img);
    }

    const info = document.createElement('span');
    info.className = 'addon-card__info';
    info.innerHTML = `
      <span class="addon-card__name">${esc(svc.name_bg)}</span>
      <span class="addon-card__price">€${Math.round(svc.price)}</span>
    `;

    label.append(input, visual, info);
    input.addEventListener('change', () => {
      state.addonQtys[svc.id] = input.checked ? 1 : 0;
      label.classList.toggle('is-selected', input.checked);
    });
    li.appendChild(label);
    grid.appendChild(li);
  });

  // Grandfathered addons: saved on the enquiry but no longer in the catalog
  // (deleted/hidden by the manager). Rendered from the payload snapshot as
  // keep-or-remove cards - the server accepts them only unchanged.
  const knownAddonIds = new Set(addonServices.map(s => s.id));
  (state.enquiry.addons ?? []).filter(a => !knownAddonIds.has(a.id)).forEach(a => {
    const qty = state.addonQtys[a.id] || 0;
    const li = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'addon-card' + (qty > 0 ? ' is-selected' : '');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = qty > 0;
    const info = document.createElement('span');
    info.className = 'addon-card__info';
    info.innerHTML = `
      <span class="addon-card__name">${esc(a.name)}</span>
      <span class="addon-card__price">€${Math.round(Number(a.price) || 0)}</span>
      <span class="addon-card__hint">Вече не се предлага - може да я запазите или премахнете</span>
    `;
    label.append(input, info);
    input.addEventListener('change', () => {
      state.addonQtys[a.id] = input.checked ? (Number(a.qty) > 0 ? Number(a.qty) : 1) : 0;
      label.classList.toggle('is-selected', input.checked);
    });
    li.appendChild(label);
    grid.appendChild(li);
  });
}

// Seed the drink quantities from the saved enquiry at FORM LOAD, not when
// the drinks panel is first opened. onSave always sends `drinks` built from
// state.drinkQtys - seeding lazily meant a save without opening the panel
// sent an empty array and silently wiped the customer's whole drinks order.
function seedDrinkQtys() {
  if (Object.keys(state.drinkQtys).length > 0) return;
  const pool = typeof drinks !== 'undefined' ? drinks : [];
  (state.enquiry.drinks ?? []).forEach(d => {
    const cat = pool.find(x => x.id === d.id)?.cat;
    // Unknown id = removed from the catalog: keep the stored qty untouched
    // (the server only allows decreases for grandfathered drinks).
    const max = cat == null ? (Number(d.qty) || 0) : (cat >= 3 ? 200 : 100);
    state.drinkQtys[d.id] = Math.min(Number(d.qty) || 0, max);
  });
}

function renderDrinks() {
  renderDrinkTabs();
  renderDrinkTiles();
  renderLegacyDrinks();
}

// Saved drinks that are no longer in the catalog: shown above the picker so
// the customer can keep, reduce or remove them (qty can only go down - the
// stored quantity is the cap the server enforces).
function renderLegacyDrinks() {
  const grid = $('drinks-legacy');
  if (!grid) return;
  grid.innerHTML = '';
  const pool = typeof drinks !== 'undefined' ? drinks : [];
  const known = new Set(pool.map(d => d.id));
  const legacy = (Array.isArray(state.enquiry.drinks) ? state.enquiry.drinks : [])
    .filter(d => !known.has(d.id));
  grid.hidden = legacy.length === 0;
  legacy.forEach(d => {
    const savedQty = Number(d.qty) || 0;
    const qty = state.drinkQtys[d.id] ?? 0;
    const li = document.createElement('li');
    li.className = 'drink-tile' + (qty > 0 ? ' has-qty' : '');
    const body = document.createElement('span');
    body.className = 'drink-tile__body';
    const name = document.createElement('span');
    name.className = 'drink-tile__name';
    name.textContent = `${d.name} (вече не се предлага)`;
    const price = document.createElement('span');
    price.className = 'drink-tile__price';
    price.textContent = d.price_eur != null ? `€${Number(d.price_eur).toFixed(2)}` : 'По запитване';
    const qtyWrap = document.createElement('span');
    qtyWrap.className = 'drink-qty';
    const minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Намали');
    const num = document.createElement('input');
    num.type = 'number'; num.min = '0'; num.max = String(savedQty); num.step = '1';
    num.inputMode = 'numeric'; num.value = qty;
    num.setAttribute('aria-label', 'Количество');
    const plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Увеличи');
    qtyWrap.append(minus, num, plus);
    body.append(name, price, qtyWrap);
    li.appendChild(body);
    grid.appendChild(li);
    function setQty(next) {
      const n = Math.max(0, Math.min(savedQty, Math.floor(Number(next) || 0)));
      state.drinkQtys[d.id] = n;
      num.value = n;
      li.classList.toggle('has-qty', n > 0);
    }
    minus.addEventListener('click', () => setQty((state.drinkQtys[d.id] || 0) - 1));
    plus.addEventListener('click',  () => setQty((state.drinkQtys[d.id] || 0) + 1));
    num.addEventListener('input', () => setQty(num.value));
    num.addEventListener('blur',  () => { if (num.value === '' || isNaN(Number(num.value))) setQty(0); });
  });
}

function renderDrinkTabs() {
  const tabs = $('drinks-tabs');
  tabs.innerHTML = '';
  tabs.setAttribute('aria-label', 'Категории напитки');
  const cats = (typeof drinkCategories !== 'undefined' ? drinkCategories.bg : []) || [];
  cats.forEach((name, i) => {
    const btn = document.createElement('button');
    const active = i === state.activeDrinkCat;
    btn.type = 'button';
    btn.className = 'drinks-nav__tab' + (active ? ' is-active' : '');
    btn.textContent = name;
    btn.id = 'drinks-tab-' + i;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
    btn.setAttribute('aria-controls', 'drinks-grid');
    btn.tabIndex = active ? 0 : -1;
    btn.addEventListener('click', () => {
      state.activeDrinkCat = i;
      renderDrinkTabs();
      renderDrinkTiles();
    });
    tabs.appendChild(btn);
  });
  if (!tabs._kbBound) {
    tabs._kbBound = true;
    // Roving tabindex: arrows/Home/End move focus AND activate.
    tabs.addEventListener('keydown', (e) => {
      const count = ((typeof drinkCategories !== 'undefined' ? drinkCategories.bg : []) || []).length;
      if (!count) return;
      let next = null;
      if (e.key === 'ArrowRight') next = (state.activeDrinkCat + 1) % count;
      else if (e.key === 'ArrowLeft') next = (state.activeDrinkCat - 1 + count) % count;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = count - 1;
      if (next === null) return;
      e.preventDefault();
      state.activeDrinkCat = next;
      renderDrinkTabs();
      renderDrinkTiles();
      const focusBtn = document.getElementById('drinks-tab-' + next);
      if (focusBtn) focusBtn.focus();
    });
  }
}

function renderDrinkTiles() {
  const grid = $('drinks-grid');
  grid.setAttribute('role', 'tabpanel');
  grid.setAttribute('aria-labelledby', 'drinks-tab-' + state.activeDrinkCat);
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
      // If the asset is missing, drop the <img> and let the CSS placeholder
      // (label-caps initial) show through - keeps the layout from collapsing.
      i.addEventListener('error', () => { i.remove(); img.classList.add('drink-tile__img--fallback'); img.textContent = (drink.name_bg || drink.name_en || '?')[0]; });
      img.appendChild(i);
    } else {
      img.classList.add('drink-tile__img--fallback');
      img.textContent = (drink.name_bg || drink.name_en || '?')[0];
    }

    const body = document.createElement('span');
    body.className = 'drink-tile__body';

    const name = document.createElement('span');
    name.className = 'drink-tile__name';
    name.textContent = drink.name_bg || drink.name_en || drink.id;

    const price = document.createElement('span');
    price.className = 'drink-tile__price';
    price.textContent = drink.price_eur != null ? `€${drink.price_eur.toFixed(2)}` : 'По запитване';

    // Same per-category caps as the wizard and the server: non-alcoholic
    // (soft drinks + water, cat 3 & 4) up to 200, alcoholic up to 100.
    const maxQty = drink.cat >= 3 ? 200 : 100;
    const qtyWrap = document.createElement('span');
    qtyWrap.className = 'drink-qty';
    const minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Намали');
    const num = document.createElement('input');
    num.type = 'number';
    num.min = '0';
    num.max = String(maxQty);
    num.step = '1';
    num.inputMode = 'numeric';
    num.value = qty;
    num.setAttribute('aria-label', 'Количество');
    const plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Увеличи');

    qtyWrap.append(minus, num, plus);
    body.append(name, price, qtyWrap);
    li.append(img, body);
    grid.appendChild(li);

    function setQty(next) {
      const n = Math.max(0, Math.min(maxQty, Math.floor(Number(next) || 0)));
      state.drinkQtys[drink.id] = n;
      num.value = n;
      li.classList.toggle('has-qty', n > 0);
    }
    minus.addEventListener('click', () => setQty((state.drinkQtys[drink.id] || 0) - 1));
    plus.addEventListener('click',  () => setQty((state.drinkQtys[drink.id] || 0) + 1));
    num.addEventListener('input', () => setQty(num.value));
    num.addEventListener('focus', () => num.select());
    num.addEventListener('blur',  () => { if (num.value === '' || isNaN(Number(num.value))) setQty(0); });
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

  // Same bounds the server enforces (1..200) - fail here with a clear
  // message instead of a generic save error.
  if (!Number.isInteger(guests) || guests < 1 || guests > 200) {
    errEl.textContent = 'Моля, въведете брой гости между 1 и 200.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Запазете промените';
    return;
  }

  const addons = [];
  addonServices.forEach(svc => {
    const qty = state.addonQtys[svc.id] || 0;
    if (qty <= 0) return;
    const linePrice = addonLinePrice(svc, qty);
    // name_en matches what the reservation wizard stores - using name_bg here
    // made every save rename untouched items, firing a spurious "changed"
    // diff email and burning an edit_count increment toward the lock cap.
    const entry = { id: svc.id, name: svc.name_en, price: linePrice };
    if (isQtyAddon(svc)) entry.qty = qty;
    addons.push(entry);
  });

  // Grandfathered addons - send the stored line unchanged; the server
  // rejects any modification to items no longer in the catalog.
  const knownAddonIds = new Set(addonServices.map(s => s.id));
  (state.enquiry.addons ?? []).forEach(a => {
    if (knownAddonIds.has(a.id)) return;
    if ((state.addonQtys[a.id] || 0) <= 0) return;   // customer removed it
    addons.push({ ...a });
  });

  // Mandatory hall cleaning - added on every event, same rule the wizard
  // applies at booking time; ensures an edit never drops the obligatory fee.
  if (!addons.some(a => a.id === 'cleaning')) {
    const cleaningSvc = addonServices.find(s => s.id === 'cleaning');
    if (cleaningSvc) addons.push({ id: cleaningSvc.id, name: cleaningSvc.name_en, price: cleaningSvc.price });
  }

  const drinksOut = [];
  const drinkPool = typeof drinks !== 'undefined' ? drinks : [];
  const savedDrinks = Array.isArray(state.enquiry.drinks) ? state.enquiry.drinks : [];
  Object.entries(state.drinkQtys).forEach(([id, qty]) => {
    if (!qty || qty <= 0) return;
    const d = drinkPool.find(x => x.id === id);
    if (d) {
      // name_en matches the wizard's stored shape (see addons note above).
      drinksOut.push({ id: d.id, name: d.name_en || d.name_bg, qty, price_eur: d.price_eur ?? null });
    } else {
      // Drink no longer in the catalog - keep the saved row instead of
      // silently dropping the customer's item.
      const orig = savedDrinks.find(x => x.id === id);
      if (orig) drinksOut.push({ ...orig, qty });
    }
  });

  try {
    const changes = { preferred_date, guests, phone, notes, addons, drinks: drinksOut };
    const url = adminMode ? FN_ADMIN_UPDATE : FN_UPDATE;
    const headers = { 'Content-Type': 'application/json' };
    if (adminMode) headers['Authorization'] = `Bearer ${adminToken}`;
    const reqBody = adminMode
      ? JSON.stringify({ id: state.enquiry.id, changes })
      : JSON.stringify({ token: state.token, changes });
    const res = await fetch(url, { method: 'POST', headers, body: reqBody });
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
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btn-catalog-retry') window.location.reload();
});
