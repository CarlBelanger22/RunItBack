const MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export interface ParsedDateOnly {
  year: number;
  monthIndex: number;
  day: number;
}

/** Parse YYYY-MM-DD without UTC timezone shift. */
export function parseDateOnly(isoDate: string): ParsedDateOnly | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (
    !Number.isFinite(year) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return { year, monthIndex, day };
}

export function parseTournamentMonthIndex(month: string): number | null {
  const trimmed = month.trim();
  if (trimmed in MONTH_INDEX) {
    return MONTH_INDEX[trimmed];
  }

  const parsed = Date.parse(`${trimmed} 1, 2000`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).getMonth();
}

/**
 * Player age during a tournament season (month + year).
 * Same calendar month as birthday counts as birthday passed for that year.
 */
export function getPlayerAgeAtTournamentSeason(
  dateOfBirth: string | undefined,
  month: string,
  year: number
): number | null {
  if (!dateOfBirth) return null;

  const birth = parseDateOnly(dateOfBirth);
  const tournamentMonthIndex = parseTournamentMonthIndex(month);
  if (!birth || tournamentMonthIndex === null || !Number.isFinite(year)) {
    return null;
  }

  let age = year - birth.year;
  if (tournamentMonthIndex < birth.monthIndex) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

/** Current age from YYYY-MM-DD DOB (timezone-safe via parseDateOnly). */
export function getPlayerAgeAsOfToday(
  dateOfBirth: string | undefined,
  asOf: Date = new Date()
): number | null {
  if (!dateOfBirth) return null;

  const birth = parseDateOnly(dateOfBirth);
  if (!birth) return null;

  const refYear = asOf.getFullYear();
  const refMonth = asOf.getMonth();
  const refDay = asOf.getDate();

  let age = refYear - birth.year;
  if (
    refMonth < birth.monthIndex ||
    (refMonth === birth.monthIndex && refDay < birth.day)
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

/** Prefer DOB-derived age; fall back to stored profile age when DOB is missing. */
export function resolvePlayerAge(
  player: { age?: number; dateOfBirth?: string },
  asOf: Date = new Date()
): number | null {
  const fromDob = getPlayerAgeAsOfToday(player.dateOfBirth, asOf);
  if (fromDob !== null) return fromDob;

  const stored = Number(player.age);
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}
