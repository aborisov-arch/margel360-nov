# Margel360 SEO + GEO Optimisation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make margel360.bg rank for high-intent Sofia event venue searches and get cited by AI systems (ChatGPT, Perplexity, Google AI Overviews).

**Architecture:** Pure HTML/JS content changes — no build tools. Each task targets specific files and produces a git commit. Changes are additive and non-breaking.

**Tech Stack:** Static HTML5, JSON-LD (Schema.org), Open Graph, hreflang, Flatpickr (existing), Vanilla JS (existing)

---

## Files Modified

| File | Changes |
|------|---------|
| `website/index.html` | Enhanced JSON-LD, hreflang, new title, image alts |
| `website/faq.html` | FAQPage JSON-LD, BreadcrumbList, static FAQ HTML, new title, hreflang |
| `website/services.html` | ItemList JSON-LD, BreadcrumbList, new title, hreflang, OG/Twitter complete |
| `website/gallery.html` | BreadcrumbList, new title, hreflang, OG/Twitter complete, image alts |
| `website/contact.html` | LocalBusiness JSON-LD, BreadcrumbList, new title, hreflang, OG/Twitter complete |
| `website/reservation.html` | BreadcrumbList, new title, hreflang, OG/Twitter complete |
| `website/sitemap.xml` | Add `lastmod` to all URLs |
| `website/js/faq.js` | GEO-optimised FAQ answers, correct capacity (140 not 200) |
| `website/js/translations-faq.js` | Fix "Враца" → "София" typo |
| `website/js/translations-index.js` | Fix "Враца" → "София" typo |

---

## Task 1: Fix Typo + Sitemap lastmod

**Files:**
- Modify: `website/js/translations-faq.js:7`
- Modify: `website/js/translations-index.js:27`
- Modify: `website/sitemap.xml`

- [ ] **Step 1: Fix "Враца" → "София" in translations-faq.js**

Change line 7:
```javascript
footer_desc: 'Зала за всяко събитие в сърцето на София.',
```

- [ ] **Step 2: Fix "Враца" → "София" in translations-index.js**

Change line 27 (the `footer_desc` in the `bg` object):
```javascript
footer_desc: 'Зала за всяко събитие в сърцето на София.',
```

- [ ] **Step 3: Add lastmod to sitemap.xml**

Replace the full file content:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://margel360.bg/</loc>
    <lastmod>2026-04-14</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://margel360.bg/gallery.html</loc>
    <lastmod>2026-04-14</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://margel360.bg/services.html</loc>
    <lastmod>2026-04-14</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://margel360.bg/reservation.html</loc>
    <lastmod>2026-04-14</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://margel360.bg/faq.html</loc>
    <lastmod>2026-04-14</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://margel360.bg/contact.html</loc>
    <lastmod>2026-04-14</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

- [ ] **Step 4: Commit**
```bash
git add website/js/translations-faq.js website/js/translations-index.js website/sitemap.xml
git commit -m "seo: fix Sofia typo in footer translations + add sitemap lastmod"
```

---

## Task 2: Homepage — Enhanced JSON-LD + hreflang + Title + Image Alts

**Files:**
- Modify: `website/index.html`

- [ ] **Step 1: Update title tag**

Replace:
```html
<title>Маргел 360° — Зала за събития в София | Сватби, Рождени дни, Корпоративни</title>
```
With:
```html
<title>Зала под наем София — Маргел 360° | Сватби, Рождени дни, Корпоративни</title>
```

- [ ] **Step 2: Add hreflang after the canonical tag**

After `<link rel="canonical" href="https://margel360.bg/">` add:
```html
<link rel="alternate" hreflang="bg" href="https://margel360.bg/">
<link rel="alternate" hreflang="x-default" href="https://margel360.bg/">
```

- [ ] **Step 3: Replace the existing JSON-LD script block with the enhanced version**

