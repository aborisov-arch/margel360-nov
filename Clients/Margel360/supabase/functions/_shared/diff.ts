export const EDITABLE_FIELDS = ["guests", "phone", "notes", "addons", "drinks"] as const;
export type EditableField = typeof EDITABLE_FIELDS[number];

export type DiffEntry = { field: EditableField; before: unknown; after: unknown };

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
