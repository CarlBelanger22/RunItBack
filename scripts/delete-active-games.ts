/**
 * Remove in-progress (active) games from Supabase.
 * Usage: npx tsx scripts/delete-active-games.ts
 *        npx tsx scripts/delete-active-games.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: all, error: listError } = await supabase
    .from('games')
    .select('id, date, is_active, is_completed, final_score_home, final_score_away');

  if (listError) {
    console.error(listError.message);
    process.exit(1);
  }

  const active = (all ?? []).filter(
    (g) =>
      g.is_active ||
      (!g.is_completed && g.final_score_home == null && g.final_score_away == null)
  );

  if (!active.length) {
    console.log('No active games found.');
    return;
  }

  console.log(`Found ${active.length} in-progress or incomplete game(s) to remove:`);
  for (const g of active) {
    console.log(`  - ${g.id} (date: ${g.date})`);
  }

  if (dryRun) {
    console.log('Dry run — no rows deleted.');
    return;
  }

  const ids = active.map((g) => g.id);
  const { error: deleteError } = await supabase.from('games').delete().in('id', ids);

  if (deleteError) {
    console.error('Delete failed:', deleteError.message);
    process.exit(1);
  }

  console.log(`Deleted ${ids.length} game(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
