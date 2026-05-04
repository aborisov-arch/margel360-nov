-- Adds a jsonb column for admin-entered payment notes (bank / cash / card).
-- Applied manually via Supabase Studio on 2026-04-24 before this file was created;
-- the IF NOT EXISTS guard makes it safe to re-run on a fresh instance.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS payment_tracking jsonb NOT NULL DEFAULT '{}'::jsonb;
