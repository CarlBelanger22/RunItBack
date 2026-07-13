/**
 * Advanced metric display tests (LE-65).
 * Run: npm run test:metrics-display
 */

import { MetricsCalculator } from '../src/components/MetricsCalculator';
import type { GameStats } from '../src/App';
import { formatSignedDecimal } from '../src/utils/gameReportModel';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function baseStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    playerId: 'p1',
    points: 0,
    fg_made: 0,
    fg_attempted: 4,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 2,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: 2,
    blocks_received: 1,
    plus_minus: -12,
    minutes_played: 18.97,
    ...overrides,
  };
}

function testNegativeEfficiencyFromCalculator(): void {
  const eff = MetricsCalculator.calculateEfficiency(baseStats());
  assert(eff < 0, '0 pts on 4 FGA yields negative EFF');
  assert(eff === -4, `expected EFF -4, got ${eff}`);
}

function testNegativeGameScoreFromCalculator(): void {
  const gmSc = MetricsCalculator.calculateGameScore(baseStats());
  assert(gmSc < 0, 'poor shooting line yields negative GmSc');
}

function testFormatSignedDecimalShowsNegative(): void {
  const eff = MetricsCalculator.calculateEfficiency(baseStats());
  const formatted = formatSignedDecimal(eff, 0);
  assert(formatted === '-4', `formatSignedDecimal should show -4, got ${formatted}`);
  assert(formatted !== '0', 'must not clamp negative EFF to zero');
}

function testFormatSignedDecimalShowsPositive(): void {
  const stats = baseStats({
    points: 12,
    fg_made: 5,
    fg_attempted: 8,
    assists: 3,
    drb: 4,
  });
  const eff = MetricsCalculator.calculateEfficiency(stats);
  assert(eff > 0, 'productive line is positive');
  assert(formatSignedDecimal(eff, 0) === String(Math.round(eff)), 'positive EFF formats normally');
}

function main(): void {
  testNegativeEfficiencyFromCalculator();
  testNegativeGameScoreFromCalculator();
  testFormatSignedDecimalShowsNegative();
  testFormatSignedDecimalShowsPositive();
  console.log('All metrics-display tests passed.');
}

main();
