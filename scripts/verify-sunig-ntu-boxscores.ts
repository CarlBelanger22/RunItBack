/**
 * Verify Sunig Sep 26 / Oct 3 NTU away box scores resolve after trackBothTeams fix.
 * Run: npx tsx scripts/verify-sunig-ntu-boxscores.ts
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import {
  getGameLeaders,
  isScoreOnlyTeam,
  playerPlayedInGame,
  resolveTeamTotals,
} from '../src/utils/gameDisplay';

loadEnvLocalIntoProcess();

const GAME_IDS = [
  'game-sunig-2025-09-26-nus-ntu',
  'game-sunig-2025-10-03-nus-ntu',
];

async function main(): Promise<void> {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();

  let allPass = true;
  for (const id of GAME_IDS) {
    const game = data.games.find((g) => g.id === id);
    if (!game) {
      console.log(`${id}: NOT FOUND`);
      allPass = false;
      continue;
    }

    const awayScoreOnly = isScoreOnlyTeam(game, 'away');
    const awayTotals = resolveTeamTotals(game, 'away');
    const awayPlayed = game.awayTeam.players.filter((p) =>
      playerPlayedInGame(game, p.id, game.awayTeam.id)
    ).length;
    const points = getGameLeaders(game, 'points');
    const rebounds = getGameLeaders(game, 'rebounds');

    const pass =
      !awayScoreOnly &&
      awayPlayed > 0 &&
      (points?.value ?? 0) > 0 &&
      awayTotals.points === (game.finalScore?.away ?? 0);

    console.log(`--- ${id} ---`);
    console.log(
      `  ${game.date} | ${game.homeTeam.abbreviation} ${game.finalScore?.home} - ${game.awayTeam.abbreviation} ${game.finalScore?.away}`
    );
    console.log(`  away score-only?: ${awayScoreOnly} (expect false)`);
    console.log(`  away players w/ minutes: ${awayPlayed}`);
    console.log(`  away totals PTS: ${awayTotals.points}`);
    console.log(
      `  leading scorer: ${points ? `${points.names.join(', ')} (${points.value})` : 'NONE'}`
    );
    console.log(
      `  leading rebounder: ${rebounds ? `${rebounds.names.join(', ')} (${rebounds.value})` : 'NONE'}`
    );
    console.log(`  PASS: ${pass}`);
    if (!pass) allPass = false;
  }

  if (!allPass) process.exit(1);
  console.log('\nAll Sunig NTU box score checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
