# Audit-fix batch — 2026-07-28

Remediation of the 2026-07-27 daily-audit findings. Approved by Angel (chat, 2026-07-28):
no TOTP/MFA anywhere; Turnstile CAPTCHA returns to admin login; EN visibility via
`?lang=en` layer (not `/en/` static — that stays on the P2 backlog).

Branch `fix/audit-2026-07-28` off `feat/catalog-switch` (tip of the open catalog PR
stack #23→#24→#25); PR stacks on #25 because services/menu/reservation files overlap.

## 1. Critical — admin login docs drift (+ Turnstile restore)

Reality since 155be5f (2026-06-17, per Angel's request): password-only login, no AAL2,
no security.html, no login CAPTCHA. CLAUDE.md still documents TOTP+Turnstile as enforced.

- CLAUDE.md security section rewritten to reality: Supabase email/password + 6-email
  `is_admin()` allowlist + RLS + rate limits; Turnstile CAPTCHA on login (this batch).
- `admin/login.html`: Turnstile widget (same site key as the public form,
  `0x4AAAAAADjSB9200ZicBIRp`) + `challenges.cloudflare.com/turnstile/v0/api.js`
  (already in CSP script-src/connect-src/frame-src; headers apply to `/*`).
- `admin/js/login.js`: pass `captchaToken` to `signInWithPassword` and
  `resetPasswordForEmail`; reset the widget after any use.
- Rollout order (manual, Angel): merge+deploy FIRST, then Supabase Dashboard → Auth →
  Bot and Abuse Protection → enable Turnstile with the Turnstile secret. Flipping the
  toggle before deploy breaks login (no token sent). Until the toggle is on, the
  widget renders and the token is ignored — zero risk.
- Optional cleanup: delete the stale unverified TOTP factor (aborisov, 2026-06-17).

## 2. High — services.html JSON-LD price drift

Only two offers drift (full sweep vs `public.addon_services` done): LED екран
€76→€148 (line ~48), Охрана VTA €51→€100 (line ~51). Both are old-BGN÷1.95583
leftovers. Out of scope: JSON-LD lists 22 of ~37 visible services — coverage gap
noted, not fixed here.

## 3. High — EN visibility (`?lang=en` layer)

- `js/main.js`:
  - On load: `?lang=en|bg` overrides + persists to `margel_lang`.
  - `applyTranslations()` sets `document.documentElement.lang`, swaps skip-link
    label (see §4), and calls a head-sync helper: URL `replaceState` (adds/removes
    `lang` param, preserves other params + hash), canonical href gains/loses
    `?lang=en`, `og:locale` ↔ `bg_BG`/`en_US`.
- 12 indexable pages (index, services, menu, reservation, contact, corporate,
  birthday, wedding, evening, faq, gallery, partners) get
  `<link rel="alternate" hreflang="en" href="<canonical>?lang=en">` next to the
  existing `bg`/`x-default` pair. drinks.html excluded (301→menu, force=true).
  Insertion scripted (deterministic, keyed on the existing hreflang="bg" line).

## 4. High — accessibility

- **Skip links**: 13 pages (the 12 above + promo.html while the campaign lives).
  `<a class="skip-link" href="#main-content">Към съдържанието</a>` as first element
  in `<body>`; first `<main>` gets `id="main-content"`. CSS in style.css
  (visually hidden until :focus). Label localized by main.js directly (same
  mechanism as the lang-toggle relabel) — avoids touching 10 translation files.
- **Drinks category tabs** (`reservation.js` `renderDrinkTabs` ~:519, `edit.js`
  ~:461): `aria-selected` + roving `tabindex` + Arrow/Home/End keys +
  `aria-controls`/tab `id`s; drinks grid gets `role="tabpanel"`; tablist gets a
  localized `aria-label`. Step wizard nav untouched (already correct
  `role="list"` + `aria-current="step"`).
- **Contrast**: new `--gold-text: #7d651c` token in style.css, script-verified
  ≥4.5:1 on `#fff` (5.60), `#f8f7f4` (5.23), `#f0ede8` (4.80). Applied to gold
  TEXT on light backgrounds across style.css (event prices/CTAs, stat numbers,
  nav drawer/lang-toggle/logo accents, FAQ, contact labels, menu prices,
  event-facts, review stars, form-success headings) and reservation.css (wizard
  step labels, event-pick prices, addon/drink prices, running totals, price
  summary, promo-adjacent accents). Dark-context gold keeps `--accent` via
  explicit overrides (transparent-nav logo span + lang-toggle on the hero,
  footer logo span). NOT touched: gold backgrounds (`.btn-primary`,
  `.drinks-tab.active`), gold-on-dark (`.footer-heading`, `.hero-scroll`,
  lightbox), the hero `.gold-text` shimmer gradient, and the `.nav-links`
  active underline (decorative). `.btn-primary` white-on-gold also fails AA —
  flagged as a separate design pass.

## 5. Medium

- **menu.html baked wines**: insert `Tenuta dell'Ornellaia Le Volte 0.75л — €30.17`
  at the top of the wine `<ul>` (DB sort_order 10; baked list has 14 of 15 DB wines).
- **flatpickr SRI**: pin `flatpickr@4.6.13` (`dist/flatpickr.min.js`,
  `dist/flatpickr.min.css`, `dist/l10n/bg.js`) with computed sha384 `integrity` +
  `crossorigin="anonymous"` in reservation.html + edit.html. Turnstile api.js keeps
  no SRI (Cloudflare-rotated). Supabase already pinned.
- **Hero video**: index.html drops `autoplay`, `preload` → `none`; main.js hero
  block decides: skip load/play on `saveData`, `effectiveType` 2g, or
  `prefers-reduced-motion` (poster stays); otherwise `preload='auto'` + play with
  the existing retry-on-interaction logic. Not poster-only-on-mobile (file already
  1.1 MB; that would be a product/visual change).
- **reservation.html i18n leaks**: `#guests-hint` (:261), promo-code label (:282),
  "Приложи" button (:285) get `data-i18n` keys (`guests_hint`, `promo_code_label`,
  `promo_apply`) in translations-reservation.js; baked BG text byte-identical to
  the bg values.

## 6. Verification & ship

- `node --check` every edited JS; scripted checks: contrast ratios, baked-BG ↔
  translations parity for the new keys, hreflang-en present exactly on the 12 pages,
  no stale `?v=` for bumped assets.
- Version bumps: style.css v7→8 (all referencing pages incl. 404),
  reservation.css v7→8, main.js v4→5, reservation.js v25→26,
  translations-reservation.js v6→7, edit.js v14→15, admin login.js v2→3.
- Granular conventional commits; PR base `feat/catalog-switch`; Angel merges.
- CLAUDE.md: security section, sync-map extra-guest row gains
  translations-reservation.js, note the `?lang=en`/hreflang mechanics.

Out of scope (deliberate): admin i18n (already bilingual via admin-i18n.js — audit
claim stale), JSON-LD item coverage, `.btn-primary` contrast, `/en/` static pages.
