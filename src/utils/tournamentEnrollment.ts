import type { Game, Team, Tournament } from '../App';

/** Tournament team enrollment helpers (import + runtime reconcile). */

export function buildTournamentTeamEnrollmentIds(
  teamIds: string[],
  homeTeamId: string | undefined,
  awayTeamId: string | undefined
): string[] {
  return [
    ...new Set(
      [...teamIds, homeTeamId, awayTeamId].filter((id): id is string => Boolean(id))
    ),
  ];
}

export function buildTournamentTeamRows(
  tournamentId: string,
  teamIds: string[],
  homeTeamId: string | undefined,
  awayTeamId: string | undefined
): Array<{ tournament_id: string; team_id: string }> {
  return buildTournamentTeamEnrollmentIds(teamIds, homeTeamId, awayTeamId).map(
    (team_id) => ({
      tournament_id: tournamentId,
      team_id,
    })
  );
}

function gameBelongsToTournament(game: Game, tournamentId: string): boolean {
  return game.tournamentId === tournamentId;
}

/** Union of enrolled teams and every home/away team that played in the tournament. */
export function tournamentTeamIdsFromGames(
  tournamentId: string,
  games: Game[],
  existingTeamIds: string[] = []
): string[] {
  const ids = new Set(existingTeamIds);
  for (const game of games) {
    if (!gameBelongsToTournament(game, tournamentId)) continue;
    const homeId = game.homeTeamId || game.homeTeam?.id;
    const awayId = game.awayTeamId || game.awayTeam?.id;
    if (homeId) ids.add(homeId);
    if (awayId) ids.add(awayId);
  }
  return [...ids];
}

export function tournamentGameIdsFromGames(
  tournamentId: string,
  games: Game[]
): string[] {
  return games
    .filter((game) => gameBelongsToTournament(game, tournamentId))
    .map((game) => game.id);
}

/** Keep denormalized tournament.teams / tournament.games aligned with games table. */
export function reconcileTournamentsFromGames(
  tournaments: Tournament[],
  games: Game[]
): Tournament[] {
  return tournaments.map((tournament) => {
    const teams = tournamentTeamIdsFromGames(
      tournament.id,
      games,
      tournament.teams ?? []
    );
    const tournamentGameIds = tournamentGameIdsFromGames(tournament.id, games);
    return {
      ...tournament,
      teams,
      games: tournamentGameIds,
    };
  });
}

export function filterGamesForTournament(
  tournament: Pick<Tournament, 'id' | 'games'>,
  games: Game[]
): Game[] {
  const idSet = new Set(tournament.games ?? []);
  return games.filter(
    (game) => game.tournamentId === tournament.id || idSet.has(game.id)
  );
}

export function filterTeamsForTournament(
  tournament: Pick<Tournament, 'id' | 'teams'>,
  games: Game[],
  teams: Team[]
): Team[] {
  const enrolled = new Set(
    tournamentTeamIdsFromGames(tournament.id, games, tournament.teams ?? [])
  );
  return teams.filter((team) => enrolled.has(team.id));
}
