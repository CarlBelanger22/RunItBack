/**
 * Verify tournament_rosters match game-stats-only rule (Ram regression).
 * Usage: npm run verify:tournament-rosters
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import {
  buildTournamentRostersFromGames,
  findTournamentByNameHint,
  isPlayerOnTournamentRoster,
  RAM_SUNDA_PUTRA_PLAYER_ID,
} from '../src/utils/tournamentRosters';

loadEnvLocalIntoProcess();

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');

  console.log('RunItBack — verify tournament_rosters\n');

  const data = await loadAppDataFromSupabase();
  const expected = buildTournamentRostersFromGames(data.games, data.teams);
  const stored = data.tournamentRosters;

  const storedKeys = new Set(
    stored.map((r) => `${r.tournamentId}:${r.teamId}:${r.playerId}`)
  );
  const expectedKeys = new Set(
    expected.entries.map((r) => `${r.tournamentId}:${r.teamId}:${r.playerId}`)
  );

  let missing = 0;
  for (const key of expectedKeys) {
    if (!storedKeys.has(key)) missing++;
  }
  let extra = 0;
  for (const key of storedKeys) {
    if (!expectedKeys.has(key)) extra++;
  }

  console.log(`Stored rows: ${stored.length}`);
  console.log(`Expected from games: ${expected.entries.length}`);
  console.log(`Missing from DB: ${missing}`);
  console.log(`Extra in DB (not from games): ${extra}`);

  assert(missing === 0, `${missing} expected roster rows missing from Supabase`);
  assert(extra === 0, `${extra} roster rows in DB without game participation`);

  const kaiXuan = data.teams.find(
    (t) =>
      t.name.toLowerCase().includes('kai xuan') ||
      t.abbreviation.toLowerCase() === 'kx'
  );
  const nbl2024 = findTournamentByNameHint(data.tournaments, 'nbl div 2 2024');
  const gemilangU21 = findTournamentByNameHint(data.tournaments, 'gemilang cup u21');

  if (kaiXuan && nbl2024) {
    assert(
      isPlayerOnTournamentRoster(
        RAM_SUNDA_PUTRA_PLAYER_ID,
        nbl2024.id,
        kaiXuan.id,
        stored
      ),
      'Ram should be on Kai Xuan roster for NBL Div 2 2024'
    );
  } else {
    console.warn('Skip Ram NBL check — Kai Xuan or NBL Div 2 2024 not found');
  }

  if (kaiXuan && gemilangU21) {
    assert(
      !isPlayerOnTournamentRoster(
        RAM_SUNDA_PUTRA_PLAYER_ID,
        gemilangU21.id,
        kaiXuan.id,
        stored
      ),
      'Ram should NOT be on Kai Xuan roster for Gemilang Cup U21'
    );
  } else {
    console.warn('Skip Ram U21 check — Kai Xuan or Gemilang Cup U21 not found');
  }

  if (expected.conflicts.length > 0) {
    console.warn(
      `Warning: ${expected.conflicts.length} in-tournament multi-team conflicts in game data`
    );
  }

  console.log('\nAll checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
