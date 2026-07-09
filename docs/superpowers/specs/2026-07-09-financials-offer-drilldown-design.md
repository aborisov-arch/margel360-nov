# Financials: click an event in the breakdown → read-only offer

**Date:** 2026-07-09 · **Scope:** `website/admin/js/financials.js`, `website/admin/financials.html`
**Follows:** 2026-07-08 category drill-down (PR #10, live)

## Goal

When the category/metric drill-down modal is showing a list of events, clicking
one event opens — **in the same modal** — a clean, read-only breakdown of that
customer's full offer (оферта). A "← back" returns to the list; an "open full
P&L" button drops into the editable per-event P&L.

## Current behavior (confirmed)

Clicking an event row in the drill modal runs `closeDrill()` then
`selectEnquiry()` / `selectManual()` (financials.js:1561-1564). The P&L panel
updates but sits far below the summary and **is not scrolled into view**, so it
reads as "nothing happened." No offer view exists anywhere on this page.

## Design

### Interaction

- Drill lists (metric breakdown `openMetricBreakdown`, category breakdown
  `openCategoryBreakdown`) already render rows as `<button>` with `data-enquiry`
  (enquiry-linked) or `data-manual-fe` (hand-entered).
- New click routing, added **before** the existing generic `[data-enquiry]`
  handler, scoped to `#drill-modal` so the left-rail event list is unaffected:
  - Row with `data-enquiry` → `openOfferView(enquiryId)` (stay in modal).
  - Row with `data-manual-fe` → no customer offer exists, so close the modal and
    open that manual event's P&L, scrolled into view (the fixed version of
    today's behavior).
- `openOfferView` swaps the modal body to the offer breakdown and sets the
  title to `Оферта № {enquiry_number}`.
- **← back** (`[data-drill-back]`) re-renders the list the user came from. A
  module var `lastDrill` records the last list opened (`{kind:'metric', metric}`
  or `{kind:'cat', catKind, catId}`); `reopenLastDrill()` dispatches on it. Both
  `openMetricBreakdown` and `openCategoryBreakdown` set `lastDrill` at entry.
- **Отвори пълния P&L** (`[data-offer-open-pnl]`) → `closeDrill()`,
  `selectEnquiry(id)`, then `scrollEventsIntoView()` (existing helper) so the
  editor is actually visible.
- Escape / backdrop close the whole modal (unchanged). Rows are native buttons,
  so keyboard activation already works.

### Offer computation — `computeOffer(enq)`

Mirrors the canonical customer offer (offer-pdf.js `computeOfferBreakdown`), using
constants financials.js already owns (`EVENT_BASE`, `VENUE_MIN_GUESTS`=40,
`EXTRA_GUEST_FEE_EUR`=15):

1. **Venue base** = `EVENT_BASE[event_id]` (0 if unknown). Label from
   `enq.event_type`.
2. **Extra guests** = `max(0, guests − 40)`; cost = `× €15`. Shown only if > 0.
3. **Drinks** — one row per `enq.drinks` entry with qty > 0:
   `name`, `qty`, `unit = price_eur ?? price`, `line = unit × qty`.
4. **Add-ons** — one row per `enq.addons` entry: `name`, `qty` (or 1),
   `line = addonPriceEur(id, price)`. The €70 cleaning addon rides here as a
   normal row (matches the PDF). **Legacy-BGN normalization is applied** (ported
   `ADDON_BGN_PRICES` + `addonPriceEur` from offer-export.js) so the offer view
   equals what the customer was actually quoted for pre-2026-05-04 bookings.
5. **Discount** = `round(venue × applied_discount_percent / 100)`, venue base
   ONLY. Shown as `− €X` only if > 0.
6. **Total** = venue + extraGuestsCost + addonsSum + drinksSum − discount.
7. **Deposit** = `round(total × 0.5)`; **Balance** = total − deposit;
   **Validity** = 2 days.

Item names render as stored (`name_en`, per the payload contract) — consistent
with the existing P&L panel, which already shows the same values. Money via the
existing `fmtEur`; all text through `esc`.

### Markup

Read-only, inline-styled to match the existing drill rows (no new CSS file
version needed beyond what already exists). Structure: back button → header
(`ОФЕРТА №{n} · {name}`, sub `{event_type} · {date} · {guests} гости`) → line
rows (venue, extra guests, drinks group, add-ons group, discount) → divider →
Total / Deposit / Balance / Validity → "Отвори пълния P&L" button.

### Cache

`financials.js` v40 → v41 in financials.html.

## Non-goals / notes

- Manual (no-enquiry) events have no offer → they open the P&L directly.
- `enquiryBreakdown` (P&L prefill) sums addons with raw price and is **not**
  changed here (touching it would shift saved bookkeeping numbers). The
  addon-normalization discrepancy it carries is pre-existing; flagged as a
  possible follow-up. A shared `offer-math.js` module (used by financials +
  offer-pdf + offer-export) would remove the constant duplication the sync-map
  in CLAUDE.md tracks — also a follow-up, out of scope here.

## Testing

Admin is MFA-gated (no automated login). Manual: open Финанси → click an income
and an expense category → click an event → verify the offer total equals that
customer's real offer/PDF, ← back returns to the same list, "open P&L" scrolls
to the editor; click a manual event → P&L opens scrolled into view.
