// Catalog loaded externally: window globals `eventTypes`, `includedLabels`,
// `venueIncluded`, `addonServices`, `drinkCategories`, `drinks` come from
// `js/reservation-catalog.js` and `js/drinks-data.js`. Keep this file ordered
// AFTER those two in reservation.html.


// ── State ──
let currentStep = 0;
const TOTAL_STEPS = 6;
// `addons` is keyed by svc.id; the value is the integer qty (0 = unselected).
// Furniture items (freeUntil) and heater items have a typeable stepper; every
// other addon behaves as a checkbox where qty toggles between 0 and 1.
let booking = { event:null, date:'', time:'day', arrival_time:'', addons:{}, drinkQtys:{}, name:'', email:'', phone:'', guests:'', notes:'', payment:'cash' };

// Addons that take a stepper instead of a checkbox. Heaters cap at 5 (we
// physically have only that many), furniture uses freeUntil from the catalog.
const ADDON_MAX_QTY = { heater: 5, heater_tbl: 5 };
function isQtyAddon(svc) { return svc.freeUntil != null || ADDON_MAX_QTY[svc.id] != null; }
function addonMaxQty(svc) { return ADDON_MAX_QTY[svc.id] ?? 999; }
function addonLinePrice(svc, qty) {
  if (!qty || qty < 1) return 0;
  if (svc.freeUntil != null) return Math.max(0, qty - svc.freeUntil) * svc.price;
  return qty * svc.price;
}
let activeDrinkCat = 0;

// Time-of-day per resolved event id. Fallback to 'eve' for unknowns since
// most paid bookings happen in the evening.
const EVENT_TIME_OF_DAY = {
  evening:  'eve',
  corp4:    'day',
  corp8:    'day',
  bday_day: 'day',
  bday_eve: 'eve',
  wedding:  'eve',
};
function timeOfDayFor(eventId) {
  return EVENT_TIME_OF_DAY[eventId] || 'eve';
}

function getLang() { return localStorage.getItem('margel_lang') || 'bg'; }

// Display helpers — EUR throughout. Services are stored as integers, drinks as decimals.
function fmtSvc(eur) {
  if (eur == null) return getLang() === 'bg' ? 'По запитване' : 'On request';
  return '€' + eur;
}
function fmtDrink(eur) {
  if (eur == null) return getLang() === 'bg' ? 'По запитване' : 'On request';
  return '€' + eur.toFixed(2);
}
function fmtEvent(ev) {
  return '€' + ev.price_eur;
}

// ── Navigation ──
function goToStep(n) {
  if (n < 0 || n >= TOTAL_STEPS) return;
  document.getElementById('step-' + currentStep).classList.remove('active');
  currentStep = n;
  document.getElementById('step-' + currentStep).classList.add('active');
  updateProgress();
  const section = document.querySelector('.wizard-section');
  if (section) window.scrollTo({ top: section.offsetTop - 90, behavior: 'smooth' });
  if (n === 1) renderStep2VariantPicker();
  if (n === 2) renderAddons();
  if (n === 3) renderDrinks();
  if (n === 5) renderSummary();
}

function updateProgress() {
  const fill = currentStep / (TOTAL_STEPS - 1) * 100;
  const el = document.getElementById('progress-fill');
  if (el) el.style.width = fill + '%';
  document.querySelectorAll('.wstep').forEach((btn, i) => {
    btn.classList.remove('active', 'done');
    btn.removeAttribute('aria-current');
    if (i < currentStep) btn.classList.add('done');
    else if (i === currentStep) { btn.classList.add('active'); btn.setAttribute('aria-current', 'step'); }
  });
}

document.querySelectorAll('.wstep').forEach(btn => {
  btn.addEventListener('click', () => {
    const n = parseInt(btn.getAttribute('data-step'), 10);
    if (n < currentStep) goToStep(n);
  });
});

// ── Step 1: Event picker ──
function renderFreeIncluded() {
  const l = getLang();
  const list = document.getElementById('free-included-list');
  if (!list || typeof venueIncluded === 'undefined') return;
  list.innerHTML = '';
  venueIncluded.forEach(item => {
    const li = document.createElement('li');
    li.className = 'free-included__item';
    const icon = document.createElement('span'); icon.className = 'free-included__icon'; icon.textContent = item.icon || '✓';
    const text = document.createElement('span'); text.className = 'free-included__text';
    text.textContent = l === 'bg' ? item.label_bg : item.label_en;
    li.append(icon, text);
    list.appendChild(li);
  });
}

