/**
 * Re-import box score JSON bundles to restore wiped game_stats in Supabase.
 * Usage: npm run restore:game-stats
 *        npm run restore:game-stats -- --dry-run
 */

import { readFileSync } from 'fs';
import { globSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

function isBoxScoreBundle(path: string): boolean {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as {
      game?: unknown;
      tournament?: unknown;
      teams?: unknown[];
    };
    return Boolean(data.game && data.tournament && Array.isArray(data.teams));
  } catch {
    return false;
  }
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const importRoot = 'Importingboxscores';
  const candidates = globSync('**/*.json', { cwd: importRoot }).sort();

  const bundles = candidates
    .map((rel) => resolve(importRoot, rel))
    .filter(isBoxScoreBundle);
  console.log(`RunItBack — restore game stats from ${bundles.length} JSON bundle(s)\n`);
  if (dryRun) console.log('DRY RUN\n');

  let ok = 0;
  let fail = 0;

  for (const file of bundles) {
    const rel = file.startsWith(process.cwd())
      ? file.slice(process.cwd().length + 1)
      : file;
    if (dryRun) {
      console.log(`[dry-run] would import: ${rel}`);
      ok++;
      continue;
    }

    try {
      execSync(`npm run import:boxscore -- --file "${rel}" --stats-only`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      ok++;
    } catch {
      console.error(`FAILED: ${rel}`);
      fail++;
    }
  }

  console.log(`\nDone. ${ok} succeeded, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main();
