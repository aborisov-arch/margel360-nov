import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { bottleGap, financeGaps, nextMonth, type FinEvent } from "./finance-gaps.ts";

const fe = (o: Partial<FinEvent>): FinEvent => ({
  id: "e1", month: "2026-08", event_date: "2026-08-08", customer_name: "Иван", enquiry_id: null,
  drinks_cost_in_expenses: false, income_drinks_eur: 0, pnl_drinks: null, ...o,
});

Deno.test("nextMonth rolls the year", () => {
  assertEquals(nextMonth("2026-12"), "2027-01");
  assertEquals(nextMonth("2026-05"), "2026-06");
});

Deno.test("bottleGap cases", () => {
  assertEquals(bottleGap(fe({}), null, false), null);
  assertEquals(bottleGap(fe({ income_drinks_eur: 198 }), null, false), "липсва разбивка на продадените напитки");
  assertEquals(bottleGap(fe({ pnl_drinks: [{ qty: 2, unit_cost_eur: 10 }, { qty: 1, unit_cost_eur: null }] }), null, false), "липсва покупна цена за 1 ръчна напитка (въведете я на реда)");
  assertEquals(bottleGap(fe({ pnl_drinks: [{ qty: 0, unit_cost_eur: null }] }), null, false), null);
  // Unsaved P&L: seeded from the order; without catalog prices every ordered bottle lacks a cost.
  assertEquals(bottleGap(fe({}), [{ id: "cola", qty: 3 }, { id: "panna50", qty: 1 }], false), "липсва покупна цена за 2 напитки (Каталог → Напитки)");
  assertEquals(bottleGap(fe({ drinks_cost_in_expenses: true }), null, false), "няма въведен разход „Напитки / алкохол“");
  assertEquals(bottleGap(fe({ drinks_cost_in_expenses: true }), null, true), null);
});

Deno.test("financeGaps lists electricity per month and held events only", () => {
  const gaps = financeGaps({
    events: [
      fe({ id: "a", month: "2026-07", event_date: "2026-07-18", pnl_drinks: [{ qty: 1 }] }),
      fe({ id: "b", month: "2026-09", event_date: "2026-09-30", pnl_drinks: [{ qty: 1 }] }),
    ],
    today: "2026-09-25", nowMonth: "2026-09", electricityMonths: new Set(["2026-08"]),
    enquiryDrinks: new Map(), eventsWithDrinksExpense: new Set(), names: new Map(),
  });
  assertEquals(gaps.map(g => `${g.month} ${g.text}`), [
    "2026-07 Ток: няма въведена месечна сметка",
    "2026-09 Ток: няма въведена месечна сметка",
    "2026-07 18.07.2026 · Иван: липсва покупна цена за 1 ръчна напитка (въведете я на реда)",
  ]);
});

Deno.test("glasswareGap flags booked glassware without a purchase price", async () => {
  const { glasswareGap } = await import("./finance-gaps.ts");
  const ids = new Set(["glass-wine"]);
  assertEquals(glasswareGap([{ id: "glass-wine", qty: 50 }], ids, new Map()), "Посуда: липсва покупна цена за 1 вид (Каталог → Посуда)");
  assertEquals(glasswareGap([{ id: "glass-wine", qty: 50 }], ids, new Map([["glass-wine", 0.3]])), null);
  // Stamped category counts even when the item is no longer in the catalog.
  assertEquals(glasswareGap([{ id: "old", qty: 2, category: "glassware" }, { id: "dj" }], ids, new Map()), "Посуда: липсва покупна цена за 1 вид (Каталог → Посуда)");
  assertEquals(glasswareGap([{ id: "dj", qty: 1 }], ids, new Map()), null);
});

