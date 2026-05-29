/**
 * Import a structured box score JSON bundle → Supabase
 *
 * Usage:
 *   npm run import:boxscore -- --file "Importingboxscores/sunig 2025/game-2025-09-19-ntu-sutd.json"
 *   npm run import:boxscore -- --file "Importingboxscores/sunig 2025/game-2025-09-19-ntu-sutd.json" --dry-run
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
    console.error(
      'Usage: npm run import:boxscore -- --file path/to/game.json [--dry-run] [--league-id league-default]'
    );
    process.exit(1);
  }

  return { file: resolve(process.cwd(), file), dryRun, leagueId };
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
    icon: null,
    description: null,
    current_tournament_id: team.currentTournamentId ?? bundle.tournament.id,
  }));

  const playerRows = bundle.teams.flatMap((team) =>
    (team.players ?? []).map((player) => ({
      id: player.id,
      team_id: team.id,
      name: player.name,
      number: player.number,
      position: player.position,
      secondary_position: player.secondaryPosition ?? null,
      picture: null,
      height: player.height ?? '',
      weight: player.weight ?? '',
      age: player.age ?? 0,
      date_of_birth: null,
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
    team_stats: bundle.game.teamStats,
    shots: bundle.game.shots,
    events: bundle.game.events,
    lineup_stints: bundle.game.lineupStints,
  };

  const summary = {
    file,
    league: leagueId,
    tournament: bundle.tournament.name,
    teams: teamRows.length,
    players: playerRows.length,
    tournament_teams: tournamentTeamRows.length,
    game: gameRow.id,
    score: `${homeTeam.abbreviation} ${bundle.game.finalScore.home} – ${awayTeam.abbreviation} ${bundle.game.finalScore.away}`,
    game_stats_rows: bundle.game.gameStats.length,
    dry_run: dryRun,
  };

  console.log('\nRunItBack box score import');
  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log('\nDry run complete — no writes performed.');
    return;
  }

  const supabase = createClient(url, key);

  await upsertBatch(supabase, 'leagues', [{ id: leagueId, name: 'My League' }], 'id', false);
  await upsertBatch(supabase, 'teams', teamRows, 'id', false);
  await upsertBatch(supabase, 'players', playerRows, 'id', false);
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
