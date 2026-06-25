/**
 * Restore teams/tournaments.icon from existing files in team-assets Storage.
 *
 * Usage:
 *   npm run restore:team-icons-from-storage -- --dry-run
 *   npm run restore:team-icons-from-storage -- --apply
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  TEAM_ASSETS_BUCKET,
  getEntityIconPublicUrl,
  type TeamAssetKind,
} from '../src/lib/teamAssetStorage';

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function listAllObjects(
  supabase: ReturnType<typeof createClient>,
  prefix: string
): Promise<string[]> {
  const names: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage
      .from(TEAM_ASSETS_BUCKET)
      .list(prefix, { limit: 100, offset });
    if (error) throw new Error(`storage list ${prefix}: ${error.message}`);
    if (!data?.length) break;
    for (const item of data) {
      if (item.name && !item.name.endsWith('/')) {
        names.push(item.name);
      }
    }
    offset += data.length;
    if (data.length < 100) break;
  }
  return names;
}

async function restoreTable(
  supabase: ReturnType<typeof createClient>,
  table: 'teams' | 'tournaments',
  kind: TeamAssetKind,
  dryRun: boolean
): Promise<number> {
  const files = await listAllObjects(supabase, kind);
  let restored = 0;

  for (const fileName of files) {
    if (!fileName.endsWith('.png')) continue;
    const entityId = fileName.replace(/\.png$/, '');
    const publicUrl = getEntityIconPublicUrl(supabase, kind, entityId);

    console.log(`${dryRun ? '[dry-run] ' : ''}${table} ${entityId} → ${publicUrl}`);

    if (dryRun) {
      restored++;
      continue;
    }

    const { error } = await supabase
      .from(table)
      .update({ icon: publicUrl })
      .eq('id', entityId);

    if (error) {
      console.warn(`  skip ${entityId}: ${error.message}`);
      continue;
    }
    restored++;
  }

  return restored;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');
  if (!dryRun && !apply) {
    console.error('Pass --dry-run or --apply');
    process.exit(1);
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log(`Restore team/tournament icons from Storage (${dryRun ? 'dry-run' : 'apply'})\n`);

  const teamCount = await restoreTable(supabase, 'teams', 'teams', dryRun);
  const tournamentCount = await restoreTable(
    supabase,
    'tournaments',
    'tournaments',
    dryRun
  );

  console.log(`\nRestored ${teamCount} team + ${tournamentCount} tournament icon URL(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
