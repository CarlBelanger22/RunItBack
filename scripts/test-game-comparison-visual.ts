/**
 * Game comparison visual model tests.
 * Run: npm run test:game-comparison-visual
 */

import type { Game, GameStats, Player, Team } from '../src/App';
import {
  buildGameComparisonVisualModel,
  minorBarPercents,
  splitBarPercents,
} from '../src/utils/gameComparisonVisualModel';

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
    id: 'g-visual',
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
    finalScore: { home: 20, away: 10 },
    gameStats: [
      baseStat('h1', { points: 12, fg_made: 5, fg_attempted: 10, three_made: 2, three_attempted: 4 }),
      baseStat('h2', { points: 8, fg_made: 3, fg_attempted: 6, three_made: 0, three_attempted: 1 }),
      baseStat('a1', { points: 10, fg_made: 4, fg_attempted: 8, three_made: 1, three_attempted: 3 }),
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
        three_attempted: 5,
        two_made: 6,
        two_attempted: 11,
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
        points_in_paint: 10,
        fastbreak_points: 4,
        second_chance_points: 2,
        bench_points: 8,
        points_off_turnovers: 6,
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
        points_in_paint: 4,
        fastbreak_points: 2,
        second_chance_points: 1,
        bench_points: 0,
        points_off_turnovers: 2,
      },
    },
    shots: [],
    events: [],
    lineupStints: [],
  };
}

function testBarHelpers(): void {
  const split = splitBarPercents(26, 39);
  assert(Math.abs(split.homePct - (26 / 65) * 100) < 0.01, 'split bar home pct');
  assert(Math.abs(split.awayPct - (39 / 65) * 100) < 0.01, 'split bar away pct');

  const minor = minorBarPercents(10, 8);
  assert(minor.homePct === 100, 'minor bar leader is 100%');
  assert(minor.awayPct === 80, 'minor bar trailing scales to 80%');

  const even = splitBarPercents(0, 0);
  assert(even.homePct === 50 && even.awayPct === 50, 'zero totals split evenly');
}

function testShootingRows(): void {
  const model = buildGameComparisonVisualModel(makeGame());
  assert(model.shooting.length === 4, 'four shooting rows incl FT');

  const two = model.shooting.find((r) => r.key === 'two')!;
  assert(two.home.line === '6/11', 'home 2PT line derived from FG-3PT');
  assert(two.away.line === '3/5', 'away 2PT line');
  assert(two.home.pct === 55, 'home 2PT pct rounded');
  assert(two.label === '2 pointers', '2PT label');

  const ft = model.shooting.find((r) => r.key === 'ft')!;
  assert(ft.home.line === '2/4', 'home FT line from player totals');
}

function testMajorAndAdvancedRows(): void {
  const model = buildGameComparisonVisualModel(makeGame());
  assert(model.majorGroups.length === 1, 'rebounds group only');

  const rebounds = model.majorGroups.find((g) => g.key === 'rebounds')!;
  assert(rebounds.minors.length === 2, 'DRB and ORB minors');
  assert(rebounds.home.display === '12', 'home rebounds total');

  assert(model.minorRows.length === 5, 'AST STL BLK PF TO rows');
  assert(model.minorRows[0].key === 'assists' && model.minorRows[0].major === true, 'assists major row first');
  assert(
    model.minorRows.map((r) => r.key).join(',') === 'assists,steals,blocks,fouls,turnovers',
    'core stat order'
  );

  assert(model.advancedRows.length === 5, 'five advanced rows');
  assert(model.advancedRows[0].key === 'pts_off_to', 'Pts off TO first in advanced');
  assert(model.advancedRows.some((r) => r.key === 'paint'), 'advanced paint row');
  assert(!model.advancedRows.some((r) => r.key === 'efg'), 'no eFG% in team comparison');
  assert(!model.advancedRows.some((r) => r.key === 'ts'), 'no TS% in team comparison');
}

function main(): void {
  testBarHelpers();
  testShootingRows();
  testMajorAndAdvancedRows();
  console.log('All game-comparison-visual tests passed.');
}

main();
