/**
 * Build ASG 2019 import JSON bundles (3 full FIBA box scores + 8 score-only).
 *
 * Usage:
 *   npx tsx scripts/build-asg-2019-imports.ts
 *   npx tsx scripts/build-asg-2019-imports.ts --dry-run
 */

import { writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';
import { FULL_GAMES, SCORE_ONLY_GAMES } from './asg2019-games-data';
import {
  ASG2019_ADVANCED_STATS_PATCHES,
  mergeAdvancedStatsSide,
} from './asg2019-advanced-stats-data';
import {
  TOURNAMENT_ID,
  TEAM,
  type AsgFullGameDef,
  type AsgPlayerLine,
  aggregateTeamStats,
  lineToGameStat,
  opponentPlayerId,
  scoreOnlyTeamStats,
} from './asg2019-helpers';

const TEAM_META: Record<string, { name: string; abbreviation: string }> = {
  [TEAM.singapore]: { name: 'Singapore', abbreviation: 'SGP' },
  [TEAM.philippines]: { name: 'Philippines', abbreviation: 'PHI' },
  [TEAM.indonesia]: { name: 'Indonesia', abbreviation: 'INA' },
  [TEAM.vietnam]: { name: 'Vietnam', abbreviation: 'VIE' },
  [TEAM.thailand]: { name: 'Thailand', abbreviation: 'THA' },
  [TEAM.malaysia]: { name: 'Malaysia', abbreviation: 'MAS' },
};

function findAsgDir(): string {
  const base = resolve(process.cwd(), 'Importingboxscores');
  const entry = readdirSync(base).find((n) => /asg\s*2019/i.test(n));
  if (!entry) throw new Error('ASG 2019 folder not found under Importingboxscores');
  return join(base, entry);
}

function opponentPlayersFromLines(
  lines: AsgPlayerLine[],
  teamId: string,
  teamKey: string
) {
  return lines
    .filter((l) => !l.singapore)
    .map((l) => ({
      id: opponentPlayerId(teamKey, l.name),
      name: l.name,
      number: l.number,
      position: 'PG',
      height: '',
      weight: '',
      age: 0,
    }));
}

function buildFullBundle(
  game: AsgFullGameDef,
  tournamentMeta: {
    id: string;
    name: string;
    year: number;
    month: string;
    teamIds: string[];
  }
) {
  const homeMeta = TEAM_META[game.homeTeamId];
  const awayMeta = TEAM_META[game.awayTeamId];
  const opponentKey = game.opponentTeamKey;

  const homePlayers =
    game.homeTeamId === TEAM.singapore
      ? []
      : opponentPlayersFromLines(game.homeLines, game.homeTeamId, opponentKey);
  const awayPlayers =
    game.awayTeamId === TEAM.singapore
      ? []
      : opponentPlayersFromLines(game.awayLines, game.awayTeamId, opponentKey);

  const gameStats = [...game.homeLines, ...game.awayLines].map(
    (l) => lineToGameStat(l, opponentKey).stat
  );

  const homeStarters = game.homeLines
    .filter((l) => l.starter)
    .map((l) => lineToGameStat(l, opponentKey).playerId);
  const awayStarters = game.awayLines
    .filter((l) => l.starter)
    .map((l) => lineToGameStat(l, opponentKey).playerId);

  const advancedPatch = ASG2019_ADVANCED_STATS_PATCHES[game.id];
  const homeTeamStats = aggregateTeamStats(
    game.homeTeamId,
    game.homeLines,
    game.quarters.home
  );
  const awayTeamStats = aggregateTeamStats(
    game.awayTeamId,
    game.awayLines,
    game.quarters.away
  );

  return {
    version: '1',
    tournament: tournamentMeta,
    teams: [
      {
        id: game.homeTeamId,
        name: homeMeta.name,
        abbreviation: homeMeta.abbreviation,
        currentTournamentId: TOURNAMENT_ID,
        players: homePlayers,
      },
      {
        id: game.awayTeamId,
        name: awayMeta.name,
        abbreviation: awayMeta.abbreviation,
        currentTournamentId: TOURNAMENT_ID,
        players: awayPlayers,
      },
    ],
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
      homeStarters,
      awayStarters,
      gameStats,
      teamStats: {
        home: advancedPatch
          ? mergeAdvancedStatsSide(homeTeamStats, advancedPatch.home)
          : homeTeamStats,
        away: advancedPatch
          ? mergeAdvancedStatsSide(awayTeamStats, advancedPatch.away)
          : awayTeamStats,
      },
      shots: [],
      events: [],
      lineupStints: [],
    },
  };
}

function buildScoreOnlyBundle(
  game: (typeof SCORE_ONLY_GAMES)[number],
  tournamentMeta: {
    id: string;
    name: string;
    year: number;
    month: string;
    teamIds: string[];
  }
) {
  const homeMeta = TEAM_META[game.homeTeamId];
  const awayMeta = TEAM_META[game.awayTeamId];

  return {
    version: '1',
    tournament: tournamentMeta,
    teams: [
      {
        id: game.homeTeamId,
        name: homeMeta.name,
        abbreviation: homeMeta.abbreviation,
        currentTournamentId: TOURNAMENT_ID,
        players: [],
      },
      {
        id: game.awayTeamId,
        name: awayMeta.name,
        abbreviation: awayMeta.abbreviation,
        currentTournamentId: TOURNAMENT_ID,
        players: [],
      },
    ],
    game: {
      id: game.id,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      tournamentId: TOURNAMENT_ID,
      date: game.date,
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
  const allIds = [...FULL_GAMES.map((g) => g.id), ...SCORE_ONLY_GAMES.map((g) => g.id)];
  for (const id of allIds) {
    if (existingGameIds.has(id)) {
      throw new Error(`Game ${id} already exists — aborting`);
    }
  }

  const tournamentMeta = {
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    month: tournament.month,
    teamIds: tournament.teams ?? [],
  };

  const outDir = join(findAsgDir(), 'json');
  mkdirSync(outDir, { recursive: true });

  console.log(`Building ${allIds.length} ASG 2019 bundles…\n`);

  for (const game of FULL_GAMES) {
    const bundle = buildFullBundle(game, tournamentMeta);
    const outPath = join(outDir, `${game.id}.json`);
    if (!dryRun) {
      writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    }
    const oppCount = bundle.teams.flatMap((t) => t.players).length;
    console.log(
      `${game.id} | FULL | ${bundle.game.finalScore.home}-${bundle.game.finalScore.away} | ${bundle.game.gameStats.length} stats | ${oppCount} new opponent players`
    );
  }

  for (const game of SCORE_ONLY_GAMES) {
    const bundle = buildScoreOnlyBundle(game, tournamentMeta);
    const outPath = join(outDir, `${game.id}.json`);
    if (!dryRun) {
      writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    }
    console.log(
      `${game.id} | SCORE | ${bundle.game.finalScore.home}-${bundle.game.finalScore.away}`
    );
  }

  if (dryRun) {
    console.log('\nDry run — no files written.');
  } else {
    console.log(`\nWrote ${allIds.length} files to ${outDir}`);
    console.log(
      'Full games: npm run import:boxscore -- --file "<path>" --stats-only --add-new-players'
    );
    console.log('Score-only: npm run import:boxscore -- --file "<path>" --stats-only');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
