-- When an enquiry's pipeline_status transitions to 'confirmed' or
-- 'completed', auto-create a financial_events row populated from the
-- enquiry data: rent base by event_id (minus discount), drinks sum,
-- addons sum, month derived from preferred_date.
--
-- Mirrors the JS estimator in financials.js (enquiryBreakdown) so the
-- automatic insert and the manual "Promote from CRM" / 🔗 Link flows
-- all produce the same numbers.
--
-- Skips if a financial_events row for this enquiry already exists, so
-- the trigger is safe regardless of which surface confirms first.

CREATE OR REPLACE FUNCTION public.compute_enquiry_breakdown(e public.enquiries)
RETURNS TABLE(rent numeric, drinks numeric, addons numeric)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  base_rent numeric := 0;
  discount_pct integer := 0;
BEGIN
  base_rent := CASE e.event_id
    WHEN 'evening'  THEN 1280
    WHEN 'wedding'  THEN 1500
    WHEN 'corp4'    THEN 330
    WHEN 'corp8'    THEN 440
    WHEN 'bday_day' THEN 700
    WHEN 'bday_eve' THEN 970
    ELSE 0
  END;
  discount_pct := COALESCE(e.applied_discount_percent, 0);
  IF discount_pct > 0 THEN
    base_rent := round(base_rent * (1 - discount_pct::numeric / 100), 2);
  END IF;
  rent := base_rent;

  SELECT COALESCE(SUM((value->>'price')::numeric * COALESCE((value->>'qty')::numeric, 0)), 0)
    INTO drinks
  FROM jsonb_array_elements(COALESCE(e.drinks, '[]'::jsonb)) AS value;

  SELECT COALESCE(SUM((value->>'price')::numeric * COALESCE((value->>'qty')::numeric, 1)), 0)
    INTO addons
  FROM jsonb_array_elements(COALESCE(e.addons, '[]'::jsonb)) AS value;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.enquiries_auto_create_financial_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parsed_date date;
  event_month text;
  b record;
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
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enquiries_auto_create_financial_event_trigger ON public.enquiries;
CREATE TRIGGER enquiries_auto_create_financial_event_trigger
  AFTER INSERT OR UPDATE OF pipeline_status ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.enquiries_auto_create_financial_event();

-- Backfill
INSERT INTO public.financial_events (
  month, event_date, customer_name, offer_total_eur,
  income_rent_eur, income_drinks_eur, income_addons_eur, income_other_eur,
  enquiry_id, confirmed_by, confirmed_at
)
SELECT
  to_char(to_date(e.preferred_date, 'DD/MM/YYYY'), 'YYYY-MM'),
  to_date(e.preferred_date, 'DD/MM/YYYY'),
  COALESCE(e.full_name, ''),
  round(COALESCE(b.rent, 0) + COALESCE(b.drinks, 0) + COALESCE(b.addons, 0), 2),
  COALESCE(b.rent, 0), COALESCE(b.drinks, 0), COALESCE(b.addons, 0), 0,
  e.id, 'auto-backfill', now()
FROM public.enquiries e
CROSS JOIN LATERAL public.compute_enquiry_breakdown(e) b
WHERE e.pipeline_status IN ('confirmed', 'completed')
  AND e.preferred_date ~ '^\d{2}/\d{2}/\d{4}$'
  AND NOT EXISTS (SELECT 1 FROM public.financial_events fe WHERE fe.enquiry_id = e.id);
