import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { type FeedDb, handleCalendarFeed, sha256Hex } from "./calendar-feed-handler.ts";

const TOKEN = "a".repeat(64);
const SITE = "https://margel360.bg";

type Row = Record<string, unknown>;

// Minimal stand-in for the supabase-js client: records RPC calls, answers
// rate_limit_hit / calendar_feed_touch from the options, serves table rows.
function fakeDb(opts: { allowed?: boolean; touch?: boolean | Error; enquiries?: Row[]; blocks?: string[] } = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const tables: Record<string, Row[]> = {
    enquiries: opts.enquiries ?? [],
    occupied_dates: (opts.blocks ?? []).map(date => ({ date })),
  };
  const reads: string[] = [];
  const db: FeedDb = {
    rpc(fn, args) {
      calls.push({ fn, args });
      if (fn === "rate_limit_hit") return Promise.resolve({ data: opts.allowed ?? true, error: null });
      if (fn === "calendar_feed_touch") {
        return opts.touch instanceof Error
          ? Promise.resolve({ data: null, error: { message: opts.touch.message } })
          : Promise.resolve({ data: opts.touch ?? true, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `unexpected rpc ${fn}` } });
    },
    from(table) {
      reads.push(table);
      const result = Promise.resolve({ data: tables[table] ?? [], error: null });
      const builder = {
        in: (_col: string, _vals: string[]) => result,
        then: result.then.bind(result),
      };
      return { select: (_cols: string) => builder };
    },
  };
  return { db, calls, reads };
}

const booking: Row = {
  id: "11111111-2222-3333-4444-555555555555", enquiry_number: 1042, full_name: "Иван Петров",
  phone: "+359888123456", event_id: "evening", event_type: "Evening Event", preferred_date: "31/12/2099",
  time_of_day: "eve", arrival_time: "21:00", guests: 60, notes: null, pipeline_status: "confirmed",
  created_at: "2026-10-01T10:00:00Z", last_edited_at: null,
};

function request(method: string, query = `?token=${TOKEN}`, headers: Record<string, string> = {}) {
  return new Request(`https://x.supabase.co/functions/v1/calendar-feed${query}`, { method, headers });
}

Deno.test("sha256Hex hashes like the DB side expects", async () => {
  assertEquals(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

Deno.test("only GET and HEAD are accepted", async () => {
  const { db } = fakeDb();
  assertEquals((await handleCalendarFeed(request("POST"), { db, siteUrl: SITE })).status, 405);
});

Deno.test("a missing or malformed token is 404 before any DB call", async () => {
  const { db, calls } = fakeDb();
  assertEquals((await handleCalendarFeed(request("GET", ""), { db, siteUrl: SITE })).status, 404);
  assertEquals((await handleCalendarFeed(request("GET", "?token=ZZ"), { db, siteUrl: SITE })).status, 404);
  assertEquals(calls.length, 0);
});

Deno.test("rate-limited IPs get 429", async () => {
  const { db } = fakeDb({ allowed: false });
  assertEquals((await handleCalendarFeed(request("GET"), { db, siteUrl: SITE })).status, 429);
});

Deno.test("unknown, revoked or de-listed tokens answer 404 and read no bookings", async () => {
  const { db, reads } = fakeDb({ touch: false });
  const res = await handleCalendarFeed(request("GET"), { db, siteUrl: SITE });
  assertEquals(res.status, 404);
  assertEquals(await res.text(), "");
  assertEquals(reads, []);
});

Deno.test("an RPC failure is 500, not an empty calendar", async () => {
  const { db } = fakeDb({ touch: new Error("db down") });
  assertEquals((await handleCalendarFeed(request("GET"), { db, siteUrl: SITE })).status, 500);
});

Deno.test("a valid token serves the calendar and records the fetch with the token hash", async () => {
  const { db, calls } = fakeDb({ enquiries: [booking], blocks: ["2099-11-05", "2099-12-31"] });
  const res = await handleCalendarFeed(request("GET", undefined, { "user-agent": "Google-Calendar-Importer" }), {
    db, siteUrl: SITE, now: () => new Date("2026-10-26T12:00:00Z"),
  });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "text/calendar; charset=utf-8");
  assertStringIncludes(res.headers.get("content-disposition") ?? "", "margel360.ics");
  const body = await res.text();
  assert(body.startsWith("BEGIN:VCALENDAR\r\n"));
  assertStringIncludes(body, "UID:enq-11111111-2222-3333-4444-555555555555@margel360.bg");
  assertStringIncludes(body, "UID:block-2099-11-05@margel360.bg");
  assert(!body.includes("block-2099-12-31"), "a block on a booked date is not duplicated");
  assertStringIncludes(body, "DTSTAMP:20261026T120000Z");
  const touch = calls.find(c => c.fn === "calendar_feed_touch")!;
  assertEquals(touch.args, { p_token_hash: await sha256Hex(TOKEN), p_user_agent: "Google-Calendar-Importer" });
});

Deno.test("HEAD returns the headers without a body", async () => {
  const { db } = fakeDb({ enquiries: [booking] });
  const res = await handleCalendarFeed(request("HEAD"), { db, siteUrl: SITE });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "text/calendar; charset=utf-8");
  assertEquals(res.body, null);
});
