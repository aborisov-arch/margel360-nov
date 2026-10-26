# Google Calendar feed (iCal subscription) — design (2026-10-26)

## Goal

Confirmed bookings appear in the venue manager's Google Calendar
(360@margel.info) without retyping. Requested by Angel 2026-10-26. Of the three
options discussed (A iCal feed, B push via the Google Calendar API with a
service account, C per-admin Google OAuth) Angel chose **A** with the defaults
below.

## Decisions (agreed with Angel)

| Question | Decision |
|---|---|
| Mechanism | An iCal (`.ics`) feed served by a new Edge Function `calendar-feed`; the manager subscribes once in Google Calendar via „От URL адрес“. No Google credentials, nothing on Google's side to rotate. Google re-reads subscribed feeds on its own schedule (typically every 8–24 h) and the events are read-only there. |
| Who can subscribe | Every admin gets their **own** feed URL from a card on `admin/calendar.html` (per-admin token; rotate / deactivate). |
| Which bookings | `pipeline_status IN ('confirmed','completed')` — the same set that blocks the admin calendar. |
| Manual blocks | `occupied_dates` rows with no confirmed/completed booking on that date → all-day „Заето (ръчно)“. |
| Event title | „{event type in Bulgarian} — {full_name}“, e.g. „Вечерно събитие — Иван Петров“. |
| Event details | Заявка №, гости, час на пристигане / време на деня, телефон, бележки на клиента, link to the booking in the dashboard. **No prices, no email.** |
| Timed vs all-day | Timed when the start is known: evening with `arrival_time` (5 h), детски вечерен 16:00–24:00, детски дневен 12:30–17:30, корпоративно 08:00–17:30 (the booked window). All-day: сватба, evening without `arrival_time`, unknown event ids. |
| Language | Bulgarian only (the feed is team-facing). |

## Builder-check resolutions (my calls unless marked)

| Finding | Resolution |
|---|---|
| A removed admin keeps a working URL | **Design change:** the feed authorises at fetch time against the live allowlist. The admin emails move into `is_finance_admin_email(text)` / `is_admin_email(text)`; the existing `is_finance_admin()` / `is_admin()` and the `reject_non_admin_signup` trigger become thin wrappers over them (one list per tier instead of three copies). The migration ends with a self-check that raises if the lists do not match the current ones. A token whose `user_email` is no longer `is_admin_email()` answers 404. |
| Whose token is the manager's subscription | Per-admin means **the manager creates his own URL while logged in as 360@margel.info** (Angel can do it on the manager's device). The card says the address is personal to the signed-in account. Rollout step 5 updated. |
| Corporate / children's windows are longer than the sold duration | Keep the catalog windows as timed events (Angel approved them; the venue is held for the window) and add a description line „Прозорец: 08:00–17:30 (4 часа)“ so nobody reads the window as the exact start. |
| Dashboard link is not a deep link | Emit `dashboard.html#enquiry-<id>` as `customers.js` already does; deep-link support in `dashboard.js` stays out of scope. |
| Privacy policy names processors | **Angel's call**, raised with the PR: names, phones and notes will sit in Google Calendar, so `translations-privacy.js` may need Google listed as a processor. Not code; not authored here. |

## Non-goals

- Two-way sync: editing an event in Google changes nothing in the platform.
- Near-real-time updates (that is option B). The booking → event mapping is a
  pure module so B can reuse it later without redesign.
- Other pipeline statuses (new / contacted / quoted): the manager's calendar
  shows commitments only.
- Sharing the feed with customers or partners.

## Anti-goals (what would make this a failure)

- A feed URL that leaks. The URL is a bearer credential to customer names and
  phone numbers, so: only a hash is stored, the plaintext is shown once, the
  endpoint is rate-limited, every fetch is counted, and the owner's Дневник
  records who created or deactivated a URL.
- Wrong times. Timed events are emitted in UTC computed from Europe/Sofia
  (DST-aware, tested); when the start is not known the event is all-day rather
  than guessed.

