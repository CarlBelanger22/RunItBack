/**
 * Mark stuck NTU vs MOE friendly as completed in Supabase.
 *
 *   npx tsx scripts/patch-complete-ntu-moe-friendly.ts --dry-run
 *   npx tsx scripts/patch-complete-ntu-moe-friendly.ts
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const GAME_ID = 'game-1787483068190';
const dryRun = process.argv.includes('--dry-run');

loadEnvLocalIntoProcess();

async function main() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: game, error } = await supabase
    .from('games')
    .select('id,is_active,is_completed,game_stats,home_team_id,away_team_id,tournament_id')
    .eq('id', GAME_ID)
    .maybeSingle();
  if (error) throw error;
  if (!game) throw new Error(`Game not found: ${GAME_ID}`);

  if (game.is_completed && !game.is_active) {
    console.log('Already completed:', GAME_ID);
    return;
  }

  const stats = (game.game_stats ?? []) as Array<{ playerId: string; points: number }>;
  const homeScore = stats
    .filter((s) => s.playerId.includes('ntu'))
    .reduce((sum, s) => sum + (s.points ?? 0), 0);
  const awayScore = stats
    .filter((s) => !s.playerId.includes('ntu'))
    .reduce((sum, s) => sum + (s.points ?? 0), 0);

  const patch = {
    is_active: false,
    is_completed: true,
    current_period: 4,
    current_game_time: '00:00',
    final_score_home: homeScore,
    final_score_away: awayScore,
    tournament_id: null,
  };

  console.log(dryRun ? '[dry-run]' : '[apply]', GAME_ID, patch);
  if (!dryRun) {
    const { error: updateError } = await supabase
      .from('games')
      .update(patch)
      .eq('id', GAME_ID);
    if (updateError) throw updateError;
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
