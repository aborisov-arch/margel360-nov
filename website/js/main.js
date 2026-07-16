// ── Hero video mobile autoplay fix ──
(function() {
  const vid = document.querySelector('.hero-video');
  if (!vid) return;

  // Try to play immediately (may fail on mobile)
  const tryPlay = vid.play();
  if (tryPlay && tryPlay.catch) {
    tryPlay.catch(function() {
      // Autoplay blocked - retry on first user interaction
      function playOnInteraction() {
        vid.play();
        document.removeEventListener('touchstart', playOnInteraction);
        document.removeEventListener('scroll', playOnInteraction);
        document.removeEventListener('click', playOnInteraction);
      }
      document.addEventListener('touchstart', playOnInteraction, { once: true, passive: true });
      document.addEventListener('scroll', playOnInteraction, { once: true, passive: true });
      document.addEventListener('click', playOnInteraction, { once: true });
    });
  }
})();

// ── Nav scroll effect ──
const nav = document.querySelector('.nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });
}

// ── Hamburger menu ──
const hamburger = document.querySelector('.hamburger');
const navDrawer = document.querySelector('.nav-drawer');
if (hamburger && navDrawer) {
  hamburger.addEventListener('click', () => {
    const isOpen = navDrawer.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  navDrawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navDrawer.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

// ── Language toggle ──
const LANG_KEY = 'margel_lang';
let currentLang = localStorage.getItem(LANG_KEY) || 'bg';

function applyTranslations(lang) {
  if (typeof translations === 'undefined') return;
  const t = translations[lang];
  if (!t) return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.querySelectorAll('.lang-toggle').forEach(btn => {
    btn.textContent = lang === 'bg' ? 'EN' : 'BG';
  });
  document.dispatchEvent(new CustomEvent('langChange', { detail: { lang } }));
}

function toggleLang() {
  currentLang = currentLang === 'bg' ? 'en' : 'bg';
  localStorage.setItem(LANG_KEY, currentLang);
  applyTranslations(currentLang);
}

// ── Scroll-triggered fade-up animations ──
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  // Store observer for dynamically rendered content (index.js, gallery.js)
  window._animObserver = observer;

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

// ── Parallax on hero ──
function initParallax() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  window.addEventListener('scroll', () => {
    const offset = window.scrollY;
    hero.style.backgroundPositionY = `calc(50% + ${offset * 0.35}px)`;
  }, { passive: true });
}

// ── Animated number counters ──
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.getAttribute('data-count'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    let current = 0;
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current + suffix;
      if (current >= target) clearInterval(timer);
    }, 20);
  });
}

// Trigger counters when stats section becomes visible
function initCounters() {
  const statsSection = document.querySelector('.stats-section');
  if (!statsSection) return;
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      animateCounters();
      observer.disconnect();
    }
  }, { threshold: 0.4 });
  observer.observe(statsSection);
}

// ── Spotlight glow borders ──
// Port of the React spotlight-card pattern: track the pointer in viewport
// coordinates and expose it as --gx / --gy on the document root. Cards
// styled with .glow-border use a fixed-attachment radial-gradient masked
// to the border ring, so each card lights up the part of its edge nearest
// to the cursor. One listener, all cards - no per-element work.
function initGlowBorders() {
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
  const root = document.documentElement;
  let pending = false;
  let lastX = 0, lastY = 0;
  function flush() { root.style.setProperty('--gx', lastX + 'px'); root.style.setProperty('--gy', lastY + 'px'); pending = false; }
  window.addEventListener('pointermove', e => {
    lastX = e.clientX; lastY = e.clientY;
    if (!pending) { pending = true; requestAnimationFrame(flush); }
  }, { passive: true });
}

// ── Init on DOM ready ──
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations(currentLang);
  document.querySelectorAll('.lang-toggle').forEach(btn => {
    btn.addEventListener('click', toggleLang);
  });
  initAnimations();
  initParallax();
  initCounters();
  initGlowBorders();
});

// ── Weekday-promo bar ──
// Visible until 2026-08-31 incl. (campaign end - keep in sync with the
// weekday promo in reservation.js / submit-enquiry), dismissible per
// browser. Self-expires: after the date it simply never shows.
(function () {
  const bar = document.getElementById('promo-bar');
  if (!bar) return;
  const PROMO_BAR_LAST_DATE = '2026-08-31';
  let dismissed = false;
  try { dismissed = localStorage.getItem('margel_promo_bar') === 'dismissed'; } catch (e) {}
  const todayISO = new Date().toLocaleDateString('en-CA');
  if (dismissed || todayISO > PROMO_BAR_LAST_DATE) return;
  bar.hidden = false;
  document.body.classList.add('has-promo-bar');
  document.getElementById('promo-bar-close')?.addEventListener('click', () => {
    bar.hidden = true;
    document.body.classList.remove('has-promo-bar');
    try { localStorage.setItem('margel_promo_bar', 'dismissed'); } catch (e) {}
  });
})();
