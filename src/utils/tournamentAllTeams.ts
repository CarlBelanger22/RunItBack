/**
 * Stats-only First / Second / Third Team All-[Tournament].
 * Seats 2G / 3F; GmSc/g × progression (±15%) or W–L fallback (±15%).
 */
import type { Game, Team } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { isGameCompleted } from './scheduledGames';
import {
  aggregateTournamentAwardPlayers,
  type AwardContender,
  type AwardPlayerAggregate,
} from './tournamentAwards';
import { meetsTournamentMajorAwardGamesFloor } from './tournamentLeaders';
import type { TournamentRosterEntry } from './tournamentRosters';
import { calculateTeamStandings } from './tournamentStandings';
import type { TournamentStructure } from './tournamentStructure';
import {
  buildTeamProgressionPlaces,
  countTournamentTeamsForProgression,
  progressionPlaceMultiplier,
  recordWinMultiplier,
  type TeamProgressionPlace,
} from './tournamentProgression';

export type AllTeamBucket = 'G' | 'F';
export type AllTeamTier = 'first' | 'second' | 'third';
export type AllTeamMultiplierSource = 'progression' | 'record';

export interface AllTeamMember extends AwardContender {
  allTeamScore: number;
  teamWinPct: number;
  /** @deprecated alias of contextMultiplier — kept for older call sites */
  winMultiplier: number;
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
  const prog = input.progression.get(input.teamId);
  if (prog) {
    return {
      mult: progressionPlaceMultiplier(prog.place, input.nTeams),
      source: 'progression',
      progressionPlace: prog.place,
    };
  }
  return {
    mult: recordWinMultiplier(input.teamWinPct),
    source: 'record',
    progressionPlace: null,
  };
}

export function computeAllTeamScore(
  gmscPerGame: number,
  contextMultiplier: number
): number {
  return gmscPerGame * contextMultiplier;
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
  mult: number;
  source: AllTeamMultiplierSource;
  progressionPlace: number | null;
};

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
    winMultiplier: opts.meta.mult,
    contextMultiplier: opts.meta.mult,
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
  scores: Map<string, ScoreMeta>
): { squad: AllTeamMember[]; remaining: AwardPlayerAggregate[] } {
  const remaining = [...pool].sort((a, b) => {
    const sa = scores.get(a.playerId)!;
    const sb = scores.get(b.playerId)!;
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

export function buildAllTournamentTeams(input: {
  tournamentName: string;
  players: AwardPlayerAggregate[];
  teamWinPctByTeamId: Map<string, number>;
  /** When non-empty, clubs in the map use progression weight; others use W–L. */
  progressionByTeamId?: Map<string, TeamProgressionPlace>;
  nTeamsForProgression?: number;
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

  const scores = new Map<string, ScoreMeta>();
  for (const row of eligible) {
    const winPct = input.teamWinPctByTeamId.get(row.team.id) ?? 0.5;
    const resolved = resolveAllTeamContextMultiplier({
      teamId: row.team.id,
      teamWinPct: winPct,
      progression,
      nTeams,
    });
    const score = computeAllTeamScore(gmscPerGame(row), resolved.mult);
    scores.set(row.playerId, {
      score,
      winPct,
      mult: resolved.mult,
      source: resolved.source,
      progressionPlace: resolved.progressionPlace,
    });
  }

  const firstFill = fillOneSquad(eligible, scores);
  const secondFill = fillOneSquad(firstFill.remaining, scores);
  const thirdFill = fillOneSquad(secondFill.remaining, scores);

  const honorableMentions = [...thirdFill.remaining]
    .sort((a, b) => {
      const sa = scores.get(a.playerId)!;
      const sb = scores.get(b.playerId)!;
      return compareAllTeamCandidates(a, b, sa.score, sb.score);
    })
    .slice(0, HONORABLE_MENTION_N)
    .map((row) => {
      const meta = scores.get(row.playerId)!;
      return toMember(row, {
        meta,
        // Display natural bucket in Seat column (not an All-Team seat).
        seat: positionToAllTeamBucket(row.player.position),
      });
    });

  const tooltip =
    `Stats-only All-${shortName}: GmSc/g × context (±15%). ` +
    `Context = tournament progression place when known (Final / 3rd / placing pool; splits when those games finish), ` +
    `otherwise team win%. ` +
    `Each team is 2G / 3F (C and blank Pos count as F; empty seats soft-fill). ` +
    `Max 3 from the same club per First/Second/Third. Eligible: ≥60% of team games. ` +
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
  return buildAllTournamentTeams({
    tournamentName: input.tournamentName,
    players,
    teamWinPctByTeamId,
    progressionByTeamId,
    nTeamsForProgression,
  });
}

/** Tier title helper for UI. */
export function allTeamTierTitle(
  tier: AllTeamTier,
  shortName: string
): string {
  const label =
    tier === 'first' ? 'First' : tier === 'second' ? 'Second' : 'Third';
  return `${label} Team All-${shortName}`;
}

/** Exported for tests — soft-fill preference order. */
export function allTeamSoftFillPrefs(seat: AllTeamBucket): AllTeamBucket[] {
  return softFillPrefs(seat);
}
