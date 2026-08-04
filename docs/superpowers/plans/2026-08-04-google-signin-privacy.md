# Google Sign-in + Privacy Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin can sign in with Google (@margel.info, existing 6-account allowlist untouched); the booking form gains a mandatory privacy-policy acceptance (client + server enforced, timestamp stored) backed by a new bilingual privacy.html. Spec: `docs/superpowers/specs/2026-08-04-google-signin-privacy-consent-design.md`.

**Architecture:** Supabase Google OAuth with identity auto-linking onto existing users (signups stay disabled → strangers rejected); `requireAuth()` gains an is_admin bounce. Privacy: new static page + required checkbox wired through the existing has-error validation pattern; `submit-enquiry` rejects payloads without `privacy_accepted: true` and stamps `privacy_accepted_at`.

**Tech Stack:** Vanilla JS static site, Supabase Auth (Google provider), Deno edge function.

## Global Constraints

- User-facing copy Bulgarian (native register), EN parity via each page's existing i18n mechanism; code/comments/commits English.
- Security model untouched: authorization stays `is_admin()` + RLS; the Google button and `hd` hint are UX only. New-user signups remain DISABLED in Supabase Auth.
- GDPR framing: the marketing checkbox stays optional and its copy unchanged; only the NEW privacy-acceptance checkbox is mandatory.
- **Deploy order (REVERSED from usual): the site PR merges FIRST, `submit-enquiry` deploys AFTER** — the currently-deployed function must keep accepting payloads without `privacy_accepted` until the new form is live, or every real booking 400s.
- Cache rule: bump `?v=N` for every touched JS in every referencing HTML. `node --check` all touched JS; `deno check` touched TS.
- Migration (additive column) applied to live `wlxutsufrobzovdsiecb` via MCP + committed to `supabase/migrations/`.
- Branch `feat/google-signin-privacy` off current local main (01197b3); one PR; merging is Angel's unless he says "merge".
- privacy.html legal-entity placeholders use the marker `[[ПОПЪЛНИ: …]]` — they MUST survive into the PR (Angel fills them); the PR body must list them.

---

### Task 1: privacy.html + translations-privacy.js

**Files:**
- Create: `website/privacy.html`
- Create: `website/js/translations-privacy.js`
- Modify: `website/sitemap.xml` (add the page)

**Interfaces:** Produces the page the Task 2 footer links and Task 3 checkbox link to (`privacy.html`).

