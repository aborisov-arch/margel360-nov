-- Blog-editor tier: gogov.stil@gmail.com joins the admin allowlist but NOT
-- finances or the audit log. Tiers after this migration:
--   is_owner()          aborisov@, borisov.k4      -> audit_log (Дневник)
--   is_finance_admin()  the 7 pre-existing admins  -> financial_* tables
--   is_admin()          finance admins + gogov     -> everything else
-- The reject_non_admin_signup trigger list is refreshed too (it had drifted:
-- borisov.k4 was missing). UI mirrors the tiers in admin/js/auth.js; RLS here
-- is the real boundary.

create or replace function public.is_finance_admin()
  returns boolean
  language sql
  stable
  set search_path to 'public', 'pg_temp'
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'aborisov@margel.info',
    '360@margel.info',
    'borisov@margel.info',
    'office@margel.info',
    'vitosha@margel.info',
    'dimov@margel.info',
    'borisov.k4@gmail.com'
  )
$$;
revoke all on function public.is_finance_admin() from public;
grant execute on function public.is_finance_admin() to authenticated;

create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  set search_path to 'public', 'pg_temp'
as $$
  select public.is_finance_admin()
      or lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'gogov.stil@gmail.com'
  )
$$;

-- Financial tables move from is_admin() to is_finance_admin().
drop policy if exists fin_events_admin_all on public.financial_events;
create policy fin_events_admin_all on public.financial_events
  for all to authenticated using (is_finance_admin()) with check (is_finance_admin());

drop policy if exists fin_expenses_admin_all on public.financial_expenses;
create policy fin_expenses_admin_all on public.financial_expenses
  for all to authenticated using (is_finance_admin()) with check (is_finance_admin());

drop policy if exists fin_income_items_admin_all on public.financial_income_items;
create policy fin_income_items_admin_all on public.financial_income_items
  for all to authenticated using (is_finance_admin()) with check (is_finance_admin());

-- Signup blocker: same emails as is_admin() (was stale - borisov.k4 missing).
create or replace function public.reject_non_admin_signup()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
begin
  if lower(coalesce(NEW.email, '')) not in (
    'aborisov@margel.info',
    '360@margel.info',
    'borisov@margel.info',
    'office@margel.info',
    'vitosha@margel.info',
    'dimov@margel.info',
    'borisov.k4@gmail.com',
    'gogov.stil@gmail.com'
  ) then
    raise exception 'signups are disabled — contact site admin'
      using errcode = '42501';
  end if;
  return NEW;
end;
$function$;

-- Pre-create the account (public signups are OFF in the dashboard, so OAuth
-- cannot mint it). Random unusable password: he signs in with "Вход с Google",
-- which auto-links to this user by verified email. Idempotent.
do $$
declare uid uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where lower(email) = 'gogov.stil@gmail.com') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'gogov.stil@gmail.com',
      extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', 'gogov.stil@gmail.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;
end $$;
