/**
 * Seed FIBA tournament_rosters for MAS + HKG (incl. DNP Reid).
 *
 *   npx tsx scripts/seed-fiba-mas-hkg-tournament-rosters.ts --dry-run
 *   npx tsx scripts/seed-fiba-mas-hkg-tournament-rosters.ts
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const TOURNAMENT_ID = 'tournament-1787937458049';
const MAS_ID = 'team-mas-mens-nt-2026';
const HKG_ID = 'team-hkg-mens-nt-2026';
const dryRun = process.argv.includes('--dry-run');

loadEnvLocalIntoProcess();

async function main() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: teamPlayers, error } = await supabase
    .from('team_players')
    .select('team_id,player_id,number')
    .in('team_id', [MAS_ID, HKG_ID]);
  if (error) throw error;

  const playerIds = (teamPlayers ?? []).map((r) => r.player_id);
  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('id,position,secondary_position')
    .in('id', playerIds);
  if (pErr) throw pErr;
  const byId = new Map((players ?? []).map((p) => [p.id, p]));

  const rows = (teamPlayers ?? []).map((tp) => {
    const p = byId.get(tp.player_id);
    return {
      tournament_id: TOURNAMENT_ID,
      team_id: tp.team_id,
      player_id: tp.player_id,
      number: tp.number,
      position: p?.position ?? '',
      secondary_position: p?.secondary_position ?? null,
    };
  });

  console.log(dryRun ? '[dry-run]' : '[apply]', 'upsert', rows.length, 'tournament_rosters');
  console.log(
    'includes Reid:',
    rows.some((r) => r.player_id === 'player-hkg-nt-2026-33-reid')
  );

  if (!dryRun && rows.length > 0) {
    const { error: upErr } = await supabase
      .from('tournament_rosters')
      .upsert(rows, { onConflict: 'tournament_id,team_id,player_id' });
    if (upErr) throw upErr;
  }

  // Verify game + enrollment
  const { data: game } = await supabase
    .from('games')
    .select('id,final_score_home,final_score_away,is_completed,is_active')
    .eq('id', 'game-2026-08-28-fiba-mas-hkg')
    .maybeSingle();
  const { data: enrolled } = await supabase
    .from('tournament_teams')
    .select('team_id')
    .eq('tournament_id', TOURNAMENT_ID);
  console.log('game', game);
  console.log(
    'tournament teams',
    enrolled?.map((e) => e.team_id).sort()
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
