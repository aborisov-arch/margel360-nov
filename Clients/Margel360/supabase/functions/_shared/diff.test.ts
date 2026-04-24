import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { diffEnquiry } from "./diff.ts";

Deno.test("diffEnquiry: scalar change", () => {
  const before = { guests: 30, phone: "0888100042", notes: null };
  const after  = { guests: 35, phone: "0888100042", notes: null };
  assertEquals(diffEnquiry(before, after), [
    { field: "guests", before: 30, after: 35 },
  ]);
});

Deno.test("diffEnquiry: addon array change", () => {
  const before = { addons: [{ id: "dj", name: "DJ", price: 300 }] };
  const after  = { addons: [{ id: "dj", name: "DJ", price: 300 }, { id: "led", name: "LED", price: 148 }] };
  const d = diffEnquiry(before, after);
  assertEquals(d.length, 1);
  assertEquals(d[0].field, "addons");
});

Deno.test("diffEnquiry: no change returns empty", () => {
  const before = { guests: 30, notes: "ok" };
  const after  = { guests: 30, notes: "ok" };
  assertEquals(diffEnquiry(before, after), []);
});

Deno.test("diffEnquiry: only whitelisted fields", () => {
  const before = { guests: 30, email: "a@b.c", status: "new" };
  const after  = { guests: 35, email: "x@y.z", status: "answered" };
  const d = diffEnquiry(before, after);
  assertEquals(d.length, 1); // guests only; email and status are not in the whitelist
  assertEquals(d[0].field, "guests");
});

Deno.test("diffEnquiry: preferred_date is whitelisted", () => {
  const before = { preferred_date: "26/04/2026" };
  const after  = { preferred_date: "30/04/2026" };
  const d = diffEnquiry(before, after);
  assertEquals(d.length, 1);
  assertEquals(d[0].field, "preferred_date");
});
