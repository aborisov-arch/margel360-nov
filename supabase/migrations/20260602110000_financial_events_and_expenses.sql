-- Manual financial bookkeeping. financial_events mirrors one row per event
-- on the income side of the monthly report; financial_expenses is the
-- free-form expense list on the right side.
-- `month` is YYYY-MM so a query by month is just an equality check.
-- All amounts stored in EUR; BGN is derived at display/export time using
-- the fixed peg of 1.95583.

CREATE TABLE IF NOT EXISTS public.financial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  event_date date,
  customer_name text NOT NULL,
  offer_total_eur numeric(12,2) DEFAULT 0,
  deposit_date date,
  deposit_cash_eur numeric(12,2) DEFAULT 0,
  deposit_bank_eur numeric(12,2) DEFAULT 0,
  balance_date date,
  balance_cash_eur numeric(12,2) DEFAULT 0,
  balance_bank_eur numeric(12,2) DEFAULT 0,
  enquiry_id uuid REFERENCES public.enquiries(id) ON DELETE SET NULL,
  notes text,
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financial_events_month_idx ON public.financial_events(month);
CREATE INDEX IF NOT EXISTS financial_events_enquiry_idx ON public.financial_events(enquiry_id);

CREATE TABLE IF NOT EXISTS public.financial_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  expense_date date,
  description text NOT NULL,
  amount_eur numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financial_expenses_month_idx ON public.financial_expenses(month);

ALTER TABLE public.financial_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_all_fin_events" ON public.financial_events;
DROP POLICY IF EXISTS "admins_all_fin_expenses" ON public.financial_expenses;
CREATE POLICY "admins_all_fin_events"   ON public.financial_events   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admins_all_fin_expenses" ON public.financial_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
