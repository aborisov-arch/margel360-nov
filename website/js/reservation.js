// ── Event types ──
const eventTypes = [
  { id:'evening',   title_bg:'Вечерно събитие',       title_en:'Evening Event',      duration_bg:'след 19:00',    duration_en:'after 7:00 PM',   price_bgn:2503.46, price_eur:1280.46, img:'assets/images/event-evening.jpg',   included:['sound','lighting','bar','fridge','parking','wc','elevator','dance','terrace'] },
  {
    id:'corporate', title_bg:'Корпоративно събитие',  title_en:'Corporate Event',    img:'assets/images/event-corporate.jpg',
    variants: [
      { id:'corp4', label_bg:'4 часа', label_en:'4 hours', price_bgn:645.42,  price_eur:330.00, duration_bg:'08:00–17:30', duration_en:'8:00 AM–5:30 PM', included:['sound','lighting','bar','fridge','parking','wc','elevator','tables_conf'] },
      { id:'corp8', label_bg:'8 часа', label_en:'8 hours', price_bgn:860.57,  price_eur:440.00, duration_bg:'08:00–17:30', duration_en:'8:00 AM–5:30 PM', included:['sound','lighting','bar','fridge','parking','wc','elevator','tables_conf','projector'] },
    ],
  },
  {
    id:'birthday',  title_bg:'Детски рожден ден',     title_en:"Children's Birthday", img:'assets/images/event-birthday.jpg',
    variants: [
      { id:'bday_day', label_bg:'Дневно (до 17:30) — 5 часа', label_en:'Daytime (until 5:30 PM) — 5 hours', price_bgn:1369.08, price_eur:700.00,  duration_bg:'до 17:30',    duration_en:'until 5:30 PM',     included:['sound','lighting','bar','fridge','parking','wc','elevator','dance'] },
      { id:'bday_eve', label_bg:'Вечерно (16:00–24:00) — 5 часа', label_en:'Evening (4:00 PM–midnight) — 5 hours', price_bgn:1897.15, price_eur:970.00, duration_bg:'16:00–24:00', duration_en:'4:00 PM–midnight',   included:['sound','lighting','bar','fridge','parking','wc','elevator','dance','terrace'] },
    ],
  },
  { id:'wedding',   title_bg:'Сватба',                title_en:'Wedding',            duration_bg:'По договаряне', duration_en:'By arrangement',  price_bgn:2933.75, price_eur:1500.00, img:'assets/images/event-wedding.jpg',   included:['sound','lighting','bar','fridge','parking','wc','elevator','dance','terrace','redcarpet'] },
];

const includedLabels = {
  bg: { sound:'12 колони EV/YAMAHA 360°', lighting:'Проф. осветление', bar:'Бар с ледогенератори', fridge:'3 хладилни витрини', parking:'70+ паркоместа', wc:'Санитарни помещения', elevator:'Асансьор', tables_conf:'Конф. маси и столове', projector:'Проектор и екран', dance:'Танцова площадка', terrace:'Тераса 260м²', redcarpet:'Червен килим' },
  en: { sound:'12 EV/YAMAHA speakers',    lighting:'Prof. lighting',    bar:'Bar with ice makers',  fridge:'3 fridges',          parking:'70+ parking',    wc:'Restrooms',            elevator:'Elevator',   tables_conf:'Conf. tables & chairs',  projector:'Projector & screen', dance:'Dance floor', terrace:'260m² terrace', redcarpet:'Red carpet' },
};

