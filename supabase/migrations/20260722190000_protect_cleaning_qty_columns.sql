-- Harden protect_cleaning_addon(): the mandatory cleaning addon (id
-- 'cleaning') must never gain qty columns. The wizard and edit page
-- auto-add it WITHOUT a qty (autoCleaningAddon), but _shared/catalog.ts
-- repriceAddons treats any addon with free_until/max_qty set as a stepper
-- item and requires qty >= 1 - so if cleaning picked up max_qty/free_until
-- (e.g. via an admin UI slip), every submit/edit would start 400ing. The
-- admin UI (catalog.js) already disables/blanks the qty checkbox for
-- cleaning; this is the DB-side backstop. Only the UPDATE branch changes -
-- everything else is unchanged from 20260722120000_catalog_tables.sql, and
-- since the trigger already points at this function name, replacing the
-- function body is enough (no DROP/CREATE TRIGGER needed).
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
  ) THEN
    RAISE EXCEPTION 'the cleaning addon cannot be hidden, re-keyed, or turned into a qty item';
  END IF;
  RETURN NEW;
END $$;
