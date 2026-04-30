# Badminton Vitosha — Website Rebuild

**Design spec · 2026-04-30**

## Project summary

Rebuild of [badminton-vitosha.bg](https://badminton-vitosha.bg) for Badminton Vitosha — an indoor badminton hall in Sofia (5 courts, ул. Околовръстен път 155, Sofia). Existing site is functional but visually dated; new build is modern, animated, bilingual (Bulgarian + English), and includes a custom court booking system replacing the current implementation.

The rebuild ships in two phases:
- **Phase 1 — Public site** (~2–3 weeks): replaces the current marketing site with a modern, animated, bilingual experience. Booking on `/book/` is a Netlify Forms placeholder ("request a slot").
- **Phase 2 — Booking system + admin** (~3–4 weeks): replaces the placeholder with a custom Supabase-backed booking grid and admin panel. Pay-on-arrival.

A potential Phase 3 (Stripe, automated reminders, real-time availability, recurring bookings) is documented for awareness but is not in the scope of this spec.

## Stakeholders & constraints

- **Client**: Badminton Vitosha (same ownership group as Margel360, sharing the `margel.info` email domain).
- **Owner contact**: 0888 9000 83 · badminton@margel.info
- **Existing partnerships**: Margel auto-center (venue parking access), Multisport (membership network), YONEX & FZ Forza (equipment partners visible in venue, may not be formal sponsors).
- **AB Intelligence standards** apply: vanilla HTML/CSS/JS, no build tools by default, mobile-first, WCAG AA, deploy to Netlify. See `/CLAUDE.md`.

## 1. Information architecture & content

### Sitemap

| # | Page | URL (BG) | URL (EN) | Purpose |
|---|---|---|---|---|
| 1 | Home | `/` | `/en/` | Hero · 5-court pitch · book CTA · kids teaser · news · partners · contact teaser |
| 2 | Book a court | `/book/` | `/en/book/` | Phase 1: "request a slot" form. Phase 2: live court grid. Prices baked in. |
| 3 | Kids training | `/kids/` | `/en/kids/` | Schedule, age groups, coach, sign-up form. |
| 4 | Rules & equipment | `/rules/` | `/en/rules/` | What to wear, what to bring, conduct rules. Merges existing "Правила" + "Екипировка" pages. |
| 5 | Shop | `/shop/` | `/en/shop/` | Equipment catalog, showcase only ("ask at venue / Viber" CTA). |
| 6 | Gallery | `/gallery/` | `/en/gallery/` | Photos + video reel. |
| 7 | About | `/about/` | `/en/about/` | Story, Margel partnership, Multisport, partners. |
| 8 | Contacts | `/contacts/` | `/en/contacts/` | Map, hours, parking instructions, contact form. |

**News** is a 9th destination (`/news/` and `/news/<slug>/`) but is reached from Home news cards, not from the main nav (keeps nav at 8 items). Six existing posts migrated:
1. Безплатно Събитие ВЛЕЗ ВЪВ ФОРМА С УСМИВКА! (2026-01-27)
2. Работим с Multisport (2025-06-24)
3. НАРЕДБА за ТУРНИР ПО БАДМИНТОН НА ЗАЛА ВИТОША 2025 г. (2025-06-06)
4. Историята на бадминтона – от древните времена до олимпийските върхове (2025-04-25)
5. Как да подобриш играта си в бадминтон: Техники, ракета и вдъхновение (2025-04-25)
6. Бадминтон – Динамичният спорт, който ще те изненада (2025-04-25)

### Content sourcing strategy

- **Bulgarian copy**: migrate verbatim from existing site (hero copy, news bodies, partner mentions). Preserves SEO and saves rewrite work. Hero text is locked: *"Нашата зала разполага с 5 корта, създадена е специално за любителите и професионалистите в бадминтона..."*
- **English copy**: AB Intelligence translates and adapts for tone (Editorial Premium reads differently in EN vs BG).
- **Imagery**: existing site media library (woman/boy playing, hall banner) plus venue photos provided by Angel. Where existing photos are weak, replace with Unsplash equivalents matching the editorial tone.
- **Logo**: reuse existing `logo-vertical-7-01.svg` (clean SVG version exists from the WordPress media library). Flame mark stays.
- **Content gaps to be filled by client before Phase 1 ship**: full pricing table, kids training schedule (days/times/age groups/coach name), shop product list. Stub with `<!-- TODO: client to provide -->` until provided.

### URL preservation

301 redirects from at least the top 5 old WordPress URLs (long, percent-encoded slugs) to the new clean equivalents. List captured during migration; `_redirects` file in Netlify.

## 2. Tech architecture

### Stack

- **HTML/CSS/JS**, no build tools, no npm — per AB Intelligence standards.
- **GSAP 3** (CDN, ~30 KB gzipped) for kinetic word reveals, ScrollTrigger, magnetic CTAs. Justified: the Dynamic Editorial motion brief is genuinely complex; vanilla equivalents would be disproportionately verbose.
- **Lenis 1.x** (CDN, ~5 KB) for smooth scroll. Optional — bail if it causes mobile issues.
- **Supabase JS client** (CDN) — Phase 2 only.
- **Netlify Forms** — Phase 1 contact, kids sign-up, and "request a slot" forms.

### File structure

```
Clients/Badminton Vitosha/
├── website/
│   ├── index.html, book.html, kids.html, rules.html,
│   │   shop.html, gallery.html, about.html, contacts.html,
│   │   news.html, news/<slug>.html
│   ├── en/  ← mirror of all pages
│   ├── css/
│   │   ├── tokens.css       (palette, type scale, spacing, easings)
│   │   ├── base.css         (reset, typography, layout primitives)
│   │   ├── components.css   (nav, buttons, cards, forms, court-grid)
│   │   ├── pages.css        (page-specific overrides)
│   │   └── motion.css       (keyframes, prefers-reduced-motion overrides)
│   ├── js/
│   │   ├── main.js          (boot: i18n, nav, motion init)
│   │   ├── i18n.js          (dictionary swap)
│   │   ├── motion.js        (GSAP timelines, ScrollTrigger setup)
│   │   ├── booking.js       (Phase 2)
│   │   └── i18n/{bg,en}.json
│   ├── admin/               (Phase 2)
│   ├── assets/images/
│   ├── assets/fonts/
│   └── _redirects
├── supabase/                (Phase 2)
├── docs/
│   └── superpowers/specs/
└── notes.md
```

This is a justified departure from CLAUDE.md's "one CSS file" rule — eight pages plus booking and admin makes a single sheet unwieldy.

### Internationalisation

Two static HTML trees: `/` (Bulgarian, canonical) and `/en/` (English mirror). Each page exists at both URLs as fully-rendered static HTML — best for SEO in both languages. The dictionary handles dynamic strings (form labels, error messages, ARIA) via `data-i18n="key"` attributes; page bodies are rendered server-side. `<html lang="bg">` and `<html lang="en">` per page. Language switcher in nav links to the sibling URL.

### Forms (Phase 1)

| Form | Endpoint | Sends to |
|---|---|---|
| Contact (`/contacts/`) | Netlify Forms | badminton@margel.info |
| Kids training sign-up (`/kids/`) | Netlify Forms (separate name) | badminton@margel.info |
| Request a slot (`/book/`) | Netlify Forms (separate name) | badminton@margel.info |

All forms include client-side validation in addition to HTML5 validation, per CLAUDE.md.

### Performance budget

- LCP < 2.5s on 3G (mobile).
- Total JS < 80 KB gzipped (GSAP + Lenis + ours).
- Hero images served as WebP; `loading="lazy"` everywhere except above-fold.
- Reduced motion respected via `@media (prefers-reduced-motion: reduce)`.

### Accessibility floor

- WCAG AA contrast (verified: court green `#0A8050` on ivory `#F7F5EE` = 4.65:1).
- Keyboard-navigable; visible focus rings (custom — never `outline: none` without replacement).
- All motion has reduced-motion fallback.

### Deployment

- Netlify; publish dir = `Clients/Badminton Vitosha/website/`.
- Forms auto-detected.
- `_redirects` file for old WordPress URLs.

## 3. Design system

### Palette

| Token | Hex | Usage |
|---|---|---|
| Court | `#0A8050` | Primary CTA · highlights · brand |
| Court Deep | `#04432A` | Hero gradients · hover states |
| Ink | `#0C1A12` | Text · ghost CTA borders |
| Ivory | `#F7F5EE` | Page background · type on dark |
| Stone | `#D6C8A8` | Tonal surfaces · secondary CTAs |

### Typography

- **Display**: Cormorant Garamond Italic (Google Fonts, Cyrillic + Latin)
- **UI / body**: Inter (Google Fonts, Cyrillic + Latin)

Type scale:

| Token | Size / line-height | Use |
|---|---|---|
| display-xl | 88 / 0.95 | Home hero |
| display-l | 56 / 1.0 | Page heroes |
| display-m | 36 / 1.05 | Section headlines |
| heading | 22 / 1.2 | Card titles, dates |
| body | 16 / 1.6 | Long-form |
| small | 13 / 1.5 | Meta, captions |
| eyebrow | 11 / 0.25em (uppercase, court green) | Section labels |

Display sizes scale down on mobile (display-xl → 56, display-l → 40, display-m → 28).

### Components

- **Buttons** (pill radius, 14px label, 600 weight, hover lifts 2px):
  - **Primary** — court green, ivory text, magnetic-pull on hover (primary CTAs only).
  - **Ghost** — transparent, ink border, fills on hover.
  - **Tonal** — stone surface.
  - **Link-underline** — body text with persistent underline, switches to court green on hover.
- **Cards** — white surface, hairline border, 12px radius, lifts 4px on hover with soft shadow. Used for news, kids training teasers, equipment items.
- **Court grid** — 80px time column + 5 court columns. States: `free` (court-tinted bg), `taken` (gray), `selected` (ink). Keyboard-navigable: arrow keys move selection, Enter confirms.

### Motion vocabulary

| Effect | Implementation | Use |
|---|---|---|
| Word reveal | GSAP SplitText, 1.4s, ease-soft | Hero headlines |
| SVG court draw | stroke-dashoffset + ScrollTrigger, 2.4s | Section transitions |
| Magnetic CTA | mouse-tracking translate, spring ease | Primary CTAs only |
| Marquee ticker | infinite translateX | Partner logos, opening hours |
| Parallax photo | transform on scroll, 0.85 ratio | Hero photography |
| Section fade-up | ScrollTrigger, 600ms ease-out | Default for content blocks |

All motion respects `prefers-reduced-motion`.

## 4. Booking system architecture (Phase 2)

### Database

| Table | Purpose |
|---|---|
| `courts` | 5 fixed courts: id, name, display_order, active flag. Seeded once. |
| `pricing_rules` | Hour-of-day → price. Editable from admin. e.g. 08:00–16:00 = €6.65, 16:00–22:00 = €9.20. |
| `bookings` | court_id, starts_at, ends_at, customer fields, status, edit_token (UUID), created_at. |
| `booking_holds` | 5-minute holds while user fills form. Prevents two browsers grabbing the same slot. |
| `kids_signups` | child name, age, parent contact, batch reference. |
| `booking_edit_log` | audit log mirroring Margel360 `enquiry_edit_log`. |

### Conflict prevention

Postgres `EXCLUDE` constraint on `bookings(court_id, time_range)` via `btree_gist`. Two confirmed bookings for the same court+time literally cannot exist. Holds use the same constraint scoped to active (non-expired) holds.

### Auth & RLS

- **anon role**: `INSERT` bookings (with hold validation), `SELECT` only own booking via `edit_token` URL param.
- **authenticated role (admin)**: full read/write on all tables.
- **Edit tokens**: every booking gets a UUID `edit_token`. Customer email links to `/book/edit/?token=...` to view or cancel — same pattern as Margel360 enquiries. Token expires N days after the booking date (N = 7, configurable).
- **Edit log**: `booking_edit_log` records views/edits/lock attempts.

### Public booking flow

1. User opens `/book/`, picks date → `booking.js` queries `bookings` + `booking_holds` for that day → renders availability grid.
2. User clicks free slot → POST to Edge Function `booking-hold` → 5-min hold inserted → grid updates.
3. User fills form → submit → Edge Function validates hold belongs to session, converts to confirmed booking, sends email (Resend) with edit link.
4. Confirmation page shows edit-token URL.

### Admin panel (`/admin/`)

- Login (Supabase Auth, email + password). Single admin user initially (Angel).
- **Today** — chronological list of today's bookings, quick search.
- **Week** — full week grid (drag-to-reschedule deferred to Phase 3).
- **All bookings** — searchable table with date range, customer, court, status filters.
- **Manual booking** form — for phone-ins.
- **Pricing** editor — adjust hour-of-day rates without touching code.
- **Kids training** tab — signups list, per-batch view, mark as paid.
- **Edit log** view — audit trail.

### Notifications

- Customer confirmation on booking → Resend via Edge Function.
- Admin notification on new booking → same channel.
- 24-hour reminder → scheduled function (Supabase pg_cron or Netlify scheduled function). May slip to Phase 3.

### Payments

Phase 2 ships **pay-on-arrival**. The hold/booking flow is designed to accept a Stripe step in front of confirmation later (Phase 3) without restructuring.

## 5. Phasing & deliverables

### Phase 1 — Public site (~2–3 weeks build)

**In scope:**
- 8 pages × 2 languages (BG canonical + EN mirror).
- News index + 6 migrated posts × 2 languages.
- Full motion library applied across pages.
- Contact form (Netlify Forms).
- Kids training sign-up form (Netlify Forms).
- "Request a court slot" form on `/book/` (Netlify Forms placeholder).
- Existing flame logo refined SVG reused.
- 301 redirects from top old WordPress URLs.

**Out of scope:**
- Real booking grid (Phase 2).
- Admin panel (Phase 2).
- Stripe (Phase 3).
- Email automation (Phase 2 part B / 3).
- Coach photos and shop product photos pending client provision; placeholders used in interim.

**Milestones:**
- M1 — Scaffold + design system (tokens.css, base.css, components.css) — day 3.
- M2 — Home + nav + footer + i18n switcher in both languages — day 6.
- M3 — All 8 pages built with real content, Phase 1 forms wired — day 11.
- M4 — Motion layer applied, perf + a11y audit pass — day 14.
- M5 — Deploy to Netlify, redirects live, client review — day 16.
- M6 — Polish round + go-live — day 18–21.

**Definition of Done:**
- Lighthouse Performance ≥ 90 mobile, Accessibility = 100, SEO ≥ 95.
- All Phase 1 forms tested submitting to Netlify.
- Both languages render identically; all `data-i18n` keys covered.
- 301s tested for top 5 old URLs.
- Stubbed content marked clearly with `<!-- TODO: client to provide -->`.

### Phase 2 — Booking system + admin (~3–4 weeks build, after Phase 1 ship)

**In scope:**
- Supabase project provisioned with the 6 tables, RLS, exclusion constraints.
- Public booking grid (`/book/`) replacing the placeholder form.
- Hold + confirm flow with edit-token email links.
- Admin panel at `/admin/` with auth, today/week views, all-bookings table, manual booking, pricing editor, kids signups, edit log.
- Customer confirmation + admin notification emails (Resend).
- Postgres backups configured.

**Milestones:**
- M1 — Supabase project + 6 tables + RLS + seed data — day 3.
- M2 — Public booking grid (read-only) wired to Supabase — day 6.
- M3 — Hold + confirm flow + edit-token email link — day 11.
- M4 — Admin panel: auth, today/week views, manual booking — day 16.
- M5 — Pricing editor, kids signups view, edit log — day 19.
- M6 — Email notifications (Resend), reminder cron — day 22.
- M7 — Booking go-live, placeholder form retired — day 24–28.

**Definition of Done:**
- Two browsers cannot double-book — load test confirms.
- Edit-token flow works end-to-end (booking email → click → cancel).
- Admin can manually book, edit, cancel, see today's schedule at a glance.
- All booking errors have BG + EN messages.

### Phase 3 — Future (out of scope for this spec)

- Stripe checkout (deposit or full payment at booking).
- Automated 24h reminder emails / SMS.
- Supabase Realtime for live availability updates without refresh.
- Drag-to-reschedule in admin week view.
- Customer accounts with booking history and recurring slots.
- Tournament registration system (the venue runs tournaments).
- Real e-commerce on `/shop/` if data shows demand.

### Total estimated build effort

5–7 weeks split into two ships, so the client gets visible value fast.

## Implementation note

Phase 1 and Phase 2 will each get their own implementation plan. The Phase 1 plan is written first and executed; the Phase 2 plan is written after Phase 1 ships, when real-world feedback may shift booking system priorities.

## Open items at spec time

These do not block writing the implementation plan but must be resolved before Phase 1 ship:

1. **Pricing table** — full breakdown beyond `€6.65 off-peak / €9.20 peak` (e.g. weekend rates, kids rates, court-rental vs per-person).
2. **Kids training schedule** — days, times, age groups, coach name, prices.
3. **Shop product list** — real items, brands, prices (or explicit permission to invent representative samples).
4. **Coach photos & bios** — currently no coach content on existing site.
5. **Multisport partnership terms** — what to communicate publicly on the About page.

## Appendix — assets discovered

- Logos: `logo-vertical-7-01.svg`, `badminton_logo_vertical_no_bckgr.png`, `badminton-1024x1024.png` (existing WordPress media library).
- Hero photography: `front-view-blurry-woman-playing-badminton-683x1024.jpg`, `little-boy-playing-badminton-isolated-white-wall-1024x683.jpg`, `young-woman-playing-badminton-white-wall-683x1024.jpg`, `45364.png` (hall banner).
- Venue photos: provided by Angel during brainstorming — kids group training, adult doubles match (court interior with YONEX/FZ Forza branding).
