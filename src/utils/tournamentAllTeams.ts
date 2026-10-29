/**
 * Stats-only All-[Tournament] 1st / 2nd / 3rd Team.
 * GmSc/g min–max + tiered TSI (1st 0.30 / 2nd 0.20 / 3rd+HM 0.10), same shape as MVP.
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
  applyMissPenalty,
  blendScore,
  buildTeamSuccessIndexMap,
  minmax01ById,
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
  /** Position bucket from profile (G/F) — display/info only; not used for selection. */
  naturalBucket: AllTeamBucket;
  /** @deprecated alias of naturalBucket — selection no longer assigns seats. */
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
const SQUAD_SIZE = 5;
/** Max players from one club on a single named squad (1st/2nd/3rd). */
const MAX_PER_SQUAD = 2;
/** Max players from one club across 1st + 2nd + 3rd combined. HM uncapped. */
const MAX_ACROSS_NAMED = 5;

/**
 * Display stem for All-{name} / All-Defensive titles.
 * Strips a trailing year ("NBL Div 1 2026" → "NBL Div 1") and a trailing
 * "Season N" ("Rekt League Season 1" → "Rekt League" → All-Rekt League).
 */
export function allTournamentShortName(tournamentName: string): string {
  const trimmed = tournamentName.trim();
  if (!trimmed) return 'Tournament';
  let stripped = trimmed.replace(/\s+\d{4}\s*$/, '').trim();
  stripped = stripped.replace(/\s+Season\s*\d+\s*$/i, '').trim();
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

/** Blend ATI01 with TSI (default α = Third/HM 0.10; 1st uses 0.30 like MVP). */
export function computeAllTeamScore(
  ati01: number,
  tsi: number,
  alpha = 0.1
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
  }
): AllTeamMember {
  const gp = row.gamesPlayed;
  const minutes = row.totalStats.minutes_played;
  const naturalBucket = positionToAllTeamBucket(row.player.position);
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
    naturalBucket,
    seat: naturalBucket,
  };
}

/**
 * Top N by Score with club caps (no G/F seats).
 * Rejected players stay in remaining for lower tiers / HM.
 */
function fillOneSquad(
  pool: AwardPlayerAggregate[],
  scores: Map<string, ScoreMeta>,
  clubAcrossNamed: Map<string, number>,
  maxAcrossNamed: number
): { squad: AllTeamMember[]; remaining: AwardPlayerAggregate[] } {
  const ranked = [...pool].sort((a, b) => {
    const sa = scores.get(a.playerId)!;
    const sb = scores.get(b.playerId)!;
    return compareAllTeamCandidates(a, b, sa.score, sb.score);
  });

  const squad: AllTeamMember[] = [];
  const pickedIds = new Set<string>();
  const clubOnSquad = new Map<string, number>();

  for (const row of ranked) {
    if (squad.length >= SQUAD_SIZE) break;
    const clubId = row.team.id;
    const onSquad = clubOnSquad.get(clubId) ?? 0;
    const across = clubAcrossNamed.get(clubId) ?? 0;
    if (onSquad >= MAX_PER_SQUAD || across >= maxAcrossNamed) continue;
    squad.push(toMember(row, { meta: scores.get(row.playerId)! }));
    pickedIds.add(row.playerId);
    clubOnSquad.set(clubId, onSquad + 1);
    clubAcrossNamed.set(clubId, across + 1);
  }

  const remaining = ranked.filter((r) => !pickedIds.has(r.playerId));
  return { squad, remaining };
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
      score: applyMissPenalty(
        allTeamTierScore(ati, tsi, tier),
        row.gamesPlayed,
        row.teamGames
      ),
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

  const ati01 = minmax01ById(
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

  const clubAcrossNamed = new Map<string, number>();

  const firstScores = buildTierScoreMap(
    eligible,
    ati01,
    tsiByTeamId,
    input.teamWinPctByTeamId,
    progression,
    nTeams,
    'first'
  );
  const firstFill = fillOneSquad(
    eligible,
    firstScores,
    clubAcrossNamed,
    MAX_ACROSS_NAMED
  );

  const secondScores = buildTierScoreMap(
    firstFill.remaining,
    ati01,
    tsiByTeamId,
    input.teamWinPctByTeamId,
    progression,
    nTeams,
    'second'
  );
  const secondFill = fillOneSquad(
    firstFill.remaining,
    secondScores,
    clubAcrossNamed,
    MAX_ACROSS_NAMED
  );

  const thirdScores = buildTierScoreMap(
    secondFill.remaining,
    ati01,
    tsiByTeamId,
    input.teamWinPctByTeamId,
    progression,
    nTeams,
    'third'
  );
  const thirdFill = fillOneSquad(
    secondFill.remaining,
    thirdScores,
    clubAcrossNamed,
    MAX_ACROSS_NAMED
  );

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
      return toMember(row, { meta });
    });

  const tooltip =
    `Stats-only All-${shortName} (same ingredients as MVP): Game Score/g ` +
    `scaled 0–100% vs the eligible field min/max; ` +
    `then + team success (1st 35%, 2nd 20%, 3rd/HM 10%; TSI = 80% Finish^1.5 + 10% win% + 10% net when place known); ` +
    `then miss wither: −2% / −4% / −3% (recurring) of Score per team game missed (multiplicative). ` +
    `Each team is the top 5 eligible by Score (no position seats). ` +
    `Max 2 from the same club per 1st/2nd/3rd Team; max 5 across those three squads (overflow spills to honourable mentions). ` +
    `Honourable mentions uncapped. ` +
    `Eligible: ≥55% of team games.`;

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
