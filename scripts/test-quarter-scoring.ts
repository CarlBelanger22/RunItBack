/**
 * Quarter scoring derivation + snapshot persistence.
 * Run: npm run test:quarter-scoring
 */

import type { Game, GameEvent, GameStats, Player, Team } from '../src/App';
import {
  hydrateSnapshotGames,
  toSnapshotGames,
} from '../src/lib/appDataSnapshot';
import { buildGameReportModel } from '../src/utils/gameReportModel';
import {
  deriveQuarterScoringRows,
  ensureGameQuarterStats,
  isHealthyQuarterRows,
} from '../src/utils/quarterScoring';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function player(id: string, team: 'home' | 'away'): Player {
  return { id, name: `P ${id}`, number: 1, position: 'G' };
}

function makeLiveGame(): Game {
  const home = {
    id: 'home',
    name: 'UM',
    abbreviation: 'UM',
    players: [player('h1', 'home')],
  } as Team;
  const away = {
    id: 'away',
    name: 'NTU',
    abbreviation: 'NTU',
    players: [player('a1', 'away')],
  } as Team;

  const periodEnds: GameEvent[] = [
    {
      id: 'e1',
      type: 'period_end',
      timestamp: 1,
      period: 1,
      gameTime: '0:00',
      teamId: home.id,
      details: {},
      homeScore: 11,
      awayScore: 16,
    },
    {
      id: 'e2',
      type: 'period_end',
      timestamp: 2,
      period: 2,
      gameTime: '0:00',
      teamId: home.id,
      details: {},
      homeScore: 25,
      awayScore: 29,
    },
    {
      id: 'e3',
      type: 'period_end',
      timestamp: 3,
      period: 3,
      gameTime: '0:00',
      teamId: home.id,
      details: {},
      homeScore: 47,
      awayScore: 40,
    },
    {
      id: 'e4',
      type: 'period_end',
      timestamp: 4,
      period: 4,
      gameTime: '0:00',
      teamId: home.id,
      details: {},
      homeScore: 65,
      awayScore: 60,
    },
  ];

  const gameStats: GameStats[] = [
    {
      playerId: 'h1',
      points: 65,
      fg_made: 28,
      fg_attempted: 70,
      three_made: 4,
      three_attempted: 19,
      ft_made: 5,
      ft_attempted: 15,
      orb: 10,
      drb: 29,
      assists: 16,
      steals: 15,
      blocks: 1,
      turnovers: 15,
      fouls: 15,
      tech_fouls: 0,
      unsportsmanlike_fouls: 0,
      fouls_drawn: 0,
      blocks_received: 0,
      plus_minus: 0,
      minutes_played: 40,
    },
    {
      playerId: 'a1',
      points: 60,
      fg_made: 23,
      fg_attempted: 70,
      three_made: 7,
      three_attempted: 30,
      ft_made: 7,
      ft_attempted: 13,
      orb: 10,
      drb: 29,
      assists: 14,
      steals: 9,
      blocks: 5,
      turnovers: 22,
      fouls: 17,
      tech_fouls: 0,
      unsportsmanlike_fouls: 0,
      fouls_drawn: 0,
      blocks_received: 0,
      plus_minus: 0,
      minutes_played: 40,
    },
  ];

  return {
    id: 'g-um-ntu',
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    date: '2026-07-01',
    currentPeriod: 4,
    currentGameTime: '0:00',
    homeStarters: ['h1'],
    awayStarters: ['a1'],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 65, away: 60 },
    gameStats,
    teamStats: {
      home: {
        teamId: home.id,
        q1_points: 0,
        q2_points: 0,
        q3_points: 0,
        q4_points: 65,
        ot_points: 0,
        total_points: 65,
        fg_made: 28,
        fg_attempted: 70,
        three_made: 4,
        three_attempted: 19,
        two_made: 24,
        two_attempted: 51,
        ft_made: 5,
        ft_attempted: 15,
        orb: 10,
        drb: 29,
        team_rebounds: 0,
        total_rebounds: 39,
        assists: 16,
        steals: 15,
        blocks: 1,
        turnovers: 15,
        fouls: 15,
      },
      away: {
        teamId: away.id,
        q1_points: 0,
        q2_points: 0,
        q3_points: 0,
        q4_points: 60,
        ot_points: 0,
        total_points: 60,
        fg_made: 23,
        fg_attempted: 70,
        three_made: 7,
        three_attempted: 30,
        two_made: 16,
        two_attempted: 40,
        ft_made: 7,
        ft_attempted: 13,
        orb: 10,
        drb: 29,
        team_rebounds: 0,
        total_rebounds: 39,
        assists: 14,
        steals: 9,
        blocks: 5,
        turnovers: 22,
        fouls: 17,
      },
    },
    shots: [],
    events: periodEnds,
    lineupStints: [],
  };
}

function testDeriveFromPeriodEnd(): void {
  const game = makeLiveGame();
  const rows = deriveQuarterScoringRows(game);
  assert(rows !== null, 'rows exist');
  assert(rows![0]?.home === 11 && rows![0]?.away === 16, 'Q1');
  assert(rows![1]?.home === 14 && rows![1]?.away === 13, 'Q2');
  assert(rows![2]?.home === 22 && rows![2]?.away === 11, 'Q3');
  assert(rows![3]?.home === 18 && rows![3]?.away === 20, 'Q4');
  assert(
    isHealthyQuarterRows(rows!, 65, 60),
    'healthy vs final score'
  );
}

function testSnapshotRoundTrip(): void {
  const game = ensureGameQuarterStats(makeLiveGame());
  const completed = { ...game, isCompleted: true, isActive: false };
  const snapshot = toSnapshotGames([completed])[0]!;

  assert(snapshot.completedQuarterStats !== undefined, 'quarters saved');
  assert(snapshot.completedEvents?.length === 4, 'events saved');

  const hydrated = hydrateSnapshotGames([snapshot], [
    completed.homeTeam,
    completed.awayTeam,
  ])[0]!;

  assert(hydrated.teamStats.home.q1_points === 11, 'hydrate Q1 home');
  assert(hydrated.teamStats.away.q4_points === 20, 'hydrate Q4 away');
  assert(hydrated.events.length === 4, 'hydrate events');

  const model = buildGameReportModel(hydrated, []);
  assert(model.quarterRows[0]?.home === '11', 'PDF Q1 after hydrate');
  assert(model.quarterRows[3]?.away === '20', 'PDF Q4 away after hydrate');
}

function testPdfShowsDashWhenNoData(): void {
  const game = makeLiveGame();
  game.events = [];
  game.shots = [];
  game.teamStats.home.q1_points = 0;
  game.teamStats.home.q2_points = 0;
  game.teamStats.home.q3_points = 0;
  game.teamStats.home.q4_points = 0;
  game.teamStats.away.q1_points = 0;
  game.teamStats.away.q2_points = 0;
  game.teamStats.away.q3_points = 0;
  game.teamStats.away.q4_points = 0;

  const model = buildGameReportModel(game, []);
  assert(model.quarterRows[0]?.home === '—', 'dash when unknown');
}

function main(): void {
  testDeriveFromPeriodEnd();
  testSnapshotRoundTrip();
  testPdfShowsDashWhenNoData();
  console.log('All quarter-scoring tests passed.');
}

main();
