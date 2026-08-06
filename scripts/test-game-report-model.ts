/**
 * Game report model tests.
 * Run: npm run test:game-report-model
 */

import type { Game, GameStats, Player, Team, Tournament } from '../src/App';
import {
  buildGameReportModel,
  formatPlayerDisplayName,
  formatReportMinutes,
  formatReportPct,
  formatReportShootingLine,
  PDF_BOX_SCORE_COLUMN_COUNT,
} from '../src/utils/gameReportModel';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function baseStat(playerId: string, overrides: Partial<GameStats> = {}): GameStats {
  return {
    playerId,
    points: 10,
    fg_made: 4,
    fg_attempted: 8,
    three_made: 1,
    three_attempted: 2,
    ft_made: 1,
    ft_attempted: 2,
    orb: 2,
    drb: 4,
    assists: 3,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    fouls: 2,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: 1,
    blocks_received: 1,
    plus_minus: 5,
    minutes_played: 32.87,
    ...overrides,
  };
}

function player(id: string, name: string, number: number): Player {
  return { id, name, number, position: 'G' };
}

function makeTeam(id: string, abbr: string, players: Player[]): Team {
  return { id, name: id, abbreviation: abbr, players };
}

function makeGame(): Game {
  const home = makeTeam('home', 'HOM', [
    player('h1', 'John Smith', 7),
    player('h2', 'Alex Lee', 12),
  ]);
  const away = makeTeam('away', 'AWY', [player('a1', 'Maria Garcia', 3)]);

  return {
    id: 'g-report',
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    tournamentId: 't-1',
    date: '2026-01-28',
    currentPeriod: 4,
    currentGameTime: '0:00',
    homeStarters: ['h1'],
    awayStarters: ['a1'],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 20, away: 10 },
    gameStats: [
      baseStat('h1', { points: 12, minutes_played: 35 + 52 / 60 }),
      baseStat('h2', { points: 8, minutes_played: 10 }),
      baseStat('a1', { points: 10, plus_minus: -2 }),
    ],
    teamStats: {
      home: {
        teamId: home.id,
        q1_points: 8,
        q2_points: 6,
        q3_points: 4,
        q4_points: 2,
        ot_points: 0,
        total_points: 20,
        fg_made: 8,
        fg_attempted: 16,
        three_made: 2,
        three_attempted: 4,
        two_made: 6,
        two_attempted: 12,
        ft_made: 2,
        ft_attempted: 2,
        orb: 4,
        drb: 8,
        team_rebounds: 0,
        total_rebounds: 12,
        assists: 6,
        steals: 2,
        blocks: 0,
        turnovers: 4,
        fouls: 4,
        team_coach: { orb: 1, drb: 0, turnovers: 0, fouls: 1 },
      },
      away: {
        teamId: away.id,
        q1_points: 4,
        q2_points: 3,
        q3_points: 2,
        q4_points: 1,
        ot_points: 0,
        total_points: 10,
        fg_made: 4,
        fg_attempted: 10,
        three_made: 1,
        three_attempted: 3,
        two_made: 3,
        two_attempted: 7,
        ft_made: 1,
        ft_attempted: 2,
        orb: 2,
        drb: 4,
        team_rebounds: 0,
        total_rebounds: 6,
        assists: 2,
        steals: 1,
        blocks: 0,
        turnovers: 3,
        fouls: 2,
      },
    },
    shots: [],
    events: [],
    lineupStints: [],
  };
}

const tournaments: Tournament[] = [
  {
    id: 't-1',
    name: 'IVP 2026',
    teams: ['home', 'away'],
    games: [],
    standings: [],
  },
];

function testFormatting(): void {
  assert(formatReportShootingLine(14, 29) === '14-29', 'shooting line');
  assert(formatReportShootingLine(0, 0) === '-', 'zero attempts');
  assert(formatReportPct(14, 29) === '48%', 'pct rounded');
  assert(formatReportPct(0, 0) === '-', 'zero pct');
  assert(formatReportMinutes(35 + 52 / 60) === '35:52', 'minutes');
  assert(formatPlayerDisplayName('John Smith') === 'John', 'first name');
  assert(formatPlayerDisplayName('Madonna') === 'Madonna', 'single name');
}

