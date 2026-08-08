/**
 * LE-116 — Pick which game to use when the same two teams met more than once.
 * Group RR prefers earliest; classification/KO prefers latest.
 */

import type { Game } from '../App';

export type MatchupDatePrefer = 'earliest' | 'latest';

function gameHasTeams(game: Game, a: string, b: string): boolean {
  const ids = new Set([game.homeTeamId, game.awayTeamId]);
  return ids.has(a) && ids.has(b);
}

/** Stable date compare (ISO date strings or timestamps). */
export function compareGamesByDate(a: Game, b: Game): number {
  const da = a.date ?? '';
  const db = b.date ?? '';
  if (da !== db) return da.localeCompare(db);
  return a.id.localeCompare(b.id);
}

/**
 * Among games featuring both teams, pick earliest or latest by date.
 * `excludeIds` skips already-linked games.
 */
export function pickGameForMatchup(
  games: Game[],
  teamA: string,
  teamB: string,
  prefer: MatchupDatePrefer,
  excludeIds?: Set<string>
): Game | undefined {
  const candidates = games.filter(
    (g) =>
      gameHasTeams(g, teamA, teamB) &&
      !(excludeIds && excludeIds.has(g.id))
  );
  if (candidates.length === 0) return undefined;
  const sorted = [...candidates].sort(compareGamesByDate);
  return prefer === 'earliest' ? sorted[0] : sorted[sorted.length - 1];
}

/** All H2Hs between two teams, oldest → newest. */
export function matchupGamesSorted(
  games: Game[],
  teamA: string,
  teamB: string
): Game[] {
  return games
    .filter((g) => gameHasTeams(g, teamA, teamB))
    .sort(compareGamesByDate);
}

/**
 * Pair key for unordered matchup (team ids sorted).
 */
export function matchupPairKey(teamA: string, teamB: string): string {
  return teamA < teamB ? `${teamA}|${teamB}` : `${teamB}|${teamA}`;
}
