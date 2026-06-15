-- One-shot idempotency stamps for the send-ops-lifecycle daily function:
--   run_sheet_sent_at  — team run-sheet emailed the morning of the event
--   upsell_sent_at     — pre-event "complete your event" upsell to the customer
--   winback_sent_at    — ~1-year anniversary win-back to a past customer
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS run_sheet_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS upsell_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS winback_sent_at timestamptz;
