/**
 * Stats-only All-[Tournament] 1st / 2nd / 3rd Team.
 * NBA-style: ATI percentile + tiered TSI (1st 0.20 / 2nd 0.12 / 3rd+HM 0.07).
 */
import type { Game, Team } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { isGameCompleted } from './scheduledGames';
import {
  aggregateTournamentAwardPlayers,
  tournamentHasPlusMinusCoverage,
  type AwardContender,
  type AwardPlayerAggregate,
} from './tournamentAwards';
import {
  allTeamImpactRaw,
  allTeamTierScore,
  blendScore,
  buildTeamSuccessIndexMap,
  FIRST_TEAM_SOFT_PREFER_EPS,
  isTopThreeFinishPlace,
  percentileById,
  tsiFromWinAndProgression,
} from './tournamentAwardScoring';
import { meetsTournamentMajorAwardGamesFloor } from './tournamentLeaders';
import type { TournamentRosterEntry } from './tournamentRosters';
import { calculateTeamStandings } from './tournamentStandings';
import type { TournamentStructure } from './tournamentStructure';
import {
  buildTeamProgressionPlaces,
  countTournamentTeamsForProgression,
  progressionPlaceBonus,
  recordWinMultiplier,
  recordWinPlaceBonus,
  type TeamProgressionPlace,
} from './tournamentProgression';

export type AllTeamBucket = 'G' | 'F';
export type AllTeamTier = 'first' | 'second' | 'third';
export type AllTeamMultiplierSource = 'progression' | 'record';

export interface AllTeamMember extends AwardContender {
  allTeamScore: number;
  teamWinPct: number;
  /** TSI used in tier blend (also mirrored on deprecated mult fields). */
  placeBonus: number;
  /** @deprecated alias of TSI — kept for older call sites */
  winMultiplier: number;
  /** @deprecated alias of TSI — kept for older call sites */
  contextMultiplier: number;
  multiplierSource: AllTeamMultiplierSource;
  progressionPlace: number | null;
  naturalBucket: AllTeamBucket;
  /** Seat filled on this squad (may differ from naturalBucket when soft-filled). */
  seat: AllTeamBucket;
}

export interface AllTournamentTeamsResult {
  shortName: string;
  first: AllTeamMember[];
  second: AllTeamMember[];
  third: AllTeamMember[];
  /** Next 3 eligible by AllTeamScore who missed First/Second/Third. */
  honorableMentions: AllTeamMember[];
  tooltip: string;
}

const HONORABLE_MENTION_N = 3;

const MAX_PER_CLUB = 3;
const SEAT_PATTERN: AllTeamBucket[] = ['G', 'G', 'F', 'F', 'F'];

/** Strip a trailing year, e.g. "NBL Div 1 2026" → "NBL Div 1". */
export function allTournamentShortName(tournamentName: string): string {
  const trimmed = tournamentName.trim();
  if (!trimmed) return 'Tournament';
  const stripped = trimmed.replace(/\s+\d{4}\s*$/, '').trim();
  return stripped || trimmed;
}

/** PG/SG → G; SF/PF/C/blank/unknown → F. */
export function positionToAllTeamBucket(
  position: string | null | undefined
): AllTeamBucket {
  const p = (position || '').trim().toUpperCase();
  if (p === 'PG' || p === 'SG' || p === 'G') return 'G';
  return 'F';
}

/** @deprecated use recordWinMultiplier — kept for tests during migration */
export function allTeamWinMultiplier(teamWinPct: number): number {
  return recordWinMultiplier(teamWinPct);
}

export function resolveAllTeamContextBonus(input: {
  teamId: string;
  teamWinPct: number;
  progression: Map<string, TeamProgressionPlace>;
  nTeams: number;
}): {
  bonus: number;
  source: AllTeamMultiplierSource;
  progressionPlace: number | null;
} {
  const prog = input.progression.get(input.teamId);
  if (prog) {
    return {
      bonus: progressionPlaceBonus(prog.place, input.nTeams),
      source: 'progression',
      progressionPlace: prog.place,
    };
  }
  return {
    bonus: recordWinPlaceBonus(input.teamWinPct, input.nTeams),
    source: 'record',
    progressionPlace: null,
  };
}

/** @deprecated alias of resolveAllTeamContextBonus (bonus stored as `mult`). */
export function resolveAllTeamContextMultiplier(input: {
  teamId: string;
  teamWinPct: number;
  progression: Map<string, TeamProgressionPlace>;
  nTeams: number;
}): {
  mult: number;
  source: AllTeamMultiplierSource;
  progressionPlace: number | null;
} {
  const resolved = resolveAllTeamContextBonus(input);
  return {
    mult: resolved.bonus,
    source: resolved.source,
    progressionPlace: resolved.progressionPlace,
  };
}

