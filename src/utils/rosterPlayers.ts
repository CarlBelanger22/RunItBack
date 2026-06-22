import type { Team, Tournament, Game, Player } from '../App';
import { getIdCreatedAtMs, getPlayerLastGameMs } from './playerParticipationSort';

/** One roster row per player id (last entry wins). */
export function dedupeTeamPlayers(players: Player[]): Player[] {
  const byId = new Map<string, Player>();
  for (const player of players) {
    const existing = byId.get(player.id);
    byId.set(player.id, existing ? { ...existing, ...player } : player);
  }
  return Array.from(byId.values());
}

/** One team per id; merges duplicate team rows and dedupes rosters. */
export function dedupeTeamsById(teams: Team[]): Team[] {
  const byId = new Map<string, Team>();
  for (const team of teams) {
    const players = dedupeTeamPlayers(team.players ?? []);
    const existing = byId.get(team.id);
    if (!existing) {
      byId.set(team.id, { ...team, players });
      continue;
    }
    byId.set(team.id, {
      ...existing,
      ...team,
      players: dedupeTeamPlayers([...(existing.players ?? []), ...players]),
    });
  }
  return Array.from(byId.values());
}

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
  return dedupeTeamsById(teams).filter((team) =>
    (team.players ?? []).some((p) => p.id === playerId)
  );
}

/** Latest game with this team first; ties by team createdAt then name. */
export function sortPlayerTeamsByRecencyDesc(
  playerId: string,
  teams: Team[],
  games: Game[] | undefined
): Team[] {
  return [...getTeamsForPlayer(playerId, teams)].sort((a, b) => {
    const dateDiff =
      getPlayerLastGameMs(playerId, games, (game) =>
        game.homeTeamId === b.id || game.awayTeamId === b.id
      ) -
      getPlayerLastGameMs(playerId, games, (game) =>
        game.homeTeamId === a.id || game.awayTeamId === a.id
      );
    if (dateDiff !== 0) return dateDiff;

    const createdDiff = getIdCreatedAtMs(b) - getIdCreatedAtMs(a);
    if (createdDiff !== 0) return createdDiff;

    return a.name.localeCompare(b.name);
  });
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

/** @deprecated Club-template check � use tournament_rosters overlap instead. */
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
  _previousTeam: Team | undefined,
  _nextTeam: Team,
  _teams: Team[],
  _tournaments: Tournament[]
): RosterViolation {
  // Club template allows multi-team links; tournament overlap is enforced on
  // tournament_rosters (see Tournament-Scoped Rosters plan), not here.
  return { violates: false };
}

/** All unique players in the league (for existing-player picker). */
export function getLeaguePlayerPool(
  teams: Team[],
  orphanPlayers: Player[] = []
): Array<{
  player: Player;
  teamIds: string[];
  teamNames: string[];
}> {
  const byId = new Map<
    string,
    { player: Player; teamIds: string[]; teamNames: string[] }
  >();

  for (const team of dedupeTeamsById(teams)) {
    for (const player of dedupeTeamPlayers(team.players ?? [])) {
      const existing = byId.get(player.id);
      if (existing) {
        if (!existing.teamIds.includes(team.id)) {
          existing.teamIds.push(team.id);
          existing.teamNames.push(team.name);
        }
      } else {
        byId.set(player.id, {
          player,
          teamIds: [team.id],
          teamNames: [team.name],
        });
      }
    }
  }

  for (const player of orphanPlayers) {
    if (byId.has(player.id)) continue;
    byId.set(player.id, {
      player,
      teamIds: [],
      teamNames: ['No team'],
    });
  }

  return [...byId.values()].sort((a, b) =>
    a.player.name.localeCompare(b.player.name)
  );
}

function playerMatchesSearchQuery(player: Player, query: string): boolean {
  const q = query.toLowerCase();
  return (
    player.name.toLowerCase().includes(q) ||
    String(player.number).includes(q) ||
    (player.position ?? '').toLowerCase().includes(q)
  );
}

/** Dashboard search: one row per player profile, all teams in subtitle. */
export function searchLeaguePlayers(
  teams: Team[],
  query: string,
  options?: { limit?: number; orphanPlayers?: Player[] }
): Array<{ player: Player; teamNames: string[] }> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = options?.limit ?? 5;
  const pool = getLeaguePlayerPool(teams, options?.orphanPlayers ?? []);

  return pool
    .filter(({ player }) => playerMatchesSearchQuery(player, trimmed))
    .slice(0, limit)
    .map(({ player, teamNames }) => ({ player, teamNames }));
}

export function isPlayerOnTeam(playerId: string, teamId: string, teams: Team[]): boolean {
  const team = teams.find((t) => t.id === teamId);
  return (team?.players ?? []).some((p) => p.id === playerId);
}

export function getPlayerRosterEntries(
  playerId: string,
  teams: Team[],
  games?: Game[]
): Array<{ team: Team; player: Player }> {
  const orderedTeams = games
    ? sortPlayerTeamsByRecencyDesc(playerId, teams, games)
    : getTeamsForPlayer(playerId, teams);

  return orderedTeams.map((team) => ({
    team,
    player: dedupeTeamPlayers(team.players ?? []).find((p) => p.id === playerId)!,
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
