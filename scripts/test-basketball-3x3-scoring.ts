/**
 * Run: npm run test:basketball-3x3-scoring
 */

import {
  compute3x3Points,
  parseMmSsMinutes,
} from '../src/utils/basketball3x3Scoring';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function testCompute3x3Points(): void {
  // Carl vs Macau: 6-9 FG, 1-3 3PT, 0-1 FT → 7 pts (not CSV 13)
  assert(compute3x3Points(6, 1, 0) === 7, 'Carl Macau 3x3 points');
  assert(compute3x3Points(3, 0, 0) === 3, 'Louis Macau');
  assert(compute3x3Points(5, 1, 2) === 8, 'Carl Moratuwa');
  // NTU team totals
  assert(compute3x3Points(6, 1, 0) + compute3x3Points(3, 0, 0) + compute3x3Points(1, 0, 0) + compute3x3Points(1, 0, 0) === 12, 'Macau NTU total');
  assert(compute3x3Points(5, 1, 2) + compute3x3Points(4, 2, 1) + compute3x3Points(5, 1, 0) === 21, 'Moratuwa NTU total');
}

function testParseMmSsMinutes(): void {
  assert(parseMmSsMinutes('7.24') === 7.4, '7.24 → 7.40');
  assert(parseMmSsMinutes('8.25') === 8.42, '8.25 → 8.42');
  assert(parseMmSsMinutes('10') === 10, '10 → 10.00');
  assert(parseMmSsMinutes('7:33') === 7.55, '7:33 → 7.55');
}

function main(): void {
  testCompute3x3Points();
  testParseMmSsMinutes();
  console.log('All basketball 3x3 scoring tests passed.');
}

main();
