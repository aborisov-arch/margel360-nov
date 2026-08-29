import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  ADDON_DRIP, addonDripDecision, bookingAddonLines, daysBetween, missingAddons,
  isInternalRecipient, parsePreferredDate, sofiaDay, tokenExpiryFor, type DripEnquiry, type ReminderAddon,
} from "./addon-reminder.ts";
import { renderAddonReminder } from "./addon-reminder-email.ts";

// today = 2026-08-29 (Sofia). Event dates are DD/MM/YYYY like enquiries.preferred_date.
const TODAY = sofiaDay(new Date("2026-08-29T07:00:00Z"));

function enquiry(over: Partial<DripEnquiry> = {}): DripEnquiry {
  return {
    pipeline_status: "confirmed",
    email: "guest@example.com",
    preferred_date: "15/09/2026",
    created_at: "2026-08-26T09:30:00Z", // 3 Sofia calendar days before TODAY (< 72h)
    addons_reminder_count: 0,
    addons_reminder_last_sent_at: null,
    ...over,
  };
}

function catalog(): ReminderAddon[] {
  return [
    { id: "cleaning", name_bg: "Почистване", name_en: "Cleaning", price_eur: 70, hint_bg: null, hint_en: null, free_until: null, max_qty: null, active: true, sort_order: 999 },
    { id: "photo2", name_bg: "Фотограф 2 ч.", name_en: "Photographer 2h", price_eur: 170, hint_bg: "Професионален фотограф", hint_en: "Professional photographer", free_until: null, max_qty: null, active: true, sort_order: 20 },
    { id: "dj", name_bg: "DJ за 5 часа", name_en: "DJ for 5 hours", price_eur: 300, hint_bg: null, hint_en: null, free_until: null, max_qty: null, active: true, sort_order: 10 },
    { id: "bar_stool", name_bg: "Бар стол", name_en: "Bar stool", price_eur: 5, hint_bg: null, hint_en: null, free_until: 40, max_qty: null, active: true, sort_order: 30 },
    { id: "old", name_bg: "Старо", name_en: "Old", price_eur: 1, hint_bg: null, hint_en: null, free_until: null, max_qty: null, active: false, sort_order: 1 },
  ];
}

// ---- date helpers -----------------------------------------------------------

Deno.test("parsePreferredDate: DD/MM/YYYY parses, anything else is null", () => {
  assertEquals(parsePreferredDate("15/09/2026")?.toISOString(), "2026-09-14T22:00:00.000Z");
  assertEquals(parsePreferredDate("2026-09-15"), null);
  assertEquals(parsePreferredDate(""), null);
});

Deno.test("daysBetween counts Sofia calendar days", () => {
  assertEquals(daysBetween(parsePreferredDate("15/09/2026")!, TODAY), 17);
  assertEquals(daysBetween(TODAY, sofiaDay(new Date("2026-08-26T09:30:00Z"))), 3);
});

// ---- eligibility ------------------------------------------------------------

Deno.test("drip: first reminder goes out 3 calendar days after booking", () => {
  const d = addonDripDecision(enquiry(), TODAY);
  assertEquals(d.send, true);
  assertEquals(d.reminderNo, 1);
  assertEquals(d.daysToEvent, 17);
});

Deno.test("drip: not before 3 days since booking", () => {
  const d = addonDripDecision(enquiry({ created_at: "2026-08-27T08:00:00Z" }), TODAY);
  assertEquals(d.send, false);
  assertEquals(d.reason, "too_soon");
});

Deno.test("drip: only confirmed bookings", () => {
  assertEquals(addonDripDecision(enquiry({ pipeline_status: "quoted" }), TODAY).reason, "not_confirmed");
  assertEquals(addonDripDecision(enquiry({ pipeline_status: "completed" }), TODAY).reason, "not_confirmed");
});

Deno.test("drip: needs an email address", () => {
  assertEquals(addonDripDecision(enquiry({ email: null }), TODAY).reason, "no_email");
  assertEquals(addonDripDecision(enquiry({ email: "  " }), TODAY).reason, "no_email");
});

Deno.test("drip: follow-ups every 3 days after the last one", () => {
  const twoDaysAgo = addonDripDecision(enquiry({ addons_reminder_count: 1, addons_reminder_last_sent_at: "2026-08-27T07:05:00Z" }), TODAY);
  assertEquals(twoDaysAgo.send, false);
  assertEquals(twoDaysAgo.reason, "too_soon");
  const threeDaysAgo = addonDripDecision(enquiry({ addons_reminder_count: 1, addons_reminder_last_sent_at: "2026-08-26T07:05:00Z" }), TODAY);
  assertEquals(threeDaysAgo.send, true);
  assertEquals(threeDaysAgo.reminderNo, 2);
});

Deno.test("drip: stops at the cap", () => {
  const d = addonDripDecision(enquiry({ addons_reminder_count: ADDON_DRIP.maxSends, addons_reminder_last_sent_at: "2026-08-20T07:05:00Z" }), TODAY);
  assertEquals(d.send, false);
  assertEquals(d.reason, "cap_reached");
});

Deno.test("drip: quiet zone in the last 2 days before the event", () => {
  assertEquals(addonDripDecision(enquiry({ preferred_date: "30/08/2026" }), TODAY).reason, "quiet_zone"); // T-1
  assertEquals(addonDripDecision(enquiry({ preferred_date: "29/08/2026" }), TODAY).reason, "quiet_zone"); // T-0
  assertEquals(addonDripDecision(enquiry({ preferred_date: "31/08/2026" }), TODAY).send, true);          // T-2
});

