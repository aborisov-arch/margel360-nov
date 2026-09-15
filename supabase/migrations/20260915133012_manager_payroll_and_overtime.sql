create table public.manager_monthly_pay (
 id uuid primary key default gen_random_uuid(),
 month date not null check (extract(day from month)=1),
 manager_email text not null default lower(auth.jwt()->>'email'),
 wage_eur numeric(12,2) not null default 0 check(wage_eur>=0),
 commission_eur numeric(12,2) not null default 0 check(commission_eur>=0),
 unique(month,manager_email)
);
create table public.manager_event_overtime (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.financial_events(id) on delete restrict,
 manager_email text not null default lower(auth.jwt()->>'email'),
 hours numeric(6,2) not null default 0 check(hours>=0 and hours<=24),
 rate_eur numeric(10,2) not null default 0 check(rate_eur>=0),
 register_hours numeric(6,2) check(register_hours>=0 and register_hours<=24),
 register_reference text not null default '' check(length(register_reference)<=300),
 camera_url text not null default '' check(camera_url='' or camera_url ~ '^https://'),
 notes text not null default '' check(length(notes)<=2000),
 unique(event_id,manager_email)
);
alter table public.manager_monthly_pay enable row level security;
alter table public.manager_event_overtime enable row level security;
grant select,insert,update,delete on public.manager_monthly_pay,public.manager_event_overtime to authenticated;
revoke all on public.manager_monthly_pay,public.manager_event_overtime from anon;
create policy finance_read on public.manager_monthly_pay for select to authenticated using(public.is_finance_admin());
create policy finance_write on public.manager_monthly_pay for all to authenticated
 using(public.is_finance_admin() and (manager_email=lower(auth.jwt()->>'email') or public.is_owner()))
 with check(public.is_finance_admin() and (manager_email=lower(auth.jwt()->>'email') or public.is_owner()));
create policy finance_read on public.manager_event_overtime for select to authenticated using(public.is_finance_admin());
create policy finance_write on public.manager_event_overtime for all to authenticated
 using(public.is_finance_admin() and (manager_email=lower(auth.jwt()->>'email') or public.is_owner()))
 with check(public.is_finance_admin() and (manager_email=lower(auth.jwt()->>'email') or public.is_owner()));
create trigger audit_manager_monthly_pay after insert or update or delete on public.manager_monthly_pay for each row execute function public.log_audit();
create trigger audit_manager_event_overtime after insert or update or delete on public.manager_event_overtime for each row execute function public.log_audit();

-- All deletes succeed together or all roll back, including RESTRICT checks.
create function public.delete_financial_pnl(target_event uuid) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
 if not public.is_finance_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
 if exists(select 1 from public.manager_event_overtime where event_id=target_event) then
   raise exception 'Event has manager overtime records' using errcode='23503';
 end if;
 delete from public.financial_expenses where event_id=target_event;
 delete from public.financial_events where id=target_event;
end;
$$;
revoke all on function public.delete_financial_pnl(uuid) from public,anon;
grant execute on function public.delete_financial_pnl(uuid) to authenticated;
