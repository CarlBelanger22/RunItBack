/**
 * Build IVP 2026 score-only import JSON bundles (LE-105).
 *
 * Usage:
 *   npx tsx scripts/build-ivp-2026-score-only-imports.ts
 *   npx tsx scripts/build-ivp-2026-score-only-imports.ts --dry-run
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { scoreOnlyTeamStats } from './asg2019-helpers';
import {
  TOURNAMENT_ID,
  PROTECTED_GAME_IDS,
  TEAM_META,
  ALL_TEAM_IDS,
  SCORE_ONLY_GAMES,
  type IvpScoreOnlyGameDef,
  type IvpTeamId,
} from './ivp-2026-schedule-data';

const OUT_DIR = join(resolve(process.cwd(), 'Importingboxscores', 'ivp 2026'), 'json');

function teamBundleRow(teamId: IvpTeamId) {
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
  game: IvpScoreOnlyGameDef,
  tournamentMeta: {
    id: string;
    name: string;
    year: number;
    month: string;
    teamIds: string[];
    description?: string;
  }
) {
  const teamStats = {
    home: scoreOnlyTeamStats(game.homeTeamId, game.homeScore),
    away: scoreOnlyTeamStats(game.awayTeamId, game.awayScore),
    __meta: {
      startTime: game.startTime,
      ...(game.note ? { note: game.note } : {}),
    },
  };

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
      teamStats,
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
  for (const id of SCORE_ONLY_GAMES.map((g) => g.id)) {
    if (existingGameIds.has(id)) {
      throw new Error(`Game ${id} already exists — aborting`);
    }
  }
  for (const id of PROTECTED_GAME_IDS) {
    if (!existingGameIds.has(id)) {
      console.warn(
        `Warning: protected game ${id} not found in Supabase (expected existing)`
      );
    }
  }

  const enrolled = new Set([...(tournament.teams ?? []), ...ALL_TEAM_IDS]);
  const tournamentMeta = {
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    month: tournament.month,
    description: tournament.description,
    teamIds: [...enrolled],
  };

  if (!dryRun) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log(`Building ${SCORE_ONLY_GAMES.length} IVP 2026 score-only bundles…\n`);

  for (const game of SCORE_ONLY_GAMES) {
    const bundle = buildScoreOnlyBundle(game, tournamentMeta);
    const homeMeta = TEAM_META[game.homeTeamId];
    const awayMeta = TEAM_META[game.awayTeamId];
    const outPath = join(OUT_DIR, `${game.id}.json`);

    if (!dryRun) {
      writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    }

    console.log(
      `${game.phase.padEnd(9)} | ${game.id} | ${homeMeta.abbreviation} ${game.homeScore}-${game.awayScore} ${awayMeta.abbreviation} | ${game.date} ${game.startTime}${game.note ? ` (${game.note})` : ''}`
    );
  }

  if (dryRun) {
    console.log('\nDry run — no files written.');
  } else {
    console.log(`\nWrote ${SCORE_ONLY_GAMES.length} files to ${OUT_DIR}`);
    console.log('Import all: npm run import:ivp-2026-score-only');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
