# Catalog admin — DB-driven drinks & addon services

**Date:** 2026-07-22
**Status:** Approved (design), pending implementation plan

## Problem

Drink and addon-service prices live in static JS (`website/js/drinks-data.js`,
`addonServices` in `website/js/reservation-catalog.js`). Every price change goes
through a developer: edit file, bump `?v=` versions, push, regenerate baked SEO
blocks. The manager needs to manage the catalog (add, edit, hide, delete items
and change prices) from the admin panel, like the partners page.

## Decisions made

- **Scope:** full CRUD (add / edit / hide / delete + prices) for drinks and
  addon services. Venue/event base prices stay code-owned — out of scope.
- **Architecture:** DB is the single source of truth (approach A). Static
  catalog arrays are deleted; no static fallback mirrors (a stale-price booking
  is worse than a retry error). No GitHub write-back.
- **Baked SEO content:** `menu.html #menu-sections` and `services.html
  #services-grid` keep names **and prices**; accepted drift after manager
  edits. They double as the fetch-failure fallback. The daily cloud audit
  routine can flag drift for occasional regeneration.

## Data model (migration, PR 1)

### Table `public.drinks`

| column | type | notes |
|---|---|---|
| `id` | `text` PK | existing ids preserved (`moet`, `cola`, …); new rows get a generated id (`gen_random_uuid()::text` default) |
| `cat` | `smallint` NOT NULL, CHECK 0–4 | the 5 categories are fixed; BG/EN labels stay in `catalog-db.js` as translation strings |
| `name_bg` / `name_en` | `text` NOT NULL | |
| `price_eur` | `numeric(8,2)` NOT NULL, CHECK ≥ 0 | |
| `img` | `text` | either a repo asset path (`assets/images/drinks/…`) or a `catalog-images` storage object path |
| `active` | `boolean` NOT NULL default true | |
| `sort_order` | `int` NOT NULL default 100 | seeded in steps of 10 preserving today's curated in-category order |
| `updated_at` | `timestamptz` | |

### Table `public.addon_services`

| column | type | notes |
|---|---|---|
| `id` | `text` PK | existing ids preserved (they key the XLSX `ADDON_TO_CELL` map and the special-cased `cleaning`) |
| `name_bg` / `name_en` | `text` NOT NULL | |
| `price_eur` | `numeric(8,2)` NOT NULL, CHECK ≥ 0 | client-side field name stays `price` (loader maps) |
| `hint_bg` / `hint_en` | `text` NULL | "each additional hour — €N" notes |
| `free_until` | `int` NULL | furniture free baseline (bar_stool 40, chiavari 10, …) |
| `max_qty` | `int` NULL | absorbs hardcoded `ADDON_MAX_QTY` (heater 2, heater_tbl 1, glow_table 10) |
| `img` | `text` | as in `drinks` |
| `active` | `boolean` NOT NULL default true | |
| `sort_order` | `int` NOT NULL default 100 | steps of 10, file order preserved — keeps variant pairs consecutive for the wizard's 2-col grid |
| `updated_at` | `timestamptz` | |

Stepper rule (unchanged semantics): a service with `free_until` **or**
`max_qty` set renders as a qty stepper (max = `max_qty ?? 999`); otherwise an
on/off toggle.

### Guards & RLS

- **Cleaning guard:** trigger blocks `DELETE` of `id='cleaning'` and blocks
  setting it `active=false`. Its price stays editable and flows through
  `autoCleaningAddon()`.
- **RLS** (mirrors `partners`): SELECT for `anon`/`authenticated` where
  `active OR public.is_admin()`; ALL for `is_admin()`.
- **Storage:** new public bucket `catalog-images` (5 MB,
  jpeg/png/webp, admin write) — same policy shape as `partner-images`.
  Existing ~90 images stay as repo assets.
- Seed migration inserts every current row from both static files verbatim.

## Public site loading (PR 3)

New `website/js/catalog-db.js`:

- Plain `fetch` to the PostgREST endpoint with the anon key (no supabase-js on
  pages that don't already load it); both tables fetched in parallel.
- Exposes the same globals with today's field names: `drinks` (`price_eur`,
  `cat`, `img` resolved to URL), `drinkCategories` (static labels),
  `addonServices` (`price`, `freeUntil`, `maxQty`, hints). Renderers change
  only their entry point: `loadCatalog().then(render)`.
- `drinks-data.js` is **deleted**. `reservation-catalog.js` keeps `eventTypes`,
  `venueIncluded`, `includedLabels`; loses `addonServices`.
- Consumers: `reservation.html`, `edit.html`, `drinks.html`, `menu.html`,
  `services.html` (+ their JS). Every referencing HTML bumps `?v=`.
- `ADDON_MAX_QTY` / `isQtyAddon` in `reservation.js` and `edit.js` read
  `max_qty`/`free_until` from the catalog instead of hardcoded maps.

