// ── Images by category ──
const categories = [
  {
    id: 'evening',
    title_bg: 'Вечерни събития',
    title_en: 'Evening Events',
    images: [
      { src:'assets/images/gallery-evening-1.jpg', alt_bg:'Вечерно събитие', alt_en:'Evening event' },
      { src:'assets/images/gallery-evening-2.jpg', alt_bg:'Вечерно събитие', alt_en:'Evening event' },
      { src:'assets/images/gallery-evening-3.jpg', alt_bg:'Вечерно събитие', alt_en:'Evening event' },
      { src:'assets/images/gallery-1.jpg',         alt_bg:'Събитие',         alt_en:'Event' },
      { src:'assets/images/event-1.jpg',           alt_bg:'Събитие',         alt_en:'Event' },
    ],
  },
  {
    id: 'wedding',
    title_bg: 'Сватби',
    title_en: 'Weddings',
    images: [
      { src:'assets/images/event-wedding.jpg',     alt_bg:'Сватба',             alt_en:'Wedding' },
      { src:'assets/images/gallery-wedding-1.jpg', alt_bg:'Сватбено тържество', alt_en:'Wedding celebration' },
    ],
  },
  {
    id: 'birthday',
    title_bg: 'Рождени дни',
    title_en: 'Birthdays',
    images: [
      { src:'assets/images/event-birthday.jpg',     alt_bg:'Детски рожден ден', alt_en:"Children's birthday" },
      { src:'assets/images/event-birthday-eve.jpg', alt_bg:'Вечерен рожден ден', alt_en:'Evening birthday' },
      { src:'assets/images/gallery-birthday-1.jpg', alt_bg:'Рожден ден',         alt_en:'Birthday party' },
    ],
  },
  {
    id: 'corporate',
    title_bg: 'Корпоративни събития',
    title_en: 'Corporate Events',
    images: [
      { src:'assets/images/event-corporate.jpg',     alt_bg:'Корпоративно събитие', alt_en:'Corporate event' },
      { src:'assets/images/gallery-corporate-1.jpg', alt_bg:'Корпоративна среща',   alt_en:'Corporate meeting' },
    ],
  },
  {
    id: 'venue',
    title_bg: 'Зала Маргел 360°',
    title_en: 'Margel 360° Venue',
    images: [
      { src:'assets/images/about-venue.jpg', alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-1.jpg',     alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-2.jpg',     alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-3.jpg',     alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-4.jpg',     alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-5.jpg',     alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-6.jpg',     alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-7.jpg',     alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-8.jpg',     alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-9.jpg',     alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-10.jpg',    alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-11.jpg',    alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-12.jpg',    alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-13.jpg',    alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-14.jpg',    alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-15.jpg',    alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-16.jpg',    alt_bg:'Зала', alt_en:'Venue' },
      { src:'assets/images/venue-17.jpg',    alt_bg:'Зала', alt_en:'Venue' },
    ],
  },
];

// ── State ──
let lang = localStorage.getItem('margel_lang') || 'bg';
let lightboxCat   = 0;
let lightboxIndex = 0;

// ── Lightbox elements ──
const lightbox  = document.getElementById('gl-lightbox');
const lbImg     = document.getElementById('lb-img');
const lbCaption = document.getElementById('lb-caption');
const lbCounter = document.getElementById('lb-counter');
const lbClose   = document.getElementById('lb-close');
const lbPrev    = document.getElementById('lb-prev');
const lbNext    = document.getElementById('lb-next');

// ── Build gallery ──
function buildGallery() {
  const wrap = document.getElementById('gl-gallery-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  categories.forEach((cat, catIdx) => {
    // Section
    const section = document.createElement('div');
    section.className = 'gl-category-section';

    // Big heading
    const heading = document.createElement('h2');
    heading.className = 'gl-category-title';
    heading.textContent = lang === 'bg' ? cat.title_bg : cat.title_en;
    section.appendChild(heading);

    // Horizontal strip
    const strip = document.createElement('div');
    strip.className = 'gl-strip';

    cat.images.forEach((img, imgIdx) => {
      const item = document.createElement('div');
      item.className = 'gl-item';

      const el = document.createElement('img');
      el.src = img.src;
      el.alt = lang === 'bg' ? img.alt_bg : img.alt_en;
      el.loading = imgIdx < 4 ? 'eager' : 'lazy';

      item.appendChild(el);
      item.addEventListener('click', () => openLightbox(catIdx, imgIdx));
      strip.appendChild(item);
    });

    section.appendChild(strip);
    wrap.appendChild(section);
  });
}

// ── Lightbox ──
function openLightbox(catIdx, imgIdx) {
  lightboxCat   = catIdx;
  lightboxIndex = imgIdx;
  updateLightbox();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function updateLightbox() {
  const cat = categories[lightboxCat];
  const img = cat.images[lightboxIndex];
  if (!img) return;
  lbImg.src     = img.src;
  lbImg.alt     = lang === 'bg' ? img.alt_bg : img.alt_en;
  if (lbCaption) lbCaption.textContent = lang === 'bg' ? cat.title_bg : cat.title_en;
  if (lbCounter) lbCounter.textContent = (lightboxIndex + 1) + ' / ' + cat.images.length;
  if (lbPrev) lbPrev.classList.toggle('disabled', lightboxIndex === 0);
  if (lbNext) lbNext.classList.toggle('disabled', lightboxIndex === cat.images.length - 1);
}

if (lbClose) lbClose.addEventListener('click', closeLightbox);
if (lightbox) lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

if (lbPrev) lbPrev.addEventListener('click', () => {
  if (lightboxIndex > 0) { lightboxIndex--; updateLightbox(); }
});
if (lbNext) lbNext.addEventListener('click', () => {
  if (lightboxIndex < categories[lightboxCat].images.length - 1) { lightboxIndex++; updateLightbox(); }
});

// ── Keyboard ──
document.addEventListener('keydown', e => {
  if (!lightbox?.classList.contains('open')) return;
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === 'ArrowRight' && lightboxIndex < categories[lightboxCat].images.length - 1) { lightboxIndex++; updateLightbox(); }
  if (e.key === 'ArrowLeft'  && lightboxIndex > 0) { lightboxIndex--; updateLightbox(); }
});

// ── Touch swipe ──
let lbTouchX = 0;
if (lightbox) {
  lightbox.addEventListener('touchstart', e => { lbTouchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - lbTouchX;
    if (dx < -50 && lightboxIndex < categories[lightboxCat].images.length - 1) { lightboxIndex++; updateLightbox(); }
    if (dx > 50  && lightboxIndex > 0) { lightboxIndex--; updateLightbox(); }
  });
}

// ── Lang change ──
document.addEventListener('langChange', e => {
  lang = e.detail.lang;
  buildGallery();
});

// ── Init ──
document.addEventListener('DOMContentLoaded', buildGallery);
