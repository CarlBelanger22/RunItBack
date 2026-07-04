/**
 * End Q / End Game period-end helpers.
 * Run: npm run test:end-period
 */

import type { Game } from '../src/App';
import {
  defaultClockForFormat,
  endPeriodButtonLabel,
  shouldCompleteGameOnPeriodEnd,
  shouldPromptLineupAfterPeriodEnd,
} from '../src/utils/gameClock';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function gameWithPeriod(period: number, format: '5v5' | '3x3'): Game {
  return {
    id: 'g1',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: { id: 'home', name: 'Home', abbreviation: 'HOM', players: [] },
    awayTeam: { id: 'away', name: 'Away', abbreviation: 'AWY', players: [] },
    date: '2026-01-01',
    gameStats: [],
    teamStats: {
      home: { teamId: 'home', total_points: 0 } as Game['teamStats']['home'],
      away: { teamId: 'away', total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: period,
    currentGameTime: '0:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
    clockSettings: defaultClockForFormat(format),
  };
}

function test5v5MidRegulation(): void {
  const g = gameWithPeriod(2, '5v5');
  assert(endPeriodButtonLabel(g, 40, 38) === 'End Q', 'Q2 ahead → End Q');
  assert(!shouldCompleteGameOnPeriodEnd(g, 40, 38), 'Q2 ahead does not complete');
  assert(shouldPromptLineupAfterPeriodEnd(g, 40, 38), 'Q2 advances with lineup');
  assert(shouldPromptLineupAfterPeriodEnd(g, 40, 40), 'Q2 tied still advances');
}

function test5v5Q4(): void {
  const g = gameWithPeriod(4, '5v5');
  assert(endPeriodButtonLabel(g, 80, 70) === 'End Game', 'Q4 ahead → End Game');
  assert(shouldCompleteGameOnPeriodEnd(g, 80, 70), 'Q4 ahead completes');
  assert(!shouldPromptLineupAfterPeriodEnd(g, 80, 70), 'Q4 ahead no lineup');

  assert(endPeriodButtonLabel(g, 80, 80) === 'End Q', 'Q4 tied → End Q');
  assert(!shouldCompleteGameOnPeriodEnd(g, 80, 80), 'Q4 tied does not complete');
  assert(shouldPromptLineupAfterPeriodEnd(g, 80, 80), 'Q4 tied → OT lineup');
}

function test5v5Overtime(): void {
  const g = gameWithPeriod(5, '5v5');
  assert(endPeriodButtonLabel(g, 85, 82) === 'End Game', 'OT1 ahead → End Game');
  assert(shouldCompleteGameOnPeriodEnd(g, 85, 82), 'OT1 ahead completes');
  assert(!shouldPromptLineupAfterPeriodEnd(g, 85, 82), 'OT1 ahead no lineup');

  assert(endPeriodButtonLabel(g, 85, 85) === 'End Q', 'OT1 tied → End Q');
  assert(shouldPromptLineupAfterPeriodEnd(g, 85, 85), 'OT1 tied → OT2 lineup');
}

function test3x3Regulation(): void {
  const g = gameWithPeriod(1, '3x3');
  assert(endPeriodButtonLabel(g, 21, 18) === 'End Game', '3x3 Q1 ahead → End Game');
  assert(shouldCompleteGameOnPeriodEnd(g, 21, 18), '3x3 ahead completes');
  assert(!shouldPromptLineupAfterPeriodEnd(g, 21, 18), '3x3 ahead no lineup');

  assert(endPeriodButtonLabel(g, 21, 21) === 'End Q', '3x3 Q1 tied → End Q');
  assert(shouldPromptLineupAfterPeriodEnd(g, 21, 21), '3x3 tied → OT lineup');
}

function main(): void {
  test5v5MidRegulation();
  test5v5Q4();
  test5v5Overtime();
  test3x3Regulation();
  console.log('All end-period tests passed.');
}

main();
