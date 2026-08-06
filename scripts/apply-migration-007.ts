/**
 * Apply LE-95 migration (tournaments.structure jsonb).
 * Run: npm run db:migrate:007
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // no .env.local
  }
  return env;
}

function main() {
  const env = loadEnvLocal();
  const dbUrl =
    env.SUPABASE_DB_URL ||
    env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL;

  const migrationPath = resolve(
    process.cwd(),
    'supabase/migrations/007_tournament_structure.sql'
  );

  console.log('RunItBack - migration 007 (tournament structure)\n');

  if (!dbUrl) {
    console.log('No SUPABASE_DB_URL or DATABASE_URL found in .env.local.\n');
    console.log('Apply manually in Supabase Dashboard:');
    console.log('  1. Open your project -> SQL Editor -> New query');
    console.log('  2. Paste: supabase/migrations/007_tournament_structure.sql');
    console.log('  3. Click Run\n');
    process.exit(1);
  }

  try {
    execSync(`psql "${dbUrl}" -v ON_ERROR_STOP=1 -f "${migrationPath}"`, {
      stdio: 'inherit',
    });
    console.log('\nMigration 007 applied.');
  } catch {
    console.error('\npsql failed. Apply manually via Supabase SQL Editor.');
    process.exit(1);
  }
}

main();