/** Blend ATI01 with TSI (default α = Third/HM 0.07). */
export function computeAllTeamScore(
  ati01: number,
  tsi: number,
  alpha = 0.07
): number {
  return blendScore(ati01, tsi, alpha);
}

/**
 * Club win% (0–1) from completed tournament games.
 * Undecided / no scored games → 0.5 (neutral multiplier 1.0).
 */
export function buildTeamWinPctMap(
  games: Game[],
  teams: Team[]
): Map<string, number> {
  const completed = games.filter(isGameCompleted);
  const standings = calculateTeamStandings(teams, completed);
  const map = new Map<string, number>();
  for (const row of standings) {
    map.set(
      row.team.id,
      row.gamesPlayed > 0 ? row.wins / row.gamesPlayed : 0.5
    );
  }
  for (const t of teams) {
    if (!map.has(t.id)) map.set(t.id, 0.5);
  }
  return map;
}

function gmscPerGame(row: AwardPlayerAggregate): number {
  if (row.gamesPlayed <= 0) return 0;
  return MetricsCalculator.calculateGameScore(row.totalStats) / row.gamesPlayed;
}

function effPerGame(row: AwardPlayerAggregate): number {
  if (row.gamesPlayed <= 0) return 0;
  return MetricsCalculator.calculateEfficiency(row.totalStats) / row.gamesPlayed;
}

function compareAllTeamCandidates(
  a: AwardPlayerAggregate,
  b: AwardPlayerAggregate,
  scoreA: number,
  scoreB: number
): number {
  const d = scoreB - scoreA;
  if (d !== 0) return d;
  const gm = gmscPerGame(b) - gmscPerGame(a);
  if (gm !== 0) return gm;
  const eff = effPerGame(b) - effPerGame(a);
  if (eff !== 0) return eff;
  const ppg =
    b.totalStats.points / b.gamesPlayed - a.totalStats.points / a.gamesPlayed;
  if (ppg !== 0) return ppg;
  const tov =
    a.totalStats.turnovers / a.gamesPlayed -
    b.totalStats.turnovers / b.gamesPlayed;
  if (tov !== 0) return tov;
  return a.player.name.localeCompare(b.player.name);
}

function softFillPrefs(seat: AllTeamBucket): AllTeamBucket[] {
  if (seat === 'F') return ['F', 'G'];
  return ['G', 'F'];
}

type ScoreMeta = {
  score: number;
  winPct: number;
  bonus: number;
  source: AllTeamMultiplierSource;
  progressionPlace: number | null;
};

type TierKey = 'first' | 'second' | 'third' | 'hm';

function toMember(
  row: AwardPlayerAggregate,
  opts: {
    meta: ScoreMeta;
    seat: AllTeamBucket;
  }
): AllTeamMember {
  const gp = row.gamesPlayed;
  const minutes = row.totalStats.minutes_played;
  return {
    playerId: row.playerId,
    player: row.player,
    team: row.team,
    jerseyNumber: row.jerseyNumber,
    gamesPlayed: gp,
    teamGames: row.teamGames,
    totalStats: row.totalStats,
    sortValue: opts.meta.score,
    mpg: minutes > 0 && gp > 0 ? minutes / gp : null,
    plusMinusPerGame:
      row.plusMinusGames > 0 ? row.plusMinusTotal / row.plusMinusGames : null,
    gmscPerGame: gmscPerGame(row),
    allTeamScore: opts.meta.score,
    teamWinPct: opts.meta.winPct,
    placeBonus: opts.meta.bonus,
    winMultiplier: opts.meta.bonus,
    contextMultiplier: opts.meta.bonus,
    multiplierSource: opts.meta.source,
    progressionPlace: opts.meta.progressionPlace,
    naturalBucket: positionToAllTeamBucket(row.player.position),
    seat: opts.seat,
  };
}

function sortSquadDisplay(members: AllTeamMember[]): AllTeamMember[] {
  const bySeat: Record<AllTeamBucket, AllTeamMember[]> = {
    G: [],
    F: [],
  };
  for (const m of members) {
    bySeat[m.seat].push(m);
  }
  const out: AllTeamMember[] = [];
  for (const seat of SEAT_PATTERN) {
    const next = bySeat[seat].shift();
    if (next) out.push(next);
  }
  for (const seat of ['G', 'F'] as AllTeamBucket[]) {
    out.push(...bySeat[seat]);
  }
  return out;
}

