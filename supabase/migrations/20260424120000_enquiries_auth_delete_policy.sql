-- Allow admins (authenticated role) to delete enquiries from the dashboard.
-- Initial migration only granted SELECT/INSERT/UPDATE. DELETE is needed
-- for the "Изтрий" action in the admin detail panel.

DROP POLICY IF EXISTS enquiries_auth_delete ON public.enquiries;
CREATE POLICY enquiries_auth_delete ON public.enquiries
  FOR DELETE TO authenticated USING (true);
