// Booking -> calendar event mapping for the Google Calendar (iCal) feed served
// by the calendar-feed Edge Function. Pure: no I/O. The CalendarEvent shape is
// storage-neutral so a future push integration (Google Calendar API) can reuse
// it. Bookings store Europe/Sofia wall-clock times; everything here is turned
// into UTC instants. Bulgarian labels come from labels-bg.ts.
// Design: docs/superpowers/specs/2026-10-26-google-calendar-feed-design.md
import { eventTypeBg, timeOfDayBg } from "./labels-bg.ts";

export interface FeedEnquiry {
  id: string;
  enquiry_number: number | null;
  full_name: string | null;
  phone: string | null;
  event_id: string | null;
  event_type: string | null;
  preferred_date: string | null;
  time_of_day: string | null;
  arrival_time: string | null;
  guests: number | null;
  notes: string | null;
  pipeline_status: string | null;
  created_at: string | null;
  last_edited_at: string | null;
}

export interface CalendarEvent {
  uid: string;
  summary: string;
  description: string;
  // All-day events carry start/end as UTC midnights of the calendar date,
  // end exclusive (the next day) - the iCalendar DATE convention.
  allDay: boolean;
  start: Date;
  end: Date;
  location: string;
  url: string | null;
  lastModified: Date;
  categories: string[];
}

export type Ymd = { y: number; m: number; d: number };

const TZ = "Europe/Sofia";
const UID_DOMAIN = "margel360.bg";
const NOTES_MAX_CHARS = 500;
const DEFAULT_PAST_DAYS = 365;
const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

export const FEED_LOCATION = "Маргел 360°, бул. Околовръстен път 155, София";

// Per event_id. `hours` = duration from the booking's own arrival_time
// (evening events); start/end = the catalog's fixed window ("24:00" means
// midnight, next day); `window` = the description line that stops the window
// being read as the exact event time. Mirrors duration_bg in
// website/js/reservation-catalog.js - see the CLAUDE.md sync map.
export const EVENT_SCHEDULE: Record<string, { start?: string; end?: string; hours?: number; window?: string }> = {
  evening:  { hours: 5 },
  bday_eve: { start: "16:00", end: "24:00", window: "16:00–24:00 (5 часа)" },
  bday_day: { start: "12:30", end: "17:30", window: "до 17:30 (5 часа)" },
  corp4:    { start: "08:00", end: "17:30", window: "08:00–17:30 (4 часа)" },
  corp8:    { start: "08:00", end: "17:30", window: "08:00–17:30 (8 часа)" },
};

// Feminine: "заявка".
const STATUS_BG: Record<string, string> = { confirmed: "Потвърдена", completed: "Приключена" };

export function parsePreferredDate(s: string | null | undefined): Ymd | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s ?? "");
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

function sofiaParts(at: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const out: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out;
}

// Minutes east of UTC that Sofia observes at the given instant.
function sofiaOffsetMinutes(at: Date): number {
  const p = sofiaParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - at.getTime()) / MS_PER_MINUTE);
}

// Sofia wall-clock -> UTC instant. Two passes so the offset used is the one
// in force at the resulting instant (correct on both DST transition days).
export function sofiaToUtc(y: number, m: number, d: number, hh: number, mm: number): Date {
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const firstGuess = wall - sofiaOffsetMinutes(new Date(wall)) * MS_PER_MINUTE;
  return new Date(wall - sofiaOffsetMinutes(new Date(firstGuess)) * MS_PER_MINUTE);
}

export function sofiaToday(now: Date): Ymd {
  const p = sofiaParts(now);
  return { y: p.year, m: p.month, d: p.day };
}

function parseHm(s: string | null | undefined): { hh: number; mm: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (hh > 24 || mm > 59) return null;
  return { hh, mm };
}

function timedRange(ymd: Ymd, eventId: string | null, arrival: string | null): { start: Date; end: Date } | null {
  const sched = EVENT_SCHEDULE[eventId ?? ""];
  if (!sched) return null;
  if (sched.hours != null) {
    const t = parseHm(arrival);
    if (!t) return null;
    const start = sofiaToUtc(ymd.y, ymd.m, ymd.d, t.hh, t.mm);
    return { start, end: new Date(start.getTime() + sched.hours * MS_PER_HOUR) };
  }
  const s = parseHm(sched.start), e = parseHm(sched.end);
  if (!s || !e) return null;
  return { start: sofiaToUtc(ymd.y, ymd.m, ymd.d, s.hh, s.mm), end: sofiaToUtc(ymd.y, ymd.m, ymd.d, e.hh, e.mm) };
}

