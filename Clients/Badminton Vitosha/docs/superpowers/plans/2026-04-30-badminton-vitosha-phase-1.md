# Badminton Vitosha — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bilingual public marketing site for Badminton Vitosha — 8 pages × 2 languages, full Editorial Premium design system, Dynamic Editorial motion layer, three Netlify forms — replacing badminton-vitosha.bg.

**Architecture:** Vanilla HTML/CSS/JS (no build step) with GSAP 3 + Lenis loaded via CDN for motion. Per-language URL trees (`/` for Bulgarian canonical, `/en/` for English mirror) — fully static for SEO. Five focused CSS files (`tokens`, `base`, `components`, `pages`, `motion`). Shared nav and footer markup duplicated in each page (kept consistent via the verify script in Task 21); `data-i18n` keys handle text differences. Three forms wired to Netlify Forms in Phase 1; the `/book/` page ships as a placeholder "request a slot" form that will be replaced by the live Supabase grid in Phase 2.

**Tech Stack:** HTML5 · CSS Custom Properties · vanilla JS (ES2022, no build) · GSAP 3 (CDN) · Lenis 1.x (CDN) · Cormorant Garamond Italic + Inter (Google Fonts) · Netlify Forms · Netlify hosting · Python `http.server` for local dev · Lighthouse + axe for verification.

**Spec:** [../specs/2026-04-30-badminton-vitosha-rebuild-design.md](../specs/2026-04-30-badminton-vitosha-rebuild-design.md)

---

## Verification approach

There is no traditional test runner. Each task ends with a **verification step** that the engineer must perform before committing:

- **Visual / structural** tasks: open page in browser, confirm specified elements render and are accessible.
- **JS module** tasks (`i18n.js`, `motion.js`): write browser-based assertions in `test.html` files that print PASS/FAIL to the console.
- **Pre-deploy** tasks: Lighthouse ≥ 90 / 100 / 95 (perf / a11y / SEO), axe DevTools = 0 violations, all forms submit successfully on a Netlify deploy preview.

**Local dev server**: `python3 -m http.server 8080` from `Clients/Badminton Vitosha/website/`. Built-in to macOS, no install needed.

---

## File structure

```
Clients/Badminton Vitosha/
├── netlify.toml                          (Task 1)
├── website/
│   ├── _redirects                        (Task 20)
│   ├── index.html                        (Task 6)
│   ├── book.html                         (Task 7)
│   ├── kids.html                         (Task 8)
│   ├── rules.html                        (Task 9)
│   ├── shop.html                         (Task 10)
│   ├── gallery.html                      (Task 11)
│   ├── about.html                        (Task 12)
│   ├── contacts.html                     (Task 13)
│   ├── news.html                         (Task 14)
│   ├── news/                             (Task 15)
│   │   ├── besplatno-sabitie.html
│   │   ├── rabotim-s-multisport.html
│   │   ├── naredba-turnir-2025.html
│   │   ├── istoriata-na-badmintona.html
│   │   ├── kak-da-podobrish-igrata-si.html
│   │   └── badminton-dinamichniat-sport.html
│   ├── en/                               (mirror, built per page)
│   │   ├── index.html, book.html, ... contacts.html, news.html
│   │   └── news/<6 posts>.html
│   ├── thanks/                           (Task 19)
│   │   ├── contact.html, kids.html, slot.html
│   │   └── en/
│   ├── css/
│   │   ├── tokens.css                    (Task 2)
│   │   ├── base.css                      (Task 2)
│   │   ├── components.css                (Task 3)
│   │   ├── pages.css                     (created empty Task 3, populated as pages built)
│   │   └── motion.css                    (Task 3)
│   ├── js/
│   │   ├── main.js                       (Task 5)
│   │   ├── i18n.js                       (Task 4)
│   │   ├── motion.js                     (Task 16)
│   │   └── i18n/
│   │       ├── bg.json                   (Task 4, expanded as pages built)
│   │       └── en.json                   (Task 4, expanded as pages built)
│   ├── tests/                            (Task 4, 16)
│   │   ├── i18n.test.html
│   │   └── motion.test.html
│   ├── verify.sh                         (Task 21)
│   └── assets/
│       ├── images/                       (downloaded from old site, optimized)
│       ├── fonts/                        (only if self-hosting; default = Google Fonts)
│       └── logo.svg                      (Task 1)
└── docs/
    ├── superpowers/specs/...
    └── superpowers/plans/2026-04-30-badminton-vitosha-phase-1.md
```

---

## Task 1: Scaffold project + Netlify config + assets bootstrap

**Files:**
- Create: `Clients/Badminton Vitosha/netlify.toml`
- Create: `Clients/Badminton Vitosha/website/index.html` (placeholder)
- Create: `Clients/Badminton Vitosha/website/assets/logo.svg` (downloaded from old site)
- Create: `Clients/Badminton Vitosha/website/assets/images/` (folder with downloaded hero photos)

- [ ] **Step 1: Create the folder skeleton**

```bash
cd "Clients/Badminton Vitosha"
mkdir -p website/{css,js/i18n,assets/{images,fonts},en/news,news,thanks/en,tests}
```

- [ ] **Step 2: Write `netlify.toml`**

```toml
[build]
  publish = "website/"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/fonts/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/assets/images/*"
  [headers.values]
    Cache-Control = "public, max-age=2592000"
```

- [ ] **Step 3: Download logo and hero photos from old WordPress media library**

```bash
cd website/assets
curl -o logo.svg "https://badminton-vitosha.bg/wp-content/uploads/2024/05/logo-vertical-7-01.svg"
cd images
curl -o hero-woman.jpg "https://badminton-vitosha.bg/wp-content/uploads/2025/02/front-view-blurry-woman-playing-badminton-683x1024.jpg"
curl -o hero-boy.jpg "https://badminton-vitosha.bg/wp-content/uploads/2025/02/little-boy-playing-badminton-isolated-white-wall-1024x683.jpg"
curl -o hero-young-woman.jpg "https://badminton-vitosha.bg/wp-content/uploads/2025/02/young-woman-playing-badminton-white-wall-683x1024.jpg"
curl -o hall-banner.png "https://badminton-vitosha.bg/wp-content/uploads/2025/02/45364.png"
```

- [ ] **Step 4: Create a placeholder `index.html` to confirm the dev server works**

```html
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8">
  <title>Badminton Vitosha — scaffold</title>
</head>
<body>
  <h1>Scaffolded.</h1>
  <img src="assets/logo.svg" alt="Badminton Vitosha logo" width="200">
</body>
</html>
```

- [ ] **Step 5: Verify dev server**

Run: `cd website && python3 -m http.server 8080`
Open: `http://localhost:8080/`
Expected: heading "Scaffolded." and the logo render.

- [ ] **Step 6: Commit**

```bash
git add "Clients/Badminton Vitosha/netlify.toml" "Clients/Badminton Vitosha/website/"
git commit -m "feat(badminton-vitosha): scaffold project + assets bootstrap"
```

---

## Task 2: Design tokens + base layer

**Files:**
- Create: `website/css/tokens.css`
- Create: `website/css/base.css`

- [ ] **Step 1: Write `tokens.css`** — palette, type scale, spacing, easings, breakpoints

```css
/* tokens.css — single source of design truth */
:root {
  /* Palette */
  --color-court: #0A8050;
  --color-court-deep: #04432A;
  --color-ink: #0C1A12;
  --color-ivory: #F7F5EE;
  --color-stone: #D6C8A8;
  --color-line: rgba(12, 26, 18, 0.12);
  --color-error: #B23B3B;

  /* Type families */
  --font-serif: 'Cormorant Garamond', 'Georgia', serif;
  --font-sans: 'Inter', -apple-system, system-ui, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', 'Menlo', monospace;

  /* Type scale (mobile-first; desktop overrides via @media) */
  --fs-display-xl: 56px;  --lh-display-xl: 0.95;
  --fs-display-l:  40px;  --lh-display-l:  1.0;
  --fs-display-m:  28px;  --lh-display-m:  1.05;
  --fs-heading:    20px;  --lh-heading:    1.2;
  --fs-body:       16px;  --lh-body:       1.6;
  --fs-small:      13px;  --lh-small:      1.5;
  --fs-eyebrow:    11px;  --lh-eyebrow:    1.4;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;
  --space-10: 128px;

  /* Layout */
  --container-max: 1280px;
  --container-padding: var(--space-5);

  /* Easings */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-soft: cubic-bezier(0.34, 1.2, 0.64, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Durations */
  --dur-fast: 200ms;
  --dur-normal: 400ms;
  --dur-slow: 800ms;
  --dur-cinematic: 1400ms;

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-pill: 999px;

  /* Z-index */
  --z-nav: 50;
  --z-modal: 100;
}

@media (min-width: 768px) {
  :root {
    --fs-display-xl: 88px;
    --fs-display-l:  56px;
    --fs-display-m:  36px;
    --fs-heading:    22px;
    --container-padding: var(--space-7);
  }
}
```

- [ ] **Step 2: Write `base.css`** — reset, typography, layout primitives

```css
/* base.css — reset, typography, layout primitives */

*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--color-ivory);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

img, picture, svg, video { max-width: 100%; height: auto; display: block; }
a { color: inherit; text-decoration: none; }
button { font: inherit; border: none; background: none; cursor: pointer; color: inherit; }
input, textarea, select { font: inherit; color: inherit; }

h1, h2, h3, h4, h5, h6 { margin: 0; font-weight: 400; }
p { margin: 0; }

/* Type utility classes */
.display-xl { font-family: var(--font-serif); font-style: italic; font-size: var(--fs-display-xl); line-height: var(--lh-display-xl); letter-spacing: -0.025em; }
.display-l  { font-family: var(--font-serif); font-style: italic; font-size: var(--fs-display-l);  line-height: var(--lh-display-l);  letter-spacing: -0.02em; }
.display-m  { font-family: var(--font-serif); font-style: italic; font-size: var(--fs-display-m);  line-height: var(--lh-display-m);  letter-spacing: -0.01em; }
.heading    { font-family: var(--font-sans);  font-weight: 700; font-size: var(--fs-heading); line-height: var(--lh-heading); letter-spacing: -0.01em; }
.body       { font-family: var(--font-sans); font-size: var(--fs-body); line-height: var(--lh-body); }
.small      { font-family: var(--font-sans); font-size: var(--fs-small); line-height: var(--lh-small); opacity: 0.7; }
.eyebrow    { font-family: var(--font-sans); font-size: var(--fs-eyebrow); letter-spacing: 0.25em; text-transform: uppercase; font-weight: 600; color: var(--color-court); }

/* Layout primitives */
.container {
  max-width: var(--container-max);
  margin-inline: auto;
  padding-inline: var(--container-padding);
}
.section { padding-block: var(--space-9); }
.section--tight { padding-block: var(--space-7); }
.stack > * + * { margin-top: var(--space-4); }
.stack-lg > * + * { margin-top: var(--space-6); }

/* Visually hidden (for screen readers only) */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0);
  white-space: nowrap; border: 0;
}

/* Focus ring (custom, replaces outline:none) */
:focus-visible {
  outline: 2px solid var(--color-court);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 3: Update placeholder `index.html` to load the stylesheets and render a sample**

Replace the body of `index.html`:

```html
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Badminton Vitosha — design system check</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital@1&family=Inter:wght@400;600;700&display=swap&subset=cyrillic,latin" rel="stylesheet">
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/base.css">
</head>
<body>
  <main class="container">
    <p class="eyebrow">Design system check</p>
    <h1 class="display-xl">Where the game finds its rhythm.</h1>
    <p class="body">Нашата зала разполага с 5 корта.</p>
    <p class="small">Open daily 8:00 — 22:00</p>
  </main>
