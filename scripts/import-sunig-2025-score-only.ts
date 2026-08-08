/**
 * Import all SUniG 2025 score-only JSON bundles to Supabase (LE-110).
 *
 * Usage:
 *   npm run import:sunig-2025-score-only
 *   npm run import:sunig-2025-score-only -- --dry-run
 */

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';
import { SCORE_ONLY_GAMES } from './sunig-2025-schedule-data';

const JSON_DIR = join(resolve(process.cwd(), 'Importingboxscores', 'sunig 2025'), 'json');

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const expectedIds = new Set(SCORE_ONLY_GAMES.map((g) => g.id));

  const files = readdirSync(JSON_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.error(
      `No JSON files in ${JSON_DIR}. Run build-sunig-2025-score-only-imports.ts first.`
    );
    process.exit(1);
  }

  for (const file of files) {
    const id = file.replace(/\.json$/, '');
    if (!expectedIds.has(id)) {
      console.warn(`Skipping unexpected file: ${file}`);
    }
  }

  const toImport = SCORE_ONLY_GAMES.map((g) => `${g.id}.json`).filter((f) =>
    files.includes(f)
  );
  if (toImport.length !== SCORE_ONLY_GAMES.length) {
    throw new Error(
      `missing expected JSON bundles: expected ${SCORE_ONLY_GAMES.length}, got ${toImport.length}`
    );
  }

  console.log(
    `${dryRun ? 'Dry-run' : 'Importing'} ${toImport.length} SUniG 2025 score-only games…\n`
  );

  for (const file of toImport) {
    const rel = join('Importingboxscores', 'sunig 2025', 'json', file);
    const cmd = `npm run import:boxscore -- --file "${rel}"${dryRun ? ' --dry-run' : ''} --stats-only`;
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  }

  console.log(`\n${dryRun ? 'Dry run' : 'Import'} complete (${toImport.length} games).`);
}

main();