## Data — migration `supabase/migrations/20261026120000_calendar_feed_tokens.sql`

Table `public.calendar_feed_tokens`:

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid not null → auth.users on delete cascade | the admin who owns the URL |
| user_email | text not null | snapshot for display / audit |
| token_hash | text not null unique | sha256 hex of the 64-hex token |
| token_prefix | text not null | first 8 chars, for „активен адрес …a1b2c3d4“ |
| created_at | timestamptz default now() | |
| revoked_at | timestamptz | null = active |
| last_fetched_at | timestamptz | stamped by the function |
| fetch_count | int default 0 | |
| last_user_agent | text | truncated to 200 chars |

- RLS on. Policy: authenticated may **SELECT** rows where `user_id = auth.uid()`
  and `public.is_admin()`. No INSERT / UPDATE / DELETE policies — writes go
  through the three RPCs below (SECURITY DEFINER).
- Allowlist helpers (same migration, before the table):
  `public.is_finance_admin_email(p_email text)` holds the 7 finance emails,
  `public.is_admin_email(p_email text)` = finance or the blog editor.
  `is_finance_admin()` / `is_admin()` are redefined as
  `select public.is_*_email(auth.jwt() ->> 'email')` (same signatures, same
  `stable` + `search_path`), and `reject_non_admin_signup()` calls
  `is_admin_email(NEW.email)`. A trailing `DO` block asserts the expected
  members and a non-member and raises otherwise, so a mistyped list cannot
  apply. Staff changes now edit the two `*_email` functions only.
- `public.calendar_feed_touch(p_token_hash text, p_user_agent text) RETURNS
  boolean` — SECURITY DEFINER, execute for `service_role` only (revoked from
  public/anon/authenticated). Finds the active row by hash whose `user_email`
  still passes `is_admin_email()`; stamps `last_fetched_at = now()`,
  `fetch_count + 1`, `last_user_agent = left(p_user_agent, 200)`; returns true.
  Otherwise false — the function treats false as 404.
- `public.create_calendar_feed_token() RETURNS text` — raises unless
  `is_admin()`; revokes the caller's active tokens; generates
  `encode(extensions.gen_random_bytes(32), 'hex')`; stores
  `encode(extensions.digest(token, 'sha256'), 'hex')` + prefix; writes one
  `audit_log` row (`table_name='calendar_feed_tokens'`, `action='INSERT'`,
  label „Google Calendar – нов адрес“, changes `{token_prefix}`); returns the
  plaintext token **once**.
- `public.revoke_calendar_feed_token() RETURNS boolean` — revokes the caller's
  active tokens, audit row `action='UPDATE'`, label „Google Calendar – адресът е
  деактивиран“; returns whether anything was active.
- Grants: `REVOKE ALL … FROM public, anon`, `GRANT EXECUTE … TO authenticated`.
- Deliberately **no** `log_audit()` trigger on the table: every Google fetch
  updates `last_fetched_at`, which would flood Дневник. The RPCs write the two
  rows that matter.
- Why a hash: a dump or a future RLS slip must not hand out working feed URLs.
  Consequence (accepted): the URL is shown only when created; a lost URL means
  „Генерирай нов адрес“ and re-adding it in Google.

## Edge Function `supabase/functions/calendar-feed/index.ts` — deploy with `--no-verify-jwt`

`GET https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/calendar-feed?token=<64 hex>`

1. Method: GET or HEAD, anything else → 405.
2. Token shape `^[a-f0-9]{64}$`, otherwise → 404 (empty body; never reveal
   whether a token exists).
3. DB-backed rate limit via the shared `rateLimitHit()`:
   `calfeed:ip:<ip>` 30 / 60 s → 429. (Google fetches a few times a day.)
4. `calendar_feed_touch(sha256(token), user-agent)` → false means unknown,
   revoked or owner no longer an admin → 404. (One round trip authorises and
   records the fetch.)
