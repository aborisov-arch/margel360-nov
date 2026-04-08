# Margel 360° Website Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modernized 6-page static HTML/CSS/JS website for the Margel 360° event venue as a client demo.

**Architecture:** Multi-page static site. Shared `style.css` and `main.js` loaded by every page. Per-page `translations.js` holds BG/EN string objects; `main.js` reads `localStorage` for language preference and swaps all `data-i18n` elements on load and on toggle click.

**Tech Stack:** Plain HTML5, CSS3 (custom properties, CSS Grid, Flexbox), vanilla JavaScript (ES6). No frameworks, no build tools. Deploy via Netlify drag & drop.

---

## File Map

```
Clients/Margel360/website/
├── index.html
├── gallery.html
├── faq.html
├── services.html
├── contact.html
├── reservation.html
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   └── translations.js      ← one file per page (same name, different content per page)
└── assets/
    └── images/
        └── placeholder.jpg  ← single placeholder used across demo
```

---

## Task 1: Project Scaffold + CSS Foundations

**Files:**
- Create: `Clients/Margel360/website/css/style.css`
- Create: `Clients/Margel360/website/assets/images/placeholder.jpg` (download a free dark placeholder)

- [ ] **Step 1: Create folder structure**

```bash
mkdir -p "Clients/Margel360/website/css"
mkdir -p "Clients/Margel360/website/js"
mkdir -p "Clients/Margel360/website/assets/images"
```

- [ ] **Step 2: Create `css/style.css` with CSS variables, reset, and base typography**

```css
/* ── Variables ── */
:root {
  --bg: #0f0f0f;
  --bg-2: #1a1a1a;
  --text: #ffffff;
  --text-muted: #aaaaaa;
  --accent: #e63030;
  --accent-hover: #c42020;
  --font: 'Inter', Arial, sans-serif;
  --radius: 8px;
  --nav-height: 70px;
  --section-pad: 80px;
  --max-width: 1200px;
  --transition: 0.2s ease;
}

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 16px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
img { display: block; max-width: 100%; }
a { color: inherit; text-decoration: none; }
ul { list-style: none; }
button { cursor: pointer; font-family: var(--font); }

/* ── Typography ── */
h1 { font-size: clamp(2rem, 5vw, 4rem); font-weight: 800; line-height: 1.1; }
h2 { font-size: clamp(1.5rem, 3vw, 2.5rem); font-weight: 700; line-height: 1.2; }
h3 { font-size: 1.25rem; font-weight: 600; }
p { color: var(--text-muted); }

/* ── Layout helpers ── */
.container { max-width: var(--max-width); margin: 0 auto; padding: 0 24px; }
.section { padding: var(--section-pad) 0; }
.section-title { text-align: center; margin-bottom: 48px; }
.section-title p { margin-top: 12px; font-size: 1.1rem; }

/* ── Buttons ── */
.btn {
  display: inline-block;
  padding: 14px 32px;
  border-radius: var(--radius);
  font-size: 1rem;
  font-weight: 600;
  transition: background var(--transition), transform var(--transition);
  border: none;
}
.btn-primary {
  background: var(--accent);
  color: #fff;
}
.btn-primary:hover { background: var(--accent-hover); transform: translateY(-2px); }
.btn-outline {
  background: transparent;
  color: #fff;
  border: 2px solid #fff;
}
.btn-outline:hover { background: #fff; color: var(--bg); }
```

- [ ] **Step 3: Download a free dark placeholder image**

Run in terminal:
```bash
curl -o "Clients/Margel360/website/assets/images/placeholder.jpg" \
  "https://picsum.photos/seed/margel/1200/800"
```
Expected: file saved at `assets/images/placeholder.jpg`

- [ ] **Step 4: Commit**

```bash
git add "Clients/Margel360/website/css/style.css" "Clients/Margel360/website/assets/"
git commit -m "feat(margel360): scaffold CSS foundations and placeholder image"
```

---

## Task 2: Shared Nav + Footer Styles

**Files:**
- Modify: `Clients/Margel360/website/css/style.css`

- [ ] **Step 1: Add nav styles to `style.css`**

Append to `style.css`:

```css
/* ── Nav ── */
.nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--nav-height);
  display: flex;
  align-items: center;
  z-index: 100;
  transition: background var(--transition), box-shadow var(--transition);
}
.nav.scrolled {
  background: #111;
  box-shadow: 0 2px 20px rgba(0,0,0,0.5);
}
.nav .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.nav-logo {
  font-size: 1.4rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.5px;
}
.nav-logo span { color: var(--accent); }
.nav-links {
  display: flex;
  gap: 32px;
  align-items: center;
}
.nav-links a {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-muted);
  transition: color var(--transition);
}
.nav-links a:hover,
.nav-links a.active { color: #fff; }
.nav-links a.active { border-bottom: 2px solid var(--accent); padding-bottom: 2px; }

/* Lang toggle */
.lang-toggle {
  background: transparent;
  border: 1px solid var(--text-muted);
  color: var(--text-muted);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  transition: border-color var(--transition), color var(--transition);
}
.lang-toggle:hover { border-color: #fff; color: #fff; }

/* Hamburger */
.hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  padding: 4px;
}
.hamburger span {
  display: block;
  width: 24px;
  height: 2px;
  background: #fff;
  transition: transform var(--transition), opacity var(--transition);
}

/* Mobile nav drawer */
.nav-drawer {
  display: none;
  position: fixed;
  top: var(--nav-height);
  left: 0; right: 0;
  background: #111;
  padding: 24px;
  z-index: 99;
  flex-direction: column;
  gap: 20px;
}
.nav-drawer.open { display: flex; }
.nav-drawer a { font-size: 1.1rem; color: var(--text-muted); }
.nav-drawer a.active,
.nav-drawer a:hover { color: #fff; }

@media (max-width: 768px) {
  .nav-links { display: none; }
  .hamburger { display: flex; }
}
```

- [ ] **Step 2: Add footer styles to `style.css`**

Append to `style.css`:

```css
/* ── Footer ── */
.footer {
  background: #111;
  border-top: 1px solid #222;
  padding: 48px 0 24px;
}
.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 40px;
  margin-bottom: 40px;
}
.footer-brand p { color: var(--text-muted); margin-top: 12px; font-size: 0.95rem; max-width: 280px; }
.footer h4 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 16px; }
.footer-links { display: flex; flex-direction: column; gap: 10px; }
.footer-links a { color: var(--text-muted); font-size: 0.95rem; transition: color var(--transition); }
.footer-links a:hover { color: #fff; }
.footer-contact p { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 8px; }
.social-links { display: flex; gap: 16px; margin-top: 8px; }
.social-links a {
  width: 36px; height: 36px;
  border: 1px solid #333;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  transition: border-color var(--transition), color var(--transition);
}
.social-links a:hover { border-color: var(--accent); color: var(--accent); }
.footer-bottom {
  border-top: 1px solid #222;
  padding-top: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .footer-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Commit**

```bash
git add "Clients/Margel360/website/css/style.css"
git commit -m "feat(margel360): add nav and footer styles"
```

---

## Task 3: `main.js` — Nav Scroll, Hamburger, Language Toggle

**Files:**
- Create: `Clients/Margel360/website/js/main.js`

- [ ] **Step 1: Create `js/main.js`**

```javascript
// ── Nav scroll effect ──
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 80);
});

