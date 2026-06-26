import type { Tournament } from '../App';

export type GameFormat = '5v5' | '3x3';
export type GameFormatScope = '5v5' | '3x3' | 'combined';

export const DEFAULT_GAME_FORMAT_SCOPE: GameFormatScope = '5v5';

/** Until `tournament.gameFormat` is stored in DB (Phase B). */
export const THREE_X_THREE_TOURNAMENT_IDS = new Set([
  'tournament-1782412204083', // AUSF 3x3 2026
]);

export function getTournamentGameFormat(
  tournamentId: string | undefined | null,
  tournament?: Pick<Tournament, 'id' | 'gameFormat'> | null
): GameFormat {
  if (tournament?.gameFormat) return tournament.gameFormat;
  if (tournamentId && THREE_X_THREE_TOURNAMENT_IDS.has(tournamentId)) return '3x3';
  return '5v5';
}

export function parseGameFormatScope(raw: string | null | undefined): GameFormatScope {
  if (raw === '3x3' || raw === 'combined') return raw;
  return DEFAULT_GAME_FORMAT_SCOPE;
}

export function filterGamesByFormatScope<T extends { tournamentId?: string }>(
  games: T[] | undefined,
  scope: GameFormatScope,
  tournaments?: Tournament[]
): T[] {
  const list = games ?? [];
  if (scope === 'combined') return list;

  const tournamentById = new Map((tournaments ?? []).map((t) => [t.id, t]));

  return list.filter((game) => {
    const tournament = game.tournamentId
      ? tournamentById.get(game.tournamentId)
      : undefined;
    return getTournamentGameFormat(game.tournamentId, tournament) === scope;
  });
}

export function filterTournamentsByFormatScope(
  tournaments: Tournament[],
  scope: GameFormatScope
): Tournament[] {
  if (scope === 'combined') return tournaments;
  return tournaments.filter((t) => getTournamentGameFormat(t.id, t) === scope);
}

export function allTimeScopeLabel(scope: GameFormatScope): string {
  if (scope === 'combined') return 'All Time';
  if (scope === '3x3') return 'All Time (3×3)';
  return 'All Time (5v5)';
}

export function gameFormatScopeUsesCombinedWarning(scope: GameFormatScope): boolean {
  return scope === 'combined';
}

export function gameFormatScopeLabel(scope: GameFormatScope): string {
  if (scope === '3x3') return '3×3';
  if (scope === 'combined') return 'Combined';
  return '5v5';
}
