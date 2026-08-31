/**
 * Court flip (camera view) survives localStorage snapshot + cloud meta round-trip.
 * Run: npm run test:court-sides-persist
 */

import type { Game } from '../src/App';
import {
  hydrateSnapshotGames,
  toSnapshotGames,
} from '../src/lib/appDataSnapshot';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function activeGame(flipped: boolean): Game {
  return {
    id: 'g-live',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: {
      id: 'home',
      name: 'Home',
      abbreviation: 'HOM',
      players: [],
    },
    awayTeam: {
      id: 'away',
      name: 'Away',
      abbreviation: 'AWY',
      players: [],
    },
    date: '2026-08-23',
    gameStats: [],
    teamStats: {
      home: { teamId: 'home', total_points: 0 } as Game['teamStats']['home'],
      away: { teamId: 'away', total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events: [{ id: 'e1', type: 'period_start', timestamp: 1, period: 1, gameTime: '10:00', teamId: 'home', details: {} }],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
    courtSidesFlipped: flipped,
  };
}

function testSnapshotRoundTrip(): void {
  const original = activeGame(true);
  const snapshot = toSnapshotGames([original])[0]!;
  assert(snapshot.courtSidesFlipped === true, 'snapshot stores courtSidesFlipped');

  const teams = [original.homeTeam, original.awayTeam];
  const hydrated = hydrateSnapshotGames([snapshot], teams)[0]!;
  assert(hydrated.courtSidesFlipped === true, 'hydrate restores courtSidesFlipped');
}

function testSnapshotFalseOmitsField(): void {
  const original = activeGame(false);
  const snapshot = toSnapshotGames([original])[0]!;
  assert(snapshot.courtSidesFlipped === false, 'snapshot stores false for active game');

  const hydrated = hydrateSnapshotGames([snapshot], [original.homeTeam, original.awayTeam])[0]!;
  assert(!hydrated.courtSidesFlipped, 'hydrate false → undefined/falsy');
}

function main(): void {
  testSnapshotRoundTrip();
  testSnapshotFalseOmitsField();
  console.log('All court-sides persist tests passed.');
}

main();
