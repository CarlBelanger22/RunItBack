/**
 * Add team_coach zeros to games.team_stats where missing (surgical JSON merge).
 *
 * Usage:
 *   npx tsx scripts/backfill-team-coach-stats.ts --dry-run
 *   npx tsx scripts/backfill-team-coach-stats.ts
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { EMPTY_TEAM_COACH } from '../src/utils/teamCoachStats';

loadEnvLocalIntoProcess();

type TeamStatsSide = Record<string, unknown>;

function ensureTeamCoach(side: TeamStatsSide): {
  merged: TeamStatsSide;
  changed: boolean;
} {
  if (side.team_coach != null) {
    return { merged: side, changed: false };
  }
  return {
    merged: { ...side, team_coach: { ...EMPTY_TEAM_COACH } },
    changed: true,
  };
}

function mergeTeamStats(raw: unknown): { merged: unknown; changed: boolean } {
  if (!raw || typeof raw !== 'object') return { merged: raw, changed: false };
  const stats = raw as { home?: TeamStatsSide; away?: TeamStatsSide };
  let changed = false;
  const home = stats.home
    ? ensureTeamCoach(stats.home)
    : { merged: stats.home, changed: false };
  const away = stats.away
    ? ensureTeamCoach(stats.away)
    : { merged: stats.away, changed: false };
  changed = home.changed || away.changed;
  if (!changed) return { merged: raw, changed: false };
  return {
    merged: { ...stats, home: home.merged, away: away.merged },
    changed: true,
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.from('games').select('id, team_stats');
  if (error) throw new Error(error.message);

  let patched = 0;
  for (const row of data ?? []) {
    const { merged, changed } = mergeTeamStats(row.team_stats);
    if (!changed) continue;
    patched++;
    console.log(`  patch ${row.id}`);
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('games')
        .update({ team_stats: merged })
        .eq('id', row.id as string);
      if (updateError) throw new Error(`${row.id}: ${updateError.message}`);
    }
  }

  console.log(
    `\n${dryRun ? '[dry-run] would patch' : 'Patched'} ${patched} game(s) (team_coach added).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
