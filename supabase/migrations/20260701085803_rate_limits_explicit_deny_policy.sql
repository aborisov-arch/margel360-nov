-- rate_limits is service-role-only by design (accessed only via the SECURITY
-- DEFINER rate_limit_hit(), which runs as the table owner and bypasses RLS).
-- RLS was enabled with no policy => deny-all, which is correct but trips the
-- rls_enabled_no_policy advisor. This explicit deny policy for anon/authenticated
-- makes the intent explicit and clears the advisor; behaviour is unchanged
-- (service_role bypasses RLS, so rate_limit_hit() is unaffected).
CREATE POLICY "rate_limits: service-role only (deny anon/authenticated)"
  ON public.rate_limits
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
