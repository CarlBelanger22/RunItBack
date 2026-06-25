import type { Game, GameStats, Player, Team, TeamStats, Tournament } from '../App';
import { DEFAULT_LEAGUE_ID } from '../api/supabaseData';
import type { LoadedAppData } from '../api/supabaseData';
import {
  reconcileTournamentRostersFromGames,
  type TournamentRosterEntry,
} from '../utils/tournamentRosters';
import {
  dedupeActiveGames,
  isOrphanedIncompleteGame,
} from '../utils/activeGame';
import { dedupeTeamsById } from '../utils/rosterPlayers';
import { reconcileTournamentsFromGames } from '../utils/tournamentEnrollment';
import { gameStatsHaveBoxScoreData } from '../utils/gameStatsIntegrity';
import { isPersistedIconReference } from '../utils/teamAssetStorage';

export const APP_DATA_SNAPSHOT_VERSION = 7;
const STORAGE_KEY = 'runitback_app_data_snapshot_v1';
/** Stay under typical 5MB localStorage quota. */
const MAX_SNAPSHOT_CHARS = 4 * 1024 * 1024;

const ROSTER_ONLY_GAME_STAT: GameStats = {
  playerId: '',
  points: 0,
  fg_made: 0,
  fg_attempted: 0,
  three_made: 0,
  three_attempted: 0,
  ft_made: 0,
  ft_attempted: 0,
  orb: 0,
  drb: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
  tech_fouls: 0,
  unsportsmanlike_fouls: 0,
  fouls_drawn: 0,
  blocks_received: 0,
  plus_minus: 0,
  minutes_played: 0,
};

/** Compact game row for localStorage (v5 includes lite box scores). */
export interface SnapshotGame {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  tournamentId?: string;
  date: string;
  isActive: boolean;
  isCompleted: boolean;
  /** Lite player box scores — enough for player pages and roster reconcile. */
  gameStats: GameStats[];
  homeStarters: string[];
  awayStarters: string[];
  finalScore?: { home: number; away: number };
  currentPeriod: number;
  currentGameTime: string;
  trackBothTeams: boolean;
}

export interface AppDataSnapshot {
  version: number;
  savedAt: number;
  leagueId: string;
  teams: Team[];
  tournaments: Tournament[];
  games: SnapshotGame[];
  darkMode: boolean;
  tournamentRosters: TournamentRosterEntry[];
}

export interface ProcessedAppData {
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  darkMode: boolean;
  orphanPlayers: Player[];
  tournamentRosters: TournamentRosterEntry[];
  activeGame: Game | null;
  activeGameDedupeChanged: boolean;
  orphanGameIds: string[];
  playerMeasurementsMigrationPending?: boolean;
  playerStorageSchema?: LoadedAppData['playerStorageSchema'];
}

function emptyTeamStats(teamId: string): TeamStats {
  return {
    teamId,
    q1_points: 0,
    q2_points: 0,
    q3_points: 0,
    q4_points: 0,
    ot_points: 0,
    total_points: 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    two_made: 0,
    two_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    team_rebounds: 0,
    total_rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    points_off_turnovers: null,
    points_in_paint: null,
    second_chance_points: null,
    fastbreak_points: null,
    bench_points: null,
    biggest_lead: null,
    biggest_scoring_run: null,
    team_coach: { orb: 0, drb: 0, turnovers: 0, fouls: 0 },
  };
}

function toSnapshotPlayer(player: Player): Player {
  return {
    id: player.id,
    name: player.name,
    number: player.number,
    position: player.position,
    secondaryPosition: player.secondaryPosition,
    height: player.height,
    weight: player.weight,
    age: player.age,
    dateOfBirth: player.dateOfBirth,
  };
}

function snapshotIcon(icon?: string): string | undefined {
  return isPersistedIconReference(icon) ? icon!.trim() : undefined;
}

function toSnapshotTeams(teams: Team[]): Team[] {
  return teams.map((team) => ({
    ...team,
    icon: snapshotIcon(team.icon),
    description: undefined,
    players: (team.players ?? []).map(toSnapshotPlayer),
  }));
}

function toSnapshotTournaments(tournaments: Tournament[]): Tournament[] {
  return tournaments.map((tournament) => ({
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    month: tournament.month,
    icon: snapshotIcon(tournament.icon),
    teams: tournament.teams ?? [],
    games: tournament.games ?? [],
    standings: [],
  }));
}

