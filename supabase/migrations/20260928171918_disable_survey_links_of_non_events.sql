-- Survey links that went out before the 2026-09-26 sender fix to enquiries
-- that never became an event (the sender then also picked bookings that were
-- not confirmed/completed). None was answered and none has a code, a P&L or a
-- payment. Per the owner (2026-09-28), a new random token makes each old link
-- show "link not found"; feedback_sent_at stays as the record of the email.
-- Should one of them turn out to have held an event, send a link with the
-- new token.
UPDATE public.enquiries e
SET feedback_token = gen_random_uuid()
WHERE e.enquiry_number IN (1002, 1003, 1010, 1022, 1025, 1028, 1029, 1030, 1033, 1039, 1040, 1042, 1058)
  AND e.pipeline_status NOT IN ('confirmed', 'completed')
  AND e.feedback_sent_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.event_feedback f WHERE f.enquiry_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM public.discount_codes d WHERE d.issued_for_enquiry_id = e.id);
