/**
 * Preserve DB metadata when import sources omit optional fields.
 * - `undefined` (field absent) → keep existing DB value
 * - non-empty string → use incoming
 * - `null` or `''` → explicit clear
 */

export interface ExistingIconDescription {
  icon: string | null;
  description: string | null;
}

export function pickPreservedOptionalString(
  incoming: string | null | undefined,
  existing: string | null | undefined
): string | null {
  if (incoming !== undefined) {
    if (incoming === null || incoming === '') return null;
    return incoming;
  }
  return existing ?? null;
}