</body>
</html>
```

- [ ] **Step 4: Verify in browser**

Run: `cd website && python3 -m http.server 8080`
Open: `http://localhost:8080/`
Expected: italic display-xl heading in Ink on Ivory background. Body text below in Inter. Eyebrow uppercase in court green. Cyrillic renders correctly without mojibake.

- [ ] **Step 5: Commit**

```bash
git add "Clients/Badminton Vitosha/website/css/" "Clients/Badminton Vitosha/website/index.html"
git commit -m "feat(badminton-vitosha): tokens + base layer (typography, palette, layout primitives)"
```

---

## Task 3: Components + motion CSS

**Files:**
- Create: `website/css/components.css`
- Create: `website/css/motion.css`
- Create: `website/css/pages.css` (empty placeholder; populated per-page later)

- [ ] **Step 1: Write `components.css`** — buttons, cards, nav skeleton, forms

```css
/* components.css — reusable UI components */

/* ---------- Buttons ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.05em;
  padding: 14px 24px;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    transform var(--dur-normal) var(--ease-out),
    background var(--dur-fast) ease,
    color var(--dur-fast) ease,
    border-color var(--dur-fast) ease;
}
.btn:hover { transform: translateY(-2px); }

.btn--primary { background: var(--color-court); color: var(--color-ivory); }
.btn--primary:hover { background: var(--color-court-deep); }

.btn--ghost { background: transparent; color: var(--color-ink); border-color: var(--color-ink); }
.btn--ghost:hover { background: var(--color-ink); color: var(--color-ivory); }

.btn--tonal { background: var(--color-stone); color: var(--color-ink); }
.btn--tonal:hover { background: #c4b58c; }

.btn--link {
  background: transparent;
  color: var(--color-ink);
  padding: 6px 0;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--color-ink);
}
.btn--link:hover { color: var(--color-court); border-color: var(--color-court); transform: none; }

/* ---------- Cards ---------- */
.card {
  background: #fff;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: transform var(--dur-normal) var(--ease-out), box-shadow var(--dur-normal) var(--ease-out);
}
.card:hover { transform: translateY(-4px); box-shadow: 0 24px 60px rgba(12, 26, 18, 0.08); }
.card__image { aspect-ratio: 4 / 3; background: var(--color-stone); overflow: hidden; }
.card__image img { width: 100%; height: 100%; object-fit: cover; }
.card__body { padding: var(--space-5); }
.card__meta { font-size: var(--fs-eyebrow); letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.5; }
.card__title { font-family: var(--font-serif); font-style: italic; font-size: 24px; line-height: 1.05; margin: var(--space-2) 0; }
.card__excerpt { font-size: var(--fs-small); line-height: 1.5; opacity: 0.75; margin-bottom: var(--space-3); }

/* ---------- Nav ---------- */
.nav {
  position: sticky; top: 0;
  z-index: var(--z-nav);
  background: rgba(247, 245, 238, 0.92);
  backdrop-filter: saturate(140%) blur(12px);
  border-bottom: 1px solid var(--color-line);
}
.nav__inner {
  max-width: var(--container-max);
  margin-inline: auto;
  padding: var(--space-4) var(--container-padding);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
}
.nav__logo img { height: 40px; width: auto; }
.nav__links {
  display: none;
  list-style: none;
  margin: 0; padding: 0;
  gap: var(--space-6);
}
.nav__links a { font-size: 14px; font-weight: 600; }
.nav__links a:hover { color: var(--color-court); }
.nav__lang { font-size: var(--fs-eyebrow); letter-spacing: 0.2em; text-transform: uppercase; }
.nav__lang a + a { margin-left: var(--space-2); }
.nav__lang a[aria-current="true"] { color: var(--color-court); font-weight: 700; }
.nav__toggle { display: inline-flex; }

@media (min-width: 960px) {
  .nav__links { display: flex; }
  .nav__toggle { display: none; }
}

/* Mobile drawer */
.nav__drawer {
  position: fixed;
  inset: 0 0 0 auto;
  width: min(360px, 100vw);
  background: var(--color-ivory);
  padding: var(--space-7) var(--space-5);
  transform: translateX(100%);
  transition: transform var(--dur-normal) var(--ease-out);
}
.nav__drawer[data-open="true"] { transform: translateX(0); }
.nav__drawer ul { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-4); }
.nav__drawer a { font-size: 22px; font-family: var(--font-serif); font-style: italic; }

/* ---------- Footer ---------- */
.footer {
  background: var(--color-ink);
  color: var(--color-ivory);
  padding-block: var(--space-9);
}
.footer__grid {
  display: grid; gap: var(--space-7);
  grid-template-columns: 1fr;
}
.footer__brand img { height: 60px; filter: invert(1); }
.footer__brand p { margin-top: var(--space-4); opacity: 0.7; max-width: 360px; }
.footer__col h4 { font-size: var(--fs-eyebrow); letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.55; margin-bottom: var(--space-3); }
.footer__col ul { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
.footer__col a { opacity: 0.85; }
.footer__col a:hover { color: var(--color-court); opacity: 1; }
.footer__legal { margin-top: var(--space-7); padding-top: var(--space-5); border-top: 1px solid rgba(247, 245, 238, 0.1); display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; opacity: 0.5; font-size: var(--fs-small); }

@media (min-width: 768px) {
  .footer__grid { grid-template-columns: 2fr 1fr 1fr 1fr; }
}

/* ---------- Forms ---------- */
.form { display: grid; gap: var(--space-4); }
.form__row { display: grid; gap: var(--space-1); }
.form__label { font-size: var(--fs-small); font-weight: 600; }
.form__input, .form__textarea, .form__select {
  background: #fff;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-size: var(--fs-body);
  transition: border-color var(--dur-fast) ease;
}
.form__input:focus, .form__textarea:focus, .form__select:focus { border-color: var(--color-court); outline: none; }
.form__textarea { min-height: 120px; resize: vertical; }
.form__error { color: var(--color-error); font-size: var(--fs-small); }
.form__hint { font-size: var(--fs-small); opacity: 0.65; }
```

- [ ] **Step 2: Write `motion.css`** — keyframes, motion utilities, `prefers-reduced-motion` overrides

```css
/* motion.css — keyframes, transitions, prefers-reduced-motion overrides */

/* Initial states for scroll-driven reveals (set by GSAP at boot) */
[data-anim="fade-up"] { opacity: 0; transform: translateY(24px); }
[data-anim="word-reveal"] { opacity: 0; }
[data-anim="word-reveal"] .word { display: inline-block; opacity: 0; transform: translateY(40px); }
[data-anim="draw-svg"] path,
[data-anim="draw-svg"] line { stroke-dasharray: 600; stroke-dashoffset: 600; }

/* Marquee ticker */
.ticker { overflow: hidden; }
.ticker__track {
  display: inline-flex;
  gap: var(--space-7);
  white-space: nowrap;
  animation: ticker-scroll 40s linear infinite;
}
@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* Magnetic CTA hover (decorative — JS will translate the inner span) */
.btn--magnet { position: relative; }
.btn--magnet > span { display: inline-block; transition: transform var(--dur-normal) var(--ease-spring); }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  [data-anim] { opacity: 1 !important; transform: none !important; }
  [data-anim] .word { opacity: 1 !important; transform: none !important; }
  [data-anim="draw-svg"] path,
  [data-anim="draw-svg"] line { stroke-dasharray: none !important; stroke-dashoffset: 0 !important; }
}
```

- [ ] **Step 3: Create empty `pages.css` with section header**

```css
/* pages.css — page-specific overrides. Sections added per page below. */
```

- [ ] **Step 4: Verify** — extend `index.html` to render a button, card, and (visually checked) all four button variants

Update `<head>` to add the new sheets:

```html
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/motion.css">
  <link rel="stylesheet" href="css/pages.css">
```

Update `<body>` to include:

```html
<main class="container" style="padding-block: 64px;">
  <p class="eyebrow">Component check</p>
  <h1 class="display-xl">Where the game finds its rhythm.</h1>
  <div style="display:flex;gap:14px;flex-wrap:wrap;margin-block: 32px;">
    <button class="btn btn--primary">Book a court →</button>
    <button class="btn btn--ghost">Learn more</button>
    <button class="btn btn--tonal">View prices</button>
    <a href="#" class="btn btn--link">Read the article</a>
  </div>
  <article class="card" style="max-width: 320px;">
    <div class="card__image"></div>
    <div class="card__body">
      <p class="card__meta">News · 27/01/2026</p>
      <h3 class="card__title">Free event: Get fit with a smile.</h3>
      <p class="card__excerpt">An open day for everyone curious about the sport.</p>
      <a href="#" class="btn btn--link">Read more</a>
    </div>
  </article>
</main>
```

Open: `http://localhost:8080/`
Expected: 4 buttons render with correct styles. Hover lifts primary by 2px and darkens. Card renders with hairline border, hover lifts by 4px with shadow. No layout breaks at mobile widths (375px) or desktop (1280px).

- [ ] **Step 5: Commit**

```bash
git add "Clients/Badminton Vitosha/website/css/" "Clients/Badminton Vitosha/website/index.html"
git commit -m "feat(badminton-vitosha): components + motion CSS (buttons, cards, nav, footer, forms)"
```

---

## Task 4: i18n module + dictionaries (with browser tests)

**Files:**
- Create: `website/js/i18n.js`
- Create: `website/js/i18n/bg.json`
- Create: `website/js/i18n/en.json`
- Create: `website/tests/i18n.test.html`

- [ ] **Step 1: Write `i18n.js`** — vanilla module that loads dictionary and applies `data-i18n` attributes

```javascript
// i18n.js — minimal client-side string substitution.
// Loads <lang>.json once, then walks the DOM and replaces text/attrs.
// Static HTML is the source of truth for content; this only swaps strings
// that genuinely vary between languages (form labels, alt text, ARIA).

const DEFAULT_LANG = 'bg';
const SUPPORTED = ['bg', 'en'];

function detectLang() {
  const path = window.location.pathname;
  if (path.startsWith('/en/') || path === '/en') return 'en';
  return 'bg';
}

async function loadDict(lang) {
  if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
  const base = lang === 'en' ? '/en/' : '/';
  // Walk up from /en/<page> back to root for the JSON file
  const url = new URL(`js/i18n/${lang}.json`, window.location.origin + '/').toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${lang}.json: ${res.status}`);
  return await res.json();
}

function get(dict, key) {
  return key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), dict);
}

export function applyDict(dict, root = document) {
  // Text content swap
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = get(dict, key);
    if (typeof value === 'string') el.textContent = value;
  });
  // Attribute swap: data-i18n-attr="aria-label:nav.book"
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    const pairs = el.getAttribute('data-i18n-attr').split(',');
    pairs.forEach(pair => {
      const [attr, key] = pair.split(':').map(s => s.trim());
      const value = get(dict, key);
      if (typeof value === 'string') el.setAttribute(attr, value);
    });
  });
}

