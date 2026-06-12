-- Pipeline transition log. Until now pipeline_status changes were not
-- timestamped anywhere, so "won/lost this week" could not be computed.
-- A log table (rather than a single changed_at column) survives later
-- transitions — confirmed → completed keeps the original "won" row.
--
-- Fed by a SECURITY DEFINER trigger so dashboard admins (authenticated role)
-- can update enquiries without needing INSERT rights on the log.

CREATE TABLE IF NOT EXISTS public.enquiry_status_log (
  id bigserial PRIMARY KEY,
  enquiry_id uuid NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiry_status_log_changed_idx ON public.enquiry_status_log(changed_at);
CREATE INDEX IF NOT EXISTS enquiry_status_log_enquiry_idx ON public.enquiry_status_log(enquiry_id);

ALTER TABLE public.enquiry_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins_read_status_log" ON public.enquiry_status_log;
CREATE POLICY "admins_read_status_log" ON public.enquiry_status_log
  FOR SELECT TO authenticated USING (public.is_admin());
-- No INSERT/UPDATE/DELETE policies: writes happen only through the trigger
-- below (SECURITY DEFINER) and the service role.

CREATE OR REPLACE FUNCTION public.log_enquiry_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.enquiry_status_log (enquiry_id, from_status, to_status)
    VALUES (NEW.id, NULL, COALESCE(NEW.pipeline_status, 'new'));
  ELSIF NEW.pipeline_status IS DISTINCT FROM OLD.pipeline_status THEN
    INSERT INTO public.enquiry_status_log (enquiry_id, from_status, to_status)
    VALUES (NEW.id, OLD.pipeline_status, NEW.pipeline_status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enquiries_log_status_change_trigger ON public.enquiries;
CREATE TRIGGER enquiries_log_status_change_trigger
  AFTER INSERT OR UPDATE OF pipeline_status ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.log_enquiry_status_change();