// Map event id to the dedicated detail sub-page. The detail page's "Резервирай"
// CTA links back to /reservation.html?event=ID, where the URL handler at the
// bottom of init() auto-selects that event and jumps to the date step.
const EVENT_DETAIL_PAGE = {
  evening:   'evening.html',
  corporate: 'corporate.html',
  birthday:  'birthday.html',
  wedding:   'wedding.html',
};

function renderEventPicker() {
  renderFreeIncluded();
  const l = getLang();
  const grid = document.getElementById('event-picker');
  if (!grid) return;
  grid.innerHTML = '';

  eventTypes.forEach(ev => {
    // Card is a real anchor so users can right-click / open in new tab.
    const card = document.createElement('a');
    card.className = 'event-pick-row';
    card.setAttribute('role', 'listitem');
    card.href = EVENT_DETAIL_PAGE[ev.id] || '#';

    const img = document.createElement('img');
    img.className = 'event-pick-row__img';
    img.src = ev.img; img.alt = l === 'bg' ? ev.title_bg : ev.title_en; img.loading = 'lazy';

    const body = document.createElement('div'); body.className = 'event-pick-row__body';
    const h3 = document.createElement('h3'); h3.className = 'event-pick-row__title';
    h3.textContent = l === 'bg' ? ev.title_bg : ev.title_en;

    const desc = document.createElement('p'); desc.className = 'event-pick-row__desc';
    desc.textContent = l === 'bg' ? (ev.desc_bg || '') : (ev.desc_en || '');

    const meta = document.createElement('div'); meta.className = 'event-pick-row__meta';
    if (!ev.variants) {
      const dur = document.createElement('span'); dur.className = 'event-pick-row__dur';
      dur.textContent = l === 'bg' ? ev.duration_bg : ev.duration_en;
      const price = document.createElement('span'); price.className = 'event-pick-row__price';
      price.textContent = fmtEvent(ev);
      meta.append(dur, price);
    } else {
      const priceRange = document.createElement('span'); priceRange.className = 'event-pick-row__price';
      const lo = Math.min(...ev.variants.map(v => v.price_eur));
      const hi = Math.max(...ev.variants.map(v => v.price_eur));
      priceRange.textContent = '€' + lo + ' – €' + hi;
      meta.append(priceRange);
    }

    const cta = document.createElement('span'); cta.className = 'event-pick-row__cta';
    cta.textContent = l === 'bg' ? 'Виж повече →' : 'Learn more →';

    body.append(h3, desc, meta, cta);
    card.append(img, body);
    grid.appendChild(card);
  });
}

// ── Step 2 variant picker (shown inside step 2 for corporate/birthday) ──
// Available arrival slots for the evening event. The customer picks one of
// these on the date step; we store the literal "HH:MM" string in
// booking.arrival_time and ship it to Supabase / the email summary.
const EVENING_ARRIVAL_SLOTS = ['19:00', '19:30', '20:00', '20:30', '21:00'];