export async function bootI18n() {
  const lang = detectLang();
  document.documentElement.lang = lang;
  try {
    const dict = await loadDict(lang);
    applyDict(dict);
    return { lang, dict };
  } catch (err) {
    console.error('[i18n] boot failed', err);
    return { lang, dict: null };
  }
}

// Expose for tests
export const __test = { detectLang, loadDict, get };
```

- [ ] **Step 2: Write minimal `bg.json` and `en.json`** with nav/footer keys

`website/js/i18n/bg.json`:

```json
{
  "nav": {
    "home": "Начало",
    "book": "Резервирай корт",
    "kids": "Детски тренировки",
    "rules": "Правила и екипировка",
    "shop": "Магазин",
    "gallery": "Галерия",
    "about": "За нас",
    "contacts": "Контакти",
    "menu": "Меню",
    "close": "Затвори"
  },
  "footer": {
    "tagline": "Зала за бадминтон в София.",
    "explore": "Разгледай",
    "info": "Информация",
    "contact": "Контакт",
    "terms": "Общи условия",
    "privacy": "Защита на личните данни",
    "refund": "Условия за отказ",
    "rights": "Всички права запазени."
  },
  "form": {
    "name": "Име",
    "email": "Имейл",
    "phone": "Телефон",
    "message": "Съобщение",
    "submit": "Изпрати",
    "required": "Това поле е задължително",
    "invalid_email": "Моля въведи валиден имейл"
  }
}
```

`website/js/i18n/en.json`:

```json
{
  "nav": {
    "home": "Home",
    "book": "Book a court",
    "kids": "Kids training",
    "rules": "Rules & equipment",
    "shop": "Shop",
    "gallery": "Gallery",
    "about": "About",
    "contacts": "Contacts",
    "menu": "Menu",
    "close": "Close"
  },
  "footer": {
    "tagline": "An indoor badminton hall in Sofia.",
    "explore": "Explore",
    "info": "Information",
    "contact": "Contact",
    "terms": "Terms",
    "privacy": "Privacy",
    "refund": "Refund policy",
    "rights": "All rights reserved."
  },
  "form": {
    "name": "Name",
    "email": "Email",
    "phone": "Phone",
    "message": "Message",
    "submit": "Send",
    "required": "This field is required",
    "invalid_email": "Please enter a valid email"
  }
}
```

- [ ] **Step 3: Write `tests/i18n.test.html`** — browser-based assertions

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>i18n tests</title>
  <style>
    body { font: 14px monospace; padding: 24px; background: #f5f5f5; }
    .pass { color: #0a8050; }
    .fail { color: #b23b3b; }
  </style>
</head>
<body>
<h1>i18n.js tests</h1>
<ol id="results"></ol>

<!-- Fixtures -->
<div hidden>
  <p data-i18n="nav.home" id="t1"></p>
  <p data-i18n="form.name" id="t2"></p>
  <p data-i18n="missing.key" id="t3">FALLBACK</p>
  <input data-i18n-attr="placeholder:form.email, aria-label:form.email" id="t4">
</div>

<script type="module">
import { applyDict, __test } from '../js/i18n.js';

const results = document.getElementById('results');
function assert(label, condition) {
  const li = document.createElement('li');
  li.className = condition ? 'pass' : 'fail';
  li.textContent = (condition ? '✅ PASS — ' : '❌ FAIL — ') + label;
  results.appendChild(li);
}

// Test 1: get() returns nested values
const dict = { nav: { home: 'Home' }, form: { name: 'Name', email: 'Email' } };
assert('get() returns nested string', __test.get(dict, 'nav.home') === 'Home');
assert('get() returns undefined for missing key', __test.get(dict, 'missing.key') === undefined);

// Test 2: applyDict() swaps text content
applyDict(dict);
assert('applyDict swaps nav.home text', document.getElementById('t1').textContent === 'Home');
assert('applyDict swaps form.name text', document.getElementById('t2').textContent === 'Name');
assert('applyDict leaves missing keys alone', document.getElementById('t3').textContent === 'FALLBACK');

// Test 3: applyDict() handles attribute swaps
const t4 = document.getElementById('t4');
assert('applyDict sets placeholder attribute', t4.getAttribute('placeholder') === 'Email');
assert('applyDict sets aria-label attribute', t4.getAttribute('aria-label') === 'Email');

// Test 4: detectLang
const origPath = window.location.pathname;
// can't easily mock pathname; document the expected behavior instead
assert('detectLang exists and is callable', typeof __test.detectLang === 'function');
</script>
</body>
</html>
```

- [ ] **Step 4: Run tests**

Run: `cd website && python3 -m http.server 8080`
Open: `http://localhost:8080/tests/i18n.test.html`
Expected: All test rows print "✅ PASS". No "❌ FAIL" lines.

- [ ] **Step 5: Commit**

```bash
git add "Clients/Badminton Vitosha/website/js/" "Clients/Badminton Vitosha/website/tests/i18n.test.html"
git commit -m "feat(badminton-vitosha): i18n module with bg/en dictionaries + browser tests"
```

---

## Task 5: Page template + main.js boot

**Files:**
- Create: `website/js/main.js`
- Modify: `website/index.html` (refactor to canonical page template, will become the home page)

This task replaces the throwaway `index.html` with the canonical page template that all subsequent pages will copy. Nav and footer markup live here as ground truth.

- [ ] **Step 1: Write `main.js`** — boot module

```javascript
// main.js — site boot. Wires i18n, mobile nav drawer, lang switcher.
import { bootI18n } from './i18n.js';

function setupNavDrawer() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const drawer = document.querySelector('[data-nav-drawer]');
  if (!toggle || !drawer) return;
  toggle.addEventListener('click', () => {
    const open = drawer.getAttribute('data-open') === 'true';
    drawer.setAttribute('data-open', String(!open));
    toggle.setAttribute('aria-expanded', String(!open));
  });
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    drawer.setAttribute('data-open', 'false');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

function setupActiveNav() {
  const path = window.location.pathname.replace(/^\/en\//, '/').replace(/\/$/, '') || '/';
  document.querySelectorAll('[data-nav-link]').forEach(a => {
    const href = a.getAttribute('href').replace(/^\/en\//, '/').replace(/\/$/, '') || '/';
    if (href === path) a.setAttribute('aria-current', 'page');
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await bootI18n();
  setupNavDrawer();
  setupActiveNav();
});
```

- [ ] **Step 2: Rewrite `website/index.html`** as the canonical home page (with full nav, footer, hero block, news teaser placeholder, contact teaser)

```html
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Badminton Vitosha — Зала за бадминтон в София</title>
  <meta name="description" content="Зала за бадминтон Витоша — 5 професионални корта в София. Резервирай корт онлайн, детски тренировки, екипировка.">
  <link rel="canonical" href="https://badminton-vitosha.bg/">
  <link rel="alternate" hreflang="bg" href="https://badminton-vitosha.bg/">
  <link rel="alternate" hreflang="en" href="https://badminton-vitosha.bg/en/">
  <link rel="alternate" hreflang="x-default" href="https://badminton-vitosha.bg/">
  <link rel="icon" href="/assets/logo.svg" type="image/svg+xml">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital@1&family=Inter:wght@400;600;700&display=swap&subset=cyrillic,latin" rel="stylesheet">

  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="stylesheet" href="/css/pages.css">
  <link rel="stylesheet" href="/css/motion.css">

  <script type="module" src="/js/main.js" defer></script>
</head>
<body>

<a class="sr-only" href="#main">Skip to content</a>

<header class="nav">
  <div class="nav__inner">
    <a class="nav__logo" href="/" aria-label="Badminton Vitosha — начало">
      <img src="/assets/logo.svg" alt="" width="40" height="40">
    </a>
    <nav aria-label="Primary">
      <ul class="nav__links">
        <li><a href="/" data-nav-link data-i18n="nav.home"></a></li>
        <li><a href="/book.html" data-nav-link data-i18n="nav.book"></a></li>
        <li><a href="/kids.html" data-nav-link data-i18n="nav.kids"></a></li>
        <li><a href="/rules.html" data-nav-link data-i18n="nav.rules"></a></li>
        <li><a href="/shop.html" data-nav-link data-i18n="nav.shop"></a></li>
        <li><a href="/gallery.html" data-nav-link data-i18n="nav.gallery"></a></li>
        <li><a href="/about.html" data-nav-link data-i18n="nav.about"></a></li>
        <li><a href="/contacts.html" data-nav-link data-i18n="nav.contacts"></a></li>
      </ul>
    </nav>
    <div class="nav__lang">
      <a href="/" aria-current="true">BG</a> <a href="/en/">EN</a>
    </div>
    <button class="nav__toggle btn btn--ghost" data-nav-toggle aria-expanded="false" aria-controls="mobile-drawer" data-i18n="nav.menu"></button>
  </div>
</header>

<aside id="mobile-drawer" class="nav__drawer" data-nav-drawer aria-label="Mobile menu">
  <ul>
    <li><a href="/" data-i18n="nav.home"></a></li>
    <li><a href="/book.html" data-i18n="nav.book"></a></li>
    <li><a href="/kids.html" data-i18n="nav.kids"></a></li>
    <li><a href="/rules.html" data-i18n="nav.rules"></a></li>
    <li><a href="/shop.html" data-i18n="nav.shop"></a></li>
    <li><a href="/gallery.html" data-i18n="nav.gallery"></a></li>
    <li><a href="/about.html" data-i18n="nav.about"></a></li>
    <li><a href="/contacts.html" data-i18n="nav.contacts"></a></li>
  </ul>
</aside>

<main id="main">
  <!-- Home hero (Task 6) — placeholder for now -->
  <section class="container section">
    <p class="eyebrow">София · 5 закрити корта</p>
    <h1 class="display-xl">Where the game finds its rhythm.</h1>
    <p class="body" style="max-width: 540px; margin-top: 24px;">Нашата зала разполага с 5 корта, създадена е специално за любителите и професионалистите в бадминтона.</p>
  </section>
</main>

<footer class="footer">
  <div class="container footer__grid">
    <div class="footer__brand">
      <img src="/assets/logo.svg" alt="Badminton Vitosha">
      <p data-i18n="footer.tagline"></p>
    </div>
    <div class="footer__col">
      <h4 data-i18n="footer.explore"></h4>
      <ul>
        <li><a href="/" data-i18n="nav.home"></a></li>
        <li><a href="/book.html" data-i18n="nav.book"></a></li>
        <li><a href="/kids.html" data-i18n="nav.kids"></a></li>
        <li><a href="/shop.html" data-i18n="nav.shop"></a></li>
      </ul>
    </div>
    <div class="footer__col">
      <h4 data-i18n="footer.info"></h4>
      <ul>
        <li><a href="/rules.html" data-i18n="nav.rules"></a></li>
        <li><a href="/gallery.html" data-i18n="nav.gallery"></a></li>
        <li><a href="/about.html" data-i18n="nav.about"></a></li>
      </ul>
    </div>
    <div class="footer__col">
      <h4 data-i18n="footer.contact"></h4>
      <ul>
        <li><a href="tel:+359888900083">0888 9000 83</a></li>
        <li><a href="mailto:badminton@margel.info">badminton@margel.info</a></li>
        <li><a href="/contacts.html" data-i18n="nav.contacts"></a></li>
      </ul>
    </div>
  </div>
  <div class="container footer__legal">
    <span>© 2026 Badminton Vitosha. <span data-i18n="footer.rights"></span></span>
    <span>
      <a href="/legal/terms.html" data-i18n="footer.terms"></a> ·
      <a href="/legal/privacy.html" data-i18n="footer.privacy"></a> ·
      <a href="/legal/refund.html" data-i18n="footer.refund"></a>
    </span>
  </div>
</footer>

</body>
</html>
```

