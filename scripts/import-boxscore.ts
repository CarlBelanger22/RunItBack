/**
 * Import a structured box score JSON bundle ? Supabase
 *
 * Usage:
 *   npm run import:boxscore -- --file "Importingboxscores/sunig 2025/game-2025-09-19-ntu-sutd.json"
 *   npm run import:boxscore -- --file "Importingboxscores/sunig 2025/game-2025-09-19-ntu-sutd.json" --dry-run
 *   npm run import:boxscore -- --file "Importingboxscores/sunig 2025/game-2025-09-26-nus-ntu.json" --stats-only
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_LEAGUE_ID = 'league-default';

interface PlayerRow {
  id: string;
  name: string;
  number: number;
  position: string;
  secondaryPosition?: string;
  height?: string;
  weight?: string;
  age?: number;
}

interface TeamRow {
  id: string;
  name: string;
  abbreviation: string;
  currentTournamentId?: string;
  players: PlayerRow[];
}

interface TournamentRow {
  id: string;
  name: string;
  year: number;
  month: string;
  teamIds: string[];
  icon?: string;
  description?: string;
}

interface GameRow {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  tournamentId: string;
  date: string;
  startTime?: string;
  currentPeriod: number;
  currentGameTime: string;
  trackBothTeams: boolean;
  isActive: boolean;
  isCompleted: boolean;
  finalScore: { home: number; away: number };
  homeStarters: string[];
  awayStarters: string[];
  gameStats: unknown[];
  teamStats: unknown;
  shots: unknown[];
  events: unknown[];
  lineupStints: unknown[];
}

interface BoxScoreBundle {
  version?: string;
  tournament: TournamentRow;
  teams: TeamRow[];
  game: GameRow;
}

function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    console.warn('Warning: could not read .env.local');
  }
  return env;
}

function parseArgs(): {
  file: string;
  dryRun: boolean;
  leagueId: string;
  statsOnly: boolean;
} {
  const args = process.argv.slice(2);
  let file = '';
  let dryRun = false;
  let leagueId = DEFAULT_LEAGUE_ID;
  let statsOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      file = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--stats-only') {
      statsOnly = true;
    } else if (args[i] === '--league-id' && args[i + 1]) {
      leagueId = args[++i];
    }
  }

  if (!file) {
    console.error(
      'Usage: npm run import:boxscore -- --file path/to/game.json [--dry-run] [--stats-only] [--league-id league-default]'
    );
    process.exit(1);
  }

  return { file: resolve(process.cwd(), file), dryRun, leagueId, statsOnly };
}

async function upsertBatch<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string,
  dryRun: boolean
): Promise<void> {
  if (rows.length === 0) return;
  if (dryRun) {
    console.log(`  [dry-run] would upsert ${rows.length} row(s) ? ${table}`);
    return;
  }

  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`${table} upsert failed: ${error.message}`);
    }
  }
}

interface ExistingPlayerRow {
  id: string;
  height: string | null;
  weight: string | null;
  picture: string | null;
  date_of_birth: string | null;
}

interface ExistingTeamRow {
  id: string;
  icon: string | null;
  description: string | null;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function mergePlayerRow(
  incoming: {
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
  },
  existing: ExistingPlayerRow | undefined
) {
  if (!existing) return incoming;

  return {
    ...incoming,
    height: hasText(incoming.height) ? incoming.height : (existing.height ?? ''),
    weight: hasText(incoming.weight) ? incoming.weight : (existing.weight ?? ''),
    picture: incoming.picture ?? existing.picture ?? null,
    date_of_birth: incoming.date_of_birth ?? existing.date_of_birth ?? null,
  };
}

async function loadExistingPlayers(
  supabase: SupabaseClient,
  playerIds: string[]
): Promise<Map<string, ExistingPlayerRow>> {
  const map = new Map<string, ExistingPlayerRow>();
  if (playerIds.length === 0) return map;

  const { data, error } = await supabase
    .from('players')
    .select('id, height, weight, picture, date_of_birth')
    .in('id', playerIds);

  if (error) throw new Error(`players fetch failed: ${error.message}`);
  for (const row of data ?? []) {
    map.set(row.id, row as ExistingPlayerRow);
  }
  return map;
}

async function loadExistingTeams(
  supabase: SupabaseClient,
  teamIds: string[]
): Promise<Map<string, ExistingTeamRow>> {
  const map = new Map<string, ExistingTeamRow>();
  if (teamIds.length === 0) return map;

  const { data, error } = await supabase
    .from('teams')
    .select('id, icon, description')
    .in('id', teamIds);

  if (error) throw new Error(`teams fetch failed: ${error.message}`);
  for (const row of data ?? []) {
    map.set(row.id, row as ExistingTeamRow);
  }
  return map;
}

async function loadExistingTeamIds(
  supabase: SupabaseClient,
  teamIds: string[]
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (teamIds.length === 0) return ids;

  const { data, error } = await supabase.from('teams').select('id').in('id', teamIds);
  if (error) throw new Error(`teams fetch failed: ${error.message}`);
  for (const row of data ?? []) {
    ids.add(row.id as string);
  }
  return ids;
}

async function main() {
  const { file, dryRun, leagueId, statsOnly } = parseArgs();
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
    process.exit(1);
  }

  const bundle = JSON.parse(readFileSync(file, 'utf8')) as BoxScoreBundle;

  if (!bundle.tournament || !bundle.teams?.length || !bundle.game) {
    console.error('Invalid box score JSON: expected tournament, teams[], and game');
    process.exit(1);
  }

  const teamById = new Map(bundle.teams.map((t) => [t.id, t]));
  const homeTeam = teamById.get(bundle.game.homeTeamId);
  const awayTeam = teamById.get(bundle.game.awayTeamId);

  if (!homeTeam || !awayTeam) {
    console.error('Game homeTeamId/awayTeamId must reference teams in the bundle');
    process.exit(1);
  }

  const teamRows = bundle.teams.map((team) => ({
    id: team.id,
    league_id: leagueId,
    name: team.name,
    abbreviation: team.abbreviation,
    icon: null as string | null,
    description: null as string | null,
    current_tournament_id: team.currentTournamentId ?? bundle.tournament.id,
  }));

  const playerRowsRaw = bundle.teams.flatMap((team) =>
    (team.players ?? []).map((player) => ({
      id: player.id,
      team_id: team.id,
      name: player.name,
      number: player.number,
      position: player.position,
      secondary_position: player.secondaryPosition ?? null,
      picture: null as string | null,
      height: player.height ?? '',
      weight: player.weight ?? '',
      age: player.age ?? 0,
      date_of_birth: null as string | null,
    }))
  );

  const tournamentRow = {
    id: bundle.tournament.id,
    league_id: leagueId,
    name: bundle.tournament.name,
    icon: bundle.tournament.icon ?? null,
    description: bundle.tournament.description ?? null,
    year: bundle.tournament.year,
    month: bundle.tournament.month,
    standings: [],
  };

  const tournamentTeamRows = bundle.tournament.teamIds.map((teamId) => ({
    tournament_id: bundle.tournament.id,
    team_id: teamId,
  }));

  const teamStatsPayload = bundle.game.startTime
    ? {
        ...(bundle.game.teamStats as Record<string, unknown>),
        __meta: {
          ...(((bundle.game.teamStats as Record<string, unknown>).__meta as
            | Record<string, unknown>
            | undefined) ?? {}),
          startTime: bundle.game.startTime,
        },
      }
    : bundle.game.teamStats;

  const gameRow = {
    id: bundle.game.id,
    league_id: leagueId,
    tournament_id: bundle.game.tournamentId,
    home_team_id: bundle.game.homeTeamId,
    away_team_id: bundle.game.awayTeamId,
    date: bundle.game.date,
    current_period: bundle.game.currentPeriod,
    current_game_time: bundle.game.currentGameTime,
    track_both_teams: bundle.game.trackBothTeams,
    is_active: bundle.game.isActive,
    is_completed: bundle.game.isCompleted,
    final_score_home: bundle.game.finalScore.home,
    final_score_away: bundle.game.finalScore.away,
    home_starters: bundle.game.homeStarters,
    away_starters: bundle.game.awayStarters,
    game_stats: bundle.game.gameStats,
    team_stats: teamStatsPayload,
    shots: bundle.game.shots,
    events: bundle.game.events,
    lineup_stints: bundle.game.lineupStints,
  };

  const summary = {
    file,
    league: leagueId,
    tournament: bundle.tournament.name,
    teams: teamRows.length,
    players: playerRowsRaw.length,
    tournament_teams: tournamentTeamRows.length,
    game: gameRow.id,
    score: `${homeTeam.abbreviation} ${bundle.game.finalScore.home}  ${awayTeam.abbreviation} ${bundle.game.finalScore.away}`,
    game_stats_rows: bundle.game.gameStats.length,
    stats_only: statsOnly,
    dry_run: dryRun,
  };

  console.log('\nRunItBack box score import');
  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log('\nDry run complete  no writes performed.');
    return;
  }

  const supabase = createClient(url, key);

  const teamIds = teamRows.map((t) => t.id);
  const existingTeamIds = statsOnly
    ? await loadExistingTeamIds(supabase, teamIds)
    : new Set<string>();

  let mergedTeamRows = teamRows;
  let playerRows = playerRowsRaw;

  if (statsOnly) {
    mergedTeamRows = teamRows.filter((row) => !existingTeamIds.has(row.id));
    playerRows = [];
    console.log(
      `\nStats-only mode: skipping players; upserting ${
        mergedTeamRows.length
      } new team(s): ${mergedTeamRows.map((t) => t.id).join(', ') || '(none)'}`
    );
  } else {
    const playerIds = playerRowsRaw.map((p) => p.id);
    const [existingPlayers, existingTeams] = await Promise.all([
      loadExistingPlayers(supabase, playerIds),
      loadExistingTeams(supabase, teamIds),
    ]);

    playerRows = playerRowsRaw.map((row) =>
      mergePlayerRow(row, existingPlayers.get(row.id))
    );

    mergedTeamRows = teamRows.map((row) => {
      const existing = existingTeams.get(row.id);
      if (!existing) return row;
      return {
        ...row,
        icon: row.icon ?? existing.icon ?? null,
        description: row.description ?? existing.description ?? null,
      };
    });

    let preservedProfileFields = 0;
    for (const raw of playerRowsRaw) {
      const existing = existingPlayers.get(raw.id);
      const merged = playerRows.find((p) => p.id === raw.id);
      if (!existing || !merged) continue;
      if (!hasText(raw.height) && hasText(merged.height)) preservedProfileFields++;
      if (!hasText(raw.weight) && hasText(merged.weight)) preservedProfileFields++;
    }
    if (preservedProfileFields > 0) {
      console.log(
        `\nPreserved ${preservedProfileFields} existing height/weight value(s) (JSON had blanks).`
      );
    }
  }

  await upsertBatch(supabase, 'leagues', [{ id: leagueId, name: 'My League' }], 'id', false);
  await upsertBatch(supabase, 'teams', mergedTeamRows, 'id', false);
  if (!statsOnly) {
    await upsertBatch(supabase, 'players', playerRows, 'id', false);
  }
  await upsertBatch(supabase, 'tournaments', [tournamentRow], 'id', false);
  await upsertBatch(
    supabase,
    'tournament_teams',
    tournamentTeamRows,
    'tournament_id,team_id',
    false
  );
  await upsertBatch(supabase, 'games', [gameRow], 'id', false);

  console.log('\nImport complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
