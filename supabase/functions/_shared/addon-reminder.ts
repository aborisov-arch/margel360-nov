// Add-on reminder drip: pure eligibility + catalog helpers for the
// send-event-reminders edge function. Every 3 days after a booking is
// confirmed the customer is reminded which add-on services they have not
// picked yet (see docs/superpowers/specs/2026-08-29-addon-reminder-drip-design.md).
//
// Everything here is side-effect free and takes `today` as an argument so it
// can be unit-tested with deno test.

import { localizedItemName } from "./item-names.ts";
import { addonPriceEur } from "./enquiry-email.ts";

export const ADDON_DRIP = {
  intervalDays: 3,       // one reminder every N Sofia calendar days
  maxSends: 5,           // hard cap per booking (a 6-months-ahead wedding must not get 60 emails)
  minDaysBeforeEvent: 2, // T-1 belongs to the day-before email, T-0 is the event
} as const;

export type DripConfig = { intervalDays: number; maxSends: number; minDaysBeforeEvent: number };

export type DripEnquiry = {
  pipeline_status: string | null;
  email: string | null;
  preferred_date: string | null;          // "DD/MM/YYYY" (flatpickr d/m/Y)
  created_at: string;                     // ISO
  addons_reminder_count: number | null;
  addons_reminder_last_sent_at: string | null;
};

export type ReminderAddon = {
  id: string;
  name_bg: string;
  name_en: string;
  price_eur: number;
  hint_bg: string | null;
  hint_en: string | null;
  free_until: number | null;
  max_qty: number | null;
  active: boolean;
  sort_order: number;
};

export type BookingAddon = { id: string; name?: string | null; price: number; qty?: number };
export type BookingLine = { name: string; price: number; qty?: number };

export type DripReason = "due" | "not_confirmed" | "no_email" | "bad_date" | "quiet_zone" | "cap_reached" | "too_soon";
export type DripDecision = { send: boolean; reason: DripReason; reminderNo?: number; daysToEvent?: number };

const DAY_MS = 86_400_000;

// A Sofia calendar day is represented as midnight at a fixed +02:00 offset —
// the same convention the edge functions already use for preferred_date. Only
// differences between such values are used, and Math.round absorbs the DST
// hour, so day arithmetic never drifts.
export function parsePreferredDate(s: string | null | undefined): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s ?? "");
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(`${y}-${mo}-${d}T00:00:00+02:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function sofiaDay(at: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00+02:00`);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

export function addonDripDecision(e: DripEnquiry, today: Date, cfg: DripConfig = ADDON_DRIP): DripDecision {
  if ((e.pipeline_status ?? "") !== "confirmed") return { send: false, reason: "not_confirmed" };
  if (!(e.email ?? "").trim()) return { send: false, reason: "no_email" };
  const event = parsePreferredDate(e.preferred_date);
  if (!event) return { send: false, reason: "bad_date" };
  const daysToEvent = daysBetween(event, today);
  if (daysToEvent < cfg.minDaysBeforeEvent) return { send: false, reason: "quiet_zone" };
  const count = e.addons_reminder_count ?? 0;
  if (count >= cfg.maxSends) return { send: false, reason: "cap_reached" };
  const anchorIso = count === 0 ? e.created_at : (e.addons_reminder_last_sent_at ?? e.created_at);
  const anchor = sofiaDay(new Date(anchorIso));
  if (daysBetween(today, anchor) < cfg.intervalDays) return { send: false, reason: "too_soon" };
  return { send: true, reason: "due", reminderNo: count + 1, daysToEvent };
}

// Active catalog add-ons the booking does not contain. `cleaning` is auto-added
// to every booking (and DB-protected), so it is never "missing".
export function missingAddons(booking: { id: string }[], catalog: ReminderAddon[]): ReminderAddon[] {
  const chosen = new Set(booking.map(a => a.id));
  return catalog
    .filter(a => a.active && a.id !== "cleaning" && !chosen.has(a.id))
    .sort((a, b) => (a.sort_order - b.sort_order) || a.name_en.localeCompare(b.name_en));
}

export function catalogName(a: ReminderAddon, lang: "bg" | "en"): string {
  return lang === "bg" ? a.name_bg : a.name_en;
}

// The booking's own add-ons as display lines: localized catalog name (falling
// back to the shared item-name table / stored name for retired items) and the
// stored LINE price (legacy pre-2026-05 BGN rows converted via addonPriceEur).
export function bookingAddonLines(addons: BookingAddon[], catalog: ReminderAddon[], lang: "bg" | "en"): BookingLine[] {
  const byId = new Map(catalog.map(a => [a.id, a]));
  return addons.map(item => {
    const c = byId.get(item.id);
    return {
      name: c ? catalogName(c, lang) : localizedItemName(item, lang),
      price: addonPriceEur(item.id, Number(item.price) || 0),
      qty: typeof item.qty === "number" ? item.qty : undefined,
    };
  });
}

// Preview emails carry a customer's live edit link, so they may only go to the
// venue's own mailboxes (the admin allowlist domain). Fail closed.
export function isInternalRecipient(to: string): boolean {
  return /^[^\s@]+@margel\.info$/i.test((to ?? "").trim());
}

// The edit link must work for the whole drip, so the token lives until the end
// of the event day. Never shortens an expiry that is already later.
export function tokenExpiryFor(currentIso: string | null, event: Date): string {
  const endOfEventDay = new Date(event.getTime() + DAY_MS);
  const current = currentIso ? new Date(currentIso) : null;
  const keep = current && !Number.isNaN(current.getTime()) && current.getTime() > endOfEventDay.getTime();
  return (keep ? current! : endOfEventDay).toISOString();
}
