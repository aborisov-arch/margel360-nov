// ── Event type data (prices from margel360.bg) ──
const eventTypes = [
  {
    id: 'corp4',
    title_bg: 'Корпоративно събитие 4ч.',
    title_en: 'Corporate Event 4h',
    duration_bg: '4 часа',
    duration_en: '4 hours',
    price_bgn: 580,
    price_eur: 296.55,
    img: 'assets/images/venue-9.jpg',
    included: ['sound', 'lighting', 'bar', 'fridge', 'parking', 'wc', 'elevator', 'tables_conf'],
  },
  {
    id: 'corp8',
    title_bg: 'Корпоративно събитие 8ч.',
    title_en: 'Corporate Event 8h',
    duration_bg: '8 часа',
    duration_en: '8 hours',
    price_bgn: 790,
    price_eur: 403.92,
    img: 'assets/images/venue-8.jpg',
    included: ['sound', 'lighting', 'bar', 'fridge', 'parking', 'wc', 'elevator', 'tables_conf', 'projector'],
  },
  {
    id: 'bday_day',
    title_bg: 'Детски рожден ден (дневно)',
    title_en: "Children's Birthday (daytime)",
    duration_bg: 'до 17:30',
    duration_en: 'until 5:30 PM',
    price_bgn: 1270,
    price_eur: 649.34,
    img: 'assets/images/event-1.jpg',
    included: ['sound', 'lighting', 'bar', 'fridge', 'parking', 'wc', 'elevator', 'dance'],
  },
  {
    id: 'bday_eve',
    title_bg: 'Детски рожден ден (вечерно)',
    title_en: "Children's Birthday (evening)",
    duration_bg: '16:00 – 24:00',
    duration_en: '4:00 PM – midnight',
    price_bgn: 1800,
    price_eur: 920.33,
    img: 'assets/images/venue-16.jpg',
    included: ['sound', 'lighting', 'bar', 'fridge', 'parking', 'wc', 'elevator', 'dance', 'terrace'],
  },
  {
    id: 'evening',
    title_bg: 'Вечерно събитие',
    title_en: 'Evening Event',
    duration_bg: 'след 19:00',
    duration_en: 'after 7:00 PM',
    price_bgn: 2370,
    price_eur: 1211.76,
    img: 'assets/images/venue-17.jpg',
    included: ['sound', 'lighting', 'bar', 'fridge', 'parking', 'wc', 'elevator', 'dance', 'terrace'],
  },
  {
    id: 'wedding',
    title_bg: 'Сватба',
    title_en: 'Wedding',
    duration_bg: 'По договаряне',
    duration_en: 'By arrangement',
    price_bgn: 2880,
    price_eur: 1472.52,
    img: 'assets/images/event-2.jpg',
    included: ['sound', 'lighting', 'bar', 'fridge', 'parking', 'wc', 'elevator', 'dance', 'terrace', 'redcarpet'],
  },
];

const serviceLabels = {
  bg: {
    sound:       '12 колони EV/YAMAHA 360°',
    lighting:    'Професионално осветление',
    bar:         'Бар с ледогенератори',
    fridge:      '3 хладилни витрини',
    parking:     '70+ безплатни паркоместа',
    wc:          'Санитарни помещения',
    elevator:    'Асансьор',
    tables_conf: 'Конферентни маси и столове',
    projector:   'Проектор и екран',
    dance:       'Танцова площадка',
    terrace:     'Панорамна тераса 260 м²',
    redcarpet:   'Червен килим',
  },
  en: {
    sound:       '12 EV/YAMAHA speakers 360°',
    lighting:    'Professional lighting',
    bar:         'Bar with ice makers',
    fridge:      '3 refrigerated displays',
    parking:     '70+ free parking spaces',
    wc:          'Restrooms',
    elevator:    'Elevator',
    tables_conf: 'Conference tables and chairs',
    projector:   'Projector and screen',
    dance:       'Dance floor',
    terrace:     '260 m² panoramic terrace',
    redcarpet:   'Red carpet',
  },
};

// ── State ──
let currentStep = 0;
let booking = { event: null, date: '', time: 'day', name: '', email: '', phone: '', guests: '', notes: '', payment: 'cash' };
const TOTAL_STEPS = 5;

function getLang() { return localStorage.getItem('margel_lang') || 'bg'; }

function formatPrice(bgn, eur) {
  return getLang() === 'bg'
    ? bgn.toLocaleString('bg-BG') + ' лв.'
    : '€' + eur.toFixed(2);
}

