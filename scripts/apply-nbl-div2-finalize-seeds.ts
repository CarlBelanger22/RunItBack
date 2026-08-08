/**
 * Re-finalize NBL Div 2 2024 seeds so A9–A16 fill (e.g. A10 → Clementi).
 * Usage: npx tsx scripts/apply-nbl-div2-finalize-seeds.ts
 */
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { finalizeGroupSeedings } from '../src/utils/finalizeGroupSeedings';

const TOURNAMENT_ID = 'tournament-1780251377063';

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();
  const {
    DEFAULT_LEAGUE_ID,
    loadAppDataFromSupabase,
    saveAppDataToSupabase,
  } = await import('../src/api/supabaseData');

  const data = await loadAppDataFromSupabase();
  const tournament = data.tournaments.find((t) => t.id === TOURNAMENT_ID);
  if (!tournament?.structure) throw new Error('NBL Div 2 structure missing');

  const result = finalizeGroupSeedings(
    tournament.structure,
    data.games,
    TOURNAMENT_ID,
    data.teams
  );

  console.log('Finalize report:', result.report);
  console.log(
    'A10 snapshot:',
    result.structure.seedSnapshot?.A10 ?? '(missing)'
  );

  const stage = result.structure.stages.find((s) => s.kind === 'classification');
  for (const r of stage?.bracket?.rounds ?? []) {
    for (const s of r.slots) {
      console.log(
        `  ${r.name} ${s.label}: home=${s.homeTeamId ?? s.homeSeedLabel} away=${s.awayTeamId ?? s.awaySeedLabel} game=${s.gameId ?? '—'}`
      );
    }
  }

  const tournaments = data.tournaments.map((t) =>
    t.id === TOURNAMENT_ID
      ? { ...t, structure: result.structure }
      : t
  );

  await saveAppDataToSupabase(
    data.teams,
    tournaments,
    result.games,
    data.darkMode,
    DEFAULT_LEAGUE_ID,
    data.tournamentRosters ?? []
  );
  console.log('\nSaved NBL Div 2 seed fill.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
