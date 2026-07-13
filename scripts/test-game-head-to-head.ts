/**
 * Game head-to-head model tests.
 * Run: npm run test:game-head-to-head
 */

import type { Game, GameStats, Player, Team } from '../src/App';
import {
  buildGameHeadToHeadModel,
  playerInitials,
  transposeQuarterRows,
} from '../src/utils/gameHeadToHeadModel';

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
    minutes_played: 32,
    ...overrides,
  };
}

function player(id: string, name: string, number: number): Player {
  return {
    id,
    name,
    number,
    position: 'G',
    height: '180',
    weight: '75',
    age: 20,
  };
}

function makeTeam(id: string, abbr: string, players: Player[]): Team {
  return { id, name: id, abbreviation: abbr, players };
}

function makeGame(overrides: Partial<Game> = {}): Game {
  const home = makeTeam('home', 'NTU', [
    player('h1', 'Carl Belanger', 22),
    player('h2', 'Alex Lee', 12),
  ]);
  const away = makeTeam('away', 'SNU', [player('a1', 'Kevin Lo', 14)]);

  return {
    id: 'g-h2h',
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    date: '2026-01-28',
    currentPeriod: 4,
    currentGameTime: '0:00',
    homeStarters: ['h1'],
    awayStarters: ['a1'],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 47, away: 44 },
    gameStats: [
      baseStat('h1', { points: 10, minutes_played: 28 }),
      baseStat('h2', { points: 8, minutes_played: 20 }),
      baseStat('a1', { points: 29, minutes_played: 36 }),
    ],
    shots: [],
    events: [],
    ...overrides,
  };
}

function testInitials(): void {
  assert(playerInitials('Carl Belanger') === 'CB', 'initials CB');
  assert(playerInitials('Kevin Lo') === 'KL', 'initials KL');
}

function testPicksHighestGmScPerTeam(): void {
  const game = makeGame();
  const model = buildGameHeadToHeadModel(game);

  assert(model.home?.playerId === 'h1', 'home pick h1 by GmSc');
  assert(model.away?.playerId === 'a1', 'away pick a1 by GmSc');
  assert(model.away?.points === 29, 'away points 29');
  assert(model.statRows.length === 5, 'five stat rows');
  assert(model.gmSc.label === 'GmSc', 'gmSc label');
}

function testGmScTieBreakByMinutes(): void {
  const tiedStats = baseStat('x', { points: 10, minutes_played: 10 });
  const game = makeGame({
    gameStats: [
      { ...tiedStats, playerId: 'h1', minutes_played: 20 },
      { ...tiedStats, playerId: 'h2', minutes_played: 35 },
      baseStat('a1', { points: 5, minutes_played: 10 }),
    ],
  });

  const model = buildGameHeadToHeadModel(game);
  assert(model.home?.playerId === 'h2', 'tie-break picks more minutes (h2)');
}

function testEmptyGame(): void {
  const game = makeGame({ gameStats: [] });
  const model = buildGameHeadToHeadModel(game);
  assert(model.home === null, 'no home player');
  assert(model.away === null, 'no away player');
  assert(model.statRows.every((r) => r.homeDisplay === '—'), 'home dashes');
}

function testTransposeQuarterRows(): void {
  const rows = [
    { label: 'Q1', home: '12', away: '13' },
    { label: 'Q2', home: '13', away: '13' },
    { label: 'Q3', home: '9', away: '8' },
    { label: 'Q4', home: '13', away: '10' },
  ];
  const table = transposeQuarterRows(rows, 'NTU', 'SNU');
  assert(table.periodHeaders.join(',') === 'Q1,Q2,Q3,Q4', 'period headers');
  assert(table.homeRow.scores.join(',') === '12,13,9,13', 'home scores');
  assert(table.awayRow.label === 'SNU', 'away label');
}

testInitials();
testPicksHighestGmScPerTeam();
testGmScTieBreakByMinutes();
testEmptyGame();
testTransposeQuarterRows();

console.log('All game head-to-head tests passed.');
