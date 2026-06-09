-- Edit-token expiry: 14 days from when the enquiry was created (booking time),
-- not 14 days after the event date. A far-future event no longer means a
-- months-long editable window.
create or replace function public.set_enquiry_token_expiry()
  returns trigger
  language plpgsql
  set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    new.token_expires_at := now() + interval '14 days';
  end if;
  return new;
end;
$function$;

-- Expiry is now independent of preferred_date, so the trigger only needs to
-- fire at INSERT (no longer on UPDATE OF preferred_date).
drop trigger if exists trg_set_enquiry_token_expiry on public.enquiries;
create trigger trg_set_enquiry_token_expiry
  before insert on public.enquiries
  for each row execute function public.set_enquiry_token_expiry();
