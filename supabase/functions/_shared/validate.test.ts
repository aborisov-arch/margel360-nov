import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { isUuid, validateField } from "./validate.ts";

Deno.test("validateField: guests accepts 1..200", () => {
  assertEquals(validateField("guests", 50).ok, true);
  assertEquals(validateField("guests", 1).ok, true);
  assertEquals(validateField("guests", 200).ok, true);
});

Deno.test("validateField: guests rejects out-of-range and non-integers", () => {
  assertEquals(validateField("guests", 0).ok, false);
  assertEquals(validateField("guests", 201).ok, false);
  assertEquals(validateField("guests", -5).ok, false);
  assertEquals(validateField("guests", 12.5).ok, false);
  assertEquals(validateField("guests", "50").ok, false);
  assertEquals(validateField("guests", "<script>").ok, false);
});

Deno.test("validateField: preferred_date requires DD/MM/YYYY", () => {
  assertEquals(validateField("preferred_date", "01/05/2026").ok, true);
  assertEquals(validateField("preferred_date", "2026-05-01").ok, false);
  assertEquals(validateField("preferred_date", "01-05-2026").ok, false);
  assertEquals(validateField("preferred_date", "bogus").ok, false);
  assertEquals(validateField("preferred_date", null).ok, false);
});

Deno.test("validateField: notes accepts null, string, rejects huge string", () => {
  assertEquals(validateField("notes", null).ok, true);
  assertEquals(validateField("notes", "short").ok, true);
  assertEquals(validateField("notes", "x".repeat(2001)).ok, false);
  assertEquals(validateField("notes", 42).ok, false);
});

Deno.test("validateField: addons rejects bad shapes", () => {
  assertEquals(validateField("addons", []).ok, true);
  assertEquals(validateField("addons", [{ id: "dj", name: "DJ", price: 300 }]).ok, true);
  assertEquals(validateField("addons", [{ id: "dj", name: "DJ", price: "300" }]).ok, false);
  assertEquals(validateField("addons", [{ id: "dj", name: "DJ", price: -1 }]).ok, false);
  assertEquals(validateField("addons", [{ id: "", name: "DJ", price: 10 }]).ok, false);
  assertEquals(validateField("addons", "not-an-array").ok, false);
});

Deno.test("validateField: drinks rejects non-integer qty", () => {
  assertEquals(validateField("drinks", [{ id: "beer", name: "Beer", qty: 2, price_eur: 5 }]).ok, true);
  assertEquals(validateField("drinks", [{ id: "beer", name: "Beer", qty: 2.5, price_eur: 5 }]).ok, false);
  assertEquals(validateField("drinks", [{ id: "beer", name: "Beer", qty: "2", price_eur: 5 }]).ok, false);
  assertEquals(validateField("drinks", [{ id: "beer", name: "Beer", qty: -1, price_eur: 5 }]).ok, false);
  assertEquals(validateField("drinks", [{ id: "beer", name: "Beer", qty: 2, price_eur: null }]).ok, true);
});

Deno.test("validateField: drinks apply a flat 0..200 qty bound regardless of id (real per-category caps enforced downstream by catalog.ts repriceDrinks)", () => {
  // Shape validation no longer knows about alcoholic vs non-alcoholic ids —
  // qty 200 passes and 201 fails for ANY id, including a formerly-alcoholic
  // one like 'moet' that used to cap at 100 here.
  assertEquals(validateField("drinks", [{ id: "moet", name: "Moet", qty: 100, price_eur: 90 }]).ok, true);
  assertEquals(validateField("drinks", [{ id: "moet", name: "Moet", qty: 101, price_eur: 90 }]).ok, true);
  assertEquals(validateField("drinks", [{ id: "moet", name: "Moet", qty: 200, price_eur: 90 }]).ok, true);
  assertEquals(validateField("drinks", [{ id: "moet", name: "Moet", qty: 201, price_eur: 90 }]).ok, false);
  assertEquals(validateField("drinks", [{ id: "cola", name: "Cola", qty: 200, price_eur: 3 }]).ok, true);
  assertEquals(validateField("drinks", [{ id: "cola", name: "Cola", qty: 201, price_eur: 3 }]).ok, false);
});

Deno.test("validateField: phone length", () => {
  assertEquals(validateField("phone", "+359 888 100 042").ok, true);
  assertEquals(validateField("phone", "").ok, false);
  assertEquals(validateField("phone", "x".repeat(31)).ok, false);
});

Deno.test("isUuid: accepts valid, rejects invalid", () => {
  assertEquals(isUuid("5fd67fd3-a5dc-455b-b34d-0f19bb0f7c31"), true);
  assertEquals(isUuid("not-a-uuid"), false);
  assertEquals(isUuid(""), false);
  assertEquals(isUuid(null), false);
  assertEquals(isUuid(123), false);
});
