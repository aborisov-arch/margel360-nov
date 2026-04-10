// ── All images organised by category ──
const allImages = [
  // Вечерни / Evening
  { src:'assets/images/event-evening.jpg',       cat:'evening', alt_bg:'Вечерно събитие', alt_en:'Evening event' },
  { src:'assets/images/gallery-evening-1.jpg',   cat:'evening', alt_bg:'Вечерно събитие', alt_en:'Evening event' },
  { src:'assets/images/gallery-evening-2.jpg',   cat:'evening', alt_bg:'Вечерно събитие', alt_en:'Evening event' },
  { src:'assets/images/gallery-evening-3.jpg',   cat:'evening', alt_bg:'Вечерно събитие', alt_en:'Evening event' },
  { src:'assets/images/gallery-evening-4.jpg',   cat:'evening', alt_bg:'Вечерно събитие', alt_en:'Evening event' },
  { src:'assets/images/gallery-evening-5.jpg',   cat:'evening', alt_bg:'Вечерно събитие', alt_en:'Evening event' },
  { src:'assets/images/gallery-1.jpg',           cat:'evening', alt_bg:'Събитие',          alt_en:'Event' },
  { src:'assets/images/gallery-2.jpg',           cat:'evening', alt_bg:'Събитие',          alt_en:'Event' },
  { src:'assets/images/gallery-3.jpg',           cat:'evening', alt_bg:'Събитие',          alt_en:'Event' },
  { src:'assets/images/gallery-4.jpg',           cat:'evening', alt_bg:'Събитие',          alt_en:'Event' },
  { src:'assets/images/gallery-5.jpg',           cat:'evening', alt_bg:'Събитие',          alt_en:'Event' },
  { src:'assets/images/gallery-6.jpg',           cat:'evening', alt_bg:'Събитие',          alt_en:'Event' },
  { src:'assets/images/event-1.jpg',             cat:'evening', alt_bg:'Събитие',          alt_en:'Event' },
  { src:'assets/images/event-2.jpg',             cat:'evening', alt_bg:'Събитие',          alt_en:'Event' },
  // Сватба / Wedding
  { src:'assets/images/event-wedding.jpg',       cat:'wedding', alt_bg:'Сватба',           alt_en:'Wedding' },
  { src:'assets/images/gallery-wedding-1.jpg',   cat:'wedding', alt_bg:'Сватбено тържество', alt_en:'Wedding celebration' },
  // Детски / Birthday
  { src:'assets/images/event-birthday.jpg',      cat:'birthday', alt_bg:'Детски рожден ден', alt_en:"Children's birthday" },
  { src:'assets/images/event-birthday-eve.jpg',  cat:'birthday', alt_bg:'Вечерен рожден ден', alt_en:'Evening birthday' },
  { src:'assets/images/gallery-birthday-1.jpg',  cat:'birthday', alt_bg:'Рожден ден',        alt_en:'Birthday party' },
  // Корпоративни / Corporate
  { src:'assets/images/event-corporate.jpg',     cat:'corporate', alt_bg:'Корпоративно събитие', alt_en:'Corporate event' },
  { src:'assets/images/gallery-corporate-1.jpg', cat:'corporate', alt_bg:'Корпоративна среща',   alt_en:'Corporate meeting' },
  // Зала / Venue
  { src:'assets/images/about-venue.jpg',         cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-1.jpg',             cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-2.jpg',             cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-3.jpg',             cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-4.jpg',             cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-5.jpg',             cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-6.jpg',             cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-7.jpg',             cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-8.jpg',             cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-9.jpg',             cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-10.jpg',            cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-11.jpg',            cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-12.jpg',            cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-13.jpg',            cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-14.jpg',            cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-15.jpg',            cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-16.jpg',            cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
  { src:'assets/images/venue-17.jpg',            cat:'venue', alt_bg:'Зала Маргел 360°',   alt_en:'Margel 360° venue' },
];

const categories = {
  bg: [
    { id:'all',       label:'Всички' },
    { id:'evening',   label:'Вечерни' },
    { id:'wedding',   label:'Сватба' },
    { id:'birthday',  label:'Детски' },
    { id:'corporate', label:'Корпоративни' },
    { id:'venue',     label:'Зала' },
  ],
  en: [
    { id:'all',       label:'All' },
    { id:'evening',   label:'Evening' },
    { id:'wedding',   label:'Wedding' },
    { id:'birthday',  label:'Birthday' },
    { id:'corporate', label:'Corporate' },
    { id:'venue',     label:'Venue' },
  ],
};

// ── State ──
let activeFilter = 'all';
let lang = localStorage.getItem('margel_lang') || 'bg';
let lightboxIndex = -1;
let filteredImages = [];

// ── Elements ──
const filterBar  = document.getElementById('gl-filter-bar');
const gridInner  = document.getElementById('gl-grid-inner');
const lightbox   = document.getElementById('gl-lightbox');
const lbImg      = document.getElementById('lb-img');
const lbCaption  = document.getElementById('lb-caption');
const lbCounter  = document.getElementById('lb-counter');
const lbClose    = document.getElementById('lb-close');
const lbPrev     = document.getElementById('lb-prev');
const lbNext     = document.getElementById('lb-next');

// ── Filter bar ──
function buildFilterBar() {
  if (!filterBar) return;
  filterBar.innerHTML = '';
  categories[lang].forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'gl-filter-btn' + (cat.id === activeFilter ? ' active' : '');
    btn.textContent = cat.label;
    btn.dataset.cat = cat.id;
    btn.addEventListener('click', () => setFilter(cat.id));
    filterBar.appendChild(btn);
  });
}

