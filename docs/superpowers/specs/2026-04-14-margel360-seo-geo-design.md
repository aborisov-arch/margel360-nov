# Margel360 SEO + GEO Optimisation — Design Spec
Date: 2026-04-14
Scope: `Clients/Margel360/website/`
Target market: Sofia, Bulgaria — event venue searches in Bulgarian and English

---

## Goal

Rank Margel360.bg for high-intent local searches in Sofia ("зала под наем София", "сватбена зала София", "зала рожден ден София") and get the venue cited by AI systems (ChatGPT, Perplexity, Google AI Overviews) when users ask about event venues in Sofia.

No paid tools, no frameworks. Pure HTML/CSS/JS changes.

---

## Section 1 — Technical Foundations

### 1.1 Typo fix
- File: every HTML page footer (via `translations-*.js` and static HTML)
- Fix: "в сърцето на Враца" → "в сърцето на София"
- Static footer text in `faq.html`, `contact.html`, `gallery.html`, `services.html`, `reservation.html` must also be corrected directly in HTML

### 1.2 Sitemap
- File: `sitemap.xml`
- Add `<lastmod>2026-04-14</lastmod>` to every `<url>` entry

### 1.3 hreflang
- Add to `<head>` of every page:
  ```html
  <link rel="alternate" hreflang="bg" href="https://margel360.bg/[page]">
  <link rel="alternate" hreflang="x-default" href="https://margel360.bg/[page]">
  ```
- Rationale: site has BG/EN toggle but no separate URL structure, so `x-default` points to the Bulgarian canonical

### 1.4 OG + Twitter completion
- Every inner page (faq, services, gallery, contact, reservation) gets:
  - `og:type` = "website"
  - `og:locale` = "bg_BG"
  - `og:site_name` = "Маргел 360°"
  - `twitter:card` = "summary_large_image"
  - `twitter:title`, `twitter:description`, `twitter:image`

---

## Section 2 — Schema / JSON-LD

### 2.1 Homepage EventVenue schema — additions
Add to existing JSON-LD block:
```json
"geo": { "@type": "GeoCoordinates", "latitude": 42.6739, "longitude": 23.2614 },
"openingHours": "Mo-Su 00:00-23:59",
"priceRange": "€330 – €1500",
"hasMap": "https://maps.google.com/?q=Маргел+360,+бул.+Околовръстен+път+155,+София",
"image": [
  "https://margel360.bg/assets/images/gallery-evening-1.jpg",
  "https://margel360.bg/assets/images/event-wedding.jpg",
  "https://margel360.bg/assets/images/event-birthday.jpg",
  "https://margel360.bg/assets/images/header-gallery.jpg"
],
"currenciesAccepted": "BGN, EUR",
"paymentAccepted": "Cash, Credit Card, Bank Transfer",
"maximumAttendeeCapacity": 140,
"address": {
  "@type": "PostalAddress",
  "streetAddress": "бул. Околовръстен път 155, ет.4",
  "addressLocality": "София",
  "postalCode": "1618",
  "addressCountry": "BG"
}
```

### 2.2 FAQ page — FAQPage schema
New `<script type="application/ld+json">` on `faq.html`:
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Какъв е капацитетът на залата?",
      "acceptedAnswer": { "@type": "Answer",
        "text": "Маргел 360° побира до 100 гости на маса и до 140 гости на коктейл." }
    },
    ... (all FAQ pairs)
  ]
}
```

### 2.3 Services page — Offer schema
New JSON-LD on `services.html`:
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Допълнителни услуги — Маргел 360°",
  "itemListElement": [
    { "@type": "Offer", "name": "DJ за 5 часа", "price": "587", "priceCurrency": "BGN" },
    { "@type": "Offer", "name": "Фотограф за 2 часа", "price": "340", "priceCurrency": "BGN" },
    ... (all services with prices)
  ]
}
```

