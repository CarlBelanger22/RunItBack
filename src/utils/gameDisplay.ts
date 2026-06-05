import type { Game, GameStats, Player, Team, TeamStats } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import {
  perGameAverageOrNull,
  tournamentRecordsStat,
} from './statRecordingCoverage';
import { resolvePlayerTeamSideInGame } from './tournamentRosters';

export type TeamSide = 'home' | 'away';

export const OPTIONAL_ADVANCED_TEAM_STAT_KEYS = [
  'points_off_turnovers',
  'points_in_paint',
  'second_chance_points',
  'fastbreak_points',
  'bench_points',
  'biggest_lead',
  'biggest_scoring_run',
] as const;

export type OptionalAdvancedTeamStatKey =
  (typeof OPTIONAL_ADVANCED_TEAM_STAT_KEYS)[number];

export type GameLeaderMetric = 'points' | 'assists' | 'rebounds' | 'efficiency';

export interface GameLeaderEntry {
  name: string;
  playerId: string;
  teamId: string;
}

export interface GameLeaderResult {
  value: number;
  names: string[];
  leaders: GameLeaderEntry[];
}

export function sortGamesByDateDesc(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getTeamForSide(game: Game, side: TeamSide): Team {
  return side === 'home' ? game.homeTeam : game.awayTeam;
}

export function getPersistedTeamStats(
  game: Game,
  side: TeamSide
): TeamStats | undefined {
  return side === 'home' ? game.teamStats?.home : game.teamStats?.away;
}

/** Team stats bucket matching `teamId` (not home/away slot). */
export function getPersistedTeamStatsForTeam(
  game: Game,
  teamId: string
): TeamStats | undefined {
  const home = game.teamStats?.home;
  const away = game.teamStats?.away;
  if (home?.teamId === teamId) return home;
  if (away?.teamId === teamId) return away;
  return undefined;
}

function isHomeTeamId(game: Game, teamId: string): boolean {
  return game.homeTeamId === teamId || game.homeTeam.id === teamId;
}

/** True when a side has no player box score rows but a team/final score exists (e.g. SUTD). */
export function isScoreOnlyTeam(game: Game, side: TeamSide): boolean {
  const team = getTeamForSide(game, side);

  if (!game.trackBothTeams && side === 'away') {
    const persisted = getPersistedTeamStatsForTeam(game, team.id);
    const fromFinal = game.finalScore?.away ?? 0;
    return (
      (persisted?.total_points ?? 0) > 0 ||
      fromFinal > 0 ||
      team.players.length > 0
    );
  }

  const hasPlayerBoxScore = game.gameStats.some((s) =>
    team.players.some(
      (p) => p.id === s.playerId && playerPlayedInGame(game, p.id, team.id)
    )
  );
  if (hasPlayerBoxScore) return false;

  const persisted = getPersistedTeamStatsForTeam(game, team.id);
  const fromFinal = isHomeTeamId(game, team.id)
    ? (game.finalScore?.home ?? 0)
    : (game.finalScore?.away ?? 0);
  return (persisted?.total_points ?? 0) > 0 || fromFinal > 0;
}

export function hasAwayTeamContent(game: Game): boolean {
  return game.awayTeam.players.length > 0 || isScoreOnlyTeam(game, 'away');
}

export function playerPlayedInGame(
  game: Game,
  playerId: string,
  forTeamId?: string
): boolean {
  const stat = game.gameStats.find((s) => s.playerId === playerId);
  if ((stat?.minutes_played ?? 0) <= 0) return false;

  if (forTeamId) {
    return resolvePlayerTeamSideInGame(playerId, game) === forTeamId;
  }

  return true;
}

export function getPlayersWhoPlayed(game: Game, team: Team): Player[] {
  return team.players.filter((p) => playerPlayedInGame(game, p.id, team.id));
}

/** Score for a specific team � uses team id, not home/away slot. */
export function resolveTeamScore(game: Game, teamId: string): number {
  const team =
    game.homeTeam.id === teamId
      ? game.homeTeam
      : game.awayTeam.id === teamId
        ? game.awayTeam
        : null;
  if (!team) return 0;

  const trackedTeamOnly =
    game.trackBothTeams || teamId === game.homeTeamId;

  const fromPlayers = game.gameStats
    .filter(
      (s) =>
        trackedTeamOnly &&
        team.players.some((p) => p.id === s.playerId) &&
        resolvePlayerTeamSideInGame(s.playerId, game) === teamId
    )
    .reduce((sum, s) => sum + s.points, 0);
  if (fromPlayers > 0) return fromPlayers;

  const persisted = getPersistedTeamStatsForTeam(game, teamId);
  if (persisted?.total_points != null && persisted.total_points > 0) {
    return persisted.total_points;
  }

  if (game.finalScore) {
    return isHomeTeamId(game, teamId)
      ? game.finalScore.home
      : game.finalScore.away;
  }

  return 0;
}

export function resolveSideScore(game: Game, side: TeamSide): number {
  return resolveTeamScore(game, getTeamForSide(game, side).id);
}

export function formatOptionalStat(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }
  return String(value);
}

