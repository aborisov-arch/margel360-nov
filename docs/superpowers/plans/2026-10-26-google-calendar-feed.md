# Google Calendar feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirmed/completed bookings and manual blocks are served as an iCal feed behind per-admin hashed tokens, with a card on the admin calendar page to create, rotate and deactivate one's own feed URL.

**Architecture:** A migration adds email-parameterised allowlist helpers, the `calendar_feed_tokens` table and three SECURITY DEFINER RPCs. Two pure Deno modules map a booking to a storage-neutral `CalendarEvent` and render RFC 5545 text; a thin Edge Function authorises via RPC and serves the feed. A small admin script renders the card from the admin's own token row.

**Tech Stack:** Postgres (pgcrypto in `extensions`), Deno Edge Functions, supabase-js 2.39.7, plain static admin JS, Playwright (python) UI checks.

**Spec:** `docs/superpowers/specs/2026-10-26-google-calendar-feed-design.md`

## Global Constraints

- UI copy Bulgarian first; EN strings in the second `admin-i18n.js` dictionary. Code, comments, commits English.
- Every edited `website/**/*.js` gets its `?v=` bumped in the HTML that loads it; `node --check` on each.
- No secrets in code; no new Supabase secrets needed.
- Nothing applied to project `wlxutsufrobzovdsiecb` and nothing deployed in this plan — PR only.
- Escape every customer string rendered in the admin (`esc()`); never put prices or emails in the feed.
- Deno tests: `cd supabase/functions && deno test _shared/`.

## Review Focus

