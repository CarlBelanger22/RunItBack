/**
 * Restore tournament.description from raw-tables backup (patches existing rows only).
 *
 * Usage:
 *   npm run restore:tournament-descriptions -- --dry-run
 *   npm run restore:tournament-descriptions -- --apply
 *   npm run restore:tournament-descriptions -- --file backups/.../raw-tables.json --apply
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { requireSupabaseCliClient } from './lib/supabaseCli';

const DEFAULT_BACKUP = 'backups/milestone-2026-08-18-failsafe/raw-tables.json';

interface RawBackupPayload {
  tables: {
    tournaments: { id: string; name: string; description: string | null }[];
  };
}

function parseArgs(): { file: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let file = DEFAULT_BACKUP;
  let dryRun = !args.includes('--apply');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      file = resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--apply') {
      dryRun = false;
    }
  }

  return { file, dryRun };
}

async function main(): Promise<void> {
  const { file, dryRun } = parseArgs();
  const payload = JSON.parse(readFileSync(file, 'utf8')) as RawBackupPayload;
  const patches = payload.tables.tournaments
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description?.trim() || null,
    }))
    .filter((row) => row.description);

  if (patches.length === 0) {
    console.log('No tournament descriptions found in backup.');
    return;
  }

  const supabase = requireSupabaseCliClient();
  const { data: current, error: fetchError } = await supabase
    .from('tournaments')
    .select('id, name, description');

  if (fetchError) {
    throw new Error(`fetch tournaments: ${fetchError.message}`);
  }

  const currentById = new Map((current ?? []).map((row) => [row.id, row]));
  const toApply = patches.filter((patch) => {
    const live = currentById.get(patch.id);
    if (!live) return false;
    const liveDesc = (live.description as string | null)?.trim() || '';
    return liveDesc !== patch.description;
  });

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Would restore ${toApply.length} / ${patches.length} descriptions from ${file}`
  );

  for (const patch of toApply) {
    const live = currentById.get(patch.id)!;
    const liveDesc = (live.description as string | null)?.trim() || '(empty)';
    console.log(`  ${patch.name} (${patch.id})`);
    console.log(`    current: ${liveDesc}`);
    console.log(`    restore: ${patch.description}`);
  }

  const missing = patches.filter((patch) => !currentById.has(patch.id));
  if (missing.length > 0) {
    console.log(`Skipping ${missing.length} backup tournaments not in DB:`);
    for (const row of missing) {
      console.log(`  ${row.name} (${row.id})`);
    }
  }

  if (dryRun || toApply.length === 0) {
    return;
  }

  for (const patch of toApply) {
    const { error } = await supabase
      .from('tournaments')
      .update({ description: patch.description })
      .eq('id', patch.id);
    if (error) {
      throw new Error(`update ${patch.id}: ${error.message}`);
    }
  }

  console.log(`Restored ${toApply.length} tournament descriptions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
