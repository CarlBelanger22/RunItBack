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

/** L1 → "1st". Other codes, including A1, stay as written. */
export function displaySeedLabel(raw: string): string {
  const code = normalizeSeedCode(raw);
  if (!code || !code.startsWith('L')) return raw.trim();
  const place = Number(code.slice(1));
  const teen = place % 100;
  const suffix =
    teen >= 11 && teen <= 13
      ? 'th'
      : place % 10 === 1
        ? 'st'
        : place % 10 === 2
          ? 'nd'
          : place % 10 === 3
            ? 'rd'
            : 'th';
  return `${place}${suffix}`;
}

export { SEED_MAX_PLACE };
