
-- Restructure event_feedback to the new 5-question shape. No real data yet so
-- we drop and recreate cleanly.
DROP TABLE IF EXISTS public.event_feedback CASCADE;

CREATE TABLE public.event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  -- Question 1: How would you rate your overall experience? (1-4)
  experience_rating  int CHECK (experience_rating  BETWEEN 1 AND 4),
  experience_comment text,
  -- Question 2: Did you like our service? (1-4)
  service_rating     int CHECK (service_rating     BETWEEN 1 AND 4),
  service_comment    text,
  -- Question 3: How did you find our hall/venue? (1-4)
  venue_rating       int CHECK (venue_rating       BETWEEN 1 AND 4),
  venue_comment      text,
  -- Question 4: How did you hear about us? One of: friends, social, google, other (+ free text if other)
  source             text CHECK (source IN ('friends','social','google','other')),
  source_other       text,
  -- Question 5: Would you book us again? (1-4)
  rebook_rating      int CHECK (rebook_rating      BETWEEN 1 AND 4),
  rebook_comment     text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_feedback_enquiry_id_idx  ON public.event_feedback(enquiry_id);
CREATE INDEX event_feedback_submitted_at_idx ON public.event_feedback(submitted_at DESC);

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_feedback"
  ON public.event_feedback FOR SELECT
  TO authenticated USING (true);