function allDayRange(ymd: Ymd): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)), end: new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + 1)) };
}

function cleanText(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function truncateChars(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join("") + "…";
}

function safeDate(iso: string | null | undefined, fallback: string | null | undefined): Date {
  const d = new Date(iso || fallback || 0);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export function bookingToEvent(e: FeedEnquiry, opts: { siteUrl: string }): CalendarEvent | null {
  const ymd = parsePreferredDate(e.preferred_date);
  if (!ymd) return null;

  const typeBg = eventTypeBg(e);
  const name = cleanText(e.full_name) || "без име";
  const url = `${opts.siteUrl}/admin/dashboard.html#enquiry-${e.id}`;
  const timed = timedRange(ymd, e.event_id, e.arrival_time);
  const range = timed ?? allDayRange(ymd);
  const window = EVENT_SCHEDULE[e.event_id ?? ""]?.window;
  const phone = cleanText(e.phone);
  const notes = cleanText(e.notes);

  const lines = [
    e.enquiry_number != null ? `Заявка № ${e.enquiry_number}` : null,
    e.guests != null ? `Гости: ${e.guests}` : null,
    `Време: ${timeOfDayBg(e)}`,
    window ? `Прозорец: ${window}` : null,
    phone ? `Телефон: ${phone}` : null,
    notes ? `Бележки: ${truncateChars(notes, NOTES_MAX_CHARS)}` : null,
    `Статус: ${STATUS_BG[e.pipeline_status ?? ""] ?? cleanText(e.pipeline_status)}`,
    `Запитване: ${url}`,
  ].filter((l): l is string => l !== null);

  return {
    uid: `enq-${e.id}@${UID_DOMAIN}`,
    summary: `${typeBg} — ${name}`,
    description: lines.join("\n"),
    allDay: timed === null,
    start: range.start,
    end: range.end,
    location: FEED_LOCATION,
    url,
    lastModified: safeDate(e.last_edited_at, e.created_at),
    categories: [typeBg],
  };
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// occupied_dates row without a booking: an all-day "Заето (ръчно)".
export function blockToEvent(isoDate: string): CalendarEvent {
  const m = ISO_DATE_RE.exec(isoDate);
  const ymd: Ymd = m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : { y: 1970, m: 1, d: 1 };
  const range = allDayRange(ymd);
  return {
    uid: `block-${isoDate}@${UID_DOMAIN}`,
    summary: "Заето (ръчно)",
    description: "Датата е маркирана като заета ръчно в админ календара.",
    allDay: true,
    start: range.start,
    end: range.end,
    location: FEED_LOCATION,
    url: null,
    lastModified: range.start,
    categories: ["Заето"],
  };
}

// Bookings from `pastDays` back (default 365) onwards, plus manual blocks on
// dates no booking already covers. Rows with an unparsable date are skipped.
export function buildFeedEvents(
  enquiries: FeedEnquiry[],
  blockedDates: string[],
  opts: { siteUrl: string; today: Ymd; pastDays?: number },
): CalendarEvent[] {
  const cutoff = Date.UTC(opts.today.y, opts.today.m - 1, opts.today.d - (opts.pastDays ?? DEFAULT_PAST_DAYS));
  const events: CalendarEvent[] = [];
  const covered = new Set<string>();

  for (const e of enquiries) {
    const ymd = parsePreferredDate(e.preferred_date);
    if (!ymd || Date.UTC(ymd.y, ymd.m - 1, ymd.d) < cutoff) continue;
    const ev = bookingToEvent(e, opts);
    if (!ev) continue;
    events.push(ev);
    covered.add(`${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`);
  }

  for (const iso of blockedDates) {
    const m = ISO_DATE_RE.exec(iso);
    if (!m || covered.has(iso)) continue;
    if (Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) < cutoff) continue;
    events.push(blockToEvent(iso));
  }

  return events;
}
