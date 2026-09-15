-- Commercial purchase prices must never join the publicly readable drinks table.
create table public.drink_purchase_prices (
 drink_id text primary key references public.drinks(id) on delete cascade,
 cost_eur numeric(12,2) not null check(cost_eur>=0 and cost_eur<1000000)
);
alter table public.drink_purchase_prices enable row level security;
revoke all on public.drink_purchase_prices from anon,authenticated;
grant select,insert,update,delete on public.drink_purchase_prices to authenticated;
create policy finance_access on public.drink_purchase_prices for all to authenticated
 using(public.is_finance_admin()) with check(public.is_finance_admin());
create trigger audit_drink_purchase_prices after insert or update or delete on public.drink_purchase_prices for each row execute function public.log_audit();
alter table public.financial_events add column drinks_cost_in_expenses boolean not null default false;