// ── Hamburger menu ──
const hamburger = document.querySelector('.hamburger');
const navDrawer = document.querySelector('.nav-drawer');
if (hamburger && navDrawer) {
  hamburger.addEventListener('click', () => {
    navDrawer.classList.toggle('open');
  });
  // Close drawer on link click
  navDrawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => navDrawer.classList.remove('open'));
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
  const btn = document.querySelector('.lang-toggle');
  if (btn) btn.textContent = lang === 'bg' ? 'EN' : 'BG';
}

function toggleLang() {
  currentLang = currentLang === 'bg' ? 'en' : 'bg';
  localStorage.setItem(LANG_KEY, currentLang);
  applyTranslations(currentLang);
}

// Apply on load
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations(currentLang);
  const btn = document.querySelector('.lang-toggle');
  if (btn) btn.addEventListener('click', toggleLang);
});
```

- [ ] **Step 2: Commit**

```bash
git add "Clients/Margel360/website/js/main.js"
git commit -m "feat(margel360): add nav scroll, hamburger, and language toggle logic"
```

---

## Task 4: `index.html` — Page Shell + Nav + Footer

**Files:**
- Create: `Clients/Margel360/website/index.html`
- Create: `Clients/Margel360/website/js/translations.js` (for index page)

- [ ] **Step 1: Create `index.html` with full shell**

```html
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Маргел 360° — Зала за всяко събитие</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>

  <!-- NAV -->
  <nav class="nav">
    <div class="container">
      <a href="index.html" class="nav-logo">МАРГЕЛ <span>360°</span></a>
      <ul class="nav-links">
        <li><a href="index.html" class="active" data-i18n="nav_home">Тип събитие</a></li>
        <li><a href="gallery.html" data-i18n="nav_gallery">Галерия</a></li>
        <li><a href="faq.html" data-i18n="nav_faq">FAQ</a></li>
        <li><a href="services.html" data-i18n="nav_services">Услуги</a></li>
        <li><a href="contact.html" data-i18n="nav_contact">Контакти</a></li>
        <li><a href="reservation.html" class="btn btn-primary" style="padding:8px 20px" data-i18n="nav_reserve">Запитване</a></li>
        <li><button class="lang-toggle">EN</button></li>
      </ul>
      <button class="hamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>

  <!-- MOBILE DRAWER -->
  <div class="nav-drawer">
    <a href="index.html" class="active" data-i18n="nav_home">Тип събитие</a>
    <a href="gallery.html" data-i18n="nav_gallery">Галерия</a>
    <a href="faq.html" data-i18n="nav_faq">FAQ</a>
    <a href="services.html" data-i18n="nav_services">Услуги</a>
    <a href="contact.html" data-i18n="nav_contact">Контакти</a>
    <a href="reservation.html" data-i18n="nav_reserve">Запитване</a>
    <button class="lang-toggle">EN</button>
  </div>

  <main>
    <!-- HERO -->
    <section class="hero">
      <div class="hero-overlay"></div>
      <div class="hero-content container">
        <h1 data-i18n="hero_title">Зала за всяко събитие</h1>
        <p data-i18n="hero_sub">Наслади се на всеки повод в Маргел 360°</p>
        <a href="reservation.html" class="btn btn-primary" data-i18n="hero_cta">Направете запитване</a>
      </div>
    </section>

    <!-- EVENT TYPES -->
    <section class="section events-section">
      <div class="container">
        <div class="section-title">
          <h2 data-i18n="events_title">Избери събитие</h2>
        </div>
        <div class="events-grid" id="events-grid"></div>
      </div>
    </section>

    <!-- ABOUT -->
    <section class="section about-section">
      <div class="container about-grid">
        <div class="about-text">
          <h2 data-i18n="about_title">МАРГЕЛ 360°</h2>
          <p data-i18n="about_body">Непрекъснато се занимаваме и интересуваме от това, залата да е максимално оборудвана, за да посрещне всяко събитие. Тя е оборудвана в съответствие с изискванията и различните пространства за всякакви фирмени или лични тържества — от бляскав рожден ден и сватба до корпоративни събирания.</p>
          <p style="margin-top:16px" data-i18n="about_body2">Залата работи в 360° в промоция на тържества — Вие я посещавате за Вие, Вашите гости и Вашето парти, осигурявайки им двадесет и четири часа на ден.</p>
        </div>
        <div class="about-image">
          <img src="assets/images/placeholder.jpg" alt="Маргел 360° зала">
        </div>
      </div>
    </section>

    <!-- EQUIPMENT -->
    <section class="section equipment-section">
      <div class="container">
        <div class="section-title">
          <h2 data-i18n="equip_title">Оборудване на залата</h2>
          <p data-i18n="equip_sub">Залата разполага с всичко необходимо за вашето събитие.</p>
        </div>
        <div class="equip-grid" id="equip-grid"></div>
        <div style="text-align:center;margin-top:40px">
          <a href="reservation.html" class="btn btn-primary" data-i18n="equip_cta">Направете запитване</a>
        </div>
      </div>
    </section>

    <!-- PHOTO TEASER -->
    <section class="section photos-section">
      <div class="container">
        <div class="section-title">
          <h2 data-i18n="photos_title">Снимки от изминали събития</h2>
        </div>
        <div class="photos-grid">
          <img src="assets/images/placeholder.jpg" alt="">
          <img src="assets/images/placeholder.jpg" alt="">
          <img src="assets/images/placeholder.jpg" alt="">
          <img src="assets/images/placeholder.jpg" alt="">
          <img src="assets/images/placeholder.jpg" alt="">
          <img src="assets/images/placeholder.jpg" alt="">
        </div>
        <div style="text-align:center;margin-top:32px">
          <a href="gallery.html" class="btn btn-outline" data-i18n="photos_cta">Виж всички снимки</a>
        </div>
      </div>
    </section>
  </main>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="nav-logo">МАРГЕЛ <span>360°</span></div>
          <p data-i18n="footer_desc">Зала за всяко събитие в сърцето на Враца.</p>
        </div>
        <div>
          <h4 data-i18n="footer_nav">Навигация</h4>
          <ul class="footer-links">
            <li><a href="index.html" data-i18n="nav_home">Тип събитие</a></li>
            <li><a href="gallery.html" data-i18n="nav_gallery">Галерия</a></li>
            <li><a href="faq.html" data-i18n="nav_faq">FAQ</a></li>
            <li><a href="services.html" data-i18n="nav_services">Услуги</a></li>
            <li><a href="contact.html" data-i18n="nav_contact">Контакти</a></li>
          </ul>
        </div>
        <div class="footer-contact">
          <h4 data-i18n="footer_contact">Контакти</h4>
          <p>📞 0888 10 09 42</p>
          <p data-i18n="footer_address">гр. Враца, България</p>
          <div class="social-links">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">in</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p data-i18n="footer_copy">© 2024 Маргел 360°. Всички права запазени.</p>
      </div>
    </div>
  </footer>

  <script src="js/translations.js"></script>
  <script src="js/main.js"></script>
  <script src="js/index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `js/translations.js` for index page**

