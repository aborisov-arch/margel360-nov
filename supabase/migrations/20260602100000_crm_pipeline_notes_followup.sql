-- CRM thin layer on top of enquiries.
--
-- pipeline_status: where the lead is in our sales pipeline. Separate from
-- `status` (the new/answered inbox flag) because they answer different
-- questions.
-- next_followup_at: when the team should ping the customer again.
-- enquiry_notes: free-form timestamped notes thread per enquiry.
-- marketing_consent: whether the contact agreed to marketing emails.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS pipeline_status text NOT NULL DEFAULT 'new'
    CHECK (pipeline_status IN ('new','contacted','quoted','confirmed','completed','lost','archived')),
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS enquiries_pipeline_status_idx ON public.enquiries(pipeline_status);
CREATE INDEX IF NOT EXISTS enquiries_followup_idx ON public.enquiries(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS enquiries_email_idx ON public.enquiries(lower(email));
CREATE INDEX IF NOT EXISTS enquiries_phone_idx ON public.enquiries(regexp_replace(phone, '[^0-9]', '', 'g'));

CREATE TABLE IF NOT EXISTS public.enquiry_notes (
  id bigserial PRIMARY KEY,
  enquiry_id uuid NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiry_notes_enquiry_id_idx ON public.enquiry_notes(enquiry_id, created_at DESC);

ALTER TABLE public.enquiry_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_notes" ON public.enquiry_notes;
DROP POLICY IF EXISTS "admins_insert_notes" ON public.enquiry_notes;
DROP POLICY IF EXISTS "admins_delete_notes" ON public.enquiry_notes;

CREATE POLICY "admins_read_notes" ON public.enquiry_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins_insert_notes" ON public.enquiry_notes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admins_delete_notes" ON public.enquiry_notes
  FOR DELETE TO authenticated USING (true);
