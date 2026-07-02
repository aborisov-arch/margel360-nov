# Partners (Партньори) — Design Spec

**Date:** 2026-07-01
**Client:** Margel 360° (event venue)
**Project type:** New feature — public site + reservation wizard + admin panel + Supabase
**Goal:** A DB-driven "Partners" catalog (catering companies and artists) the team manages from the admin panel. New/edited partners appear on the public website automatically. Customers can browse partners on a dedicated page and mark non-binding interest in specific partners during the reservation wizard; the team sees that interest on the enquiry.

---

## Overview

Partners are external vendors Margel 360° works with, in exactly two categories for v1: **catering** and **artist**. They live in a new `public.partners` table with images in a new Supabase Storage bucket. Three consumers:

1. **Public page** `partners.html` — linked from the top menu on every page; renders active partners grouped by category.
2. **Reservation wizard** — a new numbered step after Drinks where the customer can toggle "interested" on partners. Selections are snapshotted onto the enquiry (`partner_interest` jsonb) by `submit-enquiry` and surfaced in the team/customer emails and the dashboard enquiry detail. **No price impact anywhere.**
3. **Admin page** `admin/partners.html` — full CRUD with image upload, ordering and an active toggle. Deactivating a partner removes it from the site/wizard instantly (RLS `USING (active)`).

Decisions locked with the client:

- Wizard step = **mark interest** (not browse-only, not priced add-ons).
- Partner images = **uploaded in the admin** → net-new Supabase Storage bucket (first Storage use in this project).
- Public surface = **dedicated page** in the top menu (not a homepage section).
- Customer **edit page is out of scope for v1**; edits must never wipe `partner_interest`.

Architecture choices (approved):

- Interest stored as a **jsonb snapshot on `enquiries`** (`[{id, name, category}]`) — matches how addons/drinks already live on the enquiry row.
- Public reads go **directly from the browser with the anon key** gated by an anon-SELECT RLS policy — a clone of the existing `occupied_dates` pattern. No new edge function for reads.
- Wizard gets a **real numbered step (5 of 7)** with its own progress-bar button, not an unnumbered interstitial.

---

## 1 · Database & storage (one migration)

New migration in `supabase/migrations/` (applied via Supabase MCP **and** committed — keep both in sync).

### Table

```sql
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('catering','artist')),
  name text NOT NULL,
  description_bg text,
  description_en text,          -- site falls back to BG when empty
  website_url text,
  phone text,
  image_path text,              -- object path in the partner-images bucket
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

RLS (clone of `financial_events` + `occupied_dates` style):

- `ENABLE ROW LEVEL SECURITY`.
- Admin: `FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())`.
- Public: `FOR SELECT TO anon USING (active)` — only active partners are visible to the site/wizard; no separate "publish" flow needed.

### Enquiries column

```sql
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS partner_interest jsonb NOT NULL DEFAULT '[]'::jsonb;
```

Shape: `[{ "id": "<uuid>", "name": "<partner name>", "category": "catering"|"artist" }]` — names are snapshotted server-side from the DB at submit time (survives later renames/deletes; email content is DB-canonical, not customer-controlled).

### Storage

Bucket `partner-images`:

- `public = true` (read via public CDN URL; no read policy needed).
- Bucket-level caps: `file_size_limit` 5 MB, `allowed_mime_types` `image/jpeg, image/png, image/webp` (server-enforced).
- `storage.objects` policies: INSERT / UPDATE / DELETE `TO authenticated` with `bucket_id = 'partner-images' AND is_admin()`.
- Object path convention: `<partner-uuid>/<timestamp>.<ext>` (replacing an image uploads a new object, updates `image_path`, best-effort deletes the old object).

### Seed

Insert the two real catering partners currently hardcoded in `offer-pdf.js`: **L'Instant** (`https://www.linstant.bg`) and **VIP Catering** (`https://vipcatering.bg`) — category `catering`, active, no image (cards render a placeholder). The hardcoded PDF links themselves stay as-is in v1.

---

## 2 · Public page

New files:

- `website/partners.html` — cloned from the services/gallery page skeleton: same `<nav>`/drawer/footer markup, `translations-partners.js` → `main.js` → `partners.js` script order, own meta title/description.
- `website/js/translations-partners.js` — full `nav_*`/`footer_*` key set + new `partners_*` page keys (bg + en).
- `website/js/partners.js` — creates an anon Supabase client (same URL/key as `reservation-supabase.js`), fetches `partners` (`active` rows come back automatically via RLS) ordered by `category, sort_order, name`, renders two sections: **Кетъринг** and **Артисти**.

