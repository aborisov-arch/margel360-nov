# Google sign-in (admin) + mandatory privacy consent (booking form)

**Date:** 2026-08-04
**Status:** Approved (design), pending implementation plan

## Part A — Google sign-in for the admin panel

### Decisions (confirmed with Angel)
- margel.info mailboxes ARE Google-hosted → admins' Google accounts carry their allowlist emails.
- Email+password login stays as fallback; Google is an additional method.
- Original ask "mandatory marketing consent" was redirected to a compliant
  mandatory privacy-policy acceptance after a GDPR Art. 7(4) warning (forced
  marketing consent is invalid consent); marketing opt-in stays optional.

### Behavior
- `website/admin/login.html`: „Вход с Google" button (EN parity via
  admin-i18n) above the existing form, visually separated („или" divider).
- Click → `db.auth.signInWithOAuth({ provider: 'google', options: {
  redirectTo: <origin>/admin/dashboard.html, queryParams: { hd: 'margel.info',
  prompt: 'select_account' } } })`. The `hd` param is a UX hint only — real
  authorization stays `is_admin()` + RLS.
- Supabase auto-links the Google identity to the EXISTING user with the same
  verified email. **New-user signups remain disabled** in Supabase Auth, so a
  Google account outside the six admin users is rejected by Supabase instead
  of creating a stray user; login.js surfaces a clear BG/EN error for the
  OAuth error redirect (`?error=`/`#error=` params on return).
- Hardening in `auth.js` `requireAuth()`: after the session check, call
  `db.rpc('is_admin')`; on `false` → `signOut()` + redirect to
  `login.html?error=not_admin`, which login.js renders as „Този акаунт няма
  достъп до админ панела." (fail-open on RPC error — RLS remains the real
  boundary, this is UX).
- Password form + Turnstile + reset flow untouched.

### Manual step (Angel, ~5 min — runbook delivered with the PR)
1. Google Cloud Console → OAuth consent screen (Internal, margel.info) →
   Credentials → OAuth Client ID (Web): authorized origin
   `https://wlxutsufrobzovdsiecb.supabase.co`, redirect URI
   `https://wlxutsufrobzovdsiecb.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Providers → Google: enable, paste Client
   ID + secret.
3. Supabase → Authentication → URL Configuration: ensure
   `https://margel360.bg/admin/dashboard.html` is in the Redirect URLs list.
Until this is done the button shows Supabase's provider-disabled error —
the PR is safe to merge beforehand.

## Part B — mandatory privacy-policy acceptance

### New page `website/privacy.html`
- Bilingual (BG primary + EN via `translations-privacy.js`, standard site
  i18n pattern), standard site chrome (nav/footer), `noindex` NOT set (it
  should be indexable).
- Content: controller identity (**placeholders Angel must fill: legal entity
  name, ЕИК, address, contact email**), data collected (names, email, phone,
  event details, notes), purposes (booking processing, contractual
  communication, optional marketing with separate consent, feedback), legal
  bases, retention, processors (Supabase/EU region, Netlify, Resend,
  Cloudflare Turnstile, Google Analytics per cookie consent), data-subject
  rights incl. CPDP complaint, cookies section aligned with the existing
  cookie-consent banner, marketing opt-out note.
- **Gate: Angel reviews the drafted text before the PR merges** — legal
  document.

### Booking form changes
- `reservation.html` contact step: new required checkbox ABOVE the optional
  marketing one: „Запознах се и приемам <a href="privacy.html"
  target="_blank" rel="noopener">Политиката за поверителност</a>. *" (EN via
  translations-reservation.js). Marketing checkbox copy unchanged (stays „по
  желание").
- `reservation.js`: submit blocked until checked — same error pattern as
  other required fields (error text under the checkbox + scroll into view);
  payload gains `privacy_accepted: true`.
- Server enforcement: `submit-enquiry` rejects `privacy_accepted !== true`
  with 400 `invalid_field/privacy_accepted`; migration adds
  `enquiries.privacy_accepted_at timestamptz` stamped `now()` at insert
  (proof of consent). Legacy rows NULL. Edit paths never touch it.
- Footer of every public page gains a „Поверителност" link to privacy.html
  (mechanical sweep; EN parity per page pattern).

## Explicitly out of scope
- No change to marketing consent semantics (optional, defaults false).
- No terms-of-service document (privacy policy only, per the request).
- Feedback/edit pages don't re-ask for acceptance.

## Rollout
One branch/PR (`feat/google-signin-privacy`); migration additive (applied to
live with the usual flow); `submit-enquiry` redeploy AFTER the site PR merges
(otherwise the old form would 400 — reverse of the usual order! The old
deployed function must keep accepting payloads without the flag until the new
form is live, so: merge site first, then deploy the enforcing function).
Verification: Deno test for the new validation branch; wizard walkthrough
(unchecked → blocked with BG/EN error; checked → submits; stamp lands);
Google-button error path without provider configured; full login flow after
Angel's manual step.