function testModelStructure(): void {
  const model = buildGameReportModel(makeGame(), tournaments);

  assert(model.tournamentName === 'IVP 2026', 'tournament name');
  assert(model.homeTeamLabel === 'home (HOM)', 'home team label');
  assert(model.awayTeamLabel === 'away (AWY)', 'away team label');
  assert(model.scoreLine === 'HOM 20 - 10 AWY', 'score line');
  assert(model.comparisonRows.length >= 16, 'comparison rows incl advanced');
  assert(model.quarterRows.length === 4, 'quarter rows');
  assert(model.boxScores.length === 2, 'both box scores');

  const benchRow = model.comparisonRows.find((r) => r.label === 'Bench Pts');
  assert(benchRow?.home === '8', 'home bench pts from non-starter h2');
  assert(benchRow?.away === '0', 'away bench pts (starter only)');

  const advancedLabels = [
    'POT',
    'FB PTS',
    'PITP',
    '2nd Chance',
    'Bench Pts',
  ];
  for (const label of advancedLabels) {
    assert(
      model.comparisonRows.some((r) => r.label === label),
      `comparison includes ${label}`
    );
  }

  const home = model.boxScores[0]!;
  const playerRows = home.rows.filter((r) => r.kind === 'player');
  assert(playerRows.length === 2, 'home played players');
  assert(
    home.rows.some((r) => r.kind === 'team_coach'),
    'team/coach row'
  );
  assert(home.rows[home.rows.length - 1]?.kind === 'team_total', 'team total last');

  const starter = playerRows[0]!;
  assert(starter.cells.length === PDF_BOX_SCORE_COLUMN_COUNT, 'column count');
  assert(starter.cells[0] === '7', 'jersey');
  assert(starter.cells[1] === 'John', 'player name');
  assert(starter.cells[21] !== '', 'EFF present');
  assert(starter.cells[22] !== '', 'GmSc present');

  const teamRow = home.rows[home.rows.length - 1]!;
  assert(teamRow.cells[1] === 'TEAM', 'TEAM label');
  assert(teamRow.cells[15] === '2', 'TEAM BA sum');
  assert(teamRow.cells[19] === '2', 'TEAM FD sum when tournament records FD');
}

function testQuarterDerivationFromEvents(): void {
  const game = makeGame();
  game.events = [
    {
      id: 'e1',
      type: 'period_end',
      timestamp: 1,
      period: 1,
      gameTime: '0:00',
      teamId: game.homeTeamId,
      details: {},
      homeScore: 8,
      awayScore: 4,
    },
    {
      id: 'e2',
      type: 'period_end',
      timestamp: 2,
      period: 2,
      gameTime: '0:00',
      teamId: game.homeTeamId,
      details: {},
      homeScore: 14,
      awayScore: 7,
    },
  ];
  game.teamStats!.home!.q1_points = 0;
  game.teamStats!.home!.q2_points = 0;
  game.teamStats!.away!.q1_points = 0;
  game.teamStats!.away!.q2_points = 0;
  game.teamStats!.home!.q3_points = 0;
  game.teamStats!.home!.q4_points = 0;
  game.teamStats!.away!.q3_points = 0;
  game.teamStats!.away!.q4_points = 0;

  const model = buildGameReportModel(game, tournaments);
  assert(model.quarterRows[0]?.home === '8', 'Q1 home from events');
  assert(model.quarterRows[0]?.away === '4', 'Q1 away from events');
  assert(model.quarterRows[1]?.home === '6', 'Q2 home delta from events');
  assert(model.quarterRows.length === 2, 'no duplicate quarter rows');
}