Deno.test("bottleGap falls back to the catalog purchase price for lines without an entered cost", () => {
  const costs = new Map([["cola", 0.75], ["panna50", 0.49]]);
  // Saved P&L lines without a per-line cost follow the catalog.
  assertEquals(bottleGap(fe({ pnl_drinks: [{ id: "cola", qty: 10, unit_cost_eur: null }, { id: "panna50", qty: 5 }] }), null, false, costs), null);
  // A drink with no catalog price is a gap that points at the catalog; a manual line (no id) at its own row.
  assertEquals(bottleGap(fe({ pnl_drinks: [{ id: "cheval_sb", qty: 5 }, { id: "cola", qty: 1 }] }), null, false, costs), "липсва покупна цена за 1 напитка (Каталог → Напитки)");
  assertEquals(bottleGap(fe({ pnl_drinks: [{ id: null, qty: 1, unit_cost_eur: null }] }), null, false, costs), "липсва покупна цена за 1 ръчна напитка (въведете я на реда)");
  assertEquals(bottleGap(fe({ pnl_drinks: [{ id: "cheval_sb", qty: 1 }, { id: null, qty: 1 }] }), null, false, costs), "липсва покупна цена за 2 напитки (1 в Каталог → Напитки, 1 ръчна на реда)");
  // Catalog drinks take the catalog price only: a cost stored on the line (even 0) does not stand in for it.
  assertEquals(bottleGap(fe({ pnl_drinks: [{ id: "cheval_sb", qty: 5, unit_cost_eur: 0 }] }), null, false, costs), "липсва покупна цена за 1 напитка (Каталог → Напитки)");
  // A manual line's typed cost (even 0) counts.
  assertEquals(bottleGap(fe({ pnl_drinks: [{ id: null, qty: 2, unit_cost_eur: 0 }] }), null, false, costs), null);
  // Unsaved P&L seeded from the order: the ordered ids resolve through the catalog too.
  assertEquals(bottleGap(fe({}), [{ id: "cola", qty: 3 }, { id: "unknown", qty: 1 }], false, costs), "липсва покупна цена за 1 напитка (Каталог → Напитки)");
  assertEquals(bottleGap(fe({}), [{ id: "cola", qty: 3 }], false, costs), null);
  // Parity with drinkUnitCost(): "", negative and non-numeric entries are not costs - the catalog fills in.
  assertEquals(bottleGap(fe({ pnl_drinks: [{ id: "cola", qty: 2, unit_cost_eur: "" }, { id: "cola", qty: 2, unit_cost_eur: -1 }, { id: "cola", qty: 2, unit_cost_eur: "abc" }] }), null, false, costs), null);
  // ...and without a catalog price they stay missing; any nonzero qty counts, as on the page.
  assertEquals(bottleGap(fe({ pnl_drinks: [{ id: "cheval_sb", qty: 2, unit_cost_eur: "" }, { id: "cheval_sb", qty: -1 }] }), null, false, costs), "липсва покупна цена за 2 напитки (Каталог → Напитки)");
  assertEquals(bottleGap(fe({ pnl_drinks: [{ id: null, qty: 2, unit_cost_eur: "" }, { id: null, qty: 1, unit_cost_eur: "abc" }] }), null, false, costs), "липсва покупна цена за 2 ръчни напитки (въведете я на реда)");
});

Deno.test("financeGaps resolves bottle costs through the catalog purchase prices", () => {
  const gaps = financeGaps({
    events: [fe({ id: "a", month: "2026-10", event_date: "2026-10-21", pnl_drinks: [{ id: "cola", qty: 38 }, { id: "cheval_sb", qty: 5 }] })],
    today: "2026-10-26", nowMonth: "2026-10", electricityMonths: new Set(["2026-10"]),
    enquiryDrinks: new Map(), eventsWithDrinksExpense: new Set(), names: new Map(),
    drinkCosts: new Map([["cola", 0.75]]),
  });
  assertEquals(gaps.map(g => g.text), ["21.10.2026 · Иван: липсва покупна цена за 1 напитка (Каталог → Напитки)"]);
});