/** Optional advanced stats: null/undefined/0 ? not recorded (not on typical box scores). */
export function getOptionalAdvancedStatValue(
  stats: TeamStats | undefined,
  key: OptionalAdvancedTeamStatKey,
  scoreOnly: boolean
): number | null {
  if (scoreOnly) return null;
  const raw = stats?.[key];
  if (raw === null || raw === undefined || raw === 0) return null;
  return raw;
}

export function formatOptionalAdvancedStat(
  stats: TeamStats | undefined,
  key: OptionalAdvancedTeamStatKey,
  scoreOnly: boolean
): string {
  const value = getOptionalAdvancedStatValue(stats, key, scoreOnly);
  if (value === null) return '-';
  return String(value);
}

function addStatValue(current: number, value: number | null | undefined): number {
  const n = value ?? 0;
  return current + (Number.isFinite(n) ? n : 0);
}

export function sumPlayerStatsForRoster(
  game: Game,
  rosterPlayerIds: ReadonlySet<string>
): GameStats {
  const empty = MetricsCalculator.getEmptyStats('team-sum');
  return game.gameStats
    .filter((s) => rosterPlayerIds.has(s.playerId))
    .reduce(
      (acc, stat) => ({
        ...acc,
        points: addStatValue(acc.points, stat.points),
        fg_made: addStatValue(acc.fg_made, stat.fg_made),
        fg_attempted: addStatValue(acc.fg_attempted, stat.fg_attempted),
        three_made: addStatValue(acc.three_made, stat.three_made),
        three_attempted: addStatValue(acc.three_attempted, stat.three_attempted),
        ft_made: addStatValue(acc.ft_made, stat.ft_made),
        ft_attempted: addStatValue(acc.ft_attempted, stat.ft_attempted),
        orb: addStatValue(acc.orb, stat.orb),
        drb: addStatValue(acc.drb, stat.drb),
        assists: addStatValue(acc.assists, stat.assists),
        steals: addStatValue(acc.steals, stat.steals),
        blocks: addStatValue(acc.blocks, stat.blocks),
        turnovers: addStatValue(acc.turnovers, stat.turnovers),
        fouls: addStatValue(acc.fouls, stat.fouls),
        tech_fouls: addStatValue(acc.tech_fouls, stat.tech_fouls),
        unsportsmanlike_fouls: addStatValue(
          acc.unsportsmanlike_fouls,
          stat.unsportsmanlike_fouls
        ),
        fouls_drawn: addStatValue(acc.fouls_drawn, stat.fouls_drawn),
        blocks_received: addStatValue(acc.blocks_received, stat.blocks_received),
        plus_minus: addStatValue(acc.plus_minus, stat.plus_minus),
        minutes_played: addStatValue(acc.minutes_played, stat.minutes_played),
      }),
      empty
    );
}

