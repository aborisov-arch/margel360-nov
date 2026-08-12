# Seasonal venue pricing (date-based venue price)

**Date:** 2026-07-28
**Status:** Approved (design), pending implementation plan
**Source:** Angel's price list (`cenova_lista.md`), clarified in conversation.

## Problem

Venue rental must cost more on specific calendar dates. Today the venue base
price is fixed per event type and duplicated across 8 files (see CLAUDE.md
sync map); nothing in the system is date-aware except the weekday promo.

## The pricing rule (confirmed with Angel)

Applies to **all event types** (incl. corporate and kids' birthdays), every
year, Europe/Sofia calendar dates:

| Priority | Dates | Price (flat, replaces the event's base) |
|---|---|---|
| 1 | **Dec 31** | **€4200** |
| 2 | **Dec 1–30** and **May 19–Jun 10** | **€1780** on Friday/Saturday, **€1670** Sun–Thu |
| 3 | any other date | the event's current base price, unchanged (evening 1280, corp4 330, corp8 440, bday_day 700, bday_eve 970, wedding 1500) |

Explicitly confirmed:
- The price list's "standard base €1350" line is **ignored** — normal days
  keep today's prices ("only for those dates").
- Corporate on a seasonal date really costs €1670+ (Angel confirmed
  deliberately).
- Periods recur annually; numbers change by editing one module.
- Weekday promo (ends 2026-08-31) never overlaps the seasons; stated
  precedence for the future: percent discounts apply to the **effective**
  (seasonal) venue price.

## Architecture (Approach A — approved)

### 1. One authoritative module

`supabase/functions/_shared/seasonal-pricing.ts` (weekday-promo pattern):
- Owns `VENUE_BASE_EUR` (the per-event base map) and the season definitions.
- Exports `effectiveVenuePrice(eventId: string, dateStr: "DD/MM/YYYY"): number`
  implementing the table above, plus a `seasonalVenuePrice(dateStr): number | null`
  helper (null = no override). Day-of-week computed from the calendar date
  (UTC-constructed, no timezone skew — same technique as weekday-promo.ts).
- Deno tests pin boundaries: Nov 30 vs Dec 1, Dec 30 vs Dec 31, Jan 1,
  May 18 vs May 19, Jun 10 vs Jun 11, Friday vs Saturday vs Sunday inside a
  season, and a non-seasonal control date per event type.

### 2. Stamped snapshot column

- Migration: `ALTER TABLE public.enquiries ADD COLUMN venue_price_eur numeric(8,2);`
  (nullable; legacy rows stay NULL).
- `submit-enquiry` stamps `venue_price_eur = effectiveVenuePrice(event_id, preferred_date)`
  server-side (client cannot supply it).
- `update-enquiry-by-token` and `update-enquiry-admin` re-stamp whenever
  `preferred_date` is in the patch (event type is not editable). Moving a
  booking into a season re-prices it; moving out re-prices back.

### 3. Consumers read the stamp

`enquiry-email.ts`, `dashboard.js`, `financials.js`, `customers.js`,
`marketing.js`, `offer-export.js`, `offer-pdf.js`:
use `row.venue_price_eur ?? <existing hardcoded map>[event_id]` — new
bookings get the stamped effective price; legacy rows (NULL) keep behaving
exactly as today. No historical value changes.

### 4. Client mirror (display only)

- New `website/js/seasonal-pricing.js` (IIFE, no top-level bindings): mirror
  of the season table + `window.effectiveVenuePrice(eventId, dateStr)`.
- `reservation.js`: `renderSummary`, the running preview and the gtag
  conversion value use the mirror instead of `booking.event.price_eur`; the
  date step shows a hint when the selected date is seasonal
  (BG: „Празничен период — наем €1780" / EN equivalent via the page's i18n
  pattern).
- Event picker cards keep showing the normal "from" prices (unchanged).
- `edit.html` shows no venue price today — no UI change; the server re-stamp
  covers correctness.
- CLAUDE.md sync map: venue-base row gains "authoritative:
  `_shared/seasonal-pricing.ts` + client mirror `js/seasonal-pricing.js`;
  consumers fall back to their maps only for legacy NULL rows"; new row for
  the seasonal periods listing the two files.

## Rollout

1. Migration (additive) — apply to live with confirmation.
2. Module + tests, function changes, deploys (submit-enquiry and
   update-enquiry-by-token with `--no-verify-jwt`, update-enquiry-admin
   without).
3. Site changes (mirror + wizard + version bumps) in one PR; functions are
   backward-compatible with the pre-PR site (stamp is computed server-side
   regardless of what the client displays).
4. Verification: Deno tests; wizard walkthrough picking a December Friday
   (shows €1780), Dec 31 (€4200), and a normal date (unchanged); one live
   test enquiry on a seasonal date confirming the stamped value and email.

## Risks / notes

- Mid-wizard date changes update the summary live (renderSummary already
  re-runs); server stamp is authoritative at submit.
- The date-step hint must be bilingual and native-register Bulgarian.
- Cache rule: every touched JS file needs its `?v=` bump.
