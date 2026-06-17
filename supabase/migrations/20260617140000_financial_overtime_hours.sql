-- Number of overtime hours, recorded next to the manual overtime income
-- line (income_overtime_eur) on the per-event P&L. This is a recorded
-- QUANTITY only — the € amount is still entered and owned by the
-- bookkeeper (there is no single venue-wide overtime rate to derive it
-- from). Hours give context for the amount. Additive; existing rows -> 0.
ALTER TABLE public.financial_events
  ADD COLUMN IF NOT EXISTS income_overtime_hours numeric(6,2) DEFAULT 0;
