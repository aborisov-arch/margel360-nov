-- Fix: token_expires_at must be recomputed when preferred_date changes, not
-- only on INSERT. Also extends the default validity window from 7 to 14 days
-- after the event date (per product feedback).

CREATE OR REPLACE FUNCTION public.set_enquiry_token_expiry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.preferred_date IS NOT NULL
     AND NEW.preferred_date ~ '^\d{2}/\d{2}/\d{4}$'
     AND (TG_OP = 'INSERT' OR NEW.preferred_date IS DISTINCT FROM OLD.preferred_date) THEN
    NEW.token_expires_at := to_timestamp(NEW.preferred_date, 'DD/MM/YYYY') + interval '14 days';
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill: extend any existing expiries to preferred_date + 14 days.
UPDATE public.enquiries
  SET token_expires_at = to_timestamp(preferred_date, 'DD/MM/YYYY') + interval '14 days'
  WHERE preferred_date IS NOT NULL
    AND preferred_date ~ '^\d{2}/\d{2}/\d{4}$';