function renderStep2VariantPicker() {
  const l = getLang();
  const wrap = document.getElementById('step2-variant-wrap');
  const errMsg = document.getElementById('err-variant-msg');
  if (!wrap) return;

  const ev = booking.event;
  if (!ev) {
    wrap.setAttribute('style', 'display:none');
    if (errMsg) errMsg.setAttribute('style', 'display:none');
    return;
  }

  // Evening event has no variants but does need an arrival time slot. Render
  // a chip picker instead of the variant grid.
  if (ev.id === 'evening') {
    wrap.setAttribute('style', 'display:block');
    wrap.innerHTML = '';

    const lbl = document.createElement('p'); lbl.className = 'variant-label';
    lbl.textContent = l === 'bg' ? 'Изберете час на пристигане:' : 'Choose arrival time:';
    wrap.appendChild(lbl);

    const btnWrap = document.createElement('div'); btnWrap.className = 'variant-btn-wrap';
    EVENING_ARRIVAL_SLOTS.forEach(slot => {
      const btn = document.createElement('button');
      btn.className = 'variant-btn arrival-btn' + (booking.arrival_time === slot ? ' selected' : '');
      btn.type = 'button';
      btn.textContent = slot;
      btn.addEventListener('click', () => {
        booking.arrival_time = slot;
        btnWrap.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (errMsg) errMsg.style.display = 'none';
        wrap.classList.remove('has-error');
        updatePreview();
      });
      btnWrap.appendChild(btn);
    });
    wrap.appendChild(btnWrap);
    return;
  }

  if (!ev.variants) {
    wrap.setAttribute('style', 'display:none');
    if (errMsg) errMsg.setAttribute('style', 'display:none');
    return;
  }

  wrap.setAttribute('style', 'display:block');
  wrap.innerHTML = '';

  const lbl = document.createElement('p'); lbl.className = 'variant-label';
  lbl.textContent = l === 'bg'
    ? (ev.id === 'corporate' ? 'Изберете продължителност:' : 'Изберете час:')
    : (ev.id === 'corporate' ? 'Choose duration:' : 'Choose time:');
  wrap.appendChild(lbl);

  const btnWrap = document.createElement('div'); btnWrap.className = 'variant-btn-wrap';

  ev.variants.forEach(variant => {
    const btn = document.createElement('button');
    btn.className = 'variant-btn';
    btn.type = 'button';

    const lbEl = document.createElement('span'); lbEl.className = 'variant-btn-label';
    let labelText = l === 'bg' ? variant.label_bg : variant.label_en;
    if (variant.sub_bg) labelText += '\n' + (l === 'bg' ? variant.sub_bg : variant.sub_en);
    lbEl.textContent = labelText;
    lbEl.style.whiteSpace = 'pre-line';
    btn.appendChild(lbEl);

    const prEl = document.createElement('span'); prEl.className = 'variant-btn-price';
    prEl.textContent = '€' + variant.price_eur;
    btn.appendChild(prEl);
    btnWrap.appendChild(btn);

    btn.addEventListener('click', () => {
      const parentEv = ev; // still has .variants at this point
      booking.event = {
        ...variant,
        title_bg: parentEv.title_bg + ' — ' + variant.label_bg,
        title_en: parentEv.title_en + ' — ' + variant.label_en,
        img: parentEv.img,
      };
      booking.time = timeOfDayFor(variant.id);
      btnWrap.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (errMsg) errMsg.style.display = 'none';
      wrap.classList.remove('has-error');
      updatePreview();
    });
  });

  wrap.appendChild(btnWrap);
}

// ── Occupied dates (fetched from Supabase at load time) ──
let _occupiedDates = [];

async function loadOccupiedDates() {
  try {
    const { data, error } = await reservationDb.from('occupied_dates').select('date');
    if (error) { console.warn('Occupied dates fetch error:', error.message); return; }
    if (data && data.length) {
      // Convert YYYY-MM-DD strings to local-time Date objects so Flatpickr matches correctly
      _occupiedDates = data.map(r => {
        const [y, m, d] = r.date.split('-').map(Number);
        return new Date(y, m - 1, d);
      });
    }
  } catch (err) {
    console.warn('Occupied dates fetch failed:', err);
  }
}

// ── Step 2: Datetime ──
function setupStep2() {
  const dateEl = document.getElementById('res-date');
  if (dateEl && typeof flatpickr !== 'undefined') {
    const lang = getLang();
    flatpickr(dateEl, {
      locale: lang === 'bg' ? 'bg' : 'default',
      dateFormat: 'd/m/Y',
      minDate: 'today',
      disableMobile: true,
      disable: _occupiedDates,
      onDayCreate(_dObj, _dStr, _fp, dayElem) {
        // Tag occupied days so the CSS tooltip "Заета Дата" shows on hover
        const d = dayElem.dateObj;
        if (!d) return;
        const isOccupied = _occupiedDates.some(od =>
          od.getFullYear() === d.getFullYear() &&
          od.getMonth()    === d.getMonth() &&
          od.getDate()     === d.getDate()
        );
        if (isOccupied) dayElem.classList.add('occupied-date');
      },
      onChange(_selectedDates, dateStr) {
        booking.date = dateStr;
        dateEl.closest('.form-group')?.classList.remove('has-error');
        updatePreview();
      }
    });
  }
  const btn = document.getElementById('btn-step2-next');
  if (btn) btn.addEventListener('click', () => {
    const d = document.getElementById('res-date');
    const fg = d?.closest('.form-group');
    if (!d?.value) { fg?.classList.add('has-error'); return; }
    fg?.classList.remove('has-error');
    booking.date = d.value;

    // If event still has variants (not yet resolved), require selection
    if (booking.event?.variants) {
      const wrap = document.getElementById('step2-variant-wrap');
      const errMsg = document.getElementById('err-variant-msg');
      wrap?.classList.add('has-error');
      if (errMsg) errMsg.style.display = 'block';
      return;
    }

    // Evening event: require an arrival time slot before advancing.
    if (booking.event?.id === 'evening' && !booking.arrival_time) {
      const wrap = document.getElementById('step2-variant-wrap');
      const errMsg = document.getElementById('err-variant-msg');
      wrap?.classList.add('has-error');
      if (errMsg) {
        errMsg.textContent = getLang() === 'bg' ? 'Моля изберете час на пристигане.' : 'Please choose an arrival time.';
        errMsg.style.display = 'block';
      }
      return;
    }

    goToStep(2);
  });
}

