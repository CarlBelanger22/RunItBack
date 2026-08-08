/**
 * Build NBL Div 2 2024 score-only JSON bundles (LE-130).
 * Insert-only: aborts if any target game id already exists.
 *
 * Usage:
 *   npx tsx scripts/build-nbl-div2-score-only-imports.ts
 *   npx tsx scripts/build-nbl-div2-score-only-imports.ts --dry-run
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { scoreOnlyTeamStats } from './asg2019-helpers';
import {
  TOURNAMENT_ID,
  PROTECTED_GAME_IDS,
  TEAM_META,
  allNewScoreOnlyGames,
  type NblScoreOnlyGameDef,
  type NblTeamId,
} from './nbl-div2-schedule-data';

const OUT_DIR = join(
  resolve(process.cwd(), 'Importingboxscores', 'NBL Div 2 2024'),
  'json'
);

function teamBundleRow(teamId: NblTeamId) {
  const meta = TEAM_META[teamId];
  return {
    id: meta.id,
    name: meta.name,
    abbreviation: meta.abbreviation,
    currentTournamentId: TOURNAMENT_ID,
    players: [] as [],
  };
}

function buildScoreOnlyBundle(
  game: NblScoreOnlyGameDef,
  tournamentMeta: {
    id: string;
    name: string;
    year: number;
    month: string;
    teamIds: string[];
    description?: string;
  }
) {
  return {
    version: '1',
    tournament: tournamentMeta,
    teams: [teamBundleRow(game.homeTeamId), teamBundleRow(game.awayTeamId)],
    game: {
      id: game.id,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      tournamentId: TOURNAMENT_ID,
      date: game.date,
      startTime: game.startTime,
      currentPeriod: 4,
      currentGameTime: '00:00',
      trackBothTeams: true,
      isActive: false,
      isCompleted: true,
      finalScore: { home: game.homeScore, away: game.awayScore },
      homeStarters: [],
      awayStarters: [],
      gameStats: [],
      teamStats: {
        home: scoreOnlyTeamStats(game.homeTeamId, game.homeScore),
        away: scoreOnlyTeamStats(game.awayTeamId, game.awayScore),
        __meta: {
          startTime: game.startTime,
          ...(game.note ? { note: game.note } : {}),
        },
      },
      shots: [],
      events: [],
      lineupStints: [],
    },
  };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  loadEnvLocalIntoProcess();

  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();

  const tournament = data.tournaments.find((t) => t.id === TOURNAMENT_ID);
  if (!tournament) throw new Error(`Tournament ${TOURNAMENT_ID} not found`);

  const existingGameIds = new Set((data.games ?? []).map((g) => g.id));
  const games = allNewScoreOnlyGames();

  for (const id of PROTECTED_GAME_IDS) {
    if (!existingGameIds.has(id)) {
      console.warn(`Warning: protected game ${id} not found (expected existing)`);
    }
  }

  for (const g of games) {
    if (existingGameIds.has(g.id)) {
      throw new Error(
        `Game ${g.id} already exists — aborting (insert-only; no overwrite)`
      );
    }
    if ((PROTECTED_GAME_IDS as readonly string[]).includes(g.id)) {
      throw new Error(`Refusing to build protected id ${g.id}`);
    }
  }

  const enrolled = new Set(tournament.teams ?? []);
  const tournamentMeta = {
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    month: tournament.month,
    description: tournament.description,
    teamIds: [...enrolled],
  };

  if (!dryRun) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Building ${games.length} NBL Div 2 score-only bundles…\n`);

  for (const game of games) {
    const bundle = buildScoreOnlyBundle(game, tournamentMeta);
    const homeMeta = TEAM_META[game.homeTeamId];
    const awayMeta = TEAM_META[game.awayTeamId];
    const outPath = join(OUT_DIR, `${game.id}.json`);
    if (!dryRun) {
      writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    }
    console.log(
      `${game.phase.padEnd(9)} | ${game.id} | ${homeMeta.abbreviation} ${game.homeScore}-${game.awayScore} ${awayMeta.abbreviation}`
    );
  }

  if (dryRun) {
    console.log('\nDry run — no files written.');
  } else {
    console.log(`\nWrote ${games.length} files to ${OUT_DIR}`);
    console.log('Import: npm run import:nbl-div2-score-only');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
