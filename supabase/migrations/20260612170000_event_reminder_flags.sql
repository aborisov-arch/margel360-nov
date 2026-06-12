-- Idempotency flags for the customer-facing event reminders sent by the
-- send-event-reminders edge function (cron-driven, like feedback_sent_at).
-- Once set, that reminder is never re-sent for the enquiry.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_reminder_sent_at timestamptz;
