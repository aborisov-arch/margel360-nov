-- Manual "DJ" and "Служители" (employees) income lines on the per-event P&L,
-- mirroring the new dj/employees expense categories. Both default to 0 so they
-- never auto-double-count the add-ons figure; the bookkeeper fills them in.
ALTER TABLE public.financial_events
  ADD COLUMN IF NOT EXISTS income_dj_eur numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS income_employees_eur numeric(12,2) DEFAULT 0;
