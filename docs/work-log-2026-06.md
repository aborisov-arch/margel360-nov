# Margel 360° — Work Log (June 2026)

Record of two pieces of work completed this session: (1) fixing all email/offer sending, and (2) swapping a drink in the catalog. Plus operational notes for future deploys.

---

## 1. Email & offers were completely broken — FIXED (2026-06-24)

### Symptom
The site/admin "didn't resend any emails" and offers couldn't be sent from the admin panel.

### Root cause (confirmed, not guessed)
**Every Resend email send was being rejected because the sender domain `margel360.bg` lost its DNS verification.** Evidence:

- **Edge-function logs:** `notify-enquiry` and `send-enquiry-summary` returned **HTTP 500** right after real bookings; `send-team-digest` returned `{"error":"send_failed"}`; `send-feedback-request` reported `{"scanned":12,"eligible":1,"sent":0}` — i.e. the "200" cron senders were silently failing too. So **all** sends were failing, not just some.
- **The code was fine** — every sender does the same `fetch("https://api.resend.com/emails", { Authorization: Bearer RESEND_API_KEY, from: "Margel360 <enquiries@margel360.bg>" })`. The rejection came from Resend.
- **DNS check** (authoritative Netlify nameservers `dns*.p02.nsone.net`): the website A records resolved fine (site HTTP 200), but **every email DNS record was gone** — no DKIM (`resend._domainkey`), no SPF, no MAIL-FROM (`send.` subdomain), no DMARC.
- **Resend API confirmed it** (via a temporary read-only diagnostic edge function, since the API key isn't readable from MCP/git): API key **valid and working**; domain `margel360.bg` status = **`failed`**; region **eu-west-1**.

So: valid key, but the sender domain was un-verified because its DNS records had been removed from the Netlify DNS zone (the records didn't carry over during some DNS change — the operator reported no deliberate change).

### The fix (DNS — done by operator)
Re-added the three records Resend requires in **Netlify → Domains → margel360.bg → DNS**, then clicked **Verify** in Resend:

| Type | Name | Value | Notes |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCtMeByL+/x17M4gFxcWanABZH442ELiOfdkM+z1UhTxKtfVJf4sfK3nZk5IuxwrJ8v+qetRc0xv7HFMspSivxlaYxKbGhdGDUyqCgCm3ZresyAj/EwoMBpLasESiQUr38Vc/72KL44MlJreuFaFxURtHJJF/lxUgtbyk9o8DsRzwIDAQAB` | DKIM |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` (priority 10) | MAIL-FROM / bounces |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF |

### Verification
After re-verify, a live test send from `enquiries@margel360.bg` to the owner addresses returned **HTTP 200** with a Resend message id — email + offers confirmed working again. All temporary diagnostic functions were deleted.

### Code hardening (already on `main` from a parallel session, reconciled here)
`send-offer` now returns the **real Resend error** (`detail` / `resend_status`) instead of a generic `send_failed`, and the admin dashboard surfaces it in the toast. The deployed `send-offer` function was realigned to `main`'s canonical version (now `send-offer v8`).

### If email ever dies again — playbook
Suspect **the domain, not the key**. Check Resend → Domains → margel360.bg status; check `dig @dns1.p02.nsone.net resend._domainkey.margel360.bg TXT`. The key lives only in Supabase secrets + Resend (not in git). Memory: `margel360-email-pipeline`.

---

## 2. Drink swap: San Benedetto still → Aqua Panna 0.5 L (2026-06-26)

### Request (from the venue)
Remove the still mineral San Benedetto water and replace it with **Aqua Panna 0.5 L (plastic bottle) at €1.00**. (Kept the *sparkling* San Benedetto `benedo_spa`.)

### What changed (one commit `5df6e3d` on `main`, 10 files)
- **`website/js/drinks-data.js`** — removed `benedo_st`, added `panna50`:
  `{ id:'panna50', cat:4, name_bg:'Aqua Panna 0.5л', name_en:'Aqua Panna 0.5L', price_eur:1.00, img:'assets/images/drinks/aqua-panna-75.png' }`
- **Four `NON_ALCOHOLIC_DRINK_IDS` lists** kept in sync (dropped `benedo_st`, added `panna50`) so the new water keeps the **200-bottle cap** client- and server-side:
  - `website/admin/js/dashboard.js`
  - `supabase/functions/submit-enquiry/index.ts`
  - `supabase/functions/_shared/validate.ts`
  - `supabase/functions/update-enquiry-admin/index.ts`
- **Cache-version bumps:** `drinks-data.js?v=5→6` (reservation/menu/drinks/edit.html), `dashboard.js?v=17→18`.

### Deploys
- **Netlify** auto-built `main` → site + admin live (confirmed `panna50` served on `margel360.bg/js/drinks-data.js`).
- **Edge functions redeployed** with correct auth (verified):
  - `submit-enquiry` (verify_jwt **false**)
  - `update-enquiry-by-token` (verify_jwt **false**, imports the edited `_shared/validate.ts`)
  - `update-enquiry-admin` (verify_jwt **true** — JWT preserved)

### OPEN ITEM
The new drink uses a **placeholder image** (reuses the existing `aqua-panna-75.png` glass-bottle shot). When the venue sends the real **0.5 L plastic-bottle photo**, add it as `aqua-panna-50.png`, point `panna50.img` at it, bump `drinks-data.js?v=6→7` in the 4 HTMLs, and let Netlify redeploy.

### Drinks sync map (from CLAUDE.md) — touch every file in a row together
- Catalog source of truth: `website/js/drinks-data.js` (loaded by reservation/menu/drinks/edit).
- Alcoholic/non-alcoholic cap: front-end decides by `cat` (reservation.js/edit.js); back-end decides by the 4 `NON_ALCOHOLIC_DRINK_IDS` id-sets above. Keep the id-sets identical to drinks-data.js cat 3 & 4 ids.

---

## 3. Operational notes (important for future deploys)

- **Local git is UNUSABLE on this machine.** The repo is on the **iCloud-synced Desktop**, so `git status` / `git diff` / `git commit` / `git worktree add` all **hang/timeout** (offloaded `.git` objects). `git log` / `git fetch` work. **Recommendation: move the repo off the iCloud Desktop (e.g. to `~/dev/margel360`)** to restore normal git.
- **Deploy method used instead:** commit to `main` via the **GitHub git-data API** with `gh` — fetch each file from `main` (`gh api .../contents/<path>?ref=main -H "Accept: application/vnd.github.raw"`), edit, then blobs → tree (`base_tree`) → commit (parent = main HEAD) → `PATCH .../git/refs/heads/main`. Edge functions still deploy fine from disk via `supabase functions deploy <slug> --use-api`.
- **Gotchas hit:**
  - Pushing to `main` trips the safety classifier → needs **explicit user authorization** (then retry succeeds).
  - This shell is **zsh and loop bodies lose `PATH`** — bind `GH=$(command -v gh)` / `JQ` / `BASE64` / `TR` at top level and call via absolute paths inside loops; `${!arr[@]}` fails with "bad substitution".
  - For the commit JSON, pass message/tree/parents to `jq` via `--arg` (not `env.`).
- **Cache rule:** any JS edit under `website/` must bump its `?v=N` in the referencing HTML or returning browsers keep the stale file.
- **Edge-function verify_jwt map (get it right):** `update-enquiry-admin` and `send-offer` require JWT (deploy with **no** flag). All others deploy with `--no-verify-jwt`.

### Key infra
- Repo: `aborisov-arch/margel360-nov` · Netlify (auto-build on push to `main`) · Supabase project `wlxutsufrobzovdsiecb` (eu-central-1) · Resend sender `Margel360 <enquiries@margel360.bg>` (domain region eu-west-1).