export function rosterHasPlayerBoxScore(
  game: Game,
  rosterPlayerIds: ReadonlySet<string>
): boolean {
  return game.gameStats.some(
    (s) =>
      rosterPlayerIds.has(s.playerId) &&
      (s.minutes_played > 0 || s.fg_attempted > 0 || s.points > 0)
  );
}

export function sumPlayerStatsForTeam(
  game: Game,
  team: Team
): GameStats {
  const rosterIds = new Set(
    team.players
      .filter((p) => resolvePlayerTeamSideInGame(p.id, game) === team.id)
      .map((p) => p.id)
  );
  return sumPlayerStatsForRoster(game, rosterIds);
}

/** Sum-able team stat fields used for season averages (per game, then averaged). */
export type TeamSeasonStatBucket = {
  points: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  orb: number;
  drb: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fouls_drawn: number;
  points_off_turnovers: number;
  points_in_paint: number;
  second_chance_points: number;
  fastbreak_points: number;
  bench_points: number;
};

export interface TeamAdvancedStatCoverage {
  gamesInScope: number;
  gamesWithPaint: number;
  gamesWithFastbreak: number;
  gamesWithSecondChance: number;
  gamesWithPointsOffTurnovers: number;
  hasAny: boolean;
}

export interface TeamSeasonDerivedStats {
  ppg: number;
  papg: number;
  gamesWithScore: number;
  efgPct: number | null;
  twoPtPct: number | null;
  tsPct: number | null;
  astTo: number | null;
  rpg: number;
  apg: number;
  topg: number;
  spg: number;
  bpg: number;
  fpg: number;
  fdpg: number | null;
  paintPpg: number;
  fastbreakPpg: number;
  secondChancePpg: number;
  pointsOffTurnoversPpg: number;
}

export interface AggregateTeamSeasonResult {
  /** Completed games with roster box score or persisted team counting stats. */
  gamesInSample: number;
  totals: TeamSeasonStatBucket;
  /** Season totals divided by `gamesInSample` (not sum of player per-game averages). */
  perGame: TeamSeasonStatBucket;
  foulsDrawnTotal: number;
  gamesWithFoulsDrawnData: number;
}

function emptyTeamSeasonStatBucket(): TeamSeasonStatBucket {
  return {
    points: 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    fouls_drawn: 0,
    points_off_turnovers: 0,
    points_in_paint: 0,
    second_chance_points: 0,
    fastbreak_points: 0,
    bench_points: 0,
  };
}

function seasonStatNum(value: number | null | undefined): number {
  return value ?? 0;
}

function addTeamSeasonBuckets(
  a: TeamSeasonStatBucket,
  b: TeamSeasonStatBucket
): TeamSeasonStatBucket {
  return {
    points: a.points + b.points,
    fg_made: a.fg_made + b.fg_made,
    fg_attempted: a.fg_attempted + b.fg_attempted,
    three_made: a.three_made + b.three_made,
    three_attempted: a.three_attempted + b.three_attempted,
    ft_made: a.ft_made + b.ft_made,
    ft_attempted: a.ft_attempted + b.ft_attempted,
    orb: a.orb + b.orb,
    drb: a.drb + b.drb,
    assists: a.assists + b.assists,
    steals: a.steals + b.steals,
    blocks: a.blocks + b.blocks,
    turnovers: a.turnovers + b.turnovers,
    fouls: a.fouls + b.fouls,
    fouls_drawn: a.fouls_drawn + b.fouls_drawn,
    points_off_turnovers: a.points_off_turnovers + b.points_off_turnovers,
    points_in_paint: a.points_in_paint + b.points_in_paint,
    second_chance_points: a.second_chance_points + b.second_chance_points,
    fastbreak_points: a.fastbreak_points + b.fastbreak_points,
    bench_points: a.bench_points + b.bench_points,
  };
}

