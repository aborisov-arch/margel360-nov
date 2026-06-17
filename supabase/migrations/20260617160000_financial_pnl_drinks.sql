-- Editable, auto-priced drinks on the per-event P&L.
--
-- The P&L keeps its OWN adjusted copy of the event's drinks (the booking's
-- enquiries.drinks is never mutated). Each element of the JSONB array is:
--   { id?: text, name: text, qty: number, unit_price_eur?: number, manual?: bool }
-- Line price = manual ? unit_price_eur : live drinks-data.js price by id
-- (falling back to unit_price_eur). income_drinks_eur stays as the cached
-- sum the monthly summary reads, kept in sync on save. NULL pnl_drinks means
-- "not yet adjusted" — the UI seeds it in memory from the booking on open.
ALTER TABLE public.financial_events
  ADD COLUMN IF NOT EXISTS pnl_drinks jsonb;
