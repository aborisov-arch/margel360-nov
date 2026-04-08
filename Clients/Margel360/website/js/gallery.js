// ── Images ──
const images = [
  { src: 'assets/images/event-evening.jpg',       alt_bg: 'Вечерно събитие',          alt_en: 'Evening event' },
  { src: 'assets/images/gallery-evening-1.jpg',   alt_bg: 'Събитие в залата',         alt_en: 'Event at the venue' },
  { src: 'assets/images/gallery-evening-2.jpg',   alt_bg: 'Събитие в залата',         alt_en: 'Event at the venue' },
  { src: 'assets/images/event-wedding.jpg',       alt_bg: 'Сватба',                   alt_en: 'Wedding' },
  { src: 'assets/images/gallery-wedding-1.jpg',   alt_bg: 'Сватбено тържество',       alt_en: 'Wedding celebration' },
  { src: 'assets/images/gallery-evening-3.jpg',   alt_bg: 'Вечерно събитие',          alt_en: 'Evening event' },
  { src: 'assets/images/event-birthday.jpg',      alt_bg: 'Детски рожден ден',        alt_en: "Children's birthday" },
  { src: 'assets/images/gallery-birthday-1.jpg',  alt_bg: 'Рожден ден',               alt_en: 'Birthday party' },
  { src: 'assets/images/event-birthday-eve.jpg',  alt_bg: 'Вечерен рожден ден',       alt_en: 'Evening birthday' },
  { src: 'assets/images/gallery-evening-4.jpg',   alt_bg: 'Събитие в залата',         alt_en: 'Event at the venue' },
  { src: 'assets/images/event-corporate.jpg',     alt_bg: 'Корпоративно събитие',     alt_en: 'Corporate event' },
  { src: 'assets/images/gallery-corporate-1.jpg', alt_bg: 'Корпоративна среща',       alt_en: 'Corporate meeting' },
  { src: 'assets/images/gallery-evening-5.jpg',   alt_bg: 'Вечерно събитие',          alt_en: 'Evening event' },
  { src: 'assets/images/gallery-1.jpg',           alt_bg: 'Бар на Маргел 360°',       alt_en: 'Margel 360° bar' },
  { src: 'assets/images/gallery-2.jpg',           alt_bg: 'Събитие в залата',         alt_en: 'Event at the venue' },
  { src: 'assets/images/gallery-3.jpg',           alt_bg: 'Събитие в залата',         alt_en: 'Event at the venue' },
  { src: 'assets/images/gallery-4.jpg',           alt_bg: 'Събитие в залата',         alt_en: 'Event at the venue' },
  { src: 'assets/images/gallery-5.jpg',           alt_bg: 'Събитие в залата',         alt_en: 'Event at the venue' },
];

// ── State ──
let current = 0;
let isGridOpen = false;
let lang = localStorage.getItem('margel_lang') || 'bg';

// ── Elements ──
const track       = document.getElementById('gl-track');
const prevBtn     = document.getElementById('gl-prev');
const nextBtn     = document.getElementById('gl-next');
const currentEl   = document.getElementById('gl-current');
const totalEl     = document.getElementById('gl-total');
const hintEl      = document.getElementById('gl-hint');
const toggleBtn   = document.getElementById('gl-view-toggle');
const gridView    = document.getElementById('gl-grid-view');
const gridInner   = document.getElementById('gl-grid-inner');
const cinema      = document.getElementById('gl-cinema');

// ── Build slides ──
function buildSlides() {
  track.innerHTML = '';
  images.forEach((img, i) => {
    const slide = document.createElement('div');
    slide.className = 'gl-slide' + (i === current ? ' active' : '');
    slide.dataset.index = i;

    const el = document.createElement('img');
    el.src = img.src;
    el.alt = lang === 'bg' ? img.alt_bg : img.alt_en;
    el.loading = i <= 2 ? 'eager' : 'lazy';
    el.draggable = false;

    // Detect orientation once image loads to set width class
    el.addEventListener('load', () => {
      slide.classList.toggle('is-portrait',  el.naturalWidth < el.naturalHeight);
      slide.classList.toggle('is-landscape', el.naturalWidth >= el.naturalHeight);
      if (i === current) positionTrack();
    }, { once: true });

    // Fallback orientation guess from filename context
    slide.classList.add('is-landscape');

    slide.appendChild(el);
    track.appendChild(slide);
  });
}

// ── Position track so current slide is centred ──
function positionTrack() {
  const slides = track.querySelectorAll('.gl-slide');
  if (!slides[current]) return;

  let offset = 0;
  slides.forEach((s, i) => {
    if (i < current) offset += s.offsetWidth;
  });

  // Centre the active slide
  const vw = window.innerWidth;
  const slideW = slides[current].offsetWidth;
  offset -= (vw - slideW) / 2;

  track.style.transform = `translateX(${-offset}px)`;
}

// ── Navigate ──
function goTo(index) {
  if (index < 0 || index >= images.length) return;

  const slides = track.querySelectorAll('.gl-slide');
  slides[current].classList.remove('active');
  current = index;
  slides[current].classList.add('active');

  positionTrack();
  updateUI();

  // Hide scroll hint after first nav
  if (hintEl) hintEl.classList.add('hidden');
}