function updatePreview() {
  const preview = document.getElementById('event-preview');
  if (!preview || !booking.event) return;
  const l = getLang();
  preview.classList.add('show'); preview.innerHTML = '';

  const h4 = document.createElement('h4');
  h4.textContent = l === 'bg' ? booking.event.title_bg : booking.event.title_en;
  preview.appendChild(h4);

  // Variant tag (day/night or 4h/8h) — only when variant is resolved
  if (booking.event.label_bg && !booking.event.variants) {
    const tag = document.createElement('span');
    tag.className = 'preview-variant-tag';
    tag.textContent = l === 'bg' ? booking.event.label_bg : booking.event.label_en;
    preview.appendChild(tag);
  }

  // Price line — only show when variant is resolved (price_eur available)
  if (!booking.event.variants) {
    const p = document.createElement('p');
    p.textContent = fmtEvent(booking.event) + (booking.date ? ' · ' + booking.date : '');
    preview.appendChild(p);
  } else if (booking.date) {
    const p = document.createElement('p'); p.textContent = booking.date;
    preview.appendChild(p);
  }
}

// ── Step 3: Add-on services ──
function renderAddons() {
  const l = getLang();
  const grid = document.getElementById('addon-grid');
  if (!grid) return;
  grid.innerHTML = '';

  addonServices.forEach(svc => {
    if (isQtyAddon(svc)) {
      renderQtyAddon(grid, svc, l);
    } else {
      renderCheckboxAddon(grid, svc, l);
    }
  });
  updateAddonsTotal();
}

function renderCheckboxAddon(grid, svc, l) {
  const qty = booking.addons[svc.id] || 0;
  const item = document.createElement('label');
  item.className = 'addon-item' + (qty > 0 ? ' selected' : '');
  const input = document.createElement('input'); input.type = 'checkbox'; input.checked = qty > 0;

  const visual = document.createElement('div');
  if (svc.img) { visual.className = 'addon-img'; const i = document.createElement('img'); i.src = svc.img; i.alt = ''; visual.appendChild(i); }
  else { visual.className = 'addon-emoji'; visual.textContent = svc.emoji || '⭐'; visual.setAttribute('aria-hidden', 'true'); }

  const info = document.createElement('div'); info.className = 'addon-info';
  const name = document.createElement('div'); name.className = 'addon-name'; name.textContent = l === 'bg' ? svc.name_bg : svc.name_en;
  const price = document.createElement('div'); price.className = 'addon-price'; price.textContent = fmtSvc(svc.price);
  info.appendChild(name); info.appendChild(price);

  const check = document.createElement('div'); check.className = 'addon-check'; check.setAttribute('aria-hidden','true'); check.textContent = '✓';

  item.appendChild(input); item.appendChild(visual); item.appendChild(info); item.appendChild(check);
  grid.appendChild(item);

  item.addEventListener('change', () => {
    booking.addons[svc.id] = input.checked ? 1 : 0;
    item.classList.toggle('selected', input.checked);
    updateAddonsTotal();
  });
}

