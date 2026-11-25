import type { Game } from '../App';
import {
  fetchGamesPbpByIds,
  gameNeedsPbpHydration,
  mergeGamesPbp,
} from '../api/supabaseData';

/**
 * Lazy-load PBP for games that were bootstrapped without events/shots.
 * Calls onGamesUpdate when merge changes state. Returns merged list.
 */
export async function ensureGamesPbpHydrated(
  games: Game[],
  gameIds: string[],
  onGamesUpdate?: (games: Game[]) => void
): Promise<Game[]> {
  const need = [
    ...new Set(
      gameIds.filter((id) => {
        const g = games.find((x) => x.id === id);
        return !!g && gameNeedsPbpHydration(g);
      })
    ),
  ];
  if (need.length === 0) return games;

  const pbp = await fetchGamesPbpByIds(need);
  const next = mergeGamesPbp(games, pbp);
  if (next !== games) {
    onGamesUpdate?.(next);
  }
  return next;
}
