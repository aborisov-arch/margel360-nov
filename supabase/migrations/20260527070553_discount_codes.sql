
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  percent int NOT NULL CHECK (percent BETWEEN 1 AND 100),
  -- The enquiry that earned the code (via feedback submission).
  issued_for_enquiry_id uuid REFERENCES public.enquiries(id) ON DELETE SET NULL,
  -- The enquiry that redeemed it (the next booking).
  redeemed_for_enquiry_id uuid REFERENCES public.enquiries(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discount_codes_code_idx ON public.discount_codes(code);
CREATE INDEX IF NOT EXISTS discount_codes_issued_idx ON public.discount_codes(issued_for_enquiry_id);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins_read_codes" ON public.discount_codes;
CREATE POLICY "admins_read_codes"
  ON public.discount_codes FOR SELECT
  TO authenticated USING (true);

-- Track which code (if any) was used on each enquiry.
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS applied_discount_code text,
  ADD COLUMN IF NOT EXISTS applied_discount_percent int;