Deno.test("drip: past events and malformed dates never send", () => {
  assertEquals(addonDripDecision(enquiry({ preferred_date: "01/08/2026" }), TODAY).reason, "quiet_zone");
  assertEquals(addonDripDecision(enquiry({ preferred_date: "soon" }), TODAY).reason, "bad_date");
});

// ---- catalog helpers --------------------------------------------------------

Deno.test("missingAddons: active catalog items not in the booking, minus cleaning, by sort_order", () => {
  const out = missingAddons([{ id: "dj" }, { id: "cleaning" }], catalog());
  assertEquals(out.map(a => a.id), ["photo2", "bar_stool"]);
});

Deno.test("missingAddons: empty booking lists everything except cleaning and inactive", () => {
  assertEquals(missingAddons([], catalog()).map(a => a.id), ["dj", "photo2", "bar_stool"]);
});

Deno.test("bookingAddonLines: localized catalog names with stored line prices", () => {
  const lines = bookingAddonLines(
    [{ id: "dj", name: "DJ for 5 hours", price: 300 }, { id: "bar_stool", name: "Bar stool", price: 25, qty: 45 }, { id: "gone", name: "Retired thing", price: 12 }],
    catalog(), "bg",
  );
  assertEquals(lines, [
    { name: "DJ за 5 часа", price: 300, qty: undefined },
    { name: "Бар стол", price: 25, qty: 45 },
    { name: "Retired thing", price: 12, qty: undefined },
  ]);
});

Deno.test("tokenExpiryFor: extends to the end of the event day, never shortens", () => {
  const event = parsePreferredDate("15/09/2026")!;
  assertEquals(tokenExpiryFor("2026-09-01T10:00:00Z", event), "2026-09-15T22:00:00.000Z");
  assertEquals(tokenExpiryFor(null, event), "2026-09-15T22:00:00.000Z");
  assertEquals(tokenExpiryFor("2026-12-01T10:00:00Z", event), "2026-12-01T10:00:00.000Z");
});

// ---- rendering --------------------------------------------------------------

function renderInput(over: Partial<Parameters<typeof renderAddonReminder>[0]> = {}) {
  return {
    firstName: "Мария",
    preferredDate: "15/09/2026",
    daysToEvent: 17,
    lang: "bg" as const,
    siteUrl: "https://margel360.bg",
    editToken: "abc-123",
    have: [{ name: "DJ за 5 часа", price: 300 }],
    drinkCount: 2,
    missing: missingAddons([{ id: "dj" }], catalog()),
    ...over,
  };
}

Deno.test("render (bg): subject, current items, missing items with prices, edit CTA", () => {
  const { subject, html } = renderAddonReminder(renderInput());
  assertEquals(subject, "Проверете резервацията си · Маргел 360° · 15.09.2026");
  assertStringIncludes(html, "Здравейте, Мария");
  assertStringIncludes(html, "DJ за 5 часа");
  assertStringIncludes(html, "€300.00");
  assertStringIncludes(html, "Фотограф 2 ч.");
  assertStringIncludes(html, "€170.00");
  assertStringIncludes(html, "Професионален фотограф");
  assertStringIncludes(html, "€5.00 / бр.");
  assertStringIncludes(html, "https://margel360.bg/edit.html?token=abc-123");
});

Deno.test("render (en): english copy and catalog names", () => {
  const { subject, html } = renderAddonReminder(renderInput({ lang: "en", firstName: "Maria", have: [{ name: "DJ for 5 hours", price: 300 }] }));
  assertEquals(subject, "Check your booking · Margel 360° · 15.09.2026");
  assertStringIncludes(html, "Hello, Maria");
  assertStringIncludes(html, "Photographer 2h");
  assertStringIncludes(html, "€5.00 / pc");
  assert(!html.includes("Здравейте"));
});

Deno.test("render: locked booking gets the reply-to line instead of the edit button", () => {
  const { html } = renderAddonReminder(renderInput({ editToken: null }));
  assert(!html.includes("edit.html"));
  assertStringIncludes(html, "360@margel.info");
});

Deno.test("render: customer-controlled strings are escaped", () => {
  const { html } = renderAddonReminder(renderInput({ firstName: "<b>x</b>", have: [{ name: "<i>evil</i>", price: 1 }] }));
  assert(!html.includes("<b>x</b>"));
  assert(!html.includes("<i>evil</i>"));
  assertStringIncludes(html, "&lt;b&gt;x&lt;/b&gt;");
});

Deno.test("render: no drinks and nothing missing degrade gracefully", () => {
  const { html } = renderAddonReminder(renderInput({ drinkCount: 0, missing: [] }));
  assertStringIncludes(html, "Няма добавени напитки");
  assert(!html.includes("Още не сте добавили"));
});

// ---- preview safety ---------------------------------------------------------

Deno.test("isInternalRecipient: only @margel.info mailboxes may receive previews (live edit links)", () => {
  assertEquals(isInternalRecipient("aborisov@margel.info"), true);
  assertEquals(isInternalRecipient("  Office@MARGEL.INFO "), true);
  assertEquals(isInternalRecipient("guest@example.com"), false);
  assertEquals(isInternalRecipient("x@margel.info.evil.com"), false);
  assertEquals(isInternalRecipient("margel.info"), false);
  assertEquals(isInternalRecipient(""), false);
});
