-- One survey reward code and one survey answer per enquiry.
-- submit-feedback checked-then-inserted: two parallel submits could mint two
-- codes for one enquiry, after which its lookup saw two rows and every
-- re-submit minted yet another 5% code. It now relies on these indexes
-- (a unique violation hands back the existing code / updates the answer).
-- No duplicates existed when this was applied.
CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_one_per_enquiry
  ON public.discount_codes (issued_for_enquiry_id)
  WHERE issued_for_enquiry_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_feedback_one_per_enquiry
  ON public.event_feedback (enquiry_id);
