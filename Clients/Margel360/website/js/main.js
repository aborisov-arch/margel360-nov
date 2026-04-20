// ── Hero video mobile autoplay fix ──
(function() {
  const vid = document.querySelector('.hero-video');
  if (!vid) return;

  // Try to play immediately (may fail on mobile)
  const tryPlay = vid.play();
  if (tryPlay && tryPlay.catch) {
    tryPlay.catch(function() {
      // Autoplay blocked — retry on first user interaction
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

// ── Init on DOM ready ──
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations(currentLang);
  document.querySelectorAll('.lang-toggle').forEach(btn => {
    btn.addEventListener('click', toggleLang);
  });
  initAnimations();
  initParallax();
  initCounters();
});