Replace the entire `<script type="application/ld+json">` block with:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "EventVenue",
  "name": "Маргел 360°",
  "url": "https://margel360.bg",
  "telephone": "+359888100042",
  "email": "360@margel.info",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "бул. Околовръстен път 155, ет.4",
    "addressLocality": "София",
    "postalCode": "1618",
    "addressCountry": "BG"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 42.6739,
    "longitude": 23.2614
  },
  "openingHours": "Mo-Su 00:00-23:59",
  "priceRange": "€330 – €1500",
  "hasMap": "https://maps.google.com/?q=бул.+Околовръстен+път+155,+1618+София",
  "maximumAttendeeCapacity": 140,
  "currenciesAccepted": "BGN, EUR",
  "paymentAccepted": "Наложен платеж, Банков превод, Карта",
  "description": "Маргел 360° е ексклузивна зала за събития в София — сватби, рождени дни, корпоративни срещи. Побира до 140 гости. Панорамна тераса 260м², 12 колони EV/YAMAHA звукова система, 70+ безплатни паркоместа, бул. Околовръстен път 155, ет.4, София 1618.",
  "image": [
    "https://margel360.bg/assets/images/gallery-evening-1.jpg",
    "https://margel360.bg/assets/images/event-wedding.jpg",
    "https://margel360.bg/assets/images/event-birthday.jpg",
    "https://margel360.bg/assets/images/header-gallery.jpg",
    "https://margel360.bg/assets/images/about-venue.jpg"
  ],
  "amenityFeature": [
    {"@type": "LocationFeatureSpecification", "name": "Панорамна тераса 260м²", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "12 колони EV/YAMAHA звукова система", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Безплатен паркинг 70+ места", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Професионално осветление", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Бар с ледогенератори", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Асансьор", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Климатизация", "value": true},
    {"@type": "LocationFeatureSpecification", "name": "Танцова площадка", "value": true}
  ],
  "sameAs": [
    "https://www.facebook.com/margel360/",
    "https://www.instagram.com/margel360/"
  ]
}
</script>
```

- [ ] **Step 4: Fix image alt tags in index.html**

Find and replace each generic alt:
```html
<!-- about-venue.jpg -->
alt="Маргел 360° — интериор на залата"
→ alt="Интериор на зала Маргел 360°, бул. Околовръстен път 155, София"

<!-- gallery-1.jpg -->
alt="Маргел 360° — бар"
→ alt="Бар оборудване в зала Маргел 360°, София"

<!-- gallery-2.jpg -->
alt="Маргел 360° — събитие"
→ alt="Вечерно събитие в зала Маргел 360°, София"

<!-- gallery-3.jpg -->
alt="Маргел 360° — събитие"
→ alt="Сватба в зала Маргел 360°, София"

<!-- gallery-4.jpg -->
alt="Маргел 360° — събитие"
→ alt="Рожден ден в зала Маргел 360°, София"

<!-- gallery-5.jpg -->
alt="Маргел 360° — събитие"
→ alt="Панорамна тераса 260м² — зала Маргел 360°, София"