/** Keep logo URLs when a save/reconcile returns teams without icon metadata. */
export function mergeTeamIconMetadata(teams: Team[], ...fallbacks: Team[]): Team[] {
  const iconById = new Map<string, string>();
  for (const fallback of fallbacks) {
    for (const team of fallback) {
      if (isPersistedIconReference(team.icon)) {
        iconById.set(team.id, team.icon!.trim());
      }
    }
  }
  return teams.map((team) => ({
    ...team,
    icon: isPersistedIconReference(team.icon)
      ? team.icon!.trim()
      : iconById.get(team.id),
  }));
}

export function mergeTournamentIconMetadata(
  tournaments: Tournament[],
  ...fallbacks: Tournament[]
): Tournament[] {
  const iconById = new Map<string, string>();
  for (const fallback of fallbacks) {
    for (const tournament of fallback) {
      if (isPersistedIconReference(tournament.icon)) {
        iconById.set(tournament.id, tournament.icon!.trim());
      }
    }
  }
  return tournaments.map((tournament) => ({
    ...tournament,
    icon: isPersistedIconReference(tournament.icon)
      ? tournament.icon!.trim()
      : iconById.get(tournament.id),
  }));
}

function toSnapshotGameStats(stats: GameStats[]): GameStats[] {
  return stats.map((stat) => ({ ...stat }));
}

export function toSnapshotGames(games: Game[]): SnapshotGame[] {
  return games.map((game) => ({
    id: game.id,
    homeTeamId: game.homeTeamId || game.homeTeam?.id || '',
    awayTeamId: game.awayTeamId || game.awayTeam?.id || '',
    tournamentId: game.tournamentId,
    date: game.date,
    isActive: game.isActive,
    isCompleted: game.isCompleted,
    gameStats: toSnapshotGameStats(game.gameStats ?? []),
    homeStarters: game.homeStarters ?? [],
    awayStarters: game.awayStarters ?? [],
    finalScore: game.finalScore,
    currentPeriod: game.currentPeriod ?? 1,
    currentGameTime: game.currentGameTime ?? '0:00',
    trackBothTeams: game.trackBothTeams ?? true,
  }));
}

function playerIdsToGameStats(playerIds: string[]): GameStats[] {
  return playerIds.map((playerId) => ({
    ...ROSTER_ONLY_GAME_STAT,
    playerId,
  }));
}

export function hydrateSnapshotGames(
  snapshotGames: SnapshotGame[],
  teams: Team[]
): Game[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const shellTeam = (teamId: string): Team =>
    teamById.get(teamId) ?? {
      id: teamId,
      name: teamId,
      abbreviation: '?',
      players: [],
    };

  return snapshotGames.map((row) => {
    const legacyV4 = row as SnapshotGame & { playerIds?: string[] };
    const gameStats =
      row.gameStats?.length > 0
        ? row.gameStats
        : legacyV4.playerIds?.length
          ? playerIdsToGameStats(legacyV4.playerIds)
          : [];

    return {
      id: row.id,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homeTeam: shellTeam(row.homeTeamId),
      awayTeam: shellTeam(row.awayTeamId),
      tournamentId: row.tournamentId,
      date: row.date,
      gameStats,
      teamStats: {
        home: emptyTeamStats(row.homeTeamId),
        away: emptyTeamStats(row.awayTeamId),
      },
      shots: [],
      events: [],
      lineupStints: [],
      currentPeriod: row.currentPeriod,
      currentGameTime: row.currentGameTime,
      homeStarters: row.homeStarters ?? [],
      awayStarters: row.awayStarters ?? [],
      trackBothTeams: row.trackBothTeams,
      isActive: row.isActive,
      isCompleted: row.isCompleted,
      finalScore: row.finalScore,
    };
  });
}

/** @deprecated use isSnapshotUsable */
export function isSnapshotTeamsStale(teams: Team[]): boolean {
  if (teams.length === 0) return true;
  const playerCount = teams.reduce(
    (sum, team) => sum + (team.players?.length ?? 0),
    0
  );
  return playerCount === 0;
}

