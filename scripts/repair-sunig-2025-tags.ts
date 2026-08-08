/**
 * LE-116 — Repair Sunig tags: rematch date order + feeder auto-link + retag.
 * Usage: npx tsx scripts/repair-sunig-2025-tags.ts
 */
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { finalizeGroupSeedings } from '../src/utils/finalizeGroupSeedings';
import { unlockGroupSeedings } from '../src/utils/finalizeGroupSeedings';
import { normalizeTournamentStructure } from '../src/utils/tournamentStructure';

const TOURNAMENT_ID = 'tournament-sunig-2025';

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();
  const {
    DEFAULT_LEAGUE_ID,
    loadAppDataFromSupabase,
    saveAppDataToSupabase,
  } = await import('../src/api/supabaseData');

  const data = await loadAppDataFromSupabase();
  const tournament = data.tournaments.find((t) => t.id === TOURNAMENT_ID);
  if (!tournament) throw new Error(`Missing ${TOURNAMENT_ID}`);

  // Unlock then finalize so rematch upgrade + feeder link + retag all run
  let structure =
    unlockGroupSeedings(tournament.structure, {
      clearSnapshot: true,
      clearSeedTeamIds: true,
    }) ?? normalizeTournamentStructure(tournament.structure);

  const { structure: nextStructure, games: nextGames, report } =
    finalizeGroupSeedings(structure, data.games, TOURNAMENT_ID, data.teams);

  console.log('Finalize report:', report);

  const sunig = nextGames
    .filter((g) => g.tournamentId === TOURNAMENT_ID)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const g of sunig) {
    console.log(
      `  ${g.date} ${g.id} stage=${g.stageId ?? '—'} group=${g.groupId ?? '—'} slot=${g.bracketSlotId ?? '—'}`
    );
  }

  const tournaments = data.tournaments.map((t) =>
    t.id === TOURNAMENT_ID ? { ...t, structure: nextStructure } : t
  );

  await saveAppDataToSupabase(
    data.teams,
    tournaments,
    nextGames,
    data.darkMode,
    DEFAULT_LEAGUE_ID,
    data.tournamentRosters ?? []
  );
  console.log('\nSaved Sunig repair to Supabase.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