1. A booking whose `preferred_date` is malformed must be skipped, not crash the feed (Task 2 test).
2. Customer text containing `,` `;` `\` or newlines must not break the ICS structure (Task 3 escaping test).
3. A token belonging to an email that left the allowlist must answer 404 (Task 1 RPC predicate; Task 4 maps `false` → 404 test by reading).
4. Evening booking at 21:00 crosses midnight — `DTEND` must land on the next day (Task 2 test).
5. The card must never show a stored URL again: only the plaintext returned by the RPC in this page load is ever rendered (Task 5 UI test asserts the input shows the fresh token and the reloaded state shows only the prefix).

---

### Task 1: Migration — allowlist helpers, token table, RPCs

**Files:**
- Create: `supabase/migrations/20261026120000_calendar_feed_tokens.sql`

**Interfaces:**
- Produces: `public.is_finance_admin_email(p_email text) returns boolean`, `public.is_admin_email(p_email text) returns boolean` (lower-cased compare, null-safe); `is_finance_admin()` / `is_admin()` / `reject_non_admin_signup()` redefined as wrappers; table `public.calendar_feed_tokens` (columns per spec); `public.create_calendar_feed_token() returns text`; `public.revoke_calendar_feed_token() returns boolean`; `public.calendar_feed_touch(p_token_hash text, p_user_agent text) returns boolean`.

- [ ] **Step 1: Write the migration.** Order: helpers → wrappers (same `stable`, `set search_path to 'public','pg_temp'`; `create or replace`, same signatures) → trigger function → table + index on `(token_hash) where revoked_at is null` → RLS select policy `calendar_feed_tokens_own_select` (`user_id = auth.uid() and public.is_admin()`) → RPCs (`security definer`, `set search_path to 'public','pg_temp'`; `create_*` raises `42501` unless `is_admin()`; token = `encode(extensions.gen_random_bytes(32),'hex')`, hash = `encode(extensions.digest(token,'sha256'),'hex')`, prefix = `left(token, 8)`; audit rows inserted directly into `public.audit_log` with `table_name='calendar_feed_tokens'`, `changed_by = auth.jwt()->>'email'`, labels „Google Calendar – нов адрес“ / „Google Calendar – адресът е деактивиран“, `changes = jsonb_build_object('token_prefix', …)`) → grants (`revoke all … from public, anon`; `grant execute` on the two admin RPCs to `authenticated`, on `calendar_feed_touch` to `service_role` only) → `DO` self-check asserting `is_admin_email('aborisov@margel.info')`, `is_admin_email('GOGOV.STIL@gmail.com')`, `is_finance_admin_email('360@margel.info')`, `not is_finance_admin_email('gogov.stil@gmail.com')`, `not is_admin_email('nobody@example.com')`, `not is_admin_email(null)`.
- [ ] **Step 2: Verify by reading** — no local Postgres. Check: every email from `20260903150000` appears exactly once per tier; `calendar_feed_touch` predicate is `revoked_at is null and public.is_admin_email(user_email)`.
- [ ] **Step 3: Commit** `feat(db): calendar feed tokens + email allowlist helpers`

### Task 2: `_shared/calendar-event.ts` — booking → CalendarEvent

**Files:**
- Create: `supabase/functions/_shared/calendar-event.ts`
- Test: `supabase/functions/_shared/calendar-event.test.ts`

**Interfaces:**
- Consumes: `eventTypeBg`, `timeOfDayBg` from `./labels-bg.ts`.
- Produces:
  ```ts
  export interface FeedEnquiry { id: string; enquiry_number: number | null; full_name: string | null; phone: string | null; event_id: string | null; event_type: string | null; preferred_date: string | null; time_of_day: string | null; arrival_time: string | null; guests: number | null; notes: string | null; pipeline_status: string | null; created_at: string | null; last_edited_at: string | null; }
  export interface CalendarEvent { uid: string; summary: string; description: string; allDay: boolean; start: Date; end: Date; location: string; url: string | null; lastModified: Date; categories: string[]; }
  export type Ymd = { y: number; m: number; d: number };
  export const EVENT_SCHEDULE: Record<string, { start?: string; end?: string; hours?: number; window?: string }>;
  export const FEED_LOCATION = "Маргел 360°, бул. Околовръстен път 155, София";
  export function parsePreferredDate(s: string | null | undefined): Ymd | null;
  export function sofiaToUtc(y: number, m: number, d: number, hh: number, mm: number): Date;
  export function sofiaToday(now: Date): Ymd;
  export function bookingToEvent(e: FeedEnquiry, opts: { siteUrl: string }): CalendarEvent | null;
  export function blockToEvent(isoDate: string): CalendarEvent;
  export function buildFeedEvents(enquiries: FeedEnquiry[], blockedDates: string[], opts: { siteUrl: string; today: Ymd; pastDays?: number }): CalendarEvent[];
  ```
  All-day events carry `start`/`end` as `Date.UTC(y, m-1, d)` midnights, `end` exclusive (next day).

- [ ] **Step 1: Write the failing tests** (`Deno.test` + `assertEquals`): `parsePreferredDate` accepts `"31/12/2026"` → `{y:2026,m:12,d:31}`, rejects `"2026-12-31"`, `""`, `null`; `sofiaToUtc(2026,1,15,19,0)` → `2026-01-15T17:00:00.000Z`; `(2026,7,15,19,0)` → `16:00Z`; `(2026,3,29,1,0)` → `2026-03-28T23:00Z`; `(2026,3,29,12,0)` → `09:00Z`; `(2026,10,25,1,0)` → `2026-10-24T22:00Z`; `(2026,10,25,12,0)` → `10:00Z`; evening with `arrival_time "21:00"` on `31/12/2026` → timed `19:00Z`–`2027-01-01T00:00Z`, summary `"Вечерно събитие — Иван Петров"`, uid `enq-<id>@margel360.bg`, categories `["Вечерно събитие"]`; `bday_eve` on `15/07/2026` → `13:00Z`–`21:00Z` and description contains `"Прозорец: 16:00–24:00 (5 часа)"`; `corp4` → `05:00Z`–`14:30Z` with `"Прозорец: 08:00–17:30 (4 часа)"`; `bday_day` → `09:30Z`–`14:30Z`; `wedding` → `allDay`, start `2026-07-15T00:00Z`, end `2026-07-16T00:00Z`; evening without `arrival_time` → allDay; `event_id "foo"` → allDay; description has lines `Заявка № 1042`, `Гости: 60`, `Време: Вечер · пристигане 19:30`, `Телефон: +359888123456`, `Бележки: …`, `Статус: Потвърдена`, `Запитване: https://margel360.bg/admin/dashboard.html#enquiry-<id>`; no `Телефон`/`Бележки` line when null/blank; notes longer than 500 chars are cut to 500 + `…`; `completed` → `Статус: Приключена`; `lastModified` = `last_edited_at` else `created_at`; malformed date → `null`; `blockToEvent("2026-11-01")` → allDay, summary `"Заето (ръчно)"`, uid `block-2026-11-01@margel360.bg`; `buildFeedEvents` with today `2026-10-26`: booking `25/10/2025` dropped, `27/10/2025` kept, future kept, blocked date covered by a booking dropped, uncovered blocked date kept, blocked date older than the window dropped.
- [ ] **Step 2: Run** `deno test _shared/calendar-event.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement.** `sofiaToUtc`: guess `Date.UTC(y,m-1,d,hh,mm)`, offset via `Intl.DateTimeFormat("en-US",{timeZone:"Europe/Sofia",hourCycle:"h23",year,month,day,hour,minute,second}).formatToParts`, subtract, re-check once. `EVENT_SCHEDULE`: `evening {hours:5}`, `bday_eve {start:"16:00",end:"24:00",window:"16:00–24:00 (5 часа)"}`, `bday_day {start:"12:30",end:"17:30",window:"до 17:30 (5 часа)"}`, `corp4 {start:"08:00",end:"17:30",window:"08:00–17:30 (4 часа)"}`, `corp8 {start:"08:00",end:"17:30",window:"08:00–17:30 (8 часа)"}`. `"24:00"` = next day 00:00.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(feed): booking to calendar-event mapping`