<!-- gallery-6.jpg -->
alt="Маргел 360° — събитие"
→ alt="Корпоративно събитие в зала Маргел 360°, София"
```

- [ ] **Step 5: Commit**
```bash
git add website/index.html
git commit -m "seo: enhance homepage JSON-LD, hreflang, title, image alts"
```

---

## Task 3: FAQ Page — FAQPage Schema + BreadcrumbList + Static HTML + Title

**Files:**
- Modify: `website/faq.html`
- Modify: `website/js/faq.js`

- [ ] **Step 1: Update title tag in faq.html**

Replace:
```html
<title>Често задавани въпроси — Маргел 360° | FAQ</title>
```
With:
```html
<title>Зала под наем София — Въпроси и отговори | Маргел 360°</title>
```

- [ ] **Step 2: Update meta description**

Replace:
```html
<meta name="description" content="Отговори на най-честите въпроси за наем на зала Маргел 360° в София — капацитет, цени, паркинг, включени услуги и условия за резервация.">
```
With:
```html
<meta name="description" content="Маргел 360° побира 140 гости, разполага с 70+ паркоместа и пълна AV техника. Наем от €330. Отговори на всички въпроси за залата на бул. Околовръстен път 155, София.">
```

- [ ] **Step 3: Add hreflang + complete OG/Twitter after canonical in faq.html**

After `<link rel="canonical" href="https://margel360.bg/faq.html">` add:
```html
<link rel="alternate" hreflang="bg" href="https://margel360.bg/faq.html">
<link rel="alternate" hreflang="x-default" href="https://margel360.bg/faq.html">
<meta property="og:type" content="website">
<meta property="og:locale" content="bg_BG">
<meta property="og:site_name" content="Маргел 360°">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Въпроси за наем на зала в София — Маргел 360°">
<meta name="twitter:description" content="Капацитет, цени, паркинг и включени услуги — всичко за зала Маргел 360°, бул. Околовръстен път 155, София.">
<meta name="twitter:image" content="https://margel360.bg/assets/images/header-gallery.jpg">
```

- [ ] **Step 4: Add FAQPage + BreadcrumbList JSON-LD to faq.html**

After the `<link rel="stylesheet">` tag and before `</head>` add:
```html
<script type="application/ld+json">
[
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Колко човека събира залата?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Маргел 360° побира до 100 гости на маса и до 140 гости на коктейл. Залата се намира на бул. Околовръстен път 155, ет.4, София 1618."
        }
      },
      {
        "@type": "Question",
        "name": "Може ли да си доведем кетъринг?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Да, в зала Маргел 360° можете да ползвате собствен кетъринг. Разполагаме с напълно оборудвана кухня на адрес бул. Околовръстен път 155, ет.4, София."
        }
      },
      {
        "@type": "Question",
        "name": "Може ли да си доведем музика?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Да, можете да доведете свой DJ или жива музика. Маргел 360° разполага с пълна звукова система — 12 колони EV/YAMAHA 360°."
        }
      },
      {
        "@type": "Question",
        "name": "Може ли да видим залата преди резервация?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Разбира се! Свържете се с нас на 0888 100 042 или 360@margel.info, за да уговорим посещение на зала Маргел 360°, бул. Околовръстен път 155, ет.4, София."
        }
      },
      {
        "@type": "Question",
        "name": "До колко часа може да продължи събитието?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Вечерните тържества в Маргел 360° могат да продължат до 24:00 часа. Дневните събития приключват до 17:30 ч."
        }
      },
      {
        "@type": "Question",
        "name": "Има ли паркинг?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Да, Маргел 360° разполага с 70+ безплатни паркоместа на бул. Околовръстен път 155, София 1618."
        }
      },
      {
        "@type": "Question",
        "name": "Шумът от музиката пречи ли на съседите?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Не. Зала Маргел 360° е напълно звукоизолирана, така че шумът не излиза извън нея."
        }
      },
      {
        "@type": "Question",
        "name": "Какво е включено в наема на залата?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "В наема на зала Маргел 360° са включени: 12 колони EV/YAMAHA звукова система, професионално осветление, бар с ледогенератори, 3 хладилни витрини, маси и столове, климатизация, асансьор, танцова площадка и 70+ безплатни паркоместа."
        }
      },
      {
        "@type": "Question",
        "name": "С какво оборудване разполага залата?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Маргел 360° разполага с: 12 колони EV/YAMAHA, проектор и екран, модерно LED осветление, бар, оборудвана кухня, панорамна тераса 260м² и 70+ паркоместа. Цени за наем от €330 (4 часа корпоративно) до €1500 (сватба)."
        }
      },
      {
        "@type": "Question",
        "name": "Какви допълнителни услуги се предлагат?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Маргел 360° предлага над 20 допълнителни услуги: DJ за 5 часа (587 лв.), фотограф 2ч. (340 лв.) или 4ч. (580 лв.), фото будка 360° (390–560 лв.), декоративна арка (760 лв.), LED екран (290 лв.), охрана VTA (196 лв.) и още."
        }
      },
      {
        "@type": "Question",
        "name": "Може ли да видим снимки от минали събития?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Да! Разгледайте галерията на margel360.bg/gallery.html или нашата Facebook страница facebook.com/margel360/ за снимки от сватби, рождени дни и корпоративни събития в залата."
        }
      },
      {
        "@type": "Question",
        "name": "Какви са цените за наем на залата?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Цените в Маргел 360° са: корпоративно 4ч. — 645 лв. (€330), корпоративно 8ч. — 861 лв. (€440), детски рожден ден дневен — 1369 лв. (€700), детски рожден ден вечерен — 1897 лв. (€970), вечерно събитие — 2503 лв. (€1280), сватба — 2934 лв. (€1500)."
        }
      }
    ]
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Начало", "item": "https://margel360.bg/" },
      { "@type": "ListItem", "position": 2, "name": "Въпроси и отговори", "item": "https://margel360.bg/faq.html" }
    ]
  }
]
</script>
```

- [ ] **Step 5: Replace `<div id="faq-list"></div>` with static HTML in faq.html**

Replace:
```html
<div class="faq-list" id="faq-list" role="list"></div>
```
With:
```html
<div class="faq-list" id="faq-list" role="list">
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">Колко човека събира залата?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Маргел 360° побира до 100 гости на маса и до 140 гости на коктейл. Залата се намира на бул. Околовръстен път 155, ет.4, София 1618.</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">Може ли да си доведем кетъринг?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Да, в зала Маргел 360° можете да ползвате собствен кетъринг. Разполагаме с напълно оборудвана кухня на адрес бул. Околовръстен път 155, ет.4, София.</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">Може ли да си доведем музика?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Да, можете да доведете свой DJ или жива музика. Маргел 360° разполага с пълна звукова система — 12 колони EV/YAMAHA 360°.</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">Може ли да видим залата преди резервация?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Разбира се! Свържете се с нас на 0888 100 042 или 360@margel.info, за да уговорим посещение на зала Маргел 360°, бул. Околовръстен път 155, ет.4, София.</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">До колко часа може да продължи събитието?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Вечерните тържества в Маргел 360° могат да продължат до 24:00 часа. Дневните събития приключват до 17:30 ч.</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">Има ли паркинг?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Да, Маргел 360° разполага с 70+ безплатни паркоместа на бул. Околовръстен път 155, София 1618.</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">Шумът от музиката пречи ли на съседите?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Не. Зала Маргел 360° е напълно звукоизолирана, така че шумът не излиза извън нея.</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">Какво е включено в наема на залата?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">В наема на зала Маргел 360° са включени: 12 колони EV/YAMAHA звукова система, професионално осветление, бар с ледогенератори, 3 хладилни витрини, маси и столове, климатизация, асансьор, танцова площадка и 70+ безплатни паркоместа.</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">С какво оборудване разполага залата?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Маргел 360° разполага с: 12 колони EV/YAMAHA, проектор и екран, модерно LED осветление, бар, оборудвана кухня, панорамна тераса 260м² и 70+ паркоместа. Цени за наем от €330 (4 часа корпоративно) до €1500 (сватба).</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">Какви допълнителни услуги се предлагат?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Маргел 360° предлага над 20 допълнителни услуги: DJ за 5 часа (587 лв.), фотограф 2ч. (340 лв.) или 4ч. (580 лв.), фото будка 360° (390–560 лв.), декоративна арка (760 лв.), LED екран (290 лв.), охрана VTA (196 лв.) и още.</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">Може ли да видим снимки от минали събития?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Да! Разгледайте галерията на margel360.bg/gallery.html или нашата Facebook страница facebook.com/margel360/ за снимки от сватби, рождени дни и корпоративни събития в залата.</p>
    </div>
  </div>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <button class="faq-question" aria-expanded="false">
      <span itemprop="name">Какви са цените за наем на залата?</span>
      <span class="faq-icon" aria-hidden="true">+</span>
    </button>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Цените в Маргел 360°: корпоративно 4ч. — 645 лв. (€330), корпоративно 8ч. — 861 лв. (€440), детски рожден ден дневен — 1369 лв. (€700), вечерен — 1897 лв. (€970), вечерно събитие — 2503 лв. (€1280), сватба — 2934 лв. (€1500).</p>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Update faq.js with GEO-optimised answers and correct capacity**