5. Load: enquiries (`id, enquiry_number, full_name, phone, event_id, event_type,
   preferred_date, time_of_day, arrival_time, guests, notes, pipeline_status,
   created_at, last_edited_at`) where status in (confirmed, completed);
   `occupied_dates.date`.
6. Window: event date ≥ today (Europe/Sofia) − 365 days, no upper bound. Rows
   whose `preferred_date` does not parse are skipped.
7. Render with `_shared/calendar-event.ts`; respond `200`,
   `Content-Type: text/calendar; charset=utf-8`,
   `Content-Disposition: inline; filename="margel360.ics"`,
   `Cache-Control: private, max-age=300`. HEAD gets the headers only.
8. No further writes: the bookkeeping happened in step 4. An RPC error (not
   `false`) is logged and answered 500.

Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (platform), `PUBLIC_SITE_URL`
(existing; dashboard links, fallback `https://margel360.bg`). No new secrets.

## Mapping module `supabase/functions/_shared/calendar-event.ts` (pure, unit-tested)

- `parsePreferredDate("DD/MM/YYYY")` → `{ y, m, d }` or `null`.
- `EVENT_SCHEDULE` — per `event_id`: `evening` → start = `arrival_time`,
  5 h; `bday_eve` 16:00–24:00; `bday_day` 12:30–17:30; `corp4`/`corp8`
  08:00–17:30; `wedding` all-day; unknown → all-day. Mirrors the
  `duration_bg` labels in `website/js/reservation-catalog.js` — goes into the
  CLAUDE.md sync map.
- `sofiaToUtc(y, m, d, hh, mm)` → `Date`, DST-aware via `Intl` (Europe/Sofia),
  tested for EET, EEST and the two transition days.
- `bookingToEvent(enquiry, { siteUrl, now })` → `CalendarEvent | null`, where
  `CalendarEvent = { uid, summary, description, start, end, allDay, location,
  url, lastModified, categories }` — storage-neutral so option B could feed the
  Google API from the same object.
- `blockToEvent(isoDate)` → all-day „Заето (ръчно)“, uid
  `block-YYYY-MM-DD@margel360.bg`.
- `buildFeedEvents(enquiries, blockedDates, opts)` → events, with a blocked
  date dropped when a booking already covers it.
- `renderIcs(events, { calName, now })` → string. `VCALENDAR` with
  `VERSION:2.0`, `PRODID:-//Margel 360//calendar-feed//BG`,
  `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME:Маргел 360° — резервации`,
  `X-WR-TIMEZONE:Europe/Sofia`, `REFRESH-INTERVAL;VALUE=DURATION:PT4H`. Each
  `VEVENT`: `UID`, `DTSTAMP`, `DTSTART`/`DTEND` (UTC `…Z` for timed; `VALUE=DATE`
  with the exclusive next-day end for all-day), `SUMMARY`, `DESCRIPTION`,
  `LOCATION`, `URL`, `STATUS:CONFIRMED`, `TRANSP:OPAQUE`, `LAST-MODIFIED`,
  `CATEGORIES`. Text escaped per RFC 5545 (`\\ \; \, \n`), CRLF line ends,
  lines folded at 75 octets on UTF-8 character boundaries (Cyrillic is
  2 bytes per character).
- UID `enq-<enquiry uuid>@margel360.bg` is stable across edits, so Google
  updates the same event in place; a booking that leaves confirmed/completed
  drops out of the feed and Google removes it on its next refresh.
- Description, one line each, omitted when empty: `Заявка № 1042`,
  `Гости: 60`, `Пристигане: 19:30` (else `timeOfDayBg()`), for the
  window-based types `Прозорец: 08:00–17:30 (4 часа)`, `Телефон: …`,
  `Бележки: …` (trimmed, max 500 chars), `Статус: Потвърдено | Приключено`,
  `Запитване: https://margel360.bg/admin/dashboard.html#enquiry-<id>`.
- `LOCATION:Маргел 360°, София`.

## Admin UI — card „Google Календар“ on `admin/calendar.html`

