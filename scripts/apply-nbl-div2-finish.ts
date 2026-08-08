/**
 * LE-130 finish: rename 3S, retag games, rewire SF seeds 1v4/2v3,
 * finalize seed fill + auto-link KO (never deletes games).
 *
 * Usage: npx tsx scripts/apply-nbl-div2-finish.ts
 *        npx tsx scripts/apply-nbl-div2-finish.ts --dry-run
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { finalizeGroupSeedings } from '../src/utils/finalizeGroupSeedings';
import { autoLinkBracketByResolvedTeams } from '../src/utils/resolveBracketFeeders';
import {
  TOURNAMENT_ID,
  TEAM,
  TEAM_META,
  GROUP_STAGE_ID,
  GROUP_ID,
  CLASSIFICATION_STAGE_ID,
  PROTECTED_GAME_IDS,
  EXISTING_3RD_PLACE_GAME_ID,
  EXISTING_SF1_GAME_ID,
  allNewScoreOnlyGames,
  KO_SCORE_ONLY_GAMES,
  FULL_RR_TARGET_WINS,
} from './nbl-div2-schedule-data';
import type { Game, Team } from '../src/App';
import type { TournamentStructure } from '../src/utils/tournamentStructure';

function rewireSeeds(structure: TournamentStructure): TournamentStructure {
  return {
    ...structure,
    stages: structure.stages.map((stage) => {
      if (stage.kind !== 'classification' || !stage.bracket) return stage;
      return {
        ...stage,
        bracket: {
          rounds: stage.bracket.rounds.map((round) => ({
            ...round,
            slots: round.slots.map((slot) => {
              // SF1: A1 vs A4
              if (slot.label === 'SF1' || slot.id.endsWith('-sf-a1b2')) {
                return {
                  ...slot,
                  homeSeedLabel: 'A1',
                  awaySeedLabel: 'A4',
                  homeTeamId: null,
                  awayTeamId: null,
                  // keep existing SF1 game link
                  gameId: slot.gameId ?? EXISTING_SF1_GAME_ID,
                };
              }
              // SF2: A2 vs A3
              if (slot.label === 'SF2' || slot.id.endsWith('-sf-b1a2')) {
                return {
                  ...slot,
                  homeSeedLabel: 'A2',
                  awaySeedLabel: 'A3',
                  homeTeamId: null,
                  awayTeamId: null,
                  gameId: null,
                };
              }
              return slot;
            }),
          })),
        },
      };
    }),
  };
}

function renameThreeS(teams: Team[]): Team[] {
  const meta = TEAM_META[TEAM.threeS];
  return teams.map((t) =>
    t.id === TEAM.threeS
      ? { ...t, name: meta.name, abbreviation: meta.abbreviation }
      : t
  );
}

function retagGames(games: Game[]): Game[] {
  const newIds = new Set(allNewScoreOnlyGames().map((g) => g.id));
  const koIds = new Set<string>([
    ...KO_SCORE_ONLY_GAMES.map((g) => g.id),
    EXISTING_SF1_GAME_ID,
    EXISTING_3RD_PLACE_GAME_ID,
  ]);

  return games.map((g) => {
    if (g.tournamentId !== TOURNAMENT_ID) return g;

    if (koIds.has(g.id)) {
      return {
        ...g,
        stageId: CLASSIFICATION_STAGE_ID,
        groupId: undefined,
      };
    }

    // Existing protected RR + new RR score-only
    const isProtectedRr =
      (PROTECTED_GAME_IDS as readonly string[]).includes(g.id) &&
      g.id !== EXISTING_SF1_GAME_ID &&
      g.id !== EXISTING_3RD_PLACE_GAME_ID;
    const isNewRr = newIds.has(g.id) && !koIds.has(g.id);

    if (isProtectedRr || isNewRr) {
      return {
        ...g,
        stageId: GROUP_STAGE_ID,
        groupId: GROUP_ID,
      };
    }

    return g;
  });
}

function countRrWins(games: Game[]): Map<string, { w: number; l: number }> {
  const map = new Map<string, { w: number; l: number }>();
  const bump = (id: string, key: 'w' | 'l') => {
    const cur = map.get(id) ?? { w: 0, l: 0 };
    cur[key] += 1;
    map.set(id, cur);
  };
  for (const g of games) {
    if (g.tournamentId !== TOURNAMENT_ID) continue;
    if (g.groupId !== GROUP_ID) continue;
    const hs = g.finalScore?.home;
    const as = g.finalScore?.away;
    if (typeof hs !== 'number' || typeof as !== 'number' || hs === as) continue;
    if (hs > as) {
      bump(g.homeTeamId, 'w');
      bump(g.awayTeamId, 'l');
    } else {
      bump(g.awayTeamId, 'w');
      bump(g.homeTeamId, 'l');
    }
  }
  return map;
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
  if (!tournament?.structure) throw new Error('NBL Div 2 structure missing');

  // Safety: protected games still present
  const byId = new Map(data.games.map((g) => [g.id, g]));
  for (const id of PROTECTED_GAME_IDS) {
    if (!byId.has(id)) {
      throw new Error(`Protected game missing — aborting: ${id}`);
    }
  }

  let teams = renameThreeS(data.teams);
  let games = retagGames(data.games);
  let structure = rewireSeeds(tournament.structure);

  const finalized = finalizeGroupSeedings(
    structure,
    games,
    TOURNAMENT_ID,
    teams
  );
  structure = finalized.structure;
  games = finalized.games;

  const linked = autoLinkBracketByResolvedTeams(
    structure,
    games,
    TOURNAMENT_ID
  );
  structure = linked.structure;
  games = linked.games;

  console.log('Rename: Chong Ghee 2 → 3S Solid Surface');
  console.log('Finalize report:', finalized.report);
  console.log('Auto-link report:', linked.report);

  const wl = countRrWins(games);
  console.log('\nRR W–L (group-tagged):');
  const rows = Object.entries(FULL_RR_TARGET_WINS)
    .map(([id, targetW]) => {
      const name = teams.find((t) => t.id === id)?.name ?? id;
      const rec = wl.get(id) ?? { w: 0, l: 0 };
      const ok = rec.w === targetW && rec.w + rec.l === 11;
      return { name, ...rec, targetW, ok };
    })
    .sort((a, b) => b.w - a.w || a.name.localeCompare(b.name));
  for (const r of rows) {
    console.log(
      `  ${r.ok ? '✓' : '✗'} ${r.name}: ${r.w}-${r.l} (target ${r.targetW}-*)`
    );
  }
  const allOk = rows.every((r) => r.ok);
  if (!allOk) {
    throw new Error('RR W–L does not match official table — not saving');
  }

  console.log('\nBracket:');
  const stage = structure.stages.find((s) => s.kind === 'classification');
  for (const r of stage?.bracket?.rounds ?? []) {
    for (const s of r.slots) {
      const home =
        teams.find((t) => t.id === s.homeTeamId)?.name ??
        s.homeSeedLabel ??
        '—';
      const away =
        teams.find((t) => t.id === s.awayTeamId)?.name ??
        s.awaySeedLabel ??
        '—';
      console.log(`  ${r.name} ${s.label}: ${home} vs ${away} | game=${s.gameId ?? '—'}`);
    }
  }

  if (dryRun) {
    console.log('\nDry run — not saved.');
    return;
  }

  const tournaments = data.tournaments.map((t) =>
    t.id === TOURNAMENT_ID ? { ...t, structure } : t
  );

  await saveAppDataToSupabase(
    teams,
    tournaments,
    games,
    data.darkMode,
    DEFAULT_LEAGUE_ID,
    data.tournamentRosters ?? []
  );
  console.log('\nSaved NBL Div 2 finish (rename + retag + rewire + links).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
