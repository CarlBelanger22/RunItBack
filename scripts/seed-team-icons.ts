/**
 * Set bundled team icon paths in Supabase.
 * Usage: npx tsx scripts/seed-team-icons.ts
 *        npx tsx scripts/seed-team-icons.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const BUNDLED_ICONS: Record<string, string> = {
  'team-sunig-ntu': '/team-logos/team-sunig-ntu.png',
};

function loadEnvLocal() {
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

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  for (const [teamId, iconPath] of Object.entries(BUNDLED_ICONS)) {
    console.log(`${dryRun ? '[dry-run] ' : ''}Update ${teamId} → icon=${iconPath}`);
    if (dryRun) continue;

    const { error } = await supabase
      .from('teams')
      .update({ icon: iconPath, updated_at: new Date().toISOString() })
      .eq('id', teamId);

    if (error) {
      console.error(`Failed ${teamId}:`, error.message);
      process.exit(1);
    }
  }

  console.log('Done.');
}

main();