// ── Step navigation ──
function goToStep(n) {
  if (n < 0 || n >= TOTAL_STEPS) return;
  document.getElementById('step-' + currentStep).classList.remove('active');
  currentStep = n;
  document.getElementById('step-' + currentStep).classList.add('active');
  updateProgress();
  const section = document.querySelector('.wizard-section');
  if (section) window.scrollTo({ top: section.offsetTop - 90, behavior: 'smooth' });
  if (n === 2) renderIncludedServices();
  if (n === 4) renderSummary();
}

function updateProgress() {
  const fill = currentStep / (TOTAL_STEPS - 1) * 100;
  const fillEl = document.getElementById('progress-fill');
  if (fillEl) fillEl.style.width = fill + '%';

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
    const card = document.createElement('div');
    card.className = 'event-pick-card' + (booking.event && booking.event.id === ev.id ? ' selected' : '');
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', booking.event && booking.event.id === ev.id ? 'true' : 'false');

    const img = document.createElement('img');
    img.src = ev.img;
    img.alt = l === 'bg' ? ev.title_bg : ev.title_en;
    img.loading = 'lazy';

    const body = document.createElement('div');
    body.className = 'event-pick-body';

    const h3 = document.createElement('h3');
    h3.textContent = l === 'bg' ? ev.title_bg : ev.title_en;

    const meta = document.createElement('div');
    meta.className = 'event-pick-meta';

    const dur = document.createElement('span');
    dur.className = 'event-pick-duration';
    dur.textContent = l === 'bg' ? ev.duration_bg : ev.duration_en;

    const price = document.createElement('span');
    price.className = 'event-pick-price';
    price.textContent = formatPrice(ev.price_bgn, ev.price_eur);

    meta.appendChild(dur);
    meta.appendChild(price);
    body.appendChild(h3);
    body.appendChild(meta);
    card.appendChild(img);
    card.appendChild(body);
    grid.appendChild(card);

    function selectThis() {
      booking.event = ev;
      grid.querySelectorAll('.event-pick-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      setTimeout(() => goToStep(1), 280);
    }
    card.addEventListener('click', selectThis);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectThis(); }
    });
  });
}

// ── Step 2 ──
function setupStep2() {
  const dateInput = document.getElementById('res-date');
  if (dateInput) {
    dateInput.min = new Date().toISOString().split('T')[0];
    dateInput.addEventListener('change', () => { booking.date = dateInput.value; updateEventPreview(); });
  }
  document.querySelectorAll('input[name="time"]').forEach(r => {
    r.addEventListener('change', () => { booking.time = r.value; updateEventPreview(); });
  });

  const btnNext = document.getElementById('btn-step2-next');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const dateEl = document.getElementById('res-date');
      const fgDate = dateEl ? dateEl.closest('.form-group') : null;
      if (!dateEl || !dateEl.value) {
        if (fgDate) fgDate.classList.add('has-error');
        return;
      }
      if (fgDate) fgDate.classList.remove('has-error');
      booking.date = dateEl.value;
      booking.time = document.querySelector('input[name="time"]:checked')?.value || 'day';
      goToStep(2);
    });
  }
}

function updateEventPreview() {
  const preview = document.getElementById('event-preview');
  if (!preview || !booking.event) return;
  const l = getLang();
  preview.classList.add('show');
  preview.innerHTML = '';

  const h4 = document.createElement('h4');
  h4.textContent = l === 'bg' ? booking.event.title_bg : booking.event.title_en;

  const p = document.createElement('p');
  p.textContent = formatPrice(booking.event.price_bgn, booking.event.price_eur)
    + (booking.date ? ' · ' + booking.date : '');

  preview.appendChild(h4);
  preview.appendChild(p);
}

// ── Step 3 ──
function renderIncludedServices() {
  const l = getLang();
  const container = document.getElementById('services-included');
  const priceSummary = document.getElementById('price-summary');
  if (!container || !booking.event) return;

  container.innerHTML = '';
  booking.event.included.forEach(key => {
    const item = document.createElement('div');
    item.className = 'service-inc-item';

    const check = document.createElement('div');
    check.className = 'service-inc-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';

    const label = document.createElement('span');
    label.className = 'service-inc-label';
    label.textContent = serviceLabels[l][key] || key;

    item.appendChild(check);
    item.appendChild(label);
    container.appendChild(item);
  });

  if (priceSummary) {
    priceSummary.innerHTML = '';
    [
      { label: l === 'bg' ? 'Наем на зала' : 'Venue rental',         value: formatPrice(booking.event.price_bgn, booking.event.price_eur) },
      { label: l === 'bg' ? 'Включени услуги' : 'Included services', value: l === 'bg' ? 'Безплатно' : 'Free' },
      { label: l === 'bg' ? 'Общо' : 'Total',                        value: formatPrice(booking.event.price_bgn, booking.event.price_eur) },
    ].forEach(row => {
      const div = document.createElement('div');
      div.className = 'price-summary-row';
      const lbl = document.createElement('span'); lbl.className = 'ps-label'; lbl.textContent = row.label;
      const val = document.createElement('span'); val.className = 'ps-value'; val.textContent = row.value;
      div.appendChild(lbl); div.appendChild(val);
      priceSummary.appendChild(div);
    });
  }
}

