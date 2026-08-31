export const EDITABLE_FIELDS = ["guests", "phone", "notes", "addons", "drinks", "preferred_date"] as const;
export type EditableField = typeof EDITABLE_FIELDS[number];

export type DiffEntry = { field: EditableField; before: unknown; after: unknown };

// Lifetime cap on customer self-edits (update-enquiry-by-token increments
// edit_count on every effective save; at the cap the booking closes fully).
export const EDIT_COUNT_CAP = 10;

// When an admin confirms a booking it becomes edit_locked: the lock protects
// the DATE and the guest count (calendar + pricing are the team's business),
// while add-ons, drinks, phone and notes stay customer-editable so the add-on
// reminder drip can link to a working edit page.
export const LOCKED_FROZEN_FIELDS: readonly EditableField[] = ["preferred_date", "guests"];

// Fields of `patch` that would REALLY change a frozen field (sending the
// unchanged current value along, as the edit page always does, is fine).
export function lockedFieldChanges(
  patch: Record<string, unknown>,
  current: Record<string, unknown>,
): EditableField[] {
  const changed = new Set(diffEnquiry(current, { ...current, ...patch }).map(d => d.field));
  // Deterministic LOCKED_FROZEN_FIELDS order, independent of diff iteration.
  return LOCKED_FROZEN_FIELDS.filter(f => changed.has(f));
}

export function diffEnquiry(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DiffEntry[] {
  const out: DiffEntry[] = [];
  for (const f of EDITABLE_FIELDS) {
    const b = before[f];
    const a = after[f];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      out.push({ field: f, before: b, after: a });
    }
  }
  return out;
}
