# AB Intelligence — Claude Code Guide

## Project Context

AB Intelligence is a web development agency building client websites. Work lives under `Clients/[ClientName]/` following the structure defined in `README.md`. Each client gets their own folder with `website/`, `assets/`, `docs/`, and `notes.md`.

---

## Tech Stack

- **HTML/CSS/JS only** — no frameworks, no build tools unless the client specifically requires it
- **No npm, no bundlers** by default — keep dependencies at zero for simple sites
- **Vanilla JS** for interactivity; only reach for a library (e.g. Alpine.js, GSAP) when the task is genuinely complex and vanilla would be disproportionately verbose
- **Deployment:** Netlify or Vercel — static file hosting, no server-side code unless explicitly scoped

---

## File & Folder Conventions

```
Clients/[ClientName]/
├── website/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── main.js
│   └── assets/
│       ├── images/
│       └── fonts/
├── assets/        ← raw brand files (logos, photos from client)
├── docs/          ← contracts, proposals, invoices
└── notes.md       ← project status and notes
```

- File names: lowercase, hyphenated (`about-us.html`, `hero-bg.jpg`)
- One CSS file per project unless complexity justifies splitting
- Keep JS minimal and in `main.js` unless multiple distinct features warrant separate files

---

## Code Standards

### HTML
- Use semantic elements (`<header>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<nav>`)
- Every `<img>` must have a meaningful `alt` attribute (empty `alt=""` only for decorative images)
- Use `<button>` for interactive elements, not `<div>` or `<span>`
- Include `lang` attribute on `<html>`, proper `<meta charset>` and viewport tag

### Accessibility
- Ensure keyboard navigation works for all interactive elements
- Use ARIA labels where semantic HTML is insufficient
- Sufficient color contrast (WCAG AA minimum)
- Focus styles must be visible — never `outline: none` without a replacement

### CSS
- **Mobile-first** — base styles for small screens, use `min-width` media queries to scale up
- Use CSS custom properties (`--color-primary`, `--font-base`, etc.) for consistency
- Avoid inline styles
- Keep specificity low — prefer class selectors

### Performance
- Compress and size images appropriately before using them (use WebP where possible)
- Minimize JS — no script should run that isn't needed on that page
- Avoid render-blocking resources — defer or async scripts where possible
- Aim for fast initial load; no heavy animations that aren't justified by the brief

---

## Per-Project Scope Guidance

### Brochure / Landing Page
- Static HTML only, no JS unless needed for nav toggle or minor UI
- Focus on fast load, clean layout, strong visual hierarchy
- No backend — contact forms use a service like Netlify Forms or Formspree

### Contact Forms + Interactivity
- Use Netlify Forms (preferred) or Formspree for form handling
- Validate inputs client-side with vanilla JS; never rely solely on HTML5 validation
- Keep JS focused — one clear purpose per function

### E-commerce / Booking
- Clarify with the client before starting: are we integrating a third-party (Stripe, Shopify Buy Button, Calendly embed) or building custom?
- Default to embedding a trusted third-party tool rather than building payment/booking logic from scratch
- Document the integration in `notes.md`

---

## Deployment

### Before deploying to Netlify/Vercel:
- All links are relative and work from the root
- No hardcoded localhost URLs
- Images and assets are referenced by correct relative paths
- Forms are wired to Netlify Forms or external service
- Site has been tested on mobile (375px) and desktop (1280px+)
- Page titles and meta descriptions are set per page

### Netlify specifics:
- Drag-and-drop the `website/` folder, or connect the repo and set publish directory to `Clients/[ClientName]/website`
- Use `_redirects` file for any URL redirect rules
