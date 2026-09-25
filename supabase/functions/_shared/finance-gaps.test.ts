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
  assertEquals(bottleGap(fe({ pnl_drinks: [{ qty: 2, unit_cost_eur: 10 }, { qty: 1, unit_cost_eur: null }] }), null, false), "липсва покупна цена за 1 напитка");
  assertEquals(bottleGap(fe({ pnl_drinks: [{ qty: 0, unit_cost_eur: null }] }), null, false), null);
  // Unsaved P&L: seeded from the order, so every ordered bottle lacks a cost.
  assertEquals(bottleGap(fe({}), [{ qty: 3 }, { qty: 1 }], false), "липсва покупна цена за 2 напитки");
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
    "2026-07 18.07.2026 · Иван: липсва покупна цена за 1 напитка",
  ]);
});
