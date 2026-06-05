/**
 * Verify every game-stat player is on the correct team club roster.
 * Run: npm run verify:club-rosters
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { verifyClubRosters } from '../src/utils/clubRosterIntegrity';

loadEnvLocalIntoProcess();

async function main(): Promise<void> {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();
  const violations = verifyClubRosters(data.games, data.teams);

  if (violations.length === 0) {
    console.log('verify:club-rosters OK');
    return;
  }

  console.error(`FAIL: ${violations.length} violation(s)`);
  for (const v of violations) {
    console.error(`  ${v.message}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
