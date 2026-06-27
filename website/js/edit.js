// edit.js — customer self-service edit page
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

// Catalogs loaded via reservation-catalog.js + drinks-data.js (window globals):
//   addonServices, drinks, drinkCategories

// addonQtys: id -> integer count. Furniture addons (freeUntil) and inventory
// qty addons (heater etc.) get a stepper; everything else keeps the checkbox
// UI and stores qty:1 when selected.
const state = { token: null, enquiry: null, occupiedDates: [], activeDrinkCat: 0, drinkQtys: {}, addonQtys: {} };

// Keep in sync with reservation.js: physical inventory caps for the
// stepper addons (2 gas patio heaters, 1 gas heating table, 10 glow tables).
const ADDON_MAX_QTY = { heater: 2, heater_tbl: 1, glow_table: 10 };
function isQtyAddon(svc) { return svc.freeUntil != null || ADDON_MAX_QTY[svc.id] != null; }
function addonMaxQty(svc) { return ADDON_MAX_QTY[svc.id] ?? 999; }
// Same line-price model as the wizard: furniture bills only above the included
// baseline; everything else is qty × unit price (checkbox items have qty 1).
function addonLinePrice(svc, qty) {
  if (!qty || qty < 1) return 0;
  if (svc.freeUntil != null) return Math.max(0, qty - svc.freeUntil) * svc.price;
  return qty * svc.price;
}

// Mandatory hall cleaning — added on every event, same rule as the wizard.

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

// ── i18n (BG default; strings live in translations-edit.js / EDIT_T) ──
const LANG_KEY = 'margel_lang';

function getLang() {
  try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'bg'; } catch (e) { return 'bg'; }
}

// Translate a key for the current language, falling back to BG then ''.
function t(key) {
  const dict = (typeof EDIT_T !== 'undefined' && (EDIT_T[getLang()] || EDIT_T.bg)) || {};
  return dict[key] !== undefined ? dict[key] : '';
}

// Display name for a catalog item (addon/drink) in the current language.
// IMPORTANT: this is for DISPLAY only — the save payload always uses name_en
// (see onSave) to stay consistent with what the booking wizard stores.
function nameOf(obj) {
  if (!obj) return '';
  return getLang() === 'en'
    ? (obj.name_en || obj.name_bg || obj.id || '')
    : (obj.name_bg || obj.name_en || obj.id || '');
}

// Apply the static (markup) translations for the current language.
function applyStaticI18n() {
  const lang = getLang();
  const dict = (typeof EDIT_T !== 'undefined' && EDIT_T[lang]) || {};
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (dict[k] !== undefined) el.textContent = dict[k];
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const k = el.getAttribute('data-i18n-html');
    if (dict[k] !== undefined) el.innerHTML = dict[k];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const k = el.getAttribute('data-i18n-ph');
    if (dict[k] !== undefined) el.setAttribute('placeholder', dict[k]);
  });
  document.documentElement.lang = lang;
  if (dict.doc_title) document.title = dict.doc_title;
  const tog = $('lang-toggle');
  if (tog) tog.textContent = lang === 'bg' ? 'EN' : 'BG';
}

function setupLangToggle() {
  const tog = $('lang-toggle');
  if (!tog || tog.dataset.wired) return;
  tog.dataset.wired = '1';
  tog.addEventListener('click', () => {
    const next = getLang() === 'bg' ? 'en' : 'bg';
    try { localStorage.setItem(LANG_KEY, next); } catch (e) {}
    applyStaticI18n();
    if (state.enquiry) refreshDynamicI18n();
  });
}

// Re-paint the language-dependent dynamic content after a toggle. Preserves all
// user input (date/guests/phone/notes are untouched) and all selections
// (addon/drink quantities live in state and survive the re-render). The
// flatpickr calendar keeps its initial locale until reload — a minor cosmetic
// detail not worth a risky destroy/recreate on the live edit flow.
function refreshDynamicI18n() {
  paintDynamic();
  renderAddons();
  const panel = $('drinks-panel');
  if (panel && !panel.hidden) renderDrinks();
}

// ── Entry ───────────────────────────────────────────────────

