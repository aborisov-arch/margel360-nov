// Weekday promo (TEMPORARY campaign, ends 2026-08-31): 20% off the VENUE
// BASE for events on Monday-Thursday with an event date up to and including
// 2026-08-31 (Europe/Sofia). This module is the AUTHORITATIVE copy;
// website/js/reservation.js mirrors it for the summary display - keep both
// in sync (CLAUDE.md sync map). Rule vs discount codes: the HIGHER percent
// wins, and when the weekday promo wins the customer's code is NOT claimed.
// Teardown after 31 Aug: this module self-disables by date; remove it and
// its call sites together with the promo bar and promo.html.

export const WEEKDAY_PROMO = { percent: 20, lastDate: "2026-08-31", days: [1, 2, 3, 4] };

// dateStr is the wizard's DD/MM/YYYY. Returns the promo percent (0 or 20).
export function weekdayPromoPercent(dateStr: string): number {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr ?? "");
  if (!m) return 0;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const todayISO = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
  if (iso < todayISO || iso > WEEKDAY_PROMO.lastDate) return 0;
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 1=Mon .. 4=Thu
  return WEEKDAY_PROMO.days.includes(day) ? WEEKDAY_PROMO.percent : 0;
}
