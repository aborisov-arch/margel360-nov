# Badminton Vitosha — Claude Code Guide

## Project context

Modern bilingual rebuild of [badminton-vitosha.bg](https://badminton-vitosha.bg) — a 5-court indoor badminton hall in Sofia. Same ownership group as Margel360 (`margel.info` email domain).

**Design spec**: [docs/superpowers/specs/2026-04-30-badminton-vitosha-rebuild-design.md](docs/superpowers/specs/2026-04-30-badminton-vitosha-rebuild-design.md) — the source of truth for IA, tech architecture, design system, booking architecture, and phasing. Read it before making decisions.

**Phasing**: Phase 1 = public site (~2–3 weeks). Phase 2 = booking system + admin (~3–4 weeks, after Phase 1 ships). Each phase gets its own implementation plan.

## What's different from the parent AB Intelligence CLAUDE.md

The root [CLAUDE.md](../../CLAUDE.md) applies. Departures specific to this project:

- **GSAP 3 + Lenis are allowed via CDN** — the Dynamic Editorial motion brief (kinetic word reveals, ScrollTrigger SVG draws, magnetic CTAs) is genuinely complex; vanilla equivalents would be disproportionately verbose. No npm, no bundler.
- **Five CSS files instead of one** — `tokens.css`, `base.css`, `components.css`, `pages.css`, `motion.css`. Justified by 8 pages × 2 languages plus a booking system and admin panel coming in Phase 2. Single sheet would be unwieldy.
- **Per-language URL trees** — `/` (Bulgarian, canonical) and `/en/` (English mirror). Each page has a sibling. Static HTML in both trees for SEO; `data-i18n="key"` + JSON dictionary handles dynamic strings only.
- **Supabase backend (Phase 2)** — Reuse the Margel360 patterns where they fit. Edit-token flow for customer self-service, RLS for anon vs. authenticated, `EXCLUDE` constraints via `btree_gist` for double-booking prevention.

## Visual system

- **Palette**: Court `#0A8050` · Court Deep `#04432A` · Ink `#0C1A12` · Ivory `#F7F5EE` · Stone `#D6C8A8`
- **Type**: Cormorant Garamond Italic (display) + Inter (UI) — both Cyrillic + Latin
- **Motion vocabulary**: word reveal · SVG court draw · magnetic CTA · marquee ticker · parallax · section fade-up. All gated by `prefers-reduced-motion`.

## Content sourcing

- BG copy is migrated **verbatim** from the existing site (preserves SEO, saves rewrite work). Hero text is locked.
- EN copy is translated and adapted by AB Intelligence.
- Imagery comes from the existing WordPress media library plus venue photos provided by Angel. Replacement Unsplash photos are allowed where existing images are weak.
- Logo: existing flame mark, reusing `logo-vertical-7-01.svg` from the WordPress media library.

## Open content items (block Phase 1 ship, not the plan)

1. Full pricing table beyond €6.65 / €9.20
2. Kids training schedule (days, times, age groups, coach name)
3. Shop product list (or permission to invent representative samples)
4. Coach photos & bios
5. Multisport partnership terms — what's public

Stub these with `<!-- TODO: client to provide -->` until resolved.
