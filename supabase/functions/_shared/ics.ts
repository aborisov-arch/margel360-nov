// RFC 5545 (iCalendar) rendering for the calendar feed. Pure text building:
// escaping, 75-octet line folding that never splits a UTF-8 character
// (Cyrillic is 2 bytes per character), CRLF line ends. Timed events are
// written as UTC instants (…Z), all-day events as DATE values with the
// exclusive next-day end, so no VTIMEZONE block is needed.
import type { CalendarEvent } from "./calendar-event.ts";

const MAX_LINE_OCTETS = 75;
const PRODID = "-//Margel 360//calendar-feed//BG";
const CALENDAR_TZ = "Europe/Sofia";
// Hint for clients that honour it (Google uses its own schedule).
const REFRESH_HINT = "PT4H";
const encoder = new TextEncoder();

export function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// Fold one logical line into physical lines of at most 75 octets; each
// continuation starts with a single space (which counts towards the 75).
export function foldIcsLine(line: string): string {
  const physical: string[] = [];
  let current = "";
  let octets = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (octets + size > MAX_LINE_OCTETS) {
      physical.push(current);
      current = " " + ch;
      octets = 1 + size;
    } else {
      current += ch;
      octets += size;
    }
  }
  physical.push(current);
  return physical.join("\r\n");
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function icsDateTimeUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

export function icsDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function prop(name: string, value: string): string {
  return foldIcsLine(`${name}:${value}`);
}

export function renderIcs(events: CalendarEvent[], opts: { calName: string; now: Date }): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    prop("X-WR-CALNAME", icsEscape(opts.calName)),
    `X-WR-TIMEZONE:${CALENDAR_TZ}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_HINT}`,
    `X-PUBLISHED-TTL:${REFRESH_HINT}`,
  ];
  const stamp = icsDateTimeUtc(opts.now);

  for (const ev of events) {
    lines.push("BEGIN:VEVENT", prop("UID", ev.uid), `DTSTAMP:${stamp}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(ev.start)}`, `DTEND;VALUE=DATE:${icsDate(ev.end)}`);
    } else {
      lines.push(`DTSTART:${icsDateTimeUtc(ev.start)}`, `DTEND:${icsDateTimeUtc(ev.end)}`);
    }
    lines.push(prop("SUMMARY", icsEscape(ev.summary)));
    if (ev.description) lines.push(prop("DESCRIPTION", icsEscape(ev.description)));
    if (ev.location) lines.push(prop("LOCATION", icsEscape(ev.location)));
    if (ev.url) lines.push(prop("URL", ev.url));
    lines.push("STATUS:CONFIRMED", "TRANSP:OPAQUE", `LAST-MODIFIED:${icsDateTimeUtc(ev.lastModified)}`);
    if (ev.categories.length) lines.push(prop("CATEGORIES", ev.categories.map(icsEscape).join(",")));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
