// 12 placeholder images for demo
const images = Array.from({ length: 12 }, (_, i) => ({
  src: 'assets/images/placeholder.jpg',
  alt: `Event photo ${i + 1}`
}));

let currentIndex = 0;

const grid = document.getElementById('gallery-grid');
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lb-img');
const lbClose = document.getElementById('lb-close');
const lbPrev = document.getElementById('lb-prev');
const lbNext = document.getElementById('lb-next');

function openLightbox(index) {
  currentIndex = index;
  lbImg.src = images[currentIndex].src;
  lbImg.alt = images[currentIndex].alt;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  lbClose.focus();
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function showPrev() {
  currentIndex = (currentIndex - 1 + images.length) % images.length;
  lbImg.src = images[currentIndex].src;
  lbImg.alt = images[currentIndex].alt;
}

function showNext() {
  currentIndex = (currentIndex + 1) % images.length;
  lbImg.src = images[currentIndex].src;
  lbImg.alt = images[currentIndex].alt;
}

// Render gallery grid
if (grid) {
  images.forEach((img, i) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', img.alt);

    const el = document.createElement('img');
    el.src = img.src;
    el.alt = img.alt;
    el.loading = 'lazy';

    item.appendChild(el);
    item.addEventListener('click', () => openLightbox(i));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(i); }
    });
    grid.appendChild(item);
  });
}

// Lightbox controls
if (lbClose) lbClose.addEventListener('click', closeLightbox);
if (lbPrev) lbPrev.addEventListener('click', showPrev);
if (lbNext) lbNext.addEventListener('click', showNext);
if (lightbox) {
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
}

document.addEventListener('keydown', e => {
  if (!lightbox || !lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') showPrev();
  if (e.key === 'ArrowRight') showNext();
});
