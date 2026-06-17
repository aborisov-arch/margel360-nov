-- Add owner borisov.k4@gmail.com to the admin allowlist (is_admin()).
-- He still needs a Supabase Auth login (email/password) to sign in; this only
-- grants the authorisation gate once authenticated. Mirrors the live definition
-- from 20260609120000 with one address appended.
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'aborisov@margel.info',
    '360@margel.info',
    'borisov@margel.info',
    'office@margel.info',
    'vitosha@margel.info',
    'dimov@margel.info',
    'borisov.k4@gmail.com'
  )
$function$;