### 2.4 Contact page — LocalBusiness schema
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Маргел 360°",
  "telephone": "+359888100042",
  "email": "360@margel.info",
  "url": "https://margel360.bg",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "бул. Околовръстен път 155, ет.4",
    "addressLocality": "София",
    "postalCode": "1618",
    "addressCountry": "BG"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 42.6739, "longitude": 23.2614 },
  "openingHours": "Mo-Su 00:00-23:59"
}
```

### 2.5 BreadcrumbList + WebPage — all inner pages
Each inner page gets:
```json
[
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Начало", "item": "https://margel360.bg/" },
      { "@type": "ListItem", "position": 2, "name": "[Page]", "item": "https://margel360.bg/[page]" }
    ]
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "[Page title]",
    "url": "https://margel360.bg/[page]",
    "isPartOf": { "@type": "WebSite", "url": "https://margel360.bg" }
  }
]
```

---

## Section 3 — FAQ Static HTML

### Problem
`faq.html` has `<div id="faq-list"></div>` — JS populates it at runtime. AI crawlers and some Googlebot fetches see an empty div.

### Solution
Replace the empty div with full static `<details>`/`<summary>` markup containing Bulgarian answers. The existing JS accordion and language toggle continue to work on top.

Structure:
```html
<details class="faq-item" itemscope itemprop="mainEntity"
         itemtype="https://schema.org/Question">
  <summary class="faq-q" itemprop="name">
    Какъв е капацитетът на залата?
  </summary>
  <div class="faq-a" itemprop="acceptedAnswer"
       itemtype="https://schema.org/Answer" itemscope>
    <p itemprop="text">
      Маргел 360° побира до 100 гости на маса и до 140 гости на коктейл...
    </p>
  </div>
</details>
```

All existing FAQ questions (from `translations-faq.js`) are written into the static HTML in Bulgarian. The JS language toggle then swaps text for EN visitors.

---

## Section 4 — GEO Content Layer

### 4.1 Entity facts block
Add to `index.html` (visible on page, not hidden):
A compact "Маргел 360° в числа" section with factual stats that are currently only in JS:
- 100 гости на маса / 140 на коктейл
- 260м² панорамна тераса
- 70+ паркоместа
- бул. Околовръстен път 155, ет.4, София 1618
- 0888 100 042

### 4.2 FAQ answer rewrites (GEO-optimised)
Each answer leads with the direct fact, includes venue name and location. Examples:

| Before | After |
|--------|-------|
| "Залата разполага с достатъчно паркоместа" | "Маргел 360° разполага с 70+ безплатни паркоместа на бул. Околовръстен път 155, София" |
| "Можете да изберете от нашите услуги" | "Маргел 360° предлага DJ (587 лв.), фотограф (340–580 лв.), фото будка 360° (390–560 лв.) и 20+ допълнителни услуги" |

### 4.3 Image alt text — full audit
Every `<img>` across all pages. Pattern:
`alt="[What is shown] — [Venue name] [Location]"`

Examples:
- `alt="Сватбена зала Маргел 360° — панорамна тераса 260м², София"`
- `alt="Детски рожден ден в зала Маргел 360°, бул. Околовръстен път 155, София"`
- `alt="Корпоративно събитие в зала Маргел 360°, София — конферентна конфигурация"`

### 4.4 Title tag optimisation — all pages

| Page | Before | After |
|------|--------|-------|
| index.html | Маргел 360° — Зала за събития в София \| ... | Зала под наем София — Маргел 360° \| Сватби, Рождени дни, Корпоративни |
| faq.html | Често задавани въпроси — Маргел 360° \| FAQ | Зала под наем София — Въпроси и отговори \| Маргел 360° |
| services.html | Услуги и Цени — Маргел 360° \| DJ, Декор, Фотограф | Услуги и Цени за Наем на Зала в София — Маргел 360° |
| gallery.html | Галерия — Маргел 360° \| Снимки от сватби... | Снимки от Събития в София — Галерия Маргел 360° |
| contact.html | Контакти — Маргел 360° \| бул. Околовръстен път 155 | Контакти — Зала Маргел 360°, София \| 0888 100 042 |
| reservation.html | Онлайн Запитване — Маргел 360° \| ... | Резервирайте Зала в София — Онлайн Запитване \| Маргел 360° |

---

## Out of scope (deferred)
- `aggregateRating` schema — pending Google Business Profile domain switch
- Blog / content marketing pages
- Google Business Profile optimisation

---

## Files touched
- `website/index.html`
- `website/faq.html`
- `website/services.html`
- `website/gallery.html`
- `website/contact.html`
- `website/reservation.html`
- `website/sitemap.xml`
- `website/js/translations-faq.js` (FAQ answer rewrites)
- `website/js/translations-index.js` (footer Sofia fix)
