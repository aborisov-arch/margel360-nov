-- Harden trigger/cron-only functions, pin a mutable search_path, and add a
-- missing FK index. Driven by Supabase security + performance advisors.
--
-- The five functions below are NEVER called via /rest/v1/rpc: four are trigger
-- functions (advance_on_first_admin_note, log_audit, log_enquiry_status_change,
-- enquiries_auto_create_financial_event) and archive_stale_enquiries runs via
-- pg_cron as the owner. Triggers fire regardless of EXECUTE grants, and the cron
-- job runs as postgres, so revoking the public REST roles is safe. We keep them
-- SECURITY DEFINER (the audit/status-log triggers need it to write tables the
-- triggering user cannot access) and simply remove the unnecessary RPC exposure.

REVOKE EXECUTE ON FUNCTION public.advance_on_first_admin_note()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit()                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_enquiry_status_change()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enquiries_auto_create_financial_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.archive_stale_enquiries()              FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.archive_stale_enquiries()              TO service_role;

-- Pin the one mutable search_path (SECURITY INVOKER trigger that lacked it).
ALTER FUNCTION public.enquiries_auto_create_financial_event() SET search_path = public;

-- Defense-in-depth: rate_limits is service-role-only by design (RLS enabled with
-- no policies already blocks anon/authenticated). Revoke the leftover table
-- grants so the intent is explicit. rate_limit_hit() is SECURITY DEFINER and is
-- unaffected.
REVOKE ALL ON TABLE public.rate_limits FROM anon, authenticated;

-- Performance: covering index for the discount_codes -> enquiries foreign key.
CREATE INDEX IF NOT EXISTS discount_codes_redeemed_for_enquiry_id_idx
  ON public.discount_codes (redeemed_for_enquiry_id);