New `website/admin/js/calendar-feed.js?v=1` (calendar.js stays focused on the
grid); the card sits in the right-hand `aside` under „Резервации“; `toast.js`
is added to the page for feedback. Copy lives in `admin-i18n.js` under `gcal_*`
keys in **both** dictionaries (the admin panel has an EN layer); Bulgarian is
the primary text.

States:

1. Зареждане…
2. **No active URL**: one paragraph („Абонирайте се за заетите дати в Google
   Календар. Google ги обновява на всеки няколко часа.“) + button „Създай адрес
   за абонамент“.
3. **Just created** (plaintext kept in memory only): read-only input with the
   URL + „Копирай“, the Google steps (1. calendar.google.com на компютър →
   „Други календари“ → „+“ → „От URL адрес“; 2. поставете адреса; 3. „Добавяне
   на календар“ — после календарът се вижда и в приложението на телефона), and
   the warning „Адресът се показва само сега. Дава достъп до имена и телефони
   на клиенти — не го споделяйте. Ако го загубите, създайте нов.“
4. **Existing active URL** (later visits): „Активен адрес …a1b2c3d4 · създаден
   26.10.2026 · Google го изтегли последно преди 3 ч (12 пъти)“ or „все още не е
   изтеглян от Google“; buttons „Генерирай нов адрес“ (confirm: старият спира да
   работи, трябва да го добавите отново в Google) and „Деактивирай“ (confirm).

Phone layout: the aside is already full-width under 980 px; the card stacks.

## Docs

- `CLAUDE.md`: file structure (card + `calendar-feed.js`), deploy map
  (`calendar-feed` → `--no-verify-jwt`), security model paragraph (hashed
  per-admin tokens, allowlist checked at fetch time, 404 on unknown, rate
  limit, audit rows) **and the new allowlist layout** (`is_*_email()` hold the
  lists; staff changes edit those), sync-map row for `EVENT_SCHEDULE`, DB
  facts (`calendar_feed_tokens`).
- `docs/HANDOVER.md`: function inventory row, section 7 „Google Calendar не се
  обновява“ (check `last_fetched_at`, Google's refresh cadence, 404 = revoked).
- PR body: deploy command, migration apply note, Google-side steps.

## Tests

- `_shared/calendar-event.test.ts` (Deno): date parsing; Sofia → UTC in winter,
  summer and on both DST transition days; timed vs all-day per event id;
  midnight crossing (21:00 + 5 h); description lines present / omitted, never
  a price; escaping; folding of Cyrillic lines; UID determinism; the 365-day
  window; blocked date dropped when a booking covers it; ICS skeleton (CRLF,
  BEGIN/END pairs, exclusive all-day end).
- `scripts/test-calendar-feed-ui.py` (Playwright against a static server with
  the mocked `db`, like the other `scripts/test-*.py`): the four card states,
  create → URL shown + RPC called, rotate/deactivate confirmations.
- `node --check` on every edited JS file.

## Rollout (after Angel's go-ahead — nothing before)

1. PR review.
2. Apply the migration to `wlxutsufrobzovdsiecb` (Supabase MCP) — before the
   site, because the card calls the RPCs.
3. `supabase functions deploy calendar-feed --project-ref wlxutsufrobzovdsiecb --use-api --no-verify-jwt`
   — before anyone creates a URL, otherwise Google gets 404 until it is live.
4. Merge the PR (Netlify deploys the card).
5. The manager, **logged in as 360@margel.info**, opens `admin/calendar.html`
   → „Създай адрес за абонамент“ → Google Calendar on a computer → „От URL
   адрес“. (A URL created under Angel's login is Angel's and dies when Angel
   rotates his own.)
6. Verify: the card shows „Google го изтегли последно…“ after the first import
   and the bookings appear in Google.

## Left to the builder

- Exact card CSS and icon; final EN wording.
- Truncation limits (notes, user agent) and the precise rate-limit numbers.
- Whether `REFRESH-INTERVAL` / `X-PUBLISHED-TTL` are both emitted.
