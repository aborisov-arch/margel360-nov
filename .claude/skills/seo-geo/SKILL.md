---
name: seo-geo
description: Run a combined SEO + GEO (generative engine optimization / AI-search visibility) audit on a website. Use when the user asks for an SEO audit, GEO audit, AI-search visibility check, or "/seo-geo <domain>". Produces a prioritized report from live crawling when possible, falling back to search-index reconstruction when direct fetching is blocked.
argument-hint: <domain or URL>
---

# SEO + GEO Audit

Audit the site given in the arguments: `$ARGUMENTS`. If no domain was passed, ask which site to audit before doing anything else. Normalize to a bare domain (strip protocol/paths) and audit the live site.

The deliverable is a single readable report in chat (see "Report format" below). Do not modify any repo files as part of the audit.

## Phase 1 — Direct crawl (attempt first)

Try to fetch, in this order, stopping the phase early if everything 403s:

1. `https://<domain>/` — extract: title, meta description, H1/H2s, `html lang`, hreflang links, canonical, robots meta, Open Graph/Twitter tags, JSON-LD types, nav + footer links, visible copy volume.
2. `robots.txt` — note sitemap directives and, critically for GEO, whether AI crawlers (GPTBot, ClaudeBot, Claude-Web, PerplexityBot, Google-Extended, CCBot, Bytespider) are allowed or blocked.
3. `sitemap.xml` (and any sitemaps referenced from robots.txt) — page count, sections, staleness.
4. `llms.txt` — presence is a GEO plus; absence is a finding.
5. 3–5 key inner pages (top categories / products / blog) — same on-page extraction as the homepage; check title/description uniqueness across them.
6. Both `www.` and bare-domain variants of the homepage — verify one 301s to the other (host consolidation).

Use WebFetch first; `curl` via Bash is an acceptable fallback where policy allows. **If fetching is blocked** (remote/proxied environments often 403 all egress — calibrate by fetching a known-good URL like `https://example.com/`; if that also fails, the block is environmental, not the target's WAF — do not report it as the site blocking crawlers), skip to Phase 2 and say clearly in the report that on-page items are reconstructed from the search index and need a follow-up crawl (Screaming Frog or similar) to verify canonicals, hreflang, structured data, robots rules, and Core Web Vitals.

## Phase 2 — Search-index reconstruction (always do)

Run these WebSearch queries, adapting language to the site's market:

1. `site:<domain>` — what's indexed: URL patterns, title templates, parameterized/faceted URLs, mixed www/non-www hosts, language sections.
2. `site:<domain>/<lang>` per discovered language section — depth and quality of each locale's index; look for untranslated/garbled titles.
3. 2–3 **head commercial queries** for the site's core offering — is the site in the top 10? Who owns the SERP instead?
4. 1–2 **long-tail transactional queries** (specific product/size/model) — do deep pages rank?
5. `<brand> отзиви/reviews/мнения` (in the market's language) — what dominates the brand-reputation SERP: owned pages, review platforms, or forum complaint threads?
6. Brand + company registration/address queries — collect every published name/address/phone and check NAP consistency across directories.
7. Brand + content queries (blog, guides, съвети/tips) — does the site have an answer-shaped content layer, and do competitors?

## Phase 3 — GEO assessment

GEO = what an AI assistant would say when asked to recommend or describe this business. Assess:

- **Reputation synthesis:** summarize what the review/forum record actually says (ratings + recurring complaint themes). This is what LLMs will reproduce — prominent unanswered complaint threads are a top-priority finding.
- **Machine readability:** JSON-LD (Organization, Product/Offer, AggregateRating, FAQPage), llms.txt, AI-crawler access in robots.txt. Mark as "unverified — needs crawl" if Phase 1 was blocked.
- **Answerability:** does the site publish citable, answer-shaped content (FAQs, guides, policy pages like guarantees/delivery terms) that AI engines can quote?
- **Entity consistency:** one canonical business name/address/phone everywhere; conflicting directory data lowers AI confidence.

## Report format

Single chat message, in this order:

1. **Method + limitations** (one short paragraph — especially whether the crawl was blocked).
2. **Site profile** (what the business is, languages, ownership if public).
3. **What's working** — genuine strengths only.
4. **Critical issues** — numbered, most severe first, each with the evidence (URL or SERP observation) that supports it.
5. **GEO findings** — the AI-visibility picture, separated from classic SEO.
6. **Prioritized actions** — max ~7, ordered by impact, concrete enough to hand to a developer or marketer.
7. **Sources** — markdown links to every page/SERP result cited.

Distinguish clearly between **verified** findings (seen directly) and **inferred/unverified** ones (from index data). Never claim a site blocks AI crawlers, lacks structured data, or has no sitemap unless directly observed.
