-- Offer-conversion loop support.
--
-- 1. Two one-shot stamps for the offer follow-through handled by
--    send-event-reminders: offer_followup_sent_at (the ~24h "still valid"
--    nudge) and offer_expiry_handled_at (the auto-flip to 'lost' once the
--    offer validity window lapses).
--
-- 2. Auto-advance new -> contacted when an admin writes the FIRST note on a
--    still-'new' enquiry, so the funnel reflects first contact without the
--    staffer also having to change the dropdown. The status-log trigger then
--    records the new->contacted transition like any other.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS offer_followup_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_expiry_handled_at timestamptz;

CREATE OR REPLACE FUNCTION public.advance_on_first_admin_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ignore system notes (e.g. the duplicate-enquiry advisory) — only a real
  -- staff note counts as "first contact".
  IF NEW.author_email IS NULL OR NEW.author_email = 'system' THEN
    RETURN NEW;
  END IF;
  UPDATE public.enquiries
    SET pipeline_status = 'contacted'
    WHERE id = NEW.enquiry_id
      AND pipeline_status = 'new'
      AND NOT EXISTS (
        SELECT 1 FROM public.enquiry_notes n
        WHERE n.enquiry_id = NEW.enquiry_id
          AND n.id <> NEW.id
          AND COALESCE(n.author_email, '') <> 'system'
      );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enquiry_notes_advance_status_trigger ON public.enquiry_notes;
CREATE TRIGGER enquiry_notes_advance_status_trigger
  AFTER INSERT ON public.enquiry_notes
  FOR EACH ROW EXECUTE FUNCTION public.advance_on_first_admin_note();
