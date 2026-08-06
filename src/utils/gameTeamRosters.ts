import type { Game, Player, Team } from '../App';
import { dedupeTeamPlayers } from './rosterPlayers';
import {
  getPlayersForTeamInTournament,
  resolvePlayerTeamSideInGame,
  type TournamentRosterEntry,
} from './tournamentRosters';
import { isFriendlyGame } from './friendlyGame';

function sortPlayersByNumber(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) => a.number - b.number || a.name.localeCompare(b.name)
  );
}

function buildClubRosterByTeam(teams: Team[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const team of teams) {
    map.set(team.id, new Set((team.players ?? []).map((p) => p.id)));
  }
  return map;
}

function lookupPlayerTemplate(
  playerId: string,
  teamId: string,
  teams: Team[],
  embeddedTeam: Team
): Player | null {
  const fromClub = teams.find((t) => t.id === teamId)?.players.find((p) => p.id === playerId);
  if (fromClub) return { ...fromClub };
  const fromEmbedded = embeddedTeam.players?.find((p) => p.id === playerId);
  if (fromEmbedded) return { ...fromEmbedded };
  return null;
}

/** Player ids that have appeared for a team in this game (stats, events, starters). */
export function collectParticipantPlayerIdsForTeam(
  game: Game,
  teamId: string,
  teams: Team[]
): string[] {
  const clubRosterByTeam = buildClubRosterByTeam(teams);
  const ids = new Set<string>();

  const addIfOnTeam = (playerId: string | undefined) => {
    if (!playerId) return;
    if (resolvePlayerTeamSideInGame(playerId, game, clubRosterByTeam) === teamId) {
      ids.add(playerId);
    }
  };

  const starters =
    teamId === game.homeTeamId ? game.homeStarters : game.awayStarters;
  for (const id of starters ?? []) addIfOnTeam(id);

  for (const stat of game.gameStats ?? []) addIfOnTeam(stat.playerId);

  for (const event of game.events ?? []) {
    addIfOnTeam(event.playerId);
    const details = event.details as Record<string, unknown>;
    addIfOnTeam(details.drawnBy as string | undefined);
    addIfOnTeam(details.stealPlayerId as string | undefined);
    addIfOnTeam(details.turnoverPlayerId as string | undefined);
  }

  return [...ids];
}

function resolveSidePlayers(
  game: Game,
  side: 'home' | 'away',
  teams: Team[],
  tournamentRosters: TournamentRosterEntry[]
): Player[] {
  const teamId = side === 'home' ? game.homeTeamId : game.awayTeamId;
  const embedded = side === 'home' ? game.homeTeam : game.awayTeam;
  const club = teams.find((t) => t.id === teamId);
  const clubCount = club?.players?.length ?? 0;
  const participants = collectParticipantPlayerIdsForTeam(game, teamId, teams);

  if (game.tournamentId && tournamentRosters.length > 0) {
    const tournamentPlayers = getPlayersForTeamInTournament(
      teamId,
      game.tournamentId,
      teams,
      tournamentRosters
    );
    if (tournamentPlayers.length > 0) {
      const byId = new Map(tournamentPlayers.map((p) => [p.id, p]));
      for (const id of participants) {
        if (!byId.has(id)) {
          const extra = lookupPlayerTemplate(id, teamId, teams, embedded);
          if (extra) byId.set(id, extra);
        }
      }
      return sortPlayersByNumber([...byId.values()]);
    }
  }

  const embeddedPlayers = embedded?.players ?? [];

  // Friendly: trust game-day snapshot (Starters + Bench from setup).
  // Inactive players are never embedded — do not expand to full club.
  if (isFriendlyGame(game) && embeddedPlayers.length > 0) {
    const byId = new Map(embeddedPlayers.map((p) => [p.id, { ...p }]));
    for (const id of participants) {
      if (!byId.has(id)) {
        const extra = lookupPlayerTemplate(id, teamId, teams, embedded);
        if (extra) byId.set(id, extra);
      }
    }
    return sortPlayersByNumber([...byId.values()]);
  }

  if (embeddedPlayers.length > 0 && (clubCount === 0 || embeddedPlayers.length < clubCount)) {
    return sortPlayersByNumber(dedupeTeamPlayers(embeddedPlayers));
  }

  if (participants.length > 0) {
    const fromParticipants = participants
      .map((id) => lookupPlayerTemplate(id, teamId, teams, embedded))
      .filter((p): p is Player => p != null);
    if (fromParticipants.length > 0) {
      return sortPlayersByNumber(dedupeTeamPlayers(fromParticipants));
    }
  }

  return sortPlayersByNumber(dedupeTeamPlayers(embeddedPlayers));
}

/** Attach tournament-filtered (or setup-snapshot) player lists to a game's embedded teams. */
export function normalizeGameTeamRosters(
  game: Game,
  teams: Team[],
  tournamentRosters: TournamentRosterEntry[] = []
): Game {
  const homePlayers = resolveSidePlayers(game, 'home', teams, tournamentRosters);
  const awayPlayers = resolveSidePlayers(game, 'away', teams, tournamentRosters);

  return {
    ...game,
    homeTeam: { ...game.homeTeam, players: homePlayers },
    awayTeam: { ...game.awayTeam, players: awayPlayers },
  };
}

export function normalizeGamesTeamRosters(
  games: Game[],
  teams: Team[],
  tournamentRosters: TournamentRosterEntry[] = []
): Game[] {
  return games.map((game) => normalizeGameTeamRosters(game, teams, tournamentRosters));
}
