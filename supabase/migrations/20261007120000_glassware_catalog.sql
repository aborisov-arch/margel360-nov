-- Посуда (glassware rented per piece): a category of addon_services so it
-- reuses the add-on path end to end (wizard, edit page, repricing in
-- _shared/catalog.ts, emails, offers, P&L). Existing rows stay 'service'.
-- Glassware is always a per-piece item: max_qty must be set so
-- repriceAddons keeps the quantity (non-qty add-ons drop it).
ALTER TABLE public.addon_services
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'service'
  CHECK (category IN ('service', 'glassware'));
ALTER TABLE public.addon_services
  ADD CONSTRAINT addon_services_glassware_qty CHECK (category <> 'glassware' OR max_qty IS NOT NULL);

-- The mandatory cleaning add-on also stays a service.
CREATE OR REPLACE FUNCTION public.protect_cleaning_addon() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.id = 'cleaning' THEN
      RAISE EXCEPTION 'the cleaning addon cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.id = 'cleaning' AND (
    NEW.id IS DISTINCT FROM 'cleaning'
    OR NEW.active = false
    OR NEW.free_until IS NOT NULL
    OR NEW.max_qty IS NOT NULL
    OR NEW.category IS DISTINCT FROM 'service'
  ) THEN
    RAISE EXCEPTION 'the cleaning addon cannot be hidden, re-keyed, recategorised, or turned into a qty item';
  END IF;
  RETURN NEW;
END $$;

-- Finance-only purchase cost per glassware piece. Never on the public
-- addon_services table (anon can read it). Mirrors drink_purchase_prices.
CREATE TABLE public.addon_purchase_prices (
  addon_id text PRIMARY KEY REFERENCES public.addon_services(id) ON DELETE CASCADE,
  cost_eur numeric(12,2) NOT NULL CHECK (cost_eur >= 0 AND cost_eur < 1000000)
);
ALTER TABLE public.addon_purchase_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.addon_purchase_prices FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addon_purchase_prices TO authenticated;
CREATE POLICY finance_access ON public.addon_purchase_prices FOR ALL TO authenticated
  USING (public.is_finance_admin()) WITH CHECK (public.is_finance_admin());
CREATE TRIGGER audit_addon_purchase_prices AFTER INSERT OR UPDATE OR DELETE ON public.addon_purchase_prices
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
