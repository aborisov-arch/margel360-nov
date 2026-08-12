// Seasonal venue pricing - display mirror of the AUTHORITATIVE server module
// supabase/functions/_shared/seasonal-pricing.ts (keep the numbers and date
// ranges in sync - CLAUDE.md sync map). The wizard uses this to show the
// price the server will stamp; the server recomputes on submit either way.
// Base-price fallback is the live event object (eventTypes), so only the
// seasonal table is mirrored here.
(function () {
  const SEASONAL_PRICING = {
    nyePrice: 4200,      // Dec 31, any year, any event type
    weekdayPrice: 1670,  // Sun-Thu inside a season
    weekendPrice: 1780,  // Fri and Sat inside a season
    seasons: [
      { from: '12-01', to: '12-30' },
      { from: '05-19', to: '06-10' },
    ],
  };

  function seasonalVenuePrice(dateStr) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr || '');
    if (!m) return null;
    const mmdd = m[2] + '-' + m[1];
    if (mmdd === '12-31') return SEASONAL_PRICING.nyePrice;
    if (!SEASONAL_PRICING.seasons.some(s => mmdd >= s.from && mmdd <= s.to)) return null;
    const day = new Date(m[3] + '-' + m[2] + '-' + m[1] + 'T12:00:00Z').getUTCDay();
    return day === 5 || day === 6 ? SEASONAL_PRICING.weekendPrice : SEASONAL_PRICING.weekdayPrice;
  }

  window.SEASONAL_PRICING = SEASONAL_PRICING;
  window.seasonalVenuePrice = seasonalVenuePrice;
})();
