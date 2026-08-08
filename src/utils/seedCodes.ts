/**
 * Shared seed codes for bracket slots: group letter + finish place.
 * Supports A1…Z16 (e.g. large single-table leagues like NBL Div 2).
 */

const SEED_MAX_PLACE = 16;

/** Normalize "a10" → "A10". Null if invalid or place outside 1…16. */
export function normalizeSeedCode(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^([A-Z])(\d{1,2})$/i);
  if (!m) return null;
  const place = Number(m[2]);
  if (!Number.isFinite(place) || place < 1 || place > SEED_MAX_PLACE) {
    return null;
  }
  return `${m[1].toUpperCase()}${place}`;
}

/** Parse "A10 vs A2" style labels into normalized seed codes. */
export function parseSeedMatchupLabel(
  label: string | undefined
): [string, string] | null {
  if (!label) return null;
  const m = label
    .trim()
    .match(/^([A-Z]\d{1,2})\s+vs\s+([A-Z]\d{1,2})$/i);
  if (!m) return null;
  const a = normalizeSeedCode(m[1]);
  const b = normalizeSeedCode(m[2]);
  if (!a || !b) return null;
  return [a, b];
}

export { SEED_MAX_PLACE };
