import type { Game, Team } from '../App';

/**
 * Resolve the current team record for a game side.
 * Games store a snapshot of homeTeam/awayTeam at import or save time; the teams
 * array is updated when logos change. Prefer live teams for display (icon, name).
 */
export function resolveGameTeam(
  teams: Team[],
  game: Game,
  side: 'home' | 'away'
): Team {
  const id = side === 'home' ? game.homeTeamId : game.awayTeamId;
  const live = teams.find((t) => t.id === id);
  const snapshot = side === 'home' ? game.homeTeam : game.awayTeam;
  if (!live) return snapshot;
  if ((live.players?.length ?? 0) === 0 && (snapshot.players?.length ?? 0) > 0) {
    return { ...live, players: snapshot.players };
  }
  return live;
}
