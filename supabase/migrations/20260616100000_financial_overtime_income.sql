-- Manual "overtime" (извънреден час) income line on the per-event P&L.
-- Entered by the bookkeeper in financials.js alongside rent/drinks/addons and
-- folded into the income total + monthly rollup.
ALTER TABLE public.financial_events
  ADD COLUMN IF NOT EXISTS income_overtime_eur numeric(12,2) DEFAULT 0;
