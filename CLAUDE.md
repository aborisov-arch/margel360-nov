# Margel 360° — Claude Code Guide

## Project context

Event venue in Sofia (margel360.bg) — weddings, birthdays, corporate. The site is the public-facing booking front door, paired with an internal admin platform for the team to receive enquiries and manage occupied dates, finances and offers.

**Live site:** [margel360.bg](https://margel360.bg)
**GitHub:** [aborisov-arch/margel360-nov](https://github.com/aborisov-arch/margel360-nov) — this folder is its own git repo, separate from the parent AB Intelligence repo.
**Deploy:** Netlify auto-builds on push to `main`, configured via `netlify.toml` (`base = "website"`, `publish = "."`).
**Supabase project:** `wlxutsufrobzovdsiecb` (margel360-admin-panel, eu-central-1).

Full infrastructure inventory, accounts, secrets and the new-machine runbook: **[docs/HANDOVER.md](docs/HANDOVER.md)**.

## File structure

- `website/` — public site (HTML/CSS/JS). Multi-page static; shared `style.css` and `main.js`. BG/EN i18n via per-page `translations-*.js` + `data-i18n` attributes + `localStorage` (`margel_lang`). `partners.html` + `js/partners.js` render the public partners catalog from the `partners` table (anon read). `privacy.html` (+ `js/translations-privacy.js`) is the privacy policy; footer-linked from every public page (contains `[[ПОПЪЛНИ]]`/`[[FILL IN]]` legal-entity placeholders Angel must fill in before this is a real policy).
- `website/admin/` — internal admin panel (Supabase Auth + email allowlist): `dashboard` (enquiries CRM), `customers`, `calendar`, `feedback`, `marketing`, `partners` (public partners catalog CRUD + image upload to the `partner-images` storage bucket), `catalog` (drinks + addon-services CRUD, backed by `public.drinks`/`public.addon_services`, image upload to the `catalog-images` storage bucket), `financials` (per-event P&L), `templates/offer-evening.xlsx`.
- `website/js/reservation.js` — 7-step booking wizard; `edit.js` — customer magic-link edit page; `reservation-catalog.js` now carries only `eventTypes`/`venueIncluded`/`includedLabels` (event-type metadata incl. venue base prices; no drink/addon prices). The drinks/addon-services catalog itself lives in `public.drinks`/`public.addon_services` and is loaded at runtime by `js/catalog-db.js` (populates the `drinks`/`addonServices` globals the old static `drinks-data.js` used to define — that file is deleted); loaded on reservation/edit/drinks/menu/services pages and `admin/financials`.
- `supabase/` — migrations (canonical since `20260609120000`), Edge Functions, `_shared/` modules.
- `docs/superpowers/` — original plans/specs; `docs/HANDOVER.md` — operations runbook.

## Deploying

- **Website/admin:** push to `main` → Netlify builds. No build step; plain static files.
- **CRITICAL cache rule:** every JS file is loaded with a `?v=N` query string in its HTML. When you edit any JS under `website/`, **bump the version in the referencing HTML** or returning browsers keep the stale file.
- **Edge functions:** `supabase functions deploy <slug> --project-ref wlxutsufrobzovdsiecb --use-api` (CLI auth lives in the macOS keychain; `--use-api` bundles `../_shared/` imports correctly).
- **verify_jwt map — get this wrong and the function breaks:** `update-enquiry-admin` and `send-offer` require JWT (deploy with NO flag — both gate on the admin email allowlist). Every other function authenticates itself (internal secret / edit token / cron secret / public form) — deploy with `--no-verify-jwt`: submit-enquiry, get-enquiry-by-token, update-enquiry-by-token, notify-enquiry, send-enquiry-summary, send-feedback-request, send-team-digest, send-event-reminders, send-marketing-export, send-weekly-kpi, send-ops-lifecycle, get-feedback-by-token, submit-feedback, validate-discount-code, redeem-discount-code.
- Sanity-check JS before pushing: `node --check <file>`.
- **Deploy order matters when a function starts requiring a new payload field:** merge the site PR (form already sends the field) *before* deploying the function version that rejects requests missing it — otherwise the still-live old form's submits break. Example: `privacy_accepted` — the site PR merged first, `submit-enquiry` deployed after.

## Security model

- **RLS:** all admin tables gated by `public.is_admin()` — a 6-email allowlist (aborisov@, 360@, borisov@, office@, vitosha@, dimov@ — all @margel.info), defined **only** in repo migration `20260609120000_sync_is_admin_rls_with_live.sql`. This is the **single source of truth**: the JWT-gated edge functions (`update-enquiry-admin`, `send-offer`) authorise by calling `is_admin()` via RPC under the caller's identity (`sbUser.rpc("is_admin")`, fail-closed) — they no longer carry a copy of the list. To add/remove an admin, edit `is_admin()` in a **new** migration and apply it; nothing else to touch. Anon role can only SELECT `occupied_dates`.
- **Admin login:** Supabase email/password at `website/admin/login.html`, plus a **"Вход с Google"** OAuth button (`login.js`). Google sign-in auto-links to the same Supabase Auth identity as the matching @margel.info email — no separate account, no new-user path (Supabase signups are disabled, so an unrecognized Google account is rejected at Auth, not by app code). Either path lands an authenticated session; `requireAuth()` (auth.js) then calls `is_admin()` via RPC and, on `false`, signs the session out and bounces to `login.html?error=not_admin` (fail-open on RPC error — RLS stays the real boundary, per the `is_admin()` note above). **Note:** admin login previously also required a Cloudflare Turnstile CAPTCHA and TOTP MFA (AAL2, `security.html` enrolment) — that hardening was reverted 2026-06-17 (`155be5f`, "per request") and no longer exists in either path; admin login today is password-or-Google plus the `is_admin()` allowlist check only.
- **Public form:** `submit-enquiry` runs service-role inserts (anon has no table access). Protected by Cloudflare **Turnstile** (site key `0x4AAAAAADjSB9200ZicBIRp` in reservation.html; secret in Supabase secret `TURNSTILE_SECRET_KEY`; widget invalid → 403 `turnstile_failed`; siteverify *outage* now **fails closed** — an unverifiable token is rejected, with a 10s timeout so a hung siteverify returns a clean 403 instead of stalling) + **DB-backed rate limits** via `public.rate_limit_hit(key, limit, window_seconds)`: 20/10 min per IP, 10/24 h per email. The customer token endpoints (`get-enquiry-by-token`, `update-enquiry-by-token`) also use `rate_limit_hit` (10/min per IP) via the shared `rateLimitHit()` so the limit holds across isolates; the in-memory `rateLimit()` in `_shared/rate-limit.ts` now backs only the lower-risk feedback/discount endpoints. There is also a 5-minute idempotency guard (same email+event+date returns the existing enquiry instead of duplicating). **Privacy-policy acceptance is mandatory:** the booking form blocks submission client-side until the checkbox is ticked (`setupSubmit` in reservation.js), and `submit-enquiry` rejects `privacy_accepted !== true` with 400 `invalid_field` regardless of client-side state, stamping `enquiries.privacy_accepted_at` as proof. The separate **marketing-consent** checkbox stays optional and never blocks submission (GDPR: freely given, unrelated to this gate).
- **CORS is wildcard on purpose** (per-origin CORS broke iOS Safari with "Load failed"); Turnstile + validation are the real gate.
- **CSP** lives in `netlify.toml`; `challenges.cloudflare.com` is allowed in script/connect/frame-src. Tighten `'unsafe-inline'` only as a dedicated project.
- Customer-controlled strings (names, notes, item names) are rendered in admin pages and emails — always escape (`esc()`), and the CSV export prefixes `'` to cells starting with `= + - @` (formula injection).

## Business rules — the sync map

These constants are duplicated across layers. **When one changes, update every file in its row:**

| Rule | Value | Files |
|---|---|---|
| Venue base prices | evening 1280, corp4 330, corp8 440, bday_day 700, bday_eve 970, wedding 1500 | reservation-catalog.js, enquiry-email.ts, dashboard.js, financials.js, customers.js, marketing.js, offer-export.js (EVENT_CONFIG), offer-pdf.js (PDF_EVENT_CONFIG) |
| Venue covers / extra guest | 40 guests, +€15 each above | reservation.js, enquiry-email.ts, dashboard.js, financials.js, customers.js, marketing.js, offer-pdf.js |
| Mandatory cleaning | €70 auto-added on **every event** (no guest threshold) | reservation.js + edit.js (`autoCleaningAddon` / always-add), offer-export.js (always-on AA85), offer-pdf.js (renders the cleaning addon) |
| Guests cap | 1..200 | reservation.js, edit.js+edit.html, submit-enquiry, _shared/validate.ts, update-enquiry-admin |
| Catalog items & caps | public.drinks (cat drives 200/100 caps), public.addon_services (max_qty, free_until) | admin/catalog.html; _shared/catalog.ts reprices server-side; validate.ts keeps absolute 0..200 bound |
| Discount scope | promo % applies to the **venue base only** | reservation.js renderSummary, enquiry-email.ts, dashboard.js, financials.js, customers.js, marketing.js, offer-export.js (AC15), offer-pdf.js |
| Offer deposit / validity | deposit **50%** of total, offer valid **2 days** | offer-evening.xlsx template (AF90*0.5 + "валидна 2 дни" note), offer-pdf.js (PDF_DEPOSIT_RATE, PDF_OFFER_VALID_DAYS), send-event-reminders.ts (OFFER_VALID_DAYS — offer-expiry loop) |
| **Weekday promo (TEMPORARY, ends 2026-08-31)** | 20% off **venue base only**, events **Mon–Thu** with date ≤ 2026-08-31 (Europe/Sofia both sides); vs promo codes the **higher percent wins** and the code is NOT claimed when the promo wins; customer date edits recompute it (weekday-sourced discounts only) | `_shared/weekday-promo.ts` (**authoritative**, used by submit-enquiry + update-enquiry-by-token), reservation.js `WEEKDAY_PROMO` (summary mirror + date hint), main.js promo-bar expiry date, promo.html (copy + price table), translations-*.js `promo_bar_*`/`promo_date_hint` keys. **After 31 Aug:** remove the bar + promo.html (301 to /), strip the module + both mirrors |

**Baked static content (SEO/GEO):** `index.html #events-grid`, `services.html #services-grid`, `menu.html #menu-sections` and `gallery.html #gl-gallery-wrap` carry crawler-visible static copies of the JS catalogs (index.js events / `public.drinks` + `public.addon_services` via `catalog-db.js` / gallery.js). The JS renderer replaces them at runtime, so users never see drift — but **when a catalog changes, regenerate the corresponding baked block** or crawlers/AI engines keep citing stale names/prices. Drinks/addons are now edited live from `admin/catalog.html` (no deploy involved), so prices in the baked blocks can drift silently after a manager edit — regenerate occasionally; the runtime swap means users always see live DB prices even when the baked copy is stale.

**Payload shapes (do not break):** addons store the **LINE price** in `price` (qty folded in, furniture `freeUntil` applied) with `qty` present for stepper items; drinks store unit `price_eur` + `qty`. Item `name` is always **name_en** (both wizard and edit page) — storing BG names causes spurious diff emails and burns the customer's edit quota. The server reprices every item from the catalog on submit/edit (`_shared/catalog.ts`); an item removed from the catalog after booking is grandfathered at its stored values — drinks may only decrease qty, addons must stay unchanged.

## Email pipeline

All senders are `Margel360 <enquiries@margel360.bg>` via Resend. On new booking, `submit-enquiry` directly calls (with `X-Internal-Secret`): `notify-enquiry` → plain-text to `TEAM_EMAIL`, and `send-enquiry-summary` → plain-text to `OWNER_EMAILS` + branded HTML to the customer (with edit link). Customer/admin edits re-fire `send-enquiry-summary` with a diff (Added/Removed/Changed vocabulary — preserve it). Day-after-event feedback emails go out via pg_cron → `send-feedback-request`; completed feedback mints a one-time 3% `MG-XXXX-XXXX` discount code (`submit-feedback`). Note: team currently gets TWO emails per booking (notify-enquiry + owner summary) — known duplication, consolidation pending decision.

## DB facts

- `enquiry_number` from `enquiry_number_seq`, customer-facing, starts at **1001**.
- Edit token valid **14 days from booking creation** (`set_enquiry_token_expiry`, BEFORE INSERT only).
- `enquiries_auto_block_date_trigger` inserts into `occupied_dates` when pipeline_status → confirmed/completed. `occupied_dates` is keyed by date only (no enquiry link) — dashboard delete/unlock free a date **only** when that enquiry owns it and no other confirmed enquiry shares it (keep that guard).
- `public.rate_limits` + `rate_limit_hit()` — service-role only.
- Migrations are applied via the Supabase MCP/`apply_migration` AND committed to `supabase/migrations/` — keep both in sync (the repo drifted from live once; migration `20260609120000` resynced it).
- `public.partners` (catering|artist; anon SELECT active rows) + storage bucket `partner-images` (public read, admin write). `enquiries.partner_interest` jsonb stores the wizard's mark-interest snapshot `[{id,name,category}]` — written only by submit-enquiry; the edit paths never touch it.
- `public.drinks` + `public.addon_services` — the catalog tables (anon SELECT active rows only, admin `is_admin()` full CRUD) + storage bucket `catalog-images` (public read, admin write). The `cleaning` addon is DB-trigger-protected (`protect_cleaning_addon`) — the trigger blocks deleting it, re-keying its id, or hiding it via `active = false`. `_shared/catalog.ts` reprices every enquiry item server-side from these tables and grandfathers items removed from the catalog after booking (drinks decrease-only, addons unchanged).
- `enquiries.privacy_accepted_at` (`20260804115547_privacy_accepted_at.sql`) — timestamp set by `submit-enquiry` when the booking form's mandatory privacy checkbox is accepted. **NULL** = booked before the checkbox existed; the customer/admin edit paths never touch this column.

## Offer XLSX export (`offer-export.js` + templates/offer-evening.xlsx)

Quantities go in column AA (see `ADDON_TO_CELL`); furniture exports ordered-qty-minus-free-baseline. Cleaning has a dedicated always-on row (AA85) — the cleaning addon must stay excluded from the "Други услуги" sum. Discount: write the percent into **AC15** ("TO%"); row 87 is the labeled "отстъпка" line and total AF90 = AG86 − AG87 feeds deposit/balance.

## Gotchas

- Git identity is repo-local (`Angel Borisov <angelborisov@Angels-MacBook-Pro-2.local>`); set it again on a new machine.
- `supabase/.temp/cli-latest` gets touched by the CLI — don't commit that churn.
- The wizard's price summary and the submitted payload must always agree (auto-cleaning is added in BOTH `renderSummary` and the submit payload via `autoCleaningAddon()`).
- The edit page seeds drink quantities at form load (`seedDrinkQtys`) — moving it back into the lazy drinks panel reintroduces a data-wipe bug.
- Demo/admin logins: see the admin allowlist; passwords live with Angel.

## Open / next steps

- i18n/UX polish batch: EN path leaks Bulgarian strings (extra-guest hint, promo box), admin EN renders mixed languages, customer edit page is BG-only, accessibility gaps on steppers/tabs. Identified but not yet fixed.
- Optional: consolidate the duplicate per-booking team email.
- Check `git log` for the latest in-flight work.
