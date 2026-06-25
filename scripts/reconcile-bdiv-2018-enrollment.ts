/**
 * One-time repair: enroll B Div 2018 teams from games into tournament_teams.
 *
 * Touches ONLY tournament_teams for tournament-1782331320905.
 * Inserts missing rows — no delete, no writes to tournaments/teams/games metadata.
 *
 * Usage:
 *   npm run reconcile:bdiv-2018-enrollment
 *   npm run reconcile:bdiv-2018-enrollment -- --apply
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { tournamentTeamIdsFromGames } from '../src/utils/tournamentEnrollment';
import type { Game } from '../src/App';

const BDIV_TOURNAMENT_ID = 'tournament-1782331320905';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  loadEnvLocalIntoProcess();

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
  }

  const supabase = createClient(url, key);

  const { data: gameRows, error: gamesError } = await supabase
    .from('games')
    .select('id, tournament_id, home_team_id, away_team_id')
    .eq('tournament_id', BDIV_TOURNAMENT_ID);

  if (gamesError) throw new Error(`games: ${gamesError.message}`);

  const games: Game[] = (gameRows ?? []).map((row) => ({
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    homeTeamId: row.home_team_id as string,
    awayTeamId: row.away_team_id as string,
    date: '',
    gameStats: [],
    isActive: false,
    isCompleted: true,
  }));

  const { data: existingRows, error: junctionError } = await supabase
    .from('tournament_teams')
    .select('team_id')
    .eq('tournament_id', BDIV_TOURNAMENT_ID);

  if (junctionError) throw new Error(`tournament_teams: ${junctionError.message}`);

  const existingTeamIds = (existingRows ?? []).map((r) => r.team_id as string);
  const targetTeamIds = tournamentTeamIdsFromGames(
    BDIV_TOURNAMENT_ID,
    games,
    existingTeamIds
  );
  const missingTeamIds = targetTeamIds.filter((id) => !existingTeamIds.includes(id));

  console.log('NSG B Division 2018 enrollment repair');
  console.log({
    tournamentId: BDIV_TOURNAMENT_ID,
    games: games.length,
    currentlyEnrolled: existingTeamIds.length,
    targetEnrolled: targetTeamIds.length,
    toInsert: missingTeamIds.length,
    apply,
  });

  if (missingTeamIds.length > 0) {
    console.log('\nTeams to enroll:');
    for (const teamId of missingTeamIds) {
      console.log(`  ${teamId}`);
    }
  } else {
    console.log('\nNo missing enrollments — nothing to do.');
    return;
  }

  if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to insert rows.');
    return;
  }

  const insertRows = missingTeamIds.map((team_id) => ({
    tournament_id: BDIV_TOURNAMENT_ID,
    team_id,
  }));

  const { error: upsertError } = await supabase
    .from('tournament_teams')
    .upsert(insertRows, { onConflict: 'tournament_id,team_id' });

  if (upsertError) throw new Error(`tournament_teams upsert: ${upsertError.message}`);

  const { data: afterRows, error: verifyError } = await supabase
    .from('tournament_teams')
    .select('team_id')
    .eq('tournament_id', BDIV_TOURNAMENT_ID);

  if (verifyError) throw new Error(`verify: ${verifyError.message}`);

  console.log(`\nApplied. tournament_teams count: ${afterRows?.length ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
