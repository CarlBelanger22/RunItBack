import type { Game, GameStats, Player, Team, TeamStats } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';

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

export interface GameLeaderResult {
  value: number;
  names: string[];
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

/** True when a side has no player box score rows but a team/final score exists (e.g. SUTD). */
export function isScoreOnlyTeam(game: Game, side: TeamSide): boolean {
  const team = getTeamForSide(game, side);
  const hasPlayerBoxScore = game.gameStats.some((s) =>
    team.players.some((p) => p.id === s.playerId)
  );
  if (hasPlayerBoxScore) return false;

  const persisted = getPersistedTeamStats(game, side);
  const fromFinal = game.finalScore?.[side] ?? 0;
  return (persisted?.total_points ?? 0) > 0 || fromFinal > 0;
}

export function hasAwayTeamContent(game: Game): boolean {
  return game.awayTeam.players.length > 0 || isScoreOnlyTeam(game, 'away');
}

export function playerPlayedInGame(game: Game, playerId: string): boolean {
  const stat = game.gameStats.find((s) => s.playerId === playerId);
  return (stat?.minutes_played ?? 0) > 0;
}

export function getPlayersWhoPlayed(game: Game, team: Team): Player[] {
  return team.players.filter((p) => playerPlayedInGame(game, p.id));
}

export function resolveSideScore(game: Game, side: TeamSide): number {
  const team = getTeamForSide(game, side);
  const fromPlayers = game.gameStats
    .filter((s) => team.players.some((p) => p.id === s.playerId))
    .reduce((sum, s) => sum + s.points, 0);
  if (fromPlayers > 0) return fromPlayers;

  const persisted = getPersistedTeamStats(game, side);
  if (persisted?.total_points != null && persisted.total_points > 0) {
    return persisted.total_points;
  }

  return game.finalScore?.[side] ?? 0;
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

export function sumPlayerStatsForTeam(
  game: Game,
  team: Team
): GameStats {
  const empty = MetricsCalculator.getEmptyStats('team-sum');
  return game.gameStats
    .filter((s) => team.players.some((p) => p.id === s.playerId))
    .reduce(
      (acc, stat) => ({
        ...acc,
        points: acc.points + stat.points,
        fg_made: acc.fg_made + stat.fg_made,
        fg_attempted: acc.fg_attempted + stat.fg_attempted,
        three_made: acc.three_made + stat.three_made,
        three_attempted: acc.three_attempted + stat.three_attempted,
        ft_made: acc.ft_made + stat.ft_made,
        ft_attempted: acc.ft_attempted + stat.ft_attempted,
        orb: acc.orb + stat.orb,
        drb: acc.drb + stat.drb,
        assists: acc.assists + stat.assists,
        steals: acc.steals + stat.steals,
        blocks: acc.blocks + stat.blocks,
        turnovers: acc.turnovers + stat.turnovers,
        fouls: acc.fouls + stat.fouls,
        tech_fouls: acc.tech_fouls + stat.tech_fouls,
        unsportsmanlike_fouls:
          acc.unsportsmanlike_fouls + stat.unsportsmanlike_fouls,
        fouls_drawn: acc.fouls_drawn + stat.fouls_drawn,
        blocks_received: acc.blocks_received + stat.blocks_received,
        plus_minus: acc.plus_minus + stat.plus_minus,
        minutes_played: acc.minutes_played + stat.minutes_played,
      }),
      empty
    );
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
  return game.gameStats.some(
    (s) =>
      team.players.some((p) => p.id === s.playerId) &&
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
  const entries: { name: string; value: number }[] = [];

  for (const team of [game.homeTeam, game.awayTeam]) {
    for (const player of getPlayersWhoPlayed(game, team)) {
      const stat = game.gameStats.find((s) => s.playerId === player.id);
      if (!stat) continue;
      entries.push({
        name: player.name,
        value: leaderMetricValue(stat, metric),
      });
    }
  }

  if (entries.length === 0) return null;

  const max = Math.max(...entries.map((e) => e.value));
  const names = entries.filter((e) => e.value === max).map((e) => e.name);
  return { value: max, names };
}

/** First token of display name  for compact chart axis labels. */
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