- [ ] **Step 3: Verify in browser**

Run: `cd website && python3 -m http.server 8080`
Open: `http://localhost:8080/`
Expected:
- Nav renders at top with all 8 links + BG/EN switcher.
- Logo appears in nav and footer.
- Footer renders 4 columns on desktop, 1 column on mobile (resize the window to verify).
- Mobile (<960px width): hamburger button labeled "Меню" appears; clicking it opens drawer; clicking link inside closes it.
- Active page (`/`) has `aria-current="page"` on its nav link (verify in DevTools).
- All Bulgarian text renders without mojibake.

- [ ] **Step 4: Verify keyboard accessibility**

Tab through the page from the address bar. Expected: skip-link is the first focused element; nav links receive focus rings; hamburger toggle (mobile) receives focus.

- [ ] **Step 5: Commit**

```bash
git add "Clients/Badminton Vitosha/website/js/main.js" "Clients/Badminton Vitosha/website/index.html"
git commit -m "feat(badminton-vitosha): page template with nav, footer, mobile drawer, lang switcher"
```

---

## Task 6: Home page (full content) + EN mirror

**Files:**
- Modify: `website/index.html` (replace placeholder hero with full home content)
- Create: `website/en/index.html`
- Modify: `website/css/pages.css` (add home-specific styles)
- Modify: `website/js/i18n/bg.json`, `en.json` (add home keys)

- [ ] **Step 1: Add home keys to dictionaries**

Add this block to **both** `bg.json` and `en.json` under root level. BG values:

```json
"home": {
  "eyebrow": "София · 5 закрити корта",
  "title": "Където играта намира своя ритъм.",
  "intro": "Нашата зала разполага с 5 корта, създадена е специално за любителите и професионалистите в бадминтона, като предлага страхотни условия за тренировки и игри.",
  "cta_book": "Резервирай корт",
  "cta_learn": "Виж залата",
  "highlights_title": "Защо ние",
  "highlight_floor": "Професионални настилки за добро сцепление и грижа за ставите.",
  "highlight_lights": "Анти-отблясъчно осветление за отлична видимост на перото.",
  "highlight_courts": "5 регулярни корта за тренировки, игра и турнири.",
  "kids_eyebrow": "Детски тренировки",
  "kids_title": "Групови тренировки за деца от 7 до 14 г.",
  "kids_lead": "Coach-led сесии с фокус върху агилност, работа на крака и игрова техника.",
  "kids_cta": "Запиши детето",
  "news_title": "Новини и събития",
  "partners_title": "Работим с"
}
```

EN values:

```json
"home": {
  "eyebrow": "Sofia · 5 indoor courts",
  "title": "Where the game finds its rhythm.",
  "intro": "Our hall has 5 courts, designed for both amateurs and professional players, offering great conditions for training and play.",
  "cta_book": "Book a court",
  "cta_learn": "See the venue",
  "highlights_title": "Why us",
  "highlight_floor": "Professional flooring for grip and joint protection.",
  "highlight_lights": "Anti-glare lighting designed for shuttlecock visibility.",
  "highlight_courts": "5 regulation courts for training, play, and tournaments.",
  "kids_eyebrow": "Kids training",
  "kids_title": "Group training for ages 7 to 14.",
  "kids_lead": "Coach-led sessions in agility, footwork, and match technique.",
  "kids_cta": "Sign up your child",
  "news_title": "News & events",
  "partners_title": "We work with"
}
```

- [ ] **Step 2: Replace `<main>` content in `index.html`**

```html
<main id="main">

  <!-- Hero -->
  <section class="home-hero container section">
    <p class="eyebrow" data-i18n="home.eyebrow"></p>
    <h1 class="display-xl home-hero__title" data-anim="word-reveal" data-i18n="home.title"></h1>
    <p class="body home-hero__lead" data-i18n="home.intro"></p>
    <div class="home-hero__cta">
      <a href="/book.html" class="btn btn--primary btn--magnet"><span data-i18n="home.cta_book"></span></a>
      <a href="/about.html" class="btn btn--ghost" data-i18n="home.cta_learn"></a>
    </div>
    <div class="home-hero__media" data-anim="fade-up">
      <img src="/assets/images/hall-banner.png" alt="Гледка от залата на Badminton Vitosha" loading="eager" fetchpriority="high">
    </div>
  </section>

  <!-- Highlights -->
  <section class="container section">
    <p class="eyebrow" data-i18n="home.highlights_title"></p>
    <div class="home-highlights">
      <article class="home-highlight">
        <h3 class="display-m" data-i18n="home.highlight_floor"></h3>
      </article>
      <article class="home-highlight">
        <h3 class="display-m" data-i18n="home.highlight_lights"></h3>
      </article>
      <article class="home-highlight">
        <h3 class="display-m" data-i18n="home.highlight_courts"></h3>
      </article>
    </div>
  </section>

  <!-- Kids teaser -->
  <section class="container section home-kids">
    <div>
      <p class="eyebrow" data-i18n="home.kids_eyebrow"></p>
      <h2 class="display-l" data-i18n="home.kids_title"></h2>
      <p class="body" data-i18n="home.kids_lead"></p>
      <a href="/kids.html" class="btn btn--primary"><span data-i18n="home.kids_cta"></span></a>
    </div>
    <img src="/assets/images/hero-boy.jpg" alt="Дете на тренировка по бадминтон" loading="lazy">
  </section>

  <!-- News -->
  <section class="container section">
    <h2 class="display-m" data-i18n="home.news_title"></h2>
    <div class="home-news">
      <!-- 3 most recent news cards — populated in Task 14 once news pages exist -->
      <a class="card" href="/news/besplatno-sabitie.html">
        <div class="card__image"></div>
        <div class="card__body">
          <p class="card__meta">27/01/2026</p>
          <h3 class="card__title">Безплатно Събитие ВЛЕЗ ВЪВ ФОРМА С УСМИВКА!</h3>
        </div>
      </a>
      <a class="card" href="/news/rabotim-s-multisport.html">
        <div class="card__image"></div>
        <div class="card__body">
          <p class="card__meta">24/06/2025</p>
          <h3 class="card__title">Работим с Multisport</h3>
        </div>
      </a>
      <a class="card" href="/news/naredba-turnir-2025.html">
        <div class="card__image"></div>
        <div class="card__body">
          <p class="card__meta">06/06/2025</p>
          <h3 class="card__title">НАРЕДБА за ТУРНИР ПО БАДМИНТОН 2025</h3>
        </div>
      </a>
    </div>
  </section>

  <!-- Partners ticker -->
  <section class="ticker section--tight" aria-label="Partners">
    <div class="ticker__track">
      <span class="display-m">YONEX</span> · <span class="display-m">FZ Forza</span> · <span class="display-m">Multisport</span> · <span class="display-m">Margel</span> ·
      <span class="display-m">YONEX</span> · <span class="display-m">FZ Forza</span> · <span class="display-m">Multisport</span> · <span class="display-m">Margel</span>
    </div>
  </section>

</main>
```

- [ ] **Step 3: Add home page styles to `pages.css`**

```css
/* ---------- Home ---------- */
.home-hero { padding-top: var(--space-7); }
.home-hero__title { max-width: 14ch; margin-block: var(--space-5); }
.home-hero__lead { max-width: 540px; }
.home-hero__cta { display: flex; gap: var(--space-3); flex-wrap: wrap; margin-block: var(--space-6); }
.home-hero__media img { border-radius: var(--radius-md); aspect-ratio: 21/9; object-fit: cover; }

.home-highlights { display: grid; gap: var(--space-6); margin-top: var(--space-6); }
@media (min-width: 768px) { .home-highlights { grid-template-columns: repeat(3, 1fr); } }
.home-highlight h3 { max-width: 18ch; }

.home-kids { display: grid; gap: var(--space-6); align-items: center; }
@media (min-width: 768px) { .home-kids { grid-template-columns: 1fr 1fr; } }
.home-kids img { border-radius: var(--radius-md); aspect-ratio: 4/5; object-fit: cover; }

.home-news { display: grid; gap: var(--space-5); margin-top: var(--space-6); }
@media (min-width: 768px) { .home-news { grid-template-columns: repeat(3, 1fr); } }
```

- [ ] **Step 4: Create `website/en/index.html`** — copy `index.html`, then change:
  - `<html lang="en">`
  - `<title>Badminton Vitosha — Indoor badminton hall in Sofia</title>`
  - `<meta name="description" content="Badminton Vitosha — 5 indoor courts in Sofia. Book online, kids training, equipment.">`
  - `<link rel="canonical" href="https://badminton-vitosha.bg/en/">`
  - All nav/footer link `href` attributes prefixed with `/en` (e.g., `/en/book.html`, `/en/`).
  - `nav__lang`: `<a href="/">BG</a> <a href="/en/" aria-current="true">EN</a>`

The body content uses the same `data-i18n` keys; only the language switcher and link hrefs differ.

- [ ] **Step 5: Verify both pages**

Open: `http://localhost:8080/` — Bulgarian renders, hero text in Cormorant Italic, nav and footer in Bulgarian.
Open: `http://localhost:8080/en/` — English renders, same layout, English text.
Switch BG ↔ EN via nav: lands on the sibling URL.

Verify with DevTools that `<html lang="bg">` on `/` and `<html lang="en">` on `/en/` after JS boot.

- [ ] **Step 6: Commit**

```bash
git add "Clients/Badminton Vitosha/website/index.html" "Clients/Badminton Vitosha/website/en/index.html" "Clients/Badminton Vitosha/website/css/pages.css" "Clients/Badminton Vitosha/website/js/i18n/"
git commit -m "feat(badminton-vitosha): home page (BG + EN) with hero, highlights, kids teaser, news, ticker"
```

---

## Task 7: Book page with Phase 1 placeholder form

**Files:**
- Create: `website/book.html`
- Create: `website/en/book.html`
- Create: `website/thanks/slot.html`
- Create: `website/thanks/en/slot.html`
- Modify: `website/css/pages.css`
- Modify: `bg.json`, `en.json` (book keys)

- [ ] **Step 1: Add book keys to dictionaries**

BG `home` already exists; add a new top-level `book` block. Same shape in `en.json` with English values.

```json
"book": {
  "eyebrow": "Резервация",
  "title": "Резервирай корт.",
  "lead": "Попълни формата по-долу. Ще получиш потвърждение по имейл до 24 часа. Скоро ще добавим директна резервация в реално време.",
  "field_date": "Желана дата",
  "field_time": "Час (диапазон)",
  "field_courts": "Брой корти",
  "field_message": "Допълнителна информация",
  "submit": "Изпрати заявката",
  "prices_title": "Цени",
  "price_offpeak": "08:00 — 16:00 · €6.65 / час / човек",
  "price_peak": "16:00 — 22:00 · €9.20 / час / човек",
  "rules_link": "Виж правилата →"
}
```

