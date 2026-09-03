// ── Hero video: load + play only when appropriate ──
// index.html ships the <video> without autoplay and with preload="none",
// so nothing downloads until this block decides. Data-saver, 2G and
// reduced-motion visitors keep the poster image.
(function() {
  const vid = document.querySelector('.hero-video');
  if (!vid) return;
  const conn = navigator.connection || {};
  const skipVideo = conn.saveData === true ||
    /(^|-)2g$/.test(conn.effectiveType || '') ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (skipVideo) return;
  vid.preload = 'auto';

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
// ?lang=en|bg deep links (the hreflang alternates point here) beat the
// stored preference and persist it for the rest of the visit.
const LANG_KEY = 'margel_lang';
const urlLang = (function () {
  try {
    const v = new URLSearchParams(window.location.search).get('lang');
    return v === 'en' || v === 'bg' ? v : null;
  } catch (e) { return null; }
})();
if (urlLang) { try { localStorage.setItem(LANG_KEY, urlLang); } catch (e) {} }
let currentLang = urlLang || localStorage.getItem(LANG_KEY) || 'bg';

// Keep URL + head metadata in agreement with the active language: the
// ?lang=en variant self-identifies (canonical, og:locale) so crawlers can
// index the EN rendering; bg stays the bare canonical URL.
function syncLangHead(lang) {
  try {
    const url = new URL(window.location.href);
    if (lang === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    const qs = url.searchParams.toString();
    history.replaceState(null, '', url.pathname + (qs ? '?' + qs : '') + url.hash);
  } catch (e) { /* URL/History quirks must never break the page */ }
  try {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      const cu = new URL(canonical.getAttribute('href'), window.location.origin);
      if (lang === 'en') cu.searchParams.set('lang', 'en');
      else cu.searchParams.delete('lang');
      canonical.setAttribute('href', cu.toString());
    }
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.setAttribute('content', lang === 'en' ? 'en_US' : 'bg_BG');
  } catch (e) { /* best-effort */ }
}

function applyTranslations(lang) {
  document.documentElement.lang = lang;
  syncLangHead(lang);
  // Skip links exist on every public page but not in the per-page
  // dictionaries - label them here (same approach as the toggle buttons).
  document.querySelectorAll('.skip-link').forEach(el => {
    el.textContent = lang === 'bg' ? 'Към съдържанието' : 'Skip to content';
  });
  if (typeof translations === 'undefined') return;
  const t = translations[lang];
  if (!t) return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.querySelectorAll('.lang-toggle').forEach(btn => {
    // The accessible name must contain the visible text (WCAG 2.5.3).
    btn.textContent = lang === 'bg' ? 'EN' : 'BG';
    btn.setAttribute('aria-label', lang === 'bg' ? 'EN – switch to English' : 'БГ – превключване на български');
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


// ── Title/description language swap ──
// Crawlers always see the BG defaults (this runs client-side only); for
// human EN visitors the tab title and share preview text follow the toggle.
// EN values live in data-en attributes on <title> and the description meta.
(function () {
  const titleEl = document.querySelector('title');
  const descEl = document.querySelector('meta[name="description"]');
  if (titleEl && titleEl.dataset.en && !titleEl.dataset.bg) titleEl.dataset.bg = titleEl.textContent;
  if (descEl && descEl.dataset.en && !descEl.dataset.bg) descEl.dataset.bg = descEl.getAttribute('content') || '';
  const apply = () => {
    let lang = 'bg';
    try { lang = localStorage.getItem('margel_lang') || 'bg'; } catch (e) {}
    if (titleEl && titleEl.dataset.en) document.title = lang === 'bg' ? titleEl.dataset.bg : titleEl.dataset.en;
    if (descEl && descEl.dataset.en) descEl.setAttribute('content', lang === 'bg' ? descEl.dataset.bg : descEl.dataset.en);
  };
  apply();
  document.addEventListener('langChange', apply);
})();
