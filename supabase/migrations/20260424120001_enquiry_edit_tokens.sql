-- 1. Columns on enquiries ------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS edit_token        uuid        NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS token_expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS edit_count        int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_edited_at    timestamptz,
  ADD COLUMN IF NOT EXISTS edit_locked       boolean     NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS enquiries_edit_token_idx
  ON public.enquiries(edit_token);

-- Backfill any rows missing a token (shouldn't happen with DEFAULT, but safe).
UPDATE public.enquiries SET edit_token = gen_random_uuid() WHERE edit_token IS NULL;

-- 2. Token-expiry trigger ------------------------------------------------
-- preferred_date is stored as text in "DD/MM/YYYY" format (flatpickr d/m/Y).
-- We parse it with to_timestamp(..., 'DD/MM/YYYY') and guard with a regex so
-- malformed rows simply leave token_expires_at NULL (admin can set manually).
CREATE OR REPLACE FUNCTION public.set_enquiry_token_expiry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.token_expires_at IS NULL
     AND NEW.preferred_date IS NOT NULL
     AND NEW.preferred_date ~ '^\d{2}/\d{2}/\d{4}$' THEN
    NEW.token_expires_at := to_timestamp(NEW.preferred_date, 'DD/MM/YYYY') + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_enquiry_token_expiry ON public.enquiries;
CREATE TRIGGER trg_set_enquiry_token_expiry
  BEFORE INSERT OR UPDATE OF preferred_date ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_enquiry_token_expiry();

-- Backfill token_expires_at for existing rows with a valid DD/MM/YYYY date.
UPDATE public.enquiries
  SET token_expires_at = to_timestamp(preferred_date, 'DD/MM/YYYY') + interval '7 days'
  WHERE token_expires_at IS NULL
    AND preferred_date IS NOT NULL
    AND preferred_date ~ '^\d{2}/\d{2}/\d{4}$';

-- 3. Edit log table ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enquiry_edit_log (
  id           bigserial PRIMARY KEY,
  enquiry_id   uuid,                   -- if enquiries.id is bigint, change to bigint
  token_hash   text NOT NULL,
  ip           text,
  user_agent   text,
  action       text NOT NULL CHECK (action IN ('view','update','locked')),
  success      boolean NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enquiry_edit_log_token_hash_idx
  ON public.enquiry_edit_log(token_hash, created_at DESC);

-- 4. RLS -----------------------------------------------------------------
ALTER TABLE public.enquiries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiry_edit_log   ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies with the names we're about to create
DROP POLICY IF EXISTS enquiries_anon_insert   ON public.enquiries;
DROP POLICY IF EXISTS enquiries_auth_insert   ON public.enquiries;
DROP POLICY IF EXISTS enquiries_auth_select   ON public.enquiries;
DROP POLICY IF EXISTS enquiries_auth_update   ON public.enquiries;

-- Public reservation form inserts as anon. No SELECT/UPDATE for anon.
CREATE POLICY enquiries_anon_insert ON public.enquiries
  FOR INSERT TO anon WITH CHECK (true);

-- Same INSERT allowance for authenticated, so Angel can test the public form
-- while logged into the admin without hitting RLS.
CREATE POLICY enquiries_auth_insert ON public.enquiries
  FOR INSERT TO authenticated WITH CHECK (true);

-- Admin panel (logged-in Supabase user) can read and update.
CREATE POLICY enquiries_auth_select ON public.enquiries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY enquiries_auth_update ON public.enquiries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- enquiry_edit_log is service-role-only (edge functions). No policies for anon/authenticated =>
-- RLS denies everything except service role (which bypasses RLS).
