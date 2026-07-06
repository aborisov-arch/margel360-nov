-- Contact person for each partner (filled manually by the team in the
-- admin). Shown next to the partner's phone on the public card and in the
-- admin table. The phone column already exists (20260701120000).
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS contact_name text;
