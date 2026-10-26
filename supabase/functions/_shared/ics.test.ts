import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { foldIcsLine, icsDate, icsDateTimeUtc, icsEscape, renderIcs } from "./ics.ts";
import type { CalendarEvent } from "./calendar-event.ts";

const NOW = new Date("2026-10-26T12:00:00Z");

const timed: CalendarEvent = {
  uid: "enq-abc@margel360.bg",
  summary: "Вечерно събитие — Иван Петров",
  description: "Заявка № 1042\nГости: 60",
  allDay: false,
  start: new Date("2026-12-31T19:00:00Z"),
  end: new Date("2027-01-01T00:00:00Z"),
  location: "Маргел 360°, бул. Околовръстен път 155, София",
  url: "https://margel360.bg/admin/dashboard.html#enquiry-abc",
  lastModified: new Date("2026-10-20T09:00:00Z"),
  categories: ["Вечерно събитие"],
};

const block: CalendarEvent = {
  uid: "block-2026-07-15@margel360.bg",
  summary: "Заето (ръчно)",
  description: "",
  allDay: true,
  start: new Date("2026-07-15T00:00:00Z"),
  end: new Date("2026-07-16T00:00:00Z"),
  location: "Маргел 360°, бул. Околовръстен път 155, София",
  url: null,
  lastModified: new Date("2026-07-15T00:00:00Z"),
  categories: ["Заето"],
};

const bytes = (s: string) => new TextEncoder().encode(s).length;
const unfold = (s: string) => s.replace(/\r\n[ \t]/g, "");

Deno.test("icsEscape escapes backslash, semicolon, comma and newline per RFC 5545", () => {
  assertEquals(icsEscape("a,b;c\\d\nx"), "a\\,b\\;c\\\\d\\nx");
  assertEquals(icsEscape("plain"), "plain");
  assertEquals(icsEscape("win\r\nline"), "win\\nline");
});

Deno.test("foldIcsLine keeps every physical line within 75 octets without splitting Cyrillic characters", () => {
  const line = "DESCRIPTION:" + "я".repeat(100);
  const folded = foldIcsLine(line);
  const physical = folded.split("\r\n");
  assert(physical.length > 1);
  for (const p of physical) assert(bytes(p) <= 75, `line too long: ${bytes(p)} bytes`);
  for (const p of physical.slice(1)) assert(p.startsWith(" "));
  assertEquals(unfold(folded), line);
  assertEquals(foldIcsLine("short"), "short");
});

Deno.test("date and date-time formatting", () => {
  assertEquals(icsDateTimeUtc(new Date("2026-12-31T19:00:00Z")), "20261231T190000Z");
  assertEquals(icsDate(new Date("2026-07-15T00:00:00Z")), "20260715");
});

Deno.test("renderIcs produces a VCALENDAR with the calendar header and one VEVENT per event", () => {
  const out = renderIcs([timed, block], { calName: "Маргел 360° — резервации", now: NOW });
  assert(out.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Margel 360//calendar-feed//BG\r\n"));
  assert(out.endsWith("END:VCALENDAR\r\n"));
  const u = unfold(out);
  for (const h of ["CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Маргел 360° — резервации", "X-WR-TIMEZONE:Europe/Sofia", "REFRESH-INTERVAL;VALUE=DURATION:PT4H"]) {
    assertStringIncludes(u, `\r\n${h}\r\n`);
  }
  assertEquals((u.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assertEquals((u.match(/END:VEVENT/g) ?? []).length, 2);
  // Only CRLF line ends, no lone LF.
  assert(!out.replace(/\r\n/g, "").includes("\n"));
  for (const p of out.split("\r\n")) assert(bytes(p) <= 75, `line too long: ${p}`);
});

Deno.test("timed events use UTC date-times, all-day events use exclusive DATE ranges", () => {
  const u = unfold(renderIcs([timed, block], { calName: "x", now: NOW }));
  assertStringIncludes(u, "\r\nDTSTART:20261231T190000Z\r\nDTEND:20270101T000000Z\r\n");
  assertStringIncludes(u, "\r\nDTSTART;VALUE=DATE:20260715\r\nDTEND;VALUE=DATE:20260716\r\n");
});

Deno.test("each VEVENT carries the booking properties, escaped", () => {
  const u = unfold(renderIcs([timed, block], { calName: "x", now: NOW }));
  assertStringIncludes(u, "\r\nUID:enq-abc@margel360.bg\r\n");
  assertStringIncludes(u, "\r\nDTSTAMP:20261026T120000Z\r\n");
  assertStringIncludes(u, "\r\nSUMMARY:Вечерно събитие — Иван Петров\r\n");
  assertStringIncludes(u, "\r\nDESCRIPTION:Заявка № 1042\\nГости: 60\r\n");
  assertStringIncludes(u, "\r\nLOCATION:Маргел 360°\\, бул. Околовръстен път 155\\, София\r\n");
  assertStringIncludes(u, "\r\nURL:https://margel360.bg/admin/dashboard.html#enquiry-abc\r\n");
  assertStringIncludes(u, "\r\nSTATUS:CONFIRMED\r\n");
  assertStringIncludes(u, "\r\nTRANSP:OPAQUE\r\n");
  assertStringIncludes(u, "\r\nLAST-MODIFIED:20261020T090000Z\r\n");
  assertStringIncludes(u, "\r\nCATEGORIES:Вечерно събитие\r\n");
  // The block has no URL and an empty description: neither property is emitted.
  const blockPart = u.slice(u.indexOf("UID:block-"));
  assert(!blockPart.includes("URL:"));
  assert(!blockPart.includes("DESCRIPTION:"));
});
