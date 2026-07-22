import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { repriceAddons, repriceDrinks, type Catalog } from "./catalog.ts";

function cat(): Catalog {
  return {
    drinks: new Map([
      ["moet",  { id: "moet",  cat: 0, name_en: "Moët & Chandon Brut", price_eur: 62.38, active: true }],
      ["cola",  { id: "cola",  cat: 3, name_en: "Coca-Cola 0.33L",     price_eur: 1.07,  active: true }],
      ["gone",  { id: "gone",  cat: 2, name_en: "Old Whisky",          price_eur: 30,    active: false }],
    ]),
    addons: new Map([
      ["dj",        { id: "dj",        name_en: "DJ for 5 hours",   price_eur: 300, free_until: null, max_qty: null, active: true }],
      ["cleaning",  { id: "cleaning",  name_en: "Hall cleaning",    price_eur: 70,  free_until: null, max_qty: null, active: true }],
      ["heater",    { id: "heater",    name_en: "Gas patio heater", price_eur: 74,  free_until: null, max_qty: 2,    active: true }],
      ["bar_stool", { id: "bar_stool", name_en: "Bar stool",        price_eur: 5,   free_until: 40,   max_qty: null, active: true }],
    ]),
  };
}

Deno.test("repriceDrinks: overrides tampered price and name from the catalog", () => {
  const r = repriceDrinks([{ id: "moet", name: "hacked", qty: 2, price_eur: 0.01 }], cat());
  assertEquals(r, { ok: true, value: [{ id: "moet", name: "Moët & Chandon Brut", qty: 2, price_eur: 62.38 }] });
});

Deno.test("repriceDrinks: per-category caps (soft 200 / alcoholic 100)", () => {
  assertEquals(repriceDrinks([{ id: "cola", name: "x", qty: 200, price_eur: null }], cat()).ok, true);
  assertEquals(repriceDrinks([{ id: "cola", name: "x", qty: 201, price_eur: null }], cat()).ok, false);
  assertEquals(repriceDrinks([{ id: "moet", name: "x", qty: 101, price_eur: null }], cat()).ok, false);
});

Deno.test("repriceDrinks: unknown id rejected at submit (no stored)", () => {
  assertEquals(repriceDrinks([{ id: "nope", name: "x", qty: 1, price_eur: 5 }], cat()).ok, false);
});

Deno.test("repriceDrinks: inactive item grandfathered from stored, decrease only", () => {
  const stored = [{ id: "gone", name: "Old Whisky", qty: 5, price_eur: 25 }];
  const keep = repriceDrinks([{ id: "gone", name: "Old Whisky", qty: 3, price_eur: 25 }], cat(), stored);
  assertEquals(keep, { ok: true, value: [{ id: "gone", name: "Old Whisky", qty: 3, price_eur: 25 }] });
  assertEquals(repriceDrinks([{ id: "gone", name: "Old Whisky", qty: 6, price_eur: 25 }], cat(), stored).ok, false);
});

Deno.test("repriceDrinks: duplicate ids rejected", () => {
  const items = [{ id: "cola", name: "x", qty: 1, price_eur: null }, { id: "cola", name: "x", qty: 2, price_eur: null }];
  assertEquals(repriceDrinks(items, cat()).ok, false);
});

Deno.test("repriceAddons: toggle addon gets catalog unit price, no qty", () => {
  const r = repriceAddons([{ id: "dj", name: "hacked", price: 1 }], cat());
  assertEquals(r, { ok: true, value: [{ id: "dj", name: "DJ for 5 hours", price: 300 }] });
});

Deno.test("repriceAddons: qty addon line price + max_qty cap", () => {
  const ok = repriceAddons([{ id: "heater", name: "x", price: 0, qty: 2 }], cat());
  assertEquals(ok, { ok: true, value: [{ id: "heater", name: "Gas patio heater", price: 148, qty: 2 }] });
  assertEquals(repriceAddons([{ id: "heater", name: "x", price: 0, qty: 3 }], cat()).ok, false);
});

Deno.test("repriceAddons: furniture bills only above free_until", () => {
  const r = repriceAddons([{ id: "bar_stool", name: "x", price: 999, qty: 42 }], cat());
  assertEquals(r, { ok: true, value: [{ id: "bar_stool", name: "Bar stool", price: 10, qty: 42 }] });
});

Deno.test("repriceAddons: unknown id rejected at submit, grandfathered unchanged on update", () => {
  assertEquals(repriceAddons([{ id: "nope", name: "x", price: 50 }], cat()).ok, false);
  const stored = [{ id: "nope", name: "Old svc", price: 50, qty: 2 }];
  assertEquals(repriceAddons([{ id: "nope", name: "Old svc", price: 50, qty: 2 }], cat(), stored),
    { ok: true, value: [{ id: "nope", name: "Old svc", price: 50, qty: 2 }] });
  assertEquals(repriceAddons([{ id: "nope", name: "Old svc", price: 50, qty: 1 }], cat(), stored).ok, false);
});