```javascript
// translations.js — index page
const translations = {
  bg: {
    nav_home: 'Тип събитие',
    nav_gallery: 'Галерия',
    nav_faq: 'FAQ',
    nav_services: 'Услуги',
    nav_contact: 'Контакти',
    nav_reserve: 'Запитване',
    hero_title: 'Зала за всяко събитие',
    hero_sub: 'Наслади се на всеки повод в Маргел 360°',
    hero_cta: 'Направете запитване',
    events_title: 'Избери събитие',
    about_title: 'МАРГЕЛ 360°',
    about_body: 'Непрекъснато се занимаваме и интересуваме от това, залата да е максимално оборудвана, за да посрещне всяко събитие.',
    about_body2: 'Залата работи в 360° в промоция на тържества — Вие я посещавате за Вие, Вашите гости и Вашето парти.',
    equip_title: 'Оборудване на залата',
    equip_sub: 'Залата разполага с всичко необходимо за вашето събитие.',
    equip_cta: 'Направете запитване',
    photos_title: 'Снимки от изминали събития',
    photos_cta: 'Виж всички снимки',
    footer_desc: 'Зала за всяко събитие в сърцето на Враца.',
    footer_nav: 'Навигация',
    footer_contact: 'Контакти',
    footer_address: 'гр. Враца, България',
    footer_copy: '© 2024 Маргел 360°. Всички права запазени.',
  },
  en: {
    nav_home: 'Event Types',
    nav_gallery: 'Gallery',
    nav_faq: 'FAQ',
    nav_services: 'Services',
    nav_contact: 'Contacts',
    nav_reserve: 'Enquiry',
    hero_title: 'A Venue for Every Occasion',
    hero_sub: 'Enjoy every celebration at Margel 360°',
    hero_cta: 'Make an Enquiry',
    events_title: 'Choose Your Event',
    about_title: 'MARGEL 360°',
    about_body: 'We continuously work to keep the venue fully equipped to host any event.',
    about_body2: 'The venue operates 360° promoting celebrations — for you, your guests and your party.',
    equip_title: 'Venue Equipment',
    equip_sub: 'The venue has everything you need for your event.',
    equip_cta: 'Make an Enquiry',
    photos_title: 'Photos from Past Events',
    photos_cta: 'View All Photos',
    footer_desc: 'A venue for every occasion in the heart of Vratsa.',
    footer_nav: 'Navigation',
    footer_contact: 'Contact',
    footer_address: 'Vratsa, Bulgaria',
    footer_copy: '© 2024 Margel 360°. All rights reserved.',
  }
};
```

- [ ] **Step 3: Verify in browser**

Open `Clients/Margel360/website/index.html` in a browser. Expected: page loads with dark background, nav bar visible, no console errors. Language toggle button shows "EN".

- [ ] **Step 4: Commit**

```bash
git add "Clients/Margel360/website/index.html" "Clients/Margel360/website/js/translations.js"
git commit -m "feat(margel360): add index.html shell with nav, footer, and sections"
```

---

## Task 5: `index.html` — Hero, Events Grid, CSS

**Files:**
- Modify: `Clients/Margel360/website/css/style.css`
- Create: `Clients/Margel360/website/js/index.js`

- [ ] **Step 1: Add hero + home section styles to `style.css`**

Append to `style.css`:

```css
/* ── Hero ── */
.hero {
  position: relative;
  height: 100vh;
  min-height: 600px;
  display: flex;
  align-items: center;
  background: url('assets/images/placeholder.jpg') center/cover no-repeat;
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 60%, var(--bg) 100%);
}
.hero-content {
  position: relative;
  z-index: 1;
}
.hero-content h1 { margin-bottom: 16px; max-width: 700px; }
.hero-content p { font-size: 1.2rem; color: rgba(255,255,255,0.8); margin-bottom: 32px; max-width: 500px; }

/* ── Events grid ── */
.events-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.event-card {
  background: var(--bg-2);
  border-radius: var(--radius);
  overflow: hidden;
  transition: transform var(--transition), box-shadow var(--transition);
}
.event-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
.event-card img { width: 100%; height: 200px; object-fit: cover; }
.event-card-body { padding: 20px; }
.event-card-body h3 { margin-bottom: 8px; }
.event-card-meta { display: flex; justify-content: space-between; margin-top: 12px; font-size: 0.9rem; color: var(--text-muted); }
.event-card-price { color: var(--accent); font-weight: 700; font-size: 1rem; }

/* ── About ── */
.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}
.about-text h2 { margin-bottom: 20px; }
.about-text p { font-size: 1rem; }
.about-image img { border-radius: var(--radius); width: 100%; }

/* ── Equipment ── */
.equip-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
.equip-item {
  background: var(--bg-2);
  border-radius: var(--radius);
  padding: 20px 16px;
  text-align: center;
  font-size: 0.9rem;
  color: var(--text-muted);
}
.equip-item .equip-icon { font-size: 1.8rem; margin-bottom: 10px; }

/* ── Photo teaser ── */
.photos-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.photos-grid img { width: 100%; height: 200px; object-fit: cover; border-radius: var(--radius); }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .events-grid { grid-template-columns: repeat(2, 1fr); }
  .equip-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .events-grid { grid-template-columns: 1fr; }
  .about-grid { grid-template-columns: 1fr; }
  .equip-grid { grid-template-columns: repeat(2, 1fr); }
  .photos-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .equip-grid { grid-template-columns: 1fr 1fr; }
  .photos-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Create `js/index.js` — render events and equipment dynamically**

```javascript
// Events data
const events = [
  { key: 'corp4', title_bg: 'Корпоративни събития за 4 часа', title_en: 'Corporate Event 4h', hours_bg: '(8:00–17:30)', hours_en: '(8:00–5:30 PM)', price: '4 066.35 лв.' },
  { key: 'corp8', title_bg: 'Корпоративни събития за 8 часа', title_en: 'Corporate Event 8h', hours_bg: '(8:00–17:30)', hours_en: '(8:00–5:30 PM)', price: '4 083.52 лв.' },
  { key: 'bday_day', title_bg: 'Детски рожден ден (дневно) до 17:30', title_en: 'Kids Birthday (daytime) until 5:30 PM', hours_bg: 'до 17:30', hours_en: 'until 5:30 PM', price: '4 064.24 лв.' },
  { key: 'bday_eve', title_bg: 'Детски рожден ден 5ч. вечерна, 16:00–24:00', title_en: 'Kids Birthday 5h evening, 4 PM–midnight', hours_bg: '16:00–24:00', hours_en: '4:00 PM–midnight', price: '4 065.25 лв.' },
  { key: 'wedding', title_bg: 'Сватба', title_en: 'Wedding', hours_bg: 'По договаряне', hours_en: 'By arrangement', price: '45 473.52 лв.' },
];

const equipment = [
  { icon: '🍸', label_bg: 'Собствен бар с необходимо оборудване', label_en: 'Own bar with full equipment' },
  { icon: '🍽️', label_bg: 'Кладенец загряване за алкохол', label_en: 'Catering area' },
  { icon: '🚻', label_bg: 'Тоалети и съдове за тоалети', label_en: 'Toilets and washroom facilities' },
  { icon: '🔊', label_bg: '32 пут и професионално озвучаване', label_en: '360° professional sound system' },
  { icon: '💡', label_bg: 'Модерно парченце осветление', label_en: 'Modern stage lighting' },
  { icon: '🎬', label_bg: 'Мултивижън — проектор и екран', label_en: 'Multivision — projector and screen' },
  { icon: '🔒', label_bg: 'Видеонаблюдение и охрана', label_en: 'CCTV and security' },
  { icon: '❄️', label_bg: 'Климатизация и вентилация', label_en: 'Air conditioning and ventilation' },
  { icon: '📺', label_bg: 'Информационен монитор на входа', label_en: 'Info display at entrance' },
  { icon: '🕺', label_bg: 'Простране паркинг', label_en: 'Spacious dance floor' },
  { icon: '🌿', label_bg: 'Два простора за паркиране', label_en: 'Two outdoor areas' },
];

