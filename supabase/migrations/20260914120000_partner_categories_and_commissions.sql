-- Partner categories + partner commission tracking.
--
-- 1. public.partners.category widens from catering|artist to the vendor types
--    the venue now takes a commission from: catering, decoration, singer,
--    band, dj. 'artist' stays valid so the existing rows keep working and can
--    be recategorised from admin/partners.html at leisure.
-- 2. public.partner_commission_rates - the default commission % per partner
--    (10 unless changed from the financials page). Lives in its own
--    finance-gated table rather than as a column on partners, because anon
--    may SELECT active partners rows for the public site and must never see
--    commercial terms.
-- 3. public.partner_commissions - one row per commission the venue records
--    against a partner (manual entry from admin/financials.html): the base
--    amount the partner billed, the % applied, the resulting commission,
--    whether it has been received, and an optional link to the event's P&L.
--
-- Both new tables follow the financial_* tier: is_finance_admin() only
-- (20260903150000_editor_role_gogov.sql) and audited by log_audit().
-- partner_commissions.partner_id is ON DELETE RESTRICT so deleting a partner
-- with recorded commissions fails (admin/partners.html turns 23503 into
-- "hide it instead") - finance history is never silently dropped. Rates
-- cascade: a default % is meaningless without its partner.

-- ── 1. Categories ─────────────────────────────────────────────────
ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_category_check;
ALTER TABLE public.partners ADD CONSTRAINT partners_category_check
  CHECK (category IN ('catering','decoration','singer','band','dj','artist'));

-- ── 2. Default commission rate per partner ───────────────────────
CREATE TABLE IF NOT EXISTS public.partner_commission_rates (
  partner_id uuid PRIMARY KEY REFERENCES public.partners(id) ON DELETE CASCADE,
  percent numeric(5,2) NOT NULL DEFAULT 10 CHECK (percent >= 0 AND percent <= 100),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_commission_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_rates_finance_all ON public.partner_commission_rates;
CREATE POLICY partner_rates_finance_all ON public.partner_commission_rates
  FOR ALL TO authenticated USING (public.is_finance_admin()) WITH CHECK (public.is_finance_admin());

-- ── 3. Commission entries ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  -- 'YYYY-MM' - the same month key the financial_* tables use, so the month
  -- filter on the financials page scopes commissions and P&Ls alike.
  month text NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  commission_date date,
  event_id uuid REFERENCES public.financial_events(id) ON DELETE SET NULL,
  base_amount_eur numeric(12,2) NOT NULL DEFAULT 0 CHECK (base_amount_eur >= 0),
  commission_percent numeric(5,2) NOT NULL DEFAULT 10 CHECK (commission_percent >= 0 AND commission_percent <= 100),
  commission_eur numeric(12,2) NOT NULL DEFAULT 0 CHECK (commission_eur >= 0),
  received boolean NOT NULL DEFAULT false,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_commissions_partner_idx ON public.partner_commissions(partner_id);
CREATE INDEX IF NOT EXISTS partner_commissions_month_idx   ON public.partner_commissions(month);
CREATE INDEX IF NOT EXISTS partner_commissions_event_idx   ON public.partner_commissions(event_id);
ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_commissions_finance_all ON public.partner_commissions;
CREATE POLICY partner_commissions_finance_all ON public.partner_commissions
  FOR ALL TO authenticated USING (public.is_finance_admin()) WITH CHECK (public.is_finance_admin());

-- ── 4. Audit (owner-only Дневник) ─────────────────────────────────
DROP TRIGGER IF EXISTS audit_partner_commissions ON public.partner_commissions;
CREATE TRIGGER audit_partner_commissions AFTER INSERT OR UPDATE OR DELETE ON public.partner_commissions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
DROP TRIGGER IF EXISTS audit_partner_commission_rates ON public.partner_commission_rates;
CREATE TRIGGER audit_partner_commission_rates AFTER INSERT OR UPDATE OR DELETE ON public.partner_commission_rates
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
