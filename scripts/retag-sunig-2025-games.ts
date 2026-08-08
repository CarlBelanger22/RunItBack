/**
 * LE-114.1 — Retag Sunig 2025: RR vs classification (KO rematches).
 *
 * Tags Oct 1 SIT–SUTD and Oct 3 SUTD–SMU as classification before retag so
 * they are not treated as Group B round-robin (same-group rematches).
 *
 * Usage: npx tsx scripts/retag-sunig-2025-games.ts
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { retagTournamentGames } from '../src/utils/retagTournamentGames';
import { normalizeTournamentStructure } from '../src/utils/tournamentStructure';
import { filterGamesForGroup } from '../src/utils/tournamentStandings';

const TOURNAMENT_ID = 'tournament-sunig-2025';

/** Same-group rematches that are KO / placement — must not pollute RR. */
const CLASSIFICATION_KO_IDS = [
  'game-sunig-2025-10-01-sit-sutd',
  'game-sunig-2025-10-03-sutd-smu',
] as const;

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

  let structure = normalizeTournamentStructure(tournament.structure);
  if (!structure) throw new Error('Sunig has no structure');

  const classification = structure.stages
    .filter((s) => s.kind === 'classification')
    .sort((a, b) => a.order - b.order);

  // Prefer a placement stage (5th–7th / 5–8) for these rematches; else last classification.
  const placement =
    classification.find((s) => /5|7|place|classif/i.test(s.name)) ??
    classification[classification.length - 1] ??
    classification[0];

  if (!placement) {
    throw new Error(
      'No classification stage — add Finals / 5th–7th in Structure first'
    );
  }

  console.log(`Using classification stage for KO rematches: ${placement.id} (${placement.name})`);

  let games = data.games.map((g) => {
    if (g.tournamentId !== TOURNAMENT_ID) return g;
    if (!(CLASSIFICATION_KO_IDS as readonly string[]).includes(g.id)) return g;
    return {
      ...g,
      stageId: placement.id,
      groupId: undefined,
    };
  });

  for (const id of CLASSIFICATION_KO_IDS) {
    const g = games.find((x) => x.id === id);
    if (!g) console.warn(`Missing expected KO game: ${id}`);
    else
      console.log(
        `  Tagged ${id} → stage=${g.stageId} group=${g.groupId ?? '—'}`
      );
  }

  const { games: tagged, report } = retagTournamentGames(
    games,
    TOURNAMENT_ID,
    structure
  );
  games = tagged;

  console.log('\nRetag report:', {
    groupTagged: report.groupTagged,
    classificationTagged: report.classificationTagged,
    skipped: report.skipped,
  });

  const rr = structure.stages.find((s) => s.kind === 'round_robin');
  const groupB = rr?.groups?.find((g) => /b/i.test(g.name));
  if (groupB) {
    const groupBGames = filterGamesForGroup(
      games.filter((g) => g.tournamentId === TOURNAMENT_ID),
      groupB,
      structure
    );
    const polluted = groupBGames.filter((g) =>
      (CLASSIFICATION_KO_IDS as readonly string[]).includes(g.id)
    );
    console.log(
      `\nGroup B RR games: ${groupBGames.length} (KO rematches in RR: ${polluted.length} — want 0)`
    );
    if (polluted.length > 0) {
      throw new Error(
        `KO rematches still in Group B RR: ${polluted.map((g) => g.id).join(', ')}`
      );
    }
  }

  const sunig = games
    .filter((g) => g.tournamentId === TOURNAMENT_ID)
    .sort((a, b) => a.date.localeCompare(b.date));
  console.log(`\nSunig games (${sunig.length}):`);
  for (const g of sunig) {
    const hs = g.finalScore?.home ?? '?';
    const as_ = g.finalScore?.away ?? '?';
    console.log(
      `  ${g.date} ${g.id} ${hs}-${as_} stage=${g.stageId ?? '—'} group=${g.groupId ?? '—'} slot=${g.bracketSlotId ?? '—'}`
    );
  }

  const tournaments = data.tournaments.map((t) =>
    t.id === TOURNAMENT_ID ? { ...t, structure } : t
  );

  await saveAppDataToSupabase(
    data.teams,
    tournaments,
    games,
    data.darkMode,
    DEFAULT_LEAGUE_ID,
    data.tournamentRosters ?? []
  );

  console.log('\nSaved Sunig RR/KO tags to Supabase.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