- [ ] **Step 2: Build `website/book.html`** — copy `index.html`'s page shell (head, nav, footer); replace `<main>`:

```html
<main id="main">
  <section class="container section">
    <p class="eyebrow" data-i18n="book.eyebrow"></p>
    <h1 class="display-l" data-anim="word-reveal" data-i18n="book.title"></h1>
    <p class="body book-lead" data-i18n="book.lead"></p>
  </section>

  <section class="container book-grid section--tight">
    <form
      name="slot-request-bg"
      method="POST"
      data-netlify="true"
      action="/thanks/slot.html"
      class="form book-form"
    >
      <input type="hidden" name="form-name" value="slot-request-bg">
      <p hidden><label>Don't fill this: <input name="bot-field"></label></p>

      <div class="form__row">
        <label class="form__label" for="name" data-i18n="form.name"></label>
        <input class="form__input" id="name" name="name" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="email" data-i18n="form.email"></label>
        <input class="form__input" id="email" name="email" type="email" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="phone" data-i18n="form.phone"></label>
        <input class="form__input" id="phone" name="phone" type="tel" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="date" data-i18n="book.field_date"></label>
        <input class="form__input" id="date" name="date" type="date" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="time" data-i18n="book.field_time"></label>
        <input class="form__input" id="time" name="time" placeholder="напр. 18:00 — 20:00" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="courts" data-i18n="book.field_courts"></label>
        <select class="form__select" id="courts" name="courts" required>
          <option value="1">1</option><option value="2">2</option>
          <option value="3">3</option><option value="4">4</option><option value="5">5</option>
        </select>
      </div>
      <div class="form__row">
        <label class="form__label" for="message" data-i18n="book.field_message"></label>
        <textarea class="form__textarea" id="message" name="message"></textarea>
      </div>
      <button class="btn btn--primary" type="submit"><span data-i18n="book.submit"></span></button>
    </form>

    <aside class="book-prices">
      <h2 class="display-m" data-i18n="book.prices_title"></h2>
      <ul class="stack">
        <li class="heading" data-i18n="book.price_offpeak"></li>
        <li class="heading" data-i18n="book.price_peak"></li>
      </ul>
      <a href="/rules.html" class="btn btn--link" data-i18n="book.rules_link"></a>
    </aside>
  </section>
</main>
```

- [ ] **Step 3: Add book styles to `pages.css`**

```css
/* ---------- Book ---------- */
.book-lead { max-width: 60ch; margin-top: var(--space-4); }
.book-grid { display: grid; gap: var(--space-7); align-items: start; }
@media (min-width: 768px) { .book-grid { grid-template-columns: 2fr 1fr; } }
.book-form { background: #fff; padding: var(--space-6); border-radius: var(--radius-md); border: 1px solid var(--color-line); }
.book-prices { padding: var(--space-6); background: var(--color-stone); border-radius: var(--radius-md); }
.book-prices h2 { margin-bottom: var(--space-4); }
```

- [ ] **Step 4: Create `website/thanks/slot.html`** — minimal thank-you page

```html
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Заявката е получена — Badminton Vitosha</title>
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/components.css">
  <meta name="robots" content="noindex">
</head>
<body>
<main class="container" style="padding-block: 96px; text-align: center;">
  <p class="eyebrow">Благодарим</p>
  <h1 class="display-l">Получихме заявката ти.</h1>
  <p class="body" style="margin: 24px auto; max-width: 50ch;">Ще ти потвърдим по имейл до 24 часа. Ако нямаш търпение, обади се на 0888 9000 83.</p>
  <a href="/" class="btn btn--ghost">Към началото</a>
</main>
</body>
</html>
```

- [ ] **Step 5: Build `website/en/book.html`** — same as `book.html` but:
  - `<html lang="en">`, EN title and meta description
  - All nav/footer hrefs `/en/`-prefixed
  - `<form name="slot-request-en">` (separate Netlify form name)
  - `action="/en/thanks/slot.html"`
  - `<input type="hidden" name="form-name" value="slot-request-en">`

Then create `website/en/thanks/slot.html` as the EN thank-you page (mirror of the BG one).

- [ ] **Step 6: Verify**

Open `http://localhost:8080/book.html`. Expected: page renders, form fields all visible, prices aside visible. Submit the form locally — browser will fail (no Netlify locally) but DevTools should show the submit went to `/thanks/slot.html` form action. Open `http://localhost:8080/thanks/slot.html` directly — thank-you page renders.

- [ ] **Step 7: Commit**

```bash
git add "Clients/Badminton Vitosha/website/book.html" "Clients/Badminton Vitosha/website/en/book.html" "Clients/Badminton Vitosha/website/thanks/" "Clients/Badminton Vitosha/website/css/pages.css" "Clients/Badminton Vitosha/website/js/i18n/"
git commit -m "feat(badminton-vitosha): book page with Phase 1 'request a slot' Netlify form"
```

---

## Task 8: Kids training page with sign-up form

**Files:**
- Create: `website/kids.html`
- Create: `website/en/kids.html`
- Create: `website/thanks/kids.html`, `website/thanks/en/kids.html`
- Modify: `website/css/pages.css`
- Modify: `bg.json`, `en.json` (kids keys)

- [ ] **Step 1: Add `kids` keys to both dictionaries**

```json
"kids": {
  "eyebrow": "Детски тренировки",
  "title": "Тренировки за деца от 7 до 14 г.",
  "lead": "Групови сесии под ръководството на треньор. Фокус върху агилност, работа на крака, игрова техника, и любов към играта.",
  "schedule_title": "График",
  "schedule_placeholder": "Графикът ще бъде потвърден от клиента — стъб до тогава.",
  "coach_title": "Треньор",
  "coach_placeholder": "Име и био на треньора предстои да бъдат добавени.",
  "signup_title": "Запиши детето",
  "field_child_name": "Име на детето",
  "field_child_age": "Възраст",
  "submit": "Изпрати"
}
```

EN equivalent with English values.

- [ ] **Step 2: Build `kids.html`** — copy page shell, replace `<main>`:

```html
<main id="main">

  <section class="container section">
    <p class="eyebrow" data-i18n="kids.eyebrow"></p>
    <h1 class="display-l" data-anim="word-reveal" data-i18n="kids.title"></h1>
    <p class="body" style="max-width: 60ch; margin-top: var(--space-4);" data-i18n="kids.lead"></p>
    <img src="/assets/images/hero-boy.jpg" alt="Дете на тренировка" style="margin-top: var(--space-6); border-radius: var(--radius-md);">
  </section>

  <section class="container section--tight">
    <h2 class="display-m" data-i18n="kids.schedule_title"></h2>
    <!-- TODO: client to provide actual schedule (days, times, age groups) -->
    <p class="body" data-i18n="kids.schedule_placeholder"></p>
  </section>

  <section class="container section--tight">
    <h2 class="display-m" data-i18n="kids.coach_title"></h2>
    <!-- TODO: client to provide coach name, photo, bio -->
    <p class="body" data-i18n="kids.coach_placeholder"></p>
  </section>

  <section class="container section">
    <h2 class="display-m" data-i18n="kids.signup_title"></h2>
    <form name="kids-signup-bg" method="POST" data-netlify="true" action="/thanks/kids.html" class="form" style="max-width: 540px; margin-top: var(--space-5);">
      <input type="hidden" name="form-name" value="kids-signup-bg">
      <p hidden><label>Don't fill this: <input name="bot-field"></label></p>

      <div class="form__row">
        <label class="form__label" for="parent-name" data-i18n="form.name"></label>
        <input class="form__input" id="parent-name" name="parent_name" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="parent-email" data-i18n="form.email"></label>
        <input class="form__input" id="parent-email" name="parent_email" type="email" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="parent-phone" data-i18n="form.phone"></label>
        <input class="form__input" id="parent-phone" name="parent_phone" type="tel" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="child-name" data-i18n="kids.field_child_name"></label>
        <input class="form__input" id="child-name" name="child_name" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="child-age" data-i18n="kids.field_child_age"></label>
        <input class="form__input" id="child-age" name="child_age" type="number" min="5" max="18" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="message" data-i18n="form.message"></label>
        <textarea class="form__textarea" id="message" name="message"></textarea>
      </div>
      <button class="btn btn--primary" type="submit"><span data-i18n="kids.submit"></span></button>
    </form>
  </section>

</main>
```

- [ ] **Step 3: Build EN mirror at `website/en/kids.html`** — same structure, `<html lang="en">`, EN meta, EN nav links, form name `kids-signup-en`, action `/en/thanks/kids.html`.

- [ ] **Step 4: Build `thanks/kids.html` and `en/thanks/kids.html`** — clones of `thanks/slot.html` with kids-specific copy.

- [ ] **Step 5: Verify**

Open `/kids.html` and `/en/kids.html`. Confirm:
- Page renders; image loads.
- Form has BG / EN labels.
- Required field validation triggers when fields are empty.
- TODO comments are visible in source for the schedule and coach blocks.

- [ ] **Step 6: Commit**

```bash
git add "Clients/Badminton Vitosha/website/kids.html" "Clients/Badminton Vitosha/website/en/kids.html" "Clients/Badminton Vitosha/website/thanks/kids.html" "Clients/Badminton Vitosha/website/thanks/en/kids.html" "Clients/Badminton Vitosha/website/css/pages.css" "Clients/Badminton Vitosha/website/js/i18n/"
git commit -m "feat(badminton-vitosha): kids training page with sign-up Netlify form"
```

---

## Task 9: Rules & equipment page

**Files:**
- Create: `website/rules.html`
- Create: `website/en/rules.html`
- Modify: `bg.json`, `en.json` (rules keys)

- [ ] **Step 1: Fetch existing rules + equipment copy**

Use `WebFetch` (or `curl + lynx -dump` for a clean text extract) on both:
- `https://badminton-vitosha.bg/правила/` (rules)
- `https://badminton-vitosha.bg/екипировка/` (equipment guidance)

Save the extracted text to `/tmp/rules-bg.txt` and `/tmp/equipment-bg.txt`. These become the source-of-truth Bulgarian copy.

- [ ] **Step 2: Add `rules` keys to both dictionaries**

Translate for EN.

Structure:

```json
"rules": {
  "eyebrow": "Правила",
  "title": "Правила и екипировка.",
  "intro": "Заедно правим залата по-добра. Молим всеки играч да следва тези прости правила.",
  "court_rules_title": "Правила на корта",
  "court_rules_body": "<...verbatim from old site...>",
  "equipment_title": "Какво да донесеш",
  "equipment_body": "<...verbatim from old site...>"
}
```

(Use HTML in JSON values where formatting matters — `i18n.js` will use `textContent` so multi-paragraph copy needs separate keys, e.g., `court_rules_p1`, `court_rules_p2`. Refactor to flat-paragraph keys as needed.)

- [ ] **Step 3: Build `rules.html`** — page shell + content blocks rendered via `data-i18n` keys.

- [ ] **Step 4: Build EN mirror**

