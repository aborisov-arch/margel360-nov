import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { effectiveVenuePrice, seasonalVenuePrice } from "./seasonal-pricing.ts";

Deno.test("NYE: Dec 31 is 4200 for every event type, any year", () => {
  assertEquals(seasonalVenuePrice("31/12/2026"), 4200);
  assertEquals(seasonalVenuePrice("31/12/2027"), 4200);
  assertEquals(effectiveVenuePrice("corp4", "31/12/2026"), 4200);
  assertEquals(effectiveVenuePrice("wedding", "31/12/2026"), 4200);
});

Deno.test("winter season: weekday vs weekend tiers", () => {
  assertEquals(seasonalVenuePrice("01/12/2026"), 1670); // Tue, first day
  assertEquals(seasonalVenuePrice("04/12/2026"), 1780); // Fri
  assertEquals(seasonalVenuePrice("05/12/2026"), 1780); // Sat
  assertEquals(seasonalVenuePrice("06/12/2026"), 1670); // Sun counts as weekday tier
  assertEquals(seasonalVenuePrice("30/12/2026"), 1670); // Wed, last day
});

Deno.test("spring season: boundaries + tiers", () => {
  assertEquals(seasonalVenuePrice("18/05/2027"), null); // day before
  assertEquals(seasonalVenuePrice("19/05/2027"), 1670); // Wed, first day
  assertEquals(seasonalVenuePrice("22/05/2027"), 1780); // Sat
  assertEquals(seasonalVenuePrice("10/06/2027"), 1670); // Thu, last day
  assertEquals(seasonalVenuePrice("11/06/2027"), null); // day after
});

Deno.test("outside seasons: null override, base price applies", () => {
  assertEquals(seasonalVenuePrice("30/11/2026"), null);
  assertEquals(seasonalVenuePrice("01/01/2027"), null);
  assertEquals(seasonalVenuePrice("15/07/2027"), null);
  assertEquals(effectiveVenuePrice("evening", "15/07/2027"), 1280);
  assertEquals(effectiveVenuePrice("corp4", "30/11/2026"), 330);
  assertEquals(effectiveVenuePrice("corp8", "30/11/2026"), 440);
  assertEquals(effectiveVenuePrice("bday_day", "30/11/2026"), 700);
  assertEquals(effectiveVenuePrice("bday_eve", "30/11/2026"), 970);
  assertEquals(effectiveVenuePrice("wedding", "30/11/2026"), 1500);
});

Deno.test("malformed input degrades to base / 0", () => {
  assertEquals(seasonalVenuePrice("2026-12-05"), null);
  assertEquals(seasonalVenuePrice(""), null);
  assertEquals(effectiveVenuePrice("evening", null), 1280);
  assertEquals(effectiveVenuePrice("evening", "bogus"), 1280);
  assertEquals(effectiveVenuePrice("unknown_event", "15/07/2027"), 0);
  assertEquals(effectiveVenuePrice(null, "15/07/2027"), 0);
});
