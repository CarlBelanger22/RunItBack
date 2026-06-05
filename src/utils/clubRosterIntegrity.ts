import type { Game, Player, Team } from '../App';
import {
  resolvePlayerTeamSideInGame,
  teamPlayerJerseyKey,
  type TeamPlayerJersey,
  type TeamPlayerJerseyLookup,
  type TournamentRosterEntry,
} from './tournamentRosters';

export interface ClubRosterLink {
  teamId: string;
  playerId: string;
  number: number;
  position: string;
  secondaryPosition?: string;
}

export interface ImportJsonPlayer {
  id: string;
  name: string;
  number: number;
  position: string;
  secondaryPosition?: string;
  height?: string;
  weight?: string;
  age?: number;
  dateOfBirth?: string;
}

const CARL_PLAYER_ID = 'player-sunig-ntu-22';
const KAI_XUAN_TEAM_ID = 'team-1780252086140';
const CARL_KAI_XUAN_NUMBER = 22;

function linkKey(teamId: string, playerId: string): string {
  return `${teamId}:${playerId}`;
}

/** Derive club roster membership from completed game stats (no club-roster bias). */
export function buildClubRosterLinksFromGames(games: Game[]): ClubRosterLink[] {
  const emptyClub = new Map<string, Set<string>>();
  const membership = new Map<string, Set<string>>();

  for (const game of games) {
    if (!game.isCompleted) continue;
    for (const stat of game.gameStats ?? []) {
      const playerId = stat.playerId;
      if (!playerId) continue;
      const teamId = resolvePlayerTeamSideInGame(playerId, game, emptyClub);
      if (!teamId) continue;
      const set = membership.get(teamId) ?? new Set();
      set.add(playerId);
      membership.set(teamId, set);
    }
  }

  const links: ClubRosterLink[] = [];
  for (const [teamId, playerIds] of membership) {
    for (const playerId of playerIds) {
      links.push({
        teamId,
        playerId,
        number: 0,
        position: 'PG',
      });
    }
  }
  return links;
}

export function buildImportJsonJerseyLookup(
  bundles: Array<{ teams?: Array<{ id: string; players?: ImportJsonPlayer[] }> }>
): TeamPlayerJerseyLookup {
  const map: TeamPlayerJerseyLookup = new Map();
  for (const bundle of bundles) {
    for (const team of bundle.teams ?? []) {
      for (const player of team.players ?? []) {
        map.set(teamPlayerJerseyKey(team.id, player.id), {
          number: player.number,
          position: player.position || 'PG',
          secondaryPosition: player.secondaryPosition,
        });
      }
    }
  }
  return map;
}

export function buildTournamentRosterJerseyLookup(
  entries: TournamentRosterEntry[]
): TeamPlayerJerseyLookup {
  const map: TeamPlayerJerseyLookup = new Map();
  for (const entry of entries) {
    map.set(teamPlayerJerseyKey(entry.teamId, entry.playerId), {
      number: entry.number,
      position: entry.position || 'PG',
      secondaryPosition: entry.secondaryPosition,
    });
  }
  return map;
}

export function buildExistingJerseyLookup(teams: Team[]): TeamPlayerJerseyLookup {
  const map: TeamPlayerJerseyLookup = new Map();
  for (const team of teams) {
    for (const player of team.players ?? []) {
      map.set(teamPlayerJerseyKey(team.id, player.id), {
        number: player.number,
        position: player.position || 'PG',
        secondaryPosition: player.secondaryPosition,
      });
    }
  }
  return map;
}

function resolveJerseyForLink(
  link: ClubRosterLink,
  existing: TeamPlayerJerseyLookup,
  tournament: TeamPlayerJerseyLookup,
  imports: TeamPlayerJerseyLookup
): TeamPlayerJersey {
  const key = teamPlayerJerseyKey(link.teamId, link.playerId);
  const fromExisting = existing.get(key);
  const fromTournament = tournament.get(key);
  const fromImport = imports.get(key);

  let number =
    fromExisting?.number ??
    fromTournament?.number ??
    fromImport?.number ??
    0;
  const position =
    fromExisting?.position ||
    fromTournament?.position ||
    fromImport?.position ||
    'PG';
  const secondaryPosition =
    fromExisting?.secondaryPosition ??
    fromTournament?.secondaryPosition ??
    fromImport?.secondaryPosition;

  if (
    link.teamId === KAI_XUAN_TEAM_ID &&
    link.playerId === CARL_PLAYER_ID
  ) {
    number = CARL_KAI_XUAN_NUMBER;
  }

  return { number, position, secondaryPosition };
}

/**
 * Union game-derived links with optional manual extras; resolve jerseys.
 * Game-derived links are never dropped.
 */