function renderQtyAddon(grid, svc, l) {
  const qty = booking.addons[svc.id] || 0;
  const item = document.createElement('div');
  item.className = 'addon-item addon-item--qty' + (qty > 0 ? ' selected' : '');

  const visual = document.createElement('div');
  if (svc.img) { visual.className = 'addon-img'; const i = document.createElement('img'); i.src = svc.img; i.alt = ''; visual.appendChild(i); }
  else { visual.className = 'addon-emoji'; visual.textContent = svc.emoji || '⭐'; visual.setAttribute('aria-hidden', 'true'); }

  const info = document.createElement('div'); info.className = 'addon-info';
  const name = document.createElement('div'); name.className = 'addon-name'; name.textContent = l === 'bg' ? svc.name_bg : svc.name_en;
  const price = document.createElement('div'); price.className = 'addon-price';
  price.textContent = '€' + Math.round(svc.price) + (l === 'bg' ? ' / бр.' : ' / pc');
  info.appendChild(name); info.appendChild(price);

  if (svc.freeUntil != null) {
    const hint = document.createElement('div'); hint.className = 'addon-hint';
    hint.textContent = l === 'bg' ? `Първите ${svc.freeUntil} са включени` : `First ${svc.freeUntil} included`;
    info.appendChild(hint);
  }

  const stepper = document.createElement('div'); stepper.className = 'addon-qty';
  const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Намали');
  const num = document.createElement('input'); num.type = 'number'; num.min = '0'; num.max = String(addonMaxQty(svc)); num.step = '1'; num.inputMode = 'numeric'; num.value = qty;
  const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Увеличи');
  stepper.append(minus, num, plus);

  item.append(visual, info, stepper);
  grid.appendChild(item);

  const setQty = (next) => {
    const n = Math.max(0, Math.min(addonMaxQty(svc), Math.floor(Number(next) || 0)));
    booking.addons[svc.id] = n;
    num.value = n;
    item.classList.toggle('selected', n > 0);
    updateAddonsTotal();
  };
  minus.addEventListener('click', () => setQty((booking.addons[svc.id] || 0) - 1));
  plus.addEventListener('click',  () => setQty((booking.addons[svc.id] || 0) + 1));
  num.addEventListener('input', () => setQty(num.value));
  num.addEventListener('focus', () => num.select());
  num.addEventListener('blur',  () => { if (num.value === '' || isNaN(Number(num.value))) setQty(0); });
}

function updateAddonsTotal() {
  let total = 0;
  for (const [id, qty] of Object.entries(booking.addons)) {
    const svc = addonServices.find(s => s.id === id);
    if (svc) total += addonLinePrice(svc, qty);
  }
  const el = document.getElementById('addons-total-val');
  if (el) el.textContent = '€' + total.toFixed(total % 1 ? 2 : 0);
}

// ── Drinks prompt (between add-ons and drinks) ──
function showDrinksPrompt() {
  const l = getLang();
  const prompt = document.getElementById('drinks-prompt');
  const textEl = document.getElementById('drinks-prompt-text');
  const yesBtn = document.getElementById('drinks-prompt-yes');
  const noBtn = document.getElementById('drinks-prompt-no');
  if (!prompt) { goToStep(3); return; }

  textEl.textContent = l === 'bg'
    ? 'Желаете ли да разгледате менюто с напитки?'
    : 'Would you like to see our drinks menu?';
  yesBtn.textContent = l === 'bg' ? 'Да, покажи менюто' : 'Yes, show menu';
  noBtn.textContent = l === 'bg' ? 'Не, продължи напред' : 'No, skip';

  prompt.style.display = 'flex';

  yesBtn.onclick = function() { prompt.style.display = 'none'; goToStep(3); };
  noBtn.onclick = function() { prompt.style.display = 'none'; goToStep(4); };
}

// ── Step 4: Drinks ──
function renderDrinksNav() {
  const l = getLang();
  const tabs = document.getElementById('drinks-tabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  drinkCategories[l].forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className = 'drinks-tab' + (i === activeDrinkCat ? ' active' : '');
    btn.textContent = cat; btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => { activeDrinkCat = i; renderDrinks(); });
    tabs.appendChild(btn);
  });
}

function renderDrinks() {
  const l = getLang();
  renderDrinksNav();
  const grid = document.getElementById('drinks-grid');
  if (!grid) return;
  grid.innerHTML = '';
  drinks.filter(d => d.cat === activeDrinkCat).forEach(drink => {
    const qty = booking.drinkQtys[drink.id] || 0;
    const item = document.createElement('div');
    item.className = 'drink-item' + (qty > 0 ? ' has-qty' : '');

    const img = document.createElement('img'); img.src = drink.img; img.alt = l === 'bg' ? drink.name_bg : drink.name_en; img.loading = 'lazy';
    const body = document.createElement('div'); body.className = 'drink-body';
    const name = document.createElement('div'); name.className = 'drink-name'; name.textContent = l === 'bg' ? drink.name_bg : drink.name_en;
    const price = document.createElement('div'); price.className = 'drink-price';
    price.textContent = fmtDrink(drink.price_eur);

    const qtyWrap = document.createElement('div'); qtyWrap.className = 'drink-qty';
    const minus = document.createElement('button'); minus.className = 'qty-btn'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Decrease');
    const num = document.createElement('span'); num.className = 'qty-num'; num.textContent = qty;
    const plus = document.createElement('button'); plus.className = 'qty-btn'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Increase');

    qtyWrap.appendChild(minus); qtyWrap.appendChild(num); qtyWrap.appendChild(plus);
    body.appendChild(name); body.appendChild(price); body.appendChild(qtyWrap);
    item.appendChild(img); item.appendChild(body); grid.appendChild(item);

    minus.addEventListener('click', () => {
      booking.drinkQtys[drink.id] = Math.max(0, (booking.drinkQtys[drink.id] || 0) - 1);
      num.textContent = booking.drinkQtys[drink.id];
      item.classList.toggle('has-qty', booking.drinkQtys[drink.id] > 0);
      updateDrinksTotal();
    });
    plus.addEventListener('click', () => {
      booking.drinkQtys[drink.id] = (booking.drinkQtys[drink.id] || 0) + 1;
      num.textContent = booking.drinkQtys[drink.id];
      item.classList.add('has-qty');
      updateDrinksTotal();
    });
  });
}