Replace the full content of `website/js/faq.js`:
```javascript
const faqs = [
  {
    q_bg: 'Колко човека събира залата?',
    q_en: 'How many people does the venue hold?',
    a_bg: 'Маргел 360° побира до 100 гости на маса и до 140 гости на коктейл. Залата се намира на бул. Околовръстен път 155, ет.4, София 1618.',
    a_en: 'Margel 360° holds up to 100 seated guests and up to 140 for cocktail events. Located at 155 Okolovrsten Pat Blvd, 4th floor, Sofia 1618.'
  },
  {
    q_bg: 'Може ли да си доведем кетъринг?',
    q_en: 'Can we bring our own catering?',
    a_bg: 'Да, в зала Маргел 360° можете да ползвате собствен кетъринг. Разполагаме с напълно оборудвана кухня на адрес бул. Околовръстен път 155, ет.4, София.',
    a_en: 'Yes, you can bring your own catering to Margel 360°. We have a fully equipped kitchen at 155 Okolovrsten Pat Blvd, 4th floor, Sofia.'
  },
  {
    q_bg: 'Може ли да си доведем музика?',
    q_en: 'Can we bring our own DJ or band?',
    a_bg: 'Да, можете да доведете свой DJ или жива музика. Маргел 360° разполага с пълна звукова система — 12 колони EV/YAMAHA 360°.',
    a_en: 'Yes, you can bring your own DJ or live band. Margel 360° has a full sound system — 12 EV/YAMAHA 360° speakers.'
  },
  {
    q_bg: 'Може ли да видим залата преди резервация?',
    q_en: 'Can we visit the venue before booking?',
    a_bg: 'Разбира се! Свържете се с нас на 0888 100 042 или 360@margel.info, за да уговорим посещение на зала Маргел 360°, бул. Околовръстен път 155, ет.4, София.',
    a_en: 'Of course! Contact us at 0888 100 042 or 360@margel.info to arrange a visit to Margel 360°, 155 Okolovrsten Pat Blvd, 4th floor, Sofia.'
  },
  {
    q_bg: 'До колко часа може да продължи събитието?',
    q_en: 'Until what time can events run?',
    a_bg: 'Вечерните тържества в Маргел 360° могат да продължат до 24:00 часа. Дневните събития приключват до 17:30 ч.',
    a_en: 'Evening events at Margel 360° can run until midnight. Daytime events end at 17:30.'
  },
  {
    q_bg: 'Има ли паркинг?',
    q_en: 'Is there parking?',
    a_bg: 'Да, Маргел 360° разполага с 70+ безплатни паркоместа на бул. Околовръстен път 155, София 1618.',
    a_en: 'Yes, Margel 360° has 70+ free parking spaces at 155 Okolovrsten Pat Blvd, Sofia 1618.'
  },
  {
    q_bg: 'Шумът от музиката пречи ли на съседите?',
    q_en: 'Does the music volume disturb neighbours?',
    a_bg: 'Не. Зала Маргел 360° е напълно звукоизолирана, така че шумът не излиза извън нея.',
    a_en: 'No. Margel 360° is fully soundproofed so noise does not escape outside.'
  },
  {
    q_bg: 'Какво е включено в наема на залата?',
    q_en: 'What is included in the venue rental?',
    a_bg: 'В наема на зала Маргел 360° са включени: 12 колони EV/YAMAHA звукова система, професионално осветление, бар с ледогенератори, 3 хладилни витрини, маси и столове, климатизация, асансьор, танцова площадка и 70+ безплатни паркоместа.',
    a_en: 'Margel 360° rental includes: 12 EV/YAMAHA speakers, professional lighting, bar with ice makers, 3 fridges, tables and chairs, air conditioning, elevator, dance floor, and 70+ free parking spaces.'
  },
  {
    q_bg: 'С какво оборудване разполага залата?',
    q_en: 'What equipment does the venue have?',
    a_bg: 'Маргел 360° разполага с: 12 колони EV/YAMAHA, проектор и екран, модерно LED осветление, бар, оборудвана кухня, панорамна тераса 260м² и 70+ паркоместа. Цени за наем от €330 (4ч. корпоративно) до €1500 (сватба).',
    a_en: 'Margel 360° has: 12 EV/YAMAHA speakers, projector and screen, modern LED lighting, bar, equipped kitchen, 260m² panoramic terrace, and 70+ parking spaces. Rental from €330 (4h corporate) to €1500 (wedding).'
  },
  {
    q_bg: 'Какви допълнителни услуги се предлагат?',
    q_en: 'What additional services are available?',
    a_bg: 'Маргел 360° предлага над 20 допълнителни услуги: DJ за 5 часа (587 лв.), фотограф 2ч. (340 лв.) или 4ч. (580 лв.), фото будка 360° (390–560 лв.), декоративна арка (760 лв.), LED екран (290 лв.), охрана VTA (196 лв.) и още.',
    a_en: 'Margel 360° offers 20+ additional services: DJ 5h (587 BGN), photographer 2h (340 BGN) or 4h (580 BGN), 360° photo booth (390–560 BGN), decorative arch (760 BGN), LED screen (290 BGN), VTA security (196 BGN) and more.'
  },
  {
    q_bg: 'Може ли да видим снимки от минали събития?',
    q_en: 'Can we see photos from past events?',
    a_bg: 'Да! Разгледайте галерията на margel360.bg/gallery.html или нашата Facebook страница facebook.com/margel360/ за снимки от сватби, рождени дни и корпоративни събития в залата.',
    a_en: 'Yes! Check our gallery at margel360.bg/gallery.html or facebook.com/margel360/ for photos of weddings, birthdays, and corporate events at the venue.'
  },
  {
    q_bg: 'Какви са цените за наем на залата?',
    q_en: 'What are the rental prices?',
    a_bg: 'Цените в Маргел 360°: корпоративно 4ч. — 645 лв. (€330), корпоративно 8ч. — 861 лв. (€440), детски рожден ден дневен — 1369 лв. (€700), вечерен — 1897 лв. (€970), вечерно събитие — 2503 лв. (€1280), сватба — 2934 лв. (€1500).',
    a_en: 'Margel 360° prices: corporate 4h — €330, corporate 8h — €440, children\'s birthday daytime — €700, evening — €970, evening event — €1280, wedding — €1500.'
  },
];

const lang = localStorage.getItem('margel_lang') || 'bg';
const list = document.getElementById('faq-list');

function renderFaq(currentLang) {
  if (!list) return;
  // Update text content of existing static elements
  const items = list.querySelectorAll('.faq-item');
  items.forEach((item, i) => {
    if (!faqs[i]) return;
    const qSpan = item.querySelector('.faq-question span:first-child');
    const aP    = item.querySelector('.faq-answer p');
    if (qSpan) qSpan.textContent = currentLang === 'bg' ? faqs[i].q_bg : faqs[i].q_en;
    if (aP)    aP.textContent    = currentLang === 'bg' ? faqs[i].a_bg : faqs[i].a_en;
  });

  // Wire accordion clicks (idempotent — removes old listener by replacing node isn't needed
  // because we use event delegation on the list)
}

// Accordion via event delegation
list?.addEventListener('click', e => {
  const btn = e.target.closest('.faq-question');
  if (!btn) return;
  const item   = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  list.querySelectorAll('.faq-item.open').forEach(el => {
    el.classList.remove('open');
    el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
  });
  if (!isOpen) {
    item.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
});

renderFaq(lang);
document.addEventListener('langChange', e => renderFaq(e.detail.lang));
```