// ── Paid add-on services (from margel360.bg services page) ──
const addonServices = [
  { id:'dj',        name_bg:'DJ за 5 часа',                name_en:'DJ for 5 hours',             price:587,  img:'assets/images/services/dj.jpg' },
  { id:'photo2',    name_bg:'Фотограф за 2 часа',          name_en:'Photographer 2h',            price:340,  img:'assets/images/services/photographer.jpg' },
  { id:'photo4',    name_bg:'Фотограф за 4 часа',          name_en:'Photographer 4h',            price:580,  img:'assets/images/services/photographer.jpg' },
  { id:'booth2',    name_bg:'Фото будка 360° (2 часа)',    name_en:'360° Photo Booth (2 hours)', price:390,  img:'assets/images/services/booth.jpg' },
  { id:'booth4',    name_bg:'Фото будка 360° (4 часа)',    name_en:'360° Photo Booth (4 hours)', price:560,  img:'assets/images/services/booth.jpg' },
  { id:'arch',      name_bg:'Декоративна арка с осветление',name_en:'Decorative arch + lights',  price:760,  img:'assets/images/services/arch.jpg' },
  { id:'wall_s',    name_bg:'Декоративна стена SILVER',    name_en:'Decorative wall SILVER',     price:355,  img:'assets/images/services/wall-silver.jpg' },
  { id:'wall_g',    name_bg:'Декоративна стена GOLD',      name_en:'Decorative wall GOLD',       price:355,  img:'assets/images/services/wall-gold.jpg' },
  { id:'flare_s',   name_bg:'Заря 150–170 сек.',           name_en:'Sparkle fountain 150–170s',  price:440,  img:'assets/images/services/fireworks.jpg' },
  { id:'flare_l',   name_bg:'Заря 300–340 сек.',           name_en:'Sparkle fountain 300–340s',  price:790,  img:'assets/images/services/fireworks.jpg' },
  { id:'fountain_s',name_bg:'Светлинен фонтан 1300мм',     name_en:'Light fountain 1300mm',      price:96,   img:'assets/images/services/fountain-s.jpg' },
  { id:'fountain_l',name_bg:'Светлинен фонтан 2600мм',     name_en:'Light fountain 2600mm',      price:160,  img:'assets/images/services/fountain-l.jpg' },
  { id:'led',       name_bg:'LED екран',                   name_en:'LED screen',                 price:290,  img:'assets/images/services/led.jpg' },
  { id:'mic',       name_bg:'Микрофони — 3бр. + брошка',   name_en:'Microphones set',            price:97,   img:'assets/images/services/mic.jpg' },
  { id:'proj',      name_bg:'Мултимедия EPSON',             name_en:'EPSON multimedia projector', price:180,  img:'assets/images/services/projector.jpg' },
  { id:'security',  name_bg:'Охрана VTA за 6 часа',        name_en:'VTA security 6h',            price:196,  img:'assets/images/services/security.jpg' },
  { id:'hygiene',   name_bg:'Хигиенист за 5 часа',         name_en:'Hygienist 5h',               price:156,  img:'assets/images/services/wardrobe.jpg' },
  { id:'wardrobe',  name_bg:'Гардеробиер за 5 часа',       name_en:'Wardrobe attendant 5h',      price:176,  img:'assets/images/services/wardrobe.jpg' },
  { id:'valet',     name_bg:'Вале-паркинг за 5 часа',      name_en:'Valet parking 5h',           price:275,  img:'assets/images/services/valet.jpg' },
  { id:'carpet_l',  name_bg:'Червена пътека (8 бр.)',       name_en:'Red carpet (8 pieces)',      price:148,  img:'assets/images/services/redcarpet.jpg' },
  { id:'candles_h', name_bg:'Свещи в залата — 60 бр.',     name_en:'Hall candles 60 pcs',        price:100,  img:'assets/images/services/candles.jpg' },
  { id:'numbers',   name_bg:'Светещи цифри',                name_en:'Light-up numbers',           price:68,   img:'assets/images/services/glow-numbers.jpg' },
];

