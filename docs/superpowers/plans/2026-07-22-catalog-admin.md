# Catalog Admin (DB-driven drinks & addon services) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the drinks and addon-services catalogs from static JS files into Supabase tables with a full-CRUD admin page, so the manager edits prices/items without a developer; the server reprices every enquiry from the DB.

**Architecture:** Two seeded tables (`public.drinks`, `public.addon_services`) become the single source of truth (spec: `docs/superpowers/specs/2026-07-22-catalog-admin-design.md`). A new `website/js/catalog-db.js` loader fetches them via anon REST and exposes the exact same globals the five consumer pages already use. A new `website/admin/catalog.html` page (modeled on partners) does CRUD. Edge functions recompute item prices server-side from the catalog, with grandfathering for items removed from the catalog after booking.

**Tech Stack:** Vanilla JS (no build step), Supabase (Postgres + RLS + Storage + Deno edge functions), Netlify static hosting.

## Global Constraints

- User-facing copy is **Bulgarian** (admin panel is bilingual via `admin-i18n.js`). Code, comments, commits: **English**.
- 1 EUR = **1.95583** BGN, fixed peg. Round half-away-from-zero to 2 dp (`Math.round(x*100)/100` — prices are non-negative so this is correct).
- **Cache rule:** every edited JS file under `website/` needs its `?v=N` bumped in every referencing HTML file (versions listed per task below).
- Sanity-check every touched JS file with `node --check <file>` before committing.
- Migrations are BOTH committed to `supabase/migrations/` AND applied to live project `wlxutsufrobzovdsiecb` via the Supabase MCP `apply_migration` — **ask Angel for explicit confirmation before applying to live** (it's a live business).
- Edge function deploys: `supabase functions deploy <slug> --project-ref wlxutsufrobzovdsiecb --use-api` plus `--no-verify-jwt` for `submit-enquiry` and `update-enquiry-by-token`; **NO** `--no-verify-jwt` for `update-enquiry-admin`.
- Payload shapes must not change: addons store the **LINE** price in `price` (+ `qty` for stepper items), drinks store unit `price_eur` + `qty`, item `name` is always `name_en`.
- Work happens in `~/dev/margel360` (repo root). Three PRs off `main`: `feat/catalog-tables`, `feat/catalog-admin`, `feat/catalog-switch`. Merge order 1→2→3, each after Angel's go-ahead. Netlify auto-deploys on merge to `main`.
- Repo has no JS test framework; TDD applies to the Deno edge-function module (`deno test`). Client changes are verified with `node --check` + the manual walkthroughs in Task 19.

---

## PR 1 — `feat/catalog-tables` (migration + seed; zero behavior change)

### Task 1: Seed generator script

**Files:**
- Create: `/private/tmp/claude-501/-Users-angelborisov-dev-margel360/633274eb-809e-4c73-af1b-8805305599d6/scratchpad/gen-catalog-seed.mjs` (scratchpad — NOT committed)

**Interfaces:**
- Consumes: `website/js/drinks-data.js` (global `drinks`, 57 items), `website/js/reservation-catalog.js` (global `addonServices`, 36 items).
- Produces: SQL `INSERT` statements on stdout, pasted verbatim into the Task 2 migration. Drink `sort_order` = position within its category × 10; addon `sort_order` = overall position × 10 (preserves the wizard's pair layout).

- [ ] **Step 1: Write the generator**

```js
// Generates the one-time seed SQL for the catalog migration by evaluating
// the current static catalog files, so no price/name is transcribed by hand.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = '/Users/angelborisov/dev/margel360/website/js';
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(`${root}/drinks-data.js`, 'utf8'), ctx);
vm.runInContext(readFileSync(`${root}/reservation-catalog.js`, 'utf8'), ctx);

const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
// Inventory caps currently hardcoded in reservation.js / edit.js ADDON_MAX_QTY.
const ADDON_MAX_QTY = { heater: 2, heater_tbl: 1, glow_table: 10 };

const out = [];
out.push('-- Seed: drinks (generated from website/js/drinks-data.js, verbatim)');
out.push('INSERT INTO public.drinks (id, cat, name_bg, name_en, price_eur, img, sort_order) VALUES');
const perCat = {};
out.push(ctx.drinks.map((d) => {
  perCat[d.cat] = (perCat[d.cat] || 0) + 10;
  return `  (${q(d.id)}, ${d.cat}, ${q(d.name_bg)}, ${q(d.name_en)}, ${d.price_eur}, ${q(d.img)}, ${perCat[d.cat]})`;
}).join(',\n') + '\nON CONFLICT (id) DO NOTHING;');
out.push('');
out.push('-- Seed: addon services (generated from reservation-catalog.js addonServices, verbatim)');
out.push('INSERT INTO public.addon_services (id, name_bg, name_en, price_eur, hint_bg, hint_en, free_until, max_qty, img, sort_order) VALUES');
out.push(ctx.addonServices.map((s, i) =>
  `  (${q(s.id)}, ${q(s.name_bg)}, ${q(s.name_en)}, ${s.price}, ${q(s.hint_bg)}, ${q(s.hint_en)}, ${s.freeUntil ?? 'NULL'}, ${ADDON_MAX_QTY[s.id] ?? 'NULL'}, ${q(s.img)}, ${(i + 1) * 10})`
).join(',\n') + '\nON CONFLICT (id) DO NOTHING;');
console.log(out.join('\n'));
```

- [ ] **Step 2: Run it and sanity-check the output**

Run: `node /private/tmp/claude-501/-Users-angelborisov-dev-margel360/633274eb-809e-4c73-af1b-8805305599d6/scratchpad/gen-catalog-seed.mjs > /private/tmp/claude-501/-Users-angelborisov-dev-margel360/633274eb-809e-4c73-af1b-8805305599d6/scratchpad/catalog-seed.sql`

Verify (all must hold before proceeding):
- `grep -c "^  ('" catalog-seed.sql` → **93** value rows (57 drinks + 36 addons).
- Cyrillic preserved exactly (spot-check `Узо Пломари`, `Стол „Шивари“`, `Question Mark Катаржина`).
- `('cleaning',` row present with price 70 and both qty columns NULL.
- `('heater',` has max_qty 2, `('heater_tbl',` 1, `('glow_table',` 10; `('bar_stool',` free_until 40; `('round_table',` free_until 1.
- `dj`, `hygiene`, `wardrobe`, `valet` rows carry non-NULL hint_bg/hint_en.

### Task 2: Migration file

**Files:**
- Create: `supabase/migrations/20260722120000_catalog_tables.sql`

**Interfaces:**
- Produces: tables `public.drinks(id text PK, cat smallint 0–4, name_bg, name_en, price_eur numeric(8,2), img text, active bool, sort_order int, created_at, updated_at)` and `public.addon_services(id text PK, name_bg, name_en, price_eur numeric(8,2), hint_bg, hint_en, free_until int NULL, max_qty int NULL, img text, active bool, sort_order int, created_at, updated_at)`; RLS mirroring `partners`; `catalog-images` bucket; cleaning-guard trigger. All later tasks depend on these exact names.

- [ ] **Step 1: Write the migration (seed appended at the end)**

```sql
-- Drinks + addon-services catalog, editable from the admin panel
-- (admin/catalog.html). Single source of truth for items and prices:
-- the public site fetches these tables via anon REST (same model as
-- partners) and the enquiry edge functions reprice every item from them.
-- The static drinks-data.js / addonServices arrays are removed in the
-- follow-up code change (PR feat/catalog-switch).

CREATE TABLE IF NOT EXISTS public.drinks (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cat smallint NOT NULL CHECK (cat BETWEEN 0 AND 4),
  name_bg text NOT NULL,
  name_en text NOT NULL,
  price_eur numeric(8,2) NOT NULL CHECK (price_eur >= 0),
  img text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.addon_services (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name_bg text NOT NULL,
  name_en text NOT NULL,
  price_eur numeric(8,2) NOT NULL CHECK (price_eur >= 0),
  hint_bg text,
  hint_en text,
  free_until int CHECK (free_until IS NULL OR free_until >= 0),
  max_qty int CHECK (max_qty IS NULL OR max_qty >= 1),
  img text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drinks_public_read ON public.drinks;
CREATE POLICY drinks_public_read ON public.drinks
  FOR SELECT TO anon USING (active);

DROP POLICY IF EXISTS drinks_admin_all ON public.drinks;
CREATE POLICY drinks_admin_all ON public.drinks
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS addon_services_public_read ON public.addon_services;
CREATE POLICY addon_services_public_read ON public.addon_services
  FOR SELECT TO anon USING (active);

DROP POLICY IF EXISTS addon_services_admin_all ON public.addon_services;
CREATE POLICY addon_services_admin_all ON public.addon_services
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- The mandatory cleaning addon (id 'cleaning') is auto-added to every event
-- by the wizard and the customer edit page (autoCleaningAddon) and has a
-- dedicated always-on row in the offer XLSX (AA85). Deleting or hiding it
-- would break both, so the DB refuses; its price stays editable.
CREATE OR REPLACE FUNCTION public.protect_cleaning_addon() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.id = 'cleaning' THEN
      RAISE EXCEPTION 'the cleaning addon cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.id = 'cleaning' AND (NEW.id IS DISTINCT FROM 'cleaning' OR NEW.active = false) THEN
    RAISE EXCEPTION 'the cleaning addon cannot be hidden or re-keyed';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS addon_services_protect_cleaning ON public.addon_services;
CREATE TRIGGER addon_services_protect_cleaning
  BEFORE UPDATE OR DELETE ON public.addon_services
  FOR EACH ROW EXECUTE FUNCTION public.protect_cleaning_addon();

-- Storage bucket for catalog item images (same policy shape as
-- partner-images). Seeded rows keep their repo asset paths ('assets/…');
-- only newly uploaded images live in this bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('catalog-images', 'catalog-images', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS catalog_images_admin_insert ON storage.objects;
CREATE POLICY catalog_images_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog-images' AND is_admin());

DROP POLICY IF EXISTS catalog_images_admin_update ON storage.objects;
CREATE POLICY catalog_images_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'catalog-images' AND is_admin())
  WITH CHECK (bucket_id = 'catalog-images' AND is_admin());

DROP POLICY IF EXISTS catalog_images_admin_delete ON storage.objects;
CREATE POLICY catalog_images_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-images' AND is_admin());

-- ── Seed (generated by scratchpad/gen-catalog-seed.mjs) ──────────────
```

Then append the entire contents of `catalog-seed.sql` from Task 1.

- [ ] **Step 2: Commit on a new branch**

```bash
cd /Users/angelborisov/dev/margel360
git checkout -b feat/catalog-tables
git add supabase/migrations/20260722120000_catalog_tables.sql
git commit -m "feat(db): drinks + addon_services catalog tables, RLS, seed, catalog-images bucket"
```

### Task 3: Apply migration to live + open PR 1

- [ ] **Step 1: ASK ANGEL** for explicit confirmation to apply the migration to live project `wlxutsufrobzovdsiecb`. Do not proceed without it.

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp: apply_migration` with name `catalog_tables` and the exact file contents.

- [ ] **Step 3: Verify the live schema**

Run via `mcp: execute_sql`:

```sql
SELECT (SELECT count(*) FROM public.drinks)          AS drinks,          -- expect 57
       (SELECT count(*) FROM public.addon_services)  AS addons,          -- expect 36
       (SELECT count(*) FROM public.addon_services WHERE max_qty IS NOT NULL) AS capped,   -- expect 3
       (SELECT count(*) FROM public.addon_services WHERE free_until IS NOT NULL) AS furniture, -- expect 6
       (SELECT price_eur FROM public.addon_services WHERE id = 'cleaning') AS cleaning;    -- expect 70.00
```

Then confirm the trigger works (both must ERROR):

```sql
DELETE FROM public.addon_services WHERE id = 'cleaning';
UPDATE public.addon_services SET active = false WHERE id = 'cleaning';
```

And anon visibility (RLS): `SET LOCAL ROLE anon; SELECT count(*) FROM public.drinks;` → 57.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/catalog-tables
gh pr create --title "feat(db): catalog tables for drinks & addon services" --body "Tables + RLS + seed + catalog-images bucket per docs/superpowers/specs/2026-07-22-catalog-admin-design.md. Additive; zero behavior change. Migration already applied to live (confirmed with Angel)."
```

Wait for Angel's go-ahead, then merge. PR 2 branches from updated `main`.

---

## PR 2 — `feat/catalog-admin` (admin CRUD page; public site untouched)

### Task 4: admin-i18n keys + nav links

**Files:**
- Modify: `website/admin/js/admin-i18n.js` (add keys to BOTH the `en:` and `bg:` maps inside `ADMIN_LANG`, next to the existing `partners_*` keys)
- Modify (nav + `admin-i18n.js?v=` bump 18→19): `website/admin/dashboard.html`, `customers.html`, `calendar.html`, `feedback.html`, `partners.html`, `marketing.html`, `financials.html`, `activity.html`

**Interfaces:**
- Produces: `t('cat_…')` keys used by Task 6; `nav_catalog` used by every admin nav.

- [ ] **Step 1: Add the EN keys** (inside the `en: {` map):

```js
    nav_catalog:      'Catalog',
    cat_title:        'Catalog',
    cat_lead:         'Drinks and extra services shown on the site and in the booking form. Prices are in EUR; the BGN value uses the fixed 1.95583 rate. A hidden item disappears from the site immediately.',
    cat_tab_drinks:   'Drinks',
    cat_tab_services: 'Services',
    cat_add_drink:    'Add drink',
    cat_add_service:  'Add service',
    cat_col_image:    'Image',
    cat_col_name:     'Name',
    cat_col_details:  'Details',
    cat_col_price:    'Price',
    cat_col_sort:     'Order',
    cat_col_actions:  'Actions',
    cat_cat_0: 'Champagne', cat_cat_1: 'Wine', cat_cat_2: 'Spirits & Whisky', cat_cat_3: 'Soft Drinks', cat_cat_4: 'Water',
    cat_hidden:       'hidden',
    cat_deactivate:   'Hide',
    cat_activate:     'Show',
    cat_edit:         'Edit',
    cat_delete:       'Delete',
    cat_mandatory_badge: 'mandatory — added to every event',
    cat_badge_maxqty: 'max',
    cat_badge_free:   'free:',
    cat_form_add_drink: 'Add drink', cat_form_edit_drink: 'Edit drink',
    cat_form_add_service: 'Add service', cat_form_edit_service: 'Edit service',
    cat_f_name_bg:    'Name (BG)',
    cat_f_name_en:    'Name (EN)',
    cat_f_category:   'Category',
    cat_f_price:      'Price (EUR)',
    cat_f_hint_bg:    'Note (BG, optional)',
    cat_f_hint_en:    'Note (EN, optional)',
    cat_f_qty_item:   'Quantity item (customer picks a count)',
    cat_f_max_qty:    'Max quantity (inventory cap, empty = unlimited)',
    cat_f_free_until: 'Free pieces included with the venue (furniture)',
    cat_f_sort:       'Order (lower = earlier)',
    cat_f_image:      'Image',
    cat_f_active:     'Visible on the site',
    cat_save:         'Save',
    cat_cancel:       'Cancel',
    cat_saved:        'Saved.',
    cat_deleted:      'Deleted.',
    cat_load_failed:  'Could not load the catalog.',
    cat_save_failed:  'Save failed',
    cat_name_required:'Both names (BG and EN) are required.',
    cat_price_invalid:'Enter a valid price (0 – 50000 EUR).',
    cat_img_invalid:  'Image must be JPEG/PNG/WebP up to 5 MB.',
    cat_delete_confirm: '"Hide" is usually safer — customers with an open edit link may still have this item in their booking. Really delete permanently?',
    cat_empty:        'No items.',
```

- [ ] **Step 2: Add the BG keys** (inside the `bg: {` map):

```js
    nav_catalog:      'Каталог',
    cat_title:        'Каталог',
    cat_lead:         'Напитки и допълнителни услуги, показвани на сайта и в резервационната форма. Цените са в EUR; стойността в лева е по фиксирания курс 1.95583. Скрит артикул изчезва от сайта веднага.',
    cat_tab_drinks:   'Напитки',
    cat_tab_services: 'Услуги',
    cat_add_drink:    'Добави напитка',
    cat_add_service:  'Добави услуга',
    cat_col_image:    'Снимка',
    cat_col_name:     'Име',
    cat_col_details:  'Детайли',
    cat_col_price:    'Цена',
    cat_col_sort:     'Ред',
    cat_col_actions:  'Действия',
    cat_cat_0: 'Шампанско', cat_cat_1: 'Вино', cat_cat_2: 'Алкохол & Уиски', cat_cat_3: 'Безалкохолно', cat_cat_4: 'Вода',
    cat_hidden:       'скрит',
    cat_deactivate:   'Скрий',
    cat_activate:     'Покажи',
    cat_edit:         'Редакция',
    cat_delete:       'Изтрий',
    cat_mandatory_badge: 'задължителна услуга — добавя се към всяко събитие',
    cat_badge_maxqty: 'макс.',
    cat_badge_free:   'безплатни:',
    cat_form_add_drink: 'Добави напитка', cat_form_edit_drink: 'Редакция на напитка',
    cat_form_add_service: 'Добави услуга', cat_form_edit_service: 'Редакция на услуга',
    cat_f_name_bg:    'Име (БГ)',
    cat_f_name_en:    'Име (EN)',
    cat_f_category:   'Категория',
    cat_f_price:      'Цена (EUR)',
    cat_f_hint_bg:    'Бележка (БГ, незадължителна)',
    cat_f_hint_en:    'Бележка (EN, незадължителна)',
    cat_f_qty_item:   'Артикул с количество (клиентът избира брой)',
    cat_f_max_qty:    'Максимално количество (наличност, празно = без лимит)',
    cat_f_free_until: 'Безплатни бройки, включени в наема (мебели)',
    cat_f_sort:       'Ред (по-малко = по-напред)',
    cat_f_image:      'Снимка',
    cat_f_active:     'Видим на сайта',
    cat_save:         'Запази',
    cat_cancel:       'Отказ',
    cat_saved:        'Запазено.',
    cat_deleted:      'Изтрито.',
    cat_load_failed:  'Каталогът не можа да се зареди.',
    cat_save_failed:  'Грешка при запазване',
    cat_name_required:'И двете имена (БГ и EN) са задължителни.',
    cat_price_invalid:'Въведете валидна цена (0 – 50000 EUR).',
    cat_img_invalid:  'Снимката трябва да е JPEG/PNG/WebP до 5 MB.',
    cat_delete_confirm: 'По-безопасно е „Скрий“ — клиенти с активен линк за редакция може още да имат артикула в резервацията си. Наистина ли да го изтрия окончателно?',
    cat_empty:        'Няма артикули.',
```

- [ ] **Step 3: Add the nav link to all 8 admin pages.** In each file's `<nav class="admin-nav">`, insert after the partners link:

```html
      <a href="catalog.html" data-i18n="nav_catalog">Каталог</a>
```

- [ ] **Step 4: Bump `js/admin-i18n.js?v=18` → `?v=19`** in all 8 files (plus `catalog.html` when created in Task 5 uses v=19 from the start).

- [ ] **Step 5: Verify + commit**

```bash
node --check website/admin/js/admin-i18n.js
git checkout -b feat/catalog-admin
git add website/admin
git commit -m "feat(admin): catalog i18n keys + nav links"
```

### Task 5: catalog.html

**Files:**
- Create: `website/admin/catalog.html`

**Interfaces:**
- Produces: DOM ids consumed by Task 6: `catalog-tabs`, `cat-add-btn`, `catalog-form`, `catalog-form-title`, `cf-name-bg`, `cf-name-en`, `cf-drink-fields`, `cf-cat`, `cf-service-fields`, `cf-hint-bg`, `cf-hint-en`, `cf-qty-item`, `cf-qty-detail`, `cf-max-qty`, `cf-free-until`, `cf-price`, `cf-bgn-view`, `cf-sort`, `cf-image`, `cf-image-preview`, `cf-active`, `cf-active-note`, `cf-save`, `cf-cancel`, `catalog-body`.

- [ ] **Step 1: Write the page** (structure mirrors `partners.html`; header/nav copied from it with `catalog.html` marked `class="active"`):

```html
<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Каталог - Маргел 360° Админ</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/admin.css?v=17">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
</head>
<body>
  <header class="admin-header">
    <a href="dashboard.html" class="admin-logo">МАРГЕЛ <span>360°</span></a>
    <nav class="admin-nav">
      <a href="dashboard.html" data-i18n="nav_enquiries">Запитвания</a>
      <a href="customers.html" data-i18n="nav_customers">Клиенти</a>
      <a href="calendar.html" data-i18n="nav_calendar">Календар</a>
      <a href="feedback.html">Впечатления</a>
      <a href="partners.html" data-i18n="nav_partners">Партньори</a>
      <a href="catalog.html" class="active" data-i18n="nav_catalog">Каталог</a>
      <a href="marketing.html" data-i18n="nav_marketing">Маркетинг</a>
      <a href="financials.html" data-i18n="nav_financials">Финанси</a>
      <a href="activity.html" class="owner-only" hidden data-i18n="nav_activity">Дневник</a>
    </nav>
    <div class="lang-toggle">
      <button class="lang-btn" data-lang="bg">БГ</button>
      <button class="lang-btn" data-lang="en">EN</button>
    </div>
    <button class="btn btn-outline btn-sm" id="logout-btn" data-i18n="nav_logout">Изход</button>
  </header>

  <main class="admin-main">
    <div class="admin-container">
      <h1 class="page-title" data-i18n="cat_title">Каталог</h1>
      <p class="page-sub" data-i18n="cat_lead" style="max-width:720px;color:#666">Напитки и допълнителни услуги, показвани на сайта и в резервационната форма. Цените са в EUR; стойността в лева е по фиксирания курс 1.95583. Скрит артикул изчезва от сайта веднага.</p>

      <div style="display:flex;gap:10px;align-items:center;margin:18px 0;flex-wrap:wrap">
        <div id="catalog-tabs" role="group" aria-label="Catalog section">
          <button class="btn btn-outline btn-sm cat-tab active" data-tab="drinks" data-i18n="cat_tab_drinks">Напитки</button>
          <button class="btn btn-outline btn-sm cat-tab" data-tab="services" data-i18n="cat_tab_services">Услуги</button>
        </div>
        <button class="btn btn-primary btn-sm" id="cat-add-btn" style="margin-left:auto">Добави напитка</button>
      </div>

      <div class="marketing-card" id="catalog-form" style="display:none;max-width:760px;margin-bottom:22px">
        <h3 id="catalog-form-title" style="margin:0 0 16px">Добави</h3>
        <div class="form-group">
          <label for="cf-name-bg" data-i18n="cat_f_name_bg">Име (БГ)</label>
          <input type="text" id="cf-name-bg" maxlength="200">
        </div>
        <div class="form-group">
          <label for="cf-name-en" data-i18n="cat_f_name_en">Име (EN)</label>
          <input type="text" id="cf-name-en" maxlength="200">
        </div>
        <div id="cf-drink-fields">
          <div class="form-group">
            <label for="cf-cat" data-i18n="cat_f_category">Категория</label>
            <select id="cf-cat" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px">
              <option value="0" data-i18n="cat_cat_0">Шампанско</option>
              <option value="1" data-i18n="cat_cat_1">Вино</option>
              <option value="2" data-i18n="cat_cat_2">Алкохол &amp; Уиски</option>
              <option value="3" data-i18n="cat_cat_3">Безалкохолно</option>
              <option value="4" data-i18n="cat_cat_4">Вода</option>
            </select>
          </div>
        </div>
        <div id="cf-service-fields" style="display:none">
          <div class="form-group">
            <label for="cf-hint-bg" data-i18n="cat_f_hint_bg">Бележка (БГ, незадължителна)</label>
            <input type="text" id="cf-hint-bg" maxlength="200" placeholder="За всеки допълнителен час - €60">
          </div>
          <div class="form-group">
            <label for="cf-hint-en" data-i18n="cat_f_hint_en">Бележка (EN, незадължителна)</label>
            <input type="text" id="cf-hint-en" maxlength="200" placeholder="Each additional hour - €60">
          </div>
          <div class="form-group" style="display:flex;gap:8px;align-items:center">
            <input type="checkbox" id="cf-qty-item" style="width:18px;height:18px">
            <label for="cf-qty-item" style="margin:0" data-i18n="cat_f_qty_item">Артикул с количество (клиентът избира брой)</label>
          </div>
          <div id="cf-qty-detail" style="display:none">
            <div class="form-group">
              <label for="cf-max-qty" data-i18n="cat_f_max_qty">Максимално количество (наличност, празно = без лимит)</label>
              <input type="number" id="cf-max-qty" min="1" max="999" step="1">
            </div>
            <div class="form-group">
              <label for="cf-free-until" data-i18n="cat_f_free_until">Безплатни бройки, включени в наема (мебели)</label>
              <input type="number" id="cf-free-until" min="0" max="999" step="1">
            </div>
          </div>
        </div>
        <div class="form-group">
          <label for="cf-price" data-i18n="cat_f_price">Цена (EUR)</label>
          <input type="number" id="cf-price" min="0" max="50000" step="0.01">
          <div id="cf-bgn-view" style="margin-top:6px;color:#777;font-size:0.85rem"></div>
        </div>
        <div class="form-group">
          <label for="cf-sort" data-i18n="cat_f_sort">Ред (по-малко = по-напред)</label>
          <input type="number" id="cf-sort" value="100" min="0" max="9999" step="1">
        </div>
        <div class="form-group">
          <label for="cf-image" data-i18n="cat_f_image">Снимка</label>
          <input type="file" id="cf-image" accept="image/jpeg,image/png,image/webp">
          <div id="cf-image-preview" style="margin-top:10px"></div>
        </div>
        <div class="form-group" style="display:flex;gap:8px;align-items:center">
          <input type="checkbox" id="cf-active" checked style="width:18px;height:18px">
          <label for="cf-active" style="margin:0" data-i18n="cat_f_active">Видим на сайта</label>
          <span id="cf-active-note" hidden style="color:#8a6d1a;font-size:0.82rem" data-i18n="cat_mandatory_badge">задължителна услуга — добавя се към всяко събитие</span>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" id="cf-save" data-i18n="cat_save">Запази</button>
          <button class="btn btn-outline" id="cf-cancel" data-i18n="cat_cancel">Отказ</button>
        </div>
      </div>

      <table class="customers-table">
        <thead>
          <tr>
            <th data-i18n="cat_col_image">Снимка</th>
            <th data-i18n="cat_col_name">Име</th>
            <th data-i18n="cat_col_details">Детайли</th>
            <th data-i18n="cat_col_price">Цена</th>
            <th data-i18n="cat_col_sort">Ред</th>
            <th data-i18n="cat_col_actions">Действия</th>
          </tr>
        </thead>
        <tbody id="catalog-body"></tbody>
      </table>
    </div>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7" integrity="sha384-tD6X9wDfTRdKpuPoHFZrVW2RXjSYSWjLBPWXxpHprWWl9eaHlwl05aRjHsiKF97n" crossorigin="anonymous" defer></script>
  <script src="js/supabase-client.js?v=4" defer></script>
  <script src="js/admin-i18n.js?v=19" defer></script>
  <script src="js/auth.js?v=5" defer></script>
  <script src="js/toast.js?v=2" defer></script>
  <script src="js/catalog.js?v=1" defer></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add website/admin/catalog.html
git commit -m "feat(admin): catalog page markup"
```

### Task 6: catalog.js

**Files:**
- Create: `website/admin/js/catalog.js`

**Interfaces:**
- Consumes: `db` (supabase-client.js), `t()`/`rerenderPage` convention (admin-i18n.js), `requireAuth()` (auth.js), `showToast()` (toast.js), Task 5 DOM ids, Task 2 tables/bucket.

- [ ] **Step 1: Write the module** (complete file):

```js
// Catalog CRUD - drinks + addon services shown on the public site, the
// booking wizard and the customer edit page. Rows live in public.drinks /
// public.addon_services (RLS: admin ALL via is_admin(), anon SELECT active
// only). Images upload to the public 'catalog-images' bucket; the img column
// stores either a repo asset path ('assets/…', seeded rows) or a storage
// object path '<row-id>/<epoch-millis>.<ext>'.

const BUCKET = 'catalog-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const BGN_RATE = 1.95583;     // fixed legal peg - never fetch this
const MAX_PRICE_EUR = 50000;  // matches the server-side MAX_ADDON_PRICE bound

let activeTab = 'drinks';     // 'drinks' | 'services'
let rows = { drinks: [], services: [] };
let editingId = null;
let editingImagePath = null;
let pendingFile = null;

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tableFor(tab) { return tab === 'drinks' ? 'drinks' : 'addon_services'; }

function imgUrl(path) {
  if (!path) return null;
  // Seeded rows point at repo assets served from the site root; uploads
  // live in the catalog-images bucket.
  if (/^assets\//.test(path)) return '/' + path;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function bgn(eur) {
  return (Math.round(Number(eur) * BGN_RATE * 100) / 100).toFixed(2);
}

async function loadRows() {
  const [dr, sv] = await Promise.all([
    db.from('drinks').select('*').order('cat').order('sort_order').order('name_bg'),
    db.from('addon_services').select('*').order('sort_order').order('name_bg'),
  ]);
  if (dr.error || sv.error) {
    console.error('catalog load failed:', dr.error || sv.error);
    showToast(t('cat_load_failed'), 'error');
    return;
  }
  rows = { drinks: dr.data || [], services: sv.data || [] };
  renderTable();
}

function detailsCell(r) {
  if (activeTab === 'drinks') return esc(t('cat_cat_' + r.cat));
  const bits = [];
  if (r.id === 'cleaning') bits.push(`<span style="color:#8a6d1a;font-size:0.78rem">${esc(t('cat_mandatory_badge'))}</span>`);
  if (r.max_qty != null) bits.push(esc(`${t('cat_badge_maxqty')} ${r.max_qty}`));
  if (r.free_until != null) bits.push(esc(`${t('cat_badge_free')} ${r.free_until}`));
  return bits.join(' · ');
}

function renderTable() {
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
  document.getElementById('cat-add-btn').textContent = t(activeTab === 'drinks' ? 'cat_add_drink' : 'cat_add_service');
  const tbody = document.getElementById('catalog-body');
  const list = rows[activeTab];
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#777;padding:28px">${esc(t('cat_empty'))}</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(r => `
    <tr data-id="${esc(r.id)}"${r.active ? '' : ' style="opacity:0.55"'}>
      <td>${r.img
        ? `<img src="${esc(imgUrl(r.img))}" alt="" style="width:56px;height:40px;object-fit:cover;border-radius:6px">`
        : `<span style="display:inline-flex;width:56px;height:40px;border-radius:6px;background:#eee;align-items:center;justify-content:center" aria-hidden="true">${activeTab === 'drinks' ? '🍷' : '🎈'}</span>`}</td>
      <td><strong>${esc(r.name_bg)}</strong><br><span style="color:#777;font-size:0.82rem">${esc(r.name_en)}</span>${r.active ? '' : ` <span style="color:#c62828;font-size:0.78rem">(${esc(t('cat_hidden'))})</span>`}</td>
      <td>${detailsCell(r)}</td>
      <td style="white-space:nowrap">€${Number(r.price_eur).toFixed(2)}<br><span style="color:#777;font-size:0.8rem">${bgn(r.price_eur)} лв.</span></td>
      <td>${Number(r.sort_order) || 0}</td>
      <td style="white-space:nowrap">
        ${r.id === 'cleaning' ? '' : `<button class="btn btn-outline btn-sm btn-toggle" data-id="${esc(r.id)}">${esc(r.active ? t('cat_deactivate') : t('cat_activate'))}</button>`}
        <button class="btn btn-outline btn-sm btn-edit" data-id="${esc(r.id)}">${esc(t('cat_edit'))}</button>
        ${r.id === 'cleaning' ? '' : `<button class="btn btn-danger btn-sm btn-delete" data-id="${esc(r.id)}">${esc(t('cat_delete'))}</button>`}
      </td>
    </tr>`).join('');
}

function syncQtyFields() {
  const on = document.getElementById('cf-qty-item').checked;
  document.getElementById('cf-qty-detail').style.display = on ? '' : 'none';
}

function syncBgnView() {
  const price = Number(document.getElementById('cf-price').value);
  document.getElementById('cf-bgn-view').textContent =
    Number.isFinite(price) && price >= 0 ? `= ${bgn(price)} лв.` : '';
}

function openForm(row) {
  const isDrinks = activeTab === 'drinks';
  editingId = row ? row.id : null;
  editingImagePath = row ? row.img : null;
  pendingFile = null;

  document.getElementById('cf-drink-fields').style.display = isDrinks ? '' : 'none';
  document.getElementById('cf-service-fields').style.display = isDrinks ? 'none' : '';
  document.getElementById('catalog-form-title').textContent =
    t(isDrinks ? (row ? 'cat_form_edit_drink' : 'cat_form_add_drink')
               : (row ? 'cat_form_edit_service' : 'cat_form_add_service'));

  document.getElementById('cf-name-bg').value = row ? row.name_bg : '';
  document.getElementById('cf-name-en').value = row ? row.name_en : '';
  document.getElementById('cf-price').value = row ? row.price_eur : '';
  document.getElementById('cf-sort').value = row ? (row.sort_order ?? 100) : 100;

  const isCleaning = !!row && row.id === 'cleaning';
  const activeBox = document.getElementById('cf-active');
  activeBox.checked = row ? !!row.active : true;
  activeBox.disabled = isCleaning;   // DB trigger enforces this too
  document.getElementById('cf-active-note').hidden = !isCleaning;

  if (isDrinks) {
    document.getElementById('cf-cat').value = row ? String(row.cat) : '0';
  } else {
    document.getElementById('cf-hint-bg').value = row?.hint_bg || '';
    document.getElementById('cf-hint-en').value = row?.hint_en || '';
    document.getElementById('cf-qty-item').checked = !!row && (row.max_qty != null || row.free_until != null);
    document.getElementById('cf-max-qty').value = row?.max_qty ?? '';
    document.getElementById('cf-free-until').value = row?.free_until ?? '';
    syncQtyFields();
  }

  document.getElementById('cf-image').value = '';
  document.getElementById('cf-image-preview').innerHTML = editingImagePath
    ? `<img src="${esc(imgUrl(editingImagePath))}" alt="" style="max-width:180px;border-radius:8px">`
    : '';
  syncBgnView();
  document.getElementById('catalog-form').style.display = 'block';
  document.getElementById('cf-name-bg').focus();
}

function closeForm() {
  document.getElementById('catalog-form').style.display = 'none';
  editingId = null;
  editingImagePath = null;
  pendingFile = null;
}

function serviceQtyColumns() {
  const qtyItem = document.getElementById('cf-qty-item').checked;
  if (!qtyItem) return { free_until: null, max_qty: null };
  const freeRaw = parseInt(document.getElementById('cf-free-until').value, 10);
  const maxRaw = parseInt(document.getElementById('cf-max-qty').value, 10);
  const free_until = Number.isInteger(freeRaw) && freeRaw >= 0 ? freeRaw : null;
  // A qty item needs at least one non-null column so the renderers show a
  // stepper; an empty cap on a non-furniture item means "uncapped" (999).
  const max_qty = Number.isInteger(maxRaw) && maxRaw >= 1 ? maxRaw
                : (free_until != null ? null : 999);
  return { free_until, max_qty };
}

async function saveItem() {
  const name_bg = document.getElementById('cf-name-bg').value.trim();
  const name_en = document.getElementById('cf-name-en').value.trim();
  if (!name_bg || !name_en) { showToast(t('cat_name_required'), 'error'); return; }
  const price = Number(document.getElementById('cf-price').value);
  if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE_EUR) {
    showToast(t('cat_price_invalid'), 'error');
    return;
  }

  const saveBtn = document.getElementById('cf-save');
  saveBtn.disabled = true;
  try {
    const rowId = editingId || crypto.randomUUID();
    let image_path = editingImagePath;
    const oldImagePath = editingImagePath;

    if (pendingFile) {
      const ext = IMAGE_EXT[pendingFile.type];
      const path = `${rowId}/${Date.now()}.${ext}`;
      const { error: upErr } = await db.storage.from(BUCKET)
        .upload(path, pendingFile, { contentType: pendingFile.type });
      if (upErr) {
        console.error('image upload failed:', upErr);
        showToast(`${t('cat_save_failed')} - ${upErr.message}`, 'error');
        return;
      }
      image_path = path;
    }

    const base = {
      id: rowId,
      name_bg, name_en,
      price_eur: Math.round(price * 100) / 100,
      img: image_path,
      sort_order: Math.max(0, Math.min(9999, parseInt(document.getElementById('cf-sort').value, 10) || 100)),
      active: editingId === 'cleaning' ? true : document.getElementById('cf-active').checked,
      updated_at: new Date().toISOString(),
    };
    const row = activeTab === 'drinks'
      ? { ...base, cat: parseInt(document.getElementById('cf-cat').value, 10) }
      : {
          ...base,
          hint_bg: document.getElementById('cf-hint-bg').value.trim() || null,
          hint_en: document.getElementById('cf-hint-en').value.trim() || null,
          ...serviceQtyColumns(),
        };

    const table = tableFor(activeTab);
    const { error } = editingId
      ? await db.from(table).update(row).eq('id', editingId)
      : await db.from(table).insert(row);
    if (error) {
      console.error('catalog save failed:', error);
      showToast(`${t('cat_save_failed')} - ${error.message}`, 'error');
      if (pendingFile && image_path !== oldImagePath) {
        db.storage.from(BUCKET).remove([image_path])
          .catch(e => console.warn('orphaned image cleanup failed:', e));
      }
      return;
    }

    // Replaced a bucket image: best-effort removal of the old object (repo
    // asset paths are never deleted).
    if (pendingFile && oldImagePath && oldImagePath !== image_path && !/^assets\//.test(oldImagePath)) {
      db.storage.from(BUCKET).remove([oldImagePath])
        .catch(e => console.warn('old image cleanup failed:', e));
    }

    showToast(t('cat_saved'), 'success');
    closeForm();
    await loadRows();
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteItem(id) {
  const r = rows[activeTab].find(x => x.id === id);
  if (!r) return;
  if (!confirm(t('cat_delete_confirm'))) return;
  const { error } = await db.from(tableFor(activeTab)).delete().eq('id', id);
  if (error) {
    console.error('catalog delete failed:', error);
    showToast(`${t('cat_save_failed')} - ${error.message}`, 'error');
    return;
  }
  if (r.img && !/^assets\//.test(r.img)) {
    db.storage.from(BUCKET).remove([r.img])
      .catch(e => console.warn('image cleanup failed:', e));
  }
  showToast(t('cat_deleted'), 'success');
  await loadRows();
}

async function toggleActive(id) {
  const r = rows[activeTab].find(x => x.id === id);
  if (!r) return;
  const { error } = await db.from(tableFor(activeTab))
    .update({ active: !r.active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('catalog toggle failed:', error);
    showToast(`${t('cat_save_failed')} - ${error.message}`, 'error');
    return;
  }
  await loadRows();
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  document.getElementById('cat-add-btn').addEventListener('click', () => openForm(null));
  document.getElementById('cf-cancel').addEventListener('click', closeForm);
  document.getElementById('cf-save').addEventListener('click', saveItem);
  document.getElementById('cf-qty-item').addEventListener('change', syncQtyFields);
  document.getElementById('cf-price').addEventListener('input', syncBgnView);

  document.getElementById('cf-image').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    pendingFile = null;
    if (!file) return;
    if (!IMAGE_EXT[file.type] || file.size > MAX_IMAGE_BYTES) {
      showToast(t('cat_img_invalid'), 'error');
      e.target.value = '';
      return;
    }
    pendingFile = file;
    document.getElementById('cf-image-preview').innerHTML =
      `<img src="${URL.createObjectURL(file)}" alt="" style="max-width:180px;border-radius:8px">`;
  });

  document.getElementById('catalog-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-tab');
    if (!btn || btn.dataset.tab === activeTab) return;
    activeTab = btn.dataset.tab;
    closeForm();
    renderTable();
  });

  document.getElementById('catalog-body').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) { openForm(rows[activeTab].find(r => r.id === editBtn.dataset.id)); return; }
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) { deleteItem(delBtn.dataset.id); return; }
    const tglBtn = e.target.closest('.btn-toggle');
    if (tglBtn) { toggleActive(tglBtn.dataset.id); }
  });

  await loadRows();
});

// admin-i18n.js calls this after a language switch.
function rerenderPage() {
  renderTable();
  if (document.getElementById('catalog-form').style.display !== 'none') {
    const isDrinks = activeTab === 'drinks';
    document.getElementById('catalog-form-title').textContent =
      t(isDrinks ? (editingId ? 'cat_form_edit_drink' : 'cat_form_add_drink')
                 : (editingId ? 'cat_form_edit_service' : 'cat_form_add_service'));
  }
}
```

- [ ] **Step 2: Verify + commit**

```bash
node --check website/admin/js/catalog.js
git add website/admin/js/catalog.js
git commit -m "feat(admin): catalog CRUD logic"
```

### Task 7: PR 2 verification + PR

- [ ] **Step 1: Manual walkthrough** — serve locally (`cd website && python3 -m http.server 8080`), open `http://localhost:8080/admin/catalog.html`, log in as an admin, and verify: both tabs list seeded rows with EUR + BGN prices; edit a drink price and see it persist; create a test service with an image (appears in `catalog-images` bucket); hide it; delete it (image removed from bucket); cleaning row shows the mandatory badge and no Hide/Delete buttons; language toggle re-renders everything in EN. **The public site must be unaffected** — it still reads static files at this point.

- [ ] **Step 2: Clean up any test rows**, then:

```bash
git push -u origin feat/catalog-admin
gh pr create --title "feat(admin): catalog CRUD page for drinks & services" --body "Admin Каталог page (partners pattern) against the PR-1 tables. Public site untouched — the switch is PR 3. Note: edits made here do not reach customers until PR 3 merges."
```

Wait for Angel's go-ahead, merge, branch PR 3 from updated `main`.

---

## PR 3 — `feat/catalog-switch` (public loader + server repricing; the cutover)

### Task 8: catalog-db.js public loader

**Files:**
- Create: `website/js/catalog-db.js`

**Interfaces:**
- Produces: `window.loadCatalog(): Promise` — on resolve, globals `drinks` (fields `id, cat, name_bg, name_en, price_eur, img`), `drinkCategories` (`{bg:[…5], en:[…5]}`), `addonServices` (fields `id, name_bg, name_en, price, img`, optional `hint_bg, hint_en, freeUntil, maxQty`) exist with today's exact shapes. Rejects on network/HTTP failure; the promise is cached on success only.

- [ ] **Step 1: Write the loader** (complete file; note the IIFE — `edit.js` and `reservation-supabase.js` already declare `SUPABASE_URL` as top-level consts, so no new top-level bindings are allowed here):

```js
// DB-backed catalog loader - the single runtime source for the drinks and
// addon-services catalogs (public.drinks / public.addon_services, managed
// from admin/catalog.html). Exposes window.loadCatalog(); on success the
// same globals the static files used to define (drinks, drinkCategories,
// addonServices) exist with identical field names, so the renderers only
// changed their entry point. Plain REST fetch - no supabase-js needed.
(function () {
  const SB_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
  const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseHV0c3Vmcm9iem92ZHNpZWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDc3MDQsImV4cCI6MjA5MTQ4MzcwNH0.EY2j3lZRmfGlWcTTNy9CMIHZX1E-2jit11jZwP7UOJo';
  const HEADERS = { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON };

  // Category labels are translation strings, not data - they stay in code.
  const CATEGORY_LABELS = {
    bg: ['Шампанско', 'Вино', 'Алкохол & Уиски', 'Безалкохолно', 'Вода'],
    en: ['Champagne', 'Wine', 'Spirits & Whisky', 'Soft Drinks', 'Water'],
  };

  function resolveImg(img) {
    if (!img || /^(https?:)?\//.test(img) || /^assets\//.test(img)) return img;
    return SB_URL + '/storage/v1/object/public/catalog-images/' + img;
  }

  async function fetchTable(pathAndQuery) {
    const res = await fetch(SB_URL + '/rest/v1/' + pathAndQuery, { headers: HEADERS });
    if (!res.ok) throw new Error('catalog fetch failed: HTTP ' + res.status);
    return res.json();
  }

  let cached = null;
  window.loadCatalog = function loadCatalog() {
    if (!cached) {
      cached = Promise.all([
        fetchTable('drinks?select=id,cat,name_bg,name_en,price_eur,img&active=is.true&order=cat.asc,sort_order.asc'),
        fetchTable('addon_services?select=id,name_bg,name_en,price_eur,hint_bg,hint_en,free_until,max_qty,img&active=is.true&order=sort_order.asc'),
      ]).then(function (results) {
        window.drinkCategories = CATEGORY_LABELS;
        window.drinks = results[0].map(function (r) {
          return { id: r.id, cat: Number(r.cat), name_bg: r.name_bg, name_en: r.name_en,
                   price_eur: r.price_eur == null ? null : Number(r.price_eur), img: resolveImg(r.img) };
        });
        window.addonServices = results[1].map(function (r) {
          const o = { id: r.id, name_bg: r.name_bg, name_en: r.name_en,
                      price: Number(r.price_eur), img: resolveImg(r.img) };
          if (r.hint_bg) o.hint_bg = r.hint_bg;
          if (r.hint_en) o.hint_en = r.hint_en;
          if (r.free_until != null) o.freeUntil = Number(r.free_until);
          if (r.max_qty != null) o.maxQty = Number(r.max_qty);
          return o;
        });
        return { drinks: window.drinks, addonServices: window.addonServices };
      }).catch(function (err) {
        cached = null;   // allow a retry on the next call
        throw err;
      });
    }
    return cached;
  };
})();
```

- [ ] **Step 2: Verify + commit**

```bash
node --check website/js/catalog-db.js
git checkout -b feat/catalog-switch
git add website/js/catalog-db.js
git commit -m "feat(site): DB-backed catalog loader"
```

### Task 9: switch menu / drinks / services pages

**Files:**
- Modify: `website/js/menu.js` (entry, lines 4-6 and 54-56), `website/js/drinks.js` (entry, lines 1-4 and 48-50), `website/js/services.js` (bottom, lines 272-275)
- Modify: `website/menu.html` (line 247), `website/drinks.html` (line 152), `website/services.html` (line 228)

**Interfaces:**
- Consumes: `window.loadCatalog()` from Task 8.

- [ ] **Step 1: menu.js** — replace the guard + trailing render calls so rendering waits for the catalog and the baked `#menu-sections` HTML survives a failed fetch:

Replace `if (!root || typeof drinks === 'undefined' || typeof drinkCategories === 'undefined') return;` with `if (!root) return;`, and replace the trailing

```js
  render();
  document.addEventListener('langChange', render);
```

with

```js
  window.loadCatalog().then(() => {
    render();
    document.addEventListener('langChange', render);
  }).catch(err => console.warn('catalog load failed - keeping baked menu:', err));
```

- [ ] **Step 2: drinks.js** — same pattern; this page has no baked fallback, so show a message. Replace the trailing

```js
  render();
  document.addEventListener('langChange', render);
```

with

```js
  window.loadCatalog().then(() => {
    render();
    document.addEventListener('langChange', render);
  }).catch(err => {
    console.warn('catalog load failed:', err);
    const lang = localStorage.getItem('margel_lang') || 'bg';
    grid.textContent = lang === 'bg'
      ? 'Менюто не можа да се зареди. Моля, презаредете страницата.'
      : 'The menu could not be loaded. Please reload the page.';
  });
```

- [ ] **Step 3: services.js** — replace the bottom three lines (`const lang = …; renderServices(lang); document.addEventListener('langChange', …)`) with:

```js
window.loadCatalog().then(() => {
  renderServices(localStorage.getItem('margel_lang') || 'bg');
}).catch(err => console.warn('catalog load failed - keeping baked services grid:', err));
document.addEventListener('langChange', e => renderServices(e.detail.lang));
```

(`renderServices` already guards `typeof addonServices === 'undefined'`, and `renderGroupCard` already skips missing variant ids and returns null when a whole group is gone — hidden items degrade cleanly. Manager-created services render as single cards; `descFor()` returns `''` for unknown ids, which is fine.)

- [ ] **Step 4: HTML script swaps**
  - `menu.html:247`: `<script src="js/drinks-data.js?v=7"></script>` → `<script src="js/catalog-db.js?v=1"></script>`; bump `js/menu.js?v=2` → `?v=3`.
  - `drinks.html:152`: same swap; bump `js/drinks.js?v=1` → `?v=2`.
  - `services.html:228`: `<script src="js/reservation-catalog.js?v=2"></script>` → `<script src="js/catalog-db.js?v=1"></script>` (services.js only needs `addonServices`); bump `js/services.js?v=2` → `?v=3`.

- [ ] **Step 5: Verify + commit**

```bash
node --check website/js/menu.js website/js/drinks.js website/js/services.js
git add website/js/menu.js website/js/drinks.js website/js/services.js website/menu.html website/drinks.html website/services.html
git commit -m "feat(site): menu/drinks/services render from the DB catalog"
```

### Task 10: switch the reservation wizard

**Files:**
- Modify: `website/js/reservation.js` (lines 15-20, line 1300), `website/reservation.html` (error block + script tags, lines 379-381)

- [ ] **Step 1: reservation.js caps from the catalog** — replace lines 15-20 (`const ADDON_MAX_QTY…` through `function addonMaxQty…`) with:

```js
// Addons that use a +/- typeable qty input instead of an on/off toggle.
// Inventory caps come from the catalog's max_qty column (admin-editable);
// furniture uses freeUntil. Everything else is an on/off checkbox.
function isQtyAddon(svc) { return svc.freeUntil != null || svc.maxQty != null; }
function addonMaxQty(svc) { return svc.maxQty ?? 999; }
```

- [ ] **Step 2: gate the init on the catalog** — replace the opening of the `DOMContentLoaded` handler (line 1300) so it reads:

```js
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.loadCatalog();   // populates drinks/drinkCategories/addonServices globals
  } catch (err) {
    console.error('catalog load failed:', err);
    showCatalogError();
    return;
  }
  await loadOccupiedDates();   // fetch occupied dates before flatpickr initialises
  ...rest of the existing handler body unchanged...
});
```

and add above the handler:

```js
// The wizard cannot run without the catalog - prices and steppers would be
// wrong. Hide the steps and show a reload prompt instead of a broken form.
function showCatalogError() {
  document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
  const progress = document.querySelector('.wizard-progress');
  if (progress) progress.style.display = 'none';
  const box = document.getElementById('catalog-error');
  if (!box) return;
  if (getLang() === 'en') {
    document.getElementById('catalog-error-msg').textContent = 'The service catalog could not be loaded. Please try again.';
    document.getElementById('catalog-error-retry').textContent = 'Try again';
  }
  box.hidden = false;
  document.getElementById('catalog-error-retry').addEventListener('click', () => window.location.reload());
}
```

- [ ] **Step 3: reservation.html** — inside the wizard container, directly after the `.wizard-progress` block (around line 145), add:

```html
        <div id="catalog-error" hidden style="text-align:center;padding:60px 20px">
          <p id="catalog-error-msg" style="margin-bottom:18px">Каталогът с услуги не можа да се зареди. Моля, опитайте отново.</p>
          <button type="button" class="btn btn-primary" id="catalog-error-retry">Опитайте отново</button>
        </div>
```

Script tags (lines 379-381): bump `js/reservation-catalog.js?v=2` → `?v=3` (stripped in Task 12); replace the `drinks-data.js?v=7` line with `<script src="js/catalog-db.js?v=1"></script>`; bump `js/reservation.js?v=24` → `?v=25`.

- [ ] **Step 4: Verify + commit**

```bash
node --check website/js/reservation.js
git add website/js/reservation.js website/reservation.html
git commit -m "feat(site): wizard loads the DB catalog, catalog-error state"
```

### Task 11: switch the customer edit page (with grandfathered items)

**Files:**
- Modify: `website/js/edit.js` (lines 25-29, `main()`, `renderAddons()`, `seedDrinkQtys()`, `renderDrinks()`, `onSave()`), `website/edit.html` (new error spread, legacy drinks list, script tags lines 170-171)

**Interfaces:**
- Consumes: `window.loadCatalog()`. Grandfather contract with Task 16: items missing/inactive in the catalog are sent **unchanged** (addons) or with **decreased-only qty** (drinks).

- [ ] **Step 1: caps from the catalog** — replace lines 25-29 (`const ADDON_MAX_QTY…` through `function addonMaxQty…`) with the same two functions as Task 10 Step 1 (keep the same comment).

- [ ] **Step 2: gate `main()` on the catalog** — at the top of `main()` (before the `params` line), insert:

```js
  try {
    await window.loadCatalog();   // populates addonServices/drinks globals
  } catch (err) {
    console.error('catalog load failed:', err);
    show('state-catalog-error');
    return;
  }
```

(This covers admin mode too since `mainAdmin` is called from `main`.) Add a delegated retry handler next to the existing bottom-of-file `DOMContentLoaded` registration:

```js
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btn-catalog-retry') window.location.reload();
});
```

- [ ] **Step 3: render grandfathered addons** — at the end of `renderAddons()`, after the `addonServices.forEach(…)` loop, append:

```js
  // Grandfathered addons: saved on the enquiry but no longer in the catalog
  // (deleted/hidden by the manager). Rendered from the payload snapshot as
  // keep-or-remove cards - the server accepts them only unchanged.
  const knownAddonIds = new Set(addonServices.map(s => s.id));
  (state.enquiry.addons ?? []).filter(a => !knownAddonIds.has(a.id)).forEach(a => {
    const qty = state.addonQtys[a.id] || 0;
    const li = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'addon-card' + (qty > 0 ? ' is-selected' : '');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = qty > 0;
    const info = document.createElement('span');
    info.className = 'addon-card__info';
    info.innerHTML = `
      <span class="addon-card__name">${esc(a.name)}</span>
      <span class="addon-card__price">€${Math.round(Number(a.price) || 0)}</span>
      <span class="addon-card__hint">Вече не се предлага - може да я запазите или премахнете</span>
    `;
    label.append(input, info);
    input.addEventListener('change', () => {
      state.addonQtys[a.id] = input.checked ? (Number(a.qty) > 0 ? Number(a.qty) : 1) : 0;
      label.classList.toggle('is-selected', input.checked);
    });
    li.appendChild(label);
    grid.appendChild(li);
  });
```

- [ ] **Step 4: don't clamp grandfathered drinks in `seedDrinkQtys()`** — replace its forEach body with:

```js
  (state.enquiry.drinks ?? []).forEach(d => {
    const cat = pool.find(x => x.id === d.id)?.cat;
    // Unknown id = removed from the catalog: keep the stored qty untouched
    // (the server only allows decreases for grandfathered drinks).
    const max = cat == null ? (Number(d.qty) || 0) : (cat >= 3 ? 200 : 100);
    state.drinkQtys[d.id] = Math.min(Number(d.qty) || 0, max);
  });
```

- [ ] **Step 5: render grandfathered drinks** — change `renderDrinks()` to:

```js
function renderDrinks() {
  renderDrinkTabs();
  renderDrinkTiles();
  renderLegacyDrinks();
}
```

and add:

```js
// Saved drinks that are no longer in the catalog: shown above the picker so
// the customer can keep, reduce or remove them (qty can only go down - the
// stored quantity is the cap the server enforces).
function renderLegacyDrinks() {
  const grid = $('drinks-legacy');
  if (!grid) return;
  grid.innerHTML = '';
  const pool = typeof drinks !== 'undefined' ? drinks : [];
  const known = new Set(pool.map(d => d.id));
  const legacy = (Array.isArray(state.enquiry.drinks) ? state.enquiry.drinks : [])
    .filter(d => !known.has(d.id));
  grid.hidden = legacy.length === 0;
  legacy.forEach(d => {
    const savedQty = Number(d.qty) || 0;
    const qty = state.drinkQtys[d.id] ?? 0;
    const li = document.createElement('li');
    li.className = 'drink-tile' + (qty > 0 ? ' has-qty' : '');
    const body = document.createElement('span');
    body.className = 'drink-tile__body';
    const name = document.createElement('span');
    name.className = 'drink-tile__name';
    name.textContent = `${d.name} (вече не се предлага)`;
    const price = document.createElement('span');
    price.className = 'drink-tile__price';
    price.textContent = d.price_eur != null ? `€${Number(d.price_eur).toFixed(2)}` : 'По запитване';
    const qtyWrap = document.createElement('span');
    qtyWrap.className = 'drink-qty';
    const minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Намали');
    const num = document.createElement('input');
    num.type = 'number'; num.min = '0'; num.max = String(savedQty); num.step = '1';
    num.inputMode = 'numeric'; num.value = qty;
    num.setAttribute('aria-label', 'Количество');
    const plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Увеличи');
    qtyWrap.append(minus, num, plus);
    body.append(name, price, qtyWrap);
    li.appendChild(body);
    grid.appendChild(li);
    function setQty(next) {
      const n = Math.max(0, Math.min(savedQty, Math.floor(Number(next) || 0)));
      state.drinkQtys[d.id] = n;
      num.value = n;
      li.classList.toggle('has-qty', n > 0);
    }
    minus.addEventListener('click', () => setQty((state.drinkQtys[d.id] || 0) - 1));
    plus.addEventListener('click',  () => setQty((state.drinkQtys[d.id] || 0) + 1));
    num.addEventListener('input', () => setQty(num.value));
    num.addEventListener('blur',  () => { if (num.value === '' || isNaN(Number(num.value))) setQty(0); });
  });
}
```

- [ ] **Step 6: send grandfathered addons in `onSave()`** — after the `addonServices.forEach(…)` block that builds `addons` (and BEFORE the mandatory-cleaning block), insert:

```js
  // Grandfathered addons - send the stored line unchanged; the server
  // rejects any modification to items no longer in the catalog.
  const knownAddonIds = new Set(addonServices.map(s => s.id));
  (state.enquiry.addons ?? []).forEach(a => {
    if (knownAddonIds.has(a.id)) return;
    if ((state.addonQtys[a.id] || 0) <= 0) return;   // customer removed it
    addons.push({ ...a });
  });
```

(The existing drinks fallback in `onSave` already carries unknown drinks via `{ ...orig, qty }` — no change needed there.)

- [ ] **Step 7: edit.html** — add the error spread after `#state-locked` (line ~64):

```html
      <section class="spread state-page" id="state-catalog-error" hidden>
        <div class="state-stage">
          <p class="label-caps">- грешка -</p>
          <h1 class="display display-xl">Нещо се <em>обърка</em>.</h1>
          <p class="lead">Каталогът с услуги не можа да се зареди. Моля, опитайте отново.</p>
          <hr class="rule-gold">
          <button id="btn-catalog-retry" type="button" class="link link--underline">Презареди страницата</button>
        </div>
      </section>
```

(Match the exact inner markup pattern of the sibling `#state-not-found` section when writing it.) Inside `#drinks-panel` (line 115), add the legacy list above the tabs:

```html
            <div id="drinks-panel" hidden>
              <ul class="drinks-list" id="drinks-legacy" hidden></ul>
              <nav class="drinks-nav" id="drinks-tabs" role="tablist"></nav>
              <ul class="drinks-list" id="drinks-grid"></ul>
            </div>
```

Script tags: replace lines 170-171 (`reservation-catalog.js?v=2` and `drinks-data.js?v=7`) with the single `<script src="js/catalog-db.js?v=1"></script>` (edit.js uses no `eventTypes`); bump `js/edit.js?v=13` → `?v=14`.

- [ ] **Step 8: Verify + commit**

```bash
node --check website/js/edit.js
git add website/js/edit.js website/edit.html
git commit -m "feat(site): edit page loads DB catalog, grandfathers removed items"
```

### Task 12: remove the static catalogs

**Files:**
- Delete: `website/js/drinks-data.js`
- Modify: `website/js/reservation-catalog.js` (remove the whole `addonServices` array, lines 44-88, and its comment block)

- [ ] **Step 1:**

```bash
git rm website/js/drinks-data.js
```

Edit `reservation-catalog.js`: delete from `// ── Paid add-on services…` (line 44) to the closing `];` of `addonServices` (line 88). Add in its place:

```js
// Paid add-on services moved to the public.addon_services table (loaded by
// js/catalog-db.js, managed from admin/catalog.html).
```

- [ ] **Step 2: Confirm nothing else references the deleted file**

Run: `grep -rn "drinks-data" website/ --include="*.html" --include="*.js"`
Expected: no matches. (Comment mentions inside edge functions get cleaned in Tasks 14-17.)

- [ ] **Step 3: Verify + commit**

```bash
node --check website/js/reservation-catalog.js
git add -A website/js
git commit -m "refactor(site): drop static drink/addon catalogs"
```

### Task 13: `_shared/catalog.ts` (TDD)

**Files:**
- Create: `supabase/functions/_shared/catalog.test.ts`
- Create: `supabase/functions/_shared/catalog.ts`

**Interfaces:**
- Produces (consumed by Tasks 15-17):
  - `loadCatalog(sb): Promise<Catalog>` where `Catalog = { drinks: Map<string, CatalogDrink>; addons: Map<string, CatalogAddon> }`
  - `repriceDrinks(items: DrinkItem[], catalog: Catalog, stored?: DrinkItem[]): RepriceResult<DrinkItem>`
  - `repriceAddons(items: AddonItem[], catalog: Catalog, stored?: AddonItem[]): RepriceResult<AddonItem>`
  - `DrinkItem = { id; name; qty; price_eur: number|null }`, `AddonItem = { id; name; price; qty? }`, `RepriceResult<T> = { ok: true; value: T[] } | { ok: false; error: string }`

- [ ] **Step 1: Write the failing tests**

```ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { repriceAddons, repriceDrinks, type Catalog } from "./catalog.ts";

function cat(): Catalog {
  return {
    drinks: new Map([
      ["moet",  { id: "moet",  cat: 0, name_en: "Moët & Chandon Brut", price_eur: 62.38, active: true }],
      ["cola",  { id: "cola",  cat: 3, name_en: "Coca-Cola 0.33L",     price_eur: 1.07,  active: true }],
      ["gone",  { id: "gone",  cat: 2, name_en: "Old Whisky",          price_eur: 30,    active: false }],
    ]),
    addons: new Map([
      ["dj",        { id: "dj",        name_en: "DJ for 5 hours",   price_eur: 300, free_until: null, max_qty: null, active: true }],
      ["cleaning",  { id: "cleaning",  name_en: "Hall cleaning",    price_eur: 70,  free_until: null, max_qty: null, active: true }],
      ["heater",    { id: "heater",    name_en: "Gas patio heater", price_eur: 74,  free_until: null, max_qty: 2,    active: true }],
      ["bar_stool", { id: "bar_stool", name_en: "Bar stool",        price_eur: 5,   free_until: 40,   max_qty: null, active: true }],
    ]),
  };
}

Deno.test("repriceDrinks: overrides tampered price and name from the catalog", () => {
  const r = repriceDrinks([{ id: "moet", name: "hacked", qty: 2, price_eur: 0.01 }], cat());
  assertEquals(r, { ok: true, value: [{ id: "moet", name: "Moët & Chandon Brut", qty: 2, price_eur: 62.38 }] });
});

Deno.test("repriceDrinks: per-category caps (soft 200 / alcoholic 100)", () => {
  assertEquals(repriceDrinks([{ id: "cola", name: "x", qty: 200, price_eur: null }], cat()).ok, true);
  assertEquals(repriceDrinks([{ id: "cola", name: "x", qty: 201, price_eur: null }], cat()).ok, false);
  assertEquals(repriceDrinks([{ id: "moet", name: "x", qty: 101, price_eur: null }], cat()).ok, false);
});

Deno.test("repriceDrinks: unknown id rejected at submit (no stored)", () => {
  assertEquals(repriceDrinks([{ id: "nope", name: "x", qty: 1, price_eur: 5 }], cat()).ok, false);
});

Deno.test("repriceDrinks: inactive item grandfathered from stored, decrease only", () => {
  const stored = [{ id: "gone", name: "Old Whisky", qty: 5, price_eur: 25 }];
  const keep = repriceDrinks([{ id: "gone", name: "Old Whisky", qty: 3, price_eur: 25 }], cat(), stored);
  assertEquals(keep, { ok: true, value: [{ id: "gone", name: "Old Whisky", qty: 3, price_eur: 25 }] });
  assertEquals(repriceDrinks([{ id: "gone", name: "Old Whisky", qty: 6, price_eur: 25 }], cat(), stored).ok, false);
});

Deno.test("repriceDrinks: duplicate ids rejected", () => {
  const items = [{ id: "cola", name: "x", qty: 1, price_eur: null }, { id: "cola", name: "x", qty: 2, price_eur: null }];
  assertEquals(repriceDrinks(items, cat()).ok, false);
});

Deno.test("repriceAddons: toggle addon gets catalog unit price, no qty", () => {
  const r = repriceAddons([{ id: "dj", name: "hacked", price: 1 }], cat());
  assertEquals(r, { ok: true, value: [{ id: "dj", name: "DJ for 5 hours", price: 300 }] });
});

Deno.test("repriceAddons: qty addon line price + max_qty cap", () => {
  const ok = repriceAddons([{ id: "heater", name: "x", price: 0, qty: 2 }], cat());
  assertEquals(ok, { ok: true, value: [{ id: "heater", name: "Gas patio heater", price: 148, qty: 2 }] });
  assertEquals(repriceAddons([{ id: "heater", name: "x", price: 0, qty: 3 }], cat()).ok, false);
});

Deno.test("repriceAddons: furniture bills only above free_until", () => {
  const r = repriceAddons([{ id: "bar_stool", name: "x", price: 999, qty: 42 }], cat());
  assertEquals(r, { ok: true, value: [{ id: "bar_stool", name: "Bar stool", price: 10, qty: 42 }] });
});

Deno.test("repriceAddons: unknown id rejected at submit, grandfathered unchanged on update", () => {
  assertEquals(repriceAddons([{ id: "nope", name: "x", price: 50 }], cat()).ok, false);
  const stored = [{ id: "nope", name: "Old svc", price: 50, qty: 2 }];
  assertEquals(repriceAddons([{ id: "nope", name: "Old svc", price: 50, qty: 2 }], cat(), stored),
    { ok: true, value: [{ id: "nope", name: "Old svc", price: 50, qty: 2 }] });
  assertEquals(repriceAddons([{ id: "nope", name: "Old svc", price: 50, qty: 1 }], cat(), stored).ok, false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/angelborisov/dev/margel360/supabase/functions/_shared && deno test catalog.test.ts`
Expected: FAIL — `Module not found "./catalog.ts"`.

- [ ] **Step 3: Implement `catalog.ts`**

```ts
// Catalog lookups + server-side repricing for enquiry items. The
// public.drinks / public.addon_services tables are the single source of
// truth for prices - client-sent prices are recomputed here so a tampered
// payload can never store a price the catalog doesn't back.
//
// Grandfathering (update paths): an item that is missing or inactive in the
// catalog but exists in the STORED enquiry is kept at its stored values -
// drinks may only decrease qty, addons must be unchanged. Without this,
// deactivating an item would 400 every edit of bookings that contain it.

export type CatalogDrink = { id: string; cat: number; name_en: string; price_eur: number; active: boolean };
export type CatalogAddon = { id: string; name_en: string; price_eur: number; free_until: number | null; max_qty: number | null; active: boolean };
export type Catalog = { drinks: Map<string, CatalogDrink>; addons: Map<string, CatalogAddon> };

export type DrinkItem = { id: string; name: string; qty: number; price_eur: number | null };
export type AddonItem = { id: string; name: string; price: number; qty?: number };
export type RepriceResult<T> = { ok: true; value: T[] } | { ok: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

// deno-lint-ignore no-explicit-any
export async function loadCatalog(sb: any): Promise<Catalog> {
  const [dRes, aRes] = await Promise.all([
    sb.from("drinks").select("id, cat, name_en, price_eur, active"),
    sb.from("addon_services").select("id, name_en, price_eur, free_until, max_qty, active"),
  ]);
  if (dRes.error) throw new Error(`drinks catalog load failed: ${dRes.error.message}`);
  if (aRes.error) throw new Error(`addon catalog load failed: ${aRes.error.message}`);
  return {
    drinks: new Map((dRes.data ?? []).map((r: CatalogDrink) =>
      [r.id, { ...r, cat: Number(r.cat), price_eur: Number(r.price_eur) }])),
    addons: new Map((aRes.data ?? []).map((r: CatalogAddon) =>
      [r.id, { ...r, price_eur: Number(r.price_eur) }])),
  };
}

export function repriceDrinks(items: DrinkItem[], catalog: Catalog, stored: DrinkItem[] = []): RepriceResult<DrinkItem> {
  const storedById = new Map(stored.map((d) => [d.id, d]));
  const seen = new Set<string>();
  const out: DrinkItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) return { ok: false, error: `drink ${item.id}: duplicate` };
    seen.add(item.id);
    const c = catalog.drinks.get(item.id);
    if (c && c.active) {
      const max = c.cat >= 3 ? 200 : 100;
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > max) {
        return { ok: false, error: `drink ${item.id}: qty must be 1..${max}` };
      }
      out.push({ id: item.id, name: c.name_en, qty: item.qty, price_eur: round2(c.price_eur) });
      continue;
    }
    const prev = storedById.get(item.id);
    if (!prev) return { ok: false, error: `drink ${item.id}: unknown item` };
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > (Number(prev.qty) || 0)) {
      return { ok: false, error: `drink ${item.id}: no longer offered - qty can only decrease` };
    }
    out.push({ id: prev.id, name: prev.name, qty: item.qty, price_eur: prev.price_eur ?? null });
  }
  return { ok: true, value: out };
}

export function repriceAddons(items: AddonItem[], catalog: Catalog, stored: AddonItem[] = []): RepriceResult<AddonItem> {
  const storedById = new Map(stored.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const out: AddonItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) return { ok: false, error: `addon ${item.id}: duplicate` };
    seen.add(item.id);
    const c = catalog.addons.get(item.id);
    if (c && c.active) {
      const isQty = c.free_until != null || c.max_qty != null;
      if (isQty) {
        const qty = Number(item.qty);
        const max = c.max_qty ?? 999;
        if (!Number.isInteger(qty) || qty < 1 || qty > max) {
          return { ok: false, error: `addon ${item.id}: qty must be 1..${max}` };
        }
        const line = c.free_until != null
          ? Math.max(0, qty - c.free_until) * c.price_eur
          : qty * c.price_eur;
        out.push({ id: item.id, name: c.name_en, price: round2(line), qty });
      } else {
        out.push({ id: item.id, name: c.name_en, price: round2(c.price_eur) });
      }
      continue;
    }
    const prev = storedById.get(item.id);
    if (!prev) return { ok: false, error: `addon ${item.id}: unknown item` };
    if (Number(prev.qty ?? 0) !== Number(item.qty ?? 0)) {
      return { ok: false, error: `addon ${item.id}: no longer offered - cannot change quantity` };
    }
    out.push({ ...prev });
  }
  return { ok: true, value: out };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `deno test catalog.test.ts`
Expected: `ok | 10 passed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/catalog.ts supabase/functions/_shared/catalog.test.ts
git commit -m "feat(fn): shared catalog repricing module (TDD)"
```

### Task 14: validate.ts — drop the hardcoded drink-id set

**Files:**
- Modify: `supabase/functions/_shared/validate.ts` (lines 10-17, 82-85)
- Modify: `supabase/functions/_shared/validate.test.ts` (drink-cap tests)

- [ ] **Step 1:** Delete lines 10-17 (`NON_ALCOHOLIC_DRINK_IDS` + `maxDrinkQty`) and replace with:

```ts
// Absolute drink-qty bound. The real per-category caps (non-alcoholic 200 /
// alcoholic 100) are enforced against the public.drinks catalog by the
// callers via _shared/catalog.ts repriceDrinks().
const MAX_DRINK_QTY = 200;
```

In the `drinks` case, replace the two `dqMax` lines with:

```ts
        if (!Number.isInteger(o.qty) || (o.qty as number) < 0 || (o.qty as number) > MAX_DRINK_QTY) {
          return { ok: false, error: `drink.qty must be an integer 0..${MAX_DRINK_QTY}` };
        }
```

- [ ] **Step 2:** In `validate.test.ts`, find the drink-qty tests (grep `maxDrinkQty\|qty` in the drinks tests) and update any assertion that an alcoholic drink id caps at 100 — the shape validator now allows 0..200 for any id; add/keep a test that qty 201 fails and qty 200 passes regardless of id.

- [ ] **Step 3: Run + commit**

```bash
deno test validate.test.ts && deno test catalog.test.ts
git add supabase/functions/_shared/validate.ts supabase/functions/_shared/validate.test.ts
git commit -m "refactor(fn): drink category caps move from validate.ts to catalog repricing"
```

### Task 15: submit-enquiry reprices from the catalog

**Files:**
- Modify: `supabase/functions/submit-enquiry/index.ts`

- [ ] **Step 1:** Add to the imports (next to `weekdayPromoPercent`):

```ts
import { loadCatalog, repriceAddons, repriceDrinks } from "../_shared/catalog.ts";
```

- [ ] **Step 2:** Delete the inline `NON_ALCOHOLIC_DRINK_IDS` set + `maxDrinkQty` (lines 95-102) and in `validateDrinks` change `qty > maxDrinkQty(id)` to `qty > 200`.

- [ ] **Step 3:** After the `partner_ids` validation block (line ~251) insert:

```ts
  // Reprice every item from the catalog tables - client-sent prices are
  // never trusted. Unknown/hidden items 400 (the shopper refreshes).
  let catalog;
  try {
    catalog = await loadCatalog(sb);
  } catch (e) {
    console.error("catalog load failed:", e);
    return json({ error: "server_error" }, 500);
  }
  const repricedAddons = repriceAddons(addons, catalog);
  if (!repricedAddons.ok) return json({ error: "invalid_field", field: "addons", detail: repricedAddons.error }, 400);
  const repricedDrinks = repriceDrinks(drinks, catalog);
  if (!repricedDrinks.ok) return json({ error: "invalid_field", field: "drinks", detail: repricedDrinks.error }, 400);
```

and in the `row` object change `addons, drinks` to `addons: repricedAddons.value, drinks: repricedDrinks.value`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/submit-enquiry/index.ts
git commit -m "feat(fn): submit-enquiry reprices items from the catalog"
```

### Task 16: update-enquiry-by-token — reprice + grandfather

**Files:**
- Modify: `supabase/functions/update-enquiry-by-token/index.ts`

- [ ] **Step 1:** Add the same import as Task 15 Step 1. After the `if (!Object.keys(patch).length)` guard (line 83), insert:

```ts
  // Reprice edited items from the catalog; items removed from the catalog
  // since booking are grandfathered against the stored enquiry (see
  // _shared/catalog.ts).
  if ("addons" in patch || "drinks" in patch) {
    let catalog;
    try {
      catalog = await loadCatalog(sb);
    } catch (e) {
      console.error("catalog load failed:", e);
      return json({ error: "server_error" }, 500);
    }
    if ("addons" in patch) {
      const r = repriceAddons(patch.addons as never[], catalog, (current.addons ?? []) as never[]);
      if (!r.ok) return json({ error: "invalid_field", field: "addons", detail: r.error }, 400);
      patch.addons = r.value;
    }
    if ("drinks" in patch) {
      const r = repriceDrinks(patch.drinks as never[], catalog, (current.drinks ?? []) as never[]);
      if (!r.ok) return json({ error: "invalid_field", field: "drinks", detail: r.error }, 400);
      patch.drinks = r.value;
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/update-enquiry-by-token/index.ts
git commit -m "feat(fn): customer edits reprice from catalog with grandfathering"
```

### Task 17: update-enquiry-admin + dashboard drink caps

**Files:**
- Modify: `supabase/functions/update-enquiry-admin/index.ts`
- Modify: `website/admin/js/dashboard.js` (lines ~896-904 and the `DOMContentLoaded` handler at line 41), `website/admin/dashboard.html` (bump `js/dashboard.js?v=` by one)

- [ ] **Step 1: update-enquiry-admin** — add the Task 15 import (this function CAN import `../_shared/` — deploys use `--use-api` which bundles them, same as the existing `weekday-promo` import in submit-enquiry). Delete its inline `NON_ALCOHOLIC_DRINK_IDS` + `maxDrinkQty` (lines 50-57); in its inline `validateField` drinks case change `maxDrinkQty(o.id as string)` to `200`. After the `if (!Object.keys(patch).length)` guard, insert the same reprice block as Task 16 Step 1 (using `sbAdmin` instead of `sb`).

- [ ] **Step 2: dashboard.js** — replace the `NON_ALCOHOLIC_DRINK_IDS` block (lines ~896-904) with:

```js
// Drink categories come from the public.drinks catalog now (admin
// Каталог page). cat 3-4 (soft drinks + water) cap at 200, everything
// else 100; ids removed from the catalog get the conservative 100.
let drinkCatById = new Map();
async function loadDrinkCats() {
  const { data, error } = await db.from('drinks').select('id, cat');
  if (error) { console.error('drink catalog load failed:', error); return; }
  drinkCatById = new Map((data || []).map(r => [r.id, Number(r.cat)]));
}
function maxDrinkQty(id) { return (drinkCatById.get(id) ?? 0) >= 3 ? 200 : 100; }
```

In the `DOMContentLoaded` handler (line 41), after `const session = await requireAuth(); if (!session) return;` add:

```js
  loadDrinkCats();   // fire-and-forget; caps fall back to 100 until loaded
```

- [ ] **Step 3: Verify + commit**

```bash
node --check website/admin/js/dashboard.js
git add supabase/functions/update-enquiry-admin/index.ts website/admin/js/dashboard.js website/admin/dashboard.html
git commit -m "feat(admin): admin edit path reprices from catalog; dashboard caps from DB"
```

### Task 18: CLAUDE.md + docs sync

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1:** Apply these updates:
- **File structure** section: mention `admin/catalog` page and that drinks/addon catalogs live in `public.drinks` / `public.addon_services` loaded via `js/catalog-db.js`; note `reservation-catalog.js` now carries only eventTypes/venueIncluded/includedLabels.
- **Sync map**: delete the "Drink qty caps" row's id-set instruction and the "Addon inventory caps" row; replace with one row: `Catalog items & caps | public.drinks (cat drives 200/100 caps), public.addon_services (max_qty, free_until) | admin/catalog.html; _shared/catalog.ts reprices server-side; validate.ts keeps absolute 0..200 bound`.
- **Payload shapes** note: add "server reprices every item from the catalog; grandfathered items (removed from catalog after booking) keep stored values — drinks decrease-only, addons unchanged".
- **Baked static content** note: add "prices in baked blocks can drift after manager edits — regenerate occasionally; the runtime replaces them so users always see DB prices".
- **DB facts**: add the two tables, `catalog-images` bucket, and the cleaning-guard trigger.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: catalog tables in CLAUDE.md sync map and DB facts"
```

### Task 19: deploy, verify end-to-end, open PR 3

- [ ] **Step 1: Deploy the three functions** (backward-compatible with the still-static site — the seeded catalog matches the files exactly, so deploy BEFORE the PR merges):

```bash
supabase functions deploy submit-enquiry --project-ref wlxutsufrobzovdsiecb --use-api --no-verify-jwt
supabase functions deploy update-enquiry-by-token --project-ref wlxutsufrobzovdsiecb --use-api --no-verify-jwt
supabase functions deploy update-enquiry-admin --project-ref wlxutsufrobzovdsiecb --use-api
```

- [ ] **Step 2: Pre-merge smoke on the live (still static) site** — submit a test enquiry on margel360.bg with 1 addon + 2 drinks; confirm it succeeds and the stored `addons`/`drinks` rows carry catalog prices/names (check in dashboard). This proves the deployed reprice path before the frontend switches.

- [ ] **Step 3: Local walkthrough of the switched frontend** (`cd website && python3 -m http.server 8080`):
  - `menu.html`, `drinks.html`, `services.html`: render DB data in BG and EN; block the fetch (DevTools offline after page load, reload) → menu/services keep baked content, drinks page shows the reload message.
  - `reservation.html`: full wizard walkthrough BG + EN — steppers respect `max_qty`/`freeUntil`, cleaning auto-added, summary total matches step prices. (Final submit needs Turnstile — verify submission on production after merge.)
  - `edit.html?token=…` with a real test-enquiry token: form renders, drinks seeded, save round-trips; temporarily hide an item the enquiry contains via admin catalog → it renders as grandfathered (keep/remove), save still succeeds; un-hide it.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/catalog-switch
gh pr create --title "feat: public site + edge functions switch to the DB catalog" --body "The cutover per docs/superpowers/specs/2026-07-22-catalog-admin-design.md: catalog-db.js loader, static catalogs removed, server-side repricing with grandfathering, dashboard caps from DB. Requires PR-1 migration (applied) and the redeployed functions (done)."
```

- [ ] **Step 5: After Angel's go-ahead + merge:** on live margel360.bg run one real end-to-end enquiry (then delete it via dashboard), one admin price edit (verify it appears on menu.html within a reload), and an offer XLSX + PDF export on an existing enquiry. Confirm the confirmation/summary emails arrived with correct items.

---

## Plan Self-Review (done at write time)

- **Spec coverage:** data model + seed (T1-3), admin CRUD incl. cleaning guard + delete warning (T4-7), loader + same-shape globals + fallbacks (T8-12), server repricing + caps + grandfathering (T13-17), docs/sync map (T18), rollout/verification incl. deploy flags (T19). SEO decision needs no code (baked blocks untouched).
- **Type consistency:** client addon fields `price`/`freeUntil`/`maxQty` (loader maps from DB `price_eur`/`free_until`/`max_qty`); server types use DB names; `RepriceResult` shapes match between tests, impl, and call sites.
- **Known accepted gaps:** services-page `descFor()` has no text for manager-created items (empty description); XLSX unmapped warning covers new services; baked SEO price drift accepted per spec.