- [ ] **Step 7: Commit**
```bash
git add website/faq.html website/js/faq.js
git commit -m "seo: FAQPage schema, static FAQ HTML, GEO-optimised answers, breadcrumb"
```

---

## Task 4: Services Page — ItemList Schema + BreadcrumbList + Title + OG/Twitter

**Files:**
- Modify: `website/services.html`

- [ ] **Step 1: Update title tag**

Replace:
```html
<title>Услуги и Цени — Маргел 360° | DJ, Декор, Фотограф</title>
```
With:
```html
<title>Услуги и Цени за Наем на Зала в София — Маргел 360°</title>
```

- [ ] **Step 2: Update meta description**

Replace:
```html
<meta name="description" content="Пълен списък с услуги и цени на Маргел 360° — DJ, фотограф, фото будка 360°, декорации, светещи цифри, охрана и още. Наемете залата за вашето събитие в София.">
```
With:
```html
<meta name="description" content="DJ (587 лв.), фотограф (340–580 лв.), фото будка 360° (390–560 лв.), декор, LED екран и 20+ услуги за вашето събитие в зала Маргел 360°, бул. Околовръстен път 155, София.">
```

- [ ] **Step 3: Add hreflang + complete OG/Twitter after canonical**

After `<link rel="canonical" href="https://margel360.bg/services.html">` add:
```html
<link rel="alternate" hreflang="bg" href="https://margel360.bg/services.html">
<link rel="alternate" hreflang="x-default" href="https://margel360.bg/services.html">
<meta property="og:type" content="website">
<meta property="og:locale" content="bg_BG">
<meta property="og:site_name" content="Маргел 360°">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Услуги и Цени — Зала Маргел 360°, София">
<meta name="twitter:description" content="DJ, фотограф, фото будка 360°, декор и 20+ услуги. Зала Маргел 360°, бул. Околовръстен път 155, София.">
<meta name="twitter:image" content="https://margel360.bg/assets/images/header-services.jpg">
```