function updateDrinksTotal() {
  let total = 0;
  drinks.forEach(d => { if (d.price_eur) total += (booking.drinkQtys[d.id] || 0) * d.price_eur; });
  const el = document.getElementById('drinks-total-val');
  if (el) el.textContent = '€' + total.toFixed(2);
}

// ── Step 5: Contact ──
function setupStep5() {
  const btn = document.getElementById('btn-step5-next');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const name = document.getElementById('res-name'), email = document.getElementById('res-email'),
          phone = document.getElementById('res-phone'), guests = document.getElementById('res-guests');
    let valid = true;
    function v(el, fg, test) { const g = document.getElementById(fg); if (!test(el?.value||'')) { g?.classList.add('has-error'); valid=false; } else g?.classList.remove('has-error'); }
    v(name,'fg-name', val => val.trim().length >= 2);
    v(email,'fg-email', val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()));
    v(phone,'fg-phone', val => val.replace(/\D/g,'').length >= 7);
    v(guests,'fg-guests', val => { const n=parseInt(val); return n>=1 && n<=200; });
    if (!valid) return;
    booking.name = name.value.trim(); booking.email = email.value.trim();
    booking.phone = phone.value.trim(); booking.guests = guests.value;
    booking.notes = document.getElementById('res-message')?.value.trim() || '';
    goToStep(5);
  });
}

