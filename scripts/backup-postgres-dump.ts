/**
 * Postgres pg_dump wrapper (requires local pg_dump + SUPABASE_DB_URL).
 *
 * Usage:
 *   npm run backup:postgres
 *   npm run backup:postgres -- --out backups/milestone-.../postgres.dump
 */

import { execSync } from 'child_process';
import { mkdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { DEFAULT_MILESTONE_SLUG, ensureMilestoneDir } from './lib/backupPaths';
import { requireDbUrl } from './lib/supabaseCli';

function parseArgs(): { out: string; slug: string } {
  const args = process.argv.slice(2);
  let out = '';
  let slug = DEFAULT_MILESTONE_SLUG;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      out = resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--slug' && args[i + 1]) {
      slug = args[++i];
    }
  }

  if (!out) {
    out = resolve(ensureMilestoneDir(process.cwd(), slug), 'postgres.dump');
  }

  return { out, slug };
}

function hasPgDump(): boolean {
  try {
    execSync('command -v pg_dump', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function main(): void {
  const { out } = parseArgs();
  mkdirSync(dirnameSafe(out), { recursive: true });

  console.log('RunItBack — Postgres pg_dump\n');

  if (!hasPgDump()) {
    console.warn('SKIP: pg_dump not found on PATH.');
    console.warn('Install Postgres client tools, then re-run: npm run backup:postgres');
    console.warn('Until then, use raw-tables.json from: npm run backup:supabase-raw');
    process.exit(0);
  }

  const dbUrl = requireDbUrl();
  execSync(`pg_dump "${dbUrl}" -F c -f "${out}"`, {
    stdio: 'inherit',
    env: process.env,
  });

  const size = statSync(out).size;
  console.log(`\nWrote ${out} (${(size / 1024 / 1024).toFixed(2)} MB)`);
}

function dirnameSafe(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '.' : filePath.slice(0, idx);
}

main();
