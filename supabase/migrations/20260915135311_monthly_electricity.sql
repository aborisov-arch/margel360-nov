create table public.monthly_electricity (
 id uuid primary key default gen_random_uuid(),
 month date not null unique check(extract(day from month)=1),
 amount_eur numeric(12,2) not null check(amount_eur>=0),
 reference text not null default '' check(length(reference)<=300)
);
alter table public.monthly_electricity enable row level security;
revoke all on public.monthly_electricity from anon, authenticated;
grant select,insert,update,delete on public.monthly_electricity to authenticated;
create policy finance_access on public.monthly_electricity for all to authenticated
 using(public.is_finance_admin()) with check(public.is_finance_admin());
create trigger audit_monthly_electricity after insert or update or delete on public.monthly_electricity for each row execute function public.log_audit();
