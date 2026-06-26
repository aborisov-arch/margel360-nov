// Lightweight server-side validators for customer-editable fields. Used by
// update-enquiry-by-token to reject obviously-malformed or abusive payloads
// before they hit the database.

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const MAX_NOTES = 2000;
const MAX_PHONE = 30;
const MAX_GUESTS = 200;
const MAX_ADDON_PRICE = 50000;
// Per-category drink quantity caps: non-alcoholic (soft drinks + water,
// drinks-data.js cat 3 & 4) up to 200; everything alcoholic up to 100.
// Keep NON_ALCOHOLIC_DRINK_IDS in sync with website/js/drinks-data.js.
const NON_ALCOHOLIC_DRINK_IDS = new Set([
  "granini_a", "granini_o", "tonic_mango", "tonic_cherry", "sanben_tea_lem5", "sanben_tea_lem3", "sanben_tea_peach", "cola", "cola0", "fanta", "redbull",
  "benedo_spa", "perrier_st", "perrier_spa", "panna25", "panna50", "panna75", "pelegrino75", "pelegrino",
]);
function maxDrinkQty(id: string): number { return NON_ALCOHOLIC_DRINK_IDS.has(id) ? 200 : 100; }
const MAX_NAME_LEN = 200;

export type ValidationResult = { ok: true; value: unknown } | { ok: false; error: string };

export function validateField(field: string, raw: unknown): ValidationResult {
  switch (field) {
    case "guests":
      if (!Number.isInteger(raw) || (raw as number) < 1 || (raw as number) > MAX_GUESTS) {
        return { ok: false, error: `guests must be an integer 1..${MAX_GUESTS}` };
      }
      return { ok: true, value: raw };

    case "phone":
      if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_PHONE) {
        return { ok: false, error: `phone must be a non-empty string <= ${MAX_PHONE} chars` };
      }
      return { ok: true, value: raw };

    case "notes":
      if (raw === null) return { ok: true, value: null };
      if (typeof raw !== "string" || raw.length > MAX_NOTES) {
        return { ok: false, error: `notes must be a string <= ${MAX_NOTES} chars or null` };
      }
      return { ok: true, value: raw };

    case "preferred_date":
      if (typeof raw !== "string" || !DATE_RE.test(raw)) {
        return { ok: false, error: "preferred_date must be DD/MM/YYYY" };
      }
      return { ok: true, value: raw };

    case "addons":
      if (!Array.isArray(raw)) return { ok: false, error: "addons must be an array" };
      for (const a of raw) {
        if (!a || typeof a !== "object") return { ok: false, error: "addon must be an object" };
        const o = a as Record<string, unknown>;
        if (typeof o.id !== "string" || o.id.length === 0 || o.id.length > 50) {
          return { ok: false, error: "addon.id must be a string 1..50 chars" };
        }
        if (typeof o.name !== "string" || o.name.length > MAX_NAME_LEN) {
          return { ok: false, error: `addon.name must be a string <= ${MAX_NAME_LEN} chars` };
        }
        if (typeof o.price !== "number" || !Number.isFinite(o.price) || o.price < 0 || o.price > MAX_ADDON_PRICE) {
          return { ok: false, error: `addon.price must be a finite number 0..${MAX_ADDON_PRICE}` };
        }
        if (o.qty !== undefined && o.qty !== null) {
          if (!Number.isInteger(o.qty) || (o.qty as number) < 0 || (o.qty as number) > 999) {
            return { ok: false, error: "addon.qty must be an integer 0..999 (or omitted)" };
          }
        }
      }
      return { ok: true, value: raw };

    case "drinks":
      if (!Array.isArray(raw)) return { ok: false, error: "drinks must be an array" };
      for (const d of raw) {
        if (!d || typeof d !== "object") return { ok: false, error: "drink must be an object" };
        const o = d as Record<string, unknown>;
        if (typeof o.id !== "string" || o.id.length === 0 || o.id.length > 50) {
          return { ok: false, error: "drink.id must be a string 1..50 chars" };
        }
        if (typeof o.name !== "string" || o.name.length > MAX_NAME_LEN) {
          return { ok: false, error: `drink.name must be a string <= ${MAX_NAME_LEN} chars` };
        }
        const dqMax = maxDrinkQty(o.id as string);
        if (!Number.isInteger(o.qty) || (o.qty as number) < 0 || (o.qty as number) > dqMax) {
          return { ok: false, error: `drink.qty must be an integer 0..${dqMax}` };
        }
        if (o.price_eur !== null && o.price_eur !== undefined) {
          if (typeof o.price_eur !== "number" || !Number.isFinite(o.price_eur) || o.price_eur < 0) {
            return { ok: false, error: "drink.price_eur must be a finite non-negative number or null" };
          }
        }
      }
      return { ok: true, value: raw };

    default:
      return { ok: false, error: `unknown field: ${field}` };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}
