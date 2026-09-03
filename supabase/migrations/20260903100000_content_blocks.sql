-- Admin-managed SEO/GEO content blocks rendered on the public pages
-- (website/js/content-blocks.js; editor at admin/content.html). Same access
-- model as the catalog tables: anon reads active rows, admins get full CRUD.
-- Each page keeps a baked static copy for non-JS crawlers - regenerate with
-- scripts/bake-content-blocks.mjs after content changes (known drift tradeoff,
-- same as the baked catalog blocks).

CREATE TABLE IF NOT EXISTS public.content_blocks (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  page text NOT NULL CHECK (page IN
    ('index','services','menu','gallery','evening','corporate','birthday','wedding','faq','contact')),
  title_bg text NOT NULL CHECK (length(title_bg) BETWEEN 1 AND 200),
  title_en text NOT NULL CHECK (length(title_en) BETWEEN 1 AND 200),
  body_bg text NOT NULL CHECK (length(body_bg) BETWEEN 1 AND 4000),
  body_en text NOT NULL CHECK (length(body_en) BETWEEN 1 AND 4000),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_blocks_page_idx
  ON public.content_blocks(page, sort_order);

ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_blocks_public_read ON public.content_blocks;
CREATE POLICY content_blocks_public_read ON public.content_blocks
  FOR SELECT TO anon USING (active);

DROP POLICY IF EXISTS content_blocks_admin_all ON public.content_blocks;
CREATE POLICY content_blocks_admin_all ON public.content_blocks
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Starter blocks (verified venue facts; deliberately no prices - prices live
-- in the catalog/venue maps, not in prose). Managers edit these freely.
INSERT INTO public.content_blocks
  (id, page, sort_order, title_bg, title_en, body_bg, body_en)
VALUES
  ('idx-venue', 'index', 10, 'Зала за събития под наем в София', 'Event venue for rent in Sofia', 'Маргел 360° е зала за събития на бул. Околовръстен път 155, ет. 4, София. Разполага с панорамна тераса от 360 м² и събира 140–180 гости през лятото и 100–120 през зимата.

Залата е подходяща за сватби, рождени дни, корпоративни събития и вечерни тържества — с професионално озвучение, модерно осветление и пълна AV техника, включени в наема.', 'Margel 360° is an event venue at 155 Okolovrasten Pat Blvd, floor 4, Sofia. It features a panoramic 360 m² terrace and hosts 140–180 guests in summer and 100–120 in winter.

The venue suits weddings, birthdays, corporate events and evening celebrations — with professional sound, modern lighting and full AV equipment included in the rent.'),
  ('idx-music', 'index', 20, 'Музика без ограничения и без краен час', 'Music without limits and no fixed end time', 'Залата се намира в район без жилищни сгради в непосредствена близост, затова музиката може да звучи с пълна сила. Озвучаването е с 12 тонколони EV/YAMAHA в конфигурация 360°.

За вечерните събития няма задължителен краен час — тържеството продължава, докато вие искате.', 'The venue sits in an area with no residential buildings nearby, so the music can play at full volume. Sound comes from 12 EV/YAMAHA speakers in a 360° configuration.

Evening events have no mandatory end time — the celebration lasts as long as you want.'),
  ('idx-location', 'index', 30, 'Локация, паркинг и кетъринг', 'Location, parking and catering', 'Пред залата има над 70 безплатни паркоместа, с лесен достъп от Околовръстен път към всички квартали на София.

Залата разполага с бар с хладилни витрини, ледогенератори и кафемашина. Кетърингът пристига готов за сервиране — работим с доверени партньори или с избран от вас доставчик.', 'There are 70+ free parking spaces in front of the venue, with easy access from the ring road to every part of Sofia.

The venue has a bar with refrigerated displays, ice makers and a coffee machine. Catering arrives ready to serve — we work with trusted partners or a caterer of your choice.'),
  ('wed-overview', 'wedding', 10, 'Сватба с панорамна тераса в София', 'A wedding with a panoramic terrace in Sofia', 'Маргел 360° събира до 180 гости през лятото, а терасата от 360 м² е естествената сцена за изнесен ритуал и коктейл на открито.

В наема са включени професионално озвучение, осветление и техника, а екипът ни помага с DJ, фотограф, украса и всички допълнителни услуги от каталога ни.', 'Margel 360° hosts up to 180 guests in summer, and the 360 m² terrace is a natural stage for an outdoor ceremony and cocktail hour.

Professional sound, lighting and AV equipment are included in the rent, and our team helps with DJ, photographer, decoration and every add-on service in our catalog.'),
  ('corp-overview', 'corporate', 10, 'Корпоративни събития и фирмени партита', 'Corporate events and company parties', 'Залата е подходяща за тиймбилдинги, коледни партита, презентации и обучения — с проектор, микрофони и гъвкаво разпределение на пространството.

Предлагаме дневни и вечерни формати, а над 70-те безплатни паркоместа улесняват гостите ви.', 'The venue works for team buildings, Christmas parties, presentations and trainings — with a projector, microphones and a flexible floor plan.

We offer daytime and evening formats, and the 70+ free parking spaces make arrival easy for your guests.')
ON CONFLICT (id) DO NOTHING;
