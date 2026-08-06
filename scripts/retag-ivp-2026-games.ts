/**
 * LE-105 — After IVP score-only import: enroll all 8 teams, tag KO as
 * classification, retag group games from structure, save to Supabase.
 *
 * Usage: npx tsx scripts/retag-ivp-2026-games.ts
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import {
  ALL_TEAM_IDS,
  PROTECTED_GAME_IDS,
  SCORE_ONLY_GAMES,
  TOURNAMENT_ID,
} from './ivp-2026-schedule-data';
import { retagTournamentGames } from '../src/utils/retagTournamentGames';
import { normalizeTournamentStructure } from '../src/utils/tournamentStructure';

const KNOWN_KO_IDS = new Set<string>([
  'game-ivp-2026-01-26-ntu-sim',
  'game-ivp-2026-01-28-ntu-np',
  ...SCORE_ONLY_GAMES.filter((g) => g.phase === 'knockout').map((g) => g.id),
]);

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();
  const {
    DEFAULT_LEAGUE_ID,
    loadAppDataFromSupabase,
    saveAppDataToSupabase,
  } = await import('../src/api/supabaseData');

  const data = await loadAppDataFromSupabase();
  const tournament = data.tournaments.find((t) => t.id === TOURNAMENT_ID);
  if (!tournament) throw new Error(`Tournament ${TOURNAMENT_ID} not found`);

  const structure = normalizeTournamentStructure(tournament.structure);
  const classificationStage = structure?.stages.find(
    (s) => s.kind === 'classification'
  );
  if (!classificationStage) {
    console.warn(
      'No classification stage in structure — KO games will not get stageId; retag group only.'
    );
  }

  const enrolled = new Set([...(tournament.teams ?? []), ...ALL_TEAM_IDS]);
  const tournaments = data.tournaments.map((t) =>
    t.id === TOURNAMENT_ID ? { ...t, teams: [...enrolled] } : t
  );

  let games = data.games.map((g) => {
    if (g.tournamentId !== TOURNAMENT_ID) return g;
    if (!KNOWN_KO_IDS.has(g.id) || !classificationStage) return g;
    return {
      ...g,
      stageId: classificationStage.id,
      groupId: undefined,
      // keep existing bracketSlotId if already linked
    };
  });

  const { games: tagged, report } = retagTournamentGames(
    games,
    TOURNAMENT_ID,
    structure
  );
  games = tagged;

  console.log('Retag report:', {
    groupTagged: report.groupTagged,
    classificationTagged: report.classificationTagged,
    skipped: report.skipped,
  });
  if (report.details.length) {
    console.log('Details (first 20):');
    for (const line of report.details.slice(0, 20)) console.log(' ', line);
  }

  const ivpGames = games.filter((g) => g.tournamentId === TOURNAMENT_ID);
  console.log(`\nIVP games total: ${ivpGames.length}`);
  for (const g of ivpGames.sort((a, b) => a.date.localeCompare(b.date))) {
    const hs = g.finalScore?.home ?? '?';
    const as_ = g.finalScore?.away ?? '?';
    console.log(
      `  ${g.date} ${g.id} ${hs}-${as_} stage=${g.stageId ?? '—'} group=${g.groupId ?? '—'} slot=${g.bracketSlotId ?? '—'}`
    );
  }

  for (const id of PROTECTED_GAME_IDS) {
    if (!ivpGames.some((g) => g.id === id)) {
      console.warn(`Protected game missing after load: ${id}`);
    }
  }

  await saveAppDataToSupabase(
    data.teams,
    tournaments,
    games,
    data.darkMode,
    DEFAULT_LEAGUE_ID,
    data.tournamentRosters ?? []
  );

  console.log('\nSaved IVP enrollment + stage tags to Supabase.');
  console.log(
    'Link remaining KO slots in Edit Tournament → Structure → Brackets if needed.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