function fillOneSquad(
  pool: AwardPlayerAggregate[],
  scores: Map<string, ScoreMeta>,
  opts?: { softPreferTopThree?: boolean }
): { squad: AllTeamMember[]; remaining: AwardPlayerAggregate[] } {
  const remaining = [...pool].sort((a, b) => {
    const sa = scores.get(a.playerId)!;
    const sb = scores.get(b.playerId)!;
    if (
      opts?.softPreferTopThree &&
      Math.abs(sa.score - sb.score) <= FIRST_TEAM_SOFT_PREFER_EPS
    ) {
      const aTop = isTopThreeFinishPlace(sa.progressionPlace);
      const bTop = isTopThreeFinishPlace(sb.progressionPlace);
      if (aTop && !bTop) return -1;
      if (bTop && !aTop) return 1;
    }
    return compareAllTeamCandidates(a, b, sa.score, sb.score);
  });

  const need: Record<AllTeamBucket, number> = { G: 2, F: 3 };
  const clubCount = new Map<string, number>();
  const picked: AllTeamMember[] = [];
  const pickedIds = new Set<string>();

  const canTake = (row: AwardPlayerAggregate) =>
    (clubCount.get(row.team.id) ?? 0) < MAX_PER_CLUB;

  const take = (row: AwardPlayerAggregate, seat: AllTeamBucket) => {
    const meta = scores.get(row.playerId)!;
    picked.push(toMember(row, { meta, seat }));
    pickedIds.add(row.playerId);
    clubCount.set(row.team.id, (clubCount.get(row.team.id) ?? 0) + 1);
    need[seat] -= 1;
  };

  for (const row of remaining) {
    if (picked.length >= 5) break;
    if (!canTake(row)) continue;
    const bucket = positionToAllTeamBucket(row.player.position);
    if (need[bucket] <= 0) continue;
    take(row, bucket);
  }

  for (const seat of SEAT_PATTERN) {
    if (need[seat] <= 0) continue;
    const candidates = remaining.filter(
      (r) => !pickedIds.has(r.playerId) && canTake(r)
    );
    let chosen: AwardPlayerAggregate | null = null;
    for (const pref of softFillPrefs(seat)) {
      chosen =
        candidates.find(
          (r) => positionToAllTeamBucket(r.player.position) === pref
        ) ?? null;
      if (chosen) break;
    }
    if (chosen) take(chosen, seat);
  }

  const left = remaining.filter((r) => !pickedIds.has(r.playerId));
  return { squad: sortSquadDisplay(picked), remaining: left };
}

function buildTierScoreMap(
  eligible: AwardPlayerAggregate[],
  ati01: Map<string, number>,
  tsiByTeamId: Map<string, number>,
  winPctByTeamId: Map<string, number>,
  progression: Map<string, TeamProgressionPlace>,
  nTeams: number,
  tier: TierKey
): Map<string, ScoreMeta> {
  const scores = new Map<string, ScoreMeta>();
  for (const row of eligible) {
    const winPct = winPctByTeamId.get(row.team.id) ?? 0.5;
    const prog = progression.get(row.team.id);
    const tsi =
      tsiByTeamId.get(row.team.id) ??
      tsiFromWinAndProgression({
        teamId: row.team.id,
        winPct,
        progression,
        nTeams,
      });
    const ati = ati01.get(row.playerId) ?? 0;
    scores.set(row.playerId, {
      score: allTeamTierScore(ati, tsi, tier),
      winPct,
      bonus: tsi,
      source: prog ? 'progression' : 'record',
      progressionPlace: prog?.place ?? null,
    });
  }
  return scores;
}

