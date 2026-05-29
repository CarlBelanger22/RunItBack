export const TEAM_ABBREV_MIN = 3;
export const TEAM_ABBREV_MAX = 5;

const STOP_WORDS = new Set(['of', 'and', 'the', 'for', 'a', 'an']);

/** Normalize user-entered abbreviation (3–5 uppercase alphanumeric). */
export function normalizeTeamAbbreviation(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, TEAM_ABBREV_MAX);
}

export function isValidTeamAbbreviation(value: string): boolean {
  const normalized = normalizeTeamAbbreviation(value);
  return (
    normalized.length >= TEAM_ABBREV_MIN &&
    normalized.length <= TEAM_ABBREV_MAX
  );
}

/** Build a 3–5 letter uppercase abbreviation from a team name. */
export function generateTeamAbbreviation(
  name: string,
  takenAbbreviations: string[] = []
): string {
  const taken = new Set(takenAbbreviations.map((a) => a.toUpperCase()));
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  if (!cleaned) return nextAvailable('TMP', taken);

  const words = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOP_WORDS.has(w.toLowerCase()));

  let base: string;
  if (words.length >= 2) {
    base = words
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase();
  } else {
    base = cleaned.replace(/\s+/g, '').toUpperCase();
  }

  base = normalizeBase(base);
  return nextAvailable(base, taken);
}

function normalizeBase(base: string): string {
  const cleaned = base.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length < TEAM_ABBREV_MIN) {
    return cleaned.padEnd(TEAM_ABBREV_MIN, 'X').slice(0, TEAM_ABBREV_MAX);
  }
  return cleaned.slice(0, TEAM_ABBREV_MAX);
}

function nextAvailable(base: string, taken: Set<string>): string {
  if (base.length >= TEAM_ABBREV_MIN && !taken.has(base)) return base;

  for (let len = TEAM_ABBREV_MAX; len >= TEAM_ABBREV_MIN; len--) {
    const truncated = base.slice(0, len);
    if (truncated.length >= TEAM_ABBREV_MIN && !taken.has(truncated)) {
      return truncated;
    }
  }

  for (let n = 2; n < 100; n++) {
    const suffix = String(n);
    const prefixLen = Math.max(
      TEAM_ABBREV_MIN,
      Math.min(base.length, TEAM_ABBREV_MAX - suffix.length)
    );
    const candidate = `${base.slice(0, prefixLen)}${suffix}`.slice(
      0,
      TEAM_ABBREV_MAX
    );
    if (candidate.length >= TEAM_ABBREV_MIN && !taken.has(candidate)) {
      return candidate;
    }
  }

  return `${base[0] ?? 'T'}${Date.now() % 10000}`
    .slice(0, TEAM_ABBREV_MAX)
    .padEnd(TEAM_ABBREV_MIN, '0');
}

export function hasDuplicateJerseyNumbers(players: { number: number }[]): boolean {
  const seen = new Set<number>();
  for (const p of players) {
    if (seen.has(p.number)) return true;
    seen.add(p.number);
  }
  return false;
}
