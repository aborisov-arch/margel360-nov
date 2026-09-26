-- The post-event survey reward went from 3% to 5% off the hall rent on
-- 2026-09-26 (_shared/feedback-reward.ts). Per the owner, survey codes
-- already issued at 3% and still unused are raised to 5% too.
UPDATE public.discount_codes
SET percent = 5
WHERE percent = 3
  AND redeemed_at IS NULL
  AND expires_at > now()
  AND issued_for_enquiry_id IS NOT NULL;
