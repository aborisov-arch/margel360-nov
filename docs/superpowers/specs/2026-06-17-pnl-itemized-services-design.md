# P&L — Itemized Additional Services & Aligned Categories

**Date:** 2026-06-17
**Surface:** `website/admin/financials.js` + `website/admin/financials.html` + Supabase migration
**Status:** Approved design, pending implementation plan

## Problem

Two issues in the admin Financials (per-event P&L) section:

1. **Focus-loss bug (FIXED separately in this branch).** Every keystroke in any P&L
   number field rebuilt the detail panel's `innerHTML`, destroying the focused
   `<input>`. The bookkeeper could enter one digit, then had to re-click the field.
   Fixed by splitting the derived-totals refresh (`updateDetailTotals()`) out of the
   full `renderDetail()`, and calling only the lightweight refresh from the live-typing
   path (`setFeDirty` / `setExpenseDirty`).

2. **Additional services are not itemizable (THIS SPEC).** On the income side,
   "Доп. услуги" is a single number — the admin cannot record *which* services were
   sold or break the figure down. On the expense side the category list has
   near-duplicates (`staff`/`employees`, `music`/`dj`) and lacks buckets that match the
   venue's actual service catalog.

## Goal

Let the bookkeeper record additional services as **multiple categorized line items**
on the income side (mirroring how expenses already work), and align/clean the expense
category list to the same buckets plus running-cost essentials — without losing any
existing income or expense data.

## Design

### Income side — itemized services

- Replace the single `income_addons_eur` input with a **line-item list** mirroring the
  existing expense-line UI: each line = **category dropdown + amount (€) + optional note
  + delete**, plus a **"+ Добави услуга"** add button.
- `income_addons_eur` is **retained as a cached sum** of the income items, recomputed on
  save, so the monthly summary and all downstream reads keep working unchanged.
- The existing fixed income lines — **Оферта, Напитки, DJ, Служители, Извънреден час** —
  stay as they are. (Per user decision: keep the DJ/Служители fixed fields; the slight
  overlap with the Музика/DJ and Персонал categories is acceptable — the admin picks
  whichever fits.)

**Income service categories (7):**

| id | Label (BG) | Covers (from `reservation-catalog.js`) |
|----|-----------|----------------------------------------|
| `photo_video`   | Фото/Видео            | photo2/4, booth2/4 |
| `decoration`    | Декорация             | wall_s/g, arch, decoration, candles_h/t, numbers |
| `pyro_lighting` | Пиро/Светлини         | flare_s/l, fountain_s/l, led, glow_table |
| `music_dj`      | Музика/DJ             | dj, mic |
| `furniture`     | Обзавеждане           | carpet_s/l, bar_stool, conf_chair, chiavari, *_table |
| `staff_service` | Персонал/Обслужване   | security, hygiene, wardrobe, valet, cleaning |
| `other`         | Други                 | anything else |

### Expense side — aligned categories

Replace `EXPENSE_CATS` with the 7 shared buckets **plus** running-cost essentials, with
duplicates merged:

| id | Label (BG) |
|----|-----------|
| `photo_video`   | Фото/Видео |
| `decoration`    | Декорация |
| `pyro_lighting` | Пиро/Светлини |
| `music_dj`      | Музика/DJ |
| `furniture`     | Обзавеждане |
| `staff_service` | Персонал/Заплати |
| `catering`      | Кетъринг |
| `drinks`        | Напитки/алкохол |
| `utilities`     | Сметки/комунални |
| `maintenance`   | Поддръжка |
| `marketing`     | Маркетинг/реклама |
| `other`         | Други |

**Old → new expense category remap (data migration):**

| Old id | New id |
|--------|--------|
| `staff` | `staff_service` |
| `employees` | `staff_service` |
| `music` | `music_dj` |
| `dj` | `music_dj` |
| `catering`, `drinks`, `decoration`, `maintenance`, `utilities`, `marketing`, `other` | unchanged |

`photo_video`, `pyro_lighting`, `furniture` are new (no existing rows reference them).

### Data model

New table **`financial_income_items`**, mirroring `financial_expenses`:

```
id            uuid pk default gen_random_uuid()
event_id      uuid references financial_events(id) on delete cascade
month         text
category      text not null default 'other'
amount_eur    numeric not null default 0
notes         text
created_at    timestamptz default now()
updated_at    timestamptz
```

- RLS: admin-only via `public.is_admin()`, same policy shape as `financial_expenses`.
- Loaded in `loadAll()` alongside expenses into an `incomeItemsByEvent` Map.

### Migration steps (one migration file)

1. `create table financial_income_items …` + RLS. **RLS gates on `public.is_admin()`**
   (the 6-email allowlist), matching `financial_events`/`financial_expenses` per
   `20260609120000` — NOT a blanket `USING(true)`, which would expose financial data
   to any authenticated user.
2. Seed: for every `financial_events` row with `income_addons_eur > 0`, insert one
   income item `{ event_id, month, category:'other', amount_eur: income_addons_eur }`
   so no existing add-on income is orphaned.
3. Remap existing expense categories: `update financial_expenses set category='staff_service' where category in ('staff','employees')`; `… set category='music_dj' where category in ('music','dj')`; then re-add the widened CHECK constraint.
4. `CREATE OR REPLACE` the `enquiries_auto_create_financial_event()` trigger fn so the
   pipeline auto-confirm path ALSO seeds one `financial_income_items` "Други" line when
   `b.addons > 0` (mirrors the JS `ensureFinancialEvent` seed). Without this,
   future auto-confirmed events would show €0 add-on income in the itemized UI.

### UI / code changes (`financials.js`)

- Add `INCOME_SERVICE_CATS` constant (the 7 income categories).
- Replace `EXPENSE_CATS` with the aligned 12-category list.
- Add `incomeItemsByEvent` state + load in `loadAll()`.
- Render the income-services list in `renderDetail()` (mirrors the expense-line render),
  driven by dirty-aware accessors; live total via `updateDetailTotals()`.
- Draft mutators for income items (mirror `setExpenseDirty`), plus add/delete handlers
  (mirror `addEventExpense` / `deleteExpense`).
- On save, write income-item changes and recompute `income_addons_eur` = sum of items.
- Monthly summary keeps reading `income_addons_eur` (unchanged "Доп. услуги" pill).

## Out of scope (YAGNI)

- Per-category income pills in the monthly summary (kept as one "Доп. услуги" total).
- Auto-filling income-item amounts from the booking-form add-on catalog.
- Retiring the fixed DJ / Служители income fields.

## Deploy notes

- Bump `financials.js?v=` in `financials.html` (cache rule).
- Apply the migration to Supabase project `wlxutsufrobzovdsiecb` **and** commit it to
  `supabase/migrations/` (keep live + repo in sync).
- `node --check` the JS before push.
