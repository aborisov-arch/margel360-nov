# Margel 360° — Operations & Handover Runbook

Last verified against live infrastructure: **2026-06-12**. Companion to [CLAUDE.md](../CLAUDE.md) (architecture, business rules, deploy commands). This file is what you need when moving to a new computer, onboarding someone, or recovering from a disaster.

## 1. Accounts & services inventory

| Service | What it holds | Identifier |
|---|---|---|
| **GitHub** | This repo — the single source of truth for all code, migrations and docs | `aborisov-arch/margel360-nov` |
| **Netlify** | Hosting + domain margel360.bg, auto-deploys `main`, security headers/CSP via `netlify.toml` | site `margell360.netlify.app` |
| **Supabase** | Postgres, Auth (admin logins), 11 Edge Functions, secrets, pg_cron | project ref `wlxutsufrobzovdsiecb`, org `osfsbjycyufbpvhxkvxr`, eu-central-1 |
| **Cloudflare** | Turnstile CAPTCHA widget (account only — DNS is NOT on Cloudflare) | widget for margel360.bg / www / margell360.netlify.app, Managed mode |
| **Resend** | Transactional email, sender domain margel360.bg | sender `Margel360 <enquiries@margel360.bg>` |

Admin allowlist (Supabase Auth logins + `is_admin()` + `update-enquiry-admin`): aborisov@, 360@, borisov@, office@, vitosha@, dimov@ — all `@margel.info`.

## 2. Secrets — names, where they live, how to restore

**No secret values are in git.** They live in two places:

