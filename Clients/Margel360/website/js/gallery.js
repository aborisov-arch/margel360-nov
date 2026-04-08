// Real venue photos from margel360.bg
let photoAlt = localStorage.getItem('margel_lang') === 'en' ? 'Event photo' : 'Снимка от събитие';

const images = [
  { src: 'assets/images/event-evening.jpg'      },
  { src: 'assets/images/gallery-evening-1.jpg'  },
  { src: 'assets/images/gallery-evening-2.jpg'  },
  { src: 'assets/images/gallery-evening-3.jpg'  },
  { src: 'assets/images/gallery-evening-4.jpg'  },
  { src: 'assets/images/gallery-evening-5.jpg'  },
  { src: 'assets/images/event-wedding.jpg'      },
  { src: 'assets/images/gallery-wedding-1.jpg'  },
  { src: 'assets/images/event-birthday.jpg'     },
  { src: 'assets/images/gallery-birthday-1.jpg' },
  { src: 'assets/images/event-birthday-eve.jpg' },
  { src: 'assets/images/event-corporate.jpg'    },
  { src: 'assets/images/gallery-corporate-1.jpg'},
  { src: 'assets/images/gallery-1.jpg'          },
  { src: 'assets/images/gallery-2.jpg'          },
  { src: 'assets/images/gallery-3.jpg'          },
  { src: 'assets/images/gallery-4.jpg'          },
  { src: 'assets/images/gallery-5.jpg'          },
  { src: 'assets/images/gallery-6.jpg'          },
].map((img, i) => ({ ...img, get alt() { return `${photoAlt} ${i + 1}`; } }));

let currentIndex = 0;
let triggerElement = null;

const grid = document.getElementById('gallery-grid');
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lb-img');
const lbClose = document.getElementById('lb-close');
const lbPrev = document.getElementById('lb-prev');
const lbNext = document.getElementById('lb-next');

const focusableInLightbox = [lbClose, lbPrev, lbNext].filter(Boolean);

function openLightbox(index, trigger) {
  if (!lightbox || !lbImg || !lbClose) return;
  currentIndex = index;
  triggerElement = trigger || null;
  lbImg.src = images[currentIndex].src;
  lbImg.alt = images[currentIndex].alt;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  lbClose.focus();
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  if (lbImg) lbImg.src = '';
  if (triggerElement) { triggerElement.focus(); triggerElement = null; }
}

function showPrev() {
  if (!lbImg) return;
  currentIndex = (currentIndex - 1 + images.length) % images.length;
  lbImg.src = images[currentIndex].src;
  lbImg.alt = images[currentIndex].alt;
}

function showNext() {
  if (!lbImg) return;
  currentIndex = (currentIndex + 1) % images.length;
  lbImg.src = images[currentIndex].src;
  lbImg.alt = images[currentIndex].alt;
}

if (grid) {
  images.forEach((img, i) => {
    const item = document.createElement('div');
    item.className = 'gallery-item fade-up delay-' + ((i % 3) + 1);
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', img.alt);

    const el = document.createElement('img');
    el.src = img.src;
    el.alt = img.alt;
    el.loading = 'lazy';

    item.appendChild(el);
    item.addEventListener('click', () => openLightbox(i, item));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(i, item); }
    });
    grid.appendChild(item);
  });

  if (window._animObserver) {
    grid.querySelectorAll('.fade-up').forEach(el => window._animObserver.observe(el));
  }
}

if (lbClose) lbClose.addEventListener('click', closeLightbox);
if (lbPrev)  lbPrev.addEventListener('click', showPrev);
if (lbNext)  lbNext.addEventListener('click', showNext);
if (lightbox) {
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
}

document.addEventListener('keydown', e => {
  if (!lightbox || !lightbox.classList.contains('open')) return;
  if (e.key === 'Escape')     { closeLightbox(); return; }
  if (e.key === 'ArrowLeft')  { showPrev(); return; }
  if (e.key === 'ArrowRight') { showNext(); return; }
  if (e.key === 'Tab' && focusableInLightbox.length > 0) {
    const first = focusableInLightbox[0];
    const last  = focusableInLightbox[focusableInLightbox.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }
});

document.addEventListener('langChange', e => {
  photoAlt = e.detail.lang === 'en' ? 'Event photo' : 'Снимка от събитие';
  if (grid) {
    grid.querySelectorAll('.gallery-item').forEach((item, i) => {
      const alt = `${photoAlt} ${i + 1}`;
      item.setAttribute('aria-label', alt);
      const img = item.querySelector('img');
      if (img) img.alt = alt;
    });
  }
});
