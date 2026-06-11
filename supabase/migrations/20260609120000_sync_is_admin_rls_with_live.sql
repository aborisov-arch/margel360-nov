-- Sync the repo with the RLS hardening that was applied directly to the live
-- DB (launch-blocker fix 8a80c9c): an is_admin() email allowlist gates every
-- admin table. The repo's migration files still carried the original
-- permissive USING (true) policies (and an anon INSERT on enquiries), so any
-- rebuild from migrations would silently reopen full PII access to every
-- authenticated user. This migration is idempotent against the live DB:
-- applying it there recreates the same policies it already has.

create or replace function public.is_admin()
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
    'dimov@margel.info'
  )
$$;

-- ── enquiries ──────────────────────────────────────────────────────
alter table public.enquiries enable row level security;
-- old permissive policies (repo-era names)
drop policy if exists enquiries_anon_insert on public.enquiries;
drop policy if exists enquiries_auth_insert on public.enquiries;
drop policy if exists enquiries_auth_select on public.enquiries;
drop policy if exists enquiries_auth_update on public.enquiries;
drop policy if exists enquiries_auth_delete on public.enquiries;
-- live policies (recreate)
drop policy if exists enquiries_admin_select on public.enquiries;
drop policy if exists enquiries_admin_update on public.enquiries;
drop policy if exists enquiries_admin_delete on public.enquiries;
create policy enquiries_admin_select on public.enquiries
  for select to authenticated using (is_admin());
create policy enquiries_admin_update on public.enquiries
  for update to authenticated using (is_admin()) with check (is_admin());
create policy enquiries_admin_delete on public.enquiries
  for delete to authenticated using (is_admin());
-- NOTE: no INSERT policy on purpose — the public form writes via the
-- submit-enquiry edge function (service role), never directly.

-- ── enquiry_edit_log ───────────────────────────────────────────────
alter table public.enquiry_edit_log enable row level security;
drop policy if exists edit_log_admin_select on public.enquiry_edit_log;
create policy edit_log_admin_select on public.enquiry_edit_log
  for select to authenticated using (is_admin());

-- ── enquiry_notes ──────────────────────────────────────────────────
alter table public.enquiry_notes enable row level security;
drop policy if exists admins_read_notes   on public.enquiry_notes;
drop policy if exists admins_insert_notes on public.enquiry_notes;
drop policy if exists admins_delete_notes on public.enquiry_notes;
drop policy if exists notes_admin_select on public.enquiry_notes;
drop policy if exists notes_admin_insert on public.enquiry_notes;
drop policy if exists notes_admin_delete on public.enquiry_notes;
create policy notes_admin_select on public.enquiry_notes
  for select to authenticated using (is_admin());
create policy notes_admin_insert on public.enquiry_notes
  for insert to authenticated with check (is_admin());
create policy notes_admin_delete on public.enquiry_notes
  for delete to authenticated using (is_admin());

-- ── event_feedback ─────────────────────────────────────────────────
alter table public.event_feedback enable row level security;
drop policy if exists "admins_read_feedback" on public.event_feedback;
drop policy if exists feedback_admin_select on public.event_feedback;
create policy feedback_admin_select on public.event_feedback
  for select to authenticated using (is_admin());

-- ── discount_codes ─────────────────────────────────────────────────
alter table public.discount_codes enable row level security;
drop policy if exists "admins_read_codes" on public.discount_codes;
drop policy if exists codes_admin_all on public.discount_codes;
create policy codes_admin_all on public.discount_codes
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── financial_events / financial_expenses ──────────────────────────
alter table public.financial_events   enable row level security;
alter table public.financial_expenses enable row level security;
drop policy if exists "admins_all_fin_events"   on public.financial_events;
drop policy if exists "admins_all_fin_expenses" on public.financial_expenses;
drop policy if exists fin_events_admin_all   on public.financial_events;
drop policy if exists fin_expenses_admin_all on public.financial_expenses;
create policy fin_events_admin_all on public.financial_events
  for all to authenticated using (is_admin()) with check (is_admin());
create policy fin_expenses_admin_all on public.financial_expenses
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── occupied_dates ─────────────────────────────────────────────────
alter table public.occupied_dates enable row level security;
drop policy if exists "Public can read occupied dates" on public.occupied_dates;
drop policy if exists occ_admin_select on public.occupied_dates;
drop policy if exists occ_admin_insert on public.occupied_dates;
drop policy if exists occ_admin_delete on public.occupied_dates;
create policy "Public can read occupied dates" on public.occupied_dates
  for select to anon using (true);
create policy occ_admin_select on public.occupied_dates
  for select to authenticated using (is_admin());
create policy occ_admin_insert on public.occupied_dates
  for insert to authenticated with check (is_admin());
create policy occ_admin_delete on public.occupied_dates
  for delete to authenticated using (is_admin());
