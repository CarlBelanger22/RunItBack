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

export type PickGameForMatchupOptions = {
  /**
   * When set, only games on this calendar day (YYYY-MM-DD) are eligible.
   * Used so a knockout slot with a tip date does not absorb an earlier RR rematch.
   */
  onDate?: string | null;
};

function sameCalendarDay(gameDate: string | undefined, onDate: string): boolean {
  const g = (gameDate ?? '').slice(0, 10);
  const d = onDate.slice(0, 10);
  return g.length === 10 && d.length === 10 && g === d;
}

/**
 * Among games featuring both teams, pick earliest or latest by date.
 * `excludeIds` skips already-linked games.
 * Optional `onDate` restricts to that scheduled day (KO / fixture tips).
 */
export function pickGameForMatchup(
  games: Game[],
  teamA: string,
  teamB: string,
  prefer: MatchupDatePrefer,
  excludeIds?: Set<string>,
  options?: PickGameForMatchupOptions
): Game | undefined {
  const onDate = options?.onDate ? options.onDate.slice(0, 10) : null;
  const candidates = games.filter(
    (g) =>
      gameHasTeams(g, teamA, teamB) &&
      !(excludeIds && excludeIds.has(g.id)) &&
      (!onDate || sameCalendarDay(g.date, onDate))
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