export function isSnapshotUsable(snapshot: AppDataSnapshot): boolean {
  if (snapshot.version !== APP_DATA_SNAPSHOT_VERSION) return false;
  if (snapshot.teams.length === 0 || snapshot.games.length === 0) return false;
  if (isSnapshotTeamsStale(snapshot.teams)) return false;

  const hydrated = hydrateSnapshotGames(snapshot.games, snapshot.teams);
  return hydrated.some((game) => gameStatsHaveBoxScoreData(game.gameStats));
}

function buildSnapshotBody(payload: {
  leagueId?: string;
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  darkMode: boolean;
  tournamentRosters?: TournamentRosterEntry[];
}): AppDataSnapshot {
  return {
    version: APP_DATA_SNAPSHOT_VERSION,
    savedAt: Date.now(),
    leagueId: payload.leagueId ?? DEFAULT_LEAGUE_ID,
    teams: toSnapshotTeams(payload.teams),
    tournaments: toSnapshotTournaments(payload.tournaments),
    games: toSnapshotGames(payload.games),
    darkMode: payload.darkMode,
    tournamentRosters: payload.tournamentRosters ?? [],
  };
}

export function processLoadedAppData(data: LoadedAppData): ProcessedAppData {
  const teams = dedupeTeamsById(data.teams);
  const { games: dedupedGames, active, changed } = dedupeActiveGames(data.games);
  const orphanGameIds = dedupedGames
    .filter(isOrphanedIncompleteGame)
    .map((g) => g.id);
  const games = dedupedGames.filter((g) => !orphanGameIds.includes(g.id));
  const tournaments = reconcileTournamentsFromGames(data.tournaments, games);

  return {
    teams,
    tournaments,
    games,
    darkMode: data.darkMode,
    orphanPlayers: data.orphanPlayers,
    tournamentRosters: reconcileTournamentRostersFromGames(
      games,
      teams,
      data.tournamentRosters ?? []
    ),
    activeGame: active,
    activeGameDedupeChanged: changed,
    orphanGameIds,
    playerMeasurementsMigrationPending: data.playerMeasurementsMigrationPending,
    playerStorageSchema: data.playerStorageSchema,
  };
}

export function readAppDataSnapshot(
  leagueId = DEFAULT_LEAGUE_ID
): AppDataSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppDataSnapshot;
    if (parsed.leagueId !== leagueId) return null;
    if (!Array.isArray(parsed.teams) || !Array.isArray(parsed.games)) {
      return null;
    }
    if (!isSnapshotUsable(parsed)) {
      if (import.meta.env.DEV) {
        console.info('[RunItBack] discarding unusable snapshot', {
          version: parsed.version,
          teams: parsed.teams.length,
          games: parsed.games.length,
        });
      }
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveAppDataSnapshot(payload: {
  leagueId?: string;
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  darkMode: boolean;
  orphanPlayers: Player[];
  tournamentRosters?: TournamentRosterEntry[];
}): void {
  if (payload.teams.length === 0 || payload.games.length === 0) {
    return;
  }

  try {
    const snapshot = buildSnapshotBody(payload);
    const serialized = JSON.stringify(snapshot);

    if (serialized.length > MAX_SNAPSHOT_CHARS) {
      console.warn(
        '[RunItBack] Snapshot too large; skipping localStorage write.',
        { chars: serialized.length, max: MAX_SNAPSHOT_CHARS }
      );
      return;
    }

    localStorage.setItem(STORAGE_KEY, serialized);
    if (import.meta.env.DEV) {
      console.info('[RunItBack] snapshot saved', {
        chars: serialized.length,
        teams: snapshot.teams.length,
        games: snapshot.games.length,
        tournamentRosters: snapshot.tournamentRosters.length,
      });
    }
  } catch (err) {
    console.warn('[RunItBack] Could not write app data snapshot:', err);
  }
}

export function snapshotToLoadedAppData(snapshot: AppDataSnapshot): LoadedAppData {
  const games = hydrateSnapshotGames(snapshot.games, snapshot.teams);
  return {
    teams: snapshot.teams,
    tournaments: snapshot.tournaments,
    games,
    darkMode: snapshot.darkMode,
    orphanPlayers: [],
    tournamentRosters: snapshot.tournamentRosters ?? [],
  };
}

export function getSnapshotAgeMs(snapshot: AppDataSnapshot): number {
  return Date.now() - snapshot.savedAt;
}
