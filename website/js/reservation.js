// Catalog loaded externally: window globals `eventTypes`, `includedLabels`,
// `venueIncluded` come from `js/reservation-catalog.js`; `addonServices`,
// `drinkCategories`, `drinks` come from `js/catalog-db.js`. Keep this file
// ordered AFTER those two in reservation.html.


// ── State ──
let currentStep = 0;
const TOTAL_STEPS = 7;
// `addons` is keyed by svc.id; the value is the integer qty (0 = unselected).
// Furniture items (freeUntil) and heater items have a typeable stepper; every
// other addon behaves as a checkbox where qty toggles between 0 and 1.
let booking = { event:null, date:'', time:'day', arrival_time:'', addons:{}, drinkQtys:{}, partners:{}, name:'', email:'', phone:'', guests:'', notes:'', payment:'cash' };

// Addons that use a +/- typeable qty input instead of an on/off toggle.
// Inventory caps come from the catalog's max_qty column (admin-editable);
// furniture uses freeUntil. Everything else is an on/off checkbox.
function isQtyAddon(svc) { return svc.freeUntil != null || svc.maxQty != null; }
function addonMaxQty(svc) { return svc.maxQty ?? 999; }
function addonLinePrice(svc, qty) {
  if (!qty || qty < 1) return 0;
  if (svc.freeUntil != null) return Math.max(0, qty - svc.freeUntil) * svc.price;
  return qty * svc.price;
}

// Mandatory hall cleaning - auto-added on EVERY event regardless of guest
// count. Returns the cleaning addon (or null if the catalog entry is missing,
// or the user already selected it on the addons page). Used by both the
// summary and the submit payload so the customer sees + gets billed for it.
function autoCleaningAddon() {
  if ((booking.addons['cleaning'] || 0) > 0) return null;
  return addonServices.find(s => s.id === 'cleaning') || null;
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

// Display helpers - EUR throughout. Services are stored as integers, drinks as decimals.
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
  if (n === 4) renderPartners();
  if (n === 6) renderSummary();
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
      priceRange.textContent = '€' + lo + ' - €' + hi;
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
        title_bg: parentEv.title_bg + ' - ' + variant.label_bg,
        title_en: parentEv.title_en + ' - ' + variant.label_en,
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
        // Weekday promo nudge: show the -20% hint when the picked date
        // qualifies (Mon-Thu until 2026-08-31).
        const promoHint = document.getElementById('weekday-promo-hint');
        if (promoHint) promoHint.hidden = weekdayPromoPercent(dateStr) === 0;
        // Seasonal price notice: the venue costs a flat calendar price on
        // these dates (Dec 1-30, May 19 - Jun 10, Dec 31) - see js/seasonal-pricing.js.
        const seasonalHint = document.getElementById('seasonal-price-hint');
        if (seasonalHint) {
          const sp = window.seasonalVenuePrice(dateStr);
          if (sp == null) {
            seasonalHint.hidden = true;
          } else {
            const sl = getLang();
            const isNye = /^31\/12\//.test(dateStr);
            seasonalHint.textContent = isNye
              ? (sl === 'bg' ? `Новогодишна вечер — наем на залата €${sp}.` : `New Year's Eve — venue rental €${sp}.`)
              : (sl === 'bg' ? `Празничен период — наем на залата €${sp} за тази дата.` : `Holiday-season date — venue rental €${sp} for this date.`);
            seasonalHint.hidden = false;
          }
        }
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

  // Variant tag (day/night or 4h/8h) - only when variant is resolved
  if (booking.event.label_bg && !booking.event.variants) {
    const tag = document.createElement('span');
    tag.className = 'preview-variant-tag';
    tag.textContent = l === 'bg' ? booking.event.label_bg : booking.event.label_en;
    preview.appendChild(tag);
  }

  // Price line - only show when variant is resolved (price_eur available)
  if (!booking.event.variants) {
    const p = document.createElement('p');
    const previewPrice = window.seasonalVenuePrice(booking.date);
    p.textContent = (previewPrice != null ? '€' + previewPrice : fmtEvent(booking.event))
      + (booking.date ? ' · ' + booking.date : '');
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
  // langChange can fire before loadCatalog() resolves (main.js dispatches it at startup)
  if (typeof addonServices === 'undefined') return;
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
  // "Skip drinks" still lands on the Partners step (4) - skipping the drinks
  // menu must not skip partners.
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
    const minus = document.createElement('button'); minus.type = 'button'; minus.className = 'qty-btn'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Decrease');
    // Non-alcoholic drinks (soft drinks + water, cat 3 & 4) cap at 200; everything alcoholic caps at 100.
    const maxQty = drink.cat >= 3 ? 200 : 100;
    const num = document.createElement('input'); num.type = 'number'; num.className = 'qty-num qty-num--input'; num.min = '0'; num.max = String(maxQty); num.step = '1'; num.inputMode = 'numeric'; num.value = qty;
    const plus = document.createElement('button'); plus.type = 'button'; plus.className = 'qty-btn'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Increase');

    qtyWrap.appendChild(minus); qtyWrap.appendChild(num); qtyWrap.appendChild(plus);
    body.appendChild(name); body.appendChild(price); body.appendChild(qtyWrap);
    item.appendChild(img); item.appendChild(body); grid.appendChild(item);

    const setQty = (next) => {
      const n = Math.max(0, Math.min(maxQty, Math.floor(Number(next) || 0)));
      booking.drinkQtys[drink.id] = n;
      if (num.value !== String(n)) num.value = n;
      item.classList.toggle('has-qty', n > 0);
      updateDrinksTotal();
    };
    minus.addEventListener('click', () => setQty((booking.drinkQtys[drink.id] || 0) - 1));
    plus.addEventListener('click',  () => setQty((booking.drinkQtys[drink.id] || 0) + 1));
    num.addEventListener('input', () => setQty(num.value));
    num.addEventListener('focus', () => num.select());
    num.addEventListener('blur',  () => { if (num.value === '' || isNaN(Number(num.value))) setQty(0); });
  });
}