**Fetch failure:** `menu`/`services`/`drinks` pages keep their baked HTML
(silent fallback, log only). The wizard and the customer edit page render an
inline error + retry button and never render the affected steps without the
catalog (the edit page must not initialise the form without it — data-wipe
risk).

**Edit page & removed items:** items present in an enquiry payload but missing
or inactive in the catalog render from the payload snapshot (`name`, `price`
are stored per line) — still visible and removable, not re-addable.

## Admin page (PR 2)

`website/admin/catalog.html` + `admin/js/catalog.js`, modeled on partners:
`requireAuth()` AAL2, `admin-i18n.js` keys (BG/EN), toast plumbing, "Каталог"
nav link added to every admin page.

- Two tabs: **Напитки** / **Услуги**.
- List: thumbnail, BG/EN names, category (drinks) or qty/free-until badges
  (services), price EUR + read-only BGN equivalent (× 1.95583, half-away-from-
  zero, 2 dp), sort, active, actions Edit / Hide / Delete.
- Drink form: name_bg, name_en, category (5 fixed), price EUR, image upload,
  sort, active.
- Service form: name_bg, name_en, price EUR, hint_bg, hint_en, "quantity item"
  checkbox → reveals max_qty + free_until, image upload, sort, active.
- `cleaning` row: "задължителна услуга" badge, no Hide/Delete.
- Delete confirm recommends Hide instead (live 14-day customer edit links may
  reference the item).
- Image upload path/cleanup logic copied from partners (`<row-id>/<millis>.<ext>`,
  orphan cleanup on failed row write, old-object removal on replace).

## Server-side validation (PR 3)

New `supabase/functions/_shared/catalog.ts` (service-role reads, both tables).
Used by `submit-enquiry`, `update-enquiry-by-token`, `update-enquiry-admin`:

- **Recompute prices server-side:** drink `price_eur` from catalog; addon line
  price recomputed from qty + `free_until`/`price_eur`. Client-sent prices are
  overwritten, closing the current client-supplied-price gap (today only
  range-checked).
- Drink caps (non-alcoholic ≤ 200, alcoholic ≤ 100) key off catalog
  `cat ∈ {3,4}`. The four hardcoded `NON_ALCOHOLIC_DRINK_IDS` sets
  (`validate.ts`, `submit-enquiry`, `update-enquiry-admin`, `dashboard.js`)
  are deleted; `dashboard.js` queries the table.
- Addon `max_qty` caps become server-enforced.
- Unknown or inactive item id at **submit** → 400 with a clear error code.
- **Grandfathering on edits:** in `update-enquiry-by-token` /
  `update-enquiry-admin`, an item id that is missing/inactive in the catalog
  but already present in the stored enquiry is kept at its stored price
  (qty may only decrease); only newly added items must exist and be active.
  Otherwise deactivating an item would 400 every edit of bookings that
  contain it.
- `verify_jwt` deploy-flag map unchanged.

## Explicitly unchanged

Emails, dashboard rendering, financials, marketing export, offer PDF, offer
XLSX — all read the enquiry **payload snapshot**. Manager-created services
appear in PDF/emails; the XLSX export already surfaces them via its `unmapped`
warning (manager fills the template cell manually). Payload shape rules hold:
item `name` = `name_en`, addons store LINE price, drinks store unit
`price_eur` + `qty`.

## Rollout — three PRs

1. **Migration** — tables + seed + trigger + bucket. Additive, zero behavior
   change. Applied to the live project only after explicit confirmation.
2. **Admin catalog page** — CRUD against the new tables; public site still on
   static files. (Edits here don't reach customers yet — acceptable for the
   short window between PR 2 and PR 3; noted in the PR description.)
3. **The switch** — `catalog-db.js`, renderer entry points, static catalog
   removal, server-side recompute + cap changes, edge-function deploys,
   `?v=` bumps, CLAUDE.md sync-map update (drink-cap row and `ADDON_MAX_QTY`
   row collapse into "catalog tables").

## Verification (per PR)

- `node --check` on every touched JS file.
- PR 2: admin CRUD walkthrough (create/edit/hide/delete both types, image
  upload, cleaning guard, BGN display).
- PR 3: full wizard walkthrough BG + EN (prices match DB, steppers, caps,
  cleaning auto-add, summary vs payload agreement), customer edit walkthrough
  (including an item deactivated mid-flight), drinks/menu/services pages incl.
  fetch-failure fallback, one end-to-end test enquiry, offer XLSX + PDF smoke
  test, edge-function deploys with correct flags.

## Risks

- **Runtime dependency:** public menu pages now need one anon REST call;
  mitigated by baked-HTML fallback. The wizard already depends on Supabase to
  submit.
- **Race:** price changed while a customer is mid-wizard → server recompute
  stores the new price; the summary email reflects the stored (new) price.
  Rare and accepted.
- **SEO drift:** accepted; audit routine may flag it.
