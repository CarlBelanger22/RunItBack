import type { Game, Tournament } from '../App';
import { getIdCreatedAtMs, getPlayerLastGameMs } from './playerParticipationSort';
import { getTournamentDateMs, sortTournamentsByDateDesc } from './tournamentSort';

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

  return [...ids];
}

function sortPlayerTournamentsByRecencyDesc(
  playerId: string,
  tournaments: Tournament[],
  games: Game[] | undefined
): Tournament[] {
  return [...tournaments].sort((a, b) => {
    const dateDiff =
      getPlayerLastGameMs(playerId, games, (game) => game.tournamentId === b.id) -
      getPlayerLastGameMs(playerId, games, (game) => game.tournamentId === a.id);
    if (dateDiff !== 0) return dateDiff;

    const seasonDiff = getTournamentDateMs(b) - getTournamentDateMs(a);
    if (seasonDiff !== 0) return seasonDiff;

    const createdDiff = getIdCreatedAtMs(b) - getIdCreatedAtMs(a);
    if (createdDiff !== 0) return createdDiff;

    return a.name.localeCompare(b.name);
  });
}

export function getPlayerParticipatedTournaments(
  playerId: string,
  games: Game[] | undefined,
  tournaments: Tournament[] | undefined
): Tournament[] {
  const ids = new Set(getPlayerParticipatedTournamentIds(playerId, games));
  const list = [...ids]
    .map((id) => (tournaments ?? []).find((t) => t.id === id))
    .filter((t): t is Tournament => t != null);

  return sortPlayerTournamentsByRecencyDesc(playerId, list, games);
}
