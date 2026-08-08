/**
 * LE-128b — Apply AUSF 3x3 Groups A–D to tournament structure + retag pool games.
 *
 * Usage: npx tsx scripts/apply-ausf-3x3-groups.ts
 *        npx tsx scripts/apply-ausf-3x3-groups.ts --dry-run
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import {
  AUSF_2026_GROUPS,
  ALL_TEAM_IDS,
  TOURNAMENT_ID,
} from './ausf-3x3-schedule-data';
import { retagTournamentGames } from '../src/utils/retagTournamentGames';
import type { TournamentStructure } from '../src/utils/tournamentStructure';
import { normalizeTournamentStructure } from '../src/utils/tournamentStructure';

function buildGroupStageStructure(
  existing: TournamentStructure | undefined
): TournamentStructure {
  const groupStage = {
    id: 'ausf-stage-groups',
    name: 'Group stage',
    kind: 'round_robin' as const,
    order: 1,
    groups: AUSF_2026_GROUPS.map((g) => ({
      id: g.id,
      name: g.name,
      teamIds: [...g.teamIds],
    })),
  };

  const otherStages = (existing?.stages ?? []).filter(
    (s) => s.kind !== 'round_robin'
  );

  return {
    stages: [
      groupStage,
      ...otherStages.map((s, i) => ({
        ...s,
        order: i + 2,
      })),
    ],
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  loadEnvLocalIntoProcess();

  const {
    DEFAULT_LEAGUE_ID,
    loadAppDataFromSupabase,
    saveAppDataToSupabase,
  } = await import('../src/api/supabaseData');

  const data = await loadAppDataFromSupabase();
  const tournament = data.tournaments.find((t) => t.id === TOURNAMENT_ID);
  if (!tournament) throw new Error(`Tournament ${TOURNAMENT_ID} not found`);

  const existing = normalizeTournamentStructure(tournament.structure);
  const structure = buildGroupStageStructure(existing ?? undefined);

  console.log('Groups:');
  for (const g of AUSF_2026_GROUPS) {
    console.log(`  ${g.name}: ${g.teamIds.join(', ')}`);
  }

  const enrolled = new Set([...(tournament.teams ?? []), ...ALL_TEAM_IDS]);
  const tournaments = data.tournaments.map((t) =>
    t.id === TOURNAMENT_ID
      ? { ...t, teams: [...enrolled], structure }
      : t
  );

  const { games: tagged, report } = retagTournamentGames(
    data.games,
    TOURNAMENT_ID,
    structure
  );

  console.log('\nRetag report:', {
    groupTagged: report.groupTagged,
    classificationTagged: report.classificationTagged,
    skipped: report.skipped,
  });
  if (report.details.length) {
    console.log('Details (first 30):');
    for (const line of report.details.slice(0, 30)) console.log(' ', line);
  }

  if (dryRun) {
    console.log('\nDry run — no save.');
    return;
  }

  await saveAppDataToSupabase(
    data.teams,
    tournaments,
    tagged,
    data.darkMode,
    DEFAULT_LEAGUE_ID,
    data.tournamentRosters ?? []
  );

  console.log('\nSaved AUSF group structure + retagged pool games.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
