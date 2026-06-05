/**
 * Rebuild team_players from completed game stats + jersey resolution.
 * Reconciles tournament_rosters in the same run.
 *
 * Usage:
 *   npm run rebuild:club-rosters -- --dry-run
 *   npm run rebuild:club-rosters
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import {
  applyClubLinksToTeams,
  buildClubRosterLinksFromGames,
  buildImportJsonJerseyLookup,
  mergeClubRosterLinks,
  verifyClubRosters,
} from '../src/utils/clubRosterIntegrity';
import { reconcileTournamentRostersFromGames } from '../src/utils/tournamentRosters';

loadEnvLocalIntoProcess();

function loadImportBundles(): Array<{
  teams?: Array<{
    id: string;
    players?: Array<{
      id: string;
      name: string;
      number: number;
      position: string;
      secondaryPosition?: string;
    }>;
  }>;
}> {
  const root = resolve(process.cwd(), 'Importingboxscores');
  const bundles: ReturnType<typeof loadImportBundles> = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith('.json')) continue;
      try {
        const parsed = JSON.parse(readFileSync(full, 'utf8'));
        if (parsed?.teams && parsed?.game) bundles.push(parsed);
        else if (parsed?.teams && parsed?.tournament) bundles.push(parsed);
      } catch {
        // skip invalid json
      }
    }
  }

  walk(root);
  return bundles;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const {
    loadAppDataFromSupabase,
    saveAppDataToSupabase,
    detectPlayerStorageSchema,
  } = await import('../src/api/supabaseData');

  console.log('RunItBack — rebuild club rosters from game stats\n');
  if (dryRun) console.log('DRY RUN — no writes\n');

  const data = await loadAppDataFromSupabase();
  const importBundles = loadImportBundles();
  const importJerseys = buildImportJsonJerseyLookup(importBundles);

  const derived = buildClubRosterLinksFromGames(data.games);
  const merged = mergeClubRosterLinks(derived, {
    existingTeams: data.teams,
    tournamentRosters: data.tournamentRosters,
    importJerseys,
  });

  const profileById = new Map(
    [
      ...data.teams.flatMap((t) => t.players ?? []),
      ...data.orphanPlayers,
    ].map((p) => [p.id, p])
  );

  const rebuiltTeams = applyClubLinksToTeams(data.teams, merged, profileById);
  const tournamentRosters = reconcileTournamentRostersFromGames(
    data.games,
    rebuiltTeams,
    data.tournamentRosters
  );

  const counts = rebuiltTeams
    .map((t) => ({ name: t.name, id: t.id, n: t.players?.length ?? 0 }))
    .filter((row) => row.n > 0)
    .sort((a, b) => b.n - a.n);

  console.log('Club roster counts after rebuild:');
  for (const row of counts) {
    console.log(`  ${row.name} (${row.id}): ${row.n}`);
  }
  const zeroTeams = rebuiltTeams.filter((t) => (t.players?.length ?? 0) === 0);
  console.log(`  Teams with 0 players: ${zeroTeams.length}`);

  const carlKx = rebuiltTeams
    .find((t) => t.id === 'team-1780252086140')
    ?.players?.find((p) => p.id === 'player-sunig-ntu-22');
  console.log(
    `\nCarl on Kai Xuan: ${carlKx ? `#${carlKx.number}` : 'NOT ON ROSTER'}`
  );

  const violations = verifyClubRosters(data.games, rebuiltTeams);
  if (violations.length > 0) {
    console.error(`\nVERIFY FAILED: ${violations.length} violation(s)`);
    for (const v of violations.slice(0, 10)) {
      console.error(`  ${v.message}`);
    }
    process.exit(1);
  }
  console.log('\nPre-write verify: OK');

  if (dryRun) {
    console.log('\nDry run complete.');
    return;
  }

  const schema = await detectPlayerStorageSchema();
  console.log(`\nWriting to Supabase (schema: ${schema})...`);

  await saveAppDataToSupabase(
    rebuiltTeams,
    data.tournaments,
    data.games,
    data.darkMode,
    undefined,
    tournamentRosters,
    {
      replaceTeamPlayersForTeams: rebuiltTeams.map((t) => t.id),
    }
  );

  console.log('Rebuild complete. Hard-refresh RunItBack (clear stale cache if needed).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