// ── Step 4 ──
function setupStep4() {
  const btnNext = document.getElementById('btn-step4-next');
  if (!btnNext) return;
  btnNext.addEventListener('click', () => {
    const name   = document.getElementById('res-name');
    const email  = document.getElementById('res-email');
    const phone  = document.getElementById('res-phone');
    const guests = document.getElementById('res-guests');
    let valid = true;

    function validate(el, fgId, test) {
      const g = document.getElementById(fgId);
      if (!test(el ? el.value : '')) { if (g) g.classList.add('has-error'); valid = false; }
      else if (g) g.classList.remove('has-error');
    }

    validate(name,   'fg-name',   v => v.trim().length >= 2);
    validate(email,  'fg-email',  v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()));
    validate(phone,  'fg-phone',  v => v.replace(/\D/g, '').length >= 7);
    validate(guests, 'fg-guests', v => { const n = parseInt(v); return n >= 1 && n <= 140; });

    if (!valid) return;
    booking.name   = name.value.trim();
    booking.email  = email.value.trim();
    booking.phone  = phone.value.trim();
    booking.guests = guests.value;
    booking.notes  = document.getElementById('res-message')?.value.trim() || '';
    goToStep(4);
  });
}

// ── Step 5 ──
function renderSummary() {
  const l = getLang();
  const container = document.getElementById('booking-summary');
  if (!container || !booking.event) return;
  container.innerHTML = '';

  const img = document.createElement('img');
  img.src = booking.event.img;
  img.alt = l === 'bg' ? booking.event.title_bg : booking.event.title_en;
  img.className = 'summary-img';

  const body = document.createElement('div');
  body.className = 'summary-body';

  const rows = [
    { label: l === 'bg' ? 'Събитие'   : 'Event',   value: l === 'bg' ? booking.event.title_bg : booking.event.title_en },
    { label: l === 'bg' ? 'Дата'      : 'Date',    value: booking.date },
    { label: l === 'bg' ? 'Час'       : 'Time',    value: booking.time === 'day' ? (l === 'bg' ? 'Дневно' : 'Daytime') : (l === 'bg' ? 'Вечерно' : 'Evening') },
    { label: l === 'bg' ? 'Гости'     : 'Guests',  value: booking.guests },
    { label: l === 'bg' ? 'Три имена' : 'Name',    value: booking.name },
    { label: l === 'bg' ? 'Имейл'     : 'Email',   value: booking.email },
    { label: l === 'bg' ? 'Телефон'   : 'Phone',   value: booking.phone },
  ];
  if (booking.notes) rows.push({ label: l === 'bg' ? 'Бележки' : 'Notes', value: booking.notes });
  rows.push({ label: l === 'bg' ? 'Обща сума' : 'Total', value: formatPrice(booking.event.price_bgn, booking.event.price_eur), total: true });

  rows.forEach(row => {
    const div = document.createElement('div');
    div.className = 'summary-row' + (row.total ? ' sr-total' : '');
    const lbl = document.createElement('span'); lbl.className = 'sr-label'; lbl.textContent = row.label;
    const val = document.createElement('span'); val.className = 'sr-value'; val.textContent = row.value || '—';
    div.appendChild(lbl); div.appendChild(val);
    body.appendChild(div);
  });

  container.appendChild(img);
  container.appendChild(body);
}

// ── Submit ──
function setupSubmit() {
  const btn = document.getElementById('btn-submit');
  if (!btn) return;
  btn.addEventListener('click', () => {
    booking.payment = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
    const step5 = document.getElementById('step-4');
    const progress = document.querySelector('.wizard-progress');
    const success = document.getElementById('form-success');
    if (step5) step5.classList.remove('active');
    if (progress) progress.style.display = 'none';
    if (success) success.style.display = 'block';
    const section = document.querySelector('.wizard-section');
    if (section) window.scrollTo({ top: section.offsetTop - 90, behavior: 'smooth' });
  });
}

// ── Language change ──
document.addEventListener('langChange', () => {
  renderEventPicker();
  if (currentStep === 2) renderIncludedServices();
  if (currentStep === 4) renderSummary();
  updateEventPreview();
});

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  renderEventPicker();
  setupStep2();
  setupStep4();
  setupSubmit();
  updateProgress();
});