- [ ] **Step 5: Verify** — both pages render; copy is preserved exactly from the old site for BG; EN reads naturally.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(badminton-vitosha): rules & equipment page"
```

---

## Task 10: Shop (showcase catalog)

**Files:**
- Create: `website/shop.html`
- Create: `website/en/shop.html`
- Modify: `website/css/pages.css`
- Modify: `bg.json`, `en.json` (shop keys)

- [ ] **Step 1: Stub product list**

The client has not yet provided products. Either receive a real product list before this task or invent **8 representative samples** (rackets, shuttlecocks, strings, grips, shoes, bags, apparel, accessories) using YONEX / FZ Forza brands per the venue's partner branding. Mark each product with `<!-- TODO: client to confirm/provide photo -->`.

- [ ] **Step 2: Add `shop` keys**

```json
"shop": {
  "eyebrow": "Магазин",
  "title": "Екипировка от партньорите ни.",
  "lead": "Разгледай каталога. Поръчките се правят на място в залата или по Viber на 0888 9000 83.",
  "filter_all": "Всички",
  "filter_rackets": "Ракети",
  "filter_shuttles": "Пера",
  "filter_apparel": "Облекло",
  "filter_accessories": "Аксесоари",
  "cta_ask": "Питай в залата"
}
```

- [ ] **Step 3: Build `shop.html`** — page shell + grid of product cards. Each card: image placeholder, brand eyebrow, title, short spec, "Питай в залата" CTA linking to `tel:+359888900083`.

```html
<section class="container section">
  <p class="eyebrow" data-i18n="shop.eyebrow"></p>
  <h1 class="display-l" data-anim="word-reveal" data-i18n="shop.title"></h1>
  <p class="body" style="max-width: 60ch; margin-top: var(--space-4);" data-i18n="shop.lead"></p>
</section>

<section class="container section--tight">
  <div class="shop-grid">
    <!-- repeat 8 times: -->
    <article class="card">
      <div class="card__image">
        <!-- TODO: client to provide photo -->
      </div>
      <div class="card__body">
        <p class="card__meta">YONEX</p>
        <h3 class="card__title">Astrox 88D Pro</h3>
        <p class="card__excerpt">Performance racket, head-heavy. Available to try at the venue.</p>
        <a href="tel:+359888900083" class="btn btn--ghost"><span data-i18n="shop.cta_ask"></span></a>
      </div>
    </article>
  </div>
</section>
```

CSS:

```css
.shop-grid { display: grid; gap: var(--space-5); }
@media (min-width: 600px) { .shop-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 960px) { .shop-grid { grid-template-columns: repeat(4, 1fr); } }
```

- [ ] **Step 4: Build EN mirror**

- [ ] **Step 5: Verify** — grid renders 4-up on desktop, 2-up on tablet, 1-up on mobile. All cards have a tel: CTA.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(badminton-vitosha): shop catalog (showcase, 'ask at venue' CTA)"
```

---

## Task 11: Gallery page

**Files:**
- Create: `website/gallery.html`
- Create: `website/en/gallery.html`
- Modify: `website/css/pages.css`
- Modify: `bg.json`, `en.json` (gallery keys)

Use the venue photos provided by Angel during brainstorming (kids group training, adult doubles match, court interior with YONEX/FZ Forza branding). Place these at `assets/images/gallery/<descriptive-slug>.jpg`. Resize to max 1600px wide and convert to WebP.

- [ ] **Step 1: Optimize images**

```bash
cd website/assets/images/gallery
# Use cwebp (install via brew: brew install webp) or imagemagick
for f in *.jpg; do
  cwebp -q 85 -resize 1600 0 "$f" -o "${f%.jpg}.webp"
done
```

- [ ] **Step 2: Add `gallery` keys**

```json
"gallery": {
  "eyebrow": "Галерия",
  "title": "Залата в действие.",
  "lead": "Снимки от тренировки, турнири, и ежедневието в залата."
}
```

- [ ] **Step 3: Build `gallery.html`** — masonry-ish grid of `<picture>` elements with `<source srcset=".webp">` and JPG fallback. Click opens a lightbox (vanilla JS — full-screen overlay with prev/next).

```html
<section class="container section">
  <p class="eyebrow" data-i18n="gallery.eyebrow"></p>
  <h1 class="display-l" data-i18n="gallery.title"></h1>
  <p class="body" style="max-width: 60ch;" data-i18n="gallery.lead"></p>
</section>

<section class="container section--tight">
  <div class="gallery-grid">
    <!-- repeat per image -->
    <button class="gallery-item" data-gallery-open data-src="/assets/images/gallery/kids-training-1.jpg">
      <picture>
        <source srcset="/assets/images/gallery/kids-training-1.webp" type="image/webp">
        <img src="/assets/images/gallery/kids-training-1.jpg" alt="Детска тренировка по бадминтон" loading="lazy">
      </picture>
    </button>
  </div>
</section>

<dialog class="gallery-lightbox" data-gallery-lightbox aria-label="Image lightbox">
  <img data-gallery-img alt="">
  <button data-gallery-close class="btn btn--ghost" style="position:absolute;top:16px;right:16px;" aria-label="Close">×</button>
</dialog>
```

JS to add to `main.js`:

```javascript
function setupGallery() {
  const dialog = document.querySelector('[data-gallery-lightbox]');
  if (!dialog) return;
  const img = dialog.querySelector('[data-gallery-img]');
  document.querySelectorAll('[data-gallery-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      img.src = btn.dataset.src;
      dialog.showModal();
    });
  });
  dialog.querySelector('[data-gallery-close]').addEventListener('click', () => dialog.close());
}
// call setupGallery() inside the existing DOMContentLoaded handler
```

- [ ] **Step 4: Build EN mirror**

- [ ] **Step 5: Verify** — gallery renders, clicking a thumb opens dialog with full image, Esc and close button dismiss.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(badminton-vitosha): gallery page with lightbox"
```

---

## Task 12: About page

**Files:**
- Create: `website/about.html`
- Create: `website/en/about.html`
- Modify: `bg.json`, `en.json` (about keys)

- [ ] **Step 1: Fetch existing About copy**

Run a WebFetch on `https://badminton-vitosha.bg/za-nas/` and migrate verbatim BG copy to `bg.json` under `about.*`. If the existing site has minimal About content, draft a 3-paragraph story covering: (1) venue founding & ethos, (2) the 5 courts and pro flooring, (3) Margel partnership and Multisport network. Mark drafted copy with a TODO comment for client review.

- [ ] **Step 2: Add `about` keys** with sub-keys: `eyebrow`, `title`, `intro`, `story_p1`, `story_p2`, `story_p3`, `partners_title`, `partners_lead`.

- [ ] **Step 3: Build `about.html`** — page shell + alternating image/text blocks. Include partner logos (YONEX, FZ Forza, Multisport, Margel) as a strip.

- [ ] **Step 4: Build EN mirror**

- [ ] **Step 5: Verify** — page renders; partner logos visible; both languages.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(badminton-vitosha): about page with partners strip"
```

---

## Task 13: Contacts page with contact form

**Files:**
- Create: `website/contacts.html`
- Create: `website/en/contacts.html`
- Create: `website/thanks/contact.html`, `website/thanks/en/contact.html`
- Modify: `bg.json`, `en.json` (contacts keys)

- [ ] **Step 1: Add `contacts` keys**

```json
"contacts": {
  "eyebrow": "Контакти",
  "title": "Свържи се с нас.",
  "address_title": "Адрес",
  "address": "София, ул. Околовръстен път 155",
  "directions": "Вход за залата е възможен през паркинга на Автоцентър Маргел Витоша или през улицата вдясно, преди магазин ДОМКО.",
  "hours_title": "Работно време",
  "hours": "8:00 — 22:00",
  "form_title": "Изпрати ни съобщение"
}
```

- [ ] **Step 2: Build `contacts.html`** — page shell + 2-column layout: left column with address, hours, phone, email, embedded Google Maps iframe; right column with the contact form.

```html
<section class="container section">
  <p class="eyebrow" data-i18n="contacts.eyebrow"></p>
  <h1 class="display-l" data-i18n="contacts.title"></h1>

  <div class="contacts-grid">
    <div class="stack-lg">
      <div>
        <h2 class="heading" data-i18n="contacts.address_title"></h2>
        <p class="body" data-i18n="contacts.address"></p>
        <p class="small" data-i18n="contacts.directions"></p>
      </div>
      <div>
        <h2 class="heading" data-i18n="contacts.hours_title"></h2>
        <p class="body" data-i18n="contacts.hours"></p>
      </div>
      <div>
        <h2 class="heading">Email · Phone</h2>
        <p class="body"><a href="mailto:badminton@margel.info">badminton@margel.info</a></p>
        <p class="body"><a href="tel:+359888900083">0888 9000 83</a></p>
      </div>
      <iframe
        title="Map"
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2932.9..."
        width="100%" height="300"
        style="border:0; border-radius: var(--radius-md);"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>

    <form name="contact-bg" method="POST" data-netlify="true" action="/thanks/contact.html" class="form">
      <input type="hidden" name="form-name" value="contact-bg">
      <p hidden><label>Don't fill this: <input name="bot-field"></label></p>
      <h2 class="display-m" data-i18n="contacts.form_title"></h2>

      <div class="form__row">
        <label class="form__label" for="c-name" data-i18n="form.name"></label>
        <input class="form__input" id="c-name" name="name" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="c-email" data-i18n="form.email"></label>
        <input class="form__input" id="c-email" name="email" type="email" required>
      </div>
      <div class="form__row">
        <label class="form__label" for="c-message" data-i18n="form.message"></label>
        <textarea class="form__textarea" id="c-message" name="message" required></textarea>
      </div>
      <button class="btn btn--primary" type="submit"><span data-i18n="form.submit"></span></button>
    </form>
  </div>
</section>
```

CSS:

```css
.contacts-grid { display: grid; gap: var(--space-7); margin-top: var(--space-6); }
@media (min-width: 768px) { .contacts-grid { grid-template-columns: 1fr 1fr; } }
```

- [ ] **Step 3: Pull a real Google Maps embed URL** — search Google Maps for "Околовръстен път 155, 1700 Sofia", click "Share → Embed", copy the `src` and replace the placeholder.

- [ ] **Step 4: Build EN mirror + EN thanks page**

- [ ] **Step 5: Verify** — map embeds, form renders, both languages work.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(badminton-vitosha): contacts page with map and contact form"
```

---

## Task 14: News index + news post template

**Files:**
- Create: `website/news.html`
- Create: `website/en/news.html`
- Modify: `bg.json`, `en.json` (news keys)

- [ ] **Step 1: Add `news` keys**

```json
"news": {
  "eyebrow": "Новини",
  "title": "Новини и събития.",
  "read_more": "Прочети повече"
}
```

- [ ] **Step 2: Build `news.html`** — page shell + chronological grid of cards (one per migrated post). Each card: meta (date), card title (post title), excerpt, "Прочети повече" link.

The 6 posts (slugs):
1. `besplatno-sabitie` — "Безплатно Събитие ВЛЕЗ ВЪВ ФОРМА С УСМИВКА!" — 2026-01-27
2. `rabotim-s-multisport` — "Работим с Multisport" — 2025-06-24
3. `naredba-turnir-2025` — "НАРЕДБА за ТУРНИР ПО БАДМИНТОН НА ЗАЛА ВИТОША 2025 г." — 2025-06-06
4. `istoriata-na-badmintona` — "Историята на бадминтона" — 2025-04-25
5. `kak-da-podobrish-igrata-si` — "Как да подобриш играта си в бадминтон" — 2025-04-25
6. `badminton-dinamichniat-sport` — "Бадминтон – Динамичният спорт" — 2025-04-25

