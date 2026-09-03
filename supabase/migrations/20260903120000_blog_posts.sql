-- Blog: manager-written posts (admin/blog.html), listed on /blog.html and
-- served at /blog/<slug> (netlify.toml rewrite to blog-post.html until a
-- baked static page exists; scripts/bake-blog.mjs generates those + sitemap
-- entries). Anon reads published posts only; admins full CRUD. EN fields are
-- optional (empty string = fall back to BG on the EN site).

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug text NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 80),
  title_bg text NOT NULL CHECK (length(title_bg) BETWEEN 1 AND 200),
  title_en text NOT NULL DEFAULT '' CHECK (length(title_en) <= 200),
  excerpt_bg text NOT NULL CHECK (length(excerpt_bg) BETWEEN 1 AND 500),
  excerpt_en text NOT NULL DEFAULT '' CHECK (length(excerpt_en) <= 500),
  body_bg text NOT NULL CHECK (length(body_bg) BETWEEN 1 AND 20000),
  body_en text NOT NULL DEFAULT '' CHECK (length(body_en) <= 20000),
  cover_img text,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_posts_published_idx
  ON public.blog_posts(published, published_at DESC);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blog_posts_public_read ON public.blog_posts;
CREATE POLICY blog_posts_public_read ON public.blog_posts
  FOR SELECT TO anon USING (published);

DROP POLICY IF EXISTS blog_posts_admin_all ON public.blog_posts;
CREATE POLICY blog_posts_admin_all ON public.blog_posts
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Cover images bucket (same policy shape as catalog-images).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blog-images', 'blog-images', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS blog_images_admin_insert ON storage.objects;
CREATE POLICY blog_images_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blog-images' AND is_admin());

DROP POLICY IF EXISTS blog_images_admin_update ON storage.objects;
CREATE POLICY blog_images_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'blog-images' AND is_admin())
  WITH CHECK (bucket_id = 'blog-images' AND is_admin());

DROP POLICY IF EXISTS blog_images_admin_delete ON storage.objects;
CREATE POLICY blog_images_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'blog-images' AND is_admin());

-- Seed: one genuinely useful launch post (verified venue facts, no prices).
INSERT INTO public.blog_posts
  (id, slug, title_bg, title_en, excerpt_bg, excerpt_en, body_bg, body_en,
   cover_img, published, published_at)
VALUES (
  'seed-choose-venue',
  'kak-da-izberete-zala-za-sabitie-v-sofia',
  'Как да изберете зала за събитие в София: 7 практични съвета',
  'How to choose an event venue in Sofia: 7 practical tips',
  'Капацитет, локация, техника, музика, кетъринг — краткото ръководство на Маргел 360° за избор на зала, с което ще си спестите скъпи изненади.',
  'Capacity, location, equipment, music, catering — Margel 360°s short guide to choosing an event venue without expensive surprises.',
  'Изборът на зала определя повече от половината от успеха на едно събитие. Ето какво проверяваме ние, когато гости ни питат за съвет — независимо дали събитието ще е при нас.

## 1. Започнете от броя на гостите
Залата трябва да е комфортна и при 90% запълване. Питайте за реалния капацитет по сезони — при нас например той е 140–180 гости през лятото, когато терасата работи, и 100–120 през зимата.

## 2. Локация и паркинг
Колко лесно се стига и къде паркират гостите? Търсете зала с безплатен паркинг наблизо — пред Маргел 360° има над 70 места.

## 3. Каква техника е включена в наема
Озвучение, осветление, микрофони, проектор — питайте кое е включено и кое се доплаща. Скритите доплащания за техника са най-честата изненада в офертите.

## 4. Музика и краен час
В жилищните квартали музиката спира рано. Проверете:
- има ли ограничение за силата на музиката;
- има ли задължителен краен час;
- как се таксуват извънредните часове.

## 5. Кетъринг и бар
Изяснете дали залата работи само с определени доставчици, има ли бар с лед и хладилници и кой сервира. Кетърингът трябва да пристига готов за сервиране, ако залата няма пълна кухня.

## 6. Открито пространство с план Б
Тераса или градина правят събитието запомнящо се, но винаги питайте какъв е планът при дъжд и колко гости побира закритата част.

## 7. Прозрачни цени
Добрата оферта описва какво точно включва наемът, депозитът и сроковете. Сезонните дати (Нова година, майски сватбени уикенди) обичайно са с различни цени — питайте предварително.

Ако планирате събитие в София, елате да видите Маргел 360° на живо — ще минете през всичките седем точки за половин час.',
  'Choosing the venue decides more than half of an event''s success. Here is what we check when guests ask us for advice — whether or not the event ends up with us.

## 1. Start with the guest count
The venue should stay comfortable even at 90% capacity. Ask for the real capacity per season — ours, for example, is 140–180 guests in summer when the terrace is open, and 100–120 in winter.

## 2. Location and parking
How easy is it to reach, and where do guests park? Look for a venue with free parking nearby — Margel 360° has 70+ spaces out front.

## 3. What equipment the rent includes
Sound, lighting, microphones, projector — ask what is included and what costs extra. Hidden equipment surcharges are the most common surprise in offers.

## 4. Music and end time
In residential areas the music stops early. Check:
- whether there is a volume limit;
- whether there is a mandatory end time;
- how overtime hours are charged.

## 5. Catering and bar
Clarify whether the venue works only with fixed suppliers, whether there is a bar with ice and refrigeration, and who serves. Catering must arrive ready to serve if the venue has no full kitchen.

## 6. Outdoor space with a plan B
A terrace or garden makes an event memorable, but always ask what happens if it rains and how many guests the indoor part holds.

## 7. Transparent pricing
A good offer spells out exactly what the rent includes, the deposit and the deadlines. Seasonal dates (New Year''s Eve, May wedding weekends) usually carry different prices — ask upfront.

If you are planning an event in Sofia, come see Margel 360° in person — you will get through all seven points in half an hour.',
  'assets/images/gallery-5.jpg',
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;