function divideTeamSeasonBucket(
  bucket: TeamSeasonStatBucket,
  games: number
): TeamSeasonStatBucket {
  if (games <= 0) return emptyTeamSeasonStatBucket();
  return {
    points: bucket.points / games,
    fg_made: bucket.fg_made / games,
    fg_attempted: bucket.fg_attempted / games,
    three_made: bucket.three_made / games,
    three_attempted: bucket.three_attempted / games,
    ft_made: bucket.ft_made / games,
    ft_attempted: bucket.ft_attempted / games,
    orb: bucket.orb / games,
    drb: bucket.drb / games,
    assists: bucket.assists / games,
    steals: bucket.steals / games,
    blocks: bucket.blocks / games,
    turnovers: bucket.turnovers / games,
    fouls: bucket.fouls / games,
    fouls_drawn: bucket.fouls_drawn / games,
    points_off_turnovers: bucket.points_off_turnovers / games,
    points_in_paint: bucket.points_in_paint / games,
    second_chance_points: bucket.second_chance_points / games,
    fastbreak_points: bucket.fastbreak_points / games,
    bench_points: bucket.bench_points / games,
  };
}

/** Whether a completed game contributes to team season average denominators. */
export function teamGameCountsForSeasonAverages(
  game: Game,
  teamId: string,
  rosterIds: ReadonlySet<string>
): boolean {
  if (!game.isCompleted) return false;
  if (rosterHasPlayerBoxScore(game, rosterIds)) return true;

  const persisted = getPersistedTeamStatsForTeam(game, teamId);
  if (!persisted) return false;

  return (
    (persisted.fg_attempted ?? 0) > 0 ||
    (persisted.orb ?? 0) + (persisted.drb ?? 0) > 0 ||
    (persisted.steals ?? 0) > 0 ||
    (persisted.blocks ?? 0) > 0 ||
    (persisted.assists ?? 0) > 0 ||
    (persisted.turnovers ?? 0) > 0 ||
    (persisted.fouls ?? 0) > 0
  );
}

function teamGameSeasonContribution(
  game: Game,
  teamId: string,
  rosterIds: ReadonlySet<string>
): TeamSeasonStatBucket | null {
  if (!teamGameCountsForSeasonAverages(game, teamId, rosterIds)) {
    return null;
  }

  const persisted = getPersistedTeamStatsForTeam(game, teamId);
  const fromPlayers = rosterHasPlayerBoxScore(game, rosterIds)
    ? sumPlayerStatsForRoster(game, rosterIds)
    : null;

  const summedPoints = fromPlayers?.points ?? 0;
  const points =
    Number.isFinite(summedPoints) && summedPoints > 0
      ? summedPoints
      : resolveTeamScore(game, teamId);

  return {
    points,
    fg_made: fromPlayers?.fg_made ?? seasonStatNum(persisted?.fg_made),
    fg_attempted: fromPlayers?.fg_attempted ?? seasonStatNum(persisted?.fg_attempted),
    three_made: fromPlayers?.three_made ?? seasonStatNum(persisted?.three_made),
    three_attempted:
      fromPlayers?.three_attempted ?? seasonStatNum(persisted?.three_attempted),
    ft_made: fromPlayers?.ft_made ?? seasonStatNum(persisted?.ft_made),
    ft_attempted: fromPlayers?.ft_attempted ?? seasonStatNum(persisted?.ft_attempted),
    orb: fromPlayers?.orb ?? seasonStatNum(persisted?.orb),
    drb: fromPlayers?.drb ?? seasonStatNum(persisted?.drb),
    assists: fromPlayers?.assists ?? seasonStatNum(persisted?.assists),
    steals: fromPlayers?.steals ?? seasonStatNum(persisted?.steals),
    blocks: fromPlayers?.blocks ?? seasonStatNum(persisted?.blocks),
    turnovers: fromPlayers?.turnovers ?? seasonStatNum(persisted?.turnovers),
    fouls: fromPlayers?.fouls ?? seasonStatNum(persisted?.fouls),
    fouls_drawn: fromPlayers?.fouls_drawn ?? 0,
    points_off_turnovers: seasonStatNum(persisted?.points_off_turnovers),
    points_in_paint: seasonStatNum(persisted?.points_in_paint),
    second_chance_points: seasonStatNum(persisted?.second_chance_points),
    fastbreak_points: seasonStatNum(persisted?.fastbreak_points),
    bench_points: seasonStatNum(persisted?.bench_points),
  };
}

