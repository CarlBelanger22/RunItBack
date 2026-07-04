/**
 * Opening tip gate — only prompt before jump_ball opening event exists.
 * Run: npm run test:opening-tip
 */

import type { Game, GameEvent } from '../src/App';
import {
  gameNeedsOpeningJumpBall,
  hasOpeningTipBeenRecorded,
} from '../src/liveEntry/possessionArrow';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function emptyGame(events: GameEvent[] = []): Game {
  return {
    id: 'g1',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: { id: 'home', name: 'Home', abbreviation: 'HOM', players: [] },
    awayTeam: { id: 'away', name: 'Away', abbreviation: 'AWY', players: [] },
    date: '2026-01-01',
    gameStats: [],
    teamStats: {
      home: { teamId: 'home', total_points: 5 } as Game['teamStats']['home'],
      away: { teamId: 'away', total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events,
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '8:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
}

function testEmptyEventsNeedsOpening(): void {
  assert(!hasOpeningTipBeenRecorded([]), 'no opening event');
  assert(gameNeedsOpeningJumpBall(emptyGame([])), 'brand-new game needs tip');
}

function testScoredGameWithOpeningEventDoesNotNeedTip(): void {
  const events: GameEvent[] = [
    {
      id: 'e1',
      type: 'jump_ball',
      timestamp: 1,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      details: { kind: 'opening', winnerTeamId: 'home' },
      homeScore: 0,
      awayScore: 0,
    },
    {
      id: 'e2',
      type: 'shot_attempt',
      timestamp: 2,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'p1',
      details: { made: true, isThree: false },
      homeScore: 2,
      awayScore: 0,
    },
  ];
  assert(hasOpeningTipBeenRecorded(events), 'opening recorded');
  assert(!gameNeedsOpeningJumpBall(emptyGame(events)), 'in-progress game skips tip');
}

function testScoredGameWithoutOpeningStillNeedsTip(): void {
  const events: GameEvent[] = [
    {
      id: 'e2',
      type: 'shot_attempt',
      timestamp: 2,
      period: 1,
      gameTime: '10:00',
      teamId: 'home',
      playerId: 'p1',
      details: { made: true, isThree: false },
      homeScore: 2,
      awayScore: 0,
    },
  ];
  assert(gameNeedsOpeningJumpBall(emptyGame(events)), 'missing opening event still needs tip');
}

function main(): void {
  testEmptyEventsNeedsOpening();
  testScoredGameWithOpeningEventDoesNotNeedTip();
  testScoredGameWithoutOpeningStillNeedsTip();
  console.log('All opening-tip tests passed.');
}

main();
