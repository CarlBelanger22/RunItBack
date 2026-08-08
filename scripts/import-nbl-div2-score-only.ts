/**
 * Import NBL Div 2 2024 score-only JSON bundles (LE-130).
 *
 * Usage:
 *   npm run import:nbl-div2-score-only
 *   npm run import:nbl-div2-score-only -- --dry-run
 */

import { execSync } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { allNewScoreOnlyGames } from './nbl-div2-schedule-data';

const JSON_DIR = join(
  resolve(process.cwd(), 'Importingboxscores', 'NBL Div 2 2024'),
  'json'
);

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const expected = allNewScoreOnlyGames();
  const expectedIds = new Set(expected.map((g) => g.id));

  if (!existsSync(JSON_DIR)) {
    console.error(`Missing ${JSON_DIR}. Run build-nbl-div2-score-only-imports.ts first.`);
    process.exit(1);
  }

  const files = readdirSync(JSON_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const toImport = expected
    .map((g) => `${g.id}.json`)
    .filter((f) => files.includes(f));

  if (toImport.length !== expected.length) {
    throw new Error(
      `missing JSON bundles: expected ${expected.length}, found ${toImport.length}`
    );
  }

  for (const file of files) {
    const id = file.replace(/\.json$/, '');
    if (!expectedIds.has(id)) {
      console.warn(`Skipping unexpected file: ${file}`);
    }
  }

  console.log(
    `${dryRun ? 'Dry-run' : 'Importing'} ${toImport.length} NBL Div 2 score-only games…\n`
  );

  for (const file of toImport) {
    const rel = join('Importingboxscores', 'NBL Div 2 2024', 'json', file);
    const cmd = `npm run import:boxscore -- --file "${rel}"${dryRun ? ' --dry-run' : ''} --stats-only`;
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  }

  console.log(
    `\n${dryRun ? 'Dry run' : 'Import'} complete (${toImport.length} games).`
  );
  if (!dryRun) {
    console.log('Next: npx tsx scripts/apply-nbl-div2-finish.ts');
  }
}

main();