export function buildAllTournamentTeams(input: {
  tournamentName: string;
  players: AwardPlayerAggregate[];
  teamWinPctByTeamId: Map<string, number>;
  /** When non-empty, clubs in the map use progression in TSI; others use W–L. */
  progressionByTeamId?: Map<string, TeamProgressionPlace>;
  nTeamsForProgression?: number;
  tsiByTeamId?: Map<string, number>;
  includePlusMinus?: boolean;
}): AllTournamentTeamsResult {
  const shortName = allTournamentShortName(input.tournamentName);
  const eligible = input.players.filter((r) =>
    meetsTournamentMajorAwardGamesFloor(r.gamesPlayed, r.teamGames)
  );
  const progression = input.progressionByTeamId ?? new Map();
  const nTeams = Math.max(
    2,
    input.nTeamsForProgression ??
      new Set(eligible.map((r) => r.team.id)).size
  );
  const includePm = input.includePlusMinus ?? false;

  const ati01 = percentileById(
    eligible.map((r) => ({
      id: r.playerId,
      value: allTeamImpactRaw(r, includePm),
    }))
  );

  const tsiByTeamId = input.tsiByTeamId ?? new Map<string, number>();
  if (tsiByTeamId.size === 0) {
    for (const row of eligible) {
      if (tsiByTeamId.has(row.team.id)) continue;
      tsiByTeamId.set(
        row.team.id,
        tsiFromWinAndProgression({
          teamId: row.team.id,
          winPct: input.teamWinPctByTeamId.get(row.team.id) ?? 0.5,
          progression,
          nTeams,
        })
      );
    }
  }

  const firstScores = buildTierScoreMap(
    eligible,
    ati01,
    tsiByTeamId,
    input.teamWinPctByTeamId,
    progression,
    nTeams,
    'first'
  );
  const firstFill = fillOneSquad(eligible, firstScores, {
    softPreferTopThree: true,
  });

  const secondScores = buildTierScoreMap(
    firstFill.remaining,
    ati01,
    tsiByTeamId,
    input.teamWinPctByTeamId,
    progression,
    nTeams,
    'second'
  );
  const secondFill = fillOneSquad(firstFill.remaining, secondScores);

  const thirdScores = buildTierScoreMap(
    secondFill.remaining,
    ati01,
    tsiByTeamId,
    input.teamWinPctByTeamId,
    progression,
    nTeams,
    'third'
  );
  const thirdFill = fillOneSquad(secondFill.remaining, thirdScores);

  const hmScores = buildTierScoreMap(
    thirdFill.remaining,
    ati01,
    tsiByTeamId,
    input.teamWinPctByTeamId,
    progression,
    nTeams,
    'hm'
  );
  const honorableMentions = [...thirdFill.remaining]
    .sort((a, b) => {
      const sa = hmScores.get(a.playerId)!;
      const sb = hmScores.get(b.playerId)!;
      return compareAllTeamCandidates(a, b, sa.score, sb.score);
    })
    .slice(0, HONORABLE_MENTION_N)
    .map((row) => {
      const meta = hmScores.get(row.playerId)!;
      return toMember(row, {
        meta,
        seat: positionToAllTeamBucket(row.player.position),
      });
    });

  const tooltip =
    `Stats-only All-${shortName} (NBA-style): impact = 60% GmSc/g + 40% defense box, as a percentile; ` +
    `then + team success (1st 20%, 2nd 12%, 3rd/HM 7%). ` +
    `1st Team soft-prefers finish places 1–3 when scores are within 2 points. ` +
    `Each team is 2G / 3F (C and blank Pos count as F; empty seats soft-fill). ` +
    `Max 3 from the same club per 1st/2nd/3rd. Eligible: ≥60% of team games. ` +
    `Honourable mentions = next 3 by Score who missed the teams.`;

  return {
    shortName,
    first: firstFill.squad,
    second: secondFill.squad,
    third: thirdFill.squad,
    honorableMentions,
    tooltip,
  };
}

export function buildAllTournamentTeamsForGames(input: {
  tournamentId: string;
  tournamentName: string;
  games: Game[];
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
  structure?: TournamentStructure | null;
}): AllTournamentTeamsResult {
  const players = aggregateTournamentAwardPlayers({
    tournamentId: input.tournamentId,
    games: input.games,
    teams: input.teams,
    tournamentRosters: input.tournamentRosters,
  });
  const teamWinPctByTeamId = buildTeamWinPctMap(input.games, input.teams);
  const progressionByTeamId = buildTeamProgressionPlaces({
    structure: input.structure,
    games: input.games,
    teams: input.teams,
  });
  const nTeamsForProgression = countTournamentTeamsForProgression(
    input.teams,
    input.games,
    progressionByTeamId
  );
  const tsiByTeamId = buildTeamSuccessIndexMap({
    games: input.games,
    teams: input.teams,
    progression: progressionByTeamId,
    nTeams: nTeamsForProgression,
    winPctByTeamId: teamWinPctByTeamId,
  });
  return buildAllTournamentTeams({
    tournamentName: input.tournamentName,
    players,
    teamWinPctByTeamId,
    progressionByTeamId,
    nTeamsForProgression,
    tsiByTeamId,
    includePlusMinus: tournamentHasPlusMinusCoverage(input.games),
  });
}

/** Tier title helper for UI. */
export function allTeamTierTitle(
  tier: AllTeamTier,
  shortName: string
): string {
  const label =
    tier === 'first' ? '1st' : tier === 'second' ? '2nd' : '3rd';
  return `All-${shortName} ${label} Team`;
}

/** Exported for tests — soft-fill preference order. */
export function allTeamSoftFillPrefs(seat: AllTeamBucket): AllTeamBucket[] {
  return softFillPrefs(seat);
}