async function main() {
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
  // adminMode is already true, so paintDynamic() renders the "Админ редакция"
  // eyebrow — a visual cue that the admin is editing on the customer's behalf.
  renderForm();
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

  applyStaticI18n();   // static chrome (labels, states) in the current language
  paintDynamic();      // language-dependent dynamic text (eyebrow, headline, readonly…)

  $('field-guests').value = e.guests ?? '';
  $('field-phone').value = e.phone ?? '';
  $('field-notes').value = e.notes ?? '';

  initDatePicker();
  renderAddons();
  seedDrinkQtys();
  setupDrinksToggle();

  $('edit-form').addEventListener('submit', onSave);
  $('btn-reload').addEventListener('click', () => window.location.reload());
  setupLangToggle();

  show('state-form');
}

// Paint every language-dependent dynamic string. Safe to call repeatedly (on
// initial render and after a language toggle): it only writes text/markup, it
// never binds listeners.
function paintDynamic() {
  const e = state.enquiry;
  const timeLabel = e.time_of_day === 'day' ? t('time_day') : t('time_evening');

  $('form-eyebrow').textContent = `${adminMode ? t('admin_edit_prefix') : t('edit_prefix')} · ${e.event_type}`;
  $('form-headline').innerHTML = `${esc(t('headline_pre'))} <em>${esc(t('headline_on'))} ${esc(fmtDateBg(e.preferred_date))}</em>.`;
  $('colophon-date').textContent = fmtDateBg(e.preferred_date);

  $('readonly-block').innerHTML = `
    <div>
      <span class="label-caps">${esc(t('ro_event'))}</span>
      <strong>${esc(e.event_type)}</strong>
    </div>
    <div>
      <span class="label-caps">${esc(t('ro_time'))}</span>
      <strong>${esc(timeLabel)}</strong>
    </div>
    <div>
      <span class="label-caps">${esc(t('ro_email'))}</span>
      <strong>${esc(e.email)}</strong>
    </div>
  `;

  $('saved-email').textContent = e.email || t('saved_email_fallback');
  paintDrinksToggle();
}

// Drinks are always hidden behind a CTA so the form opens shorter. If the
// customer already has drinks saved we surface a count on the button instead
// of auto-expanding, so they still notice there are items to review.
// Text-only (no binding) — safe to call on initial render and on language
// toggle. If the customer already has drinks saved, surface a count instead of
// the generic prompt.
function paintDrinksToggle() {
  const btn = $('btn-toggle-drinks');
  const wrap = $('drinks-toggle-wrap');
  const prompt = wrap?.querySelector('.drinks-toggle-prompt');
  if (!btn) return;

  const existing = Array.isArray(state.enquiry.drinks) ? state.enquiry.drinks : [];
  const existingCount = existing.reduce((n, d) => n + (Number(d.qty) || 0), 0);

  if (existingCount > 0) {
    if (prompt) prompt.textContent = `${t('drinks_have_a')} ${existingCount} ${t('drinks_have_b')}`;
    btn.textContent = t('drinks_show_short');
  } else {
    if (prompt) prompt.textContent = t('drinks_prompt');
    btn.textContent = t('drinks_show_menu');
  }
}

