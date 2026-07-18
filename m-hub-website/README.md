# M-HUB Warehouse & Logistic Park — website

Public website for **m-hub.zone** (Netlify site `mhub-logistic-park`,
site id `643fa0d8-884c-4165-9b5e-287416762a5a`).

## Structure

- `site/` — the deployable static site (this folder is what Netlify serves).
  - `/bg/…` and `/en/…` — Bulgarian and English versions of every page.
  - `site/_redirects` — language-aware root redirect (`/` → `/bg/`, `/en/` for English browsers).
  - `site/_headers` — caching + security headers.
  - `site/assets/` — stylesheet, logo, floor-plan images and the downloadable PDFs
    (commercial offer + architectural plan for Building 2).
- `build.py` — generates every HTML page in `site/` from one data source.
  **Edit prices/содержание here**, then run `python3 build.py` to regenerate.
  The stylesheet (`site/assets/style.css`) is a plain static file, not generated.

## Updating prices

Unit prices, totals and payment terms live in `UNITS` / `TOT` at the top of
`build.py` (they mirror the commercial offer PDF). Change them there, re-run
`python3 build.py`, and redeploy.

## Deploying

Any of:
1. **Drag & drop** — zip/drag the *contents* of `site/` into the Netlify deploys page.
2. **Netlify CLI** — `netlify deploy --prod --dir site --site 643fa0d8-884c-4165-9b5e-287416762a5a`.
3. Link this repo to the Netlify site (Site configuration → Build & deploy) —
   `netlify.toml` already sets `publish = "site"`, no build command needed.

The contact form posts via **Netlify Forms** (form name `contact`); submissions
appear in the Netlify dashboard under Forms.