const lang = localStorage.getItem('margel_lang') || 'bg';

// Render events
const eventsGrid = document.getElementById('events-grid');
if (eventsGrid) {
  events.forEach(e => {
    eventsGrid.innerHTML += `
      <div class="event-card">
        <img src="assets/images/placeholder.jpg" alt="${lang === 'bg' ? e.title_bg : e.title_en}">
        <div class="event-card-body">
          <h3>${lang === 'bg' ? e.title_bg : e.title_en}</h3>
          <div class="event-card-meta">
            <span>${lang === 'bg' ? e.hours_bg : e.hours_en}</span>
            <span class="event-card-price">${e.price}</span>
          </div>
        </div>
      </div>`;
  });
}

// Render equipment
const equipGrid = document.getElementById('equip-grid');
if (equipGrid) {
  equipment.forEach(item => {
    equipGrid.innerHTML += `
      <div class="equip-item">
        <div class="equip-icon">${item.icon}</div>
        <span>${lang === 'bg' ? item.label_bg : item.label_en}</span>
      </div>`;
  });
}
```

- [ ] **Step 3: Open `index.html` in browser and verify**

Expected: hero with full-height background, event cards grid (5 cards), equipment icon grid (11 items), photo teaser grid (6 images), footer.

- [ ] **Step 4: Commit**

```bash
git add "Clients/Margel360/website/css/style.css" "Clients/Margel360/website/js/index.js"
git commit -m "feat(margel360): home page hero, events grid, equipment, photo teaser"
```

---

## Task 6: `gallery.html` + Lightbox

**Files:**
- Create: `Clients/Margel360/website/gallery.html`
- Create: `Clients/Margel360/website/js/gallery.js`
- Modify: `Clients/Margel360/website/css/style.css`

- [ ] **Step 1: Create `gallery.html`**

```html
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Галерия — Маргел 360°</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <nav class="nav scrolled">
    <div class="container">
      <a href="index.html" class="nav-logo">МАРГЕЛ <span>360°</span></a>
      <ul class="nav-links">
        <li><a href="index.html" data-i18n="nav_home">Тип събитие</a></li>
        <li><a href="gallery.html" class="active" data-i18n="nav_gallery">Галерия</a></li>
        <li><a href="faq.html" data-i18n="nav_faq">FAQ</a></li>
        <li><a href="services.html" data-i18n="nav_services">Услуги</a></li>
        <li><a href="contact.html" data-i18n="nav_contact">Контакти</a></li>
        <li><a href="reservation.html" class="btn btn-primary" style="padding:8px 20px" data-i18n="nav_reserve">Запитване</a></li>
        <li><button class="lang-toggle">EN</button></li>
      </ul>
      <button class="hamburger"><span></span><span></span><span></span></button>
    </div>
  </nav>
  <div class="nav-drawer">
    <a href="index.html" data-i18n="nav_home">Тип събитие</a>
    <a href="gallery.html" class="active" data-i18n="nav_gallery">Галерия</a>
    <a href="faq.html" data-i18n="nav_faq">FAQ</a>
    <a href="services.html" data-i18n="nav_services">Услуги</a>
    <a href="contact.html" data-i18n="nav_contact">Контакти</a>
    <a href="reservation.html" data-i18n="nav_reserve">Запитване</a>
    <button class="lang-toggle">EN</button>
  </div>

  <main style="padding-top: var(--nav-height);">
    <section class="section">
      <div class="container">
        <div class="section-title">
          <h2 data-i18n="gallery_title">Галерия</h2>
          <p data-i18n="gallery_sub">Снимки от нашите събития</p>
        </div>
        <div class="gallery-grid" id="gallery-grid"></div>
      </div>
    </section>
  </main>

  <!-- Lightbox -->
  <div class="lightbox" id="lightbox">
    <button class="lightbox-close" id="lb-close">×</button>
    <button class="lightbox-prev" id="lb-prev">‹</button>
    <img class="lightbox-img" id="lb-img" src="" alt="">
    <button class="lightbox-next" id="lb-next">›</button>
  </div>

  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="nav-logo">МАРГЕЛ <span>360°</span></div>
          <p data-i18n="footer_desc">Зала за всяко събитие в сърцето на Враца.</p>
        </div>
        <div>
          <h4 data-i18n="footer_nav">Навигация</h4>
          <ul class="footer-links">
            <li><a href="index.html" data-i18n="nav_home">Тип събитие</a></li>
            <li><a href="gallery.html" data-i18n="nav_gallery">Галерия</a></li>
            <li><a href="faq.html" data-i18n="nav_faq">FAQ</a></li>
            <li><a href="services.html" data-i18n="nav_services">Услуги</a></li>
            <li><a href="contact.html" data-i18n="nav_contact">Контакти</a></li>
          </ul>
        </div>
        <div class="footer-contact">
          <h4 data-i18n="footer_contact">Контакти</h4>
          <p>📞 0888 10 09 42</p>
          <p data-i18n="footer_address">гр. Враца, България</p>
          <div class="social-links">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">in</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p data-i18n="footer_copy">© 2024 Маргел 360°. Всички права запазени.</p>
      </div>
    </div>
  </footer>

  <script src="js/translations.js"></script>
  <script src="js/main.js"></script>
  <script src="js/gallery.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add gallery + lightbox styles to `style.css`**

Append to `style.css`:

```css
/* ── Gallery ── */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.gallery-item {
  overflow: hidden;
  border-radius: var(--radius);
  cursor: pointer;
}
.gallery-item img {
  width: 100%;
  height: 240px;
  object-fit: cover;
  transition: transform 0.3s ease;
}
.gallery-item:hover img { transform: scale(1.05); }

/* ── Lightbox ── */
.lightbox {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.95);
  z-index: 200;
  align-items: center;
  justify-content: center;
}
.lightbox.open { display: flex; }
.lightbox-img {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: var(--radius);
}
.lightbox-close {
  position: absolute;
  top: 20px; right: 24px;
  background: none;
  border: none;
  color: #fff;
  font-size: 2.5rem;
  line-height: 1;
}
.lightbox-prev,
.lightbox-next {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.1);
  border: none;
  color: #fff;
  font-size: 2rem;
  width: 48px; height: 48px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: background var(--transition);
}
.lightbox-prev:hover,
.lightbox-next:hover { background: rgba(255,255,255,0.2); }
.lightbox-prev { left: 20px; }
.lightbox-next { right: 20px; }

@media (max-width: 768px) {
  .gallery-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .gallery-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Create `js/gallery.js`**

```javascript
// Gallery images (demo: 12 placeholders)
const images = Array.from({ length: 12 }, (_, i) => ({
  src: `assets/images/placeholder.jpg`,
  alt: `Event photo ${i + 1}`
}));

let currentIndex = 0;

const grid = document.getElementById('gallery-grid');
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lb-img');

// Render grid
images.forEach((img, i) => {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.innerHTML = `<img src="${img.src}" alt="${img.alt}">`;
  item.addEventListener('click', () => openLightbox(i));
  grid.appendChild(item);
});