- [ ] **Step 1:** Copy the page chrome (head/meta pattern, nav, nav-drawer, footer, script block) from `website/faq.html` — same structure, same script set adapted (`translations-privacy.js?v=1`, `main.js` current version, `cookie-consent.js` current version; no page-specific JS needed). Title BG: `Политика за поверителност | Маргел 360°`; canonical `https://margel360.bg/privacy.html`; meta description BG ~150 chars („Как Маргел 360° събира, използва и защитава личните ви данни при запитвания и резервации."). The `<main>` content (all visible strings carry `data-i18n` keys; BG defaults inline):

```html
  <main>
    <section class="section" style="padding-top:120px">
      <div class="container" style="max-width:820px">
        <h1 data-i18n="pp_title">Политика за поверителност</h1>
        <p data-i18n="pp_updated">Последна актуализация: 4 август 2026 г.</p>

        <h2 data-i18n="pp_s1_h">1. Администратор на лични данни</h2>
        <p data-i18n="pp_s1_p">Администратор на личните ви данни е [[ПОПЪЛНИ: юридическо лице]], ЕИК [[ПОПЪЛНИ: ЕИК]], със седалище и адрес на управление: [[ПОПЪЛНИ: адрес]] („Маргел 360°", „ние"). Можете да се свържете с нас на имейл 360@margel.info или на телефон +359 888 100 042.</p>

        <h2 data-i18n="pp_s2_h">2. Какви данни събираме</h2>
        <p data-i18n="pp_s2_p">При изпращане на запитване за резервация събираме: имена, имейл адрес, телефон, данни за събитието (тип, дата, брой гости, избрани услуги и напитки) и свободен текст, който сами въвеждате в полето за бележки. При изпращане на обратна връзка след събитие събираме оценката и коментара ви. При посещение на сайта се обработват технически данни (бисквитки) съгласно раздел 7.</p>

        <h2 data-i18n="pp_s3_h">3. Цели и правни основания</h2>
        <p data-i18n="pp_s3_p">Обработваме данните ви за: (а) обработка на запитването и сключване/изпълнение на договор за наем на залата — чл. 6, пар. 1, б. „б" ОРЗД; (б) комуникация по вашата резервация, включително имейли с обобщение и линк за редакция — чл. 6, пар. 1, б. „б" ОРЗД; (в) маркетингови съобщения по имейл и телефон — САМО при изрично, отделно и доброволно съгласие (чл. 6, пар. 1, б. „а" ОРЗД), което можете да оттеглите по всяко време; (г) защита на легитимните ни интереси срещу злоупотреби със сайта (ограничаване на заявки, CAPTCHA) — чл. 6, пар. 1, б. „е" ОРЗД.</p>

        <h2 data-i18n="pp_s4_h">4. Срок на съхранение</h2>
        <p data-i18n="pp_s4_p">Данните по запитвания и резервации съхраняваме до 5 години от събитието (давностни срокове по ЗЗД). Данните за маркетинг — до оттегляне на съгласието. Счетоводните документи — в законоустановените срокове.</p>

        <h2 data-i18n="pp_s5_h">5. Кой има достъп до данните</h2>
        <p data-i18n="pp_s5_p">Данните се обработват от нашия екип и от следните обработващи, с които имаме договорни отношения: Supabase (хостинг на база данни, ЕС регион Франкфурт), Netlify (хостинг на сайта), Resend (изпращане на имейли), Cloudflare (защита от злоупотреби), Google (аналитични бисквитки — само при дадено съгласие за бисквитки). Не продаваме и не предоставяме данните ви на трети лица за техни цели.</p>

        <h2 data-i18n="pp_s6_h">6. Вашите права</h2>
        <p data-i18n="pp_s6_p">Имате право на достъп, коригиране, изтриване, ограничаване на обработването, преносимост и възражение, както и право да оттеглите дадено съгласие по всяко време, без това да засяга законосъобразността на обработването преди оттеглянето. За упражняване на правата си пишете на 360@margel.info. Имате право и на жалба до Комисията за защита на личните данни (кзлд.bg / cpdp.bg).</p>

        <h2 data-i18n="pp_s7_h">7. Бисквитки</h2>
        <p data-i18n="pp_s7_p">Сайтът използва строго необходими бисквитки (избор на език, съгласие за бисквитки) и — само след ваше съгласие чрез банера — аналитични и маркетингови бисквитки (Google Analytics, Google Ads, Meta). Можете да промените избора си по всяко време, като изчистите бисквитките на браузъра си.</p>

        <h2 data-i18n="pp_s8_h">8. Промени</h2>
        <p data-i18n="pp_s8_p">Актуалната версия на тази политика е винаги на тази страница. При съществени промени ще посочим нова дата на актуализация.</p>
      </div>
    </section>
  </main>
```

- [ ] **Step 2:** `website/js/translations-privacy.js` — same shape as `translations-faq.js` (inspect it for the exact object/name convention used by main.js; typically `const pageTranslations = { en: {...}, bg: {...} }` or per-key `data-i18n` map). EN values (translate faithfully, native register; keep the `[[FILL IN: …]]` markers):
  - `pp_title`: "Privacy Policy"; `pp_updated`: "Last updated: 4 August 2026"
  - `pp_s1_h`: "1. Data controller" … `pp_s8_p`: full EN mirror of every BG paragraph above (complete text, not summaries; controller line uses `[[FILL IN: legal entity]]`, `[[FILL IN: UIC]]`, `[[FILL IN: address]]`).
  Also add `footer_privacy`: BG „Политика за поверителност" / EN "Privacy Policy" (used by Task 2).

- [ ] **Step 3:** Add to `website/sitemap.xml` following its existing `<url>` entry format: `https://margel360.bg/privacy.html`.

- [ ] **Step 4:** Verify: `node --check website/js/translations-privacy.js`; serve locally and load `privacy.html` — renders, nav/footer work, EN toggle translates every section (check 2-3 keys), no console errors.

- [ ] **Step 5:** Commit
```bash
git checkout -b feat/google-signin-privacy
git add website/privacy.html website/js/translations-privacy.js website/sitemap.xml
git commit -m "feat(site): privacy policy page (BG/EN, entity placeholders for Angel)"
```

### Task 2: footer privacy links (all public pages)

**Files:**
- Modify: every `website/*.html` with a `.footer-bottom` block (sweep — expect ~16-17 of: 404, birthday, booking, contact, corporate, drinks, edit, evening, faq, feedback, gallery, index, menu, partners, promo, reservation, services, privacy itself)
- Modify: every existing `website/js/translations-*.js` (add `footer_privacy` key to both language maps)

- [ ] **Step 1:** In each page's `.footer-bottom`, directly after the `footer_copy` `<p>`, insert:
```html
        <p style="margin-top:6px"><a href="privacy.html" data-i18n="footer_privacy" style="color:inherit">Политика за поверителност</a></p>
```
(Pages without a translations file — check each — simply keep the BG text; that is accepted.)
- [ ] **Step 2:** Add `footer_privacy` (BG „Политика за поверителност" / EN "Privacy Policy") to BOTH maps of every `translations-*.js` that exists (grep the list; skip none that have footer_copy).
- [ ] **Step 3:** Verify: `grep -L "footer_privacy" website/*.html` lists only files with no footer-bottom (name them in the report); `node --check` every touched translations file; spot-load index.html + services.html — link visible BG, switches EN.
- [ ] **Step 4:** Commit `git add -A website && git commit -m "feat(site): privacy policy footer links"`

### Task 3: mandatory checkbox on the booking form

**Files:**
- Modify: `website/reservation.html` (~line 308 — ABOVE the existing marketing consent label), `website/js/reservation.js` (submit validation ~line 906 block + payload ~line 1201), `website/js/translations-reservation.js`

- [ ] **Step 1:** reservation.html — insert BEFORE the marketing `<label class="consent-check" for="res-marketing-consent">` block:
```html
          <!-- Privacy policy acceptance - REQUIRED (blocks submission). The
               marketing consent below stays optional (GDPR: freely given). -->
          <div class="form-group" id="fg-privacy">
            <label class="consent-check" for="res-privacy-accept" style="display:flex;gap:10px;align-items:flex-start;margin:18px 0 0;font-size:0.9rem;line-height:1.45;cursor:pointer">
              <input type="checkbox" id="res-privacy-accept" name="privacy_accepted" style="margin-top:3px;flex:0 0 auto;width:18px;height:18px;cursor:pointer">
              <span><span data-i18n="res_privacy_accept">Запознах се и приемам</span> <a href="privacy.html" target="_blank" rel="noopener" data-i18n="res_privacy_link">Политиката за поверителност</a> <span aria-hidden="true">*</span></span>
            </label>
            <p class="field-error" id="privacy-error" hidden data-i18n="res_privacy_error">Моля, приемете Политиката за поверителност, за да продължите.</p>
          </div>
```
(Match the page's existing error-text markup class — inspect how other `.form-group` errors render; if the page uses pure `has-error` CSS with no text node, keep the `<p>` anyway with inline style `color:#c62828;font-size:0.85rem;margin:4px 0 0` — visible text beats a red border for a checkbox.)
- [ ] **Step 2:** reservation.js — in the final-step validation function (~line 906, the `v(el, fg, test)` block validating name/email/phone), add after the existing checks:
```js
    // Privacy policy acceptance is mandatory (server enforces it too).
    const privacyBox = document.getElementById('res-privacy-accept');
    const privacyFg = document.getElementById('fg-privacy');
    const privacyErr = document.getElementById('privacy-error');
    if (!privacyBox?.checked) {
      privacyFg?.classList.add('has-error');
      if (privacyErr) privacyErr.hidden = false;
      privacyFg?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      valid = false;
    } else {
      privacyFg?.classList.remove('has-error');
      if (privacyErr) privacyErr.hidden = true;
    }
```
(Adapt to the actual function's structure/`valid` flag; also add a `change` listener clearing the error when ticked — same UX as other fields if they do that; check.)
In the payload (~1201, next to `marketing_consent`): add `privacy_accepted: !!document.getElementById('res-privacy-accept')?.checked,`
- [ ] **Step 3:** translations-reservation.js — add to both maps: `res_privacy_accept` (BG „Запознах се и приемам" / EN "I have read and accept the"), `res_privacy_link` (BG „Политиката за поверителност" / EN "Privacy Policy"), `res_privacy_error` (BG „Моля, приемете Политиката за поверителност, за да продължите." / EN "Please accept the Privacy Policy to continue.").
- [ ] **Step 4:** Version bumps in reservation.html: reservation.js and translations-reservation.js each +1 from their current values.
- [ ] **Step 5:** Verify: `node --check` both JS; Playwright: fill the wizard to the final step, submit unchecked → error visible + no network call to submit-enquiry; tick → the submit fetch fires (Turnstile will 403 on localhost — that's fine, the point is the request LEAVES with `privacy_accepted: true` in its body; assert via request interception); EN toggle shows EN strings.
- [ ] **Step 6:** Commit `git add website/reservation.html website/js/reservation.js website/js/translations-reservation.js && git commit -m "feat(site): mandatory privacy-policy acceptance on the booking form"`

### Task 4: migration + server enforcement (submit-enquiry)

**Files:**
- Create: `supabase/migrations/20260804120000_privacy_accepted_at.sql`
- Modify: `supabase/functions/submit-enquiry/index.ts`

- [ ] **Step 1:** Migration:
```sql
-- Proof of the customer's mandatory privacy-policy acceptance at booking
-- time (reservation form checkbox, enforced by submit-enquiry). NULL =
-- booked before the checkbox existed. Never modified by the edit paths.
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;
```
Controller applies to live via MCP; verify column exists.
- [ ] **Step 2:** submit-enquiry — after the `payment_method` validation line, add:
```ts
  // Mandatory privacy-policy acceptance (GDPR record). The form blocks
  // submission client-side; this is the server guarantee + timestamp proof.
  if (payload.privacy_accepted !== true) {
    return json({ error: "invalid_field", field: "privacy_accepted" }, 400);
  }
```
and in the inserted `row` object add: `privacy_accepted_at: new Date().toISOString(),`
- [ ] **Step 3:** Verify: `deno check supabase/functions/submit-enquiry/index.ts`; `cd supabase/functions/_shared && deno test seasonal-pricing.test.ts catalog.test.ts validate.test.ts` still green (28/28 — seasonal module exists on this branch lineage only if PR #28 merged; if the test file is absent on this branch, run `catalog.test.ts validate.test.ts` 23/23 and note it).
- [ ] **Step 4:** **DO NOT DEPLOY** — deploy happens post-merge (Global Constraints). Commit `git add supabase/migrations/20260804120000_privacy_accepted_at.sql supabase/functions/submit-enquiry/index.ts && git commit -m "feat(fn): require + timestamp privacy acceptance on submit"`

### Task 5: Google sign-in button + non-admin bounce

**Files:**
- Modify: `website/admin/login.html`, `website/admin/js/login.js`, `website/admin/js/auth.js`, `website/admin/js/admin-i18n.js` (+ `?v=` bumps: admin-i18n in ALL admin pages referencing it, login.js/auth.js in their referencing pages — grep for each)

- [ ] **Step 1:** login.html — above `<form id="login-form">` insert:
```html
      <button type="button" class="btn btn-outline btn-full" id="google-login-btn" data-i18n="login_google" style="margin-bottom:14px">Вход с Google</button>
      <div style="text-align:center;color:#999;font-size:0.85rem;margin-bottom:14px" data-i18n="login_or">или с имейл и парола</div>
```
- [ ] **Step 2:** login.js — inside the existing DOMContentLoaded/init scope: 
```js
      // Google OAuth - links to the EXISTING admin user with the same
      // @margel.info email (signups are disabled, so unknown Google
      // accounts are rejected by Supabase). Authorization stays is_admin().
      document.getElementById('google-login-btn')?.addEventListener('click', async () => {
        const errEl = document.getElementById('login-error');
        errEl.style.display = 'none';
        const { error } = await db.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/admin/dashboard.html',
            queryParams: { hd: 'margel.info', prompt: 'select_account' },
          },
        });
        if (error) {
          errEl.textContent = t('login_google_error');
          errEl.style.display = 'block';
        }
      });
      // Surface OAuth/bounce errors carried back in the URL.
      {
        const qs = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const errEl = document.getElementById('login-error');
        if (qs.get('error') === 'not_admin') {
          errEl.textContent = t('login_not_admin');
          errEl.style.display = 'block';
        } else if (qs.get('error') || hash.get('error')) {
          errEl.textContent = t('login_google_error');
          errEl.style.display = 'block';
        }
      }
```
(Place using the file's actual structure; `t()` and `db` already exist there.)
- [ ] **Step 3:** auth.js `requireAuth()` — after the session check, before the is_owner block:
```js
  // Authorization gate (UX layer - RLS is the real boundary): an
  // authenticated session that is not on the admin allowlist gets signed
  // out and bounced with a message instead of a dead dashboard.
  try {
    const { data: isAdmin, error } = await db.rpc('is_admin');
    if (!error && isAdmin === false) {
      await db.auth.signOut();
      window.location.href = 'login.html?error=not_admin';
      return null;
    }
  } catch (_) { /* fail open - RLS still protects the data */ }
```
- [ ] **Step 4:** admin-i18n.js — add to both maps: `login_google` (BG „Вход с Google" / EN "Sign in with Google"), `login_or` (BG „или с имейл и парола" / EN "or with email and password"), `login_google_error` (BG „Входът с Google не успя. Опитайте отново или използвайте имейл и парола." / EN "Google sign-in failed. Try again or use email and password."), `login_not_admin` (BG „Този акаунт няма достъп до админ панела." / EN "This account does not have access to the admin panel.").
- [ ] **Step 5:** Version bumps: admin-i18n.js +1 in EVERY admin HTML referencing it (grep; ~9-10 files incl. catalog.html + login.html); login.js +1 in login.html; auth.js +1 in every admin page referencing it (grep — it's on all requireAuth pages).
- [ ] **Step 6:** Verify: `node --check` all three JS; Playwright on served site: login.html shows the button (BG), EN toggle swaps it; clicking it without the provider configured navigates toward accounts.google/Supabase error or triggers signInWithOAuth error — assert no uncaught exception and that an error message renders if the call returns one (it may redirect; in headless just assert no crash before navigation). Full OAuth can only be verified after Angel's manual step — noted for the PR checklist.
- [ ] **Step 7:** Commit `git add website/admin && git commit -m "feat(admin): Google sign-in + non-admin bounce"`

### Task 6: docs + final review + PR

- [ ] **Step 1:** CLAUDE.md: Security model → admin login paragraph gains Google OAuth (auto-link to existing users, signups disabled, non-admin bounce in requireAuth); Public form paragraph gains the mandatory privacy acceptance (client+server, `privacy_accepted_at` proof, marketing consent explicitly still optional); DB facts gains `privacy_accepted_at`; File structure mentions privacy.html. Commit `docs: google sign-in + privacy consent in CLAUDE.md`.
- [ ] **Step 2:** Final whole-branch review (fable) with the full branch diff vs merge-base; fix wave if needed.
- [ ] **Step 3:** Push; PR to main titled `feat: Google admin sign-in + mandatory privacy consent` — body MUST include: the `[[ПОПЪЛНИ]]` placeholder list Angel fills in privacy.html before/at merge; his 5-minute Google Cloud + Supabase runbook (exact URLs/values from the spec); the REVERSED deploy order (merge site → THEN controller deploys submit-enquiry); post-merge checklist (privacy page live + footer links, wizard blocks unchecked submits, real booking with checkbox works, `privacy_accepted_at` lands, Google button end-to-end after his runbook).
- [ ] **Step 4 (post-merge, controller):** deploy submit-enquiry (`verify_jwt false`, file set incl. `_shared/weekday-promo.ts`, `_shared/catalog.ts`, + `_shared/seasonal-pricing.ts` ONLY if PR #28 merged first — check! If #28 is unmerged, deploy from THIS branch's file state which has no seasonal import) — then live smoke: POST `{}` → still `turnstile_failed` (Turnstile precedes the privacy check; note actual order in the report).

## Plan Self-Review (done at write time)

- Spec coverage: page+translations (T1), footer sweep (T2), checkbox+client validation+payload (T3), migration+server enforcement with reversed deploy order (T4 + T6.4), Google button+bounce+i18n+manual runbook (T5, T6.3), docs (T6.1).
- Placeholders: only the deliberate `[[ПОПЪЛНИ]]` legal-entity markers, which the constraints REQUIRE to survive to the PR.
- Consistency: `privacy_accepted` payload key matches T3↔T4; `res-privacy-accept`/`fg-privacy`/`privacy-error` ids match T3 steps; error keys match i18n additions; deploy-order note consistent (T4.4, T6.4, Global Constraints).
- Branch note: local main includes unmerged seasonal docs commits; this branch may not contain seasonal code — T4.3 and T6.4 handle both cases explicitly.