/**
 * Team season averages: sum each game's team total, then divide by games in sample.
 * Not the sum of each player's individual per-game averages.
 */
export function aggregateTeamSeasonAverages(
  games: Game[] | undefined,
  team: Team
): AggregateTeamSeasonResult {
  const teamId = team.id;
  const rosterIds = new Set(team.players.map((p) => p.id));
  const empty = emptyTeamSeasonStatBucket();

  let totals = empty;
  let foulsDrawnTotal = 0;
  let gamesWithFoulsDrawnData = 0;
  let gamesInSample = 0;

  for (const game of games ?? []) {
    const contribution = teamGameSeasonContribution(game, teamId, rosterIds);
    if (!contribution) continue;

    gamesInSample++;
    totals = addTeamSeasonBuckets(totals, contribution);
    if (tournamentRecordsStat(game.tournamentId, 'fouls_drawn')) {
      foulsDrawnTotal += contribution.fouls_drawn;
      gamesWithFoulsDrawnData++;
    }
  }

  if (gamesInSample === 0) {
    return {
      gamesInSample: 0,
      totals: empty,
      perGame: empty,
      foulsDrawnTotal: 0,
      gamesWithFoulsDrawnData: 0,
    };
  }

  return {
    gamesInSample,
    totals,
    perGame: divideTeamSeasonBucket(totals, gamesInSample),
    foulsDrawnTotal,
    gamesWithFoulsDrawnData,
  };
}

/** PPG / PAPG from final scores for completed scoped games. */
export function computeScopedTeamScoring(
  games: Game[] | undefined,
  teamId: string
): { ppg: number; papg: number; gamesWithScore: number } {
  let pointsFor = 0;
  let pointsAgainst = 0;
  let gamesWithScore = 0;

  for (const game of games ?? []) {
    if (!game.isCompleted || !game.finalScore) continue;
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) continue;

    const isHome = game.homeTeamId === teamId;
    pointsFor += isHome ? game.finalScore.home : game.finalScore.away;
    pointsAgainst += isHome ? game.finalScore.away : game.finalScore.home;
    gamesWithScore++;
  }

  return {
    ppg: gamesWithScore > 0 ? pointsFor / gamesWithScore : 0,
    papg: gamesWithScore > 0 ? pointsAgainst / gamesWithScore : 0,
    gamesWithScore,
  };
}

function persistedAdvancedRecorded(value: number | null | undefined): boolean {
  return value != null && value > 0;
}

/** Whether any game in scope has team-level advanced stats on the persisted team line. */
export function getTeamAdvancedStatCoverage(
  games: Game[] | undefined,
  teamId: string
): TeamAdvancedStatCoverage {
  let gamesInScope = 0;
  let gamesWithPaint = 0;
  let gamesWithFastbreak = 0;
  let gamesWithSecondChance = 0;
  let gamesWithPointsOffTurnovers = 0;

  for (const game of games ?? []) {
    if (!game.isCompleted) continue;
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) continue;
    gamesInScope++;

    const persisted = getPersistedTeamStatsForTeam(game, teamId);
    if (!persisted) continue;

    if (persistedAdvancedRecorded(persisted.points_in_paint)) gamesWithPaint++;
    if (persistedAdvancedRecorded(persisted.fastbreak_points)) gamesWithFastbreak++;
    if (persistedAdvancedRecorded(persisted.second_chance_points)) {
      gamesWithSecondChance++;
    }
    if (persistedAdvancedRecorded(persisted.points_off_turnovers)) {
      gamesWithPointsOffTurnovers++;
    }
  }

  const hasAny =
    gamesWithPaint > 0 ||
    gamesWithFastbreak > 0 ||
    gamesWithSecondChance > 0 ||
    gamesWithPointsOffTurnovers > 0;

  return {
    gamesInScope,
    gamesWithPaint,
    gamesWithFastbreak,
    gamesWithSecondChance,
    gamesWithPointsOffTurnovers,
    hasAny,
  };
}

