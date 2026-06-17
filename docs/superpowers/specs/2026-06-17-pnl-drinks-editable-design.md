# P&L — Editable, Auto-Priced Drinks + Missing Photos

**Date:** 2026-06-17
**Surface:** `website/admin/financials.{html,js}` + `website/admin/css/financials.css` + `website/js/drinks-data.js` + Supabase migration
**Status:** Approved design, implementing

## Problem

1. **Missing photos:** 3 catalog drinks show a 1251-byte placeholder instead of a real
   bottle photo: plain *Le Rosé Katarzyna*, *Château Miraval Rosé*, *Château Miraval
   Studio White*.
2. **P&L drinks are a flat number:** the per-event P&L "Напитки" line is a single
   `income_drinks_eur` figure prefilled from the booking. The bookkeeper can't adjust
   how much was actually consumed (a party may order more than they drink, or vice
   versa) and can't add drinks that weren't in the original order.

## Goal

Turn the P&L drinks line into an **editable, itemized list**: seeded from the booking,
quantities editable, price **auto-calculated from the live catalog** (`drinks-data.js`),
with the ability to **add** catalog drinks or **manual** lines. Fix the Le Rosé photo
by reusing the existing real photo; the 2 Miraval photos await real files.

## Design

### Photos
- Point plain `le_rose` at `assets/images/drinks/le-rose-375.png` (the existing real Le
  Rosé photo). Bump `drinks-data.js?v=4 → v=5` on reservation/menu/drinks/edit pages.
- Miraval: left on placeholder until the owner supplies `miraval-rose` / `miraval-white`
  images; wiring is then a one-line each.

### P&L drinks — data model
- New JSONB column `financial_events.pnl_drinks`: the P&L's own adjusted drink list (the
  booking's `enquiries.drinks` is **never mutated**). Each element:
  `{ id?: string, name: string, qty: number, unit_price_eur?: number, manual?: boolean }`.
- `income_drinks_eur` stays as the **cached sum** the monthly summary reads (kept in sync
  on save), exactly like `income_addons_eur`.

### Price resolution (per line)
`drinkUnitPrice(line)` = `manual ? unit_price_eur : (catalogById.get(id)?.price_eur ?? unit_price_eur ?? 0)`.
Catalog price is the **live** `drinks-data.js` value (so price edits like the Le Rosé
flow through). Catalog drinks no longer in the catalog fall back to the stored
`unit_price_eur`.

### Editing model (draft-until-save, focus-preserving)
- The working list is dirty-aware: `dirtyFe.pnl_drinks` if dirtied, else `fe.pnl_drinks`,
  else **seeded in memory** from `enquiry.drinks` (`{id,name,qty,unit_price_eur:price_eur}`).
- All drink edits stage `dirtyFe.pnl_drinks` (full array) + `dirtyFe.income_drinks_eur`
  (recomputed) — consistent with "all edits are local draft until Save".
- Qty / manual-field keystrokes update the draft + the line's € span (by id) + the drinks
  subtotal + the income total **without rebuilding the list** (preserves input focus).
- Add (catalog or manual) / delete re-render the list (button clicks, focus loss is fine).

### UI (income column)
- Remove "Напитки" from the fixed income lines.
- New section: subhead **Напитки** + `#pnl-drinks-total`, a `#pnl-drinks-lines` `<ul>`,
  and **"+ Добави напитка"** / **"+ Ръчна напитка"** buttons.
- Catalog line: `<select>` (catalog grouped by `drinkCategories`, preselected) · qty · =€ · ×.
- Manual line: name input · €/бр input · qty · =€ · ×.

### Plumbing
- `financials.html` loads `../js/drinks-data.js?v=5` (defer, before `financials.js`) so the
  global `drinks` + `drinkCategories` are available; build `catalogById` once.
- `feIncome().drinks` = `pnl_drinks != null ? drinksTotal(fe.pnl_drinks) : income_drinks_eur`
  (live-priced for adjusted events; cached fallback otherwise), mirroring the addons pattern.
- Migration `…160000_financial_pnl_drinks.sql` (additive). Cache bumps: `financials.js v=34`,
  `css v=17`. Apply migration BEFORE shipping JS (saveDraft batches the whole patch).

## Out of scope (YAGNI)
- Editing drinks on the public booking side (this is admin-only reconciliation).
- Per-category drink reporting in the monthly summary (one "Напитки" pill stays).
- Sourcing the Miraval photos (owner provides).
