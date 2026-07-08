-- Records the language the customer used on the site, so the summary email can
-- be sent in that language. Additive + defaulted ('bg'), so existing rows and
-- any submit that omits it behave exactly as before.
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'bg';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enquiries_lang_check') THEN
    ALTER TABLE public.enquiries
      ADD CONSTRAINT enquiries_lang_check CHECK (lang IN ('bg', 'en'));
  END IF;
END $$;