function setFilter(catId) {
  activeFilter = catId;
  buildFilterBar();
  renderGrid();
}

// ── Grid ──
function renderGrid() {
  if (!gridInner) return;
  filteredImages = activeFilter === 'all'
    ? allImages
    : allImages.filter(img => img.cat === activeFilter);

  // Animate out
  gridInner.querySelectorAll('.gl-thumb').forEach(el => el.classList.add('fade-out'));

  setTimeout(() => {
    gridInner.innerHTML = '';
    filteredImages.forEach((img, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'gl-thumb';

      const el = document.createElement('img');
      el.src = img.src;
      el.alt = lang === 'bg' ? img.alt_bg : img.alt_en;
      el.loading = 'lazy';

      const overlay = document.createElement('div');
      overlay.className = 'gl-thumb-overlay';
      const icon = document.createElement('span');
      icon.className = 'gl-thumb-zoom';
      icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
      overlay.appendChild(icon);

      thumb.appendChild(el);
      thumb.appendChild(overlay);
      thumb.addEventListener('click', () => openLightbox(i));
      gridInner.appendChild(thumb);
    });
  }, 150);
}

// ── Lightbox ──
function openLightbox(index) {
  lightboxIndex = index;
  showLightboxImage();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function showLightboxImage() {
  const img = filteredImages[lightboxIndex];
  if (!img || !lbImg) return;
  lbImg.src = img.src;
  lbImg.alt = lang === 'bg' ? img.alt_bg : img.alt_en;
  if (lbCaption) lbCaption.textContent = lang === 'bg' ? img.alt_bg : img.alt_en;
  if (lbCounter) lbCounter.textContent = (lightboxIndex + 1) + ' / ' + filteredImages.length;
  if (lbPrev) lbPrev.classList.toggle('disabled', lightboxIndex === 0);
  if (lbNext) lbNext.classList.toggle('disabled', lightboxIndex === filteredImages.length - 1);
}

if (lbClose) lbClose.addEventListener('click', closeLightbox);
if (lbPrev)  lbPrev.addEventListener('click', () => { if (lightboxIndex > 0) { lightboxIndex--; showLightboxImage(); } });
if (lbNext)  lbNext.addEventListener('click', () => { if (lightboxIndex < filteredImages.length - 1) { lightboxIndex++; showLightboxImage(); } });

if (lightbox) {
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
}

// ── Keyboard ──
document.addEventListener('keydown', e => {
  if (!lightbox?.classList.contains('open')) return;
  if (e.key === 'Escape')      closeLightbox();
  if (e.key === 'ArrowRight')  { if (lightboxIndex < filteredImages.length - 1) { lightboxIndex++; showLightboxImage(); } }
  if (e.key === 'ArrowLeft')   { if (lightboxIndex > 0) { lightboxIndex--; showLightboxImage(); } }
});

// ── Touch swipe on lightbox ──
let lbTouchX = 0;
if (lightbox) {
  lightbox.addEventListener('touchstart', e => { lbTouchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - lbTouchX;
    if (dx < -50 && lightboxIndex < filteredImages.length - 1) { lightboxIndex++; showLightboxImage(); }
    if (dx > 50  && lightboxIndex > 0) { lightboxIndex--; showLightboxImage(); }
  });
}

// ── Lang change ──
document.addEventListener('langChange', e => {
  lang = e.detail.lang;
  buildFilterBar();
  renderGrid();
});

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  buildFilterBar();
  renderGrid();
});