function testQuarterDedupesDuplicatePeriodEnd(): void {
  const game = makeGame();
  for (const side of ['home', 'away'] as const) {
    const stats = game.teamStats![side]!;
    stats.q1_points = 0;
    stats.q2_points = 0;
    stats.q3_points = 0;
    stats.q4_points = 0;
    stats.ot_points = 0;
  }
  game.events = [
    {
      id: 'e1',
      type: 'period_end',
      timestamp: 1,
      period: 1,
      gameTime: '0:00',
      teamId: game.homeTeamId,
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
      teamId: game.homeTeamId,
      details: {},
      homeScore: 14,
      awayScore: 16,
    },
    {
      id: 'e2b',
      type: 'period_end',
      timestamp: 3,
      period: 2,
      gameTime: '0:00',
      teamId: game.homeTeamId,
      details: {},
      homeScore: 14,
      awayScore: 16,
    },
    {
      id: 'e3',
      type: 'period_end',
      timestamp: 4,
      period: 3,
      gameTime: '0:00',
      teamId: game.homeTeamId,
      details: {},
      homeScore: 36,
      awayScore: 27,
    },
  ];

  const model = buildGameReportModel(game, tournaments);
  const labels = model.quarterRows.map((r) => r.label);
  assert(labels.filter((l) => l === 'Q2').length === 1, 'dedupe duplicate Q2');
  assert(model.quarterRows[1]?.home === '3', 'Q2 uses last period_end snapshot');
}

function testBrokenPersistedPrefersEvents(): void {
  const game = makeGame();
  game.teamStats!.home!.q1_points = 0;
  game.teamStats!.home!.q2_points = 0;
  game.teamStats!.home!.q3_points = 0;
  game.teamStats!.home!.q4_points = 20;
  game.teamStats!.away!.q1_points = 0;
  game.teamStats!.away!.q2_points = 0;
  game.teamStats!.away!.q3_points = 0;
  game.teamStats!.away!.q4_points = 10;
  game.events = [
    {
      id: 'e1',
      type: 'period_end',
      timestamp: 1,
      period: 1,
      gameTime: '0:00',
      teamId: game.homeTeamId,
      details: {},
      homeScore: 8,
      awayScore: 4,
    },
    {
      id: 'e2',
      type: 'period_end',
      timestamp: 2,
      period: 2,
      gameTime: '0:00',
      teamId: game.homeTeamId,
      details: {},
      homeScore: 14,
      awayScore: 7,
    },
    {
      id: 'e3',
      type: 'period_end',
      timestamp: 3,
      period: 3,
      gameTime: '0:00',
      teamId: game.homeTeamId,
      details: {},
      homeScore: 18,
      awayScore: 9,
    },
    {
      id: 'e4',
      type: 'period_end',
      timestamp: 4,
      period: 4,
      gameTime: '0:00',
      teamId: game.homeTeamId,
      details: {},
      homeScore: 20,
      awayScore: 10,
    },
  ];

  const model = buildGameReportModel(game, tournaments);
  assert(model.quarterRows[0]?.home === '8', 'reject all-Q4 persisted');
  assert(model.quarterRows[3]?.home === '2', 'Q4 home delta');
}

function testOverviewTablePayload(): void {
  const model = buildGameReportModel(makeGame(), tournaments);
  assert(model.comparisonRows.length >= 20, 'overview comparison rows for Summary tab');
  assert(model.comparisonRows.every((r) => r.label && r.home !== undefined), 'comparison row shape');
  assert(model.quarterRows.length >= 4, 'overview quarter rows for Summary tab');
  assert(model.quarterRows.every((r) => r.label && r.home !== undefined), 'quarter row shape');
}

function testFriendlyClassification(): void {
  const friendly = {
    ...makeGame(),
    id: 'friendly-1',
    isFriendly: true as const,
    tournamentId: undefined,
  };
  const model = buildGameReportModel(friendly, tournaments);
  assert(model.tournamentName === 'Friendly', 'friendly PDF classification');
}

function main(): void {
  testFormatting();
  testModelStructure();
  testOverviewTablePayload();
  testFriendlyClassification();
  testQuarterDerivationFromEvents();
  testQuarterDedupesDuplicatePeriodEnd();
  testBrokenPersistedPrefersEvents();
  console.log('All game-report-model tests passed.');
}

main();
