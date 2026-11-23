/**
 * Classify known league variants into awardSeriesId + rookieMode for backfill.
 * Idempotent slug ids (not random UUIDs) so re-runs stay stable.
 */

import type { RookieMode } from './tournamentAwardSeries';

export type AwardSeriesBackfillHit = {
  seriesId: string;
  rookieMode: RookieMode;
  label: string;
};

/** Stable series ids — do not change once written to production. */
export const AWARD_SERIES_IDS = {
  sunig: 'award-series-sunig',
  rektLeague: 'award-series-rekt-league',
  rektGLeague: 'award-series-rekt-gleague',
  nblDiv1: 'award-series-nbl-div-1',
  nblDiv2: 'award-series-nbl-div-2',
  ivp: 'award-series-ivp',
  polite: 'award-series-polite',
} as const;

function norm(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-');
}

/**
 * Map a tournament display name to an award series, or null = leave standalone.
 * Order matters: G-League before League; Div 2 before Div 1.
 */
export function classifyTournamentAwardSeries(
  tournamentName: string
): AwardSeriesBackfillHit | null {
  const n = norm(tournamentName);
  if (!n) return null;

  // Rekt G-League (separate from main Rekt League)
  if (
    /\brekt\b/.test(n) &&
    /\bg[-\s]?league\b/.test(n) &&
    !/\bcup\b/.test(n)
  ) {
    return {
      seriesId: AWARD_SERIES_IDS.rektGLeague,
      rookieMode: 'auto',
      label: 'Rekt G-League',
    };
  }

  // Rekt League main (Season N) — not Cup, not G-League
  if (
    /\brekt\b/.test(n) &&
    /\bleague\b/.test(n) &&
    !/\bg[-\s]?league\b/.test(n) &&
    !/\bcup\b/.test(n)
  ) {
    return {
      seriesId: AWARD_SERIES_IDS.rektLeague,
      rookieMode: 'auto',
      label: 'Rekt League',
    };
  }

  if (/\bsunig\b/.test(n)) {
    return {
      seriesId: AWARD_SERIES_IDS.sunig,
      rookieMode: 'manual',
      label: 'SUniG',
    };
  }

  if (/\bnbl\b/.test(n) && /\bdiv(?:ision)?\s*2\b/.test(n)) {
    return {
      seriesId: AWARD_SERIES_IDS.nblDiv2,
      rookieMode: 'manual',
      label: 'NBL Div 2',
    };
  }

  if (/\bnbl\b/.test(n) && /\bdiv(?:ision)?\s*1\b/.test(n)) {
    return {
      seriesId: AWARD_SERIES_IDS.nblDiv1,
      rookieMode: 'manual',
      label: 'NBL Div 1',
    };
  }

  if (/\bivp\b/.test(n)) {
    return {
      seriesId: AWARD_SERIES_IDS.ivp,
      rookieMode: 'manual',
      label: 'IVP',
    };
  }

  if (/\bpol(?:[- ]?ite|ite)\b/.test(n)) {
    return {
      seriesId: AWARD_SERIES_IDS.polite,
      rookieMode: 'manual',
      label: 'POL-ITE',
    };
  }

  return null;
}
