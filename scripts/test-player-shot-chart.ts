/**
 * Player career shot-chart aggregation (located shots only).
 * Run: npm run test:player-shot-chart
 */

import type { Game, GameStats, Shot } from '../src/App';
import { collectPlayerShotChartData, playerShotChartCoverageNote } from '../src/utils/playerShotChart';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function makeShot(overrides: Partial<Shot> & Pick<Shot, 'playerId' | 'id'>): Shot {
  return {
    x: 50,
    y: 50,
    made: true,
    isThree: false,
    timestamp: 1,
    period: 1,
    gameTime: '10:00',
    ...overrides,
  };
}

function game(partial: {
  id: string;
  tournamentId?: string;
  playerIds?: string[];
  shots?: Shot[];
}): Game {
  const playerIds = partial.playerIds ?? [];
  return {
    id: partial.id,
    homeTeamId: 'home',
    awayTeamId: 'away',
    tournamentId: partial.tournamentId,
    date: '2026-01-01',
    currentPeriod: 1,
    currentGameTime: '10:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    homeStarters: [],
    awayStarters: [],
    gameStats: playerIds.map((playerId) => ({ playerId } as GameStats)),
    teamStats: {
      home: { teamId: 'home', total_points: 0 } as Game['teamStats']['home'],
      away: { teamId: 'away', total_points: 0 } as Game['teamStats']['away'],
    },
    shots: partial.shots ?? [],
    events: [],
    lineupStints: [],
    homeTeam: { id: 'home', name: 'Home', abbreviation: 'H', players: [] },
    awayTeam: { id: 'away', name: 'Away', abbreviation: 'A', players: [] },
  };
}

function testAllTournamentsUnionsPlayerShots(): void {
  const games = [
    game({
      id: 'g1',
      tournamentId: 't-a',
      playerIds: ['p1'],
      shots: [
        makeShot({ id: 's1', playerId: 'p1' }),
        makeShot({ id: 's2', playerId: 'p2' }),
      ],
    }),
    game({
      id: 'g2',
      tournamentId: 't-b',
      playerIds: ['p1'],
      shots: [makeShot({ id: 's3', playerId: 'p1', made: false })],
    }),
  ];
  const result = collectPlayerShotChartData('p1', games, null);
  assert(result.shots.map((s) => s.id).join(',') === 's1,s3', 'all tournaments: only p1 shots');
  assert(result.gamesInScope === 2, 'all tournaments: two player games');
  assert(result.gamesWithShotData === 2, 'all tournaments: both have locations');
}

function testTournamentSubset(): void {
  const games = [
    game({
      id: 'g1',
      tournamentId: 't-a',
      playerIds: ['p1'],
      shots: [makeShot({ id: 's1', playerId: 'p1' })],
    }),
    game({
      id: 'g2',
      tournamentId: 't-b',
      playerIds: ['p1'],
      shots: [makeShot({ id: 's2', playerId: 'p1' })],
    }),
  ];
  const result = collectPlayerShotChartData('p1', games, new Set(['t-b']));
  assert(result.shots.map((s) => s.id).join(',') === 's2', 'subset: only selected tournament');
  assert(result.gamesInScope === 1, 'subset: one game in scope');
}

function testEmptySelectionYieldsNoShots(): void {
  const games = [
    game({
      id: 'g1',
      tournamentId: 't-a',
      playerIds: ['p1'],
      shots: [makeShot({ id: 's1', playerId: 'p1' })],
    }),
  ];
  const result = collectPlayerShotChartData('p1', games, new Set());
  assert(result.shots.length === 0, 'empty selection: no shots');
  assert(result.gamesInScope === 0, 'empty selection: no games');
}

function testExcludesOtherPlayers(): void {
  const games = [
    game({
      id: 'g1',
      tournamentId: 't-a',
      playerIds: ['p1', 'p2'],
      shots: [
        makeShot({ id: 's1', playerId: 'p2' }),
        makeShot({ id: 's2', playerId: 'p1' }),
      ],
    }),
  ];
  const result = collectPlayerShotChartData('p1', games, null);
  assert(result.shots.length === 1 && result.shots[0]?.id === 's2', 'other players excluded');
}

