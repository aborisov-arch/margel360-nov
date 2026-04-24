import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { isUuid, validateField } from "./validate.ts";

Deno.test("validateField: guests accepts 1..400", () => {
  assertEquals(validateField("guests", 50).ok, true);
  assertEquals(validateField("guests", 1).ok, true);
  assertEquals(validateField("guests", 400).ok, true);
});

Deno.test("validateField: guests rejects out-of-range and non-integers", () => {
  assertEquals(validateField("guests", 0).ok, false);
  assertEquals(validateField("guests", 401).ok, false);
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