- [ ] **Step 4: Add ItemList + BreadcrumbList JSON-LD before `</head>`**

```html
<script type="application/ld+json">
[
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Допълнителни услуги — Маргел 360°, София",
    "description": "Допълнителни услуги за вашето събитие в зала Маргел 360°, бул. Околовръстен път 155, ет.4, София 1618",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "item": { "@type": "Offer", "name": "DJ за 5 часа", "price": "587", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 2, "item": { "@type": "Offer", "name": "Фотограф за 2 часа", "price": "340", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 3, "item": { "@type": "Offer", "name": "Фотограф за 4 часа", "price": "580", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 4, "item": { "@type": "Offer", "name": "Фото будка 360° за 2 часа", "price": "390", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 5, "item": { "@type": "Offer", "name": "Фото будка 360° за 4 часа", "price": "560", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 6, "item": { "@type": "Offer", "name": "Декоративна арка с осветление", "price": "760", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 7, "item": { "@type": "Offer", "name": "Декоративна стена SILVER", "price": "355", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 8, "item": { "@type": "Offer", "name": "Декоративна стена GOLD", "price": "355", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 9, "item": { "@type": "Offer", "name": "Заря 150–170 сек.", "price": "440", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 10, "item": { "@type": "Offer", "name": "Заря 300–340 сек.", "price": "790", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 11, "item": { "@type": "Offer", "name": "Светлинен фонтан 1300мм", "price": "96", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 12, "item": { "@type": "Offer", "name": "Светлинен фонтан 2600мм", "price": "160", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 13, "item": { "@type": "Offer", "name": "LED екран", "price": "290", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 14, "item": { "@type": "Offer", "name": "Микрофони — 3бр. + брошка", "price": "97", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 15, "item": { "@type": "Offer", "name": "Мултимедия EPSON", "price": "180", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 16, "item": { "@type": "Offer", "name": "Охрана VTA за 6 часа", "price": "196", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 17, "item": { "@type": "Offer", "name": "Хигиенист за 5 часа", "price": "156", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 18, "item": { "@type": "Offer", "name": "Гардеробиер за 5 часа", "price": "176", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 19, "item": { "@type": "Offer", "name": "Вале-паркинг за 5 часа", "price": "275", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 20, "item": { "@type": "Offer", "name": "Червена пътека (8 бр.)", "price": "148", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 21, "item": { "@type": "Offer", "name": "Свещи в залата — 60 бр.", "price": "100", "priceCurrency": "BGN" } },
      { "@type": "ListItem", "position": 22, "item": { "@type": "Offer", "name": "Светещи цифри", "price": "68", "priceCurrency": "BGN" } }
    ]
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Начало", "item": "https://margel360.bg/" },
      { "@type": "ListItem", "position": 2, "name": "Услуги и Цени", "item": "https://margel360.bg/services.html" }
    ]
  }
]
</script>
```