function openLightbox(index) {
  currentIndex = index;
  lbImg.src = images[currentIndex].src;
  lbImg.alt = images[currentIndex].alt;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function showPrev() {
  currentIndex = (currentIndex - 1 + images.length) % images.length;
  lbImg.src = images[currentIndex].src;
}

function showNext() {
  currentIndex = (currentIndex + 1) % images.length;
  lbImg.src = images[currentIndex].src;
}

document.getElementById('lb-close').addEventListener('click', closeLightbox);
document.getElementById('lb-prev').addEventListener('click', showPrev);
document.getElementById('lb-next').addEventListener('click', showNext);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') showPrev();
  if (e.key === 'ArrowRight') showNext();
});
```

- [ ] **Step 4: Create `js/translations.js` for gallery page**

Save this as `js/translations.js` when building gallery.html (each page has its own copy):

```javascript
const translations = {
  bg: {
    nav_home: 'Тип събитие', nav_gallery: 'Галерия', nav_faq: 'FAQ',
    nav_services: 'Услуги', nav_contact: 'Контакти', nav_reserve: 'Запитване',
    gallery_title: 'Галерия', gallery_sub: 'Снимки от нашите събития',
    footer_desc: 'Зала за всяко събитие в сърцето на Враца.',
    footer_nav: 'Навигация', footer_contact: 'Контакти',
    footer_address: 'гр. Враца, България',
    footer_copy: '© 2024 Маргел 360°. Всички права запазени.',
  },
  en: {
    nav_home: 'Event Types', nav_gallery: 'Gallery', nav_faq: 'FAQ',
    nav_services: 'Services', nav_contact: 'Contacts', nav_reserve: 'Enquiry',
    gallery_title: 'Gallery', gallery_sub: 'Photos from our events',
    footer_desc: 'A venue for every occasion in the heart of Vratsa.',
    footer_nav: 'Navigation', footer_contact: 'Contact',
    footer_address: 'Vratsa, Bulgaria',
    footer_copy: '© 2024 Margel 360°. All rights reserved.',
  }
};
```

**Note:** Since each page has its own `translations.js`, rename the gallery page's translation file to `js/translations-gallery.js` and update the `<script>` tag in `gallery.html` accordingly. Do the same pattern for all remaining pages.

- [ ] **Step 5: Open `gallery.html` in browser and verify**

Expected: 12 photo grid, clicking opens lightbox, prev/next and keyboard arrows work, Escape closes.

- [ ] **Step 6: Commit**

```bash
git add "Clients/Margel360/website/gallery.html" "Clients/Margel360/website/js/gallery.js" "Clients/Margel360/website/css/style.css"
git commit -m "feat(margel360): gallery page with lightbox"
```

---

## Task 7: `faq.html` + Accordion

**Files:**
- Create: `Clients/Margel360/website/faq.html`
- Create: `Clients/Margel360/website/js/faq.js`
- Create: `Clients/Margel360/website/js/translations-faq.js`
- Modify: `Clients/Margel360/website/css/style.css`

- [ ] **Step 1: Add accordion styles to `style.css`**

Append to `style.css`:

```css
/* ── FAQ Accordion ── */
.faq-list { max-width: 800px; margin: 0 auto; }
.faq-item {
  border-bottom: 1px solid #222;
}
.faq-question {
  width: 100%;
  background: none;
  border: none;
  color: #fff;
  text-align: left;
  padding: 20px 0;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  transition: color var(--transition);
}
.faq-question:hover { color: var(--accent); }
.faq-icon {
  font-size: 1.4rem;
  font-weight: 300;
  flex-shrink: 0;
  transition: transform var(--transition);
}
.faq-item.open .faq-icon { transform: rotate(45deg); color: var(--accent); }
.faq-answer {
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.3s ease, padding 0.3s ease;
}
.faq-answer p {
  padding-bottom: 20px;
  font-size: 0.95rem;
  line-height: 1.8;
}
.faq-item.open .faq-answer { max-height: 400px; }
```

- [ ] **Step 2: Create `faq.html`**

Use the same nav/footer shell as `gallery.html` with `class="active"` on the FAQ link. Main content:

```html
<main style="padding-top: var(--nav-height);">
  <section class="section">
    <div class="container">
      <div class="section-title">
        <h2 data-i18n="faq_title">Често задавани въпроси</h2>
      </div>
      <div class="faq-list" id="faq-list"></div>
    </div>
  </section>
</main>
```

- [ ] **Step 3: Create `js/faq.js`**

```javascript
const faqs = [
  {
    q_bg: 'Колко човека събира залата?',
    q_en: 'How many people does the venue hold?',
    a_bg: 'Залата може да побере до 200 човека в зависимост от конфигурацията на събитието.',
    a_en: 'The venue can accommodate up to 200 people depending on event configuration.',
  },
  {
    q_bg: 'Може ли да си доведем кетъринг?',
    q_en: 'Can we bring our own catering?',
    a_bg: 'Да, можете да ползвате собствен кетъринг. Разполагаме с оборудвана кухня.',
    a_en: 'Yes, you can bring your own catering. We have a fully equipped kitchen available.',
  },
  {
    q_bg: 'Може ли да си доведем музика?',
    q_en: 'Can we bring our own DJ or band?',
    a_bg: 'Да, можете да доведете свой DJ или жива музика. Залата разполага с пълна звукова система.',
    a_en: 'Yes, you can bring your own DJ or live band. The venue has a full sound system.',
  },
  {
    q_bg: 'Може ли да ни покажат залата?',
    q_en: 'Can we visit the venue?',
    a_bg: 'Разбира се! Свържете се с нас за да уговорим посещение.',
    a_en: 'Of course! Contact us to arrange a viewing.',
  },
  {
    q_bg: 'До колко часа може да остане?',
    q_en: 'Until what time can events run?',
    a_bg: 'Вечерните тържества могат да продължат до 24:00 часа.',
    a_en: 'Evening events can run until midnight.',
  },
  {
    q_bg: 'Има ли паркинг?',
    q_en: 'Is there parking?',
    a_bg: 'Да, разполагаме с два обширни паркинга за Вашите гости.',
    a_en: 'Yes, we have two spacious parking areas for your guests.',
  },
  {
    q_bg: 'Силата на музика пречи ли на никого?',
    q_en: 'Does the music volume disturb neighbours?',
    a_bg: 'Залата е звукоизолирана, така че шумът не излиза извън нея.',
    a_en: 'The venue is fully soundproofed so noise does not escape outside.',
  },
  {
    q_bg: 'Какво е включено в наема на залата?',
    q_en: 'What is included in the venue rental?',
    a_bg: 'Включени са: бар оборудване, озвучаване, осветление, маси и столове, климатизация.',
    a_en: 'Included: bar equipment, sound system, lighting, tables and chairs, air conditioning.',
  },
  {
    q_bg: 'С какво оборудване разполага залата?',
    q_en: 'What equipment does the venue have?',
    a_bg: 'Пълна звукова система, проектор и екран, модерно осветление, бар, кухня и паркинг.',
    a_en: 'Full sound system, projector and screen, modern lighting, bar, kitchen, and parking.',
  },
  {
    q_bg: 'Допълнително оборудване, което може да бъде добавено?',
    q_en: 'Can additional equipment be added?',
    a_bg: 'Да, предлагаме допълнителни услуги като украса, фото кабина и DJ оборудване.',
    a_en: 'Yes, we offer additional services like decoration, photo booth, and DJ equipment.',
  },
  {
    q_bg: 'Може ли да видим снимки и клипове от събитията?',
    q_en: 'Can we see photos and videos from past events?',
    a_bg: 'Да! Разгледайте галерията ни или нашата Facebook страница.',
    a_en: 'Yes! Check out our gallery or our Facebook page.',
  },
];

