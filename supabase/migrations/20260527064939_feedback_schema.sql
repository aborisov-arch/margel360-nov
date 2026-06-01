
-- Per-enquiry feedback magic-link token + dispatch tracker so we never send
-- the same customer two feedback emails.
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS feedback_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS feedback_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS enquiries_feedback_token_idx
  ON public.enquiries(feedback_token);

-- Categorized post-event feedback (venue/staff/food + comment).
CREATE TABLE IF NOT EXISTS public.event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  venue_rating int CHECK (venue_rating BETWEEN 1 AND 5),
  staff_rating int CHECK (staff_rating BETWEEN 1 AND 5),
  food_rating  int CHECK (food_rating  BETWEEN 1 AND 5),
  comment text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_feedback_enquiry_id_idx
  ON public.event_feedback(enquiry_id);
CREATE INDEX IF NOT EXISTS event_feedback_submitted_at_idx
  ON public.event_feedback(submitted_at DESC);

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated admins can read everything; writes happen via service_role
-- inside the submit-feedback edge function, so no INSERT policy for anon.
DROP POLICY IF EXISTS "admins_read_feedback" ON public.event_feedback;
CREATE POLICY "admins_read_feedback"
  ON public.event_feedback FOR SELECT
  TO authenticated USING (true);
