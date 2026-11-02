/**
 * Live-entry cloud persist policy: while a live/paused session exists,
 * autosave only those game rows — never the full league dump.
 */
import type { Game } from '../App';
import { shouldPersistLiveSession } from '../utils/activeGame';
import { withRicherPbp } from '../utils/gamePbpPreserve';

/** Match prior full-save debounce; human locked default 2026-11-03. */
export const LIVE_GAME_CLOUD_SAVE_DEBOUNCE_MS = 500;

export function hasLiveSessionGames(games: readonly Game[]): boolean {
  return games.some((g) => shouldPersistLiveSession(g));
}

export function liveGamesToPersist(games: readonly Game[]): Game[] {
  return games.filter((g) => shouldPersistLiveSession(g));
}

export type LiveCloudSaveMode = 'live-game-only' | 'full-or-rosters' | 'skip';

/**
 * Decide autosave mode for a dirty check.
 * - Live + games dirty → single-game upserts only
 * - Live + only non-game dirty → skip (defer until live ends)
 * - No live → caller uses existing full / rosters-only path
 */
export function resolveLiveCloudSaveMode(input: {
  games: readonly Game[];
  gamesChanged: boolean;
  nonGameChanged: boolean;
}): LiveCloudSaveMode {
  const live = hasLiveSessionGames(input.games);
  if (!live) {
    return input.gamesChanged || input.nonGameChanged
      ? 'full-or-rosters'
      : 'skip';
  }
  if (input.gamesChanged) return 'live-game-only';
  return 'skip';
}

/** Prefer in-memory live overlay when merging for a single-game upsert. */
export function pickFreshestLiveGame(
  gameId: string,
  games: readonly Game[],
  liveOverlay: Game | null | undefined
): Game | undefined {
  const fromList = games.find((g) => g.id === gameId);
  if (liveOverlay?.id === gameId) {
    if (!fromList) return liveOverlay;
    return withRicherPbp(liveOverlay, fromList);
  }
  return fromList;
}