const lang = localStorage.getItem('margel_lang') || 'bg';
const list = document.getElementById('faq-list');

faqs.forEach((faq, i) => {
  const item = document.createElement('div');
  item.className = 'faq-item';
  item.innerHTML = `
    <button class="faq-question" aria-expanded="false">
      <span>${lang === 'bg' ? faq.q_bg : faq.q_en}</span>
      <span class="faq-icon">+</span>
    </button>
    <div class="faq-answer">
      <p>${lang === 'bg' ? faq.a_bg : faq.a_en}</p>
    </div>`;
  const btn = item.querySelector('.faq-question');
  btn.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    // Close all
    document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
  list.appendChild(item);
});
```

- [ ] **Step 4: Open `faq.html` in browser and verify**

Expected: list of 11 questions, clicking opens answer, clicking again or clicking another closes the previous one. Smooth height animation.

- [ ] **Step 5: Commit**

```bash
git add "Clients/Margel360/website/faq.html" "Clients/Margel360/website/js/faq.js" "Clients/Margel360/website/css/style.css"
git commit -m "feat(margel360): FAQ page with accordion"
```

---

## Task 8: `services.html`

**Files:**
- Create: `Clients/Margel360/website/services.html`
- Create: `Clients/Margel360/website/js/services.js`

- [ ] **Step 1: Create `services.html`**

Use same nav/footer shell. Main content:

```html
<main style="padding-top: var(--nav-height);">
  <section class="section">
    <div class="container">
      <div class="section-title">
        <h2 data-i18n="services_title">Допълнителни услуги</h2>
        <p data-i18n="services_sub">Всичко необходимо за перфектното тържество</p>
      </div>
      <div class="services-grid" id="services-grid"></div>
    </div>
  </section>
</main>
```

- [ ] **Step 2: Add services styles to `style.css`**

Append to `style.css`:

```css
/* ── Services ── */
.services-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.service-card {
  background: var(--bg-2);
  border-radius: var(--radius);
  padding: 32px 24px;
  text-align: center;
  transition: transform var(--transition), box-shadow var(--transition);
}
.service-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.3); }
.service-icon { font-size: 2.5rem; margin-bottom: 16px; }
.service-card h3 { margin-bottom: 10px; }
.service-card p { font-size: 0.95rem; }

@media (max-width: 768px) {
  .services-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .services-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Create `js/services.js`**

```javascript
const services = [
  { icon: '🎨', title_bg: 'Украса', title_en: 'Decoration', desc_bg: 'Персонализирана украса за вашето тържество.', desc_en: 'Personalised decoration for your celebration.' },
  { icon: '📸', title_bg: 'Фото кабина', title_en: 'Photo Booth', desc_bg: 'Забавна фото кабина за вашите гости.', desc_en: 'A fun photo booth for your guests.' },
  { icon: '🎧', title_bg: 'DJ оборудване', title_en: 'DJ Equipment', desc_bg: 'Професионално DJ оборудване и озвучаване.', desc_en: 'Professional DJ equipment and sound.' },
  { icon: '🌸', title_bg: 'Цветни аранжировки', title_en: 'Floral Arrangements', desc_bg: 'Свежи цветни декорации за вашето събитие.', desc_en: 'Fresh floral decorations for your event.' },
  { icon: '🍰', title_bg: 'Торта по поръчка', title_en: 'Custom Cake', desc_bg: 'Индивидуално изработена торта за специалния повод.', desc_en: 'A bespoke cake crafted for your special occasion.' },
  { icon: '🚗', title_bg: 'Паркинг асистент', title_en: 'Parking Assistant', desc_bg: 'Асистент за улеснено паркиране на вашите гости.', desc_en: 'A parking assistant for your guests.' },
];

const lang = localStorage.getItem('margel_lang') || 'bg';
const grid = document.getElementById('services-grid');
services.forEach(s => {
  grid.innerHTML += `
    <div class="service-card">
      <div class="service-icon">${s.icon}</div>
      <h3>${lang === 'bg' ? s.title_bg : s.title_en}</h3>
      <p>${lang === 'bg' ? s.desc_bg : s.desc_en}</p>
    </div>`;
});
```

- [ ] **Step 4: Commit**

```bash
git add "Clients/Margel360/website/services.html" "Clients/Margel360/website/js/services.js" "Clients/Margel360/website/css/style.css"
git commit -m "feat(margel360): additional services page"
```

---

## Task 9: `contact.html`

**Files:**
- Create: `Clients/Margel360/website/contact.html`

- [ ] **Step 1: Add contact styles to `style.css`**

Append to `style.css`:

```css
/* ── Contact ── */
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: start;
}
.contact-info h2 { margin-bottom: 32px; }
.contact-detail { display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start; }
.contact-detail-icon { font-size: 1.5rem; flex-shrink: 0; margin-top: 2px; }
.contact-detail h4 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 4px; }
.contact-detail p { color: var(--text); font-size: 1rem; }
.contact-map iframe { width: 100%; height: 400px; border: none; border-radius: var(--radius); filter: grayscale(30%); }

@media (max-width: 768px) {
  .contact-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Create `contact.html`**

Use same nav/footer shell. Main content:

```html
<main style="padding-top: var(--nav-height);">
  <section class="section">
    <div class="container">
      <div class="contact-grid">
        <div class="contact-info">
          <h2 data-i18n="contact_title">Контакти</h2>
          <div class="contact-detail">
            <div class="contact-detail-icon">📞</div>
            <div>
              <h4 data-i18n="contact_phone_label">Телефон</h4>
              <p>0888 10 09 42</p>
            </div>
          </div>
          <div class="contact-detail">
            <div class="contact-detail-icon">📍</div>
            <div>
              <h4 data-i18n="contact_address_label">Адрес</h4>
              <p data-i18n="contact_address">гр. Враца, България</p>
            </div>
          </div>
          <div class="contact-detail">
            <div class="contact-detail-icon">🕐</div>
            <div>
              <h4 data-i18n="contact_hours_label">Работно време</h4>
              <p data-i18n="contact_hours">По договаряне</p>
            </div>
          </div>
          <div class="social-links" style="margin-top:32px">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">in</a>
          </div>
        </div>
        <div class="contact-map">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d46787.56!2d23.5!3d43.2!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zVnJhdHNh!5e0!3m2!1sen!2sbg!4v1"
            allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
            title="Маргел 360° на картата">
          </iframe>
        </div>
      </div>
    </div>
  </section>
</main>
```

- [ ] **Step 3: Commit**

```bash
git add "Clients/Margel360/website/contact.html" "Clients/Margel360/website/css/style.css"
git commit -m "feat(margel360): contact page with map"
```

---

## Task 10: `reservation.html` — Form + Validation

**Files:**
- Create: `Clients/Margel360/website/reservation.html`
- Create: `Clients/Margel360/website/js/reservation.js`

- [ ] **Step 1: Add form styles to `style.css`**

Append to `style.css`:

```css
/* ── Form ── */
.form-wrapper { max-width: 640px; margin: 0 auto; }
.form-group { margin-bottom: 24px; }
.form-group label { display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 8px; color: var(--text-muted); }
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  background: var(--bg-2);
  border: 1px solid #333;
  border-radius: var(--radius);
  color: #fff;
  padding: 12px 16px;
  font-size: 1rem;
  font-family: var(--font);
  transition: border-color var(--transition);
  outline: none;
}
.form-group select option { background: var(--bg-2); }
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus { border-color: var(--accent); }
.form-group textarea { resize: vertical; min-height: 120px; }
.form-error { display: none; color: var(--accent); font-size: 0.85rem; margin-top: 6px; }
.form-group.has-error input,
.form-group.has-error select,
.form-group.has-error textarea { border-color: var(--accent); }
.form-group.has-error .form-error { display: block; }
.form-success {
  display: none;
  text-align: center;
  padding: 60px 24px;
}
.form-success h2 { margin-bottom: 16px; }
.form-success p { font-size: 1.1rem; }
```

- [ ] **Step 2: Create `reservation.html`**

Use same nav/footer shell. Main content:

```html
<main style="padding-top: var(--nav-height);">
  <section class="section">
    <div class="container">
      <div class="section-title">
        <h2 data-i18n="res_title">Направете запитване</h2>
        <p data-i18n="res_sub">Свържете се с нас за да планираме вашето събитие</p>
      </div>
      <div class="form-wrapper">
        <form id="reservation-form" novalidate>
          <div class="form-group" id="fg-name">
            <label for="name" data-i18n="res_name">Три имена</label>
            <input type="text" id="name" name="name" autocomplete="name">
            <span class="form-error" data-i18n="err_name">Моля въведете вашето име.</span>
          </div>
          <div class="form-group" id="fg-phone">
            <label for="phone" data-i18n="res_phone">Телефон</label>
            <input type="tel" id="phone" name="phone" autocomplete="tel">
            <span class="form-error" data-i18n="err_phone">Моля въведете валиден телефонен номер.</span>
          </div>
          <div class="form-group" id="fg-event">
            <label for="event" data-i18n="res_event">Тип събитие</label>
            <select id="event" name="event">
              <option value="" data-i18n="res_event_placeholder">-- Изберете --</option>
              <option value="corp4" data-i18n="ev_corp4">Корпоративно събитие 4ч.</option>
              <option value="corp8" data-i18n="ev_corp8">Корпоративно събитие 8ч.</option>
              <option value="bday_day" data-i18n="ev_bday_day">Детски рожден ден (дневно)</option>
              <option value="bday_eve" data-i18n="ev_bday_eve">Детски рожден ден (вечерно)</option>
              <option value="wedding" data-i18n="ev_wedding">Сватба</option>
              <option value="other" data-i18n="ev_other">Друго</option>
            </select>
            <span class="form-error" data-i18n="err_event">Моля изберете тип събитие.</span>
          </div>
          <div class="form-group" id="fg-date">
            <label for="date" data-i18n="res_date">Предпочитана дата</label>
            <input type="date" id="date" name="date">
            <span class="form-error" data-i18n="err_date">Моля изберете дата.</span>
          </div>
          <div class="form-group" id="fg-message">
            <label for="message" data-i18n="res_message">Съобщение (по желание)</label>
            <textarea id="message" name="message"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%" data-i18n="res_submit">Изпрати запитване</button>
        </form>
        <div class="form-success" id="form-success">
          <div style="font-size:3rem;margin-bottom:16px">✅</div>
          <h2 data-i18n="success_title">Благодарим ви!</h2>
          <p data-i18n="success_body">Получихме вашето запитване. Ще се свържем с вас в рамките на 24 часа.</p>
        </div>
      </div>
    </div>
  </section>
