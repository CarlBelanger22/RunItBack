/**
 * One-time import: localStorage backup JSON → Supabase
 * Usage: npm run import:local -- --file backups/runitback-data-2026-05-26.json
 *        npm run import:local -- --file backups/....json --dry-run
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_LEAGUE_ID = 'league-default';

// Minimal types matching src/App.tsx / src/utils/storage.ts
interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  secondaryPosition?: string;
  picture?: string;
  height: string;
  weight: string;
  age: number;
  dateOfBirth?: string;
}

interface Team {
  id: string;
  name: string;
  abbreviation: string;
  icon?: string;
  description?: string;
  players: Player[];
  currentTournamentId?: string;
}

interface Tournament {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  year: number;
  month: string;
  teams: string[];
  games: string[];
  standings: unknown[];
}

interface Game {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  homeTeamId: string;
  awayTeamId: string;
  tournamentId?: string;
  date: string;
  gameStats: unknown[];
  teamStats: unknown;
  shots: unknown[];
  events: unknown[];
  lineupStints: unknown[];
  currentPeriod: number;
  currentGameTime: string;
  homeStarters: string[];
  awayStarters: string[];
  trackBothTeams: boolean;
  isActive: boolean;
  isCompleted: boolean;
  finalScore?: { home: number; away: number };
}

interface StoredData {
  version?: string;
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  preferences?: { darkMode?: boolean };
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

function parseArgs(): { file: string; dryRun: boolean; leagueId: string } {
  const args = process.argv.slice(2);
  let file = '';
  let dryRun = false;
  let leagueId = DEFAULT_LEAGUE_ID;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      file = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--league-id' && args[i + 1]) {
      leagueId = args[++i];
    }
  }

  if (!file) {
    console.error('Usage: npm run import:local -- --file backups/runitback-data-....json [--dry-run] [--league-id league-default]');
    process.exit(1);
  }

  return { file: resolve(process.cwd(), file), dryRun, leagueId };
}

function teamToRow(team: Team, leagueId: string) {
  return {
    id: team.id,
    league_id: leagueId,
    name: team.name,
    abbreviation:
      team.abbreviation ||
      team.name.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 5).toUpperCase(),
    icon: team.icon ?? null,
    description: team.description ?? null,
    current_tournament_id: team.currentTournamentId ?? null,
  };
}

function playerToRow(player: Player, teamId: string) {
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
    date_of_birth: player.dateOfBirth || null,
  };
}

function gameToRow(game: Game, leagueId: string) {
  const homeId = game.homeTeamId || game.homeTeam?.id;
  const awayId = game.awayTeamId || game.awayTeam?.id;
  if (!homeId || !awayId) {
    throw new Error(`Game ${game.id} missing home/away team id`);
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
    team_stats: game.teamStats ?? {},
    shots: game.shots ?? [],
    events: game.events ?? [],
    lineup_stints: game.lineupStints ?? [],
  };
}

function collectTeams(data: StoredData): Map<string, Team> {
  const map = new Map<string, Team>();

  for (const team of data.teams) {
    map.set(team.id, team);
  }

  for (const game of data.games) {
    if (game.homeTeam?.id) map.set(game.homeTeam.id, game.homeTeam);
    if (game.awayTeam?.id) map.set(game.awayTeam.id, game.awayTeam);
  }

  return map;
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
    console.log(`  [dry-run] would upsert ${rows.length} row(s) → ${table}`);
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

async function main() {
  const { file, dryRun, leagueId } = parseArgs();
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
    process.exit(1);
  }

  const raw = readFileSync(file, 'utf8');
  const data = JSON.parse(raw) as StoredData;

  if (!data.teams || !data.tournaments || !data.games) {
    console.error('Invalid backup: expected teams, tournaments, and games arrays');
    process.exit(1);
  }

  const teamMap = collectTeams(data);
  const playerRows: ReturnType<typeof playerToRow>[] = [];
  const teamRows: ReturnType<typeof teamToRow>[] = [];

  for (const team of teamMap.values()) {
    teamRows.push(teamToRow(team, leagueId));
    for (const player of team.players ?? []) {
      playerRows.push(playerToRow(player, team.id));
    }
  }

  const tournamentRows = data.tournaments.map((t) => ({
    id: t.id,
    league_id: leagueId,
    name: t.name,
    icon: t.icon ?? null,
    description: t.description ?? null,
    year: t.year,
    month: t.month,
    standings: t.standings ?? [],
  }));

  const tournamentTeamRows: { tournament_id: string; team_id: string }[] = [];
  const seenJunction = new Set<string>();
  for (const t of data.tournaments) {
    for (const teamId of t.teams ?? []) {
      const key = `${t.id}:${teamId}`;
      if (seenJunction.has(key)) continue;
      seenJunction.add(key);
      tournamentTeamRows.push({ tournament_id: t.id, team_id: teamId });
    }
  }

  const gameRows: ReturnType<typeof gameToRow>[] = [];
  const skippedGames: string[] = [];
  const teamIds = new Set(teamRows.map((t) => t.id));

  for (const game of data.games) {
    try {
      const row = gameToRow(game, leagueId);
      if (!teamIds.has(row.home_team_id) || !teamIds.has(row.away_team_id)) {
        skippedGames.push(`${game.id} (missing team FK)`);
        continue;
      }
      gameRows.push(row);
    } catch (e) {
      skippedGames.push(`${game.id} (${(e as Error).message})`);
    }
  }

  const summary = {
    league: leagueId,
    teams: teamRows.length,
    players: playerRows.length,
    tournaments: tournamentRows.length,
    tournament_teams: tournamentTeamRows.length,
    games: gameRows.length,
    skipped_games: skippedGames.length,
    dark_mode: data.preferences?.darkMode,
  };

  console.log('\nRunItBack → Supabase import');
  console.log('File:', file);
  console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE');
  console.log('Counts to import:', summary);

  if (skippedGames.length > 0) {
    console.warn('\nSkipped games:', skippedGames);
  }

  if (dryRun) {
    console.log('\nDry run complete. Re-run without --dry-run to import.');
    return;
  }

  const supabase = createClient(url, key);

  console.log('\n1/6 Upserting league...');
  await upsertBatch(
    supabase,
    'leagues',
    [{ id: leagueId, name: 'My League' }],
    'id',
    false
  );

  console.log('2/6 Upserting teams...');
  await upsertBatch(supabase, 'teams', teamRows, 'id', false);

  console.log('3/6 Upserting players...');
  await upsertBatch(supabase, 'players', playerRows, 'id', false);

  console.log('4/6 Upserting tournaments...');
  await upsertBatch(supabase, 'tournaments', tournamentRows, 'id', false);

  console.log('5/6 Upserting tournament_teams...');
  await upsertBatch(supabase, 'tournament_teams', tournamentTeamRows, 'tournament_id,team_id', false);

  console.log('6/6 Upserting games...');
  await upsertBatch(supabase, 'games', gameRows, 'id', false);

  if (data.preferences?.darkMode !== undefined) {
    console.log('Upserting app_preferences...');
    const { error } = await supabase.from('app_preferences').upsert(
      { league_id: leagueId, dark_mode: data.preferences.darkMode },
      { onConflict: 'league_id' }
    );
    if (error) throw new Error(`app_preferences: ${error.message}`);
  }

  // Verify counts
  const tables = ['teams', 'players', 'tournaments', 'games'] as const;
  console.log('\nVerification (Supabase row counts):');
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) console.warn(`  ${table}: error ${error.message}`);
    else console.log(`  ${table}: ${count}`);
  }

  const sampleGame = gameRows[0];
  if (sampleGame) {
    const { data: row, error } = await supabase
      .from('games')
      .select('id, game_stats, team_stats, shots, events')
      .eq('id', sampleGame.id)
      .single();
    if (!error && row) {
      const gs = Array.isArray(row.game_stats) ? row.game_stats.length : 0;
      const sh = Array.isArray(row.shots) ? row.shots.length : 0;
      const ev = Array.isArray(row.events) ? row.events.length : 0;
      console.log(`\nSample game "${row.id}": game_stats=${gs} shots=${sh} events=${ev}`);
    }
  }

  console.log('\nImport complete.');
}

main().catch((err) => {
  console.error('\nImport failed:', err.message || err);
  process.exit(1);
});
