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

/** True when stats rows exist but every counting field is zero (snapshot placeholder). */
export function isRosterOnlyPlaceholderGame(game: Game): boolean {
  const stats = game.gameStats ?? [];
  if (stats.length === 0) return false;
  return !gameStatsHaveBoxScoreData(stats);
}

export function shouldPreserveExistingGameStats(
  incoming: Game,
  existingStats: GameStats[] | undefined
): boolean {
  if (!isRosterOnlyPlaceholderGame(incoming)) return false;
  return gameStatsHaveBoxScoreData(existingStats);
}
