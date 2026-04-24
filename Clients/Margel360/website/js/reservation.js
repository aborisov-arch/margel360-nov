// ── Pricing constants ──
const GUEST_BASE_COUNT = 40;      // Base guest count included in event price
const EXTRA_GUEST_FEE = 15.34;    // EUR per extra guest above the base

// ── Drinks data (drinks & drinkCategories) loaded from js/drinks-data.js ──
// ── Event types, includedLabels, addonServices loaded from js/reservation-catalog.js ──

// ── State ──
let currentStep = 0;
const TOTAL_STEPS = 6;
let booking = { event:null, date:'', time:'day', addons:{}, drinkQtys:{}, name:'', email:'', phone:'', guests:'', notes:'', payment:'cash' };
let activeDrinkCat = 0;

function getLang() { return localStorage.getItem('margel_lang') || 'bg'; }

// ── Image lightbox (desktop-only click-to-enlarge for addon service thumbnails) ──
function openImageLightbox(src, alt) {
  const overlay = document.createElement('div');
  overlay.className = 'image-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', alt || 'Enlarged image');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'image-lightbox-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', getLang() === 'bg' ? 'Затвори' : 'Close');
  closeBtn.textContent = '×';

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';

  overlay.appendChild(closeBtn);
  overlay.appendChild(img);
  document.body.appendChild(overlay);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  function close() {
    overlay.remove();
    document.body.style.overflow = prevOverflow;
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  overlay.addEventListener('click', e => { if (e.target === overlay || e.target === closeBtn) close(); });
  document.addEventListener('keydown', onKey);
}
function fmt(eur) {
  if (eur == null) return getLang() === 'bg' ? 'По запитване' : 'On request';
  return '€' + Math.round(Number(eur));
}
function fmtEvent(ev) {
  return '€' + Math.round(Number(ev.price_eur));
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
  if (n === 1) { renderStep2VariantPicker(); renderStep2TimePicker(); }
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
    if (n < currentStep) {
      if (n === 3) enterDrinksStep();
      else goToStep(n);
    }
  });
});