// ── Drinks / Alcohol ──
const drinkCategories = {
  bg: ['Шампанско', 'Вино', 'Бира & Спиртни', 'Безалкохолно', 'Вода'],
  en: ['Champagne', 'Wine', 'Beer & Spirits', 'Soft Drinks', 'Water'],
};
const drinks = [
  // Champagne
  { id:'dom',     cat:0, name_bg:'Dom Pérignon 0.75л',            name_en:'Dom Pérignon 0.75L',            price_bgn:627,  img:'assets/images/drinks/dom-perignon.png' },
  { id:'ruinart', cat:0, name_bg:'Ruinart Blanc de Blanc 0.75л',  name_en:'Ruinart Blanc de Blanc 0.75L',  price_bgn:240,  img:'assets/images/drinks/ruinart.png' },
  { id:'veuve',   cat:0, name_bg:'Veuve Clicquot Brut',           name_en:'Veuve Clicquot Brut',           price_bgn:138,  img:'assets/images/drinks/veuve-clicquot.png' },
  { id:'moet',    cat:0, name_bg:'Moët & Chandon Brut',           name_en:'Moët & Chandon Brut',           price_bgn:122,  img:'assets/images/drinks/moet.png' },
  { id:'prosecco',cat:0, name_bg:'Andreola Prosecco Dirupo 0.75л',name_en:'Andreola Prosecco Dirupo 0.75L',price_bgn:31,   img:'assets/images/drinks/prosecco.png' },
  // Wine
  { id:'miraval_r',cat:1, name_bg:'Шато Мираваль Розе',           name_en:'Château Miraval Rosé',          price_bgn:68,   img:'assets/images/drinks/miraval-rose.png' },
  { id:'miraval_w',cat:1, name_bg:'Шато Мираваль STUDIO бяло',    name_en:'Château Miraval Studio White',  price_bgn:44,   img:'assets/images/drinks/miraval-white.png' },
  { id:'villa',   cat:1, name_bg:'Villa Maria Sauvignon Blanc',   name_en:'Villa Maria Sauvignon Blanc',   price_bgn:34,   img:'assets/images/drinks/sauvignon-villa.png' },
  { id:'le_rose', cat:1, name_bg:'Le Rosé',                       name_en:'Le Rosé',                       price_bgn:26,   img:'assets/images/drinks/le-rose.png' },
  // Beer & Spirits
  { id:'heineken',cat:2, name_bg:'Heineken 0.33л',                name_en:'Heineken 0.33L',                price_bgn:2.30, img:'assets/images/drinks/heineken.png' },
  { id:'patron',  cat:2, name_bg:'Patrón Silver Tequila',         name_en:'Patrón Silver Tequila',         price_bgn:null, img:'assets/images/drinks/patron.png' },
  { id:'chivas18',cat:2, name_bg:'Chivas Regal 18 год.',          name_en:'Chivas Regal 18 year',          price_bgn:null, img:'assets/images/drinks/chivas18.png' },
  { id:'chivas12',cat:2, name_bg:'Chivas Regal 12 год.',          name_en:'Chivas Regal 12 year',          price_bgn:null, img:'assets/images/drinks/chivas12.png' },
  { id:'uzo',     cat:2, name_bg:'Узо Пломари',                   name_en:'Uzo Plomari',                   price_bgn:null, img:'assets/images/drinks/uzo.png' },
  // Soft Drinks
  { id:'cola',    cat:3, name_bg:'Кока Кола',                     name_en:'Coca-Cola',                     price_bgn:1.80, img:'assets/images/drinks/coca-cola.png' },
  { id:'cola0',   cat:3, name_bg:'Кока Кола Зеро',                name_en:'Coca-Cola Zero',                price_bgn:1.80, img:'assets/images/drinks/coca-zero.png' },
  { id:'fanta',   cat:3, name_bg:'Фанта Портокал',                name_en:'Fanta Orange',                  price_bgn:1.80, img:'assets/images/drinks/fanta.png' },
  { id:'redbull', cat:3, name_bg:'Red Bull',                      name_en:'Red Bull',                      price_bgn:3.10, img:'assets/images/drinks/red-bull.png' },
  // Water
  { id:'pelegrino',cat:4, name_bg:'San Pellegrino 0.75л',         name_en:'San Pellegrino 0.75L',          price_bgn:5.60, img:'assets/images/drinks/san-pelegrino.png' },
  { id:'benedo',  cat:4, name_bg:'San Benedetto газирана',        name_en:'San Benedetto sparkling',       price_bgn:1.20, img:'assets/images/drinks/san-benedetto.png' },
];

// ── State ──
let currentStep = 0;
const TOTAL_STEPS = 6;
let booking = { event:null, date:'', time:'day', addons:{}, drinkQtys:{}, name:'', email:'', phone:'', guests:'', notes:'', payment:'cash' };
let activeDrinkCat = 0;

