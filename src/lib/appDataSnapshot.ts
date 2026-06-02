import type { Game, Player, Team, Tournament } from '../App';
import { DEFAULT_LEAGUE_ID } from '../api/supabaseData';
import type { LoadedAppData } from '../api/supabaseData';
import {
  dedupeActiveGames,
  isOrphanedIncompleteGame,
} from '../utils/activeGame';
import { dedupeTeamsById } from '../utils/rosterPlayers';

export const APP_DATA_SNAPSHOT_VERSION = 1;
const STORAGE_KEY = 'runitback_app_data_snapshot_v1';

export interface AppDataSnapshot {
  version: number;
  savedAt: number;
  leagueId: string;
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  darkMode: boolean;
  orphanPlayers: Player[];
}

export interface ProcessedAppData {
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  darkMode: boolean;
  orphanPlayers: Player[];
  activeGame: Game | null;
  activeGameDedupeChanged: boolean;
  orphanGameIds: string[];
  playerMeasurementsMigrationPending?: boolean;
  playerStorageSchema?: LoadedAppData['playerStorageSchema'];
}

export function processLoadedAppData(data: LoadedAppData): ProcessedAppData {
  const teams = dedupeTeamsById(data.teams);
  const { games: dedupedGames, active, changed } = dedupeActiveGames(data.games);
  const orphanGameIds = dedupedGames
    .filter(isOrphanedIncompleteGame)
    .map((g) => g.id);
  const games = dedupedGames.filter((g) => !orphanGameIds.includes(g.id));

  return {
    teams,
    tournaments: data.tournaments,
    games,
    darkMode: data.darkMode,
    orphanPlayers: data.orphanPlayers,
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
    if (parsed.version !== APP_DATA_SNAPSHOT_VERSION) return null;
    if (parsed.leagueId !== leagueId) return null;
    if (!Array.isArray(parsed.teams) || !Array.isArray(parsed.games)) {
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
}): void {
  try {
    const snapshot: AppDataSnapshot = {
      version: APP_DATA_SNAPSHOT_VERSION,
      savedAt: Date.now(),
      leagueId: payload.leagueId ?? DEFAULT_LEAGUE_ID,
      teams: payload.teams,
      tournaments: payload.tournaments,
      games: payload.games,
      darkMode: payload.darkMode,
      orphanPlayers: payload.orphanPlayers,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[RunItBack] Could not write app data snapshot:', err);
  }
}

export function snapshotToLoadedAppData(snapshot: AppDataSnapshot): LoadedAppData {
  return {
    teams: snapshot.teams,
    tournaments: snapshot.tournaments,
    games: snapshot.games,
    darkMode: snapshot.darkMode,
    orphanPlayers: snapshot.orphanPlayers,
  };
}

export function getSnapshotAgeMs(snapshot: AppDataSnapshot): number {
  return Date.now() - snapshot.savedAt;
}
