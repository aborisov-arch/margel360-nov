-- Idempotency flag for the one-time "your discount code is about to expire"
-- nudge sent by send-event-reminders (a code is nudged once, ~7 days before
-- expires_at, only if still unredeemed).
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS nudge_sent_at timestamptz;