function testCoverageCountsGamesWithoutLocations(): void {
  const games = [
    game({
      id: 'live',
      tournamentId: 't-a',
      playerIds: ['p1'],
      shots: [makeShot({ id: 's1', playerId: 'p1' })],
    }),
    game({
      id: 'csv',
      tournamentId: 't-a',
      playerIds: ['p1'],
      shots: [],
    }),
    game({
      id: 'other-player',
      tournamentId: 't-a',
      playerIds: ['p2'],
      shots: [makeShot({ id: 's9', playerId: 'p2' })],
    }),
  ];
  const result = collectPlayerShotChartData('p1', games, null);
  assert(result.shots.length === 1, 'csv game adds no markers');
  assert(result.gamesInScope === 2, 'csv game still in denominator');
  assert(result.gamesWithShotData === 1, 'only located-shot games in numerator');
}

function testFriendliesOnlyWhenAllTournaments(): void {
  const games = [
    game({
      id: 'friendly',
      playerIds: ['p1'],
      shots: [makeShot({ id: 'sf', playerId: 'p1' })],
    }),
    game({
      id: 'official',
      tournamentId: 't-a',
      playerIds: ['p1'],
      shots: [makeShot({ id: 'so', playerId: 'p1' })],
    }),
  ];
  const all = collectPlayerShotChartData('p1', games, null);
  assert(all.shots.map((s) => s.id).sort().join(',') === 'sf,so', 'all: includes friendlies');
  const subset = collectPlayerShotChartData('p1', games, new Set(['t-a']));
  assert(subset.shots.map((s) => s.id).join(',') === 'so', 'subset: excludes friendlies');
}

function testShotsWithoutGameStatsRow(): void {
  const games = [
    game({
      id: 'g1',
      tournamentId: 't-a',
      playerIds: [],
      shots: [makeShot({ id: 's1', playerId: 'p1' })],
    }),
  ];
  const result = collectPlayerShotChartData('p1', games, null);
  assert(result.shots.length === 1, 'include games where player only appears on shots');
}

function testCoverageNote(): void {
  const mixed = collectPlayerShotChartData(
    'p1',
    [
      game({
        id: 'live',
        tournamentId: 't-a',
        playerIds: ['p1'],
        shots: [makeShot({ id: 's1', playerId: 'p1' })],
      }),
      game({
        id: 'csv',
        tournamentId: 't-a',
        playerIds: ['p1'],
        shots: [],
      }),
    ],
    null
  );
  assert(
    playerShotChartCoverageNote(mixed) ===
      'Chart uses shot locations from 1 of 2 games in this view.',
    'partial coverage note'
  );

  const none = collectPlayerShotChartData(
    'p1',
    [
      game({
        id: 'csv',
        tournamentId: 't-a',
        playerIds: ['p1'],
        shots: [],
      }),
    ],
    null
  );
  assert(
    playerShotChartCoverageNote(none) ===
      'None of these 1 games have shot locations.',
    'zero located games note'
  );

  const all = collectPlayerShotChartData(
    'p1',
    [
      game({
        id: 'live',
        tournamentId: 't-a',
        playerIds: ['p1'],
        shots: [makeShot({ id: 's1', playerId: 'p1' })],
      }),
    ],
    null
  );
  assert(playerShotChartCoverageNote(all) === null, 'full coverage: no note');

  const empty = collectPlayerShotChartData('p1', [], null);
  assert(playerShotChartCoverageNote(empty) === null, 'no games: no note');
}

function main(): void {
  testAllTournamentsUnionsPlayerShots();
  testTournamentSubset();
  testEmptySelectionYieldsNoShots();
  testExcludesOtherPlayers();
  testCoverageCountsGamesWithoutLocations();
  testFriendliesOnlyWhenAllTournaments();
  testShotsWithoutGameStatsRow();
  testCoverageNote();
  console.log('All player-shot-chart tests passed.');
}

main();
