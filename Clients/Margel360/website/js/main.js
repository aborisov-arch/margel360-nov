// ── Nav scroll effect ──
const nav = document.querySelector('.nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 80);
  });
}

// ── Hamburger menu ──
const hamburger = document.querySelector('.hamburger');
const navDrawer = document.querySelector('.nav-drawer');
if (hamburger && navDrawer) {
  hamburger.addEventListener('click', () => {
    const isOpen = navDrawer.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
  });
  // Close drawer on link click
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
    if (t[key] !== undefined) {
      el.innerHTML = t[key];
    }
  });
  // Update toggle button text
  document.querySelectorAll('.lang-toggle').forEach(btn => {
    btn.textContent = lang === 'bg' ? 'EN' : 'BG';
  });
}

function toggleLang() {
  currentLang = currentLang === 'bg' ? 'en' : 'bg';
  localStorage.setItem(LANG_KEY, currentLang);
  applyTranslations(currentLang);
}

// Apply on load
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations(currentLang);
  document.querySelectorAll('.lang-toggle').forEach(btn => {
    btn.addEventListener('click', toggleLang);
  });
});
