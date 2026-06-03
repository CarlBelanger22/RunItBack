import type { Game, Player, Team, Tournament } from '../App';
import {
  getTeamTournamentScopeOptions,
  type TournamentScopeOption,
} from './playerSeasonStats';

/** Known regression IDs (Ram Sunda Putra). */
export const RAM_SUNDA_PUTRA_PLAYER_ID = 'player-1780304603336';

export interface TournamentRosterEntry {
  tournamentId: string;
  teamId: string;
  playerId: string;
  number: number;
  position: string;
  secondaryPosition?: string;
}

export function tournamentRosterEntryKey(entry: TournamentRosterEntry): string {
  return `${entry.tournamentId}:${entry.teamId}:${entry.playerId}`;
}

export interface TeamPlayerJersey {
  number: number;
  position: string;
  secondaryPosition?: string;
}

export type TeamPlayerJerseyLookup = Map<string, TeamPlayerJersey>;

export function teamPlayerJerseyKey(teamId: string, playerId: string): string {
  return `${teamId}:${playerId}`;
}

/** Build jersey lookup from club template rosters. */
export function buildTeamPlayerJerseyLookup(teams: Team[]): TeamPlayerJerseyLookup {
  const map: TeamPlayerJerseyLookup = new Map();
  for (const team of teams) {
    for (const player of team.players ?? []) {
      map.set(teamPlayerJerseyKey(team.id, player.id), {
        number: player.number,
        position: player.position || '',
        secondaryPosition: player.secondaryPosition,
      });
    }
  }
  return map;
}

/** Which side (team id) the player was on for this game — for backfill / stats. */
export function resolvePlayerTeamSideInGame(
  playerId: string,
  game: Game,
  clubRosterByTeam?: Map<string, Set<string>>
): string | null {
  const homeId = game.homeTeamId || game.homeTeam?.id;
  const awayId = game.awayTeamId || game.awayTeam?.id;
  if (!homeId || !awayId) return null;

  const onHomeClub = clubRosterByTeam?.get(homeId)?.has(playerId) ?? false;
  const onAwayClub = clubRosterByTeam?.get(awayId)?.has(playerId) ?? false;
  if (onHomeClub && !onAwayClub) return homeId;
  if (onAwayClub && !onHomeClub) return awayId;

  const homeStarters = game.homeStarters ?? [];
  const awayStarters = game.awayStarters ?? [];
  if (homeStarters.includes(playerId) && !awayStarters.includes(playerId)) {
    return homeId;
  }
  if (awayStarters.includes(playerId) && !homeStarters.includes(playerId)) {
    return awayId;
  }

  const inHomeSnapshot = game.homeTeam?.players?.some((p) => p.id === playerId);
  const inAwaySnapshot = game.awayTeam?.players?.some((p) => p.id === playerId);
  if (inHomeSnapshot && !inAwaySnapshot) return homeId;
  if (inAwaySnapshot && !inHomeSnapshot) return awayId;

  if (homeStarters.includes(playerId)) return homeId;
  if (awayStarters.includes(playerId)) return awayId;

  return homeId;
}

export function buildClubRosterByTeam(teams: Team[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const team of teams) {
    map.set(team.id, new Set((team.players ?? []).map((p) => p.id)));
  }
  return map;
}

export interface BuildTournamentRostersResult {
  entries: TournamentRosterEntry[];
  ambiguous: Array<{ gameId: string; playerId: string; tournamentId: string }>;
  conflicts: Array<{ tournamentId: string; playerId: string; teamIds: string[] }>;
}

/**
 * Derive tournament roster rows from completed games (game-stats-only rule).
 * Does not read club template for membership — only for jersey/position defaults.
 */
