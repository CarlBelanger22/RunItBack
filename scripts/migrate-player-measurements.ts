/**
 * One-time migration: normalize player height (cm) and weight (kg) in Supabase.
 * Usage: npx tsx scripts/migrate-player-measurements.ts
 *        npx tsx scripts/migrate-player-measurements.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { migratePlayerMeasurements } from '../src/lib/playerMeasurements';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or service role key).');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data: rows, error } = await supabase.from('players').select('id, height, weight');

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let updated = 0;
  for (const row of rows ?? []) {
    const migrated = migratePlayerMeasurements({
      id: row.id,
      name: '',
      number: 0,
      position: 'PG',
      height: row.height ?? '',
      weight: row.weight ?? '',
      age: 0,
    });

    const nextHeight = migrated.height ?? '';
    const nextWeight = migrated.weight ?? '';
    if (nextHeight === (row.height ?? '') && nextWeight === (row.weight ?? '')) {
      continue;
    }

    console.log(
      `${row.id}: height "${row.height}" -> "${nextHeight}", weight "${row.weight}" -> "${nextWeight}"`
    );

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('players')
        .update({ height: nextHeight, weight: nextWeight })
        .eq('id', row.id);
      if (updateError) {
        console.error(`Failed ${row.id}:`, updateError.message);
        process.exit(1);
      }
    }
    updated++;
  }

  console.log(
    dryRun
      ? `[dry-run] Would update ${updated} player(s).`
      : `Updated ${updated} player(s).`
  );
}

main();