- [ ] **Step 3: Build EN mirror**

- [ ] **Step 4: Verify** — index renders all 6 posts (cards link to 404 until Task 15 lands; that's expected).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(badminton-vitosha): news index page (BG + EN)"
```

---

## Task 15: Six migrated news posts

**Files:**
- Create: `website/news/besplatno-sabitie.html`, ...×6
- Create: `website/en/news/besplatno-sabitie.html`, ...×6 (translated)

- [ ] **Step 1: Fetch each post's BG body**

For each of the 6 posts, run a WebFetch on the existing URL and capture the body HTML verbatim. Save to a temp scratch file.

```bash
# Example:
curl -s "https://badminton-vitosha.bg/.../" -o /tmp/post1.html
```

- [ ] **Step 2: Create a news post HTML template** — apply to each post:

```html
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><post title> — Badminton Vitosha</title>
  <meta name="description" content="<post excerpt, 150 chars>">
  <link rel="canonical" href="https://badminton-vitosha.bg/news/<slug>.html">
  <link rel="alternate" hreflang="bg" href="https://badminton-vitosha.bg/news/<slug>.html">
  <link rel="alternate" hreflang="en" href="https://badminton-vitosha.bg/en/news/<slug>.html">
  <!-- font + stylesheets, same as other pages -->
  <script type="module" src="/js/main.js" defer></script>
</head>
<body>
<!-- nav (copy from index.html) -->
<main id="main">
  <article class="container section" style="max-width: 720px;">
    <p class="card__meta"><post date></p>
    <h1 class="display-l" data-anim="word-reveal"><post title></h1>
    <div class="post-body">
      <!-- migrated post HTML -->
    </div>
    <a href="/news.html" class="btn btn--link">← Към всички новини</a>
  </article>
</main>
<!-- footer -->
</body>
</html>
```

Add `.post-body p { margin-bottom: var(--space-4); font-size: var(--fs-body); line-height: var(--lh-body); }` to `pages.css`.

- [ ] **Step 3: Translate each post to EN** for the `/en/news/` mirror. AI-translate, then revise the tone to match Editorial Premium (English-language sport venue voice, not literal Bulgarian).

- [ ] **Step 4: Verify** — open each of the 12 post URLs (6 BG + 6 EN) and check renders, dates, navigation back to index, language switcher in nav links to the sibling post.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(badminton-vitosha): migrate 6 news posts (BG verbatim + EN translation)"
```

---

## Task 16: Motion module + library setup

**Files:**
- Create: `website/js/motion.js`
- Create: `website/tests/motion.test.html`
- Modify: `website/index.html` and other pages — add CDN tags for GSAP and Lenis
- Modify: `website/js/main.js` — call `bootMotion()`

- [ ] **Step 1: Add GSAP + ScrollTrigger + Lenis CDN tags to all pages**

Add inside `<head>` after the stylesheet links and before `main.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js" defer></script>
```

Use a small Python one-liner for portability across macOS / Linux (BSD/GNU sed differ):

```bash
cd website
python3 <<'PY'
import pathlib, re
inject = (
  '  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>\n'
  '  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>\n'
  '  <script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js" defer></script>\n'
)
for path in pathlib.Path('.').rglob('*.html'):
    if 'tests/' in str(path) or 'thanks/' in str(path): continue
    text = path.read_text()
    if 'gsap.min.js' in text: continue  # already injected
    text = re.sub(r'(\s*<script type="module" src="/js/main.js")', f'\n{inject}\\1', text, count=1)
    path.write_text(text)
print("Done.")
PY
```

- [ ] **Step 2: Write `motion.js`**

```javascript
// motion.js — boot GSAP + Lenis, register all motion patterns.
// Reads data-anim attributes set in HTML and wires up the matching effects.

function prefersReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function bootLenis() {
  if (prefersReduced()) return null;
  const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  return lenis;
}

function applyFadeUps() {
  document.querySelectorAll('[data-anim="fade-up"]').forEach(el => {
    gsap.to(el, {
      opacity: 1, y: 0,
      duration: 0.6, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });
}

function applyWordReveals() {
  document.querySelectorAll('[data-anim="word-reveal"]').forEach(el => {
    const text = el.textContent;
    el.innerHTML = '';
    text.split(' ').forEach(word => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = word + ' ';
      el.appendChild(span);
    });
    gsap.to(el.querySelectorAll('.word'), {
      opacity: 1, y: 0,
      duration: 1.4, ease: 'cubic-bezier(0.34, 1.2, 0.64, 1)',
      stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 80%', once: true }
    });
    el.style.opacity = 1;
  });
}

function applyDrawSvgs() {
  document.querySelectorAll('[data-anim="draw-svg"]').forEach(el => {
    gsap.to(el.querySelectorAll('path, line'), {
      strokeDashoffset: 0,
      duration: 2.4, ease: 'power2.out', stagger: 0.05,
      scrollTrigger: { trigger: el, start: 'top 75%', once: true }
    });
  });
}

function applyMagneticCTAs() {
  if (prefersReduced()) return;
  document.querySelectorAll('.btn--magnet').forEach(btn => {
    const span = btn.querySelector('span') || btn;
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.3;
      const y = (e.clientY - r.top - r.height / 2) * 0.3;
      gsap.to(span, { x, y, duration: 0.4, ease: 'power3.out' });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(span, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
    });
  });
}

export function bootMotion() {
  if (typeof gsap === 'undefined') {
    console.warn('[motion] GSAP not loaded — skipping motion');
    return;
  }
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  bootLenis();
  applyFadeUps();
  applyWordReveals();
  applyDrawSvgs();
  applyMagneticCTAs();
}
```

- [ ] **Step 3: Wire `motion.js` from `main.js`**

```javascript
// add to main.js:
import { bootMotion } from './motion.js';

document.addEventListener('DOMContentLoaded', async () => {
  await bootI18n();
  setupNavDrawer();
  setupActiveNav();
  setupGallery();
  // wait one frame so GSAP scripts (loaded with `defer`) finish first
  requestAnimationFrame(() => bootMotion());
});
```

- [ ] **Step 4: Write `tests/motion.test.html`** — assertions that key DOM patterns exist after boot

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>motion tests</title>
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/motion.css">
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
  <style>
    body { font-family: monospace; padding: 24px; }
    .pass { color: #0a8050; } .fail { color: #b23b3b; }
  </style>
</head>
<body>
<h1>motion.js tests</h1>
<ol id="results"></ol>

<h1 data-anim="word-reveal" id="t-words">Hello world test</h1>
<p data-anim="fade-up" id="t-fade">Fade target</p>
<button class="btn btn--magnet" id="t-magnet"><span>Click me</span></button>

<script type="module">
import { bootMotion } from '../js/motion.js';
const results = document.getElementById('results');
function assert(label, cond) {
  const li = document.createElement('li');
  li.className = cond ? 'pass' : 'fail';
  li.textContent = (cond ? '✅ PASS — ' : '❌ FAIL — ') + label;
  results.appendChild(li);
}
bootMotion();
setTimeout(() => {
  assert('word-reveal splits into .word spans',
    document.querySelectorAll('#t-words .word').length === 3);
  assert('GSAP is registered globally', typeof window.gsap === 'function');
  assert('ScrollTrigger plugin loaded', typeof window.ScrollTrigger === 'function');
  assert('magnetic CTA exists in DOM', !!document.querySelector('.btn--magnet'));
}, 200);
</script>
</body>
</html>
```

- [ ] **Step 5: Run tests + verify on home page**

- Open `http://localhost:8080/tests/motion.test.html` — all rows PASS.
- Open `http://localhost:8080/` — hero title fades in word-by-word; scroll triggers reveal animations on subsequent sections.

- [ ] **Step 6: Verify reduced-motion fallback** — DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`. Reload home page. Expected: no animations; everything is visible immediately.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(badminton-vitosha): motion layer (GSAP + Lenis, word reveals, fade-ups, magnetic CTAs)"
```

---

## Task 17: SVG court draws + ticker polish across pages

**Files:**
- Modify: pages where SVG draw effect lives (mostly home, about, kids)

- [ ] **Step 1: Add SVG court divider** — embed inline SVG between hero and highlights on home, between sections on book, between sections on kids. Wrap in `data-anim="draw-svg"`.

```html
<svg data-anim="draw-svg" viewBox="0 0 800 80" preserveAspectRatio="none" style="width:100%; height:60px; stroke: var(--color-court); fill: none; stroke-width: 1.5;">
  <path d="M 40 70 L 760 70 L 760 10 L 40 10 Z"/>
  <line x1="400" y1="10" x2="400" y2="70"/>
  <line x1="40" y1="40" x2="760" y2="40"/>
</svg>
```

- [ ] **Step 2: Verify** — on each page where SVG dividers are placed, scrolling triggers the court lines drawing from start to end.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(badminton-vitosha): SVG court-line dividers with scroll-triggered draws"
```

---

## Task 18: Apply motion across remaining pages

**Files:**
- Modify: `book.html`, `kids.html`, `rules.html`, `shop.html`, `gallery.html`, `about.html`, `contacts.html`, `news.html` and EN mirrors

- [ ] **Step 1: Audit each page**

For each page, ensure the hero `<h1>` has `data-anim="word-reveal"` and major content blocks have `data-anim="fade-up"`. Verify no over-animation: aim for 3-5 animated elements per page max.

- [ ] **Step 2: Verify each page in browser**

Open each of the 9 pages × 2 languages = 18 URLs. Scroll through each. Confirm hero word-reveal triggers, section fade-ups trigger as the user scrolls past them. No element fails to render (i.e., no element stays opacity:0 forever).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(badminton-vitosha): apply motion vocabulary to all pages"
```

---

## Task 19: Forms — Netlify deploy preview verification

**Files:** none (verification task)

- [ ] **Step 1: Create a Netlify deploy preview**

```bash
git push origin main
# OR connect a feature branch to Netlify for preview deploys
```

Wait for the deploy to complete (Netlify dashboard).

- [ ] **Step 2: Submit each form on the deployed preview**

For each of the 6 forms (3 BG + 3 EN: contact, kids signup, slot request):
- Open the form on the preview URL.
- Fill required fields with test data.
- Submit.
- Expected: redirect to thank-you page; form appears in Netlify dashboard → Forms tab; an email arrives at `badminton@margel.info`.

- [ ] **Step 3: If any form fails**

Check that:
- `<form>` has `data-netlify="true"`.
- Hidden `<input type="hidden" name="form-name" value="...">` matches the form `name` attribute exactly.
- Each form has a unique `name`.
- Honeypot `bot-field` is present.

Common gotcha: Netlify Forms only detects forms in pages that exist at build time. Submit one test from each form name to register it.

- [ ] **Step 4: Configure Netlify form notifications**

In Netlify dashboard → Forms → Form notifications → Add notification → Email → `badminton@margel.info`.

- [ ] **Step 5: Commit any fixes**

```bash
git commit -m "fix(badminton-vitosha): form wiring corrections from Netlify preview"
```

---

## Task 20: 301 redirects from old WordPress URLs

**Files:**
- Create: `website/_redirects`

- [ ] **Step 1: Build the redirect map**

The old WordPress URLs are heavily percent-encoded. Map each to a clean new equivalent:

```
# website/_redirects

# Pages
/%d0%b5%d0%ba%d0%b8%d0%bf%d0%b8%d1%80%d0%be%d0%b2%d0%ba%d0%b0-2/    /book.html              301
/%d0%bf%d1%80%d0%b0%d0%b2%d0%b8%d0%bb%d0%b0/                        /rules.html             301
/%d0%b5%d0%ba%d0%b8%d0%bf%d0%b8%d1%80%d0%be%d0%b2%d0%ba%d0%b0/      /rules.html             301
/%d0%b3%d0%b0%d0%bb%d0%b5%d1%80%d0%b8%d1%8f/                        /gallery.html           301
/nachalo-2-2-2/                                                     /about.html             301
/%d0%bc%d0%b0%d0%b3%d0%b0%d0%b7%d0%b8%d0%bd/                        /shop.html              301
/za-nas/                                                            /about.html             301
/book/                                                              /book.html              301

# Legal pages (preserve since users may have bookmarked)
/obshti-uslovia/                                                    /legal/terms.html       301
/usloviya-za-polzvane/                                              /legal/privacy.html     301
/%d1%83%d1%81%d0%bb%d0%be%d0%b2%d0%b8%d1%8f-%d0%b7%d0%b0-%d0%be%d1%82%d0%ba%d0%b0%d0%b7/    /legal/refund.html    301

# News posts (map percent-encoded slugs to clean ones)
/%d0%b1%d0%b5%d0%b7%d0%bf%d0%bb%d0%b0%d1%82%d0%bd%d0%be-%d1%81%d1%8a%d0%b1%d0%b8%d1%82%d0%b8%d0%b5*    /news/besplatno-sabitie.html    301
/%d1%80%d0%b0%d0%b1%d0%be%d1%82%d0%b8%d0%bc-%d1%81-multisport*    /news/rabotim-s-multisport.html    301
/%d0%bd%d0%b0%d1%80%d0%b5%d0%b4%d0%b1%d0%b0-%d0%b7%d0%b0-%d1%82%d1%83%d1%80%d0%bd%d0%b8%d1%80*    /news/naredba-turnir-2025.html    301
/%d0%b8%d1%81%d1%82%d0%be%d1%80%d0%b8%d1%8f%d1%82%d0%b0-%d0%bd%d0%b0-%d0%b1%d0%b0%d0%b4%d0%bc%d0%b8%d0%bd%d1%82%d0%be%d0%bd%d0%b0*    /news/istoriata-na-badmintona.html    301
/%d0%ba%d0%b0%d0%ba-%d0%b4%d0%b0-%d0%bf%d0%be%d0%b4%d0%be%d0%b1%d1%80%d0%b8%d1%88*    /news/kak-da-podobrish-igrata-si.html    301
/%d0%b1%d0%b0%d0%b4%d0%bc%d0%b8%d0%bd%d1%82%d0%be%d0%bd-%d0%b4%d0%b8%d0%bd%d0%b0%d0%bc%d0%b8%d1%87%d0%bd%d0%b8%d1%8f%d1%82*    /news/badminton-dinamichniat-sport.html    301

# Contact anchor
/#contacts    /contacts.html    301
```

(Splat `*` allows trailing slugs to match. Test patterns carefully — Netlify uses lowercase matching.)

- [ ] **Step 2: Create simple legal stub pages**

Create `website/legal/terms.html`, `privacy.html`, `refund.html` with minimal content noting "Original terms preserved from badminton-vitosha.bg". (Or migrate verbatim from the old WordPress site if those pages still resolve.) These are linked from the footer.

- [ ] **Step 3: Verify redirects on the deploy preview**

For each old URL, hit it via curl:

```bash
curl -I "https://<preview>.netlify.app/<old-percent-encoded-url>"
# Expected: HTTP/2 301, Location: /<new-url>
```

Test at least the top 5 (highest-traffic) redirects.

- [ ] **Step 4: Commit**

```bash
git add "Clients/Badminton Vitosha/website/_redirects" "Clients/Badminton Vitosha/website/legal/"
git commit -m "feat(badminton-vitosha): 301 redirects from old WordPress URLs + legal stubs"
```

---

## Task 21: Performance + accessibility audit

**Files:**
- Create: `website/verify.sh` (small script that runs Lighthouse and reports scores)

- [ ] **Step 1: Write `verify.sh`**

```bash
#!/usr/bin/env bash
# verify.sh — run Lighthouse against a deployed Netlify preview.
# Usage: ./verify.sh https://<preview>.netlify.app

set -e
URL="${1:-http://localhost:8080}"

if ! command -v lighthouse &> /dev/null; then
  echo "Installing lighthouse globally..."
  npm install -g lighthouse
fi

PAGES=("/" "/book.html" "/kids.html" "/rules.html" "/shop.html" "/gallery.html" "/about.html" "/contacts.html" "/news.html" "/en/")

mkdir -p .lighthouse-reports

for page in "${PAGES[@]}"; do
  filename=$(echo "$page" | sed 's/\//_/g; s/\.html//; s/^_//')
  [ -z "$filename" ] && filename="home"
  echo "→ Auditing $URL$page"
  lighthouse "$URL$page" \
    --only-categories=performance,accessibility,seo \
    --form-factor=mobile \
    --output=json \
    --output-path=".lighthouse-reports/$filename.json" \
    --chrome-flags="--headless" \
    --quiet
done

echo ""
echo "═══ SCORES ══════════════════════════════"
for f in .lighthouse-reports/*.json; do
  name=$(basename "$f" .json)
  perf=$(jq '.categories.performance.score * 100 | floor' "$f")
  a11y=$(jq '.categories.accessibility.score * 100 | floor' "$f")
  seo=$(jq '.categories.seo.score * 100 | floor' "$f")
  printf "%-20s perf %3d  a11y %3d  seo %3d\n" "$name" "$perf" "$a11y" "$seo"
done
```

- [ ] **Step 2: Run audit**

```bash
chmod +x verify.sh
./verify.sh https://<your-netlify-preview>.netlify.app
```

Expected scores: Performance ≥ 90, Accessibility = 100, SEO ≥ 95 on every page.

- [ ] **Step 3: Fix flagged issues until thresholds met**

Common fixes:
- Compress oversized images (`cwebp -q 80 -resize 1600 0`)
- Add `loading="lazy"` to non-hero images
- Add explicit `width` and `height` to `<img>` tags to prevent layout shift
- Ensure all interactive elements have aria labels
- Verify color contrast — Stone (`#D6C8A8`) on Ivory (`#F7F5EE`) is borderline; use Ink for text on Stone surfaces
- Add structured data (JSON-LD) for `LocalBusiness` to home page

- [ ] **Step 4: Run axe DevTools**

In Chrome DevTools → Lighthouse panel does basic a11y. For deeper check, install the axe DevTools extension and run on each page. Expected: 0 violations.

- [ ] **Step 5: Commit fixes**

```bash
git commit -m "perf,a11y(badminton-vitosha): pass Lighthouse + axe thresholds"
```

---

## Task 22: SEO meta + structured data + sitemap

**Files:**
- Create: `website/sitemap.xml`
- Create: `website/robots.txt`
- Modify: `website/index.html` and `website/en/index.html` (add JSON-LD)

- [ ] **Step 1: Add JSON-LD `LocalBusiness` to both home pages**

Inside `<head>`:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  "name": "Badminton Vitosha",
  "image": "https://badminton-vitosha.bg/assets/images/hall-banner.png",
  "url": "https://badminton-vitosha.bg/",
  "telephone": "+359888900083",
  "email": "badminton@margel.info",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "ул. Околовръстен път 155",
    "addressLocality": "София",
    "postalCode": "1700",
    "addressCountry": "BG"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "<TODO: from Google Maps>",
    "longitude": "<TODO: from Google Maps>"
  },
  "openingHours": "Mo-Su 08:00-22:00",
  "priceRange": "€6.65 — €9.20",
  "sport": "Badminton"
}
</script>
```

- [ ] **Step 2: Generate `sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://badminton-vitosha.bg/</loc>
    <xhtml:link rel="alternate" hreflang="bg" href="https://badminton-vitosha.bg/"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://badminton-vitosha.bg/en/"/>
    <changefreq>weekly</changefreq>
  </url>
  <!-- repeat for each page × 2 languages, plus 6 news posts × 2 -->
