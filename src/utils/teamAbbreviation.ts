/** Build a 3-letter uppercase abbreviation from a team name. */
export function generateTeamAbbreviation(
  name: string,
  takenAbbreviations: string[] = []
): string {
  const taken = new Set(takenAbbreviations.map((a) => a.toUpperCase()));
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  if (!cleaned) return nextAvailable('TMP', taken);

  const words = cleaned.split(/\s+/).filter(Boolean);
  let base: string;
  if (words.length >= 2) {
    base = words
      .slice(0, 3)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase();
  } else {
    base = cleaned.slice(0, 3).toUpperCase();
  }

  base = base.padEnd(3, 'X').slice(0, 3);
  return nextAvailable(base, taken);
}

function nextAvailable(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base.slice(0, 2)}${n}`.slice(0, 3);
    if (!taken.has(candidate)) return candidate;
  }
  return `${base[0]}${Date.now() % 100}`.padStart(3, '0').slice(0, 3);
}

export function hasDuplicateJerseyNumbers(players: { number: number }[]): boolean {
  const seen = new Set<number>();
  for (const p of players) {
    if (seen.has(p.number)) return true;
    seen.add(p.number);
  }
  return false;
}