function setupDrinksToggle() {
  const btn = $('btn-toggle-drinks');
  const panel = $('drinks-panel');
  const wrap = $('drinks-toggle-wrap');
  if (!btn || !panel) return;

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
    locale: (getLang() === 'bg' && typeof flatpickr.l10ns !== 'undefined' && flatpickr.l10ns.bg) ? 'bg' : 'default',
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
      // Quantity card — typeable input similar to the drinks tiles.
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
        <span class="addon-card__name">${esc(nameOf(svc))}</span>
        <span class="addon-card__price">€${Math.round(svc.price)} ${esc(t('per_piece'))}</span>
        ${svc.freeUntil != null ? `<span class="addon-card__hint">${esc(t('first_incl_a'))} ${svc.freeUntil} ${esc(t('first_incl_b'))}</span>` : ''}
      `;

      const qtyWrap = document.createElement('span');
      qtyWrap.className = 'addon-qty';
      const minus = document.createElement('button');
      minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', t('aria_decrease'));
      const num = document.createElement('input');
      num.type = 'number'; num.min = '0'; num.max = String(addonMaxQty(svc)); num.step = '1';
      num.inputMode = 'numeric'; num.value = qty;
      num.setAttribute('aria-label', t('aria_qty'));
      const plus = document.createElement('button');
      plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', t('aria_increase'));
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
      <span class="addon-card__name">${esc(nameOf(svc))}</span>
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
}

// Seed the drink quantities from the saved enquiry at FORM LOAD, not when
// the drinks panel is first opened. onSave always sends `drinks` built from
// state.drinkQtys — seeding lazily meant a save without opening the panel
// sent an empty array and silently wiped the customer's whole drinks order.
function seedDrinkQtys() {
  if (Object.keys(state.drinkQtys).length > 0) return;
  const pool = typeof drinks !== 'undefined' ? drinks : [];
  (state.enquiry.drinks ?? []).forEach(d => {
    const cat = pool.find(x => x.id === d.id)?.cat;
    const max = cat >= 3 ? 200 : 100; // same caps as the steppers + server
    state.drinkQtys[d.id] = Math.min(Number(d.qty) || 0, max);
  });
}

function renderDrinks() {
  renderDrinkTabs();
  renderDrinkTiles();
}

function renderDrinkTabs() {
  const tabs = $('drinks-tabs');
  tabs.innerHTML = '';
  const cats = (typeof drinkCategories !== 'undefined' ? (drinkCategories[getLang()] || drinkCategories.bg) : []) || [];
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
      // If the asset is missing, drop the <img> and let the CSS placeholder
      // (label-caps initial) show through — keeps the layout from collapsing.
      i.addEventListener('error', () => { i.remove(); img.classList.add('drink-tile__img--fallback'); img.textContent = (nameOf(drink) || '?')[0]; });
      img.appendChild(i);
    } else {
      img.classList.add('drink-tile__img--fallback');
      img.textContent = (nameOf(drink) || '?')[0];
    }

    const body = document.createElement('span');
    body.className = 'drink-tile__body';

    const name = document.createElement('span');
    name.className = 'drink-tile__name';
    name.textContent = nameOf(drink);

    const price = document.createElement('span');
    price.className = 'drink-tile__price';
    price.textContent = drink.price_eur != null ? `€${drink.price_eur.toFixed(2)}` : t('price_on_request');

    // Same per-category caps as the wizard and the server: non-alcoholic
    // (soft drinks + water, cat 3 & 4) up to 200, alcoholic up to 100.
    const maxQty = drink.cat >= 3 ? 200 : 100;
    const qtyWrap = document.createElement('span');
    qtyWrap.className = 'drink-qty';
    const minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', t('aria_decrease'));
    const num = document.createElement('input');
    num.type = 'number';
    num.min = '0';
    num.max = String(maxQty);
    num.step = '1';
    num.inputMode = 'numeric';
    num.value = qty;
    num.setAttribute('aria-label', t('aria_qty'));
    const plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', t('aria_increase'));

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
  btn.textContent = t('saving');

  const preferred_date = $('field-date').value.trim();
  const guests = parseInt($('field-guests').value, 10);
  const phone = $('field-phone').value.trim();
  const notes = $('field-notes').value.trim() || null;

  if (!preferred_date) {
    errEl.textContent = t('err_pick_date');
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = t('save');
    return;
  }

  // Same bounds the server enforces (1..200) — fail here with a clear
  // message instead of a generic save error.
  if (!Number.isInteger(guests) || guests < 1 || guests > 200) {
    errEl.textContent = t('err_guests_range');
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = t('save');
    return;
  }

  const addons = [];
  addonServices.forEach(svc => {
    const qty = state.addonQtys[svc.id] || 0;
    if (qty <= 0) return;
    const linePrice = addonLinePrice(svc, qty);
    // name_en matches what the reservation wizard stores — using name_bg here
    // made every save rename untouched items, firing a spurious "changed"
    // diff email and burning an edit_count increment toward the lock cap.
    const entry = { id: svc.id, name: svc.name_en, price: linePrice };
    if (isQtyAddon(svc)) entry.qty = qty;
    addons.push(entry);
  });

  // Mandatory hall cleaning — added on every event, same rule the wizard
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
      // Drink no longer in the catalog — keep the saved row instead of
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
    errEl.textContent = t('err_save');
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = t('save');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Apply translations + wire the language toggle for EVERY state (loading,
  // not-found, expired, locked, form), not just the form.
  applyStaticI18n();
  setupLangToggle();
  main();
});
