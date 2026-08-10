# Financials drift warning + „Опресни от заявката"

**Date:** 2026-08-10
**Status:** Approved (Angel: "go" on the described design), pending plan
**Origin:** Bug report 2026-08-09 — enquiry edits (guests on Ivan Chorbadzhakov's booking; moved services + alcohol on another) never reach „Финанси"; investigation report `.superpowers/sdd/financials-stale-investigation.md` established this is the June P&L design (deliberate freeze at `ensureFinancialEvent`, auto-sync trigger deliberately removed) with an observability gap: nothing signals that the enquiry changed after bookkeeping was saved.

## Design (keeps "deliberate bookkeeping", kills silent drift)

1. **Sync stamp:** new column `enquiry_synced_at timestamptz` on the financial-events table (exact table name per `ensureFinancialEvent` in financials.js — verify at implementation). Set to `now()` when the P&L row is first created AND on every successful refresh (below). Legacy rows: treated as `COALESCE(enquiry_synced_at, created_at)`.
2. **Drift detection (read-only, every P&L open):** the linked enquiry's `last_edited_at` (set by BOTH edit paths on every successful edit) is compared to the sync stamp. `last_edited_at > stamp` → show a warning banner on that event's P&L: BG „⚠️ Заявката е променена след последното осчетоводяване." + button „Опресни от заявката" (EN parity via admin-i18n). No value-diffing — timestamp comparison avoids false positives from legitimate manual bookkeeping adjustments (rent discounts, manual lines).
3. **Refresh action (explicit, confirm-gated):** confirm dialog states exactly what happens — BG: „Наемът, доп. гости, услугите и напитките ще се презаредят от заявката. Плащанията, разходите и ръчно добавените редове се запазват. Ръчни корекции по наема (отстъпки) ще бъдат презаписани." On confirm:
   - Re-seed rent / extra-guests income exactly as `ensureFinancialEvent` seeds a new event (same helpers — venue from the same source financials already uses, incl. the `venue_price_eur` stamp fallback chain).
   - Replace the enquiry-seeded service income items with fresh ones from the live enquiry's addons; PRESERVE items the bookkeeper added manually (use the existing manual/source distinction in the data model — verify the flag; if enquiry-seeded items are not distinguishable, replace only items whose ids match enquiry addon ids and document the limitation in the confirm text).
   - Re-seed the drinks P&L (`pnl_drinks`) from the live enquiry drinks, preserving `manual`-flagged drink lines.
   - Never touch payments, expenses, notes.
   - Set `enquiry_synced_at = now()`, re-render.
4. **Out of scope:** no automatic sync (explicitly rejected in June and re-affirmed); no changes to dashboard/edit paths; manual-events (no linked enquiry) never show the banner.
5. **Fixes the two live cases** via one click each after ship (no SQL patching needed).

## Rollout
Branch `feat/financials-refresh` off origin/main (123d5b4). Additive migration applied live (inert until UI ships). One PR — joins the open-PR queue; extends the cross-PR cache-bump collision rule to financials.js (#28 also bumps it). Verification: Deno n/a (pure client + SQL); Playwright walkthrough (banner appears only when last_edited_at > stamp; refresh updates numbers, preserves a manual payment; banner clears), node --check, live SQL checks on the two affected events after Angel clicks refresh.