function updateDrinksTotal() {
  // langChange can fire before loadCatalog() resolves (main.js dispatches it at startup)
  if (typeof drinks === 'undefined') return;
  let total = 0;
  drinks.forEach(d => { if (d.price_eur) total += (booking.drinkQtys[d.id] || 0) * d.price_eur; });
  const el = document.getElementById('drinks-total-val');
  if (el) el.textContent = '€' + total.toFixed(2);
}

// ── Step 5: Partners (mark interest - non-binding, no price impact) ──
// Fetched once per page load via the anon client; RLS exposes active rows
// only. A fetch failure degrades to an empty step and NEVER blocks booking.
let _partnersList = null;   // null = not loaded (yet); [] = loaded empty or failed

async function loadPartners() {
  try {
    const { data, error } = await reservationDb
      .from('partners')
      .select('id, category, name, description_bg, description_en, image_path')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) { console.warn('Partners fetch error:', error.message); _partnersList = []; return; }
    _partnersList = data || [];
  } catch (err) {
    console.warn('Partners fetch failed:', err);
    _partnersList = [];
  }
  if (currentStep === 4) renderPartners();
}

function partnerImgUrl(path) {
  return reservationDb.storage.from('partner-images').getPublicUrl(path).data.publicUrl;
}

function renderPartners() {
  const l = getLang();
  const wrap = document.getElementById('partners-wizard-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!_partnersList || !_partnersList.length) {
    const note = document.createElement('p');
    note.className = 'step-sub';
    note.style.textAlign = 'center';
    note.textContent = l === 'bg'
      ? 'В момента няма партньори за показване - продължете напред.'
      : 'No partners to show right now - please continue.';
    wrap.appendChild(note);
    return;
  }

  const CAT_LABELS = { catering: { bg: 'Кетъринг', en: 'Catering' }, artist: { bg: 'Артисти', en: 'Artists' } };
  ['catering', 'artist'].forEach(cat => {
    const inCat = _partnersList.filter(p => p.category === cat);
    if (!inCat.length) return;

    const h = document.createElement('h3');
    h.className = 'free-included__title';
    h.style.marginTop = '18px';
    h.textContent = CAT_LABELS[cat][l];
    wrap.appendChild(h);

    const grid = document.createElement('div');
    grid.className = 'addon-grid';
    inCat.forEach(p => {
      const selected = (booking.partners[p.id] || 0) > 0;
      const item = document.createElement('label');
      item.className = 'addon-item' + (selected ? ' selected' : '');
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = selected;

      const visual = document.createElement('div');
      if (p.image_path) {
        visual.className = 'addon-img';
        const i = document.createElement('img');
        i.src = partnerImgUrl(p.image_path); i.alt = ''; i.loading = 'lazy';
        visual.appendChild(i);
      } else {
        visual.className = 'addon-emoji';
        visual.textContent = cat === 'catering' ? '🍽️' : '🎤';
        visual.setAttribute('aria-hidden', 'true');
      }

      const info = document.createElement('div'); info.className = 'addon-info';
      const name = document.createElement('div'); name.className = 'addon-name'; name.textContent = p.name;
      info.appendChild(name);
      const desc = l === 'bg' ? p.description_bg : (p.description_en || p.description_bg);
      if (desc) {
        const d = document.createElement('div'); d.className = 'addon-hint'; d.textContent = desc;
        info.appendChild(d);
      }

      const check = document.createElement('div'); check.className = 'addon-check'; check.setAttribute('aria-hidden', 'true'); check.textContent = '✓';

      item.appendChild(input); item.appendChild(visual); item.appendChild(info); item.appendChild(check);
      grid.appendChild(item);

      item.addEventListener('change', () => {
        booking.partners[p.id] = input.checked ? 1 : 0;
        item.classList.toggle('selected', input.checked);
      });
    });
    wrap.appendChild(grid);
  });
}

// ── Step 6: Contact ──