- [ ] **Step 5: Commit**
```bash
git add website/services.html
git commit -m "seo: ItemList schema with prices, breadcrumb, title, OG/Twitter on services page"
```

---

## Task 5: Contact Page — LocalBusiness Schema + BreadcrumbList + Title + OG/Twitter

**Files:**
- Modify: `website/contact.html`

- [ ] **Step 1: Update title tag**

Replace:
```html
<title>Контакти — Маргел 360° | бул. Околовръстен път 155, София</title>
```
With:
```html
<title>Контакти — Зала Маргел 360°, София | 0888 100 042</title>
```

- [ ] **Step 2: Add hreflang + complete OG/Twitter after canonical**

After `<link rel="canonical" href="https://margel360.bg/contact.html">` add:
```html
<link rel="alternate" hreflang="bg" href="https://margel360.bg/contact.html">
<link rel="alternate" hreflang="x-default" href="https://margel360.bg/contact.html">
<meta property="og:type" content="website">
<meta property="og:locale" content="bg_BG">
<meta property="og:site_name" content="Маргел 360°">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Контакти — Зала Маргел 360°, София">
<meta name="twitter:description" content="0888 100 042 | 360@margel.info | бул. Околовръстен път 155, ет.4, София 1618. Зала за сватби, рождени дни и корпоративни събития.">
<meta name="twitter:image" content="https://margel360.bg/assets/images/header-gallery.jpg">
```

- [ ] **Step 3: Add LocalBusiness + BreadcrumbList JSON-LD before `</head>`**

```html
<script type="application/ld+json">
[
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Маргел 360°",
    "description": "Ексклузивна зала за събития в София — сватби, рождени дни, корпоративни срещи. До 140 гости. Панорамна тераса 260м², 70+ паркоместа.",
    "url": "https://margel360.bg",
    "telephone": "+359888100042",
    "email": "360@margel.info",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "бул. Околовръстен път 155, ет.4",
      "addressLocality": "София",
      "postalCode": "1618",
      "addressCountry": "BG"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 42.6739,
      "longitude": 23.2614
    },
    "openingHours": "Mo-Su 00:00-23:59",
    "priceRange": "€330 – €1500",
    "sameAs": [
      "https://www.facebook.com/margel360/",
      "https://www.instagram.com/margel360/"
    ]
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Начало", "item": "https://margel360.bg/" },
      { "@type": "ListItem", "position": 2, "name": "Контакти", "item": "https://margel360.bg/contact.html" }
    ]
  }
]
</script>
```

- [ ] **Step 4: Commit**
```bash
git add website/contact.html
git commit -m "seo: LocalBusiness schema, breadcrumb, title, OG/Twitter on contact page"
```

---

## Task 6: Gallery Page — BreadcrumbList + Title + OG/Twitter + Image Alts

**Files:**
- Modify: `website/gallery.html`

- [ ] **Step 1: Update title tag**

Replace:
```html
<title>Галерия — Маргел 360° | Снимки от сватби, рождени дни и събития</title>
```
With:
```html
<title>Снимки от Събития в София — Галерия Маргел 360°</title>
```

- [ ] **Step 2: Add hreflang + complete OG/Twitter after canonical**

