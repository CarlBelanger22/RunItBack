/**
 * Unit tests for game clock helpers used in setup and live entry.
 * Run: npm run test:game-clock
 */

import {
  clockForPeriod,
  defaultClockForFormat,
  defaultClockForTournament,
  formatPeriodClock,
  periodLabel,
  resolveGameClockSettings,
} from '../src/utils/gameClock';
import type { Game } from '../src/App';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function testDefaultClockForFormat(): void {
  const fiba = defaultClockForFormat('5v5');
  assert(fiba.regulationPeriods === 4, '5v5 has 4 regulation periods');
  assert(fiba.regulationPeriodMinutes === 10, '5v5 periods are 10 minutes');
  assert(fiba.overtimePeriodMinutes === 5, '5v5 OT is 5 minutes');

  const three = defaultClockForFormat('3x3');
  assert(three.regulationPeriods === 1, '3x3 has 1 period');
  assert(three.regulationPeriodMinutes === 10, '3x3 period is 10 minutes');
}

function testClockForPeriod(): void {
  const settings = defaultClockForFormat('5v5');
  assert(clockForPeriod(1, settings) === '10:00', 'Q1 clock');
  assert(clockForPeriod(4, settings) === '10:00', 'Q4 clock');
  assert(clockForPeriod(5, settings) === '5:00', 'OT1 clock');
  assert(clockForPeriod(6, settings) === '5:00', 'OT2 clock');
}

function testPeriodLabel(): void {
  const settings = defaultClockForFormat('5v5');
  assert(periodLabel(1, settings) === 'Q1', 'Q1 label');
  assert(periodLabel(4, settings) === 'Q4', 'Q4 label');
  assert(periodLabel(5, settings) === 'OT1', 'OT1 label');
}

function testResolveGameClockSettings(): void {
  const custom = {
    regulationPeriods: 2,
    regulationPeriodMinutes: 12,
    overtimePeriodMinutes: 3,
  };
  const game = {
    id: 'g1',
    tournamentId: 't1',
    clockSettings: custom,
  } as Game;

  assert(
    resolveGameClockSettings(game) === custom,
    'uses game.clockSettings when set'
  );
  assert(
    resolveGameClockSettings({ ...game, clockSettings: undefined }).regulationPeriods === 4,
    'falls back to tournament default'
  );
}

function testFormatPeriodClock(): void {
  assert(formatPeriodClock(10) === '10:00', 'formats whole minutes');
  assert(formatPeriodClock(0) === '0:00', 'formats zero');
}

function testDefaultClockForTournament(): void {
  const t3 = defaultClockForTournament('t-3x3', {
    id: 't-3x3',
    gameFormat: '3x3',
  });
  assert(t3.regulationPeriods === 1, 'tournament 3x3 format');
}

function main(): void {
  testDefaultClockForFormat();
  testClockForPeriod();
  testPeriodLabel();
  testResolveGameClockSettings();
  testFormatPeriodClock();
  testDefaultClockForTournament();
  console.log('All game clock tests passed.');
}

main();
