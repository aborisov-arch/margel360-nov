-- Overtime hourly rate (€/hour) for the per-event P&L. Overtime income is
-- now computed as income_overtime_hours × income_overtime_rate_eur and
-- stored back into income_overtime_eur on save (the monthly summary reads
-- income_overtime_eur). Events entered before this keep their manual
-- income_overtime_eur as a fallback (used when hours/rate aren't both set).
-- Additive; existing rows -> 0.
ALTER TABLE public.financial_events
  ADD COLUMN IF NOT EXISTS income_overtime_rate_eur numeric(12,2) DEFAULT 0;
