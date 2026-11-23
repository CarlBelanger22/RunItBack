/**
 * Rookie of the Year + Most Improved — pure eligibility & scoring (Designer lock 2026-11-23).
 *
 * ROTY / MIP blend: 88% impact + 12% TSI (or ΔTSI).
 * Series: awardSeriesId. Rookie modes: off | manual | auto.
 * Standalone (no series) → omit both (caller).
 */

import type { Game, Tournament } from '../App';
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
import { isGameCompleted } from './scheduledGames';
import type { TournamentRosterEntry } from './tournamentRosters';
import { setTournamentRosterRookieFlag } from './tournamentRosters';

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

/** Prior series season that already used a manual rookie year (tag + GP > 0). */
export type PriorManualRookieLock = {
  tournamentId: string;
  tournamentName: string;
};

/**
 * Completed GP per player per tournament (from box rows).
 * playerId → tournamentId → gamesPlayed
 */
export function buildPlayerCompletedGpByTournament(
  games: Game[]
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const game of games) {
    if (!isGameCompleted(game) || !game.tournamentId) continue;
    const seen = new Set<string>();
    for (const stat of game.gameStats ?? []) {
      if (!stat.playerId || seen.has(stat.playerId)) continue;
      seen.add(stat.playerId);
      let byT = out.get(stat.playerId);
      if (!byT) {
        byT = new Map();
        out.set(stat.playerId, byT);
      }
      byT.set(game.tournamentId, (byT.get(game.tournamentId) ?? 0) + 1);
    }
  }
  return out;
}

function playerWasTaggedRookieInTournament(
  playerId: string,
  tournamentId: string,
  tournamentRosters: TournamentRosterEntry[]
): boolean {
  return tournamentRosters.some(
    (r) =>
      r.tournamentId === tournamentId &&
      r.playerId === playerId &&
      r.isRookie === true
  );
}

/**
 * Most recent earlier series season where this player was tagged rookie AND
 * had GP > 0. Tag + 0 GP does not lock (rookie year unused).
 */
export function getPriorSeriesManualRookieLock(input: {
  playerId: string;
  current: Pick<Tournament, 'id' | 'year' | 'createdAt' | 'awardSeriesId'>;
  allTournaments: Tournament[];
  tournamentRosters: TournamentRosterEntry[];
  playerGpByTournament: Map<string, Map<string, number>>;
}): PriorManualRookieLock | null {
  const earlier = earlierSeriesTournaments(
    input.current,
    input.allTournaments
  );
  const gpMap = input.playerGpByTournament.get(input.playerId);
  for (let i = earlier.length - 1; i >= 0; i -= 1) {
    const prior = earlier[i]!;
    if (
      !playerWasTaggedRookieInTournament(
        input.playerId,
        prior.id,
        input.tournamentRosters
      )
    ) {
      continue;
    }
    const gp = gpMap?.get(prior.id) ?? 0;
    if (gp <= 0) continue;
    return { tournamentId: prior.id, tournamentName: prior.name };
  }
  return null;
}

/** playerId → lock for Eligibility UI. */
export function buildPriorSeriesManualRookieLockByPlayer(input: {
  playerIds: string[];
  current: Pick<Tournament, 'id' | 'year' | 'createdAt' | 'awardSeriesId'>;
  allTournaments: Tournament[];
  tournamentRosters: TournamentRosterEntry[];
  playerGpByTournament: Map<string, Map<string, number>>;
}): Map<string, PriorManualRookieLock> {
  const out = new Map<string, PriorManualRookieLock>();
  for (const playerId of input.playerIds) {
    const lock = getPriorSeriesManualRookieLock({
      playerId,
      current: input.current,
      allTournaments: input.allTournaments,
      tournamentRosters: input.tournamentRosters,
      playerGpByTournament: input.playerGpByTournament,
    });
    if (lock) out.set(playerId, lock);
  }
  return out;
}

/**
 * Strip current-tournament isRookie for players locked by a prior used year.
 */
export function clearCurrentRookieTagsForLockedPlayers(input: {
  tournamentId: string;
  tournamentRosters: TournamentRosterEntry[];
  lockedPlayerIds: ReadonlySet<string>;
}): TournamentRosterEntry[] {
  let next = input.tournamentRosters;
  let changed = false;
  for (const row of input.tournamentRosters) {
    if (row.tournamentId !== input.tournamentId) continue;
    if (row.isRookie !== true) continue;
    if (!input.lockedPlayerIds.has(row.playerId)) continue;
    next = setTournamentRosterRookieFlag(next, {
      tournamentId: row.tournamentId,
      teamId: row.teamId,
      playerId: row.playerId,
      isRookie: false,
    });
    changed = true;
  }
  return changed ? next : input.tournamentRosters;
}
