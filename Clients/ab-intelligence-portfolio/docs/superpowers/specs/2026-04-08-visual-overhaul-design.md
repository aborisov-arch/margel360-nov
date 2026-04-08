# AB Intelligence Portfolio — Visual Overhaul Design Spec

## Goal
Redesign the AB Intelligence portfolio site to match the premium minimalist aesthetic of Metalab.com — full black background, massive editorial typography, horizontal service rows, and smooth Framer Motion interactions. Remove all glassmorphism and blue gradient effects.

## Color Palette
- **Background:** `#000000` (pure black throughout)
- **Foreground:** `#ffffff` (white)
- **Muted text:** `#6b7280` (grey)
- **Accent:** `#1d4ed8` (deep electric blue)
- **Border/divider:** `#1a1a1a` (near-black thin lines)

## Typography
- Font: Inter (already loaded) — increase scale significantly
- Hero H1: `clamp(3.5rem, 8vw, 7rem)`, weight 800, tight line-height (1.05)
- Section headings: `clamp(2rem, 4vw, 3.5rem)`, weight 700
- Service row names: `clamp(1.8rem, 3.5vw, 3rem)`, weight 700
- Body: `1rem`, weight 400, muted grey
- Numbers (01, 02...): `0.85rem`, weight 600, accent blue

## Global Style Changes
- Remove all `glass-card`, `glow-box`, `glow-box-hover` classes
- Remove all blue gradient backgrounds
- Remove all `backdrop-filter: blur()` effects
- CSS variable `--background` → `0 0% 0%` (pure black)
- CSS variable `--primary` → `#1d4ed8`
- All section backgrounds: `#000`
- Dividers: `1px solid #1a1a1a`

---

## Navigation
- Full-width black bar, no background change on scroll (stays `#000`)
- Logo far left
- Nav links center-right: Услуги, Цени, Калкулатор, Контакти
- CTA button far right: "Свържете се" — white border, white text, hover fills white bg with black text
- Mobile: hamburger opens full-screen black overlay with large nav links
- Remove current transparent → scrolled behavior

## Hero Section
- Full viewport height, pure black background
- **Remove** the floating mockup card on the right
- **Remove** the logo watermark overlay
- Animated text reveal: each word enters with `y: 40 → 0, opacity: 0 → 1`, staggered 0.12s per word
- Headline (3 lines, massive):
  ```
  Изграждаме
  дигиталното бъдеще
  на вашия бизнес.
  ```
- Subtitle below: "Уеб агенция от София, България." — small, muted grey
- Two buttons below subtitle:
  - Primary: white background, black text, pill shape — "Сметнете инвестицията"
  - Ghost: white border, white text, pill shape — "Свържете се"
- Subtle animated grain texture overlay (CSS noise, `opacity: 0.03`) — purely decorative
- Layout: left-aligned content, vertically centered

## Services Section (replaces Portfolio)
- Remove `PortfolioSection` component entirely
- Remove `ServicesSection` (old emoji card grid) — replace with new `ServicesSection`
- Remove the `PortfolioSection` import and usage from `Index.tsx`
- Full black background
- Section label at top: small caps "— УСЛУГИ —" in accent blue
- Services rendered as horizontal rows separated by `1px solid #1a1a1a` lines:
  ```
  01 — Уеб дизайн           →
  02 — SEO Оптимизация      →
  03 — Мобилна оптимизация  →
  04 — Поддръжка            →
  05 — Брандинг             →
  ```
- Each row: number (accent blue, small) + em dash + service name (large, white) + arrow (right-aligned, muted)
- **Hover interaction:** 
  - Row background subtly lightens to `#0a0a0a`
  - Number brightens to accent blue
  - Short description text fades in on the right (replacing the arrow): e.g. "Модерни уебсайтове, проектирани да впечатляват."
  - Smooth `transition: all 0.3s ease`
- Framer Motion: rows animate in with staggered `y: 20 → 0, opacity: 0 → 1` on scroll

## About Section
- Two columns, thin vertical divider between them
- Left: large bold statement — `"18+ проекта. 100% клиентско удовлетворение."` — white, big
- Right: short paragraph in muted grey
- Black background, no cards

## Pricing Section
- Flat minimal pricing cards — black background, `1px solid #1a1a1a` border, `border-radius: 12px`
- No glassmorphism, no glow effects
- Price displayed large and white, features in muted grey list below
- Hover: border color transitions to `#1d4ed8`

## Calculator Section
- Flat minimal style
- Inputs: thin `1px solid #1a1a1a` border, black background, white text
- Focus state: border turns `#1d4ed8`
- Result displayed large and bold in white

## Contact Section
- Huge heading: "Свържете се с нас." — takes up ~40% of viewport height visually
- Email and phone below in muted grey
- Simple flat form underneath (same fields, minimal style matching calculator)
- Black background

## Footer
- Single row layout: logo left, nav links center, social icons right
- One `1px solid #1a1a1a` top border
- Everything black, text muted grey
- No multi-column grid

---

## Component Changes Summary
| Component | Action |
|---|---|
| `index.css` | Update CSS variables, remove glass/glow utilities |
| `Navbar.tsx` | Remove scroll transparency, add full-screen mobile overlay |
| `HeroSection.tsx` | Remove mockup card + logo overlay, add word-by-word reveal |
| `ServicesSection.tsx` | Complete rewrite — horizontal numbered rows |
| `PortfolioSection.tsx` | Delete entirely |
| `AboutSection.tsx` | Two-column bold statement layout |
| `PricingSection.tsx` | Remove glassmorphism, flat minimal cards |
| `CalculatorSection.tsx` | Flat minimal inputs |
| `ContactSection.tsx` | Huge heading + flat form |
| `Footer.tsx` | Single-row layout |
| `Index.tsx` | Remove PortfolioSection import and usage |
