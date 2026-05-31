import type { Game, Tournament } from '../App';
import { sortTournamentsByDateDesc } from './tournamentSort';

export function getParticipatedTournamentIds(
  teamId: string,
  games: Game[] | undefined,
  tournaments: Tournament[] | undefined
): string[] {
  const ids = new Set<string>();

  for (const game of games ?? []) {
    if (
      game.tournamentId &&
      (game.homeTeamId === teamId || game.awayTeamId === teamId)
    ) {
      ids.add(game.tournamentId);
    }
  }

  for (const tournament of tournaments ?? []) {
    if ((tournament.teams ?? []).includes(teamId)) {
      ids.add(tournament.id);
    }
  }

  return [...ids].sort();
}

export function getParticipatedTournaments(
  teamId: string,
  games: Game[] | undefined,
  tournaments: Tournament[] | undefined
): Tournament[] {
  const list = getParticipatedTournamentIds(teamId, games, tournaments)
    .map((id) => (tournaments ?? []).find((t) => t.id === id))
    .filter((t): t is Tournament => t != null);

  return sortTournamentsByDateDesc(list);
}

export function getPlayerParticipatedTournamentIds(
  playerId: string,
  games: Game[] | undefined
): string[] {
  const ids = new Set<string>();

  for (const game of games ?? []) {
    if (!game.isCompleted || !game.tournamentId) continue;
    if ((game.gameStats ?? []).some((stat) => stat.playerId === playerId)) {
      ids.add(game.tournamentId);
    }
  }

  return [...ids].sort();
}

export function getPlayerParticipatedTournaments(
  playerId: string,
  games: Game[] | undefined,
  tournaments: Tournament[] | undefined
): Tournament[] {
  const list = getPlayerParticipatedTournamentIds(playerId, games)
    .map((id) => (tournaments ?? []).find((t) => t.id === id))
    .filter((t): t is Tournament => t != null);

  return sortTournamentsByDateDesc(list);
}
