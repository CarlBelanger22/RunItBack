/** Stats tracked only in some tournaments (Easy Stats / legacy imports use 0 placeholders). */

export type TournamentScopedStat = 'fouls_drawn' | 'plus_minus';

/** Tournaments where FDPG and +/- were not on source box scores. */
export const TOURNAMENTS_WITHOUT_FOULS_DRAWN_AND_PLUS_MINUS = new Set([
  'tournament-1780251377063', // NBL Div 2 2024
  'tournament-1780333884144', // Gemilang Cup U21
  'tournament-1780425044074', // NBL Div 2 2023
  'tournament-1780771500232', // Shenggong Cup 2019
  'tournament-1781859881010', // NSG A Division 2019
  'tournament-1782331320905', // NSG B Division 2018
  'tournament-1782412204083', // AUSF 3x3 2026 (+/- unreliable in CSV)
]);

export function tournamentRecordsStat(
  tournamentId: string | undefined,
  stat: TournamentScopedStat
): boolean {
  if (stat !== 'fouls_drawn' && stat !== 'plus_minus') return true;
  if (!tournamentId) return true;
  return !TOURNAMENTS_WITHOUT_FOULS_DRAWN_AND_PLUS_MINUS.has(tournamentId);
}

/**
 * Per-game stat coverage. The tournament-level flag only reflects what legacy
 * CSV imports captured; a game entered live in that same tournament tracks
 * everything natively. A non-empty event log means the game was entered live
 * (all import builders set `events: []`), so it always records these stats.
 */
export function gameRecordsStat(
  game: { tournamentId?: string; events?: unknown[] } | null | undefined,
  stat: TournamentScopedStat
): boolean {
  if (!game) return true;
  if ((game.events?.length ?? 0) > 0) return true;
  return tournamentRecordsStat(game.tournamentId, stat);
}

export function perGameAverageOrNull(total: number, games: number): number | null {
  return games > 0 ? total / games : null;
}
