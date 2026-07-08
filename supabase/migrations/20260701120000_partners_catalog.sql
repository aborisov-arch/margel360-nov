-- Partners catalog (catering companies + artists). Shown on the public
-- partners.html page and in the reservation wizard's mark-interest step;
-- managed from admin/partners.html. Anon read is what makes a newly added
-- partner appear on the site automatically (same model as occupied_dates).

CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('catering','artist')),
  name text NOT NULL,
  description_bg text,
  description_en text,
  website_url text,
  phone text,
  image_path text,
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partners_public_read ON public.partners;
CREATE POLICY partners_public_read ON public.partners
  FOR SELECT TO anon USING (active);

DROP POLICY IF EXISTS partners_admin_all ON public.partners;
CREATE POLICY partners_admin_all ON public.partners
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Mark-interest snapshot on the enquiry: [{id, name, category}] captured
-- server-side by submit-enquiry at booking time (survives later renames).
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS partner_interest jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Storage bucket for partner images. public=true → images are served from
-- /storage/v1/object/public/partner-images/<path> with no read policy.
-- Caps are enforced server-side at the bucket level.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('partner-images', 'partner-images', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS partner_images_admin_insert ON storage.objects;
CREATE POLICY partner_images_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'partner-images' AND is_admin());

DROP POLICY IF EXISTS partner_images_admin_update ON storage.objects;
CREATE POLICY partner_images_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'partner-images' AND is_admin())
  WITH CHECK (bucket_id = 'partner-images' AND is_admin());

DROP POLICY IF EXISTS partner_images_admin_delete ON storage.objects;
CREATE POLICY partner_images_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'partner-images' AND is_admin());

-- Seed: the two real catering partners currently hardcoded in
-- website/admin/js/offer-pdf.js:56-57. Idempotent: only on an empty table.
INSERT INTO public.partners (category, name, website_url, sort_order)
SELECT v.category, v.name, v.website_url, v.sort_order
FROM (VALUES
  ('catering', 'L''Instant',    'https://www.linstant.bg', 10),
  ('catering', 'VIP Catering',  'https://vipcatering.bg',  20)
) AS v(category, name, website_url, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.partners);
