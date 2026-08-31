# Add-on reminder drip — design (2026-08-29)

## Goal

After a customer's booking is confirmed, remind them every 3 days that they can
still complete their event with additional services, showing what is already in
their booking and what they have not added yet (with prices), with a working
link to their booking. Requested by Angel 2026-08-29.

## Decisions (agreed with Angel)

| Question | Decision |
|---|---|
| Who | `pipeline_status = 'confirmed'` with an email address |
| Cadence | every **3 days** since booking (`created_at`), first one 3 days after booking |
| Cap | **max 5 reminders per booking** (single constant; Angel can change) — an uncapped drip on a 6-months-ahead wedding would be ~60 emails |
| Quiet zone | never in the last 2 days before the event (T-1 has the day-before email, T-0 is the event) |
| Edit link | `token_expires_at` is extended to the end of the event day when a reminder goes out, so the CTA works |
| Prices | shown, EUR, from the live `public.addon_services` catalog |
| Language | `enquiries.lang` (bg/en) — same parity rule as the summary email |
| Old upsell | the 10–14-day "thin extras" upsell in `send-ops-lifecycle` is **retired** (superseded; avoids 5 emails in two weeks) |

## Where it lives

A new pass **C) add-on drip** inside the existing `send-event-reminders` edge
function. That function already runs daily at 10:00 Europe/Sofia from the
`send-event-reminders-summer/winter` pg_cron jobs with `team_digest_cron_secret`
— no new function, cron job or secret.

## Data

Migration `20260829110000_addons_reminder_drip.sql`:

```sql
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS addons_reminder_count        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addons_reminder_last_sent_at timestamptz;
```

`upsell_sent_at` stays in the table (unused after the old pass is removed).

## Eligibility (pure function, `_shared/addon-reminder.ts`)

```
eligible(e, today) =
  e.pipeline_status == 'confirmed'
  && e.email
  && eventDate parses (DD/MM/YYYY)
  && daysBetween(eventDate, today) >= 2
  && e.addons_reminder_count < 5
  && (count == 0 ? daysBetween(today, createdDay) >= 3
                 : daysBetween(today, lastSentDay) >= 3)
```

All day arithmetic is on Europe/Sofia calendar days (`today` is injected for
tests). Because the cron runs once a day and the stamp moves `last_sent_at`
forward, the ≥ 3 test yields exactly one email every 3rd day.

`missingAddons(bookingAddons, catalog)` = active catalog add-ons not in the
booking, minus `cleaning` (auto-added, DB-protected), ordered by `sort_order`.

`tokenExpiryFor(current, eventDate)` = `max(current, eventDay + 24h)`.

## Email (`_shared/addon-reminder-email.ts`)

Branded shell shared with the other reminders. Sections:

1. Heading + greeting: "Вашето събитие на {date} наближава — проверете дали не
   сте пропуснали нещо."
2. **В резервацията ви** — their add-ons (localized name + line price) and the
   number of drink positions (or "няма добавени напитки").
3. **Още не сте добавили** — the missing add-ons: name, hint (if any), price
   (`€X`, qty items `€X / бр.`).
4. CTA button → `{SITE_URL}/edit.html?token=…` ("Прегледай и допълни
   резервацията"). If `edit_locked` the button is replaced by the reply-to line.
5. Footer: reply to this email / 360@margel.info.

Subject: `Проверете резервацията си · Маргел 360° · {date}` /
`Check your booking · Margel 360° · {date}`.

## Sending (in `send-event-reminders`)

Stamp-first, roll back on send failure (same as the other passes):

1. `update enquiries set addons_reminder_count = n+1,
   addons_reminder_last_sent_at = now(), token_expires_at = tokenExpiryFor(...)`
2. Resend send
3. on failure → restore `count = n`, `last_sent_at = previous` (token
   extension is kept; harmless)

`POST {"dry_run": true}` lists the eligible set as `addon_drip`.
`POST {"preview": {"enquiry_id": "...", "to": "someone@margel.info"}}` renders
that enquiry's reminder and sends it only to `to` — no stamps, no token change.
Used for the go-live check.

## Testing

`deno test supabase/functions/_shared/` — `addon-reminder.test.ts` covers
eligibility (status, email, first send at +3d, cadence, cap, T-1/T-0 quiet
zone, malformed date), `missingAddons` (chosen / inactive / cleaning excluded,
sort order), `tokenExpiryFor`, and render smoke tests (CTA present vs locked,
BG vs EN, prices present). `deno check` on both edge functions.

## Rollout (production Supabase — confirm with Angel first)

1. Apply the migration (MCP `apply_migration`) — additive, defaulted.
2. `supabase functions deploy send-event-reminders --no-verify-jwt --use-api`
3. `supabase functions deploy send-ops-lifecycle --no-verify-jwt --use-api`
   (upsell pass removed)
4. `dry_run` → review who would be emailed; `preview` to Angel's inbox.
5. Docs: HANDOVER.md §3 + function table, CLAUDE.md email pipeline.

## Addendum (2026-08-31): items-only edit for locked bookings

Go-live revealed every confirmed booking is `edit_locked = true` — the admin's
„Потвърди резервация" button sets the lock together with `pipeline_status =
'confirmed'` (dashboard.js). Under the original design the drip's button never
rendered and the edit page refused the whole audience.

Per Angel (asked for a working add/remove button for drip recipients):

- `edit_locked` now means **items-only**, not closed: `get-enquiry-by-token`
  returns the booking with `edit_scope: "items"`; `update-enquiry-by-token`
  rejects real changes to `LOCKED_FROZEN_FIELDS` (`preferred_date`, `guests`)
  with 403 `locked_field` and accepts addon/drink/phone/notes changes. A save
  never clears an admin lock (`edit_locked: current || willLock`).
- The lifetime `EDIT_COUNT_CAP` (10) still closes a booking completely
  (403 `locked` on both endpoints, „Заключена резервация" page).
- edit.js renders items-only mode: date + guests disabled with a notice and
  the manager's phone; the reminder email now always includes the button.
