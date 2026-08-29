-- Add-on reminder drip (send-event-reminders, pass C). Every 3 days after a
-- confirmed booking the customer is reminded which add-on services they have
-- not picked yet (max 5 reminders, never in the last 2 days before the event).
-- The function stamps count + last-sent before each send and rolls back on a
-- failed send; the count is also the optimistic-lock guard against a double run.
-- Spec: docs/superpowers/specs/2026-08-29-addon-reminder-drip-design.md
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS addons_reminder_count        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addons_reminder_last_sent_at timestamptz;
