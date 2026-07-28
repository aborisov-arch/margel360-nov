# Seasonal Venue Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Venue rental costs €4200 on Dec 31, €1780 Fri/Sat and €1670 Sun–Thu during Dec 1–30 and May 19–Jun 10 (every year, all event types); all other dates keep current prices. Spec: `docs/superpowers/specs/2026-07-28-seasonal-venue-pricing-design.md`.

**Architecture:** One authoritative Deno module (`_shared/seasonal-pricing.ts`, weekday-promo pattern) computes the effective venue price; `submit-enquiry` stamps it into a new `enquiries.venue_price_eur` column and the two edit functions re-stamp on date changes; the 7 downstream consumers read the stamp with fallback to their existing maps for legacy NULL rows; the wizard mirrors the seasonal rule for display only (its fallback is the live event object's own price — no new base-map copy client-side).

**Tech Stack:** Vanilla JS static site, Supabase (Postgres + Deno edge functions), Deno tests.

## Global Constraints

- User-facing copy Bulgarian (native register) with EN parity where the page is bilingual; code/comments/commits English.
- Seasonal rule (verbatim from spec): Dec 31 → €4200 any event; Dec 1–30 and May 19–Jun 10 → €1780 Friday/Saturday else €1670, any event; other dates → current base (evening 1280, corp4 330, corp8 440, bday_day 700, bday_eve 970, wedding 1500). Recurs annually; Europe/Sofia calendar dates; date strings are the wizard's `DD/MM/YYYY`.
- The client never supplies `venue_price_eur` — it is computed server-side only.
- Legacy rows (NULL stamp) must behave exactly as today in every consumer.
- Cache rule: bump `?v=N` in referencing HTML for every touched JS file.
- `node --check` every touched JS; `deno check` every touched TS.
- Deploy flags: `submit-enquiry`, `update-enquiry-by-token` → `--no-verify-jwt`; `update-enquiry-admin` → verify_jwt ON. (Supabase MCP `deploy_edge_function`, layout `supabase/functions/...` as in the catalog feature.)
- Work on branch `feat/seasonal-pricing` off current `main`; one PR at the end; merging is Angel's unless he says otherwise.
- Migration is applied to live project `wlxutsufrobzovdsiecb` via MCP `apply_migration` AND committed to `supabase/migrations/` (additive column — covered by Angel's standing go-ahead for this feature; stop only if anything unexpected appears).

---

### Task 1: `_shared/seasonal-pricing.ts` (TDD)

**Files:**
- Create: `supabase/functions/_shared/seasonal-pricing.test.ts`
- Create: `supabase/functions/_shared/seasonal-pricing.ts`

**Interfaces (produced — later tasks rely on these exact names):**
- `VENUE_BASE_EUR: Record<string, number>` — the per-event base map.
- `seasonalVenuePrice(dateStr: string): number | null` — seasonal override or null.
- `effectiveVenuePrice(eventId: string | null | undefined, dateStr: string | null | undefined): number` — override ?? base ?? 0.

- [ ] **Step 1: Write the failing tests** (weekday facts verified: 2026-12-01 Tue, 2026-12-04 Fri, 2026-12-05 Sat, 2026-12-06 Sun, 2026-12-30 Wed, 2026-12-31 Thu; 2027-05-18 Tue, 2027-05-19 Wed, 2027-05-22 Sat, 2027-06-10 Thu, 2027-06-11 Fri):

```ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { effectiveVenuePrice, seasonalVenuePrice } from "./seasonal-pricing.ts";

Deno.test("NYE: Dec 31 is 4200 for every event type, any year", () => {
  assertEquals(seasonalVenuePrice("31/12/2026"), 4200);
  assertEquals(seasonalVenuePrice("31/12/2027"), 4200);
  assertEquals(effectiveVenuePrice("corp4", "31/12/2026"), 4200);
  assertEquals(effectiveVenuePrice("wedding", "31/12/2026"), 4200);
});

Deno.test("winter season: weekday vs weekend tiers", () => {
  assertEquals(seasonalVenuePrice("01/12/2026"), 1670); // Tue, first day
  assertEquals(seasonalVenuePrice("04/12/2026"), 1780); // Fri
  assertEquals(seasonalVenuePrice("05/12/2026"), 1780); // Sat
  assertEquals(seasonalVenuePrice("06/12/2026"), 1670); // Sun counts as weekday tier
  assertEquals(seasonalVenuePrice("30/12/2026"), 1670); // Wed, last day
});

Deno.test("spring season: boundaries + tiers", () => {
  assertEquals(seasonalVenuePrice("18/05/2027"), null); // day before
  assertEquals(seasonalVenuePrice("19/05/2027"), 1670); // Wed, first day
  assertEquals(seasonalVenuePrice("22/05/2027"), 1780); // Sat
  assertEquals(seasonalVenuePrice("10/06/2027"), 1670); // Thu, last day
  assertEquals(seasonalVenuePrice("11/06/2027"), null); // day after
});

Deno.test("outside seasons: null override, base price applies", () => {
  assertEquals(seasonalVenuePrice("30/11/2026"), null);
  assertEquals(seasonalVenuePrice("01/01/2027"), null);
  assertEquals(seasonalVenuePrice("15/07/2027"), null);
  assertEquals(effectiveVenuePrice("evening", "15/07/2027"), 1280);
  assertEquals(effectiveVenuePrice("corp4", "30/11/2026"), 330);
  assertEquals(effectiveVenuePrice("corp8", "30/11/2026"), 440);
  assertEquals(effectiveVenuePrice("bday_day", "30/11/2026"), 700);
  assertEquals(effectiveVenuePrice("bday_eve", "30/11/2026"), 970);
  assertEquals(effectiveVenuePrice("wedding", "30/11/2026"), 1500);
});

Deno.test("malformed input degrades to base / 0", () => {
  assertEquals(seasonalVenuePrice("2026-12-05"), null);
  assertEquals(seasonalVenuePrice(""), null);
  assertEquals(effectiveVenuePrice("evening", null), 1280);
  assertEquals(effectiveVenuePrice("evening", "bogus"), 1280);
  assertEquals(effectiveVenuePrice("unknown_event", "15/07/2027"), 0);
  assertEquals(effectiveVenuePrice(null, "15/07/2027"), 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/angelborisov/dev/margel360/supabase/functions/_shared && deno test seasonal-pricing.test.ts`
Expected: FAIL — `Module not found "./seasonal-pricing.ts"`.

- [ ] **Step 3: Implement**

```ts
// Seasonal venue pricing (recurring every year, Europe/Sofia calendar dates).
// This module is the AUTHORITATIVE copy of both the per-event venue base
// prices and the seasonal calendar; website/js/seasonal-pricing.js mirrors
// the seasonal rule for wizard display (its base fallback is the live event
// object, so only the seasonal table is mirrored - keep the two in sync,
// see the CLAUDE.md sync map). submit-enquiry stamps the result into
// enquiries.venue_price_eur; the edit functions re-stamp on date changes.
// Precedence note: percent discounts (weekday promo / codes) apply to the
// EFFECTIVE price this module returns.

export const VENUE_BASE_EUR: Record<string, number> = {
  evening: 1280,
  corp4: 330,
  corp8: 440,
  bday_day: 700,
  bday_eve: 970,
  wedding: 1500,
};

export const SEASONAL_PRICING = {
  nyePrice: 4200,      // Dec 31, any year, any event type
  weekdayPrice: 1670,  // Sun-Thu inside a season
  weekendPrice: 1780,  // Fri and Sat inside a season
  // Inclusive MM-DD ranges, recur annually. Dec 31 is deliberately outside
  // the winter range - it has its own flat price above.
  seasons: [
    { from: "12-01", to: "12-30" },
    { from: "05-19", to: "06-10" },
  ],
};

// dateStr is the wizard's DD/MM/YYYY. Returns the seasonal price for that
// calendar date, or null when the date is outside every special period.
export function seasonalVenuePrice(dateStr: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr ?? "");
  if (!m) return null;
  const mmdd = `${m[2]}-${m[1]}`;
  if (mmdd === "12-31") return SEASONAL_PRICING.nyePrice;
  const inSeason = SEASONAL_PRICING.seasons.some(s => mmdd >= s.from && mmdd <= s.to);
  if (!inSeason) return null;
  // Day-of-week of the calendar date itself; noon-UTC avoids TZ skew
  // (same technique as weekday-promo.ts). 5=Fri, 6=Sat.
  const day = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00Z`).getUTCDay();
  return day === 5 || day === 6 ? SEASONAL_PRICING.weekendPrice : SEASONAL_PRICING.weekdayPrice;
}