Card content: image (or styled placeholder when `image_path` is null), name, description in the current language (`description_en` falling back to `description_bg`), website link (new tab, `rel="noopener"`), phone (tel: link). All DB strings rendered through an `esc()` helper. Re-render on the `langChange` event.

Degradation: a category with no partners hides its section; zero partners or a failed fetch shows a friendly message under the intro — the page never looks broken.

Performance: images `loading="lazy"` with explicit `width`/`height` (no CLS); supabase-js CDN script loaded `defer` on this page only.

### Nav rollout (the copy-paste tax)

- Add the "Партньори / Partners" link (`data-i18n="nav_partners"`) to **all 12 nav-bearing pages × 3 regions** (desktop `.nav-links`, mobile `.nav-drawer`, footer `.footer-links`): index, gallery, faq, services, menu, contact, reservation, birthday, corporate, evening, wedding, drinks. Position: between "Меню" and "Контакти".
- Add `nav_partners` (bg: «Партньори», en: "Partners") to **all 9 existing `translations-*.js` files** + the new one.
- `partners.html` marks its own link `class="active"`.

---

## 3 · Reservation wizard step

`website/reservation.html` + `website/js/reservation.js`:

- `TOTAL_STEPS` 6 → 7. New panel `#step-4` («Партньори») inserted after Drinks (`#step-3`); Contact becomes `#step-5`, Summary `#step-6`. Progress bar gets a 7th `.wstep` button; `wstep-num` renumbered 1–7.
- **Exhaustively renumber** every hardcoded reference: `goToStep(n)` calls (including inline `onclick` in reservation.html) and the `if (n === …)` lazy-render dispatch. Drinks-prompt behavior: «yes» still opens Drinks (`#step-3`); «no» keeps `goToStep(4)` — which now lands on **Partners** instead of Contact. Declining the drinks menu must not skip the Partners step. Verified by grepping `goToStep`, `step-`, `data-step`, `n ===` across both files.
- New `renderPartners()` (dispatched on `if (n === 4)`): fetches partners once via the existing `reservationDb` anon client (cache in memory; prefetch alongside `loadOccupiedDates()` on DOMContentLoaded), renders cards grouped by category with an "interested" toggle. State: `booking.partnerIds` (Set of uuids).
- Step copy makes it explicit this is **non-binding, free-of-charge interest** — «Ще ви свържем с избраните партньори» / "We'll put you in touch" — and the step is skippable (Next always enabled). Fetch failure renders a notice inside the panel and **never blocks progression or submission**.
- `renderSummary()`: new non-priced «Партньори» row listing selected names (before the price rows; clearly not part of the total). Price math untouched.
- Payload: `partner_ids: ["<uuid>", …]` (only when non-empty), max 20.
- i18n: new keys in `translations-reservation.js` (step title `s_partners_title`, progress label, card labels, notice). Existing `s1..s6` keys are **not** renumbered — the new step gets its own key.

Out of scope: `edit.html`/`edit.js` are untouched (customer edit page does not show or send partner data).

---

## 4 · Edge functions & emails

- `_shared/validate.ts`: `partner_ids` — optional array, length ≤ 20, each element a string ≤ 64 chars matching a UUID pattern. Invalid **shape** → 400 `validation_failed` (existing style).
- `submit-enquiry` (service role): after validation, `SELECT id, name, category FROM partners WHERE id = ANY($ids) AND active` → build the `partner_interest` snapshot → include in the enquiries insert. Ids that don't resolve (stale/deactivated/bogus) are **silently dropped** — a booking never fails because of partners. Deploy with `--no-verify-jwt` (unchanged).
- `notify-enquiry` (plain-text team email): one line listing partner names by category when non-empty.
- `send-enquiry-summary` / `_shared/enquiry-email.ts`: a «Интерес към партньори» section (names grouped by category, no prices) in both the owner plain-text and the branded customer HTML. Diff vocabulary (Added/Removed/Changed) is untouched — nothing edits this field in v1, so it must produce **zero** diff entries.
- `update-enquiry-by-token` and `update-enquiry-admin`: verified to update named columns only, leaving `partner_interest` intact. No code changes expected; if either does whole-row writes anywhere, exclude the column explicitly.
- No changes to: pricing, discount logic, offer XLSX export, offer PDF, digests, reminders, feedback flow.

