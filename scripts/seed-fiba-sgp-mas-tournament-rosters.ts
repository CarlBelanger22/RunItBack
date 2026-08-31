/**
 * Upsert FIBA jersey numbers onto tournament_rosters for SGP + MAS.
 * Does not change club team_players.numbers.
 *
 *   npx tsx scripts/seed-fiba-sgp-mas-tournament-rosters.ts --dry-run
 *   npx tsx scripts/seed-fiba-sgp-mas-tournament-rosters.ts
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const TOURNAMENT_ID = 'tournament-1787937458049';
const SGP_ID = 'team-1786634408294';
const MAS_ID = 'team-mas-mens-nt-2026';
const dryRun = process.argv.includes('--dry-run');

/** FIBA sheet jersey # for this tournament */
const FIBA_JERSEYS: Array<{ teamId: string; playerId: string; number: number }> = [
  // SGP
  { teamId: SGP_ID, playerId: 'player-1786719720297', number: 1 },
  { teamId: SGP_ID, playerId: 'player-1786719611267', number: 3 },
  { teamId: SGP_ID, playerId: 'player-sunig-ntu-4', number: 4 },
  { teamId: SGP_ID, playerId: 'player-1787024206829', number: 7 },
  { teamId: SGP_ID, playerId: 'player-sunig-ntu-8', number: 8 },
  { teamId: SGP_ID, playerId: 'player-1786719502718', number: 10 },
  { teamId: SGP_ID, playerId: 'player-1786804530745', number: 13 },
  { teamId: SGP_ID, playerId: 'player-1787024264973', number: 14 }, // Jeryl DNP
  { teamId: SGP_ID, playerId: 'player-1787024297348', number: 18 },
  { teamId: SGP_ID, playerId: 'player-sunig-ntu-22', number: 22 },
  { teamId: SGP_ID, playerId: 'player-1786720346120', number: 24 },
  { teamId: SGP_ID, playerId: 'player-1786719974252', number: 27 },
  // MAS
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-01-hiew', number: 1 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-03-tiong', number: 3 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-05-mahadevan', number: 5 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-09-lee', number: 9 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-10-munnesvicky', number: 10 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-11-wong', number: 11 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-12-bosango', number: 12 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-15-chin', number: 15 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-18-lee', number: 18 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-24-tan', number: 24 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-27-ting', number: 27 },
  { teamId: MAS_ID, playerId: 'player-mas-nt-2026-71-ong', number: 71 },
];

loadEnvLocalIntoProcess();

async function main() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
  );

  const playerIds = FIBA_JERSEYS.map((r) => r.playerId);
  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('id,position,secondary_position')
    .in('id', playerIds);
  if (pErr) throw pErr;
  const byId = new Map((players ?? []).map((p) => [p.id, p]));

  const rows = FIBA_JERSEYS.map((r) => {
    const p = byId.get(r.playerId);
    return {
      tournament_id: TOURNAMENT_ID,
      team_id: r.teamId,
      player_id: r.playerId,
      number: r.number,
      position: p?.position ?? '',
      secondary_position: p?.secondary_position ?? null,
    };
  });

  console.log(dryRun ? '[dry-run]' : '[apply]', 'upsert', rows.length, 'roster rows');
  console.log(
    'SGP FIBA #s:',
    rows.filter((r) => r.team_id === SGP_ID).map((r) => r.number)
  );
  console.log(
    'includes Jeryl #14:',
    rows.some((r) => r.player_id === 'player-1787024264973' && r.number === 14)
  );

  if (!dryRun) {
    const { error } = await supabase
      .from('tournament_rosters')
      .upsert(rows, { onConflict: 'tournament_id,team_id,player_id' });
    if (error) throw error;
  }

  const { data: game } = await supabase
    .from('games')
    .select('id,final_score_home,final_score_away,is_completed,game_stats')
    .eq('id', 'game-2026-08-30-fiba-sgp-mas')
    .maybeSingle();
  const stats = (game?.game_stats ?? []) as Array<{ playerId: string }>;
  console.log('game', {
    id: game?.id,
    score: `${game?.final_score_home}-${game?.final_score_away}`,
    completed: game?.is_completed,
    rows: stats.length,
    hasJerylStats: stats.some((s) => s.playerId === 'player-1787024264973'),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
