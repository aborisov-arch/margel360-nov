# Financials: EUR-only display + category drill-down

**Date:** 2026-07-08 · **Scope:** `website/admin/financials.html`, `website/admin/js/financials.js`

## Goal

1. The admin panel shows EUR only. BGN stays on the public site, where the
   dual display exists for customers.
2. Clicking any summarized income/expense category box shows the full
   breakdown behind that number: how many events and the details.

## Design

### BGN removal (financials page — the only admin surface that showed BGN)

- KPI boxes lose their `лв` subline (5 × `kpi__sub` / `sum-*-bgn`).
- Category pills lose the BGN subline; they keep the percent-of-total badge.
- Per-event P&L loses the net-profit BGN subline (`pnl-net-bgn`).
- The toolbar's "1 € = 1.95583 лв" note goes away.
- `BGN_RATE` and `fmtBgn` are deleted. The peg constant stays only where it
  is business logic (legacy BGN→EUR price detection in offer-export/offer-pdf).

### Category drill-down

Reuses the existing `drill-modal` + `drillRowHtml` machinery the KPI boxes
already use, so both drills look and behave identically.

- Every income and expense pill becomes a button (`role="button"`,
  `tabindex="0"`, Enter/Space handled) and opens `openCategoryBreakdown(kind, catId)`.
- **Income category** → one row per event: enquiry number, customer, date,
  that event's amount for the category.
- **Expense category** → one row per expense line (user's choice): enquiry
  number, customer, expense note, date, amount. Footer shows
  "N разхода · M събития" when they differ.
- Scope matches `renderMonthSummary` exactly (same month filter, same
  realized-only gate), so the modal total always equals the pill's number.
- Clicking a row closes the modal and opens that event's P&L (existing
  `data-enquiry` / `data-manual-fe` behavior).
- The old expense-pill behavior (transient left-rail highlight) is replaced
  by the modal; `highlightEventsWithCategory` is removed as dead code.

### Cache

`financials.js` v39 → v40 in financials.html.

## Testing

Admin login is MFA-gated, so runtime verification is manual: open Финанси,
confirm no `лв` anywhere, click each pill kind (income + expense) and check
the modal totals equal the pill values, click a row and confirm the event
P&L opens.
