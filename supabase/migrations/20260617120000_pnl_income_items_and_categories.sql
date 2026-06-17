-- Itemized additional-services income + aligned income/expense categories.
--
-- Until now the income side of a per-event P&L stored paid add-on services
-- as a single number (financial_events.income_addons_eur). This migration
-- adds financial_income_items so the bookkeeper can record each service as
-- its own categorized line (mirroring financial_expenses), and aligns the
-- expense category vocabulary to the same buckets plus running-cost
-- essentials — fixing a latent bug where the old CHECK constraint rejected
-- the 'employees' and 'dj' categories the UI already offered.
--
-- All amounts in EUR; BGN derived at display time (peg 1.95583).

-- ── 1. Itemized income services ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_income_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.financial_events(id) ON DELETE CASCADE,
  month text,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('photo_video','decoration','pyro_lighting','music_dj','furniture','staff_service','other')),
  amount_eur numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financial_income_items_event_idx ON public.financial_income_items(event_id);
CREATE INDEX IF NOT EXISTS financial_income_items_month_idx ON public.financial_income_items(month);

-- Same admin-allowlist gate as financial_events / financial_expenses
-- (see 20260609120000): authorise via is_admin(), NOT a blanket USING(true)
-- which would expose financial data to any authenticated user.
ALTER TABLE public.financial_income_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins_all_fin_income_items" ON public.financial_income_items;
DROP POLICY IF EXISTS fin_income_items_admin_all ON public.financial_income_items;
CREATE POLICY fin_income_items_admin_all ON public.financial_income_items
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed: carry each event's existing single add-ons figure across as one
-- "Други" line so no add-on income is lost. The cached
-- income_addons_eur column is retained as a mirror of the item sum.
INSERT INTO public.financial_income_items (event_id, month, category, amount_eur, notes)
SELECT id, month, 'other', income_addons_eur, 'Пренесено от „Доп. услуги"'
FROM public.financial_events
WHERE income_addons_eur > 0;

-- ── 2. Align + widen the expense category vocabulary ───────────────
ALTER TABLE public.financial_expenses
  DROP CONSTRAINT IF EXISTS financial_expenses_category_check;

-- Merge the historical duplicates into the new buckets.
UPDATE public.financial_expenses SET category = 'staff_service' WHERE category IN ('staff','employees');
UPDATE public.financial_expenses SET category = 'music_dj'      WHERE category IN ('music','dj');

ALTER TABLE public.financial_expenses
  ADD CONSTRAINT financial_expenses_category_check
  CHECK (category IN (
    'photo_video','decoration','pyro_lighting','music_dj','furniture','staff_service',
    'catering','drinks','utilities','maintenance','marketing','other'
  ));

-- ── 3. Keep the auto-confirm trigger in sync ──────────────────────
-- The pipeline trigger (20260602140000) auto-creates a financial_events
-- row with income_addons_eur = b.addons. Now that the UI derives add-on
-- income from financial_income_items, that trigger must ALSO seed one
-- "Други" service line, or auto-confirmed events would show €0 add-ons
-- until a bookkeeper re-enters them. Mirrors the JS ensureFinancialEvent
-- seed.
CREATE OR REPLACE FUNCTION public.enquiries_auto_create_financial_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parsed_date date;
  event_month text;
  b record;
  new_fe_id uuid;
BEGIN
  IF NEW.pipeline_status NOT IN ('confirmed', 'completed') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.pipeline_status = NEW.pipeline_status THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.financial_events WHERE enquiry_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF NEW.preferred_date !~ '^\d{2}/\d{2}/\d{4}$' THEN
    RETURN NEW;
  END IF;
  parsed_date := to_date(NEW.preferred_date, 'DD/MM/YYYY');
  event_month := to_char(parsed_date, 'YYYY-MM');

  SELECT * INTO b FROM public.compute_enquiry_breakdown(NEW);

  INSERT INTO public.financial_events (
    month, event_date, customer_name, offer_total_eur,
    income_rent_eur, income_drinks_eur, income_addons_eur, income_other_eur,
    enquiry_id, confirmed_by, confirmed_at
  ) VALUES (
    event_month, parsed_date, COALESCE(NEW.full_name, ''),
    round(COALESCE(b.rent, 0) + COALESCE(b.drinks, 0) + COALESCE(b.addons, 0), 2),
    COALESCE(b.rent, 0), COALESCE(b.drinks, 0), COALESCE(b.addons, 0), 0,
    NEW.id, 'auto-confirm', now()
  )
  RETURNING id INTO new_fe_id;

  -- Seed the add-ons figure as one "Други" service line so the itemized
  -- UI shows it (and the bookkeeper can split/recategorize it later).
  IF COALESCE(b.addons, 0) > 0 THEN
    INSERT INTO public.financial_income_items (event_id, month, category, amount_eur, notes)
    VALUES (new_fe_id, event_month, 'other', round(b.addons, 2), 'Пренесено от офертата');
  END IF;

  RETURN NEW;
END;
$$;
