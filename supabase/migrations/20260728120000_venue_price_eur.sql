-- Effective venue base price (EUR) for the booking's date, stamped by
-- submit-enquiry from _shared/seasonal-pricing.ts (seasonal calendar
-- pricing: Dec 31 = 4200; Dec 1-30 and May 19 - Jun 10 = 1780 Fri/Sat,
-- 1670 Sun-Thu; otherwise the event's base price). Re-stamped by
-- update-enquiry-by-token / update-enquiry-admin when preferred_date
-- changes. NULL = legacy row; consumers fall back to their static maps.
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS venue_price_eur numeric(8,2);