</main>
```

- [ ] **Step 3: Create `js/reservation.js`**

```javascript
const form = document.getElementById('reservation-form');
const successMsg = document.getElementById('form-success');

function setError(groupId, show) {
  const group = document.getElementById(groupId);
  if (group) group.classList.toggle('has-error', show);
}

function validatePhone(val) {
  return /^[\d\s\+\-\(\)]{7,}$/.test(val.trim());
}

form.addEventListener('submit', e => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const event = document.getElementById('event').value;
  const date = document.getElementById('date').value;

  let valid = true;

  setError('fg-name', !name);
  if (!name) valid = false;

  setError('fg-phone', !validatePhone(phone));
  if (!validatePhone(phone)) valid = false;

  setError('fg-event', !event);
  if (!event) valid = false;

  setError('fg-date', !date);
  if (!date) valid = false;

  if (!valid) return;

  form.style.display = 'none';
  successMsg.style.display = 'block';
});

// Clear error on input
['name','phone','event','date'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => setError(`fg-${id}`, false));
});
```

- [ ] **Step 4: Open `reservation.html` in browser and verify**

Expected: form renders, submitting empty shows red errors on all required fields, filling valid data and submitting hides form and shows "Thank you" message.

- [ ] **Step 5: Commit**

```bash
git add "Clients/Margel360/website/reservation.html" "Clients/Margel360/website/js/reservation.js" "Clients/Margel360/website/css/style.css"
git commit -m "feat(margel360): reservation form with client-side validation"
```

---

## Task 11: Per-Page Translation Files

**Note on translations architecture:** Each page loads its own `translations-[page].js`. Update every page's `<script>` tag to load the correct file (e.g. `js/translations-faq.js`, `js/translations-services.js`, etc.). The `translations` variable name stays the same in every file — `main.js` always reads `translations`.

- [ ] **Step 1: Create `js/translations-faq.js`**

```javascript
const translations = {
  bg: {
    nav_home:'Тип събитие', nav_gallery:'Галерия', nav_faq:'FAQ',
    nav_services:'Услуги', nav_contact:'Контакти', nav_reserve:'Запитване',
    faq_title:'Често задавани въпроси',
    footer_desc:'Зала за всяко събитие в сърцето на Враца.',
    footer_nav:'Навигация', footer_contact:'Контакти',
    footer_address:'гр. Враца, България',
    footer_copy:'© 2024 Маргел 360°. Всички права запазени.',
  },
  en: {
    nav_home:'Event Types', nav_gallery:'Gallery', nav_faq:'FAQ',
    nav_services:'Services', nav_contact:'Contacts', nav_reserve:'Enquiry',
    faq_title:'Frequently Asked Questions',
    footer_desc:'A venue for every occasion in the heart of Vratsa.',
    footer_nav:'Navigation', footer_contact:'Contact',
    footer_address:'Vratsa, Bulgaria',
    footer_copy:'© 2024 Margel 360°. All rights reserved.',
  }
};
```

- [ ] **Step 2: Create `js/translations-services.js`**

```javascript
const translations = {
  bg: {
    nav_home:'Тип събитие', nav_gallery:'Галерия', nav_faq:'FAQ',
    nav_services:'Услуги', nav_contact:'Контакти', nav_reserve:'Запитване',
    services_title:'Допълнителни услуги', services_sub:'Всичко необходимо за перфектното тържество',
    footer_desc:'Зала за всяко събитие в сърцето на Враца.',
    footer_nav:'Навигация', footer_contact:'Контакти',
    footer_address:'гр. Враца, България',
    footer_copy:'© 2024 Маргел 360°. Всички права запазени.',
  },
  en: {
    nav_home:'Event Types', nav_gallery:'Gallery', nav_faq:'FAQ',
    nav_services:'Services', nav_contact:'Contacts', nav_reserve:'Enquiry',
    services_title:'Additional Services', services_sub:'Everything you need for the perfect celebration',
    footer_desc:'A venue for every occasion in the heart of Vratsa.',
    footer_nav:'Navigation', footer_contact:'Contact',
    footer_address:'Vratsa, Bulgaria',
    footer_copy:'© 2024 Margel 360°. All rights reserved.',
  }
};
```

- [ ] **Step 3: Create `js/translations-contact.js`**

```javascript
const translations = {
  bg: {
    nav_home:'Тип събитие', nav_gallery:'Галерия', nav_faq:'FAQ',
    nav_services:'Услуги', nav_contact:'Контакти', nav_reserve:'Запитване',
    contact_title:'Контакти',
    contact_phone_label:'Телефон', contact_address_label:'Адрес',
    contact_address:'гр. Враца, България',
    contact_hours_label:'Работно време', contact_hours:'По договаряне',
    footer_desc:'Зала за всяко събитие в сърцето на Враца.',
    footer_nav:'Навигация', footer_contact:'Контакти',
    footer_address:'гр. Враца, България',
    footer_copy:'© 2024 Маргел 360°. Всички права запазени.',
  },
  en: {
    nav_home:'Event Types', nav_gallery:'Gallery', nav_faq:'FAQ',
    nav_services:'Services', nav_contact:'Contacts', nav_reserve:'Enquiry',
    contact_title:'Contact',
    contact_phone_label:'Phone', contact_address_label:'Address',
    contact_address:'Vratsa, Bulgaria',
    contact_hours_label:'Opening Hours', contact_hours:'By arrangement',
    footer_desc:'A venue for every occasion in the heart of Vratsa.',
    footer_nav:'Navigation', footer_contact:'Contact',
    footer_address:'Vratsa, Bulgaria',
    footer_copy:'© 2024 Margel 360°. All rights reserved.',
  }
};
```

- [ ] **Step 4: Create `js/translations-reservation.js`**

```javascript
const translations = {
  bg: {
    nav_home:'Тип събитие', nav_gallery:'Галерия', nav_faq:'FAQ',
    nav_services:'Услуги', nav_contact:'Контакти', nav_reserve:'Запитване',
    res_title:'Направете запитване', res_sub:'Свържете се с нас за да планираме вашето събитие',
    res_name:'Три имена', res_phone:'Телефон', res_event:'Тип събитие',
    res_event_placeholder:'-- Изберете --', res_date:'Предпочитана дата',
    res_message:'Съобщение (по желание)', res_submit:'Изпрати запитване',
    ev_corp4:'Корпоративно събитие 4ч.', ev_corp8:'Корпоративно събитие 8ч.',
    ev_bday_day:'Детски рожден ден (дневно)', ev_bday_eve:'Детски рожден ден (вечерно)',
    ev_wedding:'Сватба', ev_other:'Друго',
    err_name:'Моля въведете вашето име.',
    err_phone:'Моля въведете валиден телефонен номер.',
    err_event:'Моля изберете тип събитие.',
    err_date:'Моля изберете дата.',
    success_title:'Благодарим ви!',
    success_body:'Получихме вашето запитване. Ще се свържем с вас в рамките на 24 часа.',
    footer_desc:'Зала за всяко събитие в сърцето на Враца.',
    footer_nav:'Навигация', footer_contact:'Контакти',
    footer_address:'гр. Враца, България',
    footer_copy:'© 2024 Маргел 360°. Всички права запазени.',
  },
  en: {
    nav_home:'Event Types', nav_gallery:'Gallery', nav_faq:'FAQ',
    nav_services:'Services', nav_contact:'Contacts', nav_reserve:'Enquiry',
    res_title:'Make an Enquiry', res_sub:'Contact us to plan your event',
    res_name:'Full Name', res_phone:'Phone', res_event:'Event Type',
    res_event_placeholder:'-- Select --', res_date:'Preferred Date',
    res_message:'Message (optional)', res_submit:'Send Enquiry',
    ev_corp4:'Corporate Event 4h', ev_corp8:'Corporate Event 8h',
    ev_bday_day:'Kids Birthday (daytime)', ev_bday_eve:'Kids Birthday (evening)',
    ev_wedding:'Wedding', ev_other:'Other',
    err_name:'Please enter your name.',
    err_phone:'Please enter a valid phone number.',
    err_event:'Please select an event type.',
    err_date:'Please select a date.',
    success_title:'Thank you!',
    success_body:'We received your enquiry. We will be in touch within 24 hours.',
    footer_desc:'A venue for every occasion in the heart of Vratsa.',
    footer_nav:'Navigation', footer_contact:'Contact',
    footer_address:'Vratsa, Bulgaria',
    footer_copy:'© 2024 Margel 360°. All rights reserved.',
  }
};
```

- [ ] **Step 5: Update all page `<script>` tags to reference correct translation file**

In each HTML file, change the translations script tag:
- `faq.html` → `<script src="js/translations-faq.js"></script>`
- `gallery.html` → `<script src="js/translations-gallery.js"></script>`
- `services.html` → `<script src="js/translations-services.js"></script>`
- `contact.html` → `<script src="js/translations-contact.js"></script>`
- `reservation.html` → `<script src="js/translations-reservation.js"></script>`
- `index.html` → `<script src="js/translations-index.js"></script>` (rename existing)

- [ ] **Step 6: Test language toggle on every page**

Open each page, click EN toggle. Expected: all visible text switches to English, "EN" button changes to "BG", language persists when navigating between pages.

- [ ] **Step 7: Commit**

```bash
git add "Clients/Margel360/website/js/"
git commit -m "feat(margel360): per-page translation files for all 6 pages"
```

---

## Task 12: Final Polish + Pre-Deploy Check

**Files:**
- Modify: `Clients/Margel360/website/css/style.css`

- [ ] **Step 1: Add page header component style (for interior pages)**

Append to `style.css`:

```css
/* ── Page header (interior pages) ── */
.page-header {
  padding: calc(var(--nav-height) + 60px) 0 60px;
  background: linear-gradient(to bottom, #1a1a1a, var(--bg));
  text-align: center;
}
.page-header h1 { margin-bottom: 12px; }
.page-header p { font-size: 1.1rem; color: var(--text-muted); }
```

Replace `style="padding-top: var(--nav-height);"` on all interior page `<main>` tags with:
```html
<div class="page-header">
  <div class="container">
    <h1 data-i18n="[page_title_key]">Page Title</h1>
  </div>
</div>
```

- [ ] **Step 2: Check all pages for**

- All `<img>` tags have `alt` attributes
- All pages have correct `<title>` tags
- Nav active link is correct per page
- No `localhost` or absolute paths in `src`/`href` attributes
- Language toggle works and persists across all pages
- Mobile nav hamburger works on all pages (test at 375px viewport)
- Reservation form validation works, success state shows correctly

- [ ] **Step 3: Final commit**

```bash
git add "Clients/Margel360/website/"
git commit -m "feat(margel360): final polish, page headers, pre-deploy checks complete"
```

---

## Deployment

1. Open [Netlify](https://netlify.com) → drag and drop the `Clients/Margel360/website/` folder
2. Wait for deploy (< 30 seconds)
3. Share the generated `.netlify.app` URL with the client for the demo