// The venue price a booking on dateStr actually costs for this event type.
export function effectiveVenuePrice(
  eventId: string | null | undefined,
  dateStr: string | null | undefined,
): number {
  return seasonalVenuePrice(dateStr ?? "") ?? (eventId ? VENUE_BASE_EUR[eventId] ?? 0 : 0);
}
```

- [ ] **Step 4: Run tests** — expect `ok | 5 passed`. Also `deno check seasonal-pricing.ts`.

- [ ] **Step 5: Commit**

```bash
cd /Users/angelborisov/dev/margel360
git checkout -b feat/seasonal-pricing
git add supabase/functions/_shared/seasonal-pricing.ts supabase/functions/_shared/seasonal-pricing.test.ts
git commit -m "feat(fn): seasonal venue pricing module (TDD)"
```

### Task 2: `venue_price_eur` column (migration + live apply)

**Files:**
- Create: `supabase/migrations/20260728120000_venue_price_eur.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Effective venue base price (EUR) for the booking's date, stamped by
-- submit-enquiry from _shared/seasonal-pricing.ts (seasonal calendar
-- pricing: Dec 31 = 4200; Dec 1-30 and May 19 - Jun 10 = 1780 Fri/Sat,
-- 1670 Sun-Thu; otherwise the event's base price). Re-stamped by
-- update-enquiry-by-token / update-enquiry-admin when preferred_date
-- changes. NULL = legacy row; consumers fall back to their static maps.
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS venue_price_eur numeric(8,2);
```

- [ ] **Step 2: Apply to live** via MCP `apply_migration` (project `wlxutsufrobzovdsiecb`, name `venue_price_eur`) — controller does this step. Verify with `execute_sql`: `SELECT count(*) FROM information_schema.columns WHERE table_name='enquiries' AND column_name='venue_price_eur';` → 1.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260728120000_venue_price_eur.sql
git commit -m "feat(db): venue_price_eur stamp column on enquiries"
```

### Task 3: stamp + re-stamp in the three enquiry functions

**Files:**
- Modify: `supabase/functions/submit-enquiry/index.ts`
- Modify: `supabase/functions/update-enquiry-by-token/index.ts`
- Modify: `supabase/functions/update-enquiry-admin/index.ts`

**Interfaces:** Consumes Task 1's `effectiveVenuePrice`. Produces: every new insert carries `venue_price_eur`; any patch containing `preferred_date` re-stamps it.

- [ ] **Step 1: submit-enquiry** — add to imports:

```ts
import { effectiveVenuePrice } from "../_shared/seasonal-pricing.ts";
```

In the `row` object (the one inserted into `enquiries`, currently ending with `partner_interest`), add:

```ts
    // Server-authoritative venue price for the chosen date (seasonal calendar).
    venue_price_eur: effectiveVenuePrice(event_id, preferred_date),
```

- [ ] **Step 2: update-enquiry-by-token** — add the same import. Directly BEFORE the existing weekday-promo block (`if ("preferred_date" in patch && !current.applied_discount_code) {`), insert:

```ts
  // The venue price follows the DATE (seasonal calendar) - re-stamp it
  // whenever the date changes. Event type is not editable, so current.event_id
  // is authoritative.
  if ("preferred_date" in patch) {
    updateRow.venue_price_eur = effectiveVenuePrice(String(current.event_id ?? ""), String(patch.preferred_date));
  }
```

- [ ] **Step 3: update-enquiry-admin** — add the same import. Its `updateRow` is built as a literal (`const updateRow = { ...patch, last_edited_at: ..., edited_by_admin: ... }`). After that literal, insert the same re-stamp block (identical code, same comment).

- [ ] **Step 4: Verify** — `deno check` all three files; `cd supabase/functions/_shared && deno test seasonal-pricing.test.ts catalog.test.ts validate.test.ts` (5 + 14 + 9 passing).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/submit-enquiry/index.ts supabase/functions/update-enquiry-by-token/index.ts supabase/functions/update-enquiry-admin/index.ts
git commit -m "feat(fn): stamp venue_price_eur at submit and on date edits"
```

### Task 4: enquiry-email.ts reads the stamp

**Files:**
- Modify: `supabase/functions/_shared/enquiry-email.ts` (map at ~line 80, `venueBasePrice()` at ~line 90, `computeTotals` below it)

- [ ] **Step 1:** Keep `VENUE_BASE_PRICE_EUR` and `venueBasePrice()` as the legacy fallback. In `computeTotals` (and any other place that calls `venueBasePrice(e.event_id)` — grep the file), change the venue amount to:

```ts
  const venue = e.venue_price_eur != null
    ? Number(e.venue_price_eur)
    : venueBasePrice(e.event_id);
```

If the file has an `Enquiry` type/interface, add `venue_price_eur?: number | string | null;` to it. Update the map's comment to note the stamp is authoritative for new rows and the map is the legacy-NULL fallback.

- [ ] **Step 2:** `deno check supabase/functions/_shared/enquiry-email.ts`. Also confirm the enquiry loads in `send-enquiry-summary` use `select("*")` (they do — no column list to extend; verify and note in the report).

- [ ] **Step 3: Commit** — `git add ... && git commit -m "feat(fn): emails price the venue from the stamped value"`

### Task 5: admin JS consumers read the stamp

**Files:**
- Modify: `website/admin/js/dashboard.js` (~926 `computeTotals`), `financials.js` (lines ~108, ~866, ~1583 + the explicit `.select(...)` at ~275), `customers.js` (~35), `marketing.js` (~20), `offer-export.js` (~162-165), `offer-pdf.js` (~116-117)
- Modify (version bumps): each page's HTML referencing a changed JS file (`dashboard.html`, `financials.html`, `customers.html`, `marketing.html`; offer-export.js/offer-pdf.js are loaded by `dashboard.html`/`financials.html` — bump wherever referenced; find each current `?v=N` and bump by one)

- [ ] **Step 1:** In each file, apply the same rule — stamped value first, existing map fallback for NULL:
  - dashboard.js `computeTotals`: `const venue = e.venue_price_eur != null ? Number(e.venue_price_eur) : (VENUE_BASE_PRICE_EUR[e.event_id] || 0);`
  - customers.js ~35 and marketing.js ~20: `const base = e.venue_price_eur != null ? Number(e.venue_price_eur) : (EVENT_BASE[e.event_id] || 0);`
  - financials.js: add a helper next to `EVENT_BASE` —
    ```js
    // Stamped effective venue price (seasonal calendar) with legacy fallback.
    function venueBaseOf(e) {
      return e && e.venue_price_eur != null ? Number(e.venue_price_eur) : (EVENT_BASE[e?.event_id] || 0);
    }
    ```
    and use it at all three sites (~108, ~866, ~1583) — inspect each site's context and preserve its guard semantics (e.g. the ~866 `if (enq && EVENT_BASE[enq.event_id])` guard becomes `if (enq && venueBaseOf(enq) > 0)`).
  - offer-export.js ~165: `ws.getCell('Q15').value = enquiry.venue_price_eur != null ? Number(enquiry.venue_price_eur) : cfg.price;` (confirm the variable holding the enquiry row in that scope and use it).
  - offer-pdf.js ~117: `const venue = enquiry.venue_price_eur != null ? Number(enquiry.venue_price_eur) : (cfg ? cfg.price : 0);`
- [ ] **Step 2:** Explicit column lists: grep every touched file (and dashboard.js) for `.select(` on `enquiries` — anywhere columns are listed explicitly and the code now reads `venue_price_eur`, append `,venue_price_eur` (known site: financials.js ~275). `select('*')` sites need nothing.
- [ ] **Step 3:** `node --check` all six JS files; version bumps done; `grep -rn "venue_price_eur" website/admin/js | wc -l` ≥ 8.
- [ ] **Step 4: Commit** — `git commit -m "feat(admin): dashboards/exports price the venue from the stamped value"`

### Task 6: client mirror + wizard display

**Files:**
- Create: `website/js/seasonal-pricing.js`
- Modify: `website/js/reservation.js` (onChange ~320-327, updatePreview price line ~383-386, renderSummary `const venuePrice = booking.event.price_eur;` ~1004, gtag `const venuePrice = booking.event?.price_eur || 0;` ~1258)
- Modify: `website/reservation.html` (hint element after `#weekday-promo-hint` at ~165; scripts block ~380-386)

**Interfaces:** Consumes nothing from other tasks (pure mirror). Produces `window.seasonalVenuePrice(dateStr) -> number|null` and `window.SEASONAL_PRICING`.

- [ ] **Step 1: The mirror** (IIFE, no top-level bindings — same constraint as catalog-db.js):

```js
// Seasonal venue pricing - display mirror of the AUTHORITATIVE server module
// supabase/functions/_shared/seasonal-pricing.ts (keep the numbers and date
// ranges in sync - CLAUDE.md sync map). The wizard uses this to show the
// price the server will stamp; the server recomputes on submit either way.
// Base-price fallback is the live event object (eventTypes), so only the
// seasonal table is mirrored here.
(function () {
  const SEASONAL_PRICING = {
    nyePrice: 4200,      // Dec 31, any year, any event type
    weekdayPrice: 1670,  // Sun-Thu inside a season
    weekendPrice: 1780,  // Fri and Sat inside a season
    seasons: [
      { from: '12-01', to: '12-30' },
      { from: '05-19', to: '06-10' },
    ],
  };

  function seasonalVenuePrice(dateStr) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr || '');
    if (!m) return null;
    const mmdd = m[2] + '-' + m[1];
    if (mmdd === '12-31') return SEASONAL_PRICING.nyePrice;
    if (!SEASONAL_PRICING.seasons.some(s => mmdd >= s.from && mmdd <= s.to)) return null;
    const day = new Date(m[3] + '-' + m[2] + '-' + m[1] + 'T12:00:00Z').getUTCDay();
    return day === 5 || day === 6 ? SEASONAL_PRICING.weekendPrice : SEASONAL_PRICING.weekdayPrice;
  }

  window.SEASONAL_PRICING = SEASONAL_PRICING;
  window.seasonalVenuePrice = seasonalVenuePrice;
})();
```

- [ ] **Step 2: reservation.html** — after the `#weekday-promo-hint` `<p>` (~line 165) add:

```html
              <p class="weekday-promo-hint" id="seasonal-price-hint" hidden></p>
```

In the scripts block: add `<script src="js/seasonal-pricing.js?v=1"></script>` immediately before `reservation.js`; bump `reservation.js?v=25` → `?v=26`.

- [ ] **Step 3: reservation.js**
  - In flatpickr `onChange` (after the existing promoHint toggle):
    ```js
        // Seasonal price notice: the venue costs a flat calendar price on
        // these dates (Dec 1-30, May 19 - Jun 10, Dec 31) - see js/seasonal-pricing.js.
        const seasonalHint = document.getElementById('seasonal-price-hint');
        if (seasonalHint) {
          const sp = window.seasonalVenuePrice(dateStr);
          if (sp == null) {
            seasonalHint.hidden = true;
          } else {
            const sl = getLang();
            const isNye = /^31\/12\//.test(dateStr);
            seasonalHint.textContent = isNye
              ? (sl === 'bg' ? `Новогодишна вечер — наем на залата €${sp}.` : `New Year's Eve — venue rental €${sp}.`)
              : (sl === 'bg' ? `Празничен период — наем на залата €${sp} за тази дата.` : `Holiday-season date — venue rental €${sp} for this date.`);
            seasonalHint.hidden = false;
          }
        }
    ```
  - renderSummary (~1004): `const venuePrice = window.seasonalVenuePrice(booking.date) ?? booking.event.price_eur;`
  - gtag block (~1258): `const venuePrice = window.seasonalVenuePrice(booking.date) ?? (booking.event?.price_eur || 0);`
  - updatePreview price line (~383-386): replace the `p.textContent = fmtEvent(...)` line with
    ```js
    const previewPrice = window.seasonalVenuePrice(booking.date);
    p.textContent = (previewPrice != null ? '€' + previewPrice : fmtEvent(booking.event))
      + (booking.date ? ' · ' + booking.date : '');
    ```
- [ ] **Step 4: Verify** — `node --check` both JS files; then a local Playwright/browser check: serve `website/` and on reservation.html pick 04/12/2026 (hint shows €1780; summary venue line €1780.00), 31/12/2026 (€4200), 15/07/2027 (no hint, normal price). The language toggle re-running the summary must show EN copy.
- [ ] **Step 5: Commit** — `git commit -m "feat(site): wizard shows seasonal venue prices with date hint"`

### Task 7: deploys, docs, verification, PR

- [ ] **Step 1:** Deploy the three functions via MCP `deploy_edge_function` with byte-exact repo contents (same file layout as the catalog deploys — each function's files + `supabase/functions/_shared/seasonal-pricing.ts` ADDED to its file set alongside the shared files it already ships: submit-enquiry {index, weekday-promo, catalog, seasonal-pricing}; update-enquiry-by-token {index, cors, rate-limit, diff, validate, weekday-promo, catalog, seasonal-pricing}; update-enquiry-admin {index, catalog, seasonal-pricing}); verify_jwt false/false/true respectively. Confirm version increments + smoke: POST `{}` to submit-enquiry → `turnstile_failed`; bogus-uuid token to by-token → `not_found`; no-auth POST to admin → 401.
- [ ] **Step 2:** Live stamp check via `execute_sql` after the smoke of a REAL submit is impossible pre-merge (Turnstile) — instead verify the deployed module by SQL-checking a synthetic path is NOT possible; skip and rely on Deno tests + post-merge live enquiry (below).
- [ ] **Step 3:** CLAUDE.md: in the sync map, replace the "Venue base prices" row's file list note with: authoritative `_shared/seasonal-pricing.ts` (stamped into `enquiries.venue_price_eur` at submit/date-edit); consumer maps in the listed files remain as legacy-NULL fallbacks; add a new row `Seasonal venue prices | Dec 31 = 4200; Dec 1–30 & May 19–Jun 10 = 1780 Fri/Sat / 1670 Sun–Thu (annual, Europe/Sofia) | _shared/seasonal-pricing.ts (authoritative), js/seasonal-pricing.js (wizard mirror)`. DB facts: add the `venue_price_eur` column line. Commit `docs: seasonal pricing in CLAUDE.md sync map`.
- [ ] **Step 4:** Push branch, open PR to main titled `feat: seasonal venue pricing (Dec/NYE/May-Jun calendar prices)` with a body listing the rule table, the stamp architecture, functions already deployed, and a post-merge human checklist: one live test enquiry on a December date (verify stamped venue_price_eur + email total), date-edit of that enquiry to a normal date (re-stamp check), offer XLSX/PDF on it.
- [ ] **Step 5:** After Angel merges: verify live wizard shows €1780 on a December Friday and the enquiry stamp lands (SQL check on the test enquiry), then delete the test enquiry via dashboard.

## Plan Self-Review (done at write time)

- Spec coverage: module+tests (T1), column (T2), stamp+re-stamp (T3), all 7 consumers with legacy fallback (T4-T5, email select("*") verified in-task), wizard mirror+hint+summary+preview+gtag (T6), sync-map/docs/deploys/verification (T7).
- Type consistency: `effectiveVenuePrice(eventId, dateStr)` and `seasonalVenuePrice(dateStr)` names match across server module, client mirror, and all call sites; stamp column `venue_price_eur` used verbatim everywhere.
- Known scope guards: event-picker cards deliberately keep base prices; edit.html has no venue price UI (server re-stamp only); weekday promo untouched (applies to the effective price, no overlapping dates in practice).
