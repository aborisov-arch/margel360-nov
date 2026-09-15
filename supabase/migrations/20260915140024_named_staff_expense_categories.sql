-- Add named allocations without rewriting historical staff expenses.
alter table public.financial_expenses drop constraint financial_expenses_category_check;
alter table public.financial_expenses add constraint financial_expenses_category_check
check(category in (
 'photo_video','decoration','pyro_lighting','music_dj','furniture','staff_service',
 'catering','drinks','utilities','maintenance','marketing','other',
 'ivan_fee','ivan_overtime','eli_fee','eli_overtime'
));
