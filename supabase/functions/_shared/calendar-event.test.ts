import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  blockToEvent, bookingToEvent, buildFeedEvents, parsePreferredDate, sofiaToday, sofiaToUtc,
  type FeedEnquiry,
} from "./calendar-event.ts";

const SITE = "https://margel360.bg";
const ID = "11111111-2222-3333-4444-555555555555";

function enquiry(overrides: Partial<FeedEnquiry> = {}): FeedEnquiry {
  return {
    id: ID, enquiry_number: 1042, full_name: "Иван Петров", phone: "+359888123456",
    event_id: "evening", event_type: "Evening Event", preferred_date: "31/12/2026",
    time_of_day: "eve", arrival_time: "21:00", guests: 60, notes: "Торта в 22:00",
    pipeline_status: "confirmed", created_at: "2026-10-01T10:00:00Z",
    last_edited_at: "2026-10-20T09:00:00Z",
    ...overrides,
  };
}

Deno.test("parsePreferredDate reads the wizard's DD/MM/YYYY and rejects anything else", () => {
  assertEquals(parsePreferredDate("31/12/2026"), { y: 2026, m: 12, d: 31 });
  assertEquals(parsePreferredDate("2026-12-31"), null);
  assertEquals(parsePreferredDate(""), null);
  assertEquals(parsePreferredDate(null), null);
  assertEquals(parsePreferredDate("31/13/2026"), null);
});

Deno.test("sofiaToUtc handles EET, EEST and both DST transition days", () => {
  assertEquals(sofiaToUtc(2026, 1, 15, 19, 0).toISOString(), "2026-01-15T17:00:00.000Z");
  assertEquals(sofiaToUtc(2026, 7, 15, 19, 0).toISOString(), "2026-07-15T16:00:00.000Z");
  // 29 March 2026: clocks go 03:00 -> 04:00
  assertEquals(sofiaToUtc(2026, 3, 29, 1, 0).toISOString(), "2026-03-28T23:00:00.000Z");
  assertEquals(sofiaToUtc(2026, 3, 29, 12, 0).toISOString(), "2026-03-29T09:00:00.000Z");
  // 25 October 2026: clocks go 04:00 -> 03:00
  assertEquals(sofiaToUtc(2026, 10, 25, 1, 0).toISOString(), "2026-10-24T22:00:00.000Z");
  assertEquals(sofiaToUtc(2026, 10, 25, 12, 0).toISOString(), "2026-10-25T10:00:00.000Z");
});

Deno.test("sofiaToday returns the Sofia calendar date of an instant", () => {
  assertEquals(sofiaToday(new Date("2026-10-26T22:30:00Z")), { y: 2026, m: 10, d: 27 });
  assertEquals(sofiaToday(new Date("2026-07-01T20:59:00Z")), { y: 2026, m: 7, d: 1 });
});

Deno.test("evening booking with an arrival time is a 5-hour timed event that may cross midnight", () => {
  const ev = bookingToEvent(enquiry(), { siteUrl: SITE })!;
  assertEquals(ev.allDay, false);
  assertEquals(ev.start.toISOString(), "2026-12-31T19:00:00.000Z");
  assertEquals(ev.end.toISOString(), "2027-01-01T00:00:00.000Z");
  assertEquals(ev.summary, "Вечерно събитие — Иван Петров");
  assertEquals(ev.uid, `enq-${ID}@margel360.bg`);
  assertEquals(ev.categories, ["Вечерно събитие"]);
  assertEquals(ev.url, `${SITE}/admin/dashboard.html#enquiry-${ID}`);
});

Deno.test("catalog windows become timed events with a window line in the description", () => {
  const eve = bookingToEvent(enquiry({ event_id: "bday_eve", event_type: "Children's Birthday - Evening", preferred_date: "15/07/2026", arrival_time: null, time_of_day: "eve" }), { siteUrl: SITE })!;
  assertEquals([eve.start.toISOString(), eve.end.toISOString()], ["2026-07-15T13:00:00.000Z", "2026-07-15T21:00:00.000Z"]);
  assertStringIncludes(eve.description, "Прозорец: 16:00–24:00 (5 часа)");

  const corp = bookingToEvent(enquiry({ event_id: "corp4", event_type: "Corporate Event - 4 hours", preferred_date: "15/07/2026", arrival_time: null, time_of_day: "day" }), { siteUrl: SITE })!;
  assertEquals([corp.start.toISOString(), corp.end.toISOString()], ["2026-07-15T05:00:00.000Z", "2026-07-15T14:30:00.000Z"]);
  assertStringIncludes(corp.description, "Прозорец: 08:00–17:30 (4 часа)");

  const day = bookingToEvent(enquiry({ event_id: "bday_day", event_type: "Children's Birthday - Daytime", preferred_date: "15/07/2026", arrival_time: null, time_of_day: "day" }), { siteUrl: SITE })!;
  assertEquals([day.start.toISOString(), day.end.toISOString()], ["2026-07-15T09:30:00.000Z", "2026-07-15T14:30:00.000Z"]);
  assertStringIncludes(day.description, "Прозорец: до 17:30 (5 часа)");
});

