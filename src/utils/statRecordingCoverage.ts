/** Stats tracked only in some tournaments (Easy Stats / legacy imports use 0 placeholders). */

export type TournamentScopedStat = 'fouls_drawn' | 'plus_minus';

/** Tournaments where FDPG and +/- were not on source box scores. */
export const TOURNAMENTS_WITHOUT_FOULS_DRAWN_AND_PLUS_MINUS = new Set([
  'tournament-1780251377063', // NBL Div 2 2024
  'tournament-1780333884144', // Gemilang Cup U21
  'tournament-1780425044074', // NBL Div 2 2023
]);

export function tournamentRecordsStat(
  tournamentId: string | undefined,
  stat: TournamentScopedStat
): boolean {
  if (stat !== 'fouls_drawn' && stat !== 'plus_minus') return true;
  if (!tournamentId) return true;
  return !TOURNAMENTS_WITHOUT_FOULS_DRAWN_AND_PLUS_MINUS.has(tournamentId);
}

export function perGameAverageOrNull(total: number, games: number): number | null {
  return games > 0 ? total / games : null;
}
