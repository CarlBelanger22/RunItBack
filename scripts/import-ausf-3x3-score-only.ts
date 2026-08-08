/**
 * Import all AUSF 3x3 score-only JSON bundles to Supabase (LE-128).
 *
 * Usage:
 *   npm run import:ausf-3x3-score-only
 *   npm run import:ausf-3x3-score-only -- --dry-run
 */

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';
import { SCORE_ONLY_GAMES } from './ausf-3x3-schedule-data';

const JSON_DIR = join(
  resolve(process.cwd(), 'Importingboxscores', 'AUSF 3x3'),
  'json'
);

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const expectedIds = new Set(SCORE_ONLY_GAMES.map((g) => g.id));

  const files = readdirSync(JSON_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.error(
      `No JSON files in ${JSON_DIR}. Run build-ausf-3x3-score-only-imports.ts first.`
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
    `${dryRun ? 'Dry-run' : 'Importing'} ${toImport.length} AUSF 3x3 score-only games…\n`
  );

  for (const file of toImport) {
    const rel = join('Importingboxscores', 'AUSF 3x3', 'json', file);
    const cmd = `npm run import:boxscore -- --file "${rel}"${dryRun ? ' --dry-run' : ''} --stats-only`;
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  }

  console.log(
    `\n${dryRun ? 'Dry run' : 'Import'} complete (${toImport.length} games).`
  );
  if (!dryRun) {
    console.log(
      'Next: set up groups + 12-Team bracket in the Structure editor (LE-128b / manual).'
    );
  }
}

main();
