// Seasonal venue pricing (recurring every year, Europe/Sofia calendar dates).
// This module is the AUTHORITATIVE copy of both the per-event venue base
// prices and the seasonal calendar; website/js/seasonal-pricing.js mirrors
// the seasonal rule for wizard display (its base fallback is the live event
// object, so only the seasonal table is mirrored - keep the two in sync,
// see the CLAUDE.md sync map). submit-enquiry stamps the result into
// enquiries.venue_price_eur; the edit functions re-stamp on date changes.
// Precedence note: percent discounts (weekday promo / codes) apply to the
// EFFECTIVE price this module returns.

export const VENUE_BASE_EUR: Record<string, number> = {
  evening: 1350,
  corp4: 330,
  corp8: 440,
  bday_day: 700,
  bday_eve: 970,
  wedding: 1500,
};

export const SEASONAL_PRICING = {
  nyePrice: 4200,      // Dec 31, any year, any event type
  weekdayPrice: 1670,  // Sun-Thu inside a season
  weekendPrice: 1780,  // Fri and Sat inside a season
  // Inclusive MM-DD ranges, recur annually. Dec 31 is deliberately outside
  // the winter range - it has its own flat price above.
  seasons: [
    { from: "12-01", to: "12-30" },
    { from: "05-19", to: "06-10" },
  ],
};

// dateStr is the wizard's DD/MM/YYYY. Returns the seasonal price for that
// calendar date, or null when the date is outside every special period.
export function seasonalVenuePrice(dateStr: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr ?? "");
  if (!m) return null;
  const mmdd = `${m[2]}-${m[1]}`;
  if (mmdd === "12-31") return SEASONAL_PRICING.nyePrice;
  const inSeason = SEASONAL_PRICING.seasons.some(s => mmdd >= s.from && mmdd <= s.to);
  if (!inSeason) return null;
  // Day-of-week of the calendar date itself; noon-UTC avoids TZ skew
  // (same technique as weekday-promo.ts). 5=Fri, 6=Sat.
  const day = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00Z`).getUTCDay();
  return day === 5 || day === 6 ? SEASONAL_PRICING.weekendPrice : SEASONAL_PRICING.weekdayPrice;
}

// The venue price a booking on dateStr actually costs for this event type.
export function effectiveVenuePrice(
  eventId: string | null | undefined,
  dateStr: string | null | undefined,
): number {
  return seasonalVenuePrice(dateStr ?? "") ?? (eventId ? VENUE_BASE_EUR[eventId] ?? 0 : 0);
}
