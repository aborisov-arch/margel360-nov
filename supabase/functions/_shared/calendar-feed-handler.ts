// Request handling for the calendar-feed Edge Function (iCal subscription).
// Kept here, with an injectable DB, so the paths (405 / 404 / 429 / 500 /
// 200 / HEAD) are unit-tested; calendar-feed/index.ts only wires the real
// client. Authorisation and fetch bookkeeping are one RPC:
// public.calendar_feed_touch(p_token_hash, p_user_agent) returns true only
// for an active token whose owner is still on the admin allowlist.
import { getIp, rateLimitHit } from "./rate-limit.ts";
import { buildFeedEvents, type FeedEnquiry, sofiaToday } from "./calendar-event.ts";
import { renderIcs } from "./ics.ts";

type DbResult = PromiseLike<{ data: unknown; error: unknown }>;

// Structural subset of the supabase-js client this handler needs.
export interface FeedDb {
  rpc(fn: string, args: Record<string, unknown>): DbResult;
  from(table: string): {
    select(columns: string): DbResult & { in(column: string, values: string[]): DbResult };
  };
}

export const FEED_CAL_NAME = "Маргел 360° — резервации";
const TOKEN_RE = /^[a-f0-9]{64}$/;
const RATE_LIMIT_PER_MINUTE = 30;
const FEED_STATUSES = ["confirmed", "completed"];
const ENQUIRY_COLUMNS =
  "id, enquiry_number, full_name, phone, event_id, event_type, preferred_date, time_of_day, " +
  "arrival_time, guests, notes, pipeline_status, created_at, last_edited_at";
const FEED_HEADERS = {
  "Content-Type": "text/calendar; charset=utf-8",
  "Content-Disposition": 'inline; filename="margel360.ics"',
  "Cache-Control": "private, max-age=300",
};

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const textResponse = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
const emptyResponse = (status: number) => new Response(null, { status });

export async function handleCalendarFeed(
  req: Request,
  deps: { db: FeedDb; siteUrl: string; now?: () => Date },
): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return textResponse("method_not_allowed", 405);

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return emptyResponse(404);

  const ip = getIp(req);
  if (!await rateLimitHit(deps.db, `calfeed:ip:${ip}`, RATE_LIMIT_PER_MINUTE, 60)) {
    return textResponse("rate_limited", 429);
  }

  const touch = await deps.db.rpc("calendar_feed_touch", {
    p_token_hash: await sha256Hex(token),
    p_user_agent: req.headers.get("user-agent") ?? "",
  });
  if (touch.error) {
    console.error("calendar_feed_touch failed:", touch.error);
    return textResponse("feed_unavailable", 500);
  }
  if (touch.data !== true) return emptyResponse(404);

  const [enquiries, blocks] = await Promise.all([
    deps.db.from("enquiries").select(ENQUIRY_COLUMNS).in("pipeline_status", FEED_STATUSES),
    deps.db.from("occupied_dates").select("date"),
  ]);
  if (enquiries.error || blocks.error) {
    console.error("calendar feed load failed:", enquiries.error ?? blocks.error);
    return textResponse("feed_unavailable", 500);
  }

  const now = deps.now?.() ?? new Date();
  const blockedDates = ((blocks.data ?? []) as { date: string }[]).map(r => String(r.date));
  const events = buildFeedEvents((enquiries.data ?? []) as FeedEnquiry[], blockedDates, {
    siteUrl: deps.siteUrl,
    today: sofiaToday(now),
  });
  const body = renderIcs(events, { calName: FEED_CAL_NAME, now });
  return new Response(req.method === "HEAD" ? null : body, { status: 200, headers: FEED_HEADERS });
}