// ── Step 6: Summary ──
function renderSummary() {
  const l = getLang();
  const container = document.getElementById('booking-summary');
  const priceSummary = document.getElementById('price-summary');
  if (!container || !booking.event) return;
  // Variant-bearing parents (e.g. 'corporate' before 4h/8h is picked) have no
  // price_eur; rendering would produce '€NaN'. Bounce the user back to step 1
  // to resolve the variant. The step 1→2 guard normally prevents this, but a
  // direct nav (e.g. forward-button on the wizard) can still land here.
  if (booking.event.variants) {
    container.innerHTML = '';
    if (priceSummary) priceSummary.innerHTML = '';
    goToStep(1);
    return;
  }
  container.innerHTML = '';

  const img = document.createElement('img'); img.src = booking.event.img; img.alt = ''; img.className = 'summary-img';
  const body = document.createElement('div'); body.className = 'summary-body';
  [
    { label: l==='bg'?'Събитие':'Event',   value: l==='bg'?booking.event.title_bg:booking.event.title_en },
    { label: l==='bg'?'Дата':'Date',       value: booking.date },
    { label: l==='bg'?'Гости':'Guests',    value: booking.guests },
    { label: l==='bg'?'Три имена':'Name',  value: booking.name },
    { label: l==='bg'?'Имейл':'Email',     value: booking.email },
    { label: l==='bg'?'Телефон':'Phone',   value: booking.phone },
  ].forEach(row => {
    const div = document.createElement('div'); div.className = 'summary-row';
    const lbl = document.createElement('span'); lbl.className = 'sr-label'; lbl.textContent = row.label;
    const val = document.createElement('span'); val.className = 'sr-value'; val.textContent = row.value || '—';
    div.appendChild(lbl); div.appendChild(val); body.appendChild(div);
  });
  container.appendChild(img); container.appendChild(body);

  // Price breakdown — all in EUR
  if (priceSummary) {
    priceSummary.innerHTML = '';
    let addonsTotal = 0;
    for (const [id, q] of Object.entries(booking.addons)) {
      const svc = addonServices.find(s => s.id === id);
      if (svc) addonsTotal += addonLinePrice(svc, q);
    }
    let drinksTotal = 0; drinks.forEach(d => { if (d.price_eur) drinksTotal += (booking.drinkQtys[d.id]||0)*d.price_eur; });
    const venuePrice = booking.event.price_eur;
    const VENUE_MIN_GUESTS = 40;
    const EXTRA_GUEST_FEE_EUR = 15;
    const guests = Number(booking.guests) || 0;
    const extraGuests = Math.max(0, guests - VENUE_MIN_GUESTS);
    const extraGuestsCost = extraGuests * EXTRA_GUEST_FEE_EUR;
    const discountPercent = booking.discountPercent || 0;
    const discountAmount = discountPercent > 0 ? venuePrice * (discountPercent / 100) : 0;
    const grandTotal = venuePrice + extraGuestsCost + addonsTotal + drinksTotal - discountAmount;
    const rows = [
      { label: (l==='bg'?'Наем на зала':'Venue rental') + ` (${l==='bg'?'до':'up to'} ${VENUE_MIN_GUESTS} ${l==='bg'?'гости':'guests'})`, value: fmtEvent(booking.event) },
      ...(extraGuests > 0 ? [{ label: (l==='bg'?`+${extraGuests} допълнителни гости`:`+${extraGuests} extra guests`) + ` (× €${EXTRA_GUEST_FEE_EUR})`, value: '€' + extraGuestsCost.toFixed(2) }] : []),
      ...(addonsTotal > 0 ? [{ label: l==='bg'?'Допълнителни услуги':'Add-on services', value: '€' + addonsTotal }] : []),
      ...(drinksTotal > 0 ? [{ label: l==='bg'?'Напитки':'Drinks', value: '€' + drinksTotal.toFixed(2) }] : []),
      ...(discountAmount > 0 ? [{ label: (l==='bg'?'Отстъпка':'Discount') + ` (${discountPercent}%)`, value: '−€' + discountAmount.toFixed(2), discount: true }] : []),
      { label: l==='bg'?'Обща сума':'Total', value: '€' + grandTotal.toFixed(2), total: true },
    ];
    rows.forEach(row => {
      const div = document.createElement('div'); div.className = 'price-summary-row';
      const lbl = document.createElement('span'); lbl.className = 'ps-label'; lbl.textContent = row.label;
      const val = document.createElement('span'); val.className = 'ps-value'; val.textContent = row.value;
      if (row.total) { div.style.fontWeight = '700'; div.style.fontSize = '1rem'; }
      if (row.discount) { div.style.color = '#2F8F4F'; }
      div.appendChild(lbl); div.appendChild(val); priceSummary.appendChild(div);
    });
  }
}

// ── Promo code ──
const SUPABASE_FN_BASE = 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1';

