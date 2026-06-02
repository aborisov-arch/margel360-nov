-- Auto-block the venue date on the calendar when an enquiry is confirmed.
-- preferred_date is stored as text "DD/MM/YYYY" on enquiries; convert and
-- insert into occupied_dates. ON CONFLICT (date) DO NOTHING so re-running
-- the trigger (or two admins confirming the same date) is harmless.
--
-- We do NOT auto-unblock when status changes away — manual unmark in the
-- calendar UI is the explicit way to release a date, so an accidental
-- pipeline flip can't free a confirmed booking.

CREATE OR REPLACE FUNCTION public.enquiries_auto_block_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parsed_date date;
BEGIN
  IF NEW.pipeline_status NOT IN ('confirmed', 'completed') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.pipeline_status = NEW.pipeline_status THEN
    RETURN NEW;
  END IF;

  IF NEW.preferred_date !~ '^\d{2}/\d{2}/\d{4}$' THEN
    RETURN NEW;
  END IF;
  parsed_date := to_date(NEW.preferred_date, 'DD/MM/YYYY');

  INSERT INTO public.occupied_dates(date)
  VALUES (parsed_date)
  ON CONFLICT (date) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enquiries_auto_block_date_trigger ON public.enquiries;
CREATE TRIGGER enquiries_auto_block_date_trigger
  AFTER INSERT OR UPDATE OF pipeline_status ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.enquiries_auto_block_date();

-- Backfill: catch any already-confirmed enquiries whose dates aren't blocked.
INSERT INTO public.occupied_dates(date)
SELECT DISTINCT to_date(preferred_date, 'DD/MM/YYYY')
FROM public.enquiries
WHERE pipeline_status IN ('confirmed', 'completed')
  AND preferred_date ~ '^\d{2}/\d{2}/\d{4}$'
ON CONFLICT (date) DO NOTHING;
