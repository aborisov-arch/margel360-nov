# Financials Drift Warning + Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** „Финанси" warns when the linked enquiry changed after the P&L was last synced, and offers an explicit „Опресни от заявката" that re-seeds enquiry-derived money while preserving manual bookkeeping. Spec: `docs/superpowers/specs/2026-08-10-financials-drift-refresh-design.md`. Investigation evidence (file:line map of the entire data flow — REQUIRED READING for implementers): `.superpowers/sdd/financials-stale-investigation.md`.

**Architecture:** timestamp-based drift detection (`enquiries.last_edited_at` vs new `enquiry_synced_at` on the financial-events table) — no value diffing; refresh reuses `ensureFinancialEvent`'s own seeding logic factored into a shared helper so create and refresh can never drift apart.

**Tech Stack:** Vanilla JS admin page, one additive Postgres column.

## Global Constraints

- BG copy native register, EN parity via admin-i18n (`t()`), both maps.
- Refresh must NEVER touch: payments, expenses, notes, `manual`-flagged drink lines, bookkeeper-added service items (per the existing manual/source distinction — the investigation report documents the flags; verify at implementation and state findings).
- No automatic sync — refresh only ever runs from the confirmed button click.
- Manual events (no linked enquiry) never show the banner and have no refresh.
- Cache rule: financials.js `?v=` +1 in financials.html. `node --check` all touched JS.
- Migration additive, applied to live `wlxutsufrobzovdsiecb` via MCP by the controller AND committed (filename must match the MCP-stamped live version — controller renames after apply, established practice).
- Branch `feat/financials-refresh` off origin/main (123d5b4). One PR; joins the open queue (#27/#28/#29) — the PR body must extend the cross-PR cache-bump collision rule to financials.js (also bumped by #28: main v=41, both branches will mint v=42).

---

### Task 1: sync-stamp column + create-time stamp + shared seeding helper

**Files:**
- Create: `supabase/migrations/<timestamp>_fe_enquiry_synced_at.sql` (controller renames to live version after MCP apply)
- Modify: `website/admin/js/financials.js` (`ensureFinancialEvent` ~line 323-366 + extract its enquiry-seeding block)

**Interfaces (produced):**
- Migration: `ALTER TABLE public.<financial-events table — take the exact name from ensureFinancialEvent's .from() call> ADD COLUMN IF NOT EXISTS enquiry_synced_at timestamptz;` with a comment: stamped at P&L creation and on every „Опресни от заявката"; compared against enquiries.last_edited_at for the drift banner; NULL legacy rows fall back to created_at.
- `seedFromEnquiry(enq)` → returns the enquiry-derived column values + income items exactly as `ensureFinancialEvent` computes them today (rent incl. extra guests, service items from addons, initial drinks state). `ensureFinancialEvent` calls it and additionally sets `enquiry_synced_at: new Date().toISOString()`.

- [ ] **Step 1:** Read `ensureFinancialEvent` fully; write the migration with the real table name; extract the seeding block into `seedFromEnquiry(enq)` (pure refactor — byte-equivalent seeded values; the function must not write, only compute) and have `ensureFinancialEvent` use it + stamp `enquiry_synced_at`.
- [ ] **Step 2:** Verify: `node --check website/admin/js/financials.js`; grep that every value `ensureFinancialEvent` previously seeded is still produced (list them in the report against the investigation report's inventory).
- [ ] **Step 3:** Commit `feat(admin): financial event sync stamp + extracted enquiry seeding` (branch created in this step: `git checkout -b feat/financials-refresh origin/main` FIRST).

### Task 2: drift banner + refresh action

**Files:**
- Modify: `website/admin/js/financials.js` (P&L open/render path — the investigation report maps it), `website/admin/js/admin-i18n.js` (both maps), `website/admin/financials.html` (banner container if the DOM needs a static anchor; version bumps: financials.js +1, admin-i18n.js +1 in ALL admin pages referencing it)

**Interfaces (consumed):** Task 1's `seedFromEnquiry` + `enquiry_synced_at`.

- [ ] **Step 1:** Drift check where the P&L loads its event + enquiry (both already fetched — the report cites the join): condition `enq && enq.last_edited_at && new Date(enq.last_edited_at) > new Date(fe.enquiry_synced_at ?? fe.created_at)`. Render a banner at the top of that event's P&L: warning text + „Опресни от заявката" button (`btn btn-outline btn-sm`). i18n keys (both maps): `fin_drift_warn` BG „⚠ Заявката е променена след последното осчетоводяване." EN "⚠ The enquiry was edited after the last bookkeeping sync."; `fin_drift_refresh` BG „Опресни от заявката" EN "Refresh from enquiry"; `fin_drift_confirm` BG „Наемът, допълнителните гости, услугите и напитките ще се презаредят от заявката. Плащанията, разходите и ръчно добавените редове се запазват. Ръчни корекции по наема (напр. отстъпка) ще бъдат презаписани. Продължаваме ли?" EN "Rent, extra guests, services and drinks will be reloaded from the enquiry. Payments, expenses and manually added lines are kept. Manual rent adjustments (e.g. a discount) will be overwritten. Continue?"; `fin_drift_done` BG „Опреснено от заявката." EN "Refreshed from the enquiry."; `fin_drift_failed` BG „Опресняването не успя." EN "Refresh failed.".
- [ ] **Step 2:** Refresh handler: `confirm(t('fin_drift_confirm'))` → compute `seedFromEnquiry(liveEnquiry)` → update the financial-event row's enquiry-derived columns + replace enquiry-seeded income items + re-seed the drinks P&L state per the preservation rules (Global Constraints; the investigation report documents which rows carry a manual flag — preserve those; if service items carry no reliable seeded-vs-manual marker, replace only items whose id matches a current-or-former enquiry addon id and REPORT this limitation) → set `enquiry_synced_at = now()` → toast `fin_drift_done` → re-render. All writes through the page's existing `db` client patterns; on any error: toast `fin_drift_failed`, no partial stamp update (stamp write LAST).
- [ ] **Step 3:** Verify: `node --check`; Playwright with a seeded local scenario is impossible (admin auth) — instead do a code-trace review in the report (banner condition truth table incl. NULL stamp legacy row, manual event, fresh event) plus DOM smoke: served financials.html redirects to login with zero console errors. Real-data verification happens post-merge on the two affected events (PR checklist).
- [ ] **Step 4:** Commit `feat(admin): drift banner + refresh-from-enquiry on financials`.

### Task 3: docs + final review + PR

- [ ] **Step 1:** CLAUDE.md financials mention (File structure admin list) gains: „P&L freezes at first open; „Опресни от заявката" re-seeds after enquiry edits (banner via enquiry_synced_at vs last_edited_at)". Commit.
- [ ] **Step 2:** Final whole-branch review (fable): cross-checks = seedFromEnquiry byte-equivalence to the old inline seeding; preservation rules against the actual flags; banner condition edge cases; collision-rule completeness in the PR body vs #27/#28/#29.
- [ ] **Step 3:** Push; PR titled `fix(admin): financials drift warning + refresh from enquiry` — body: the two motivating cases (Ivan Chorbadzhakov guests; overtime/alcohol event) + post-merge step "open both events, click Опресни, verify totals match dashboard"; extended collision rule (financials.js v=42 minted by BOTH this and #28 → whichever merges second re-bumps to 43; plus the existing reservation.js/login.js rules verbatim from PR #29's body).
- [ ] **Step 4 (controller):** apply migration live via MCP when connectivity returns, rename the file to the stamped version, push the rename to the PR branch.

## Plan Self-Review
- Spec coverage: stamp+create (T1), banner+refresh+i18n+preserve rules (T2), docs/review/PR/queue rules (T3). Timestamp detection per spec (no value diffing). Manual events excluded via the enq-null guard in the banner condition.
- The seeding-refactor risk (create vs refresh drift) is eliminated structurally by the shared helper; final review re-checks byte-equivalence.
- Unknowns delegated with explicit report-back: exact table name, manual/seeded item markers — both documented in the investigation report the implementers must read.