function setupPromo() {
  const input = document.getElementById('promo-input');
  const apply = document.getElementById('promo-apply');
  const status = document.getElementById('promo-status');
  if (!input || !apply || !status) return;

  apply.addEventListener('click', async () => {
    const code = input.value.trim().toUpperCase();
    if (!code) return;
    apply.disabled = true;
    status.textContent = getLang() === 'bg' ? 'Проверяваме…' : 'Checking…';
    status.style.color = '#7A7568';

    try {
      const r = await fetch(`${SUPABASE_FN_BASE}/validate-discount-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = await r.json().catch(() => ({}));
      if (body.valid) {
        booking.discountCode = code;
        booking.discountPercent = body.percent;
        status.textContent = (getLang() === 'bg' ? `✓ Кодът е валиден. Отстъпка: ${body.percent}%` : `✓ Valid. Discount: ${body.percent}%`);
        status.style.color = '#2F8F4F';
        input.disabled = true;
        apply.textContent = getLang() === 'bg' ? 'Приложен' : 'Applied';
      } else {
        const bg = {
          not_found: 'Кодът не е намерен.',
          already_used: 'Кодът вече е използван.',
          expired: 'Кодът е изтекъл.',
          invalid_format: 'Невалиден формат.',
          confusable_chars: 'Проверете цифрите 0/1 и буквите O/I — кодовете ни не съдържат тези знаци.',
        };
        const en = {
          not_found: 'Code not found.',
          already_used: 'Code already used.',
          expired: 'Code expired.',
          invalid_format: 'Invalid format.',
          confusable_chars: 'Check 0/1 and O/I — our codes never contain those characters.',
        };
        const dict = getLang() === 'bg' ? bg : en;
        status.textContent = dict[body.error] || (getLang() === 'bg' ? 'Невалиден код.' : 'Invalid code.');
        status.style.color = '#c62828';
        apply.disabled = false;
      }
    } catch (err) {
      console.error(err);
      status.textContent = 'Грешка при проверката.';
      status.style.color = '#c62828';
      apply.disabled = false;
    }
    renderSummary();
  });

  input.addEventListener('input', () => {
    if (booking.discountCode && input.value.trim().toUpperCase() !== booking.discountCode) {
      booking.discountCode = null;
      booking.discountPercent = 0;
      status.textContent = '';
      input.disabled = false;
      apply.disabled = false;
      apply.textContent = getLang() === 'bg' ? 'Приложи' : 'Apply';
      renderSummary();
    }
  });
}

// ── Submit ──
function setupSubmit() {
  const btn = document.getElementById('btn-submit');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    booking.payment = document.querySelector('input[name="payment"]:checked')?.value || 'cash';

    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = getLang() === 'bg' ? 'Изпращане…' : 'Sending…';

    // Serialize add-ons: only those with qty > 0. Each row stores the LINE
    // price (qty already factored in, freeUntil applied) so the email/admin
    // totals don't need to know about freeUntil. qty is included for
    // furniture + heater rows so the admin can see the count.
    const addonsPayload = Object.entries(booking.addons)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const svc = addonServices.find(s => s.id === id);
        const linePrice = svc ? addonLinePrice(svc, qty) : 0;
        const entry = { id, name: svc ? svc.name_en : id, price: linePrice };
        if (svc && isQtyAddon(svc)) entry.qty = qty;
        return entry;
      });

    // Serialize drinks: only items with qty > 0
    const drinksPayload = Object.entries(booking.drinkQtys)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const drink = drinks.find(d => d.id === id);
        return { id, name: drink ? drink.name_en : id, qty, price_eur: drink?.price_eur ?? null };
      });

    const payload = {
      full_name: booking.name,
      email: booking.email,
      phone: booking.phone,
      arrival_time: booking.arrival_time || null,
      event_type: booking.event ? booking.event.title_en : '',
      event_id: booking.event ? booking.event.id : '',
      preferred_date: booking.date,
      time_of_day: booking.time,
      guests: booking.guests ? parseInt(booking.guests, 10) : null,
      addons: addonsPayload,
      drinks: drinksPayload,
      payment_method: booking.payment,
      notes: booking.notes || null,
    };

    const { data: inserted, error } = await reservationDb.from('enquiries').insert(payload).select('id').single();

    // If a promo code was applied, redeem it now. Best-effort: a failure
    // here does NOT block the booking — the customer still gets their event.
    if (!error && inserted && booking.discountCode) {
      try {
        await fetch(`${SUPABASE_FN_BASE}/redeem-discount-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: booking.discountCode, enquiry_id: inserted.id }),
        });
      } catch (redeemErr) {
        console.warn('Discount redeem failed:', redeemErr);
      }
    }

    if (error) {
      console.error('Enquiry submission error:', error);
      btn.disabled = false;
      btn.textContent = origText;
      const lang = getLang();
      alert(lang === 'bg'
        ? 'Нещо се обърка. Моля обадете ни се директно на 0888 100 042.'
        : 'Something went wrong. Please call us directly on 0888 100 042.');
      return;
    }

    // Success — show confirmation
    document.getElementById('step-5')?.classList.remove('active');
    document.querySelector('.wizard-progress').style.display = 'none';
    document.getElementById('form-success').style.display = 'block';
    window.scrollTo({ top: document.querySelector('.wizard-section').offsetTop - 90, behavior: 'smooth' });
  });
}

// ── Language change ──
document.addEventListener('langChange', () => {
  renderEventPicker();
  if (currentStep === 1) renderStep2VariantPicker();
  if (currentStep === 2) renderAddons();
  if (currentStep === 3) renderDrinks();
  if (currentStep === 5) renderSummary();
  updatePreview();
  updateAddonsTotal();
  updateDrinksTotal();
});

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadOccupiedDates();   // fetch occupied dates before flatpickr initialises
  renderEventPicker();
  setupStep2();
  setupStep5();
  setupPromo();
  setupSubmit();
  updateProgress();

  // Auto-select event from URL param (e.g. ?event=evening or ?event=corporate)
  const params = new URLSearchParams(window.location.search);
  const preselect = params.get('event');
  if (preselect) {
    const match = eventTypes.find(e => e.id === preselect);
    if (match) {
      booking.event = match;
      if (!match.variants) booking.time = timeOfDayFor(match.id);
      renderEventPicker();
      setTimeout(() => goToStep(1), 300);
    }
  }
});
