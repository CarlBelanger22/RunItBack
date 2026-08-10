/**
 * Fix 3S Solid Surface abbreviation (3SSS → 3S).
 * Usage: npx tsx scripts/fix-3s-abbreviation.ts
 */
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const TEAM_ID = 'team-kx-div2-chong-ghee';

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();
  const {
    DEFAULT_LEAGUE_ID,
    loadAppDataFromSupabase,
    saveAppDataToSupabase,
  } = await import('../src/api/supabaseData');

  const data = await loadAppDataFromSupabase();
  const team = data.teams.find((t) => t.id === TEAM_ID);
  if (!team) throw new Error('3S team not found');

  console.log('Before:', team.name, team.abbreviation);
  const teams = data.teams.map((t) =>
    t.id === TEAM_ID ? { ...t, name: '3S Solid Surface', abbreviation: '3S' } : t
  );

  await saveAppDataToSupabase(
    teams,
    data.tournaments,
    data.games,
    data.darkMode,
    DEFAULT_LEAGUE_ID,
    data.tournamentRosters ?? []
  );
  console.log('After: 3S Solid Surface | 3S');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