export function buildTournamentRostersFromGames(
  games: Game[],
  teams: Team[],
  jerseyLookup: TeamPlayerJerseyLookup = buildTeamPlayerJerseyLookup(teams)
): BuildTournamentRostersResult {
  const clubRosterByTeam = buildClubRosterByTeam(teams);
  const byKey = new Map<string, TournamentRosterEntry>();
  const playerTeamsInTournament = new Map<string, Map<string, Set<string>>>();
  const ambiguous: BuildTournamentRostersResult['ambiguous'] = [];

  for (const game of games) {
    if (!game.isCompleted || !game.tournamentId) continue;

    const tournamentId = game.tournamentId;
    const statPlayerIds = new Set(
      (game.gameStats ?? []).map((s) => s.playerId).filter(Boolean)
    );

    for (const playerId of statPlayerIds) {
      const homeId = game.homeTeamId || game.homeTeam?.id;
      const awayId = game.awayTeamId || game.awayTeam?.id;
      const onHomeClub = homeId ? clubRosterByTeam.get(homeId)?.has(playerId) : false;
      const onAwayClub = awayId ? clubRosterByTeam.get(awayId)?.has(playerId) : false;
      if (onHomeClub && onAwayClub) {
        ambiguous.push({ gameId: game.id, playerId, tournamentId });
      }

      const teamId = resolvePlayerTeamSideInGame(playerId, game, clubRosterByTeam);
      if (!teamId) continue;

      let tMap = playerTeamsInTournament.get(tournamentId);
      if (!tMap) {
        tMap = new Map();
        playerTeamsInTournament.set(tournamentId, tMap);
      }
      let teamSet = tMap.get(playerId);
      if (!teamSet) {
        teamSet = new Set();
        tMap.set(playerId, teamSet);
      }
      teamSet.add(teamId);

      const key = `${tournamentId}:${teamId}:${playerId}`;
      if (byKey.has(key)) continue;

      const jersey = jerseyLookup.get(teamPlayerJerseyKey(teamId, playerId));
      byKey.set(key, {
        tournamentId,
        teamId,
        playerId,
        number: jersey?.number ?? 0,
        position: jersey?.position ?? '',
        secondaryPosition: jersey?.secondaryPosition,
      });
    }
  }

  const conflicts: BuildTournamentRostersResult['conflicts'] = [];
  for (const [tournamentId, tMap] of playerTeamsInTournament) {
    for (const [playerId, teamIds] of tMap) {
      if (teamIds.size > 1) {
        conflicts.push({
          tournamentId,
          playerId,
          teamIds: [...teamIds],
        });
      }
    }
  }

  return {
    entries: [...byKey.values()],
    ambiguous,
    conflicts,
  };
}

/** One player per tournament (DB unique on tournament_id + player_id). */
export function findTournamentPlayerTeamConflict(
  tournamentId: string,
  playerId: string,
  teamId: string,
  entries: TournamentRosterEntry[]
): TournamentRosterEntry | undefined {
  return entries.find(
    (r) =>
      r.tournamentId === tournamentId &&
      r.playerId === playerId &&
      r.teamId !== teamId
  );
}

/**
 * Union stored DB/manual rows with game-derived membership.
 * Game-derived rows always included; stored jersey/position overlay same triple;
 * manual-only rows kept unless they conflict with another team in the same tournament.
 */
export function mergeTournamentRosters(
  stored: TournamentRosterEntry[],
  fromGames: TournamentRosterEntry[]
): TournamentRosterEntry[] {
  const byKey = new Map<string, TournamentRosterEntry>();

  for (const entry of fromGames) {
    byKey.set(tournamentRosterEntryKey(entry), entry);
  }

  const mergedSoFar = (): TournamentRosterEntry[] => [...byKey.values()];

  for (const entry of stored) {
    const key = tournamentRosterEntryKey(entry);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...existing,
        number: entry.number ?? existing.number,
        position: entry.position || existing.position,
        secondaryPosition: entry.secondaryPosition ?? existing.secondaryPosition,
      });
      continue;
    }

    const gameConflict = findTournamentPlayerTeamConflict(
      entry.tournamentId,
      entry.playerId,
      entry.teamId,
      fromGames
    );
    if (gameConflict) continue;

    const mergeConflict = findTournamentPlayerTeamConflict(
      entry.tournamentId,
      entry.playerId,
      entry.teamId,
      mergedSoFar()
    );
    if (mergeConflict) continue;

    byKey.set(key, entry);
  }

  return [...byKey.values()];
}

/** Reconcile in-memory/DB rosters with completed game stats. */
export function reconcileTournamentRostersFromGames(
  games: Game[],
  teams: Team[],
  stored: TournamentRosterEntry[] = []
): TournamentRosterEntry[] {
  const { entries } = buildTournamentRostersFromGames(games, teams);
  return mergeTournamentRosters(stored, entries);
}

export function getPlayersForTeamInTournament(
  teamId: string,
  tournamentId: string,
  teams: Team[],
  rosters: TournamentRosterEntry[]
): Player[] {
  const team = teams.find((t) => t.id === teamId);
  if (!team) return [];

  const rosterRows = rosters.filter(
    (r) => r.tournamentId === tournamentId && r.teamId === teamId
  );

  return rosterRows.map((row) => {
    const template = team.players.find((p) => p.id === row.playerId);
    if (template) {
      return {
        ...template,
        number: row.number,
        position: row.position || template.position,
        secondaryPosition: row.secondaryPosition ?? template.secondaryPosition,
      };
    }
    return {
      id: row.playerId,
      name: row.playerId,
      number: row.number,
      position: row.position,
      secondaryPosition: row.secondaryPosition,
      height: '',
      weight: '',
      age: 0,
    };
  });
}