export function mergeClubRosterLinks(
  derived: ClubRosterLink[],
  options: {
    existingTeams: Team[];
    tournamentRosters: TournamentRosterEntry[];
    importJerseys: TeamPlayerJerseyLookup;
    /** Extra manual links (future squad adds without games yet). */
    manualLinks?: ClubRosterLink[];
  }
): ClubRosterLink[] {
  const existing = buildExistingJerseyLookup(options.existingTeams);
  const tournament = buildTournamentRosterJerseyLookup(options.tournamentRosters);
  const byKey = new Map<string, ClubRosterLink>();

  const add = (link: ClubRosterLink) => {
    byKey.set(linkKey(link.teamId, link.playerId), link);
  };

  for (const link of derived) add(link);
  for (const link of options.manualLinks ?? []) add(link);

  return [...byKey.values()].map((link) => {
    const jersey = resolveJerseyForLink(
      link,
      existing,
      tournament,
      options.importJerseys
    );
    return {
      ...link,
      number: jersey.number,
      position: jersey.position,
      secondaryPosition: jersey.secondaryPosition,
    };
  });
}

export function clubLinksToPlayersByTeam(
  links: ClubRosterLink[],
  profileById: Map<string, Player>
): Map<string, Player[]> {
  const byTeam = new Map<string, Player[]>();
  for (const link of links) {
    const profile = profileById.get(link.playerId);
    const player: Player = profile
      ? {
          ...profile,
          number: link.number,
          position: link.position || profile.position,
          secondaryPosition: link.secondaryPosition ?? profile.secondaryPosition,
        }
      : {
          id: link.playerId,
          name: link.playerId,
          number: link.number,
          position: link.position || 'PG',
          secondaryPosition: link.secondaryPosition,
          height: '',
          weight: '',
          age: 0,
        };
    const list = byTeam.get(link.teamId) ?? [];
    list.push(player);
    byTeam.set(link.teamId, list);
  }
  return byTeam;
}

export function applyClubLinksToTeams(
  teams: Team[],
  links: ClubRosterLink[],
  profileById: Map<string, Player>
): Team[] {
  const byTeam = clubLinksToPlayersByTeam(links, profileById);
  const teamsWithPlayers = new Set(byTeam.keys());

  return teams.map((team) => {
    if (!teamsWithPlayers.has(team.id)) {
      return { ...team, players: [] };
    }
    const players = (byTeam.get(team.id) ?? []).sort(
      (a, b) => a.number - b.number || a.name.localeCompare(b.name)
    );
    return { ...team, players };
  });
}

/** Union rosters per team (by player id); incoming wins on jersey conflicts. */
export function mergeTeamRostersUnion(base: Team[], incoming: Team[]): Team[] {
  const incomingById = new Map(incoming.map((t) => [t.id, t]));
  const allIds = new Set([...base.map((t) => t.id), ...incoming.map((t) => t.id)]);

  return [...allIds].map((teamId) => {
    const a = base.find((t) => t.id === teamId);
    const b = incomingById.get(teamId);
    if (!a && b) return b;
    if (a && !b) return a;
    if (!a || !b) return a ?? b!;

    const byPlayerId = new Map<string, Player>();
    for (const p of a.players ?? []) byPlayerId.set(p.id, p);
    for (const p of b.players ?? []) byPlayerId.set(p.id, p);

    return {
      ...b,
      players: [...byPlayerId.values()].sort(
        (x, y) => x.number - y.number || x.name.localeCompare(y.name)
      ),
    };
  });
}

export function findRosterRemovals(
  prev: Team[],
  next: Team[]
): Array<{ teamId: string; playerId: string }> {
  const removals: Array<{ teamId: string; playerId: string }> = [];
  for (const prevTeam of prev) {
    const nextTeam = next.find((t) => t.id === prevTeam.id);
    const nextIds = new Set((nextTeam?.players ?? []).map((p) => p.id));
    for (const player of prevTeam.players ?? []) {
      if (!nextIds.has(player.id)) {
        removals.push({ teamId: prevTeam.id, playerId: player.id });
      }
    }
  }
  return removals;
}

export interface VerifyClubRosterViolation {
  gameId: string;
  playerId: string;
  expectedTeamId: string;
  message: string;
}

export function verifyClubRosters(
  games: Game[],
  teams: Team[]
): VerifyClubRosterViolation[] {
  const emptyClub = new Map<string, Set<string>>();
  const rosterByTeam = new Map<string, Set<string>>();
  for (const team of teams) {
    rosterByTeam.set(
      team.id,
      new Set((team.players ?? []).map((p) => p.id))
    );
  }

  const violations: VerifyClubRosterViolation[] = [];
  for (const game of games) {
    if (!game.isCompleted) continue;
    for (const stat of game.gameStats ?? []) {
      const playerId = stat.playerId;
      if (!playerId) continue;
      const expectedTeamId = resolvePlayerTeamSideInGame(
        playerId,
        game,
        emptyClub
      );
      if (!expectedTeamId) continue;
      const onRoster = rosterByTeam.get(expectedTeamId)?.has(playerId) ?? false;
      if (!onRoster) {
        violations.push({
          gameId: game.id,
          playerId,
          expectedTeamId,
          message: `${playerId} played in ${game.id} for ${expectedTeamId} but not on club roster`,
        });
      }
    }
  }
  return violations;
}