### Task 3: `_shared/ics.ts` — RFC 5545 rendering

**Files:**
- Create: `supabase/functions/_shared/ics.ts`
- Test: `supabase/functions/_shared/ics.test.ts`

**Interfaces:**
- Consumes: `CalendarEvent` from Task 2.
- Produces: `icsEscape(s: string): string`, `foldIcsLine(line: string): string` (CRLF-joined physical lines, ≤ 75 octets each, continuation prefixed by one space, never splitting a UTF-8 character), `icsDateTimeUtc(d: Date): string` (`20261231T190000Z`), `icsDate(d: Date): string` (`20261231`), `renderIcs(events: CalendarEvent[], opts: { calName: string; now: Date }): string`.

- [ ] **Step 1: Write the failing tests**: `icsEscape("a,b;c\\d\nx")` → `"a\\,b\\;c\\\\d\\nx"`; `foldIcsLine` of 100 Cyrillic chars → every physical line ≤ 75 bytes (`new TextEncoder().encode(l).length`), lines after the first start with `" "`, and unfolding (`replace(/\r\n /g,"")`) returns the input; `renderIcs` output starts with `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Margel 360//calendar-feed//BG\r\n`, contains `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME:Маргел 360° — резервации`, `X-WR-TIMEZONE:Europe/Sofia`, `REFRESH-INTERVAL;VALUE=DURATION:PT4H`, ends with `END:VCALENDAR\r\n`; a timed event renders `DTSTART:20261231T190000Z` / `DTEND:20270101T000000Z`; an all-day one `DTSTART;VALUE=DATE:20260715` / `DTEND;VALUE=DATE:20260716`; each VEVENT has `UID`, `DTSTAMP:` + `icsDateTimeUtc(now)`, `SUMMARY`, `DESCRIPTION` (newlines as `\n`), `LOCATION:Маргел 360°\, бул. Околовръстен път 155\, София`, `URL:` only when present, `STATUS:CONFIRMED`, `TRANSP:OPAQUE`, `LAST-MODIFIED`, `CATEGORIES`; only `\r\n` line ends (no lone `\n`); count of `BEGIN:VEVENT` equals `END:VEVENT` equals events.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** in `ics.ts`.
- [ ] **Step 4: Run** → PASS; also `deno test _shared/` (all suites).
- [ ] **Step 5: Commit** `feat(feed): ics renderer`

### Task 4: Edge Function `calendar-feed`

**Files:**
- Create: `supabase/functions/calendar-feed/index.ts`

**Interfaces:**
- Consumes: `buildFeedEvents`, `sofiaToday`, `FeedEnquiry` (Task 2); `renderIcs` (Task 3); `getIp`, `rateLimitHit` (`_shared/rate-limit.ts`); RPC `calendar_feed_touch` (Task 1).

- [ ] **Step 1: Implement** per spec steps 1–8: `serve(async (req) => …)`; `TOKEN_RE = /^[a-f0-9]{64}$/`; `rateLimitHit(sb, \`calfeed:ip:${ip}\`, 30, 60)`; `sha256` as in `get-enquiry-by-token`; `sb.rpc("calendar_feed_touch", { p_token_hash, p_user_agent })` — `error` → 500 `feed_unavailable` (text), `data !== true` → 404 empty; select the `FeedEnquiry` columns `.in("pipeline_status", ["confirmed","completed"])`; `occupied_dates.select("date")`; `siteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://margel360.bg").replace(/\/$/, "")`; `renderIcs(events, { calName: "Маргел 360° — резервации", now: new Date() })`; headers per spec; HEAD → same headers, `null` body. No CORS headers (not a browser endpoint).
- [ ] **Step 2: Verify** `deno check calendar-feed/index.ts` → no errors.
- [ ] **Step 3: Commit** `feat(feed): calendar-feed edge function`