function safeTotal(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function computeTeamSeasonDerived(
  totals: TeamSeasonStatBucket,
  perGame: TeamSeasonStatBucket,
  scoring: { ppg: number; papg: number; gamesWithScore: number },
  fdpgSample?: { total: number; games: number }
): TeamSeasonDerivedStats {
  const fgMade = safeTotal(totals.fg_made);
  const fgAttempted = safeTotal(totals.fg_attempted);
  const threeMade = safeTotal(totals.three_made);
  const threeAttempted = safeTotal(totals.three_attempted);
  const ftAttempted = safeTotal(totals.ft_attempted);
  const boxScorePoints = safeTotal(totals.points);
  const finalScorePoints =
    scoring.gamesWithScore > 0 ? scoring.ppg * scoring.gamesWithScore : 0;
  const scoringPoints =
    finalScorePoints > 0 ? finalScorePoints : boxScorePoints;

  const twoMade = fgMade - threeMade;
  const twoAttempted = fgAttempted - threeAttempted;

  const efgPct =
    fgAttempted > 0
      ? ((fgMade + 0.5 * threeMade) / fgAttempted) * 100
      : null;

  const twoPtPct =
    twoAttempted > 0 ? (twoMade / twoAttempted) * 100 : null;

  const tsDenom = fgAttempted + 0.44 * ftAttempted;
  const tsPct =
    tsDenom > 0 && scoringPoints > 0
      ? (scoringPoints / (2 * tsDenom)) * 100
      : tsDenom > 0 && scoringPoints === 0
        ? 0
        : null;

  const astTo =
    totals.turnovers > 0
      ? totals.assists / totals.turnovers
      : totals.assists > 0
        ? totals.assists
        : null;

  return {
    ppg: scoring.ppg,
    papg: scoring.papg,
    gamesWithScore: scoring.gamesWithScore,
    efgPct,
    twoPtPct,
    tsPct,
    astTo,
    rpg: perGame.orb + perGame.drb,
    apg: perGame.assists,
    topg: perGame.turnovers,
    spg: perGame.steals,
    bpg: perGame.blocks,
    fpg: perGame.fouls,
    fdpg: perGameAverageOrNull(
      fdpgSample?.total ?? 0,
      fdpgSample?.games ?? 0
    ),
    paintPpg: perGame.points_in_paint,
    fastbreakPpg: perGame.fastbreak_points,
    secondChancePpg: perGame.second_chance_points,
    pointsOffTurnoversPpg: perGame.points_off_turnovers,
  };
}

export interface ResolvedTeamTotals {
  points: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  orb: number;
  drb: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fouls_drawn: number;
  minutes_played: number;
  scoreOnly: boolean;
}

export function teamHasPlayerBoxScore(game: Game, team: Team): boolean {
  if (!game.trackBothTeams && team.id !== game.homeTeamId) {
    return false;
  }
  return game.gameStats.some(
    (s) =>
      team.players.some((p) => p.id === s.playerId) &&
      resolvePlayerTeamSideInGame(s.playerId, game) === team.id &&
      (s.minutes_played > 0 || s.fg_attempted > 0 || s.points > 0)
  );
}

export function resolveTeamTotals(
  game: Game,
  side: TeamSide
): ResolvedTeamTotals {
  const team = getTeamForSide(game, side);
  const scoreOnly = isScoreOnlyTeam(game, side);
  const persisted = getPersistedTeamStats(game, side);
  const fromPlayers = sumPlayerStatsForTeam(game, team);

  if (scoreOnly) {
    return {
      points: resolveSideScore(game, side),
      fg_made: 0,
      fg_attempted: 0,
      three_made: 0,
      three_attempted: 0,
      ft_made: 0,
      ft_attempted: 0,
      orb: 0,
      drb: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      fouls_drawn: 0,
      minutes_played: 0,
      scoreOnly: true,
    };
  }

  // Player box score rows are the source of truth for sum-able team totals.
  if (teamHasPlayerBoxScore(game, team)) {
    return {
      points:
        fromPlayers.points > 0
          ? fromPlayers.points
          : resolveSideScore(game, side),
      fg_made: fromPlayers.fg_made,
      fg_attempted: fromPlayers.fg_attempted,
      three_made: fromPlayers.three_made,
      three_attempted: fromPlayers.three_attempted,
      ft_made: fromPlayers.ft_made,
      ft_attempted: fromPlayers.ft_attempted,
      orb: fromPlayers.orb,
      drb: fromPlayers.drb,
      assists: fromPlayers.assists,
      steals: fromPlayers.steals,
      blocks: fromPlayers.blocks,
      turnovers: fromPlayers.turnovers,
      fouls: fromPlayers.fouls,
      fouls_drawn: fromPlayers.fouls_drawn,
      minutes_played: fromPlayers.minutes_played,
      scoreOnly: false,
    };
  }

  if (!persisted) {
    return {
      points: fromPlayers.points,
      fg_made: fromPlayers.fg_made,
      fg_attempted: fromPlayers.fg_attempted,
      three_made: fromPlayers.three_made,
      three_attempted: fromPlayers.three_attempted,
      ft_made: fromPlayers.ft_made,
      ft_attempted: fromPlayers.ft_attempted,
      orb: fromPlayers.orb,
      drb: fromPlayers.drb,
      assists: fromPlayers.assists,
      steals: fromPlayers.steals,
      blocks: fromPlayers.blocks,
      turnovers: fromPlayers.turnovers,
      fouls: fromPlayers.fouls,
      fouls_drawn: fromPlayers.fouls_drawn,
      minutes_played: fromPlayers.minutes_played,
      scoreOnly: false,
    };
  }

  return {
    points: persisted.total_points,
    fg_made: persisted.fg_made ?? 0,
    fg_attempted: persisted.fg_attempted ?? 0,
    three_made: persisted.three_made ?? 0,
    three_attempted: persisted.three_attempted ?? 0,
    ft_made: persisted.ft_made ?? 0,
    ft_attempted: persisted.ft_attempted ?? 0,
    orb: persisted.orb ?? 0,
    drb: persisted.drb ?? 0,
    assists: persisted.assists ?? 0,
    steals: persisted.steals ?? 0,
    blocks: persisted.blocks ?? 0,
    turnovers: persisted.turnovers ?? 0,
    fouls: persisted.fouls ?? 0,
    fouls_drawn: 0,
    minutes_played: 0,
    scoreOnly: false,
  };
}

function leaderMetricValue(
  stat: GameStats,
  metric: GameLeaderMetric
): number {
  switch (metric) {
    case 'points':
      return stat.points;
    case 'assists':
      return stat.assists;
    case 'rebounds':
      return stat.orb + stat.drb;
    case 'efficiency':
      return MetricsCalculator.calculateAdvancedMetrics(stat).efficiency;
    default:
      return 0;
  }
}

export function getGameLeaders(
  game: Game,
  metric: GameLeaderMetric
): GameLeaderResult | null {
  const entries: {
    name: string;
    playerId: string;
    teamId: string;
    value: number;
  }[] = [];

  for (const team of [game.homeTeam, game.awayTeam]) {
    for (const player of getPlayersWhoPlayed(game, team)) {
      const stat = game.gameStats.find((s) => s.playerId === player.id);
      if (!stat) continue;
      entries.push({
        name: player.name,
        playerId: player.id,
        teamId: team.id,
        value: leaderMetricValue(stat, metric),
      });
    }
  }

  if (entries.length === 0) return null;

  const max = Math.max(...entries.map((e) => e.value));
  const leaders = entries
    .filter((e) => e.value === max)
    .map(({ name, playerId, teamId }) => ({ name, playerId, teamId }));
  const names = leaders.map((l) => l.name);
  return { value: max, names, leaders };
}

/** First token of display name � for compact chart axis labels. */
export function getPlayerFirstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Unknown';
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function formatGameLeader(
  result: GameLeaderResult | null,
  suffix: string,
  decimals = 0
): string {
  if (!result || result.names.length === 0) return '-';
  const value =
    decimals > 0 ? result.value.toFixed(decimals) : String(result.value);
  return `${result.names.join(', ')} (${value}${suffix})`;
}

export interface BoxScoreShootingTotals {
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
}

export function aggregateBoxScoreShooting(
  game: Game,
  options: {
    team?: TeamSide | 'both';
    playerId?: string;
  } = {}
): BoxScoreShootingTotals {
  const { team = 'both', playerId } = options;

  let stats: GameStats[] = game.gameStats;

  if (playerId) {
    stats = stats.filter((s) => s.playerId === playerId);
  } else if (team !== 'both') {
    const sideTeam = getTeamForSide(game, team);
    stats = stats.filter((s) =>
      sideTeam.players.some((p) => p.id === s.playerId)
    );
  }

  return stats.reduce(
    (acc, stat) => ({
      fg_made: acc.fg_made + stat.fg_made,
      fg_attempted: acc.fg_attempted + stat.fg_attempted,
      three_made: acc.three_made + stat.three_made,
      three_attempted: acc.three_attempted + stat.three_attempted,
    }),
    { fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0 }
  );
}

export function boxScoreShootingToDisplayStats(totals: BoxScoreShootingTotals) {
  const twoPointMade = totals.fg_made - totals.three_made;
  const twoPointAttempts = totals.fg_attempted - totals.three_attempted;

  return {
    totalShots: totals.fg_attempted,
    madeShots: totals.fg_made,
    overallPercentage:
      totals.fg_attempted > 0
        ? (totals.fg_made / totals.fg_attempted) * 100
        : 0,
    twoPointMade,
    twoPointAttempts,
    twoPointPercentage:
      twoPointAttempts > 0 ? (twoPointMade / twoPointAttempts) * 100 : 0,
    threePointMade: totals.three_made,
    threePointAttempts: totals.three_attempted,
    threePointPercentage:
      totals.three_attempted > 0
        ? (totals.three_made / totals.three_attempted) * 100
        : 0,
  };
}

export function gameHasShotChartData(game: Game): boolean {
  return game.shots.length > 0;
}

export interface PlayerPaintFastbreakStats {
  paintPoints: number | null;
  fastbreakPoints: number | null;
}

/** Per-player paint / fast-break points from shot chart; null when no shot data recorded. */
export function getPlayerPaintAndFastbreakPoints(
  game: Game,
  playerId: string
): PlayerPaintFastbreakStats {
  if (!gameHasShotChartData(game)) {
    return { paintPoints: null, fastbreakPoints: null };
  }

  let paintPoints = 0;
  let fastbreakPoints = 0;

  for (const shot of game.shots) {
    if (shot.playerId !== playerId || !shot.made) continue;
    const pts = shot.isThree ? 3 : 2;
    if (shot.inPaint) paintPoints += pts;
    if (shot.isTransition) fastbreakPoints += pts;
  }

  return { paintPoints, fastbreakPoints };
}

export function formatPlayerOptionalCount(value: number | null): string {
  if (value === null) return '-';
  return String(value);
}