export function isPlayerOnTournamentRoster(
  playerId: string,
  tournamentId: string,
  teamId: string,
  rosters: TournamentRosterEntry[]
): boolean {
  return rosters.some(
    (r) =>
      r.playerId === playerId &&
      r.tournamentId === tournamentId &&
      r.teamId === teamId
  );
}

export function findTournamentByNameHint(
  tournaments: Tournament[],
  hint: string
): Tournament | undefined {
  const lower = hint.toLowerCase();
  return tournaments.find((t) => t.name.toLowerCase().includes(lower));
}

export function countRosterEntriesForTeamInTournament(
  tournamentId: string,
  teamId: string,
  rosters: TournamentRosterEntry[]
): number {
  return rosters.filter(
    (r) => r.tournamentId === tournamentId && r.teamId === teamId
  ).length;
}

/** Roster tab scope: club template + one option per participated tournament. */
export function getTeamRosterScopeOptions(
  teamId: string,
  teamGames: Game[],
  tournaments: Tournament[]
): TournamentScopeOption[] {
  const tournamentOpts = getTeamTournamentScopeOptions(
    teamId,
    teamGames,
    tournaments
  ).filter((option) => option.value !== 'all');

  return [{ value: 'all', label: 'Club roster (all)' }, ...tournamentOpts];
}

export function getEnrolledTournamentsForTeam(
  teamId: string,
  tournaments: Tournament[]
): Tournament[] {
  return tournaments.filter((t) => (t.teams ?? []).includes(teamId));
}

export function getPlayerTournamentRosterEntries(
  teamId: string,
  playerId: string,
  rosters: TournamentRosterEntry[]
): TournamentRosterEntry[] {
  return rosters.filter(
    (r) => r.teamId === teamId && r.playerId === playerId
  );
}

export interface TournamentRosterAddViolation {
  violates: boolean;
  message?: string;
  conflictingTeamId?: string;
  conflictingTeamName?: string;
}

export function wouldAddPlayerToTournamentRosterViolate(
  playerId: string,
  playerName: string,
  tournamentId: string,
  teamId: string,
  teams: Team[],
  tournaments: Tournament[],
  rosters: TournamentRosterEntry[]
): TournamentRosterAddViolation {
  const existing = rosters.find(
    (r) => r.tournamentId === tournamentId && r.playerId === playerId
  );
  if (existing && existing.teamId !== teamId) {
    const otherTeam = teams.find((t) => t.id === existing.teamId);
    const tournament = tournaments.find((t) => t.id === tournamentId);
    return {
      violates: true,
      conflictingTeamId: existing.teamId,
      conflictingTeamName: otherTeam?.name,
      message: `${playerName} is already on ${otherTeam?.name ?? 'another team'} for ${tournament?.name ?? 'this tournament'}.`,
    };
  }
  return { violates: false };
}

export function evaluateTournamentRosterRemoval(
  teamId: string,
  playerId: string,
  tournamentId: string,
  games: Game[]
): { gameCount: number } {
  let gameCount = 0;
  for (const game of games) {
    if (!game.isCompleted || game.tournamentId !== tournamentId) continue;
    const homeId = game.homeTeamId || game.homeTeam?.id;
    const awayId = game.awayTeamId || game.awayTeam?.id;
    if (homeId !== teamId && awayId !== teamId) continue;
    if ((game.gameStats ?? []).some((s) => s.playerId === playerId)) {
      gameCount++;
    }
  }
  return { gameCount };
}

export function buildTournamentRosterEntryFromClub(
  teamId: string,
  tournamentId: string,
  player: Player
): TournamentRosterEntry {
  return {
    tournamentId,
    teamId,
    playerId: player.id,
    number: player.number,
    position: player.position || '',
    secondaryPosition: player.secondaryPosition,
  };
}

export function getAddableTournamentsForPlayer(
  teamId: string,
  playerId: string,
  tournaments: Tournament[],
  rosters: TournamentRosterEntry[]
): Tournament[] {
  return getEnrolledTournamentsForTeam(teamId, tournaments).filter(
    (t) => !isPlayerOnTournamentRoster(playerId, t.id, teamId, rosters)
  );
}

export function removeTournamentRosterEntry(
  rosters: TournamentRosterEntry[],
  tournamentId: string,
  teamId: string,
  playerId: string
): TournamentRosterEntry[] {
  return rosters.filter(
    (r) =>
      !(
        r.tournamentId === tournamentId &&
        r.teamId === teamId &&
        r.playerId === playerId
      )
  );
}

export function upsertTournamentRosterEntry(
  rosters: TournamentRosterEntry[],
  entry: TournamentRosterEntry
): TournamentRosterEntry[] {
  const key = tournamentRosterEntryKey(entry);
  const without = rosters.filter((r) => tournamentRosterEntryKey(r) !== key);
  return [...without, entry];
}
