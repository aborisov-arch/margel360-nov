-- Bookkeeping should be a deliberate action. Drop the trigger that
-- auto-created a financial_events row when an enquiry was confirmed;
-- the income page now has an explicit "+ Импортирай от запитване" button
-- for the same purpose.
--
-- Keep:
-- - enquiries_auto_block_date_trigger (still useful — the calendar
--   should always reflect confirmed bookings)
-- - compute_enquiry_breakdown(enquiry) helper (the import button
--   reuses the same JS-side logic, but we leave the SQL helper in
--   place for ad-hoc queries / future use).

DROP TRIGGER IF EXISTS enquiries_auto_create_financial_event_trigger ON public.enquiries;
DROP FUNCTION IF EXISTS public.enquiries_auto_create_financial_event();