### Task 5: Admin card „Google Календар“

**Files:**
- Modify: `website/admin/calendar.html` (aside markup + styles, `toast.js?v=2`, `calendar-feed.js?v=1`, bump `calendar.js?v=7`, `admin-i18n.js?v=33`)
- Modify: `website/admin/js/calendar.js` (after `requireAuth()`: `if (typeof initCalendarFeedCard === 'function') initCalendarFeedCard(session);`)
- Create: `website/admin/js/calendar-feed.js`
- Modify: `website/admin/js/admin-i18n.js` (`gcal_*` keys in `en` and `bg`), every other admin page's `admin-i18n.js?v=` bump (grep `admin-i18n.js?v=32`)
- Modify: `website/admin/js/activity.js` (`TABLE_LABELS` bg `calendar_feed_tokens: 'Google Calendar – адрес за абонамент'`, en `'Google Calendar feed URL'`) + bump in `activity.html`
- Test: `scripts/test-calendar-feed-ui.py`

**Interfaces:**
- Produces: global `initCalendarFeedCard(session)`; reads `SUPABASE_URL` from `supabase-client.js`; RPCs `create_calendar_feed_token`, `revoke_calendar_feed_token`; select `calendar_feed_tokens` (`token_prefix, created_at, last_fetched_at, fetch_count`, `.is('revoked_at', null)`, newest first, `maybeSingle()`).

- [ ] **Step 1: Write the failing UI test** (pattern of `scripts/test-glassware-admin.py`, static server on :8767, `db` stub whose `rpc('create_calendar_feed_token')` returns a 64-hex string and records calls, `from('calendar_feed_tokens')` returns the configured row via `maybeSingle`): (a) no row → `#gcal-card` shows button text `Създай адрес за абонамент`; click → input `#gcal-url` value equals `https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/calendar-feed?token=<token>`, the warning and the three steps are visible, rpc call recorded; (b) reload with a row `{token_prefix:'abcd1234', created_at: now-2d, last_fetched_at: now-3h, fetch_count: 12}` → text contains `…abcd1234`, `преди 3 ч`, `12`; no `<input>` in the card; (c) `window.confirm = () => true`, click „Генерирай нов адрес“ → rpc called again and the input shows the new token; (d) click „Деактивирай“ → `revoke_calendar_feed_token` called and the empty state returns; no page errors; viewport 1280 and 390 both without horizontal overflow.
- [ ] **Step 2: Run** `python3 -m http.server 8767 -d website` (background) + `python3 scripts/test-calendar-feed-ui.py` → FAIL.
- [ ] **Step 3: Implement** markup, styles (`.gcal-*` in the page `<style>`, reuse `.btn .btn-primary .btn-outline .btn-sm`), `calendar-feed.js` (states 1–4, `esc()`, `agoText(date)` → „преди N мин/ч/дни“ with EN via `t()`, clipboard with `execCommand` fallback, `showToast`), i18n keys, activity label, version bumps.
- [ ] **Step 4: Run** the UI test → PASS; `node --check` on the four JS files; `python3 scripts/test-mobile-admin.py` still passes (calendar route included).
- [ ] **Step 5: Commit** `feat(admin): Google Calendar feed card on the calendar page`

### Task 6: Docs

**Files:**
- Modify: `CLAUDE.md` (file structure; deploy map; security model — allowlist helpers + feed tokens; sync map row `Calendar event windows`; DB facts)
- Modify: `docs/HANDOVER.md` (section 5 row for `calendar-feed`; section 7 entry)

- [ ] **Step 1: Edit** both files per spec „Docs“.
- [ ] **Step 2: Commit** `docs: calendar feed + allowlist helper layout`

### Task 7: Verification, review, PR

- [ ] **Step 1:** `cd supabase/functions && deno test _shared/` → all pass; `deno check calendar-feed/index.ts`; `node --check` on every edited JS; UI test green.
- [ ] **Step 2:** Fresh reviewer (code-reviewer subagent) on the branch diff; fix CRITICAL/HIGH.
- [ ] **Step 3:** Push `worktree-google-calendar-feed`, `gh pr create --base main` with: summary, migration path, deploy command `supabase functions deploy calendar-feed --project-ref wlxutsufrobzovdsiecb --use-api --no-verify-jwt`, rollout order (migration → function → merge → manager creates URL as 360@), Google-side steps, the privacy-policy question for Angel, test plan.
