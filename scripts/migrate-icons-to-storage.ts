/**
 * Migrate inline data:image icons in teams/tournaments to Supabase Storage.
 *
 * Usage:
 *   npm run migrate:icons-to-storage -- --dry-run
 *   npm run migrate:icons-to-storage -- --apply
 *   npm run verify:icon-storage
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  isIconDataUrl,
  uploadEntityIcon,
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

interface IconRow {
  id: string;
  icon: string | null;
}

async function migrateTable(
  supabase: SupabaseClient,
  table: 'teams' | 'tournaments',
  kind: TeamAssetKind,
  dryRun: boolean
): Promise<{ migrated: number; skipped: number; bytes: number }> {
  const { data, error } = await supabase.from(table).select('id, icon');
  if (error) throw new Error(`${table} fetch: ${error.message}`);

  let migrated = 0;
  let skipped = 0;
  let bytes = 0;

  for (const row of (data ?? []) as IconRow[]) {
    const icon = row.icon;
    if (!isIconDataUrl(icon)) {
      skipped++;
      continue;
    }

    bytes += icon.length;
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${table} ${row.id}: ${(icon.length / 1024).toFixed(1)} KB data URL`
    );

    if (dryRun) {
      migrated++;
      continue;
    }

    const publicUrl = await uploadEntityIcon(supabase, kind, row.id, icon);
    const { error: updateError } = await supabase
      .from(table)
      .update({ icon: publicUrl })
      .eq('id', row.id);

    if (updateError) {
      throw new Error(`${table} update ${row.id}: ${updateError.message}`);
    }

    migrated++;
    console.log(`  -> ${publicUrl}`);
  }

  return { migrated, skipped, bytes };
}

async function verifyNoDataUrls(supabase: SupabaseClient): Promise<void> {
  let remaining = 0;

  for (const table of ['teams', 'tournaments'] as const) {
    const { data, error } = await supabase.from(table).select('id, icon');
    if (error) throw new Error(`${table} fetch: ${error.message}`);

    for (const row of data ?? []) {
      if (isIconDataUrl(row.icon as string | null)) {
        remaining++;
        console.error(`FAIL: ${table} ${row.id} still has data URL icon`);
      }
    }
  }

  if (remaining > 0) {
    console.error(`\n${remaining} inline icon(s) remain.`);
    process.exit(1);
  }

  console.log('OK: no inline data:image icons in teams or tournaments.');
}

async function main(): Promise<void> {
  loadEnvLocal();

  const verifyOnly = process.argv.includes('--verify');
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  if (verifyOnly) {
    await verifyNoDataUrls(supabase);
    return;
  }

  if (!dryRun && !apply) {
    console.error('Pass --dry-run, --apply, or --verify');
    process.exit(1);
  }

  console.log(`RunItBack icon migration (${dryRun ? 'dry-run' : 'apply'})\n`);

  const teamStats = await migrateTable(supabase, 'teams', 'teams', dryRun);
  const tournamentStats = await migrateTable(
    supabase,
    'tournaments',
    'tournaments',
    dryRun
  );

  const totalMigrated = teamStats.migrated + tournamentStats.migrated;
  const totalBytes = teamStats.bytes + tournamentStats.bytes;

  console.log('\nSummary:');
  console.log(`  teams: ${teamStats.migrated} to migrate, ${teamStats.skipped} already external`);
  console.log(
    `  tournaments: ${tournamentStats.migrated} to migrate, ${tournamentStats.skipped} already external`
  );
  console.log(`  inline bytes: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  if (apply && totalMigrated > 0) {
    await verifyNoDataUrls(supabase);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
