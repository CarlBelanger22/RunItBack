/**
 * Rookie of the Year + Most Improved — pure eligibility & scoring (Designer lock 2026-11-23).
 *
 * ROTY / MIP blend: 88% impact + 12% TSI (or ΔTSI).
 * Series: awardSeriesId. Rookie modes: off | manual | auto.
 * Standalone (no series) → omit both (caller).
 */

import type { Tournament } from '../App';
import { meetsTournamentMajorAwardGamesFloor } from './tournamentLeaders';
import {
  applyMissPenalty,
  blendScore,
  minmax01ById,
  toAwardPoints,
} from './tournamentAwardScoring';
import type { RookieMode } from './tournamentAwardSeries';
import {
  compareTournamentsChronological,
  tournamentsInAwardSeries,
} from './tournamentAwardSeries';

/** Same light TSI weight for ROTY and MIP (Designer: match ROTY 88/12). */
export const ROTY_TSI_WEIGHT = 0.12;
export const MIP_TSI_WEIGHT = ROTY_TSI_WEIGHT;

export type RookieEligibilityInput = {
  rookieMode: RookieMode | undefined;
  /** True if player has any completed GP in an earlier series tournament. */
  hasPriorSeriesGames: boolean;
  /** Manual tag on this tournament's roster. */
  isTaggedRookie: boolean;
};

/**
 * Whether a GP-qualified player is in the ROTY pool for this season.
 * `off` / missing mode → never. Manual → tagged only. Auto → no prior series GP.
 */
export function isRookieOfYearEligible(input: RookieEligibilityInput): boolean {
  if (input.rookieMode === 'off' || input.rookieMode == null) return false;
  if (input.rookieMode === 'manual') return input.isTaggedRookie === true;
  // auto
  return !input.hasPriorSeriesGames;
}

/** MIP excludes current-season ROTY pool members. */
export function isMostImprovedEligible(input: {
  meetsCurrentGpFloor: boolean;
  meetsPriorGpFloor: boolean;
  isRookieEligibleThisSeason: boolean;
}): boolean {
  if (input.isRookieEligibleThisSeason) return false;
  return input.meetsCurrentGpFloor && input.meetsPriorGpFloor;
}

export function meetsRookieMipGamesFloor(
  gamesPlayed: number,
  teamGames: number
): boolean {
  return meetsTournamentMajorAwardGamesFloor(gamesPlayed, teamGames);
}

/**
 * Earlier tournaments in the same series (strictly before `current`), oldest→newest.
 */
export function earlierSeriesTournaments(
  current: Pick<Tournament, 'id' | 'year' | 'createdAt' | 'awardSeriesId'>,
  allTournaments: Tournament[]
): Tournament[] {
  const seriesId = current.awardSeriesId?.trim();
  if (!seriesId) return [];
  return tournamentsInAwardSeries(allTournaments, seriesId).filter((t) => {
    if (t.id === current.id) return false;
    return compareTournamentsChronological(t, current) < 0;
  });
}

/**
 * Prior season for MIP: latest earlier series tournament where the player
 * meets the majors GP floor.
 */
export function pickPriorSeasonForMip(input: {
  current: Pick<Tournament, 'id' | 'year' | 'createdAt' | 'awardSeriesId'>;
  allTournaments: Tournament[];
  /** tournamentId → { gamesPlayed, teamGames } for this player */
  playerSeasonGp: Map<string, { gamesPlayed: number; teamGames: number }>;
}): Tournament | null {
  const earlier = earlierSeriesTournaments(
    input.current,
    input.allTournaments
  );
  for (let i = earlier.length - 1; i >= 0; i -= 1) {
    const t = earlier[i]!;
    const gp = input.playerSeasonGp.get(t.id);
    if (!gp) continue;
    if (meetsRookieMipGamesFloor(gp.gamesPlayed, gp.teamGames)) return t;
  }
  return null;
}

/** True if player has any GP (>0) in any earlier series tournament. */
export function playerHasPriorSeriesGames(input: {
  current: Pick<Tournament, 'id' | 'year' | 'createdAt' | 'awardSeriesId'>;
  allTournaments: Tournament[];
  playerSeasonGp: Map<string, { gamesPlayed: number; teamGames: number }>;
}): boolean {
  for (const t of earlierSeriesTournaments(
    input.current,
    input.allTournaments
  )) {
    const gp = input.playerSeasonGp.get(t.id);
    if (gp && gp.gamesPlayed > 0) return true;
  }
  return false;
}

export function rookieScoreFromParts(ov01: number, tsi: number): number {
  return toAwardPoints(blendScore(ov01, tsi, ROTY_TSI_WEIGHT));
}

/**
 * MIP unit blend on normalized deltas (each already in [0,1] via minmax in pool).
 */
export function mipScoreFromParts(
  deltaGmsc01: number,
  deltaTsi01: number
): number {
  return toAwardPoints(blendScore(deltaGmsc01, deltaTsi01, MIP_TSI_WEIGHT));
}

export type RookieScoreRow = {
  playerId: string;
  gmscPerGame: number;
  tsi: number;
  gamesPlayed: number;
  teamGames: number;
};

/**
 * Score ROTY pool: OV01 = minmax GmSc/g within pool, then 88/12 + miss wither.
 */
export function scoreRookiePool(rows: RookieScoreRow[]): Map<string, number> {
  const ov01 = minmax01ById(
    rows.map((r) => ({ id: r.playerId, value: r.gmscPerGame }))
  );
  const out = new Map<string, number>();
  for (const r of rows) {
    const raw = rookieScoreFromParts(ov01.get(r.playerId) ?? 0, r.tsi);
    out.set(
      r.playerId,
      applyMissPenalty(raw, r.gamesPlayed, r.teamGames)
    );
  }
  return out;
}

export type MipScoreRow = {
  playerId: string;
  /** GmSc/g this season − GmSc/g prior season. */
  deltaGmsc: number;
  /** TSI this − TSI prior (can be negative). */
  deltaTsi: number;
  gamesPlayed: number;
  teamGames: number;
};

/**
 * Score MIP pool: minmax ΔGmSc and ΔTSI within pool, then 88/12 + miss wither
 * on current-season availability.
 */
export function scoreMipPool(rows: MipScoreRow[]): Map<string, number> {
  const dGmsc01 = minmax01ById(
    rows.map((r) => ({ id: r.playerId, value: r.deltaGmsc }))
  );
  const dTsi01 = minmax01ById(
    rows.map((r) => ({ id: r.playerId, value: r.deltaTsi }))
  );
  const out = new Map<string, number>();
  for (const r of rows) {
    const raw = mipScoreFromParts(
      dGmsc01.get(r.playerId) ?? 0,
      dTsi01.get(r.playerId) ?? 0
    );
    out.set(
      r.playerId,
      applyMissPenalty(raw, r.gamesPlayed, r.teamGames)
    );
  }
  return out;
}

/** Whether Awards should show the ROTY section at all. */
export function shouldShowRookieAward(input: {
  awardSeriesId?: string;
  rookieMode?: RookieMode;
}): boolean {
  if (!input.awardSeriesId?.trim()) return false;
  if (input.rookieMode === 'off' || input.rookieMode == null) return false;
  return input.rookieMode === 'manual' || input.rookieMode === 'auto';
}

/** MIP needs a series with at least one earlier tournament in the DB. */
export function shouldShowMostImprovedAward(input: {
  awardSeriesId?: string;
  earlierSeriesTournamentCount: number;
}): boolean {
  if (!input.awardSeriesId?.trim()) return false;
  return input.earlierSeriesTournamentCount > 0;
}
