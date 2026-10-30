-- Наргилета (shisha rented per event): a third addon_services category, so it
-- reuses the add-on path end to end (wizard, edit page, repricing in
-- _shared/catalog.ts, emails, offers, P&L revenue) exactly like Посуда.
-- price_eur = rental price per shisha per event; max_qty = how many shishas
-- the venue owns (the customer picks a count up to it).
ALTER TABLE public.addon_services DROP CONSTRAINT IF EXISTS addon_services_category_check;
ALTER TABLE public.addon_services
  ADD CONSTRAINT addon_services_category_check CHECK (category IN ('service', 'glassware', 'shisha'));
ALTER TABLE public.addon_services
  ADD CONSTRAINT addon_services_shisha_qty CHECK (category <> 'shisha' OR max_qty IS NOT NULL);

-- Placeholder the manager completes from admin/catalog.html → „Наргилета“
-- (photo, rental price, stock, purchase price). Hidden until they switch it
-- on, so the €0 price never reaches the public site or the booking form.
INSERT INTO public.addon_services (id, name_bg, name_en, price_eur, max_qty, category, active, sort_order)
VALUES ('shisha', 'Наргиле', 'Shisha', 0, 999, 'shisha', false, 100)
ON CONFLICT (id) DO NOTHING;

-- The purchase price per shisha goes in the existing finance-only
-- addon_purchase_prices table (keyed by addon id). It is a one-off asset
-- cost: the admin shows it against the rental price as a payback count and
-- it is never charged to individual event P&L (unlike glassware).
