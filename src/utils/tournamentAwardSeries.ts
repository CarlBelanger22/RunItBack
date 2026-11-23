/**
 * Award series: progressive seasons of one league variant (ROTY / MIP).
 * Standalone tournaments have no awardSeriesId → no ROTY/MIP sections.
 */

import type { Tournament } from '../App';
import { allTournamentShortName } from './tournamentAllTeams';

export type RookieMode = 'off' | 'manual' | 'auto';

export type AwardSeriesLinkMode = 'standalone' | 'continue' | 'new';

export const DEFAULT_NEW_SERIES_ROOKIE_MODE: RookieMode = 'manual';

export interface AwardSeriesOption {
  seriesId: string;
  label: string;
  seasonCount: number;
  /** Rookie mode from the newest tournament in the series. */
  rookieMode: RookieMode;
}

export function normalizeRookieMode(
  value: string | null | undefined
): RookieMode | undefined {
  if (value === 'off' || value === 'manual' || value === 'auto') return value;
  return undefined;
}

export function generateAwardSeriesId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `award-series-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Sort key: year, then createdAt, then id. */
export function compareTournamentsChronological(
  a: Pick<Tournament, 'id' | 'year' | 'createdAt'>,
  b: Pick<Tournament, 'id' | 'year' | 'createdAt'>
): number {
  if (a.year !== b.year) return a.year - b.year;
  const ac = a.createdAt ?? '';
  const bc = b.createdAt ?? '';
  if (ac !== bc) return ac.localeCompare(bc);
  return a.id.localeCompare(b.id);
}

export function tournamentsInAwardSeries(
  tournaments: Tournament[],
  seriesId: string
): Tournament[] {
  return tournaments
    .filter((t) => t.awardSeriesId === seriesId)
    .sort(compareTournamentsChronological);
}

/**
 * Group tournaments that already have an awardSeriesId into Continue options.
 * @param excludeTournamentId omit this tournament from season counts / newest (edit self).
 */
export function listAwardSeriesOptions(
  tournaments: Tournament[],
  excludeTournamentId?: string
): AwardSeriesOption[] {
  const bySeries = new Map<string, Tournament[]>();
  for (const t of tournaments) {
    if (!t.awardSeriesId) continue;
    if (excludeTournamentId && t.id === excludeTournamentId) continue;
    const list = bySeries.get(t.awardSeriesId) ?? [];
    list.push(t);
    bySeries.set(t.awardSeriesId, list);
  }

  const options: AwardSeriesOption[] = [];
  for (const [seriesId, members] of bySeries) {
    const sorted = [...members].sort(compareTournamentsChronological);
    const newest = sorted[sorted.length - 1]!;
    const stemCounts = new Map<string, number>();
    for (const m of sorted) {
      const stem = allTournamentShortName(m.name);
      stemCounts.set(stem, (stemCounts.get(stem) ?? 0) + 1);
    }
    let label = allTournamentShortName(newest.name);
    let best = 0;
    for (const [stem, n] of stemCounts) {
      if (n > best) {
        best = n;
        label = stem;
      }
    }
    const mode =
      normalizeRookieMode(newest.rookieMode) ?? DEFAULT_NEW_SERIES_ROOKIE_MODE;
    options.push({
      seriesId,
      label,
      seasonCount: sorted.length,
      rookieMode: mode,
    });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function inheritRookieModeFromSeries(
  tournaments: Tournament[],
  seriesId: string
): RookieMode {
  const members = tournamentsInAwardSeries(tournaments, seriesId);
  if (members.length === 0) return DEFAULT_NEW_SERIES_ROOKIE_MODE;
  const newest = members[members.length - 1]!;
  return normalizeRookieMode(newest.rookieMode) ?? DEFAULT_NEW_SERIES_ROOKIE_MODE;
}

/** Other tournaments you can Continue from (newest first). */
export function listContinueFromTournaments(
  tournaments: Tournament[],
  excludeTournamentId?: string
): Tournament[] {
  return tournaments
    .filter((t) => !excludeTournamentId || t.id !== excludeTournamentId)
    .sort((a, b) => compareTournamentsChronological(b, a));
}

export function formatContinueFromTournamentLabel(
  tournament: Pick<Tournament, 'name' | 'year' | 'awardSeriesId'>
): string {
  const linked = tournament.awardSeriesId ? '' : ' — will start series';
  return `${tournament.name} (${tournament.year})${linked}`;
}

export type ResolvedAwardSeriesFields = {
  awardSeriesId: string | undefined;
  rookieMode: RookieMode | undefined;
  /**
   * When continuing from a tournament that had no series yet, assign the new
   * shared series id to that prior tournament as well.
   */
  bootstrapSeriesOntoTournamentId?: string;
};

/**
 * Resolve fields to persist from the Create/Edit series controls.
 * Standalone clears series + rookie mode.
 * Continue: pick a prior tournament (reuse its series, or bootstrap a new one onto both).
 */
export function resolveAwardSeriesFields(input: {
  linkMode: AwardSeriesLinkMode;
  /** @deprecated prefer continueFromTournamentId */
  continueSeriesId?: string | null;
  continueFromTournamentId?: string | null;
  rookieMode: RookieMode;
  /** When editing and linkMode is continue with empty pick, keep existing. */
  existingSeriesId?: string | null;
  tournaments?: Tournament[];
}): ResolvedAwardSeriesFields {
  if (input.linkMode === 'standalone') {
    return { awardSeriesId: undefined, rookieMode: undefined };
  }
  if (input.linkMode === 'new') {
    return {
      awardSeriesId: generateAwardSeriesId(),
      rookieMode: input.rookieMode,
    };
  }

  const fromId = input.continueFromTournamentId?.trim() || '';
  if (fromId && input.tournaments) {
    const prior = input.tournaments.find((t) => t.id === fromId);
    if (prior?.awardSeriesId?.trim()) {
      return {
        awardSeriesId: prior.awardSeriesId.trim(),
        rookieMode: input.rookieMode,
      };
    }
    if (prior) {
      return {
        awardSeriesId: generateAwardSeriesId(),
        rookieMode: input.rookieMode,
        bootstrapSeriesOntoTournamentId: prior.id,
      };
    }
  }

  const seriesId =
    (input.continueSeriesId && input.continueSeriesId.trim()) ||
    (input.existingSeriesId && input.existingSeriesId.trim()) ||
    '';
  if (!seriesId) {
    return { awardSeriesId: undefined, rookieMode: undefined };
  }
  return {
    awardSeriesId: seriesId,
    rookieMode: input.rookieMode,
  };
}

export function initialSeriesLinkMode(
  tournament: Pick<Tournament, 'awardSeriesId'> | null | undefined
): AwardSeriesLinkMode {
  return tournament?.awardSeriesId ? 'continue' : 'standalone';
}

/** Apply series fields onto a tournament; standalone clears both. */
export function withAwardSeriesFields<
  T extends { awardSeriesId?: string; rookieMode?: RookieMode },
>(
  tournament: T,
  fields: {
    awardSeriesId?: string;
    rookieMode?: RookieMode;
  }
): T {
  const next: T = { ...tournament };
  if (fields.awardSeriesId?.trim()) {
    next.awardSeriesId = fields.awardSeriesId.trim();
    next.rookieMode =
      normalizeRookieMode(fields.rookieMode) ?? DEFAULT_NEW_SERIES_ROOKIE_MODE;
  } else {
    delete next.awardSeriesId;
    delete next.rookieMode;
  }
  return next;
}
