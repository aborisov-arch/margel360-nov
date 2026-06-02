-- Add category breakdown for both income and expenses.
-- Events: split the income across 4 categories so reports can show how
-- revenue split between venue rent, drinks, paid add-on services, and
-- everything else.
-- Expenses: a controlled-vocab category for grouping reports.

ALTER TABLE public.financial_events
  ADD COLUMN IF NOT EXISTS income_rent_eur   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS income_drinks_eur numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS income_addons_eur numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS income_other_eur  numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.financial_expenses
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('staff','catering','drinks','decoration','music','maintenance','utilities','marketing','other'));