Deno.test("weddings, evenings without an arrival time and unknown types are all-day", () => {
  const w = bookingToEvent(enquiry({ event_id: "wedding", event_type: "Wedding", preferred_date: "15/07/2026", arrival_time: null }), { siteUrl: SITE })!;
  assertEquals(w.allDay, true);
  assertEquals(w.start.toISOString(), "2026-07-15T00:00:00.000Z");
  assertEquals(w.end.toISOString(), "2026-07-16T00:00:00.000Z");
  assertEquals(bookingToEvent(enquiry({ arrival_time: null }), { siteUrl: SITE })!.allDay, true);
  assertEquals(bookingToEvent(enquiry({ event_id: "foo", event_type: "Custom" }), { siteUrl: SITE })!.allDay, true);
});

Deno.test("description lists the booking facts, never a price or an email", () => {
  const lines = bookingToEvent(enquiry(), { siteUrl: SITE })!.description.split("\n");
  assertEquals(lines, [
    "Заявка № 1042",
    "Гости: 60",
    "Време: Вечер · пристигане 21:00",
    "Телефон: +359888123456",
    "Бележки: Торта в 22:00",
    "Статус: Потвърдена",
    `Запитване: ${SITE}/admin/dashboard.html#enquiry-${ID}`,
  ]);
});

Deno.test("empty phone or notes are omitted, long notes are cut, completed reads Приключена", () => {
  const d = bookingToEvent(enquiry({ phone: null, notes: "   ", pipeline_status: "completed" }), { siteUrl: SITE })!.description;
  assert(!d.includes("Телефон"));
  assert(!d.includes("Бележки"));
  assertStringIncludes(d, "Статус: Приключена");

  const long = bookingToEvent(enquiry({ notes: "х".repeat(600) }), { siteUrl: SITE })!.description;
  const notesLine = long.split("\n").find(l => l.startsWith("Бележки: "))!;
  assertEquals(notesLine, "Бележки: " + "х".repeat(500) + "…");
});

Deno.test("control characters in customer text are stripped so one bad note cannot invalidate the feed", () => {
  const ev = bookingToEvent(enquiry({ full_name: "Иван\x07 Петров", notes: "Торта\x00 в 22:00\x1f", phone: "+359\x7f888" }), { siteUrl: SITE })!;
  assertEquals(ev.summary, "Вечерно събитие — Иван Петров");
  assertStringIncludes(ev.description, "Бележки: Торта в 22:00\n");
  assertStringIncludes(ev.description, "Телефон: +359888\n");
  // Tabs and line breaks are legitimate text and stay (the renderer escapes them).
  assertStringIncludes(bookingToEvent(enquiry({ notes: "ред 1\nред\t2" }), { siteUrl: SITE })!.description, "Бележки: ред 1\nред\t2");
});

Deno.test("lastModified prefers last_edited_at, falls back to created_at; bad dates yield null", () => {
  assertEquals(bookingToEvent(enquiry(), { siteUrl: SITE })!.lastModified.toISOString(), "2026-10-20T09:00:00.000Z");
  assertEquals(bookingToEvent(enquiry({ last_edited_at: null }), { siteUrl: SITE })!.lastModified.toISOString(), "2026-10-01T10:00:00.000Z");
  assertEquals(bookingToEvent(enquiry({ preferred_date: "soon" }), { siteUrl: SITE }), null);
  assertEquals(bookingToEvent(enquiry({ preferred_date: null }), { siteUrl: SITE }), null);
});

Deno.test("a manual block is an all-day Заето (ръчно) event keyed by date", () => {
  const b = blockToEvent("2026-11-01");
  assertEquals(b.allDay, true);
  assertEquals(b.summary, "Заето (ръчно)");
  assertEquals(b.uid, "block-2026-11-01@margel360.bg");
  assertEquals(b.start.toISOString(), "2026-11-01T00:00:00.000Z");
  assertEquals(b.end.toISOString(), "2026-11-02T00:00:00.000Z");
  assertEquals(b.url, null);
});

Deno.test("buildFeedEvents keeps the last 365 days and the future, and drops blocks covered by a booking", () => {
  const today = { y: 2026, m: 10, d: 26 };
  const enquiries = [
    enquiry({ id: "a", preferred_date: "25/10/2025" }),   // 366 days back → dropped
    enquiry({ id: "b", preferred_date: "27/10/2025" }),   // inside the window
    enquiry({ id: "c", preferred_date: "01/11/2026" }),   // future
    enquiry({ id: "d", preferred_date: "nonsense" }),     // skipped, not thrown
  ];
  const blocked = ["2026-11-01", "2026-11-05", "2025-01-01"];
  const uids = buildFeedEvents(enquiries, blocked, { siteUrl: SITE, today }).map(e => e.uid).sort();
  assertEquals(uids, [
    "block-2026-11-05@margel360.bg",
    "enq-b@margel360.bg",
    "enq-c@margel360.bg",
  ]);
});
