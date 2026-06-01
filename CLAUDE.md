# Margel 360° — Claude Code Guide

## Project context

Event venue in Sofia (margel360.bg) — weddings, birthdays, corporate. The site is the public-facing booking front door, paired with an internal admin platform for the team to receive enquiries and manage occupied dates.

**Live site:** [margel360.bg](https://margel360.bg)  
**GitHub:** [aborisov-arch/margel360-nov](https://github.com/aborisov-arch/margel360-nov) — this folder is its own git repo, separate from the parent AB Intelligence repo.  
**Deploy:** Netlify, configured via `netlify.toml` (`base = "website"`, `publish = "."`).

## What's different from the parent AB Intelligence CLAUDE.md

The root [CLAUDE.md](../../CLAUDE.md) applies. Departures:

- **Supabase backend** — Postgres + Auth + Edge Functions for the enquiry inbox, calendar, and email notifications. Backend code lives in `supabase/`. Edge Functions are deployed via the Supabase CLI, not Netlify.
- **Resend** for transactional email on new enquiry (admin notification + customer confirmation).
- **Admin panel** at `website/admin/` — plain HTML/CSS/JS but gated by Supabase Auth on every page load.
- **Edit-token flow** for customers to amend their own enquiry without an account (token is emailed, expires after 14 days).

## File structure

- `website/` — public site (HTML/CSS/JS). Multi-page static; shared `style.css` and `main.js`. BG/EN i18n via per-page `translations.js` + `data-i18n` attributes + `localStorage` for language preference.
- `website/admin/` — internal admin panel (login-protected).
- `supabase/` — migrations, Edge Functions (`notify-enquiry/`, shared validators), config.
- `docs/superpowers/plans/` and `specs/` — implementation plans and design specs (website rebuild, event management platform, SEO/GEO).

## Things to know

- **Reservation form** posts a JSON payload to a Supabase Edge Function via a database webhook.
- **Email diff** (`enquiry-email.ts`) shows owner-readable diffs as Added / Removed / Changed when an enquiry is updated — preserve that vocabulary.
- **EXCLUDE constraints via `btree_gist`** prevent double-booking at the database level. Keep that — application-level checks alone aren't safe.

## Currency / pricing notes

- Site shows prices in EUR.
- Overtime hints follow the convention "in EUR", with valet rounded to €25/hour (per recent commits).

## Open / next steps

Check `git log` and `docs/superpowers/plans/*.md` for the latest in-flight work — there are usually multiple parallel threads (admin panel iteration, SEO/GEO, drinks menu images, etc.).