// ── Step 1: Event picker ──
function renderEventPicker() {
  const l = getLang();
  const grid = document.getElementById('event-picker');
  if (!grid) return;
  grid.innerHTML = '';

  eventTypes.forEach(ev => {
    const isSelected = booking.event?.id === ev.id ||
      (ev.variants && ev.variants.some(v => v.id === booking.event?.id));

    const card = document.createElement('div');
    card.className = 'event-pick-card' + (isSelected ? ' selected' : '');
    card.setAttribute('role', 'listitem'); card.setAttribute('tabindex', '0');

    const img = document.createElement('img');
    img.src = ev.img; img.alt = l === 'bg' ? ev.title_bg : ev.title_en; img.loading = 'lazy';

    const body = document.createElement('div'); body.className = 'event-pick-body';
    const h3 = document.createElement('h3'); h3.textContent = l === 'bg' ? ev.title_bg : ev.title_en;
    const meta = document.createElement('div'); meta.className = 'event-pick-meta';

    if (!ev.variants) {
      const dur = document.createElement('span'); dur.className = 'event-pick-duration';
      dur.textContent = l === 'bg' ? ev.duration_bg : ev.duration_en;
      const price = document.createElement('span'); price.className = 'event-pick-price';
      price.textContent = fmtEvent(ev);
      meta.appendChild(dur); meta.appendChild(price);
    } else {
      const priceRange = document.createElement('span'); priceRange.className = 'event-pick-price';
      const lo = Math.min(...ev.variants.map(v => v.price_eur));
      const hi = Math.max(...ev.variants.map(v => v.price_eur));
      priceRange.textContent = '€' + lo.toFixed(0) + ' – €' + hi.toFixed(0);
      meta.appendChild(priceRange);
    }

    body.appendChild(h3); body.appendChild(meta);
    card.appendChild(img); card.appendChild(body);
    grid.appendChild(card);

    function pick() {
      grid.querySelectorAll('.event-pick-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      // Store the event (parent if has variants, resolved if not)
      booking.event = ev;
      setTimeout(() => goToStep(1), 280);
    }

    card.addEventListener('click', pick);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
}

// ── Step 2 time picker (shown only for evening event) ──
function renderStep2TimePicker() {
  const fg = document.getElementById('fg-time');
  const sel = document.getElementById('res-time');
  if (!fg || !sel) return;
  const isEvening = booking.event?.id === 'evening';
  fg.style.display = isEvening ? '' : 'none';
  if (!isEvening) {
    booking.time = '';
    sel.value = '';
    fg.classList.remove('has-error');
    return;
  }
  if (booking.time) sel.value = booking.time;
  sel.onchange = () => {
    booking.time = sel.value;
    if (sel.value) fg.classList.remove('has-error');
  };
}

// ── Step 2 variant picker (shown inside step 2 for corporate/birthday) ──
function renderStep2VariantPicker() {
  const l = getLang();
  const wrap = document.getElementById('step2-variant-wrap');
  const errMsg = document.getElementById('err-variant-msg');
  if (!wrap) return;

  const ev = booking.event;
  if (!ev || !ev.variants) {
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
    prEl.textContent = '€' + Math.round(variant.price_eur);
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

    // Evening event: require start time
    if (booking.event?.id === 'evening') {
      const timeSel = document.getElementById('res-time');
      const timeFg  = document.getElementById('fg-time');
      if (!timeSel?.value) { timeFg?.classList.add('has-error'); return; }
      timeFg?.classList.remove('has-error');
      booking.time = timeSel.value;
    }

    // If event still has variants (not yet resolved), require selection
    if (booking.event?.variants) {
      const wrap = document.getElementById('step2-variant-wrap');
      const errMsg = document.getElementById('err-variant-msg');
      wrap?.classList.add('has-error');
      if (errMsg) errMsg.style.display = 'block';
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

  // Price line — only show when variant is resolved
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
    const item = document.createElement('label');
    item.className = 'addon-item' + (booking.addons[svc.id] ? ' selected' : '');
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!booking.addons[svc.id];

    const visual = document.createElement('div');
    if (svc.img) {
      visual.className = 'addon-img';
      const i = document.createElement('img');
      i.src = svc.img;
      i.alt = l === 'bg' ? svc.name_bg : svc.name_en;
      visual.appendChild(i);
      // Desktop-only click-to-enlarge; on mobile, click falls through to label and toggles checkbox
      visual.addEventListener('click', e => {
        if (!window.matchMedia('(min-width: 768px)').matches) return;
        e.preventDefault();
        e.stopPropagation();
        openImageLightbox(svc.img, i.alt);
      });
    }
    else { visual.className = 'addon-emoji'; visual.textContent = svc.emoji || '⭐'; visual.setAttribute('aria-hidden', 'true'); }

    const info = document.createElement('div'); info.className = 'addon-info';
    const name = document.createElement('div'); name.className = 'addon-name'; name.textContent = l === 'bg' ? svc.name_bg : svc.name_en;
    const price = document.createElement('div'); price.className = 'addon-price';
    price.textContent = fmt(svc.price);
    info.appendChild(name); info.appendChild(price);

    const check = document.createElement('div'); check.className = 'addon-check'; check.setAttribute('aria-hidden','true'); check.textContent = '✓';

    item.appendChild(input); item.appendChild(visual); item.appendChild(info); item.appendChild(check);
    grid.appendChild(item);

    item.addEventListener('change', () => {
      booking.addons[svc.id] = input.checked ? svc.price : 0;
      item.classList.toggle('selected', input.checked);
      updateAddonsTotal();
    });
  });
  updateAddonsTotal();
}

function updateAddonsTotal() {
  const total = Object.values(booking.addons).reduce((s, v) => s + (v || 0), 0);
  const el = document.getElementById('addons-total-val');
  if (el) el.textContent = '€' + Math.round(total);
}

// ── Drinks prompt (between add-ons and drinks) ──
function enterDrinksStep() {
  if (window.AgeGate) {
    window.AgeGate.verify(function () { goToStep(3); });
  } else {
    goToStep(3);
  }
}

function showDrinksPrompt() {
  const l = getLang();
  const prompt = document.getElementById('drinks-prompt');
  const textEl = document.getElementById('drinks-prompt-text');
  const yesBtn = document.getElementById('drinks-prompt-yes');
  const noBtn = document.getElementById('drinks-prompt-no');
  if (!prompt) { enterDrinksStep(); return; }

  textEl.textContent = l === 'bg'
    ? 'Желаете ли да разгледате менюто с напитки?'
    : 'Would you like to see our drinks menu?';
  yesBtn.textContent = l === 'bg' ? 'Да, покажи менюто' : 'Yes, show menu';
  noBtn.textContent = l === 'bg' ? 'Не, продължи напред' : 'No, skip';

  prompt.style.display = 'flex';

  yesBtn.onclick = function() { prompt.style.display = 'none'; enterDrinksStep(); };
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
    img.onerror = () => { img.onerror = null; img.src = 'assets/images/drinks/placeholder.svg'; };
    const body = document.createElement('div'); body.className = 'drink-body';
    const name = document.createElement('div'); name.className = 'drink-name'; name.textContent = l === 'bg' ? drink.name_bg : drink.name_en;
    const price = document.createElement('div'); price.className = 'drink-price';
    price.textContent = '€' + Number(drink.price_eur).toFixed(2);

    const qtyWrap = document.createElement('div'); qtyWrap.className = 'drink-qty';
    const minus = document.createElement('button'); minus.className = 'qty-btn'; minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Decrease');
    const num = document.createElement('input');
    num.className = 'qty-num';
    num.type = 'number';
    num.min = '0';
    num.max = '999';
    num.step = '1';
    num.inputMode = 'numeric';
    num.value = qty;
    num.setAttribute('aria-label', l === 'bg' ? 'Количество' : 'Quantity');
    const plus = document.createElement('button'); plus.className = 'qty-btn'; plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Increase');

    qtyWrap.appendChild(minus); qtyWrap.appendChild(num); qtyWrap.appendChild(plus);
    body.appendChild(name); body.appendChild(price); body.appendChild(qtyWrap);
    item.appendChild(img); item.appendChild(body); grid.appendChild(item);

    function setQty(next) {
      const n = Math.max(0, Math.min(999, Math.floor(Number(next) || 0)));
      booking.drinkQtys[drink.id] = n;
      num.value = n;
      item.classList.toggle('has-qty', n > 0);
      updateDrinksTotal();
    }
    minus.addEventListener('click', () => setQty((booking.drinkQtys[drink.id] || 0) - 1));
    plus.addEventListener('click',  () => setQty((booking.drinkQtys[drink.id] || 0) + 1));
    num.addEventListener('input', () => setQty(num.value));
    num.addEventListener('focus', () => num.select());
    num.addEventListener('blur',  () => { if (num.value === '' || isNaN(Number(num.value))) setQty(0); });
  });
}

function updateDrinksTotal() {
  let total = 0;
  drinks.forEach(d => { if (d.price_eur) total += (booking.drinkQtys[d.id] || 0) * d.price_eur; });
  const el = document.getElementById('drinks-total-val');
  if (el) el.textContent = '€' + Math.round(total);
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
    v(guests,'fg-guests', val => { const n=parseInt(val); return n>=1 && n<=140; });
    if (!valid) return;
    booking.name = name.value.trim(); booking.email = email.value.trim();
    const cc = document.getElementById('res-phone-cc')?.value || '';
    booking.phone = (cc + ' ' + phone.value.trim()).trim();
    booking.guests = guests.value;
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
  container.innerHTML = '';

  const img = document.createElement('img'); img.src = booking.event.img; img.alt = ''; img.className = 'summary-img';
  const body = document.createElement('div'); body.className = 'summary-body';
  [
    { label: l==='bg'?'Събитие':'Event',   value: l==='bg'?booking.event.title_bg:booking.event.title_en },
    { label: l==='bg'?'Дата':'Date',       value: booking.date + (booking.time ? ' · ' + booking.time : '') },
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

  // Price breakdown
  if (priceSummary) {
    priceSummary.innerHTML = '';
    const addonsTotal = Object.values(booking.addons).reduce((s,v)=>s+(v||0),0);
    let drinksTotal = 0; drinks.forEach(d => { if (d.price_eur) drinksTotal += (booking.drinkQtys[d.id]||0)*d.price_eur; });
    const guests = parseInt(booking.guests, 10) || 0;
    const extraGuests = Math.max(0, guests - GUEST_BASE_COUNT);
    const extraGuestsFee = extraGuests * EXTRA_GUEST_FEE;
    const grandTotal = (booking.event.price_eur || 0) + addonsTotal + drinksTotal + extraGuestsFee;
    const extraLabel = (l==='bg'?'Допълнителни гости':'Extra guests') + ' (' + extraGuests + ' × €' + EXTRA_GUEST_FEE.toFixed(2) + ')';
    const rows = [
      { label: l==='bg'?'Наем на зала':'Venue rental', value: fmtEvent(booking.event) },
      ...(addonsTotal > 0 ? [{ label: l==='bg'?'Допълнителни услуги':'Add-on services', value: '€'+Math.round(addonsTotal) }] : []),
      ...(drinksTotal > 0 ? [{ label: l==='bg'?'Напитки':'Drinks', value: '€'+Math.round(drinksTotal) }] : []),
      ...(extraGuestsFee > 0 ? [{ label: extraLabel, value: '€'+extraGuestsFee.toFixed(2) }] : []),
      { label: l==='bg'?'Обща сума':'Total', value: '€'+Math.round(grandTotal), total: true },
    ];
    rows.forEach(row => {
      const div = document.createElement('div'); div.className = 'price-summary-row';
      const lbl = document.createElement('span'); lbl.className = 'ps-label'; lbl.textContent = row.label;
      const val = document.createElement('span'); val.className = 'ps-value'; val.textContent = row.value;
      if (row.total) { div.style.fontWeight = '700'; div.style.fontSize = '1rem'; }
      div.appendChild(lbl); div.appendChild(val); priceSummary.appendChild(div);
    });
  }
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

    // Serialize add-ons: only the ones selected (price > 0). Store Bulgarian
    // names — customers receive Bulgarian emails; admin panel is bilingual by ID.
    const addonsPayload = Object.entries(booking.addons)
      .filter(([, price]) => price > 0)
      .map(([id, price]) => {
        const svc = addonServices.find(s => s.id === id);
        return { id, name: svc ? svc.name_bg : id, price };
      });

    // Serialize drinks: only items with qty > 0
    const drinksPayload = Object.entries(booking.drinkQtys)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const drink = drinks.find(d => d.id === id);
        return { id, name: drink ? drink.name_bg : id, qty, price_eur: drink?.price_eur ?? null };
      });

    const payload = {
      full_name: booking.name,
      email: booking.email,
      phone: booking.phone,
      event_type: booking.event ? booking.event.title_bg : '',
      event_id: booking.event ? booking.event.id : '',
      preferred_date: booking.date,
      time_of_day: booking.time,
      guests: booking.guests ? parseInt(booking.guests, 10) : null,
      addons: addonsPayload,
      drinks: drinksPayload,
      payment_method: booking.payment,
      notes: booking.notes || null,
    };

    const { error } = await reservationDb.from('enquiries').insert(payload);

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
  setupSubmit();
  updateProgress();

  // Auto-select event from URL param (e.g. ?event=evening or ?event=corporate)
  const params = new URLSearchParams(window.location.search);
  const preselect = params.get('event');
  if (preselect) {
    const match = eventTypes.find(e => e.id === preselect);
    if (match) {
      booking.event = match;
      renderEventPicker();
      setTimeout(() => goToStep(1), 300);
    }
  }
});
