/**
 * Link AUSF KO games into the 12-Team bracket + tag classification stageId.
 * Usage: npx tsx scripts/apply-ausf-3x3-autolink.ts
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { TOURNAMENT_ID, SCORE_ONLY_GAMES } from './ausf-3x3-schedule-data';
import { autoLinkBracketByResolvedTeams } from '../src/utils/resolveBracketFeeders';

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();
  const {
    DEFAULT_LEAGUE_ID,
    loadAppDataFromSupabase,
    saveAppDataToSupabase,
  } = await import('../src/api/supabaseData');

  const data = await loadAppDataFromSupabase();
  const tournament = data.tournaments.find((t) => t.id === TOURNAMENT_ID);
  if (!tournament?.structure) throw new Error('AUSF structure missing');

  const classStage = tournament.structure.stages.find(
    (s) => s.kind === 'classification'
  );
  if (!classStage) throw new Error('No classification stage');

  const koIds = new Set([
    ...SCORE_ONLY_GAMES.filter((g) => g.phase === 'knockout').map((g) => g.id),
    'game-ausf3x3-2026-06-13-ntu-iau', // protected L16 box score
  ]);

  let games = data.games.map((g) => {
    if (g.tournamentId !== TOURNAMENT_ID) return g;
    if (!koIds.has(g.id)) return g;
    return {
      ...g,
      stageId: classStage.id,
      groupId: undefined,
    };
  });

  const linked = autoLinkBracketByResolvedTeams(
    tournament.structure,
    games,
    TOURNAMENT_ID
  );
  games = linked.games;

  console.log('Auto-link report:', linked.report);
  const stage = linked.structure.stages.find((s) => s.kind === 'classification');
  for (const r of stage?.bracket?.rounds ?? []) {
    for (const s of r.slots) {
      console.log(`  ${r.name} ${s.label}: ${s.gameId ?? '—'}`);
    }
  }

  const tournaments = data.tournaments.map((t) =>
    t.id === TOURNAMENT_ID
      ? { ...t, structure: linked.structure }
      : t
  );

  await saveAppDataToSupabase(
    data.teams,
    tournaments,
    games,
    data.darkMode,
    DEFAULT_LEAGUE_ID,
    data.tournamentRosters ?? []
  );
  console.log('\nSaved AUSF bracket links + classification tags.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
