-- Third payment installment on the per-event P&L.
--
-- Some clients settle in three payments (advance + two further payments),
-- so financial_events gains a payment3_* set mirroring deposit_*/balance_*:
-- one amount per method (cash / bank / card) plus a date. All amounts EUR.
-- The P&L "paid" total (fePaid / livePaid in financials.js) sums all three
-- rows, so this is purely additive — existing rows default to 0.

ALTER TABLE public.financial_events
  ADD COLUMN IF NOT EXISTS payment3_date date,
  ADD COLUMN IF NOT EXISTS payment3_cash_eur numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment3_bank_eur numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment3_card_eur numeric(12,2) DEFAULT 0;
