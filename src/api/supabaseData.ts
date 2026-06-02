import { supabase } from '../lib/supabase';
import { migrateTeamsPlayerMeasurements } from '../lib/playerMeasurements';
import { dedupeTeamPlayers, dedupeTeamsById } from '../utils/rosterPlayers';
import type { Team, Tournament, Game, Player } from '../App';

export const DEFAULT_LEAGUE_ID = 'league-default';

export type PlayerStorageSchema = 'legacy' | 'team_players' | 'global_position';

export const MIGRATION_002_HINT =
  'Run supabase/migrations/002_team_players.sql in Supabase SQL Editor, or: npm run db:migrate:002';

export const MIGRATION_003_HINT =
  'Run supabase/migrations/003_player_global_position.sql in Supabase SQL Editor, or: npm run db:migrate:003';

let cachedPlayerStorageSchema: PlayerStorageSchema | null = null;

export function getPlayerStorageSchema(): PlayerStorageSchema | null {
  return cachedPlayerStorageSchema;
}

export function resetPlayerStorageSchemaCache(): void {
  cachedPlayerStorageSchema = null;
}

/** Probe Supabase player/roster schema (legacy → team_players → global_position). */
export async function detectPlayerStorageSchema(): Promise<PlayerStorageSchema> {
  if (cachedPlayerStorageSchema) return cachedPlayerStorageSchema;
  if (!supabase) {
    cachedPlayerStorageSchema = 'legacy';
    return cachedPlayerStorageSchema;
  }

  const teamPlayersProbe = await supabase
    .from('team_players')
    .select('team_id')
    .limit(1);
  if (teamPlayersProbe.error) {
    cachedPlayerStorageSchema = 'legacy';
    return cachedPlayerStorageSchema;
  }

  const leagueProbe = await supabase.from('players').select('league_id').limit(1);
  if (leagueProbe.error) {
    cachedPlayerStorageSchema = 'legacy';
    return cachedPlayerStorageSchema;
  }

  const positionProbe = await supabase.from('players').select('position').limit(1);
  if (positionProbe.error) {
    cachedPlayerStorageSchema = 'team_players';
    return cachedPlayerStorageSchema;
  }

  cachedPlayerStorageSchema = 'global_position';
  return cachedPlayerStorageSchema;
}

export const MIGRATION_004_HINT =
  'Run supabase/migrations/004_allow_duplicate_jersey_numbers.sql in Supabase SQL Editor, or: npm run db:migrate:004';

export interface LoadedAppData {
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  darkMode: boolean;
  /** League player profiles not linked to any team roster. */
  orphanPlayers: Player[];
  /** True when legacy height/weight values were normalized on load. */
  playerMeasurementsMigrationPending?: boolean;
  playerStorageSchema?: PlayerStorageSchema;
}

interface DbTeam {
  id: string;
  league_id: string;
  name: string;
  abbreviation: string;
  icon: string | null;
  description: string | null;
  current_tournament_id: string | null;
  created_at?: string;
}

interface DbPlayerProfileBase {
  id: string;
  league_id: string;
  name: string;
  picture: string | null;
  height: string;
  weight: string;
  age: number;
  date_of_birth: string | null;
}

interface DbPlayerProfile extends DbPlayerProfileBase {
  position: string;
  secondary_position: string | null;
}

interface DbTeamPlayer {
  team_id: string;
  player_id: string;
  number: number;
  /** Present before migration 003 only. */
  position?: string;
  secondary_position?: string | null;
}

/** Pre-C10 / transitional rows on players or team_players. */
interface LegacyDbPlayer extends DbPlayerProfileBase {
  position?: string;
  secondary_position?: string | null;
  team_id?: string;
  number?: number;
}

interface DbTournament {
  id: string;
  league_id: string;
  name: string;
  icon: string | null;
  description: string | null;
  year: number;
  month: string;
  standings: Tournament['standings'];
  created_at?: string;
}

interface DbTournamentTeam {
  tournament_id: string;
  team_id: string;
}

