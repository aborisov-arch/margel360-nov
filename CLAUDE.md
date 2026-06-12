# Margel 360° — Claude Code Guide

## Project context

Event venue in Sofia (margel360.bg) — weddings, birthdays, corporate. The site is the public-facing booking front door, paired with an internal admin platform for the team to receive enquiries and manage occupied dates, finances and offers.

**Live site:** [margel360.bg](https://margel360.bg)
**GitHub:** [aborisov-arch/margel360-nov](https://github.com/aborisov-arch/margel360-nov) — this folder is its own git repo, separate from the parent AB Intelligence repo.
**Deploy:** Netlify auto-builds on push to `main`, configured via `netlify.toml` (`base = "website"`, `publish = "."`).
**Supabase project:** `wlxutsufrobzovdsiecb` (margel360-admin-panel, eu-central-1).

Full infrastructure inventory, accounts, secrets and the new-machine runbook: **[docs/HANDOVER.md](docs/HANDOVER.md)**.

## File structure

- `website/` — public site (HTML/CSS/JS). Multi-page static; shared `style.css` and `main.js`. BG/EN i18n via per-page `translations-*.js` + `data-i18n` attributes + `localStorage` (`margel_lang`).
- `website/admin/` — internal admin panel (Supabase Auth + email allowlist): `dashboard` (enquiries CRM), `customers`, `calendar`, `feedback`, `marketing`, `financials` (per-event P&L), `templates/offer-evening.xlsx`.
- `website/js/reservation.js` — 6-step booking wizard; `edit.js` — customer magic-link edit page; `reservation-catalog.js` + `drinks-data.js` — the shared product catalog (also loaded by edit.html).
- `supabase/` — migrations (canonical since `20260609120000`), Edge Functions, `_shared/` modules.
- `docs/superpowers/` — original plans/specs; `docs/HANDOVER.md` — operations runbook.

## Deploying

- **Website/admin:** push to `main` → Netlify builds. No build step; plain static files.
- **CRITICAL cache rule:** every JS file is loaded with a `?v=N` query string in its HTML. When you edit any JS under `website/`, **bump the version in the referencing HTML** or returning browsers keep the stale file.
- **Edge functions:** `supabase functions deploy <slug> --project-ref wlxutsufrobzovdsiecb --use-api` (CLI auth lives in the macOS keychain; `--use-api` bundles `../_shared/` imports correctly).
- **verify_jwt map — get this wrong and the function breaks:** `update-enquiry-admin` and `send-offer` require JWT (deploy with NO flag — both gate on the admin email allowlist). Every other function authenticates itself (internal secret / edit token / cron secret / public form) — deploy with `--no-verify-jwt`: submit-enquiry, get-enquiry-by-token, update-enquiry-by-token, notify-enquiry, send-enquiry-summary, send-feedback-request, send-team-digest, send-event-reminders, get-feedback-by-token, submit-feedback, validate-discount-code, redeem-discount-code.
- Sanity-check JS before pushing: `node --check <file>`.

## Security model

- **RLS:** all admin tables gated by `public.is_admin()` — a 6-email allowlist (aborisov@, 360@, borisov@, office@, vitosha@, dimov@ — all @margel.info). Kept in repo migration `20260609120000_sync_is_admin_rls_with_live.sql` and duplicated in `update-enquiry-admin/index.ts` (`ADMIN_EMAILS`). Update BOTH when admins change. Anon role can only SELECT `occupied_dates`.
- **Public form:** `submit-enquiry` runs service-role inserts (anon has no table access). Protected by Cloudflare **Turnstile** (site key `0x4AAAAAADjSB9200ZicBIRp` in reservation.html; secret in Supabase secret `TURNSTILE_SECRET_KEY`; widget invalid → 403 `turnstile_failed`; siteverify *outage* fails open) + **DB-backed rate limits** via `public.rate_limit_hit(key, limit, window_seconds)`: 20/10 min per IP, 10/24 h per email. There is also a 5-minute idempotency guard (same email+event+date returns the existing enquiry instead of duplicating).
- **CORS is wildcard on purpose** (per-origin CORS broke iOS Safari with "Load failed"); Turnstile + validation are the real gate.
- **CSP** lives in `netlify.toml`; `challenges.cloudflare.com` is allowed in script/connect/frame-src. Tighten `'unsafe-inline'` only as a dedicated project.
- Customer-controlled strings (names, notes, item names) are rendered in admin pages and emails — always escape (`esc()`), and the CSV export prefixes `'` to cells starting with `= + - @` (formula injection).

## Business rules — the sync map

These constants are duplicated across layers. **When one changes, update every file in its row:**

| Rule | Value | Files |
|---|---|---|
| Venue base prices | evening 1280, corp4 330, corp8 440, bday_day 700, bday_eve 970, wedding 1500 | reservation-catalog.js, enquiry-email.ts, dashboard.js, financials.js, customers.js, marketing.js, offer-export.js (EVENT_CONFIG), offer-pdf.js (PDF_EVENT_CONFIG) |
| Venue covers / extra guest | 40 guests, +€15 each above | reservation.js, enquiry-email.ts, dashboard.js, financials.js, customers.js, marketing.js, offer-pdf.js |
| Mandatory cleaning | €70 auto-added when guests > **25** | reservation.js, edit.js (CLEANING_THRESHOLD_GUESTS) |
| Guests cap | 1..200 | reservation.js, edit.js+edit.html, submit-enquiry, _shared/validate.ts, update-enquiry-admin |
| Drink qty caps | non-alcoholic (cat 3–4) ≤ 200, alcoholic ≤ 100 | reservation.js, edit.js (by `cat`), dashboard.js + submit-enquiry + _shared/validate.ts + update-enquiry-admin (NON_ALCOHOLIC_DRINK_IDS sets — keep identical to drinks-data.js cat 3/4 ids) |
| Addon inventory caps | heater 2, heater_tbl 1, glow_table 10 | reservation.js, edit.js (ADDON_MAX_QTY) |
| Discount scope | promo % applies to the **venue base only** | reservation.js renderSummary, enquiry-email.ts, dashboard.js, financials.js, customers.js, marketing.js, offer-export.js (AC15), offer-pdf.js |
| Offer deposit / validity | deposit **50%** of total, offer valid **2 days** | offer-evening.xlsx template (AF90*0.5 + "валидна 2 дни" note), offer-pdf.js (PDF_DEPOSIT_RATE, PDF_OFFER_VALID_DAYS) |

**Payload shapes (do not break):** addons store the **LINE price** in `price` (qty folded in, furniture `freeUntil` applied) with `qty` present for stepper items; drinks store unit `price_eur` + `qty`. Item `name` is always **name_en** (both wizard and edit page) — storing BG names causes spurious diff emails and burns the customer's edit quota.

## Email pipeline

All senders are `Margel360 <enquiries@margel360.bg>` via Resend. On new booking, `submit-enquiry` directly calls (with `X-Internal-Secret`): `notify-enquiry` → plain-text to `TEAM_EMAIL`, and `send-enquiry-summary` → plain-text to `OWNER_EMAILS` + branded HTML to the customer (with edit link). Customer/admin edits re-fire `send-enquiry-summary` with a diff (Added/Removed/Changed vocabulary — preserve it). Day-after-event feedback emails go out via pg_cron → `send-feedback-request`; completed feedback mints a one-time 3% `MG-XXXX-XXXX` discount code (`submit-feedback`). Note: team currently gets TWO emails per booking (notify-enquiry + owner summary) — known duplication, consolidation pending decision.

## DB facts

- `enquiry_number` from `enquiry_number_seq`, customer-facing, starts at **1001**.
- Edit token valid **14 days from booking creation** (`set_enquiry_token_expiry`, BEFORE INSERT only).
- `enquiries_auto_block_date_trigger` inserts into `occupied_dates` when pipeline_status → confirmed/completed. `occupied_dates` is keyed by date only (no enquiry link) — dashboard delete/unlock free a date **only** when that enquiry owns it and no other confirmed enquiry shares it (keep that guard).
- `public.rate_limits` + `rate_limit_hit()` — service-role only.
- Migrations are applied via the Supabase MCP/`apply_migration` AND committed to `supabase/migrations/` — keep both in sync (the repo drifted from live once; migration `20260609120000` resynced it).

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
