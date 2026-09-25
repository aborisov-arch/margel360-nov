// Bulgarian display labels for values stored in English (team emails are
// Bulgarian). Stored enquiry fields stay as they are: event_type is the
// English catalog title, addons/drinks[].name the English item name,
// payment_method / time_of_day enums. The admin panel mirrors these maps in
// website/admin/js/labels-bg.js — keep both in sync.
import { localizedItemName } from "./item-names.ts";

const EVENT_TYPE_BG: Record<string, string> = {
  evening:   "Вечерно събитие",
  corporate: "Корпоративно събитие",
  corp4:     "Корпоративно събитие — 4 часа",
  corp8:     "Корпоративно събитие — 8 часа",
  birthday:  "Детски рожден ден",
  bday_day:  "Детски рожден ден — дневно",
  bday_eve:  "Детски рожден ден — вечерно",
  wedding:   "Сватба",
};

// Rows without event_id: recognise the English title instead.
const EVENT_TITLE_PATTERNS: [RegExp, string][] = [
  [/^corporate.*\b8\b/i, "corp8"], [/^corporate.*\b4\b/i, "corp4"], [/^corporate/i, "corporate"],
  [/^children.*day/i, "bday_day"], [/^children.*even/i, "bday_eve"], [/^children/i, "birthday"],
  [/^evening/i, "evening"], [/^wedding/i, "wedding"],
];

export function eventTypeBg(e: { event_id?: string | null; event_type?: string | null }): string {
  if (e?.event_id && EVENT_TYPE_BG[e.event_id]) return EVENT_TYPE_BG[e.event_id];
  const raw = String(e?.event_type ?? "").trim();
  const hit = EVENT_TITLE_PATTERNS.find(([re]) => re.test(raw));
  return hit ? EVENT_TYPE_BG[hit[1]] : raw;
}

export const PAYMENT_BG: Record<string, string> = { cash: "В брой", transfer: "Банков превод", card: "Карта" };
export function paymentBg(v: string | null | undefined): string { return PAYMENT_BG[v ?? ""] ?? String(v ?? "—"); }

export function itemNameBg(item: { id?: string | null; name?: string | null }): string {
  return localizedItemName(item, "bg");
}

export function timeOfDayBg(e: { arrival_time?: string | null; time_of_day?: string | null }): string {
  if (e.arrival_time) return `Вечер · пристигане ${e.arrival_time}`;
  return e.time_of_day === "day" ? "Дневно (до 17:30)" : "Вечер (след 19:00)";
}

export const PIPELINE_BG: Record<string, string> = {
  new: "Нови", contacted: "Свързани", quoted: "Оферирани",
  confirmed: "Потвърдени", completed: "Приключени", lost: "Загубени", archived: "Архив",
};
export function pipelineBg(v: string | null | undefined): string { return PIPELINE_BG[v ?? ""] ?? String(v ?? ""); }
