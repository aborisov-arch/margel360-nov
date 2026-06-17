-- Owner-only activity log: who changed what, with field-level before→after.
--
-- Captures every change to the money + bookings tables via an AFTER trigger,
-- recording the acting admin (auth.jwt() email; for enquiry edits the
-- edited_by_admin stamp; else system/form), a field-level diff, and a
-- readable label. The trigger is SECURITY DEFINER (so it can write audit_log
-- regardless of the caller's RLS) and FAIL-SAFE (an audit error must NEVER
-- roll back the underlying edit). Read access is gated to owners only.

-- ── Owner sub-role (smaller than the admin allowlist) ──────────────
CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean LANGUAGE sql STABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'aborisov@margel.info',
    'borisov.k4@gmail.com'
  )
$$;

-- ── audit_log table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id  text,
  action     text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_by text,
  label      text,
  changes    jsonb,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_changed_at_idx ON public.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_idx      ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS audit_log_changed_by_idx ON public.audit_log(changed_by);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_owner_read ON public.audit_log;
-- Owners read; nobody writes directly (only the SECURITY DEFINER trigger).
CREATE POLICY audit_log_owner_read ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_owner());

-- The actor fallback reads enquiries.edited_by_admin (stamped by the
-- update-enquiry-admin edge function). Declare it defensively so a fresh DB
-- has it too — it already exists live.
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS edited_by_admin text;

-- ── Generic audit trigger function ────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_audit()
 RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  oldj jsonb := '{}'::jsonb;
  newj jsonb := '{}'::jsonb;
  diff jsonb := '{}'::jsonb;
  actor text;
  rec_id text;
  lbl text;
  k text;
  -- Timestamp/bookkeeping columns excluded from the diff as noise.
  skip text[] := ARRAY['updated_at','last_edited_at','created_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    oldj := to_jsonb(OLD);
  ELSIF TG_OP = 'INSERT' THEN
    newj := to_jsonb(NEW);
  ELSE
    oldj := to_jsonb(OLD);
    newj := to_jsonb(NEW);
  END IF;

  -- Redact capability secrets so they never land in the audit log (edit_token
  -- is the credential the public booking-edit links authenticate on).
  oldj := oldj - 'edit_token' - 'feedback_token';
  newj := newj - 'edit_token' - 'feedback_token';

  -- Actor: authenticated admin email, else the enquiry editor stamp, else system.
  actor := nullif(auth.jwt() ->> 'email', '');
  IF actor IS NULL THEN
    actor := coalesce(nullif(newj ->> 'edited_by_admin', ''), 'система/форма');
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(newj) LOOP
      IF NOT (k = ANY(skip)) AND (newj -> k) IS DISTINCT FROM (oldj -> k) THEN
        diff := diff || jsonb_build_object(k, jsonb_build_object('old', oldj -> k, 'new', newj -> k));
      END IF;
    END LOOP;
    IF diff = '{}'::jsonb THEN
      RETURN NEW;  -- nothing meaningful changed (e.g. only updated_at)
    END IF;
    rec_id := newj ->> 'id';
  ELSIF TG_OP = 'INSERT' THEN
    diff := newj;            -- full created row
    rec_id := newj ->> 'id';
  ELSE
    diff := oldj;            -- full deleted row
    rec_id := oldj ->> 'id';
  END IF;

  lbl := coalesce(
    CASE TG_TABLE_NAME
      WHEN 'enquiries'        THEN coalesce(nullif(newj ->> 'full_name', ''),     oldj ->> 'full_name')
      WHEN 'financial_events' THEN coalesce(nullif(newj ->> 'customer_name', ''), oldj ->> 'customer_name')
      ELSE NULL
    END, '');

  INSERT INTO public.audit_log(table_name, record_id, action, changed_by, label, changes)
  VALUES (TG_TABLE_NAME, rec_id, TG_OP, actor, lbl, diff);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
EXCEPTION WHEN OTHERS THEN
  -- Audit logging must NEVER break the underlying write.
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ── Attach to the money + bookings tables ─────────────────────────
DROP TRIGGER IF EXISTS audit_financial_events ON public.financial_events;
CREATE TRIGGER audit_financial_events AFTER INSERT OR UPDATE OR DELETE ON public.financial_events
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_financial_expenses ON public.financial_expenses;
CREATE TRIGGER audit_financial_expenses AFTER INSERT OR UPDATE OR DELETE ON public.financial_expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_financial_income_items ON public.financial_income_items;
CREATE TRIGGER audit_financial_income_items AFTER INSERT OR UPDATE OR DELETE ON public.financial_income_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_enquiries ON public.enquiries;
CREATE TRIGGER audit_enquiries AFTER INSERT OR UPDATE OR DELETE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
