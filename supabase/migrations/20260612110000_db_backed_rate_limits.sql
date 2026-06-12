-- Distributed rate limiting for the public edge functions. The old
-- in-memory Map was per-isolate, so any burst that spawned fresh isolates
-- effectively reset the counter. One row per (key) with a rolling window.
create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 1,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;
-- No policies on purpose: only the service role (edge functions) touches it.

create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare allowed boolean;
begin
  insert into rate_limits as rl (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case when rl.window_start <= now() - make_interval(secs => p_window_seconds)
                 then 1 else rl.count + 1 end,
    window_start = case when rl.window_start <= now() - make_interval(secs => p_window_seconds)
                        then now() else rl.window_start end
  returning count <= p_limit into allowed;
  return allowed;
end;
$$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
