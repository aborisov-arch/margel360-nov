// Missing finance data, the same checks as the admin Financials page
// (website/admin/js/financials-analysis.js financeGaps + drink-costs.js
// bottleGapText). Pure functions so send-finance-reminder stays testable.

export type DrinkLine = { qty?: number | string | null; unit_cost_eur?: number | string | null };
export type FinEvent = {
  id: string; month: string | null; event_date: string | null; customer_name: string | null;
  enquiry_id: string | null; drinks_cost_in_expenses: boolean | null;
  income_drinks_eur: number | string | null; pnl_drinks: DrinkLine[] | null;
};
export type Gap = { month: string; text: string };
export type BookedAddon = { id?: string; qty?: number | string | null; category?: string | null };

// Посуда on a booking whose purchase price per piece is not set (admin
// catalog → Посуда). Same rule as glassware-costs.js on the finance page.
export function glasswareGap(addons: BookedAddon[] | null, glasswareIds: Set<string>, costs: Map<string, number>): string | null {
  const missing = new Set((addons ?? [])
    .filter(a => a.id && (Number(a.qty) || 0) > 0 && (a.category === "glassware" || glasswareIds.has(a.id)))
    .filter(a => !costs.has(a.id!))
    .map(a => a.id!));
  const n = missing.size;
  return n ? `Посуда: липсва покупна цена за ${n} ${n === 1 ? "вид" : "вида"} (Каталог → Посуда)` : null;
}

export function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

function missingCosts(lines: DrinkLine[]): number {
  return lines.filter(l => {
    if (!(Number(l.qty) || 0)) return false;
    const u = l.unit_cost_eur;
    return u == null || u === "" || !Number.isFinite(Number(u)) || Number(u) < 0;
  }).length;
}

// Text for an event whose bottle cost is incomplete, or null when complete.
export function bottleGap(fe: FinEvent, enquiryDrinks: DrinkLine[] | null, hasDrinksExpense: boolean): string | null {
  if (fe.drinks_cost_in_expenses) return hasDrinksExpense ? null : "няма въведен разход „Напитки / алкохол“";
  // Unsaved P&L drinks are seeded from the order without purchase costs.
  const lines = fe.pnl_drinks ?? (enquiryDrinks ?? []).map(d => ({ qty: d.qty, unit_cost_eur: null }));
  if (!lines.length) return Number(fe.income_drinks_eur || 0) !== 0 ? "липсва разбивка на продадените напитки" : null;
  const n = missingCosts(lines);
  return n ? `липсва покупна цена за ${n} ${n === 1 ? "напитка" : "напитки"}` : null;
}

export function fmtDateBg(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}

// All gaps from the first month with a held event through `nowMonth`.
export function financeGaps(opts: {
  events: FinEvent[]; today: string; nowMonth: string; electricityMonths: Set<string>;
  enquiryDrinks: Map<string, DrinkLine[]>; eventsWithDrinksExpense: Set<string>; names: Map<string, string>;
  enquiryAddons?: Map<string, BookedAddon[]>; glasswareIds?: Set<string>; glasswareCosts?: Map<string, number>;
}): Gap[] {
  const { events, today, nowMonth, electricityMonths } = opts;
  const held = events.filter(fe => !fe.event_date || fe.event_date < today);
  const months = held.map(fe => fe.month).filter((m): m is string => !!m && m <= nowMonth).sort();
  const gaps: Gap[] = [];
  if (months.length) {
    for (let m = months[0]; m <= nowMonth; m = nextMonth(m)) {
      if (!electricityMonths.has(m)) gaps.push({ month: m, text: "Ток: няма въведена месечна сметка" });
    }
  }
  held
    .slice().sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""))
    .forEach(fe => {
      const g = bottleGap(fe, fe.enquiry_id ? opts.enquiryDrinks.get(fe.enquiry_id) ?? null : null, opts.eventsWithDrinksExpense.has(fe.id));
      const label = `${fmtDateBg(fe.event_date)} · ${fe.customer_name || (fe.enquiry_id && opts.names.get(fe.enquiry_id)) || "Събитие"}`;
      if (g && fe.month) gaps.push({ month: fe.month, text: `${label}: ${g}` });
      const gg = fe.enquiry_id
        ? glasswareGap(opts.enquiryAddons?.get(fe.enquiry_id) ?? null, opts.glasswareIds ?? new Set(), opts.glasswareCosts ?? new Map())
        : null;
      if (gg && fe.month) gaps.push({ month: fe.month, text: `${label}: ${gg}` });
    });
  return gaps;
}
