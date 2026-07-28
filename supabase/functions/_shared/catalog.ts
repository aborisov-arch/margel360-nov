// Catalog lookups + server-side repricing for enquiry items. The
// public.drinks / public.addon_services tables are the single source of
// truth for prices - client-sent prices are recomputed here so a tampered
// payload can never store a price the catalog doesn't back.
//
// Grandfathering (update paths): an item that is missing or inactive in the
// catalog but exists in the STORED enquiry is kept at its stored values -
// drinks may only decrease qty, addons must be unchanged. Without this,
// deactivating an item would 400 every edit of bookings that contain it.

export type CatalogDrink = { id: string; cat: number; name_en: string; price_eur: number; active: boolean };
export type CatalogAddon = { id: string; name_en: string; price_eur: number; free_until: number | null; max_qty: number | null; active: boolean };
export type Catalog = { drinks: Map<string, CatalogDrink>; addons: Map<string, CatalogAddon> };

export type DrinkItem = { id: string; name: string; qty: number; price_eur: number | null };
export type AddonItem = { id: string; name: string; price: number; qty?: number };
export type RepriceResult<T> = { ok: true; value: T[] } | { ok: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

// deno-lint-ignore no-explicit-any
export async function loadCatalog(sb: any): Promise<Catalog> {
  const [dRes, aRes] = await Promise.all([
    sb.from("drinks").select("id, cat, name_en, price_eur, active"),
    sb.from("addon_services").select("id, name_en, price_eur, free_until, max_qty, active"),
  ]);
  if (dRes.error) throw new Error(`drinks catalog load failed: ${dRes.error.message}`);
  if (aRes.error) throw new Error(`addon catalog load failed: ${aRes.error.message}`);
  return {
    drinks: new Map((dRes.data ?? []).map((r: CatalogDrink) =>
      [r.id, { ...r, cat: Number(r.cat), price_eur: Number(r.price_eur) }])),
    addons: new Map((aRes.data ?? []).map((r: CatalogAddon) =>
      [r.id, { ...r, price_eur: Number(r.price_eur) }])),
  };
}

export function repriceDrinks(items: DrinkItem[], catalog: Catalog, stored: DrinkItem[] = []): RepriceResult<DrinkItem> {
  const storedById = new Map(stored.map((d) => [d.id, d]));
  const seen = new Set<string>();
  const out: DrinkItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) return { ok: false, error: `drink ${item.id}: duplicate` };
    seen.add(item.id);
    const c = catalog.drinks.get(item.id);
    if (c && c.active) {
      const max = c.cat >= 3 ? 200 : 100;
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > max) {
        return { ok: false, error: `drink ${item.id}: qty must be 1..${max}` };
      }
      out.push({ id: item.id, name: c.name_en, qty: item.qty, price_eur: round2(c.price_eur) });
      continue;
    }
    const prev = storedById.get(item.id);
    if (!prev) return { ok: false, error: `drink ${item.id}: unknown item` };
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > (Number(prev.qty) || 0)) {
      return { ok: false, error: `drink ${item.id}: no longer offered - qty can only decrease` };
    }
    out.push({ id: prev.id, name: prev.name, qty: item.qty, price_eur: prev.price_eur ?? null });
  }
  return { ok: true, value: out };
}

export function repriceAddons(items: AddonItem[], catalog: Catalog, stored: AddonItem[] = []): RepriceResult<AddonItem> {
  const storedById = new Map(stored.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const out: AddonItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) return { ok: false, error: `addon ${item.id}: duplicate` };
    seen.add(item.id);
    const c = catalog.addons.get(item.id);
    if (c && c.active) {
      const isQty = c.free_until != null || c.max_qty != null;
      if (isQty) {
        const max = c.max_qty ?? 999;
        // Same strictness as repriceDrinks: raw value must be an integer
        // number - no coercion of strings like "2".
        if (typeof item.qty !== "number" || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > max) {
          return { ok: false, error: `addon ${item.id}: qty must be 1..${max}` };
        }
        const line = c.free_until != null
          ? Math.max(0, item.qty - c.free_until) * c.price_eur
          : item.qty * c.price_eur;
        out.push({ id: item.id, name: c.name_en, price: round2(line), qty: item.qty });
      } else {
        out.push({ id: item.id, name: c.name_en, price: round2(c.price_eur) });
      }
      continue;
    }
    const prev = storedById.get(item.id);
    if (!prev) return { ok: false, error: `addon ${item.id}: unknown item` };
    if (Number(prev.qty ?? 0) !== Number(item.qty ?? 0)) {
      return { ok: false, error: `addon ${item.id}: no longer offered - cannot change quantity` };
    }
    out.push({ ...prev });
  }
  return { ok: true, value: out };
}