interface DbGame {
  id: string;
  league_id: string;
  tournament_id: string | null;
  home_team_id: string;
  away_team_id: string;
  date: string;
  current_period: number;
  current_game_time: string;
  track_both_teams: boolean;
  is_active: boolean;
  is_completed: boolean;
  final_score_home: number | null;
  final_score_away: number | null;
  home_starters: string[];
  away_starters: string[];
  game_stats: Game['gameStats'];
  team_stats: Game['teamStats'];
  shots: Game['shots'];
  events: Game['events'];
  lineup_stints: Game['lineupStints'];
}

function dbPlayerToPlayer(
  profile: DbPlayerProfileBase & {
    position?: string;
    secondary_position?: string | null;
  },
  roster?: Pick<DbTeamPlayer, 'number' | 'position' | 'secondary_position'>
): Player {
  return {
    id: profile.id,
    name: profile.name,
    number: roster?.number ?? 0,
    position: profile.position || roster?.position || '',
    secondaryPosition:
      profile.secondary_position ?? roster?.secondary_position ?? undefined,
    picture: profile.picture ?? undefined,
    height: profile.height,
    weight: profile.weight,
    age: profile.age,
    dateOfBirth: profile.date_of_birth ?? undefined,
  };
}

function dbTeamToTeam(row: DbTeam, players: Player[]): Team {
  return {
    id: row.id,
    name: row.name,
    abbreviation: row.abbreviation,
    icon: row.icon ?? undefined,
    description: row.description ?? undefined,
    players,
    currentTournamentId: row.current_tournament_id ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

function teamToDbRow(team: Team, leagueId: string): DbTeam {
  return {
    id: team.id,
    league_id: leagueId,
    name: team.name,
    abbreviation: team.abbreviation,
    icon: team.icon ?? null,
    description: team.description ?? null,
    current_tournament_id: team.currentTournamentId ?? null,
  };
}

function playerProfileBaseToDbRow(player: Player, leagueId: string): DbPlayerProfileBase {
  return {
    id: player.id,
    league_id: leagueId,
    name: player.name,
    picture: player.picture ?? null,
    height: player.height ?? '',
    weight: player.weight ?? '',
    age: player.age ?? 0,
    date_of_birth: player.dateOfBirth ?? null,
  };
}

function playerProfileToDbRow(player: Player, leagueId: string): DbPlayerProfile {
  return {
    ...playerProfileBaseToDbRow(player, leagueId),
    position: player.position || 'PG',
    secondary_position: player.secondaryPosition ?? null,
  };
}

function playerToTeamPlayerRow(player: Player, teamId: string): DbTeamPlayer {
  return {
    team_id: teamId,
    player_id: player.id,
    number: player.number,
  };
}

function playerToTeamPlayerRowWithPosition(
  player: Player,
  teamId: string
): Required<Pick<DbTeamPlayer, 'team_id' | 'player_id' | 'number' | 'position' | 'secondary_position'>> {
  return {
    team_id: teamId,
    player_id: player.id,
    number: player.number,
    position: player.position || 'PG',
    secondary_position: player.secondaryPosition ?? null,
  };
}

function collectUniquePlayerProfileBases(
  teams: Team[],
  leagueId: string
): DbPlayerProfileBase[] {
  const map = new Map<string, DbPlayerProfileBase>();
  for (const team of teams) {
    for (const player of team.players ?? []) {
      const existing = map.get(player.id);
      if (!existing) {
        map.set(player.id, playerProfileBaseToDbRow(player, leagueId));
        continue;
      }
      map.set(player.id, {
        ...existing,
        name: player.name || existing.name,
        picture: player.picture ?? existing.picture,
        height: player.height || existing.height,
        weight: player.weight || existing.weight,
        age: player.age ?? existing.age,
        date_of_birth: player.dateOfBirth ?? existing.date_of_birth,
      });
    }
  }
  return [...map.values()];
}

function collectUniquePlayerProfiles(
  teams: Team[],
  leagueId: string
): DbPlayerProfile[] {
  const map = new Map<string, DbPlayerProfile>();
  for (const team of teams) {
    for (const player of team.players ?? []) {
      const existing = map.get(player.id);
      if (!existing) {
        map.set(player.id, playerProfileToDbRow(player, leagueId));
        continue;
      }
      map.set(player.id, {
        ...existing,
        name: player.name || existing.name,
        position: player.position || existing.position,
        secondary_position:
          player.secondaryPosition ?? existing.secondary_position,
        picture: player.picture ?? existing.picture,
        height: player.height || existing.height,
        weight: player.weight || existing.weight,
        age: player.age ?? existing.age,
        date_of_birth: player.dateOfBirth ?? existing.date_of_birth,
      });
    }
  }
  return [...map.values()];
}

interface LegacyDbPlayerRow {
  id: string;
  team_id: string;
  name: string;
  number: number;
  position: string;
  secondary_position: string | null;
  picture: string | null;
  height: string;
  weight: string;
  age: number;
  date_of_birth: string | null;
}

function playerToLegacyDbRow(player: Player, teamId: string): LegacyDbPlayerRow {
  return {
    id: player.id,
    team_id: teamId,
    name: player.name,
    number: player.number,
    position: player.position,
    secondary_position: player.secondaryPosition ?? null,
    picture: player.picture ?? null,
    height: player.height ?? '',
    weight: player.weight ?? '',
    age: player.age ?? 0,
    date_of_birth: player.dateOfBirth ?? null,
  };
}

function findMultiTeamPlayerIds(teams: Team[]): string[] {
  const teamIdsByPlayer = new Map<string, string[]>();
  for (const team of teams) {
    for (const player of team.players ?? []) {
      const ids = teamIdsByPlayer.get(player.id) ?? [];
      ids.push(team.id);
      teamIdsByPlayer.set(player.id, ids);
    }
  }
  return [...teamIdsByPlayer.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([playerId]) => playerId);
}

function assertCanSaveWithLegacySchema(teams: Team[]): void {
  const multiTeamPlayerIds = findMultiTeamPlayerIds(teams);
  if (multiTeamPlayerIds.length > 0) {
    throw new Error(
      `Multi-team rosters require database migration 002 before saving. ${MIGRATION_002_HINT}`
    );
  }
}

async function savePlayersWithSchema(
  teams: Team[],
  leagueId: string,
  schema: PlayerStorageSchema
): Promise<void> {
  const teamIds = teams.map((t) => t.id);

  if (schema === 'global_position') {
    const playerProfileRows = collectUniquePlayerProfiles(teams, leagueId);
    const teamPlayerRows = teams.flatMap((t) =>
      dedupeTeamPlayers(t.players ?? []).map((p) => playerToTeamPlayerRow(p, t.id))
    );

    await upsertChunks('players', playerProfileRows, 'id');

    if (teamIds.length > 0) {
      const { error: rosterDeleteError } = await supabase!
        .from('team_players')
        .delete()
        .in('team_id', teamIds);
      if (rosterDeleteError) {
        throw new Error(`team_players delete: ${rosterDeleteError.message}`);
      }
    }
    await upsertChunks('team_players', teamPlayerRows, 'team_id,player_id');
    return;
  }

  if (schema === 'team_players') {
    const playerProfileRows = collectUniquePlayerProfileBases(teams, leagueId);
    const teamPlayerRows = teams.flatMap((t) =>
      dedupeTeamPlayers(t.players ?? []).map((p) =>
        playerToTeamPlayerRowWithPosition(p, t.id)
      )
    );

    await upsertChunks('players', playerProfileRows, 'id');

    if (teamIds.length > 0) {
      const { error: rosterDeleteError } = await supabase!
        .from('team_players')
        .delete()
        .in('team_id', teamIds);
      if (rosterDeleteError) {
        throw new Error(`team_players delete: ${rosterDeleteError.message}`);
      }
    }
    await upsertChunks('team_players', teamPlayerRows, 'team_id,player_id');
    return;
  }

  assertCanSaveWithLegacySchema(teams);
  const playerRows = teams.flatMap((t) =>
    (t.players ?? []).map((p) => playerToLegacyDbRow(p, t.id))
  );
  await upsertChunks('players', playerRows, 'id');
}

const TEAM_STATS_META_KEY = '__meta' as const;

type GameSetupMeta = {
  setupCreatedTeamIds?: string[];
  setupRosterChanges?: Game['setupRosterChanges'];
  startTime?: string;
};

type PersistedTeamStats = Game['teamStats'] & {
  [TEAM_STATS_META_KEY]?: GameSetupMeta;
};

function serializeTeamStats(game: Game): PersistedTeamStats {
  const payload: PersistedTeamStats = {
    home: game.teamStats.home,
    away: game.teamStats.away,
  };
  const hasMeta =
    (game.setupCreatedTeamIds?.length ?? 0) > 0 ||
    (game.setupRosterChanges?.length ?? 0) > 0 ||
    Boolean(game.startTime);
  if (hasMeta) {
    payload[TEAM_STATS_META_KEY] = {
      setupCreatedTeamIds: game.setupCreatedTeamIds,
      setupRosterChanges: game.setupRosterChanges,
      startTime: game.startTime,
    };
  }
  return payload;
}

function parseTeamStats(row: DbGame['team_stats']): {
  teamStats: Game['teamStats'];
  setupCreatedTeamIds?: string[];
  setupRosterChanges?: Game['setupRosterChanges'];
  startTime?: string;
} {
  const raw = row as PersistedTeamStats;
  const meta = raw[TEAM_STATS_META_KEY];
  return {
    teamStats: { home: raw.home, away: raw.away },
    setupCreatedTeamIds: meta?.setupCreatedTeamIds,
    setupRosterChanges: meta?.setupRosterChanges,
    startTime: meta?.startTime,
  };
}

function gameToDbRow(game: Game, leagueId: string): DbGame {
  const homeId = game.homeTeamId || game.homeTeam?.id;
  const awayId = game.awayTeamId || game.awayTeam?.id;
  if (!homeId || !awayId) {
    throw new Error(`Game ${game.id} is missing home or away team id`);
  }

  return {
    id: game.id,
    league_id: leagueId,
    tournament_id: game.tournamentId ?? null,
    home_team_id: homeId,
    away_team_id: awayId,
    date: game.date,
    current_period: game.currentPeriod ?? 1,
    current_game_time: game.currentGameTime ?? '12:00',
    track_both_teams: game.trackBothTeams ?? true,
    is_active: game.isActive ?? false,
    is_completed: game.isCompleted ?? false,
    final_score_home: game.finalScore?.home ?? null,
    final_score_away: game.finalScore?.away ?? null,
    home_starters: game.homeStarters ?? [],
    away_starters: game.awayStarters ?? [],
    game_stats: game.gameStats ?? [],
    team_stats: serializeTeamStats(game),
    shots: game.shots ?? [],
    events: game.events ?? [],
    lineup_stints: game.lineupStints ?? [],
  };
}

function dbGameToGame(row: DbGame, teamById: Map<string, Team>): Game {
  const homeTeam = teamById.get(row.home_team_id);
  const awayTeam = teamById.get(row.away_team_id);
  if (!homeTeam || !awayTeam) {
    throw new Error(`Game ${row.id} references missing team(s)`);
  }

  const { teamStats, setupCreatedTeamIds, setupRosterChanges, startTime } =
    parseTeamStats(row.team_stats);

  return {
    id: row.id,
    homeTeam,
    awayTeam,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    tournamentId: row.tournament_id ?? undefined,
    date: row.date,
    startTime,
    gameStats: row.game_stats ?? [],
    teamStats,
    setupCreatedTeamIds,
    setupRosterChanges,
    shots: row.shots ?? [],
    events: row.events ?? [],
    lineupStints: row.lineup_stints ?? [],
    currentPeriod: row.current_period,
    currentGameTime: row.current_game_time,
    homeStarters: row.home_starters ?? [],
    awayStarters: row.away_starters ?? [],
    trackBothTeams: row.track_both_teams,
    isActive: row.is_active,
    isCompleted: row.is_completed,
    finalScore:
      row.final_score_home != null && row.final_score_away != null
        ? { home: row.final_score_home, away: row.final_score_away }
        : undefined,
  };
}

async function upsertChunks<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  onConflict: string
): Promise<void> {
  if (!supabase || rows.length === 0) return;
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

function logLoadTimings(
  startedAt: number,
  phases: Record<string, number>,
  counts: Record<string, number>
): void {
  const totalMs = Math.round(performance.now() - startedAt);
  const roundedPhases = Object.fromEntries(
    Object.entries(phases).map(([key, ms]) => [key, Math.round(ms)])
  );
  console.info('[RunItBack] loadAppDataFromSupabase', {
    totalMs,
    phases: roundedPhases,
    counts,
  });
}

export async function loadAppDataFromSupabase(
  leagueId = DEFAULT_LEAGUE_ID
): Promise<LoadedAppData> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const loadStartedAt = performance.now();
  const phases: Record<string, number> = {};
  let phaseStart = loadStartedAt;

  const teamRowsRes = await supabase
    .from('teams')
    .select('*')
    .eq('league_id', leagueId);
  if (teamRowsRes.error) throw new Error(teamRowsRes.error.message);

  phases.teamsQuery = performance.now() - phaseStart;
  phaseStart = performance.now();

  const teamRows = (teamRowsRes.data ?? []) as DbTeam[];
  const teamIds = teamRows.map((t) => t.id);

  const [
    playersResInitial,
    teamPlayersRes,
    tournamentsRes,
    junctionRes,
    gamesRes,
    prefsRes,
  ] = await Promise.all([
    supabase.from('players').select('*').eq('league_id', leagueId),
    teamIds.length > 0
      ? supabase.from('team_players').select('*').in('team_id', teamIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('tournaments').select('*').eq('league_id', leagueId),
    supabase.from('tournament_teams').select('tournament_id, team_id'),
    supabase.from('games').select('*').eq('league_id', leagueId),
    supabase.from('app_preferences').select('dark_mode').eq('league_id', leagueId).maybeSingle(),
  ]);

  phases.parallelQueries = performance.now() - phaseStart;
  phaseStart = performance.now();

  let playersRes = playersResInitial;
  if (playersRes.error || (playersRes.data ?? []).length === 0) {
    const legacyPlayersRes = await supabase.from('players').select('*');
    if (!legacyPlayersRes.error && (legacyPlayersRes.data ?? []).length > 0) {
      playersRes = legacyPlayersRes;
    }
  }

  if (playersRes.error) throw new Error(playersRes.error.message);
  if (teamPlayersRes.error) {
    console.warn(
      '[Supabase] team_players unavailable; falling back to legacy players.team_id if present'
    );
  }
  if (tournamentsRes.error) throw new Error(tournamentsRes.error.message);
  if (junctionRes.error) throw new Error(junctionRes.error.message);
  if (gamesRes.error) throw new Error(gamesRes.error.message);
  if (prefsRes.error) throw new Error(prefsRes.error.message);

  const playerRows = (playersRes.data ?? []) as LegacyDbPlayer[];
  const teamPlayerRows = teamPlayersRes.error
    ? []
    : ((teamPlayersRes.data ?? []) as DbTeamPlayer[]);
  const tournamentRows = (tournamentsRes.data ?? []) as DbTournament[];
  const junctionRows = (junctionRes.data ?? []) as DbTournamentTeam[];
  const gameRows = (gamesRes.data ?? []) as DbGame[];

  phases.validateResponses = performance.now() - phaseStart;
  phaseStart = performance.now();

  const teamIdSet = new Set(teamIds);
  const profileById = new Map<string, DbPlayerProfile>();
  for (const row of playerRows) {
    profileById.set(row.id, {
      id: row.id,
      league_id: row.league_id ?? leagueId,
      name: row.name,
      position: row.position ?? '',
      secondary_position: row.secondary_position ?? null,
      picture: row.picture ?? null,
      height: row.height,
      weight: row.weight,
      age: row.age,
      date_of_birth: row.date_of_birth ?? null,
    });
  }

  const playersByTeam = new Map<string, Player[]>();
  const useLegacyRoster =
    teamPlayerRows.length === 0 &&
    playerRows.some((row) => row.team_id != null && teamIdSet.has(row.team_id));

  if (useLegacyRoster) {
    for (const row of playerRows) {
      if (!row.team_id || !teamIdSet.has(row.team_id)) continue;
      const profile = profileById.get(row.id) ?? {
        id: row.id,
        league_id: leagueId,
        name: row.name,
        position: row.position ?? '',
        secondary_position: row.secondary_position ?? null,
        picture: row.picture ?? null,
        height: row.height,
        weight: row.weight,
        age: row.age,
        date_of_birth: row.date_of_birth ?? null,
      };
      const list = playersByTeam.get(row.team_id) ?? [];
      list.push(
        dbPlayerToPlayer(profile, {
          number: row.number ?? 0,
          position: row.position ?? '',
          secondary_position: row.secondary_position ?? null,
        })
      );
      playersByTeam.set(row.team_id, list);
    }
  } else {
    for (const row of teamPlayerRows) {
      if (!teamIdSet.has(row.team_id)) continue;
      const profile = profileById.get(row.player_id);
      if (!profile) {
        console.warn(
          `[Supabase] team_players row missing profile: team=${row.team_id} player=${row.player_id}`
        );
        continue;
      }
      const list = playersByTeam.get(row.team_id) ?? [];
      list.push(dbPlayerToPlayer(profile, row));
      playersByTeam.set(row.team_id, list);
    }
  }

  const teamsRaw: Team[] = teamRows.map((row) =>
    dbTeamToTeam(row, dedupeTeamPlayers(playersByTeam.get(row.id) ?? []))
  );
  const { teams: teamsMeasured, changed: playerMeasurementsMigrationPending } =
    migrateTeamsPlayerMeasurements(teamsRaw);
  const teams = dedupeTeamsById(teamsMeasured);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const rosterPlayerIds = new Set<string>();
  if (useLegacyRoster) {
    for (const row of playerRows) {
      if (row.team_id && teamIdSet.has(row.team_id)) {
        rosterPlayerIds.add(row.id);
      }
    }
  } else {
    for (const row of teamPlayerRows) {
      if (teamIdSet.has(row.team_id)) {
        rosterPlayerIds.add(row.player_id);
      }
    }
  }

  const orphanPlayers: Player[] = [];
  for (const [id, profile] of profileById) {
    if (rosterPlayerIds.has(id)) continue;
    orphanPlayers.push(dbPlayerToPlayer(profile));
  }
  orphanPlayers.sort((a, b) => a.name.localeCompare(b.name));

  phases.buildTeamsAndRosters = performance.now() - phaseStart;
  phaseStart = performance.now();

  const games: Game[] = [];
  for (const row of gameRows) {
    try {
      games.push(dbGameToGame(row, teamById));
    } catch (e) {
      console.warn('[Supabase] Skipping game on load:', (e as Error).message);
    }
  }

  phases.hydrateGames = performance.now() - phaseStart;
  phaseStart = performance.now();

  const teamsByTournament = new Map<string, string[]>();
  for (const row of junctionRows) {
    const list = teamsByTournament.get(row.tournament_id) ?? [];
    list.push(row.team_id);
    teamsByTournament.set(row.tournament_id, list);
  }

  const tournaments: Tournament[] = tournamentRows.map((row) => {
    const gameIds = games.filter((g) => g.tournamentId === row.id).map((g) => g.id);
    return {
      id: row.id,
      name: row.name,
      icon: row.icon ?? undefined,
      description: row.description ?? undefined,
      year: row.year,
      month: row.month,
      teams: teamsByTournament.get(row.id) ?? [],
      games: gameIds,
      standings: row.standings ?? [],
      createdAt: row.created_at ?? undefined,
    };
  });

  phases.buildTournaments = performance.now() - phaseStart;
  phaseStart = performance.now();

  const playerStorageSchema = await detectPlayerStorageSchema();
  phases.detectSchema = performance.now() - phaseStart;

  logLoadTimings(loadStartedAt, phases, {
    teams: teams.length,
    tournaments: tournaments.length,
    games: games.length,
    players: playerRows.length,
    teamPlayers: teamPlayerRows.length,
  });

  return {
    teams,
    tournaments,
    games,
    darkMode: prefsRes.data?.dark_mode ?? false,
    orphanPlayers,
    playerMeasurementsMigrationPending,
    playerStorageSchema,
  };
}

/** Permanently remove game rows from Supabase (e.g. discarded in-progress sessions). */
export async function deleteGamesFromSupabase(gameIds: string[]): Promise<void> {
  if (!supabase || gameIds.length === 0) return;
  const { error } = await supabase.from('games').delete().in('id', gameIds);
  if (error) throw new Error(`games delete: ${error.message}`);
}

/** Removes teams (players cascade). Call after deleting games that reference them. */
export async function deleteTeamsFromSupabase(teamIds: string[]): Promise<void> {
  if (!supabase || teamIds.length === 0) return;
  const { error } = await supabase.from('teams').delete().in('id', teamIds);
  if (error) throw new Error(`teams delete: ${error.message}`);
}

export async function deletePlayersFromSupabase(playerIds: string[]): Promise<void> {
  if (!supabase || playerIds.length === 0) return;
  const { error } = await supabase.from('players').delete().in('id', playerIds);
  if (error) throw new Error(`players delete: ${error.message}`);
}

export async function saveAppDataToSupabase(
  teams: Team[],
  tournaments: Tournament[],
  games: Game[],
  darkMode: boolean,
  leagueId = DEFAULT_LEAGUE_ID
): Promise<void> {
  if (!supabase) return;

  await upsertChunks('leagues', [{ id: leagueId, name: 'My League' }], 'id');

  const normalizedTeams = dedupeTeamsById(teams);
  const teamRows = normalizedTeams.map((t) => teamToDbRow(t, leagueId));
  const schema = await detectPlayerStorageSchema();

  await upsertChunks('teams', teamRows, 'id');
  await savePlayersWithSchema(normalizedTeams, leagueId, schema);

  const tournamentRows = tournaments.map((t) => ({
    id: t.id,
    league_id: leagueId,
    name: t.name,
    icon: t.icon ?? null,
    description: t.description ?? null,
    year: t.year,
    month: t.month,
    standings: t.standings ?? [],
  }));
  await upsertChunks('tournaments', tournamentRows, 'id');

  const junctionRows: DbTournamentTeam[] = [];
  const seen = new Set<string>();
  for (const t of tournaments) {
    for (const teamId of t.teams ?? []) {
      const key = `${t.id}:${teamId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      junctionRows.push({ tournament_id: t.id, team_id: teamId });
    }
  }

  const tournamentIds = tournaments.map((t) => t.id);
  if (tournamentIds.length > 0) {
    const { error: junctionDeleteError } = await supabase
      .from('tournament_teams')
      .delete()
      .in('tournament_id', tournamentIds);
    if (junctionDeleteError) {
      throw new Error(`tournament_teams delete: ${junctionDeleteError.message}`);
    }
  }
  await upsertChunks('tournament_teams', junctionRows, 'tournament_id,team_id');

  const gameRows = games.map((g) => gameToDbRow(g, leagueId));
  await upsertChunks('games', gameRows, 'id');

  const { error: prefError } = await supabase.from('app_preferences').upsert(
    { league_id: leagueId, dark_mode: darkMode },
    { onConflict: 'league_id' }
  );
  if (prefError) throw new Error(prefError.message);
}