</urlset>
```

Generate exhaustively for all 18 pages + 12 news posts = 30 URL entries.

- [ ] **Step 3: `robots.txt`**

```
User-agent: *
Allow: /
Disallow: /thanks/
Disallow: /tests/

Sitemap: https://badminton-vitosha.bg/sitemap.xml
```

- [ ] **Step 4: Verify**

- Visit `/sitemap.xml` and `/robots.txt` on the preview. Both render.
- Validate JSON-LD with [Google Rich Results Test](https://search.google.com/test/rich-results).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(badminton-vitosha): SEO — JSON-LD, sitemap, robots.txt"
```

---

## Task 23: Production deploy + client review handoff

**Files:** none (process task)

- [ ] **Step 1: Final pre-flight check**

Run through the **Definition of Done** from the spec:
- [ ] Lighthouse Performance ≥ 90 mobile, Accessibility = 100, SEO ≥ 95 on all pages
- [ ] All Phase 1 forms tested submitting to Netlify
- [ ] Both languages render identically; all `data-i18n` keys covered (no untranslated keys, no raw `{{key}}` placeholders)
- [ ] 301s tested for top 5 old URLs
- [ ] Stubbed content marked clearly with `<!-- TODO: client to provide -->`

- [ ] **Step 2: Connect Netlify to the project** (if not already)

Netlify dashboard → Add new site → Import existing project → Choose this repo → Build command: (leave blank) → Publish directory: `Clients/Badminton Vitosha/website` → Deploy.

- [ ] **Step 3: Configure custom domain**

Add `badminton-vitosha.bg` to the Netlify site → DNS → Update A/CNAME records at the domain registrar to point to Netlify. Verify SSL certificate provisions automatically (15-60 min).

- [ ] **Step 4: Send client review checklist**

Email Angel with:
- Preview URL
- List of stubbed content needing client input (the 5 open items in the spec)
- Request final confirmation before flipping DNS

- [ ] **Step 5: Once approved, flip DNS** and confirm site is live at `badminton-vitosha.bg`.

- [ ] **Step 6: Commit any final config**

```bash
git commit -m "feat(badminton-vitosha): production deploy config"
```

- [ ] **Step 7: Tag the release**

```bash
git tag -a v1.0-public-site -m "Phase 1 — public site live"
git push origin v1.0-public-site
```

---

## Phase 1 Complete

Deliverables shipped:
- 8 pages × 2 languages + news index + 6 migrated posts × 2 languages = **30 pages**
- Editorial Premium design system (5 CSS files, ~12 KB total)
- Dynamic Editorial motion layer (GSAP + Lenis, ~50 KB CDN)
- 3 Netlify forms wired (contact, kids signup, slot request)
- 11+ 301 redirects from old WordPress URLs
- Lighthouse ≥ 90 / 100 / 95 across all pages
- BG canonical + EN mirror for SEO

**Phase 2 (booking + admin)** plan written next, after the public site has soaked for 1–2 weeks and any client feedback shapes the booking priorities.
