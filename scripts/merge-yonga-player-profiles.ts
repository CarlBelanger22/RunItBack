/**
 * Merge duplicate Hendrick/Hendrix Yonga player profiles into one canonical record.
 *
 *   npx tsx scripts/merge-yonga-player-profiles.ts --dry-run
 *   npx tsx scripts/merge-yonga-player-profiles.ts
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const DUPLICATE = 'player-ina-nt-2026-21-yonga';
const CANONICAL = 'player-asg19-indonesia-hendrix-xavi-yonga';
const INA_TEAM_ID = 'team-ina-mens-nt-2026';
const GAME_ID = 'game-2026-08-14-ina-sgp';

const dryRun = process.argv.includes('--dry-run');

type GameStat = { playerId: string; [key: string]: unknown };

function rewritePlayerId<T extends { playerId?: string }>(rows: T[]): T[] {
  return rows.map((row) =>
    row.playerId === DUPLICATE ? { ...row, playerId: CANONICAL } : row
  );
}

async function main() {
  loadEnvLocalIntoProcess();
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id, game_stats')
    .eq('id', GAME_ID)
    .maybeSingle();
  if (gameErr) throw gameErr;
  if (!game) throw new Error(`Game not found: ${GAME_ID}`);

  const stats = (game.game_stats ?? []) as GameStat[];
  const duplicateStat = stats.find((s) => s.playerId === DUPLICATE);
  const canonicalStat = stats.find((s) => s.playerId === CANONICAL);
  if (!duplicateStat) {
    console.log('No duplicate stat row in game — stats may already be merged.');
  } else if (canonicalStat) {
    throw new Error(
      `Both duplicate and canonical stat rows exist in ${GAME_ID}; manual merge required.`
    );
  }

  const nextStats = rewritePlayerId(stats);
  console.log(
    dryRun ? '[dry-run]' : '[apply]',
    `Rewrite ${GAME_ID} game_stats playerId ${DUPLICATE} → ${CANONICAL}`
  );
  if (!dryRun) {
    const { error } = await supabase
      .from('games')
      .update({ game_stats: nextStats })
      .eq('id', GAME_ID);
    if (error) throw error;
  }

  console.log(
    dryRun ? '[dry-run]' : '[apply]',
    `Delete team_players ${DUPLICATE} on ${INA_TEAM_ID}`
  );
  if (!dryRun) {
    const { error } = await supabase
      .from('team_players')
      .delete()
      .eq('team_id', INA_TEAM_ID)
      .eq('player_id', DUPLICATE);
    if (error) throw error;
  }

  console.log(
    dryRun ? '[dry-run]' : '[apply]',
    `Delete tournament_rosters rows for ${DUPLICATE}`
  );
  if (!dryRun) {
    const { error } = await supabase
      .from('tournament_rosters')
      .delete()
      .eq('player_id', DUPLICATE);
    if (error) throw error;
  }

  console.log(dryRun ? '[dry-run]' : '[apply]', `Delete player ${DUPLICATE}`);
  if (!dryRun) {
    const { error } = await supabase.from('players').delete().eq('id', DUPLICATE);
    if (error) throw error;
  }

  console.log('Done. Canonical player:', CANONICAL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
