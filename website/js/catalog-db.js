// DB-backed catalog loader - the single runtime source for the drinks and
// addon-services catalogs (public.drinks / public.addon_services, managed
// from admin/catalog.html). Exposes window.loadCatalog(); on success the
// same globals the static files used to define (drinks, drinkCategories,
// addonServices) exist with identical field names, so the renderers only
// changed their entry point. Plain REST fetch - no supabase-js needed.
(function () {
  const SB_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
  const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseHV0c3Vmcm9iem92ZHNpZWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDc3MDQsImV4cCI6MjA5MTQ4MzcwNH0.EY2j3lZRmfGlWcTTNy9CMIHZX1E-2jit11jZwP7UOJo';
  const HEADERS = { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON };

  // Category labels are translation strings, not data - they stay in code.
  const CATEGORY_LABELS = {
    bg: ['Шампанско', 'Вино', 'Алкохол & Уиски', 'Безалкохолно', 'Вода'],
    en: ['Champagne', 'Wine', 'Spirits & Whisky', 'Soft Drinks', 'Water'],
  };

  function resolveImg(img) {
    if (!img || /^(https?:)?\//.test(img) || /^assets\//.test(img)) return img;
    return SB_URL + '/storage/v1/object/public/catalog-images/' + img;
  }

  async function fetchTable(pathAndQuery) {
    const res = await fetch(SB_URL + '/rest/v1/' + pathAndQuery, { headers: HEADERS });
    if (!res.ok) throw new Error('catalog fetch failed: HTTP ' + res.status);
    return res.json();
  }

  let cached = null;
  window.loadCatalog = function loadCatalog() {
    if (!cached) {
      cached = Promise.all([
        fetchTable('drinks?select=id,cat,name_bg,name_en,price_eur,img&active=is.true&order=cat.asc,sort_order.asc'),
        fetchTable('addon_services?select=id,name_bg,name_en,price_eur,hint_bg,hint_en,free_until,max_qty,img&active=is.true&order=sort_order.asc'),
      ]).then(function (results) {
        window.drinkCategories = CATEGORY_LABELS;
        window.drinks = results[0].map(function (r) {
          return { id: r.id, cat: Number(r.cat), name_bg: r.name_bg, name_en: r.name_en,
                   price_eur: r.price_eur == null ? null : Number(r.price_eur), img: resolveImg(r.img) };
        });
        window.addonServices = results[1].map(function (r) {
          const o = { id: r.id, name_bg: r.name_bg, name_en: r.name_en,
                      price: Number(r.price_eur), img: resolveImg(r.img) };
          if (r.hint_bg) o.hint_bg = r.hint_bg;
          if (r.hint_en) o.hint_en = r.hint_en;
          if (r.free_until != null) o.freeUntil = Number(r.free_until);
          if (r.max_qty != null) o.maxQty = Number(r.max_qty);
          return o;
        });
        return { drinks: window.drinks, addonServices: window.addonServices };
      }).catch(function (err) {
        cached = null;   // allow a retry on the next call
        throw err;
      });
    }
    return cached;
  };
})();
