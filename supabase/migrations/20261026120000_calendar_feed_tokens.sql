-- Google Calendar feed (iCal subscription) - per-admin hashed tokens for the
-- `calendar-feed` Edge Function, plus email-parameterised allowlist helpers so
-- the feed can check at fetch time that a token's owner is still an admin.
-- Design: docs/superpowers/specs/2026-10-26-google-calendar-feed-design.md
--
-- Allowlist layout after this migration (one list per tier, no copies):
--   is_finance_admin_email(p_email)  the 7 finance admins
--   is_admin_email(p_email)          finance admins + the blog editor
--   is_finance_admin() / is_admin()  thin JWT wrappers (same signatures and
--                                    grants as before - create or replace keeps
--                                    the ACLs)
--   reject_non_admin_signup()        calls is_admin_email(NEW.email)
-- Staff changes: edit the two *_email functions in a NEW migration and keep
-- the self-check block at the end of this file as the template.

-- ── 1. Allowlist helpers ─────────────────────────────────────────
create or replace function public.is_finance_admin_email(p_email text)
  returns boolean
  language sql
  stable
  set search_path to 'public', 'pg_temp'
as $$
  select lower(coalesce(p_email, '')) in (
    'aborisov@margel.info',
    '360@margel.info',
    'borisov@margel.info',
    'office@margel.info',
    'vitosha@margel.info',
    'dimov@margel.info',
    'borisov.k4@gmail.com'
  )
$$;
revoke all on function public.is_finance_admin_email(text) from public, anon;
grant execute on function public.is_finance_admin_email(text) to authenticated, service_role;

create or replace function public.is_admin_email(p_email text)
  returns boolean
  language sql
  stable
  set search_path to 'public', 'pg_temp'
as $$
  select public.is_finance_admin_email(p_email)
      or lower(coalesce(p_email, '')) in (
    'gogov.stil@gmail.com'
  )
$$;
revoke all on function public.is_admin_email(text) from public, anon;
grant execute on function public.is_admin_email(text) to authenticated, service_role;

-- JWT wrappers: same behaviour as 20260903150000, now reading the lists above.
create or replace function public.is_finance_admin()
  returns boolean
  language sql
  stable
  set search_path to 'public', 'pg_temp'
as $$
  select public.is_finance_admin_email(auth.jwt() ->> 'email')
$$;

create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  set search_path to 'public', 'pg_temp'
as $$
  select public.is_admin_email(auth.jwt() ->> 'email')
$$;

-- Signup blocker (BEFORE INSERT on auth.users) reads the same list.
create or replace function public.reject_non_admin_signup()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_admin_email(NEW.email) then
    raise exception 'signups are disabled — contact site admin'
      using errcode = '42501';
  end if;
  return NEW;
end;
$function$;

-- ── 2. Feed tokens ───────────────────────────────────────────────
-- Only the sha256 of the token is stored; the plaintext is returned once by
-- create_calendar_feed_token() and never again. token_prefix is for display.
create table if not exists public.calendar_feed_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  user_email      text not null,
  token_hash      text not null unique,
  token_prefix    text not null,
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  last_fetched_at timestamptz,
  fetch_count     integer not null default 0,
  last_user_agent text
);
comment on table public.calendar_feed_tokens is
  'Per-admin bearer tokens (sha256) for the calendar-feed iCal subscription. Written only via RPCs.';
create index if not exists calendar_feed_tokens_user_active_idx
  on public.calendar_feed_tokens(user_id) where revoked_at is null;

alter table public.calendar_feed_tokens enable row level security;
drop policy if exists calendar_feed_tokens_own_select on public.calendar_feed_tokens;
create policy calendar_feed_tokens_own_select on public.calendar_feed_tokens
  for select to authenticated
  using (user_id = auth.uid() and public.is_admin());
-- No insert/update/delete policies on purpose: writes go through the
-- SECURITY DEFINER functions below (service_role bypasses RLS anyway).

-- ── 3. RPCs ──────────────────────────────────────────────────────
-- Admin: mint a new feed URL token (revoking any active one of their own).
-- Returns the plaintext token - the only time it is ever visible.
create or replace function public.create_calendar_feed_token()
  returns text
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_token text;
  v_id    uuid;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  update public.calendar_feed_tokens
     set revoked_at = now()
   where user_id = v_uid and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.calendar_feed_tokens(user_id, user_email, token_hash, token_prefix)
  values (v_uid, v_email, encode(extensions.digest(v_token, 'sha256'), 'hex'), left(v_token, 8))
  returning id into v_id;

  insert into public.audit_log(table_name, record_id, action, changed_by, label, changes)
  values ('calendar_feed_tokens', v_id::text, 'INSERT', v_email,
          'Google Calendar – нов адрес',
          jsonb_build_object('token_prefix', left(v_token, 8)));

  return v_token;
end;
$$;
revoke all on function public.create_calendar_feed_token() from public, anon;
grant execute on function public.create_calendar_feed_token() to authenticated;

-- Admin: deactivate their own active feed URL(s). True when one was active.
create or replace function public.revoke_calendar_feed_token()
  returns boolean
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid      uuid := auth.uid();
  v_email    text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_prefixes text[];
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  with upd as (
    update public.calendar_feed_tokens
       set revoked_at = now()
     where user_id = v_uid and revoked_at is null
    returning id, token_prefix
  )
  select array_agg(token_prefix) into v_prefixes from upd;

  if coalesce(array_length(v_prefixes, 1), 0) = 0 then
    return false;
  end if;

  insert into public.audit_log(table_name, record_id, action, changed_by, label, changes)
  values ('calendar_feed_tokens', v_uid::text, 'UPDATE', v_email,
          'Google Calendar – адресът е деактивиран',
          jsonb_build_object('token_prefix', v_prefixes[1]));
  return true;
end;
$$;
revoke all on function public.revoke_calendar_feed_token() from public, anon;
grant execute on function public.revoke_calendar_feed_token() to authenticated;

-- Edge Function (service role): authorise a fetch by token hash and record it.
-- False = unknown, revoked, or the owner is no longer on the admin allowlist.
create or replace function public.calendar_feed_touch(p_token_hash text, p_user_agent text)
  returns boolean
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
declare
  v_n integer;
begin
  update public.calendar_feed_tokens t
     set last_fetched_at = now(),
         fetch_count     = t.fetch_count + 1,
         last_user_agent = left(coalesce(p_user_agent, ''), 200)
   where t.token_hash = p_token_hash
     and t.revoked_at is null
     and public.is_admin_email(t.user_email);
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;
revoke all on function public.calendar_feed_touch(text, text) from public, anon, authenticated;
grant execute on function public.calendar_feed_touch(text, text) to service_role;

-- ── 4. Self-check: the lists above must match 20260903150000 ─────
do $$
begin
  if not public.is_admin_email('aborisov@margel.info') then
    raise exception 'allowlist self-check failed: aborisov@margel.info not admin';
  end if;
  if not public.is_admin_email('GOGOV.STIL@gmail.com') then
    raise exception 'allowlist self-check failed: gogov (case-insensitive) not admin';
  end if;
  if not public.is_finance_admin_email('360@margel.info') then
    raise exception 'allowlist self-check failed: 360@margel.info not finance admin';
  end if;
  if public.is_finance_admin_email('gogov.stil@gmail.com') then
    raise exception 'allowlist self-check failed: gogov must not be finance admin';
  end if;
  if public.is_admin_email('nobody@example.com') then
    raise exception 'allowlist self-check failed: stranger admitted';
  end if;
  if public.is_admin_email(null) then
    raise exception 'allowlist self-check failed: null admitted';
  end if;
end $$;
