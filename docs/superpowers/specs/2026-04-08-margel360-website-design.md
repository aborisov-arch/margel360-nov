# Margel 360° Website Rebuild — Design Spec

**Date:** 2026-04-08  
**Client:** Margel 360° (event venue)  
**Project type:** Demo rebuild — existing WordPress site → plain HTML/CSS/JS  
**Goal:** Modernize and clean up the existing site structure for a client demo. Same content, same pages, better code and visual polish.

---

## Overview

Rebuild the Margel 360° event venue website as a static multi-page HTML/CSS/JS site. The demo will match the current site's page structure but with a modernized visual design. No backend. Language toggle (BG/EN) included.

---

## File Structure

```
Clients/Margel360/website/
├── index.html              ← Home
├── gallery.html            ← Gallery
├── faq.html                ← FAQ
├── services.html           ← Additional services
├── contact.html            ← Contact details
├── reservation.html        ← Make a reservation (demo form)
├── css/
│   └── style.css
├── js/
│   ├── main.js             ← nav, scroll, shared UI
│   └── translations.js     ← BG/EN strings per page
└── assets/
    ├── images/
    └── fonts/
```

---

## Pages

### index.html — Home
Sections (top to bottom):
1. **Hero** — full-viewport background image, centered headline + subheading + CTA button ("Make a Reservation")
2. **Event Types** — card grid: Corporate 4h, Corporate 8h, Kids Birthday (daytime), Kids Birthday (evening), Wedding. Each card: image, title, hours, price
3. **About Margel 360°** — short description paragraph, key highlights
4. **Equipment** — icon grid with labels (own bar, catering area, toilets, 360° sound system, modern lighting, multimedia, security, air conditioning, info screens, spacious dancefloor, two outdoor areas)
5. **Photo teaser** — horizontal scroll or grid preview linking to gallery.html

### gallery.html — Gallery
- Full CSS grid of event photos
- Click image → fullscreen lightbox with prev/next arrows and close (vanilla JS, no library)

### faq.html — FAQ
- Accordion list of questions/answers
- One answer open at a time
- Questions sourced from the current site (Bulgarian + English translations)

### services.html — Additional Services
- List/grid of additional services the venue offers
- Static content, no interaction

### contact.html — Contact
- Address, phone number, email
- Embedded Google Map (iframe)
- Facebook and Instagram icon links

### reservation.html — Reservation Form
- Fields: Full name, Phone, Event type (dropdown), Preferred date (date input), Message (textarea)
- Client-side validation: all fields required, phone format check
- On valid submit: hide form, show "Thank you" confirmation message in place
- No backend for demo — form does not send data

---

## Visual Design

| Property | Value |
|---|---|
| Background | `#0a0a0a` / `#111111` |
| Primary text | `#ffffff` |
| Accent | `#e63030` (red, matching Margel branding) |
| Font | Inter (Google Fonts), fallback: Arial, sans-serif |
| Border radius | 8px on cards |
| Section padding | 80px vertical |

- Fixed top nav: transparent over hero, solid dark (`#111`) on scroll
- Active page link highlighted in accent red
- Mobile nav: hamburger menu, slides in from left, < 768px breakpoint
- Hover states: smooth transitions (0.2s ease) on buttons, cards, links
- Mobile-first CSS with `min-width` media queries

---

## Language Toggle (BG / EN)

- `BG | EN` toggle button in top nav (far right)
- All translatable text uses `data-i18n="key"` attributes in HTML
- `translations.js` on each page exports a `translations` object with `bg` and `en` keys
- `main.js` reads current language from `localStorage` on page load and applies it
- Toggling saves new language to `localStorage` and swaps all `data-i18n` elements instantly
- Default language: Bulgarian

---

## Components

### Nav
- Logo (left), page links (center/right), BG|EN toggle (far right)
- Becomes hamburger on mobile
- `position: fixed`, `z-index: 100`
- Background transitions from transparent → `#111` after 80px scroll

### Event Cards
- CSS grid, 3 columns desktop / 2 tablet / 1 mobile
- Image top, content below: event name, hours, price
- Static — no click action for demo

### Lightbox (gallery.html)
- Triggered by clicking any gallery image
- Fullscreen overlay, centered image, prev/next buttons, close (×) button
- Keyboard: Escape to close, arrow keys for prev/next
- Pure vanilla JS, ~50 lines

### FAQ Accordion (faq.html)
- `<details>`/`<summary>` elements or custom JS toggle
- Only one item open at a time
- Smooth height transition on open/close

### Reservation Form (reservation.html)
- Validates on submit (not on blur for demo simplicity)
- Shows inline error messages below invalid fields
- On success: form element hidden, success message shown

---

## Deployment

- Deploy `Clients/Margel360/website/` folder to Netlify (drag & drop for demo)
- No `_redirects` needed for demo
- All asset paths relative to root

---

## Out of Scope (Demo)

- Real form submission / email delivery
- CMS or editable content
- Animations beyond CSS transitions
- SEO meta tags (can be added before final delivery)
- Real client photos (use placeholder images for demo)