**Supabase function secrets** (`supabase secrets list --project-ref wlxutsufrobzovdsiecb`):
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile server key. Rotate/re-read in the Cloudflare dashboard → Turnstile → the widget → Settings. (The public site key `0x4AAAAAADjSB9200ZicBIRp` is in `reservation.html`.)
- `RESEND_API_KEY` — rotate in the Resend dashboard.
- `INTERNAL_SHARED_SECRET` — shared header (`X-Internal-Secret`) between submit-enquiry/update-* and the email functions. If lost, generate any new random string and set it — nothing else stores it.
- `FEEDBACK_CRON_SECRET` — required header (`x-cron-secret`) for send-feedback-request. **Also stored in the Supabase Vault as `feedback_cron_secret`** (the cron jobs read it from there). If you rotate it, update BOTH the function secret and the Vault entry.
- `TEAM_DIGEST_CRON_SECRET` — required header (`x-cron-secret`) for send-team-digest (the daily team digest). **Also stored in the Supabase Vault as `team_digest_cron_secret`** (the cron jobs read it from there). Same rotate-both rule as the feedback secret. The digest is sent to `OWNER_EMAILS` (falling back to `TEAM_EMAIL`).
- `OWNER_EMAILS` (comma-separated owner notification list), `TEAM_EMAIL` (notify-enquiry recipient), `EVENT_HALL_FROM_EMAIL` (optional from-address override), `PUBLIC_SITE_URL`.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_DB_URL` etc. are auto-provided by the platform.

Set with: `supabase secrets set NAME=value --project-ref wlxutsufrobzovdsiecb` (functions restart automatically).

## 3. Scheduled jobs (pg_cron, live in the DB)

Two seasonal jobs POST to `send-feedback-request` (day-after-event feedback emails), reading the secret from the Vault:
- `send-feedback-request-summer` — `0 9 * 4-10 *` (09:00 UTC, Apr–Oct)
- `send-feedback-request-winter` — `0 10 * 1-3,11-12 *` (10:00 UTC, Nov–Mar)

Two more seasonal jobs POST to `send-team-digest` (daily morning team digest), reading `team_digest_cron_secret` from the Vault:
- `send-team-digest-summer` — `0 6 * 4-10 *` (06:00 UTC = 09:00 Sofia, Apr–Oct)
- `send-team-digest-winter` — `0 7 * 1-3,11-12 *` (07:00 UTC = 09:00 Sofia, Nov–Mar)

Two more seasonal jobs POST to `send-event-reminders` (day-before + deposit-due customer emails), reusing `team_digest_cron_secret`:
- `send-event-reminders-summer` — `0 7 * 4-10 *` (07:00 UTC = 10:00 Sofia, Apr–Oct)
- `send-event-reminders-winter` — `0 8 * 1-3,11-12 *` (08:00 UTC = 10:00 Sofia, Nov–Mar)

Inspect with `select jobname, schedule from cron.job;`. These live only in the database — if the project is ever recreated, re-create them (and the Vault secrets) by hand.

## 4. New computer — setup checklist

1. `git clone https://github.com/aborisov-arch/margel360-nov.git` (everything in sections above that is *code or docs* comes with it).
2. `git config user.name "Angel Borisov" && git config user.email "angelborisov@<machine>.local"` (repo-local identity; commits won't work without it).
3. Install the Supabase CLI (`brew install supabase/tap/supabase`), then `supabase login` (opens browser; token stored in keychain). The project link (`supabase/.temp/project-ref`) is tracked in the repo, so functions/secrets commands work immediately after login.
4. Node.js for `node --check` syntax checks (no build tooling needed — the site is plain static files).
5. Netlify/Supabase/Cloudflare/Resend need nothing — they are cloud-side and keyed to their own logins, not to the machine.
6. Optional, for Claude Code continuity: copy `~/.claude/projects/` from the old machine to carry over assistant memory. Not required — this file + CLAUDE.md contain everything needed to work cold.

## 5. Edge functions snapshot (2026-06-12)

| Function | verify_jwt | Purpose |
|---|---|---|
| submit-enquiry (v11) | no | public booking: Turnstile + rate limits + validation + dedup + service-role insert + fires both emails |
| get-enquiry-by-token (v10) | no | edit page load; scrubs internal fields |
| update-enquiry-by-token (v14) | no | customer edits; validation via `_shared/validate.ts`, diff email, edit_count cap 10 |
| update-enquiry-admin (v7) | **yes** | admin edits from edit.html?admin=1; own email-allowlist check on top |
| send-enquiry-summary (v19) | no | owner plain-text + customer branded HTML (requires X-Internal-Secret) |
| notify-enquiry (v10) | no | plain-text team email (requires X-Internal-Secret) |
| send-feedback-request (v6) | no | cron-driven feedback emails (requires x-cron-secret) |
| send-team-digest (v1) | no | cron-driven daily team digest to OWNER_EMAILS/TEAM_EMAIL (requires x-cron-secret = TEAM_DIGEST_CRON_SECRET) |
| send-event-reminders (v1) | no | cron-driven customer reminders: day-before + deposit-due (reuses x-cron-secret = TEAM_DIGEST_CRON_SECRET; POST {"dry_run":true} to preview) |
| send-offer (v1) | **yes** | admin one-click offer: emails the customer a branded cover note + the client-built offer .xlsx, stamps offer_sent_at. Own email-allowlist check on top of JWT |
| submit-feedback (v8) | no | stores feedback, mints 3% MG- discount code, emails it |
| get-feedback-by-token (v4) | no | feedback page load |
| validate-discount-code (v4) / redeem-discount-code (v4) | no | promo code check/claim |

Deploy command and the verify_jwt rule: see CLAUDE.md → Deploying.

## 6. Database snapshot

- Tables: `enquiries` (+ `enquiry_number_seq` starting 1001), `enquiry_notes`, `enquiry_edit_log`, `event_feedback`, `discount_codes`, `financial_events`, `financial_expenses`, `occupied_dates`, `rate_limits`.
- RLS: everything admin-facing behind `is_admin()`; anon may only SELECT `occupied_dates`; `rate_limits` service-role only.
- Triggers on `enquiries`: `enquiries_auto_block_date_trigger` (confirmed/completed → block date), `trg_set_enquiry_token_expiry` (token = created + 14 days).
- Migrations in `supabase/migrations/` are canonical **as of `20260609120000`** (earlier live-only hardening was back-synced then). New schema changes: apply live AND commit the file.

## 7. Where to look when something breaks

- Function errors: Supabase dashboard → Edge Functions → Logs (or MCP `get_logs`, service `edge-function`).
- Bookings failing with `turnstile_failed`: Cloudflare Turnstile dashboard (widget analytics) + check the page actually loads `challenges.cloudflare.com` (CSP in netlify.toml).
- Emails missing: Resend dashboard logs; then check `send-enquiry-summary` 401s (means `X-Internal-Secret` mismatch).
- Rate-limit lockouts: `select * from rate_limits;` — delete a row to reset a key.
- Calendar wrong: `occupied_dates` vs confirmed enquiries; remember dates are freed only by the guarded paths in dashboard.js or manually in admin calendar.