// Country dial codes - ITU-T list (sovereign UN members + common territories).
// `code` is the alpha-2 ISO code, `dial` includes the leading +, `flag` is the
// regional indicator emoji pair. Bulgaria is the default selection.
const DIAL_CODES = [
  { code:'BG', name:'България',    name_en:'Bulgaria',        dial:'+359', flag:'🇧🇬' },
  { code:'AF', name:'Афганистан',  name_en:'Afghanistan',     dial:'+93',  flag:'🇦🇫' },
  { code:'AL', name:'Албания',     name_en:'Albania',         dial:'+355', flag:'🇦🇱' },
  { code:'DZ', name:'Алжир',       name_en:'Algeria',         dial:'+213', flag:'🇩🇿' },
  { code:'AD', name:'Андора',      name_en:'Andorra',         dial:'+376', flag:'🇦🇩' },
  { code:'AO', name:'Ангола',      name_en:'Angola',          dial:'+244', flag:'🇦🇴' },
  { code:'AR', name:'Аржентина',   name_en:'Argentina',       dial:'+54',  flag:'🇦🇷' },
  { code:'AM', name:'Армения',     name_en:'Armenia',         dial:'+374', flag:'🇦🇲' },
  { code:'AU', name:'Австралия',   name_en:'Australia',       dial:'+61',  flag:'🇦🇺' },
  { code:'AT', name:'Австрия',     name_en:'Austria',         dial:'+43',  flag:'🇦🇹' },
  { code:'AZ', name:'Азербайджан', name_en:'Azerbaijan',      dial:'+994', flag:'🇦🇿' },
  { code:'BH', name:'Бахрейн',     name_en:'Bahrain',         dial:'+973', flag:'🇧🇭' },
  { code:'BD', name:'Бангладеш',   name_en:'Bangladesh',      dial:'+880', flag:'🇧🇩' },
  { code:'BY', name:'Беларус',     name_en:'Belarus',         dial:'+375', flag:'🇧🇾' },
  { code:'BE', name:'Белгия',      name_en:'Belgium',         dial:'+32',  flag:'🇧🇪' },
  { code:'BZ', name:'Белиз',       name_en:'Belize',          dial:'+501', flag:'🇧🇿' },
  { code:'BJ', name:'Бенин',       name_en:'Benin',           dial:'+229', flag:'🇧🇯' },
  { code:'BT', name:'Бутан',       name_en:'Bhutan',          dial:'+975', flag:'🇧🇹' },
  { code:'BO', name:'Боливия',     name_en:'Bolivia',         dial:'+591', flag:'🇧🇴' },
  { code:'BA', name:'Босна и Херц.',name_en:'Bosnia & Herz.', dial:'+387', flag:'🇧🇦' },
  { code:'BW', name:'Ботсвана',    name_en:'Botswana',        dial:'+267', flag:'🇧🇼' },
  { code:'BR', name:'Бразилия',    name_en:'Brazil',          dial:'+55',  flag:'🇧🇷' },
  { code:'BN', name:'Бруней',      name_en:'Brunei',          dial:'+673', flag:'🇧🇳' },
  { code:'BF', name:'Буркина Фасо',name_en:'Burkina Faso',    dial:'+226', flag:'🇧🇫' },
  { code:'BI', name:'Бурунди',     name_en:'Burundi',         dial:'+257', flag:'🇧🇮' },
  { code:'KH', name:'Камбоджа',    name_en:'Cambodia',        dial:'+855', flag:'🇰🇭' },
  { code:'CM', name:'Камерун',     name_en:'Cameroon',        dial:'+237', flag:'🇨🇲' },
  { code:'CA', name:'Канада',      name_en:'Canada',          dial:'+1',   flag:'🇨🇦' },
  { code:'CV', name:'Кабо Верде',  name_en:'Cape Verde',      dial:'+238', flag:'🇨🇻' },
  { code:'CF', name:'ЦАР',         name_en:'Central Afr. Rep.',dial:'+236',flag:'🇨🇫' },
  { code:'TD', name:'Чад',         name_en:'Chad',            dial:'+235', flag:'🇹🇩' },
  { code:'CL', name:'Чили',        name_en:'Chile',           dial:'+56',  flag:'🇨🇱' },
  { code:'CN', name:'Китай',       name_en:'China',           dial:'+86',  flag:'🇨🇳' },
  { code:'CO', name:'Колумбия',    name_en:'Colombia',        dial:'+57',  flag:'🇨🇴' },
  { code:'KM', name:'Коморски о-ви',name_en:'Comoros',        dial:'+269', flag:'🇰🇲' },
  { code:'CG', name:'Конго',       name_en:'Congo',           dial:'+242', flag:'🇨🇬' },
  { code:'CD', name:'ДР Конго',    name_en:'DR Congo',        dial:'+243', flag:'🇨🇩' },
  { code:'CR', name:'Коста Рика',  name_en:'Costa Rica',      dial:'+506', flag:'🇨🇷' },
  { code:'CI', name:'Кот д\'Ивоар',name_en:"Côte d'Ivoire",   dial:'+225', flag:'🇨🇮' },
  { code:'HR', name:'Хърватия',    name_en:'Croatia',         dial:'+385', flag:'🇭🇷' },
  { code:'CU', name:'Куба',        name_en:'Cuba',            dial:'+53',  flag:'🇨🇺' },
  { code:'CY', name:'Кипър',       name_en:'Cyprus',          dial:'+357', flag:'🇨🇾' },
  { code:'CZ', name:'Чехия',       name_en:'Czechia',         dial:'+420', flag:'🇨🇿' },
  { code:'DK', name:'Дания',       name_en:'Denmark',         dial:'+45',  flag:'🇩🇰' },
  { code:'DJ', name:'Джибути',     name_en:'Djibouti',        dial:'+253', flag:'🇩🇯' },
  { code:'DO', name:'Доминикана',  name_en:'Dominican Rep.',  dial:'+1',   flag:'🇩🇴' },
  { code:'EC', name:'Еквадор',     name_en:'Ecuador',         dial:'+593', flag:'🇪🇨' },
  { code:'EG', name:'Египет',      name_en:'Egypt',           dial:'+20',  flag:'🇪🇬' },
  { code:'SV', name:'Ел Салвадор', name_en:'El Salvador',     dial:'+503', flag:'🇸🇻' },
  { code:'GQ', name:'Екват. Гвинея',name_en:'Equ. Guinea',    dial:'+240', flag:'🇬🇶' },
  { code:'ER', name:'Еритрея',     name_en:'Eritrea',         dial:'+291', flag:'🇪🇷' },
  { code:'EE', name:'Естония',     name_en:'Estonia',         dial:'+372', flag:'🇪🇪' },
  { code:'SZ', name:'Есватини',    name_en:'Eswatini',        dial:'+268', flag:'🇸🇿' },
  { code:'ET', name:'Етиопия',     name_en:'Ethiopia',        dial:'+251', flag:'🇪🇹' },
  { code:'FJ', name:'Фиджи',       name_en:'Fiji',            dial:'+679', flag:'🇫🇯' },
  { code:'FI', name:'Финландия',   name_en:'Finland',         dial:'+358', flag:'🇫🇮' },
  { code:'FR', name:'Франция',     name_en:'France',          dial:'+33',  flag:'🇫🇷' },
  { code:'GA', name:'Габон',       name_en:'Gabon',           dial:'+241', flag:'🇬🇦' },
  { code:'GM', name:'Гамбия',      name_en:'Gambia',          dial:'+220', flag:'🇬🇲' },
  { code:'GE', name:'Грузия',      name_en:'Georgia',         dial:'+995', flag:'🇬🇪' },
  { code:'DE', name:'Германия',    name_en:'Germany',         dial:'+49',  flag:'🇩🇪' },
  { code:'GH', name:'Гана',        name_en:'Ghana',           dial:'+233', flag:'🇬🇭' },
  { code:'GR', name:'Гърция',      name_en:'Greece',          dial:'+30',  flag:'🇬🇷' },
  { code:'GT', name:'Гватемала',   name_en:'Guatemala',       dial:'+502', flag:'🇬🇹' },
  { code:'GN', name:'Гвинея',      name_en:'Guinea',          dial:'+224', flag:'🇬🇳' },
  { code:'GW', name:'Гвинея-Бисау',name_en:'Guinea-Bissau',   dial:'+245', flag:'🇬🇼' },
  { code:'GY', name:'Гвиана',      name_en:'Guyana',          dial:'+592', flag:'🇬🇾' },
  { code:'HT', name:'Хаити',       name_en:'Haiti',           dial:'+509', flag:'🇭🇹' },
  { code:'HN', name:'Хондурас',    name_en:'Honduras',        dial:'+504', flag:'🇭🇳' },
  { code:'HK', name:'Хонг Конг',   name_en:'Hong Kong',       dial:'+852', flag:'🇭🇰' },
  { code:'HU', name:'Унгария',     name_en:'Hungary',         dial:'+36',  flag:'🇭🇺' },
  { code:'IS', name:'Исландия',    name_en:'Iceland',         dial:'+354', flag:'🇮🇸' },
  { code:'IN', name:'Индия',       name_en:'India',           dial:'+91',  flag:'🇮🇳' },
  { code:'ID', name:'Индонезия',   name_en:'Indonesia',       dial:'+62',  flag:'🇮🇩' },
  { code:'IR', name:'Иран',        name_en:'Iran',            dial:'+98',  flag:'🇮🇷' },
  { code:'IQ', name:'Ирак',        name_en:'Iraq',            dial:'+964', flag:'🇮🇶' },
  { code:'IE', name:'Ирландия',    name_en:'Ireland',         dial:'+353', flag:'🇮🇪' },
  { code:'IL', name:'Израел',      name_en:'Israel',          dial:'+972', flag:'🇮🇱' },
  { code:'IT', name:'Италия',      name_en:'Italy',           dial:'+39',  flag:'🇮🇹' },
  { code:'JM', name:'Ямайка',      name_en:'Jamaica',         dial:'+1',   flag:'🇯🇲' },
  { code:'JP', name:'Япония',      name_en:'Japan',           dial:'+81',  flag:'🇯🇵' },
  { code:'JO', name:'Йордания',    name_en:'Jordan',          dial:'+962', flag:'🇯🇴' },
  { code:'KZ', name:'Казахстан',   name_en:'Kazakhstan',      dial:'+7',   flag:'🇰🇿' },
  { code:'KE', name:'Кения',       name_en:'Kenya',           dial:'+254', flag:'🇰🇪' },
  { code:'KW', name:'Кувейт',      name_en:'Kuwait',          dial:'+965', flag:'🇰🇼' },
  { code:'KG', name:'Киргизстан',  name_en:'Kyrgyzstan',      dial:'+996', flag:'🇰🇬' },
  { code:'LA', name:'Лаос',        name_en:'Laos',            dial:'+856', flag:'🇱🇦' },
  { code:'LV', name:'Латвия',      name_en:'Latvia',          dial:'+371', flag:'🇱🇻' },
  { code:'LB', name:'Ливан',       name_en:'Lebanon',         dial:'+961', flag:'🇱🇧' },
  { code:'LS', name:'Лесото',      name_en:'Lesotho',         dial:'+266', flag:'🇱🇸' },
  { code:'LR', name:'Либерия',     name_en:'Liberia',         dial:'+231', flag:'🇱🇷' },
  { code:'LY', name:'Либия',       name_en:'Libya',           dial:'+218', flag:'🇱🇾' },
  { code:'LI', name:'Лихтенщайн',  name_en:'Liechtenstein',   dial:'+423', flag:'🇱🇮' },
  { code:'LT', name:'Литва',       name_en:'Lithuania',       dial:'+370', flag:'🇱🇹' },
  { code:'LU', name:'Люксембург',  name_en:'Luxembourg',      dial:'+352', flag:'🇱🇺' },
  { code:'MO', name:'Макао',       name_en:'Macau',           dial:'+853', flag:'🇲🇴' },
  { code:'MK', name:'Сев. Македония',name_en:'N. Macedonia',  dial:'+389', flag:'🇲🇰' },
  { code:'MG', name:'Мадагаскар',  name_en:'Madagascar',      dial:'+261', flag:'🇲🇬' },
  { code:'MW', name:'Малави',      name_en:'Malawi',          dial:'+265', flag:'🇲🇼' },
  { code:'MY', name:'Малайзия',    name_en:'Malaysia',        dial:'+60',  flag:'🇲🇾' },
  { code:'MV', name:'Малдиви',     name_en:'Maldives',        dial:'+960', flag:'🇲🇻' },
  { code:'ML', name:'Мали',        name_en:'Mali',            dial:'+223', flag:'🇲🇱' },
  { code:'MT', name:'Малта',       name_en:'Malta',           dial:'+356', flag:'🇲🇹' },
  { code:'MR', name:'Мавритания',  name_en:'Mauritania',      dial:'+222', flag:'🇲🇷' },
  { code:'MU', name:'Мавриций',    name_en:'Mauritius',       dial:'+230', flag:'🇲🇺' },
  { code:'MX', name:'Мексико',     name_en:'Mexico',          dial:'+52',  flag:'🇲🇽' },
  { code:'MD', name:'Молдова',     name_en:'Moldova',         dial:'+373', flag:'🇲🇩' },
  { code:'MC', name:'Монако',      name_en:'Monaco',          dial:'+377', flag:'🇲🇨' },
  { code:'MN', name:'Монголия',    name_en:'Mongolia',        dial:'+976', flag:'🇲🇳' },
  { code:'ME', name:'Черна гора',  name_en:'Montenegro',      dial:'+382', flag:'🇲🇪' },
  { code:'MA', name:'Мароко',      name_en:'Morocco',         dial:'+212', flag:'🇲🇦' },
  { code:'MZ', name:'Мозамбик',    name_en:'Mozambique',      dial:'+258', flag:'🇲🇿' },
  { code:'MM', name:'Мианмар',     name_en:'Myanmar',         dial:'+95',  flag:'🇲🇲' },
  { code:'NA', name:'Намибия',     name_en:'Namibia',         dial:'+264', flag:'🇳🇦' },
  { code:'NP', name:'Непал',       name_en:'Nepal',           dial:'+977', flag:'🇳🇵' },
  { code:'NL', name:'Нидерландия', name_en:'Netherlands',     dial:'+31',  flag:'🇳🇱' },
  { code:'NZ', name:'Нова Зеландия',name_en:'New Zealand',    dial:'+64',  flag:'🇳🇿' },
  { code:'NI', name:'Никарагуа',   name_en:'Nicaragua',       dial:'+505', flag:'🇳🇮' },
  { code:'NE', name:'Нигер',       name_en:'Niger',           dial:'+227', flag:'🇳🇪' },
  { code:'NG', name:'Нигерия',     name_en:'Nigeria',         dial:'+234', flag:'🇳🇬' },
  { code:'KP', name:'Сев. Корея',  name_en:'North Korea',     dial:'+850', flag:'🇰🇵' },
  { code:'NO', name:'Норвегия',    name_en:'Norway',          dial:'+47',  flag:'🇳🇴' },
  { code:'OM', name:'Оман',        name_en:'Oman',            dial:'+968', flag:'🇴🇲' },
  { code:'PK', name:'Пакистан',    name_en:'Pakistan',        dial:'+92',  flag:'🇵🇰' },
  { code:'PS', name:'Палестина',   name_en:'Palestine',       dial:'+970', flag:'🇵🇸' },
  { code:'PA', name:'Панама',      name_en:'Panama',          dial:'+507', flag:'🇵🇦' },
  { code:'PG', name:'Папуа Н. Гвинея',name_en:'Papua N. Guinea',dial:'+675',flag:'🇵🇬' },
  { code:'PY', name:'Парагвай',    name_en:'Paraguay',        dial:'+595', flag:'🇵🇾' },
  { code:'PE', name:'Перу',        name_en:'Peru',            dial:'+51',  flag:'🇵🇪' },
  { code:'PH', name:'Филипини',    name_en:'Philippines',     dial:'+63',  flag:'🇵🇭' },
  { code:'PL', name:'Полша',       name_en:'Poland',          dial:'+48',  flag:'🇵🇱' },
  { code:'PT', name:'Португалия',  name_en:'Portugal',        dial:'+351', flag:'🇵🇹' },
  { code:'QA', name:'Катар',       name_en:'Qatar',           dial:'+974', flag:'🇶🇦' },
  { code:'RO', name:'Румъния',     name_en:'Romania',         dial:'+40',  flag:'🇷🇴' },
  { code:'RU', name:'Русия',       name_en:'Russia',          dial:'+7',   flag:'🇷🇺' },
  { code:'RW', name:'Руанда',      name_en:'Rwanda',          dial:'+250', flag:'🇷🇼' },
  { code:'SA', name:'Сауд. Арабия',name_en:'Saudi Arabia',    dial:'+966', flag:'🇸🇦' },
  { code:'SN', name:'Сенегал',     name_en:'Senegal',         dial:'+221', flag:'🇸🇳' },
  { code:'RS', name:'Сърбия',      name_en:'Serbia',          dial:'+381', flag:'🇷🇸' },
  { code:'SC', name:'Сейшели',     name_en:'Seychelles',      dial:'+248', flag:'🇸🇨' },
  { code:'SL', name:'Сиера Леоне', name_en:'Sierra Leone',    dial:'+232', flag:'🇸🇱' },
  { code:'SG', name:'Сингапур',    name_en:'Singapore',       dial:'+65',  flag:'🇸🇬' },
  { code:'SK', name:'Словакия',    name_en:'Slovakia',        dial:'+421', flag:'🇸🇰' },
  { code:'SI', name:'Словения',    name_en:'Slovenia',        dial:'+386', flag:'🇸🇮' },
  { code:'SO', name:'Сомалия',     name_en:'Somalia',         dial:'+252', flag:'🇸🇴' },
  { code:'ZA', name:'ЮАР',         name_en:'South Africa',    dial:'+27',  flag:'🇿🇦' },
  { code:'KR', name:'Юж. Корея',   name_en:'South Korea',     dial:'+82',  flag:'🇰🇷' },
  { code:'SS', name:'Юж. Судан',   name_en:'South Sudan',     dial:'+211', flag:'🇸🇸' },
  { code:'ES', name:'Испания',     name_en:'Spain',           dial:'+34',  flag:'🇪🇸' },
  { code:'LK', name:'Шри Ланка',   name_en:'Sri Lanka',       dial:'+94',  flag:'🇱🇰' },
  { code:'SD', name:'Судан',       name_en:'Sudan',           dial:'+249', flag:'🇸🇩' },
  { code:'SR', name:'Суринам',     name_en:'Suriname',        dial:'+597', flag:'🇸🇷' },
  { code:'SE', name:'Швеция',      name_en:'Sweden',          dial:'+46',  flag:'🇸🇪' },
  { code:'CH', name:'Швейцария',   name_en:'Switzerland',     dial:'+41',  flag:'🇨🇭' },
  { code:'SY', name:'Сирия',       name_en:'Syria',           dial:'+963', flag:'🇸🇾' },
  { code:'TW', name:'Тайван',      name_en:'Taiwan',          dial:'+886', flag:'🇹🇼' },
  { code:'TJ', name:'Таджикистан', name_en:'Tajikistan',      dial:'+992', flag:'🇹🇯' },
  { code:'TZ', name:'Танзания',    name_en:'Tanzania',        dial:'+255', flag:'🇹🇿' },
  { code:'TH', name:'Тайланд',     name_en:'Thailand',        dial:'+66',  flag:'🇹🇭' },
  { code:'TL', name:'Източен Тимор',name_en:'Timor-Leste',    dial:'+670', flag:'🇹🇱' },
  { code:'TG', name:'Того',        name_en:'Togo',            dial:'+228', flag:'🇹🇬' },
  { code:'TT', name:'Тринидад и Тобаго',name_en:'Trinidad & Tobago',dial:'+1',flag:'🇹🇹' },
  { code:'TN', name:'Тунис',       name_en:'Tunisia',         dial:'+216', flag:'🇹🇳' },
  { code:'TR', name:'Турция',      name_en:'Türkiye',         dial:'+90',  flag:'🇹🇷' },
  { code:'TM', name:'Туркменистан',name_en:'Turkmenistan',    dial:'+993', flag:'🇹🇲' },
  { code:'UG', name:'Уганда',      name_en:'Uganda',          dial:'+256', flag:'🇺🇬' },
  { code:'UA', name:'Украйна',     name_en:'Ukraine',         dial:'+380', flag:'🇺🇦' },
  { code:'AE', name:'ОАЕ',         name_en:'UAE',             dial:'+971', flag:'🇦🇪' },
  { code:'GB', name:'Великобритания',name_en:'United Kingdom',dial:'+44',  flag:'🇬🇧' },
  { code:'US', name:'САЩ',         name_en:'United States',   dial:'+1',   flag:'🇺🇸' },
  { code:'UY', name:'Уругвай',     name_en:'Uruguay',         dial:'+598', flag:'🇺🇾' },
  { code:'UZ', name:'Узбекистан',  name_en:'Uzbekistan',      dial:'+998', flag:'🇺🇿' },
  { code:'VE', name:'Венецуела',   name_en:'Venezuela',       dial:'+58',  flag:'🇻🇪' },
  { code:'VN', name:'Виетнам',     name_en:'Vietnam',         dial:'+84',  flag:'🇻🇳' },
  { code:'YE', name:'Йемен',       name_en:'Yemen',           dial:'+967', flag:'🇾🇪' },
  { code:'ZM', name:'Замбия',      name_en:'Zambia',          dial:'+260', flag:'🇿🇲' },
  { code:'ZW', name:'Зимбабве',    name_en:'Zimbabwe',        dial:'+263', flag:'🇿🇼' },
];