function getLang() { return localStorage.getItem('margel_lang') || 'bg'; }
const RATE = 1.95583;
function toEur(bgn) { return (bgn / RATE).toFixed(2); }
function fmt(bgn) {
  if (!bgn || bgn == null) return getLang() === 'bg' ? 'По запитване' : 'On request';
  return '€' + toEur(bgn);
}
function fmtDual(bgn) {
  // Returns { eur, bgn } strings for two-line display
  if (!bgn) return null;
  return { eur: '€' + toEur(bgn), bgn: bgn.toLocaleString('bg-BG') + ' лв.' };
}
function fmtEvent(ev) {
  return '€' + toEur(ev.price_bgn);
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
    lbEl.textContent = l === 'bg' ? variant.label_bg : variant.label_en;
    const prEl = document.createElement('span'); prEl.className = 'variant-btn-price';
    prEl.textContent = '€' + variant.price_eur.toFixed(0) + ' / ' + variant.price_bgn.toLocaleString('bg-BG') + ' лв.';

    btn.appendChild(lbEl); btn.appendChild(prEl);
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

  // Price line — only show when variant is resolved (price_bgn available)
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
    if (svc.img) { visual.className = 'addon-img'; const i = document.createElement('img'); i.src = svc.img; i.alt = ''; visual.appendChild(i); }
    else { visual.className = 'addon-emoji'; visual.textContent = svc.emoji || '⭐'; visual.setAttribute('aria-hidden', 'true'); }

    const info = document.createElement('div'); info.className = 'addon-info';
    const name = document.createElement('div'); name.className = 'addon-name'; name.textContent = l === 'bg' ? svc.name_bg : svc.name_en;
    const price = document.createElement('div'); price.className = 'addon-price';
    const dual = fmtDual(svc.price);
    if (dual) {
      const eurEl = document.createElement('span'); eurEl.className = 'price-eur'; eurEl.textContent = dual.eur;
      const bgnEl = document.createElement('span'); bgnEl.className = 'price-bgn'; bgnEl.textContent = dual.bgn;
      price.appendChild(eurEl); price.appendChild(bgnEl);
    } else { price.textContent = fmt(svc.price); }
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
  if (el) el.textContent = getLang() === 'bg' ? total.toLocaleString('bg-BG') + ' лв.' : '€' + (total / 1.956).toFixed(2);
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
    const dualD = fmtDual(drink.price_bgn);
    if (dualD) {
      const eurEl = document.createElement('span'); eurEl.className = 'price-eur'; eurEl.textContent = dualD.eur;
      const bgnEl = document.createElement('span'); bgnEl.className = 'price-bgn'; bgnEl.textContent = dualD.bgn;
      price.appendChild(eurEl); price.appendChild(bgnEl);
    } else { price.textContent = l === 'bg' ? 'По запитване' : 'On request'; }

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
  drinks.forEach(d => { if (d.price_bgn) total += (booking.drinkQtys[d.id] || 0) * d.price_bgn; });
  const el = document.getElementById('drinks-total-val');
  if (el) el.textContent = getLang() === 'bg' ? total.toFixed(2) + ' лв.' : '€' + (total / 1.956).toFixed(2);
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

  // Price breakdown
  if (priceSummary) {
    priceSummary.innerHTML = '';
    const addonsTotal = Object.values(booking.addons).reduce((s,v)=>s+(v||0),0);
    let drinksTotal = 0; drinks.forEach(d => { if (d.price_bgn) drinksTotal += (booking.drinkQtys[d.id]||0)*d.price_bgn; });
    const grandTotal = booking.event.price_bgn + addonsTotal + drinksTotal;
    const rows = [
      { label: l==='bg'?'Наем на зала':'Venue rental', value: fmtEvent(booking.event) },
      ...(addonsTotal > 0 ? [{ label: l==='bg'?'Допълнителни услуги':'Add-on services', value: (l==='bg'?addonsTotal.toLocaleString('bg-BG')+' лв.':'€'+(addonsTotal/1.956).toFixed(2)) }] : []),
      ...(drinksTotal > 0 ? [{ label: l==='bg'?'Напитки':'Drinks', value: (l==='bg'?drinksTotal.toFixed(2)+' лв.':'€'+(drinksTotal/1.956).toFixed(2)) }] : []),
      { label: l==='bg'?'Обща сума':'Total', value: (l==='bg'?grandTotal.toFixed(2)+' лв.':'€'+(grandTotal/1.956).toFixed(2)), total: true },
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

    // Serialize add-ons: only the ones selected (price > 0)
    const addonsPayload = Object.entries(booking.addons)
      .filter(([, price]) => price > 0)
      .map(([id, price]) => {
        const svc = addonServices.find(s => s.id === id);
        return { id, name: svc ? svc.name_en : id, price };
      });

    // Serialize drinks: only items with qty > 0
    const drinksPayload = Object.entries(booking.drinkQtys)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const drink = drinks.find(d => d.id === id);
        return { id, name: drink ? drink.name_en : id, qty, price_bgn: drink?.price_bgn ?? null };
      });

    const payload = {
      full_name: booking.name,
      email: booking.email,
      phone: booking.phone,
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

    const { error } = await reservationDb.from('enquiries').insert(payload);

    if (error) {
      console.error('Enquiry submission error:', error);
      btn.disabled = false;
      btn.textContent = origText;
      const lang = getLang();
      alert(lang === 'bg'
        ? 'Нещо се обърка. Моля обадете ни се директно на 0888 10 09 42.'
        : 'Something went wrong. Please call us directly on 0888 10 09 42.');
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
