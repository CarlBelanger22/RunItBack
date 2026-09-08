import type { Game } from '../App';

/**
 * When persisting games, a completed row must not be replaced by an older
 * still-active snapshot of the same id (stale live save / in-flight race).
 */
export function mergeGamesPreferCompleted(...lists: Game[][]): Game[] {
  const byId = new Map<string, Game>();

  const consider = (game: Game) => {
    const existing = byId.get(game.id);
    if (!existing) {
      byId.set(game.id, game);
      return;
    }
    const existingDone = Boolean(existing.isCompleted);
    const incomingDone = Boolean(game.isCompleted);
    if (existingDone && !incomingDone) return;
    if (!existingDone && incomingDone) {
      byId.set(game.id, game);
      return;
    }
    byId.set(game.id, game);
  };

  for (const list of lists) {
    for (const g of list) consider(g);
  }
  return [...byId.values()];
}

/** Build the completed game payload used by End Game / Complete game. */
export function buildCompletedGamePayload(
  game: Game,
  finalScore: { home: number; away: number }
): Game {
  return {
    ...game,
    isActive: false,
    isCompleted: true,
    currentPeriod: game.currentPeriod || 4,
    currentGameTime: game.currentGameTime || '00:00',
    finalScore,
  };
}

export function finalScoreFromPlayerPoints(game: Game): {
  home: number;
  away: number;
} {
  const homeIds = new Set(game.homeTeam.players.map((p) => p.id));
  const awayIds = new Set(game.awayTeam.players.map((p) => p.id));
  let home = 0;
  let away = 0;
  for (const s of game.gameStats ?? []) {
    if (homeIds.has(s.playerId)) home += s.points;
    else if (awayIds.has(s.playerId)) away += s.points;
  }
  return { home, away };
}