function renderDialCodes() {
  const sel = document.getElementById('res-phone-dial');
  if (!sel || sel.dataset.rendered === '1') return;
  const l = getLang();
  // Preserve the Bulgaria entry on top so the default is one click away.
  const head = DIAL_CODES[0];
  const rest = DIAL_CODES.slice(1).sort((a, b) =>
    (l === 'bg' ? a.name : a.name_en).localeCompare(l === 'bg' ? b.name : b.name_en, l));
  const all = [head, ...rest];
  sel.innerHTML = '';
  all.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.dial;
    opt.dataset.code = c.code;
    opt.textContent = `${c.flag} ${c.dial}`;
    opt.setAttribute('aria-label', `${l === 'bg' ? c.name : c.name_en} ${c.dial}`);
    sel.appendChild(opt);
  });
  sel.value = '+359';
  sel.dataset.rendered = '1';
}

// Stricter validators than the previous "any 7+ digits" check.
// `+999 999999999999` is a generous upper bound; E.164 caps at 15 digits total.
function isValidEmail(raw) {
  const s = (raw || '').trim();
  if (s.length < 5 || s.length > 254) return false;
  // RFC-5322 lite: local-part chars, @, domain with at least one dot, TLD ≥ 2 letters.
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s);
}
function isValidLocalPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  // National numbers around the world fit comfortably in 6-14 digits once the
  // country code is excluded. Most mobile numbers are 7-12.
  return digits.length >= 6 && digits.length <= 14;
}

