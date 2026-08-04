-- Proof of the customer's mandatory privacy-policy acceptance at booking
-- time (reservation form checkbox, enforced by submit-enquiry). NULL =
-- booked before the checkbox existed. Never modified by the edit paths.
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;
