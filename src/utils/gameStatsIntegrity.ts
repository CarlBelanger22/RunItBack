import type { Game, GameStats } from '../App';

const COUNTING_KEYS: (keyof GameStats)[] = [
  'points',
  'fg_made',
  'fg_attempted',
  'three_made',
  'three_attempted',
  'ft_made',
  'ft_attempted',
  'orb',
  'drb',
  'assists',
  'steals',
  'blocks',
  'turnovers',
  'fouls',
  'minutes_played',
];

export function gameStatsRowHasBoxScoreData(stat: GameStats): boolean {
  return COUNTING_KEYS.some((key) => (stat[key] as number) > 0);
}

export function gameStatsHaveBoxScoreData(stats: GameStats[] | undefined): boolean {
  return (stats ?? []).some(gameStatsRowHasBoxScoreData);
}

export function gameStatsHaveMinutes(stats: GameStats[] | undefined): boolean {
  return (stats ?? []).some((stat) => (stat.minutes_played ?? 0) > 0);
}

/** True when stats rows exist but every counting field is zero (snapshot placeholder). */
export function isRosterOnlyPlaceholderGame(game: Game): boolean {
  const stats = game.gameStats ?? [];
  if (stats.length === 0) return false;
  return !gameStatsHaveBoxScoreData(stats);
}

/**
 * Keep DB box scores when a client snapshot would wipe them.
 * Covers (1) roster-only placeholders and (2) real boxes that lost minutes
 * (e.g. stale local completed-game cache after a minutes backfill).
 */
export function shouldPreserveExistingGameStats(
  incoming: Game,
  existingStats: GameStats[] | undefined
): boolean {
  if (!gameStatsHaveBoxScoreData(existingStats)) return false;

  if (isRosterOnlyPlaceholderGame(incoming)) return true;

  const incomingStats = incoming.gameStats ?? [];
  if (
    gameStatsHaveBoxScoreData(incomingStats) &&
    !gameStatsHaveMinutes(incomingStats) &&
    gameStatsHaveMinutes(existingStats)
  ) {
    return true;
  }

  return false;
}
