/**
 * Live + paused tracking sessions for the stats-entry page.
 */

import type { Game } from '../App';
import { isGameInProgress, isGamePaused } from './activeGame';
import { sortGamesByDateDesc } from './gameDisplay';

/** Mid-session games that should appear above GameSetup on /stats-entry. */
export function listStatsEntrySessions(games: Game[]): Game[] {
  const sessions = games.filter(
    (game) => isGameInProgress(game) || isGamePaused(game)
  );
  // Live first, then paused; within each group newest tip/date first.
  const live = sortGamesByDateDesc(sessions.filter(isGameInProgress));
  const paused = sortGamesByDateDesc(sessions.filter(isGamePaused));
  return [...live, ...paused];
}