function setupStep5() {
  renderDialCodes();
  const btn = document.getElementById('btn-step5-next');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const name = document.getElementById('res-name'), email = document.getElementById('res-email'),
          phone = document.getElementById('res-phone'), guests = document.getElementById('res-guests'),
          dial  = document.getElementById('res-phone-dial');
    let valid = true;
    function v(el, fg, test) { const g = document.getElementById(fg); if (!test(el?.value||'')) { g?.classList.add('has-error'); valid=false; } else g?.classList.remove('has-error'); }
    // Two-names check: at least two whitespace-separated tokens of ≥2 letters.
    v(name,'fg-name', val => /^\p{L}{2,}(\s+\p{L}{2,})+$/u.test(val.trim()));
    v(email,'fg-email', isValidEmail);
    v(phone,'fg-phone', isValidLocalPhone);
    v(guests,'fg-guests', val => { const n=parseInt(val); return n>=1 && n<=200; });
    if (!valid) return;
    booking.name = name.value.trim(); booking.email = email.value.trim();
    booking.phone = `${dial?.value || '+359'} ${phone.value.trim().replace(/\D/g,'')}`;
    booking.guests = guests.value;
    booking.notes = document.getElementById('res-message')?.value.trim() || '';
    goToStep(6);
  });
}

// ── Step 7: Summary ──
// ── Weekday promo ──
// 20% off the VENUE BASE for events on Monday-Thursday up to and including
// 2026-08-31. Display-only mirror: the authoritative copy lives in
// supabase/functions/submit-enquiry (keep both in sync - CLAUDE.md sync
// map). Does not stack with promo codes: the higher percent wins.
const WEEKDAY_PROMO = { percent: 20, lastDate: '2026-08-31', days: [1, 2, 3, 4] };
function weekdayPromoPercent(dateStr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr || '');
  if (!m) return 0;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  // Europe/Sofia, matching the server - a browser west of Sofia must not
  // show a discount the server will refuse (or vice versa).
  const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' });
  if (iso < todayISO || iso > WEEKDAY_PROMO.lastDate) return 0;
  const day = new Date(`${iso}T12:00:00`).getDay(); // 1=Mon .. 4=Thu
  return WEEKDAY_PROMO.days.includes(day) ? WEEKDAY_PROMO.percent : 0;
}
// The discount the server will actually apply: weekday promo beats the
// promo code (codes are never burned when the weekday promo wins).
function effectiveDiscount() {
  const code = booking.discountPercent || 0;
  const weekday = weekdayPromoPercent(booking.date);
  return weekday >= code && weekday > 0
    ? { percent: weekday, weekday: true }
    : { percent: code, weekday: false };
}

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
    ...((_partnersList || []).some(p => booking.partners[p.id]) ? [{
      label: l==='bg'?'Партньори (интерес)':'Partners (interest)',
      value: (_partnersList || []).filter(p => booking.partners[p.id]).map(p => p.name).join(', '),
    }] : []),
  ].forEach(row => {
    const div = document.createElement('div'); div.className = 'summary-row';
    const lbl = document.createElement('span'); lbl.className = 'sr-label'; lbl.textContent = row.label;
    const val = document.createElement('span'); val.className = 'sr-value'; val.textContent = row.value || '-';
    div.appendChild(lbl); div.appendChild(val); body.appendChild(div);
  });
  container.appendChild(img); container.appendChild(body);

  // Price breakdown - all in EUR
  if (priceSummary) {
    priceSummary.innerHTML = '';
    let addonsTotal = 0;
    for (const [id, q] of Object.entries(booking.addons)) {
      const svc = addonServices.find(s => s.id === id);
      if (svc) addonsTotal += addonLinePrice(svc, q);
    }
    // Auto-include mandatory cleaning on every event, on top of the selected
    // addons. Adds to total + shown as a separate summary line.
    const autoClean = autoCleaningAddon();
    if (autoClean) addonsTotal += autoClean.price;
    let drinksTotal = 0; drinks.forEach(d => { if (d.price_eur) drinksTotal += (booking.drinkQtys[d.id]||0)*d.price_eur; });
    const venuePrice = window.seasonalVenuePrice(booking.date) ?? booking.event.price_eur;
    const VENUE_MIN_GUESTS = 40;
    const EXTRA_GUEST_FEE_EUR = 15;
    const guests = Number(booking.guests) || 0;
    const extraGuests = Math.max(0, guests - VENUE_MIN_GUESTS);
    const extraGuestsCost = extraGuests * EXTRA_GUEST_FEE_EUR;
    const disc = effectiveDiscount();
    const discountPercent = disc.percent;
    const discountAmount = discountPercent > 0 ? venuePrice * (discountPercent / 100) : 0;
    const discountLabel = disc.weekday
      ? (l==='bg' ? 'Отстъпка делнични дни' : 'Weekday discount')
      : (l==='bg' ? 'Отстъпка' : 'Discount');
    // If a validated code is outranked by the weekday promo, tell the
    // customer their code is kept (the server will not claim it).
    const promoStatus = document.getElementById('promo-status');
    if (promoStatus && disc.weekday && (booking.discountPercent || 0) > 0) {
      promoStatus.textContent = l==='bg'
        ? 'Приложена е по-голямата отстъпка (−20% делнични дни). Кодът ви остава валиден за друга резервация.'
        : 'The larger discount applies (−20% weekdays). Your code stays valid for another booking.';
      promoStatus.style.color = '#2F8F4F';
    }
    const grandTotal = venuePrice + extraGuestsCost + addonsTotal + drinksTotal - discountAmount;
    const rows = [
      { label: (l==='bg'?'Наем на зала':'Venue rental') + ` (${l==='bg'?'до':'up to'} ${VENUE_MIN_GUESTS} ${l==='bg'?'гости':'guests'})`, value: '€' + venuePrice.toFixed(2) },
      ...(extraGuests > 0 ? [{ label: (l==='bg'?`+${extraGuests} допълнителни гости`:`+${extraGuests} extra guests`) + ` (× €${EXTRA_GUEST_FEE_EUR})`, value: '€' + extraGuestsCost.toFixed(2) }] : []),
      ...(addonsTotal > 0 ? [{ label: l==='bg'?'Допълнителни услуги':'Add-on services', value: '€' + addonsTotal.toFixed(2) }] : []),
      ...(autoClean ? [{ label: (l==='bg' ? `${autoClean.name_bg} (задължително)` : `${autoClean.name_en} (mandatory)`), value: '€' + autoClean.price.toFixed(2), sub: true }] : []),
      ...(drinksTotal > 0 ? [{ label: l==='bg'?'Напитки':'Drinks', value: '€' + drinksTotal.toFixed(2) }] : []),
      ...(discountAmount > 0 ? [{ label: `${discountLabel} (${discountPercent}%)`, value: '−€' + discountAmount.toFixed(2), discount: true }] : []),
      { label: l==='bg'?'Обща сума':'Total', value: '€' + grandTotal.toFixed(2), total: true },
    ];
    rows.forEach(row => {
      const div = document.createElement('div'); div.className = 'price-summary-row';
      const lbl = document.createElement('span'); lbl.className = 'ps-label'; lbl.textContent = (row.sub ? '↳ ' : '') + row.label;
      const val = document.createElement('span'); val.className = 'ps-value'; val.textContent = row.value;
      if (row.total) { div.style.fontWeight = '700'; div.style.fontSize = '1rem'; }
      if (row.discount) { div.style.color = '#2F8F4F'; }
      // Sub-rows detail a line already counted above (auto-cleaning inside
      // the add-ons total) - mute them so they don't read as a second charge.
      if (row.sub) { div.style.fontSize = '0.85em'; div.style.color = '#7A7568'; div.style.paddingLeft = '14px'; }
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
          confusable_chars: 'Проверете цифрите 0/1 и буквите O/I - кодовете ни не съдържат тези знаци.',
        };
        const en = {
          not_found: 'Code not found.',
          already_used: 'Code already used.',
          expired: 'Code expired.',
          invalid_format: 'Invalid format.',
          confusable_chars: 'Check 0/1 and O/I - our codes never contain those characters.',
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
    // Auto-attach mandatory cleaning (every event), matching what the
    // customer saw on the summary screen.
    const autoCleanForPayload = autoCleaningAddon();
    if (autoCleanForPayload) {
      addonsPayload.push({
        id: autoCleanForPayload.id,
        name: autoCleanForPayload.name_en,
        price: autoCleanForPayload.price,
      });
    }

    // Serialize drinks: only items with qty > 0
    const drinksPayload = Object.entries(booking.drinkQtys)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const drink = drinks.find(d => d.id === id);
        return { id, name: drink ? drink.name_en : id, qty, price_eur: drink?.price_eur ?? null };
      });

    // Post to submit-enquiry edge function. Anon role no longer has any
    // direct table access - the function handles validation, the
    // insert, and the optional discount-code claim atomically.
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
      partner_ids: Object.keys(booking.partners).filter(id => booking.partners[id] > 0),
      payment_method: booking.payment,
      notes: booking.notes || null,
      marketing_consent: !!document.getElementById('res-marketing-consent')?.checked,
      lang: getLang(),
      discount_code: booking.discountCode || null,
      turnstile_token: (() => {
        try { return (typeof turnstile !== 'undefined' && turnstile.getResponse()) || null; }
        catch { return null; }
      })(),
    };

    let inserted = null;
    let error = null;
    try {
      const res = await fetch(`${SUPABASE_FN_BASE}/submit-enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        error = body.error || `http_${res.status}`;
      } else {
        inserted = { id: body.id, enquiry_number: body.enquiry_number };
      }
    } catch (e) {
      error = e?.message || 'network_error';
    }

    if (error) {
      console.error('Enquiry submission error:', error);
      btn.disabled = false;
      btn.textContent = origText;
      const lang = getLang();
      // Surface known errors so the user knows what to fix instead of
      // being told to phone us. "rate_limited" is the most common during
      // testing - separate message.
      let msg;
      if (String(error).includes('rate_limited') || String(error).includes('429')) {
        msg = lang === 'bg'
          ? 'Прекалено много опити за кратко време. Моля изчакайте 10 минути и опитайте отново.'
          : 'Too many attempts in a short time. Please wait 10 minutes and try again.';
      } else if (String(error).includes('turnstile_failed')) {
        msg = lang === 'bg'
          ? 'Моля изчакайте проверката за сигурност под резюмето да завърши и опитайте отново.'
          : 'Please wait for the security check below the summary to finish, then try again.';
        try { if (typeof turnstile !== 'undefined') turnstile.reset(); } catch { /* widget not rendered */ }
      } else if (String(error).includes('invalid_field')) {
        msg = lang === 'bg'
          ? 'Моля проверете формата - едно от полетата има невалидна стойност.'
          : 'Please check the form - one of the fields has an invalid value.';
      } else {
        msg = (lang === 'bg'
          ? 'Нещо се обърка. Моля обадете ни се директно на 0888 100 042.'
          : 'Something went wrong. Please call us directly on 0888 100 042.')
          + `\n(${error})`;
      }
      alert(msg);
      return;
    }

    // Google Ads conversion - fires only after the server confirmed the
    // insert. transaction_id = enquiry number so a refresh/retry can never
    // double-count; value = the quoted booking total in EUR (same math as
    // renderSummary: venue + extra guests + addons incl. auto-cleaning +
    // drinks − venue-only discount).
    try {
      if (typeof gtag === 'function') {
        let addonsTotal = 0;
        for (const [id, q] of Object.entries(booking.addons)) {
          const svc = addonServices.find(s => s.id === id);
          if (svc) addonsTotal += addonLinePrice(svc, q);
        }
        const autoClean = autoCleaningAddon();
        if (autoClean) addonsTotal += autoClean.price;
        let drinksTotal = 0;
        drinks.forEach(d => { if (d.price_eur) drinksTotal += (booking.drinkQtys[d.id] || 0) * d.price_eur; });
        const venuePrice = window.seasonalVenuePrice(booking.date) ?? (booking.event?.price_eur || 0);
        const extraGuestsCost = Math.max(0, (Number(booking.guests) || 0) - 40) * 15;
        const discPct = effectiveDiscount().percent;
        const discount = discPct > 0 ? venuePrice * discPct / 100 : 0;
        const total = venuePrice + extraGuestsCost + addonsTotal + drinksTotal - discount;
        gtag('event', 'conversion', {
          send_to: 'AW-17875820737/wvhpCO2LmegbEMHB7ctC',
          value: Math.round(total * 100) / 100,
          currency: 'EUR',
          transaction_id: String(inserted.enquiry_number ?? inserted.id ?? ''),
        });
      }
    } catch (e) { console.warn('gtag conversion failed:', e); }

    // Meta Pixel lead conversion (pixel loads always-on via analytics-init.js).
    try {
      if (typeof fbq === 'function') {
        fbq('track', 'Lead',
          { content_name: booking.event?.id || '', content_category: 'enquiry' },
          { eventID: 'lead-' + String(inserted.enquiry_number ?? inserted.id ?? '') });
      }
    } catch (e) { console.warn('fbq lead failed:', e); }

    // Success - show confirmation
    document.getElementById('step-6')?.classList.remove('active');
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
  if (currentStep === 4) renderPartners();
  if (currentStep === 6) renderSummary();
  updatePreview();
  updateAddonsTotal();
  updateDrinksTotal();
});

// The wizard cannot run without the catalog - prices and steppers would be
// wrong. Hide the steps and show a reload prompt instead of a broken form.
function showCatalogError() {
  document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
  const progress = document.querySelector('.wizard-progress');
  if (progress) progress.style.display = 'none';
  const box = document.getElementById('catalog-error');
  if (!box) return;
  if (getLang() === 'en') {
    document.getElementById('catalog-error-msg').textContent = 'The service catalog could not be loaded. Please try again.';
    document.getElementById('catalog-error-retry').textContent = 'Try again';
  }
  box.hidden = false;
  document.getElementById('catalog-error-retry').addEventListener('click', () => window.location.reload());
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.loadCatalog();   // populates drinks/drinkCategories/addonServices globals
  } catch (err) {
    console.error('catalog load failed:', err);
    showCatalogError();
    return;
  }
  await loadOccupiedDates();   // fetch occupied dates before flatpickr initialises
  loadPartners();              // fire-and-forget - partners must never delay the wizard
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


// CSP-safe replacement for the former inline onclick handlers (data-goto / data-action).
document.addEventListener('click', function (e) {
  var g = e.target.closest && e.target.closest('[data-goto]');
  if (g) { goToStep(Number(g.getAttribute('data-goto'))); return; }
  var a = e.target.closest && e.target.closest('[data-action="drinks-prompt"]');
  if (a) { showDrinksPrompt(); return; }
});