---

## 5 · Admin panel

New files (cloned from the `marketing.html` / `customers.js` skeleton):

- `website/admin/partners.html` — standard header (logo, `admin-nav` + new link marked active, lang toggle, logout), scripts with `?v=N`: supabase-js CDN, `supabase-client.js`, `admin-i18n.js`, `auth.js`, `toast.js`, `js/partners.js`.
- `website/admin/js/partners.js` — `DOMContentLoaded → requireAuth() → db.from('partners')` CRUD:
  - **List**: category filter tabs (Всички / Кетъринг / Артисти), table with thumbnail (or placeholder), name, category, contact (site/phone), `sort_order`, active toggle (inline update), edit / delete buttons. All strings through `esc()`.
  - **Add/Edit**: inline form panel (house pattern, no shared modal component): name*, category* select, description BG, description EN, website URL, phone, sort order, active checkbox, image file input with client-side preview + type/size pre-check (server still enforces bucket caps). Save = insert/update row; image upload to `partner-images` first, then row write with `image_path`; upload failure → toast, row not saved with a dangling path.
  - **Delete**: confirm dialog → delete row, best-effort delete of the storage object (storage failure only logs/toasts — the row delete still stands).
  - Errors surface via `toast.js`; no silent failures.
- Nav link «Партньори» (`data-i18n="nav_partners"`) added to the `admin-nav` in **all 6 admin pages** (dashboard, customers, calendar, feedback, marketing, financials) + `nav_partners` and the new page's keys in `admin-i18n.js` (bg + en).
- `website/admin/js/dashboard.js`: enquiry detail view gets a read-only «Партньори» line rendering `partner_interest` names (esc'd), only when non-empty. No admin editing of an enquiry's interest in v1.

---

## 6 · Explicitly out of scope (v1)

- Partner prices / any effect on totals, deposits, P&L, offer XLSX/PDF.
- Customer edit page section for partners.
- Admin editing of a submitted enquiry's partner interest.
- Per-partner detail pages, galleries, or artist availability calendars.
- More categories than catering/artist (schema check constraint is trivially extendable later).
- Replacing the hardcoded catering links in `offer-pdf.js` (follow-up candidate once the table is live).

---

## 7 · Rollout, verification & risks

**Order:** migration → admin page (team can start entering partners immediately) → public page + nav rollout → wizard step + edge functions + emails + dashboard line.

**Deploy discipline:**

- Bump `?v=N` on every touched JS reference (reservation.js, translations files, admin pages, dashboard.js, …). Pages currently missing `?v=` (e.g. index.html scripts) get versioned references for any file this feature touches.
- Edge function deploys: `submit-enquiry`, `notify-enquiry`, `send-enquiry-summary` with `--no-verify-jwt` (per the verify_jwt map; the JWT-gated functions are untouched).
- `node --check` every touched/created JS file before pushing.

**Verification checklist:**

- RLS: anon can SELECT only active partners; anon INSERT/UPDATE/DELETE rejected; non-admin authenticated rejected; admin CRUD works. Storage: anonymous upload rejected, admin upload works, public URL serves.
- Wizard BG + EN run-through at 375 px and 1280 px+: all 7 steps navigate forward/back, progress bar correct, partners step skippable, summary shows selections without price change, payload contains `partner_ids`, submitted enquiry shows snapshot in dashboard + both emails.
- Bogus/deactivated `partner_ids` in payload → booking succeeds, ids dropped.
- Customer edit via magic link after selecting partners → `partner_interest` unchanged, no spurious diff email.
- Public page: empty category hidden, DB failure shows fallback, language toggle re-renders, no layout shift from images.

**Risks:**

1. **Wizard renumbering** — the highest-risk mechanical change; mitigated by exhaustive grep of `goToStep` / `data-step` / `step-` / dispatch conditions in both reservation files, plus the full manual run-through.
2. **In-flight work collision** — `feat/pnl-itemized-services` has uncommitted changes to `submit-enquiry/index.ts`, `_shared/validate.ts`, `dashboard.js`/`.html`. That work must be committed/parked first; this feature starts as `feat/partners` from `main`, and merge order gets decided at implementation time.
3. **First Storage use** — no existing pattern in the repo; bucket config + policies are fully specified above to compensate.
