import type { Team, Tournament, Game, Player } from '../App';

export interface RosterViolation {
  violates: boolean;
  message?: string;
  playerId?: string;
  playerName?: string;
  conflictingTeamId?: string;
  conflictingTeamName?: string;
  tournamentId?: string;
  tournamentName?: string;
}

export function getTeamsForPlayer(playerId: string, teams: Team[]): Team[] {
  return teams.filter((team) =>
    (team.players ?? []).some((p) => p.id === playerId)
  );
}

export function getTournamentIdsForTeam(
  teamId: string,
  tournaments: Tournament[]
): string[] {
  return tournaments
    .filter((t) => (t.teams ?? []).includes(teamId))
    .map((t) => t.id);
}

export function getSharedTournamentIds(
  teamIdA: string,
  teamIdB: string,
  tournaments: Tournament[]
): string[] {
  const setA = new Set(getTournamentIdsForTeam(teamIdA, tournaments));
  return getTournamentIdsForTeam(teamIdB, tournaments).filter((id) =>
    setA.has(id)
  );
}

function tournamentName(tournaments: Tournament[], tournamentId: string): string {
  return tournaments.find((t) => t.id === tournamentId)?.name ?? tournamentId;
}

/** Block if player is already on another team that shares a tournament with targetTeam. */
export function wouldRosterViolateTournamentOverlap(
  playerId: string,
  targetTeamId: string,
  teams: Team[],
  tournaments: Tournament[]
): RosterViolation {
  const targetTeam = teams.find((t) => t.id === targetTeamId);
  const player =
    teams.flatMap((t) => t.players ?? []).find((p) => p.id === playerId) ??
    null;

  for (const otherTeam of getTeamsForPlayer(playerId, teams)) {
    if (otherTeam.id === targetTeamId) continue;

    const shared = getSharedTournamentIds(otherTeam.id, targetTeamId, tournaments);
    if (shared.length > 0) {
      const tid = shared[0];
      return {
        violates: true,
        playerId,
        playerName: player?.name,
        conflictingTeamId: otherTeam.id,
        conflictingTeamName: otherTeam.name,
        tournamentId: tid,
        tournamentName: tournamentName(tournaments, tid),
        message: `${player?.name ?? 'This player'} is already on ${otherTeam.name}, which shares ${tournamentName(tournaments, tid)} with ${targetTeam?.name ?? 'this team'}.`,
      };
    }
  }

  return { violates: false };
}

/** Block adding team to tournament if any rostered player is on another team in that tournament. */
export function wouldTournamentEnrollmentViolateOverlap(
  teamId: string,
  tournamentId: string,
  teams: Team[],
  tournaments: Tournament[]
): RosterViolation {
  const team = teams.find((t) => t.id === teamId);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!team || !tournament) return { violates: false };

  const existingTeamIds = (tournament.teams ?? []).filter((id) => id !== teamId);

  for (const player of team.players ?? []) {
    for (const otherTeamId of existingTeamIds) {
      const otherTeam = teams.find((t) => t.id === otherTeamId);
      if (!otherTeam?.players.some((p) => p.id === player.id)) continue;

      return {
        violates: true,
        playerId: player.id,
        playerName: player.name,
        conflictingTeamId: otherTeamId,
        conflictingTeamName: otherTeam.name,
        tournamentId,
        tournamentName: tournament.name,
        message: `${player.name} is on both ${team.name} and ${otherTeam.name}, which cannot share ${tournament.name}.`,
      };
    }
  }

  return { violates: false };
}

/** Validate roster changes when updating a team (new links only). */
export function validateTeamRosterUpdate(
  previousTeam: Team | undefined,
  nextTeam: Team,
  teams: Team[],
  tournaments: Tournament[]
): RosterViolation {
  const prevIds = new Set((previousTeam?.players ?? []).map((p) => p.id));
  const added = (nextTeam.players ?? []).filter((p) => !prevIds.has(p.id));

  for (const player of added) {
    const violation = wouldRosterViolateTournamentOverlap(
      player.id,
      nextTeam.id,
      teams,
      tournaments
    );
    if (violation.violates) return violation;
  }

  return { violates: false };
}

/** All unique players in the league (for existing-player picker). */
export function getLeaguePlayerPool(teams: Team[]): Array<{
  player: Player;
  teamIds: string[];
  teamNames: string[];
}> {
  const byId = new Map<
    string,
    { player: Player; teamIds: string[]; teamNames: string[] }
  >();

  for (const team of teams) {
    for (const player of team.players ?? []) {
      const existing = byId.get(player.id);
      if (existing) {
        existing.teamIds.push(team.id);
        existing.teamNames.push(team.name);
      } else {
        byId.set(player.id, {
          player,
          teamIds: [team.id],
          teamNames: [team.name],
        });
      }
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.player.name.localeCompare(b.player.name)
  );
}

export function isPlayerOnTeam(playerId: string, teamId: string, teams: Team[]): boolean {
  const team = teams.find((t) => t.id === teamId);
  return (team?.players ?? []).some((p) => p.id === playerId);
}

export function getPlayerRosterEntries(
  playerId: string,
  teams: Team[]
): Array<{ team: Team; player: Player }> {
  return getTeamsForPlayer(playerId, teams).map((team) => ({
    team,
    player: team.players.find((p) => p.id === playerId)!,
  }));
}

/** Which side the player was on for a completed game. */
export function resolvePlayerTeamInGame(
  playerId: string,
  game: Game,
  teams: Team[]
): Team | null {
  const teamIds = new Set(getTeamsForPlayer(playerId, teams).map((t) => t.id));
  if (teamIds.has(game.homeTeamId)) return game.homeTeam;
  if (teamIds.has(game.awayTeamId)) return game.awayTeam;
  return null;
}

export function resolvePlayerTeamIdForGames(
  playerId: string,
  scopedGames: Game[],
  teams: Team[]
): string | null {
  for (const game of scopedGames) {
    const team = resolvePlayerTeamInGame(playerId, game, teams);
    if (team) return team.id;
  }
  return null;
}