After `<link rel="canonical" href="https://margel360.bg/gallery.html">` add:
```html
<link rel="alternate" hreflang="bg" href="https://margel360.bg/gallery.html">
<link rel="alternate" hreflang="x-default" href="https://margel360.bg/gallery.html">
<meta property="og:type" content="website">
<meta property="og:locale" content="bg_BG">
<meta property="og:site_name" content="Маргел 360°">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Галерия — Снимки от Сватби и Събития в Маргел 360°, София">
<meta name="twitter:description" content="Разгледайте снимки от сватби, рождени дни, вечерни и корпоративни събития в зала Маргел 360°, бул. Околовръстен път 155, София.">
<meta name="twitter:image" content="https://margel360.bg/assets/images/header-gallery.jpg">
```

- [ ] **Step 3: Add BreadcrumbList JSON-LD before `</head>`**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Начало", "item": "https://margel360.bg/" },
    { "@type": "ListItem", "position": 2, "name": "Галерия", "item": "https://margel360.bg/gallery.html" }
  ]
}
</script>
```

- [ ] **Step 4: Update the lightbox img alt (it's currently empty)**

Find:
```html
<img id="lb-img" src="" alt="">
```
Replace with:
```html
<img id="lb-img" src="" alt="Снимка от събитие в зала Маргел 360°, София">
```

- [ ] **Step 5: Commit**
```bash
git add website/gallery.html
git commit -m "seo: breadcrumb, title, OG/Twitter, image alt on gallery page"
```

---

## Task 7: Reservation Page — BreadcrumbList + Title + OG/Twitter

**Files:**
- Modify: `website/reservation.html`

- [ ] **Step 1: Update title tag**

Replace:
```html
<title>Онлайн Запитване — Маргел 360° | Резервирайте вашата дата</title>
```
With:
```html
<title>Резервирайте Зала в София — Онлайн Запитване | Маргел 360°</title>
```

- [ ] **Step 2: Update meta description**

Replace:
```html
<meta name="description" content="Изпратете запитване за наем на зала Маргел 360° в София. Изберете тип събитие, дата и допълнителни услуги. Отговаряме до 24 часа.">
```
With:
```html
<meta name="description" content="Резервирайте зала Маргел 360° онлайн — изберете събитие, дата и услуги. Наем от €330. Отговаряме до 24 часа. бул. Околовръстен път 155, ет.4, София 1618.">
```

- [ ] **Step 3: Add hreflang + complete OG/Twitter after canonical**

After `<link rel="canonical" href="https://margel360.bg/reservation.html">` add:
```html
<link rel="alternate" hreflang="bg" href="https://margel360.bg/reservation.html">
<link rel="alternate" hreflang="x-default" href="https://margel360.bg/reservation.html">
<meta property="og:type" content="website">
<meta property="og:locale" content="bg_BG">
<meta property="og:site_name" content="Маргел 360°">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Резервирайте Зала в София — Маргел 360°">
<meta name="twitter:description" content="Онлайн запитване за наем на зала Маргел 360°. Наем от €330. Отговаряме до 24 часа. бул. Околовръстен път 155, София.">
<meta name="twitter:image" content="https://margel360.bg/assets/images/header-gallery.jpg">
```

- [ ] **Step 4: Add BreadcrumbList JSON-LD before `</head>`**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Начало", "item": "https://margel360.bg/" },
    { "@type": "ListItem", "position": 2, "name": "Онлайн Запитване", "item": "https://margel360.bg/reservation.html" }
  ]
}
</script>
```

- [ ] **Step 5: Commit**
```bash
git add website/reservation.html
git commit -m "seo: breadcrumb, title, OG/Twitter on reservation page"
```

---

## Task 8: Final Deploy

- [ ] **Step 1: Push all commits to GitHub**
```bash
git push origin main
```
Expected: Netlify auto-deploys within 1–2 minutes.

- [ ] **Step 2: Validate schemas with Google Rich Results Test**

Open: https://search.google.com/test/rich-results

Test these URLs one by one:
- `https://margel360.bg/` → should show EventVenue
- `https://margel360.bg/faq.html` → should show FAQ rich result (accordion)
- `https://margel360.bg/services.html` → should show ItemList
- `https://margel360.bg/contact.html` → should show LocalBusiness

- [ ] **Step 3: Validate all pages with Schema.org validator**

Open: https://validator.schema.org/

Test: `https://margel360.bg/faq.html` — check for FAQPage + BreadcrumbList with no errors.

- [ ] **Step 4: Submit updated sitemap to Google Search Console**

Go to Google Search Console → Sitemaps → Submit `https://margel360.bg/sitemap.xml`

- [ ] **Step 5: Final commit if any fixes needed**
```bash
git add -A
git commit -m "seo: fix validation issues"
git push origin main
```