function updateUI() {
  const pad = n => String(n + 1).padStart(2, '0');
  if (currentEl) currentEl.textContent = pad(current);
  if (totalEl)   totalEl.textContent   = pad(images.length - 1);
  if (prevBtn)   prevBtn.classList.toggle('disabled', current === 0);
  if (nextBtn)   nextBtn.classList.toggle('disabled', current === images.length - 1);
}

// ── Grid view ──
function buildGrid() {
  if (gridInner.childElementCount > 0) return;
  images.forEach((img, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'gl-grid-thumb';
    thumb.setAttribute('tabindex', '0');
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('aria-label', lang === 'bg' ? img.alt_bg : img.alt_en);

    const el = document.createElement('img');
    el.src = img.src;
    el.alt = '';
    el.loading = 'lazy';

    thumb.appendChild(el);
    thumb.addEventListener('click', () => openFromGrid(i));
    thumb.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFromGrid(i); }
    });
    gridInner.appendChild(thumb);
  });
}

function openFromGrid(index) {
  goTo(index);
  closeGrid();
}

function openGrid() {
  buildGrid();
  isGridOpen = true;
  gridView.classList.add('open');
  gridView.setAttribute('aria-hidden', 'false');
  toggleBtn.setAttribute('aria-label', 'Back to gallery');
  toggleBtn.querySelector('.gl-view-icon--grid').style.opacity = '0.4';
}

function closeGrid() {
  isGridOpen = false;
  gridView.classList.remove('open');
  gridView.setAttribute('aria-hidden', 'true');
  toggleBtn.setAttribute('aria-label', 'Switch to grid view');
  toggleBtn.querySelector('.gl-view-icon--grid').style.opacity = '';
}

// ── Custom cursor ──
let cursorEl, dotEl, ringEl;
function initCursor() {
  cursorEl = document.createElement('div');
  cursorEl.className = 'gl-cursor';
  dotEl    = document.createElement('div');
  dotEl.className = 'gl-cursor-dot';
  ringEl   = document.createElement('div');
  ringEl.className = 'gl-cursor-ring';
  cursorEl.appendChild(ringEl);
  cursorEl.appendChild(dotEl);
  document.body.appendChild(cursorEl);

  let mx = -999, my = -999;
  let rx = -999, ry = -999;
  let raf;

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

  function tick() {
    const ease = 0.12;
    rx += (mx - rx) * ease;
    ry += (my - ry) * ease;
    cursorEl.style.left = mx + 'px';
    cursorEl.style.top  = my + 'px';
    ringEl.style.left   = (rx - mx) + 'px';
    ringEl.style.top    = (ry - my) + 'px';
    raf = requestAnimationFrame(tick);
  }
  tick();

  cinema.addEventListener('mouseenter', () => cursorEl.classList.remove('hidden'));
  cinema.addEventListener('mouseleave', () => cursorEl.classList.add('hidden'));

  prevBtn.addEventListener('mouseenter', () => cursorEl.classList.add('on-prev'));
  prevBtn.addEventListener('mouseleave', () => cursorEl.classList.remove('on-prev'));
  nextBtn.addEventListener('mouseenter', () => cursorEl.classList.add('on-next'));
  nextBtn.addEventListener('mouseleave', () => cursorEl.classList.remove('on-next'));
}

// ── Touch / swipe ──
let touchStartX = 0;
cinema.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
cinema.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) dx < 0 ? goTo(current + 1) : goTo(current - 1);
});

// ── Keyboard ──
document.addEventListener('keydown', e => {
  if (isGridOpen) { if (e.key === 'Escape') closeGrid(); return; }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(current + 1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goTo(current - 1);
});

// ── Wheel / trackpad horizontal scroll ──
let wheelTimeout;
cinema.addEventListener('wheel', e => {
  e.preventDefault();
  clearTimeout(wheelTimeout);
  wheelTimeout = setTimeout(() => {
    if (e.deltaX > 40 || e.deltaY > 40)  goTo(current + 1);
    if (e.deltaX < -40 || e.deltaY < -40) goTo(current - 1);
  }, 30);
}, { passive: false });

// ── Button events ──
prevBtn.addEventListener('click', () => goTo(current - 1));
nextBtn.addEventListener('click', () => goTo(current + 1));
toggleBtn.addEventListener('click', () => isGridOpen ? closeGrid() : openGrid());

// ── Lang change ──
document.addEventListener('langChange', e => {
  lang = e.detail.lang;
  track.querySelectorAll('.gl-slide img').forEach((img, i) => {
    img.alt = lang === 'bg' ? images[i].alt_bg : images[i].alt_en;
  });
  gridInner.querySelectorAll('.gl-grid-thumb').forEach((thumb, i) => {
    thumb.setAttribute('aria-label', lang === 'bg' ? images[i].alt_bg : images[i].alt_en);
  });
});

// ── Resize ──
window.addEventListener('resize', () => { positionTrack(); });

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  buildSlides();
  if (totalEl) totalEl.textContent = String(images.length).padStart(2, '0');
  updateUI();

  // Init cursor on non-touch devices
  if (window.matchMedia('(pointer: fine)').matches) initCursor();

  // Slight delay to allow image widths to load, then reposition
  setTimeout(positionTrack, 120);
});
