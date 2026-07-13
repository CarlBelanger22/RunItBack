/**
 * Unit tests for shot chart display helpers.
 * Run: npm run test:shot-chart-display
 */

import {
  HOOP_X_M,
  HALF_COURT_LENGTH_M,
  percentToCourtPointM,
} from '../src/lib/fibaCourtGeometry';
import { horizontalBasketLeftX } from '../src/lib/horizontalCourtLayout';
import { halfCourtPointToHorizontalSvg } from '../src/lib/horizontalCourtClick';
import {
  shotsToHalfCourtMarkers,
  shotsToHorizontalHalfCourtMarkers,
} from '../src/utils/shotChartDisplay';
import type { Shot } from '../src/App';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function approx(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps;
}

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: 'shot-1',
    playerId: 'p1',
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

function testHalfCourtMarkers(): void {
  const [marker] = shotsToHalfCourtMarkers([
    makeShot({ x: 50, y: 100, made: true }),
  ]);
  assert(marker?.color === 'green', 'made → green');
  assert(approx(marker!.point.xM, HOOP_X_M), '50% x → center');
  assert(approx(marker!.point.yM, 0), '100% y → baseline');
}

function testHorizontalMarkersAtRim(): void {
  const shot = makeShot({ x: 50, y: 100, made: true });
  const [marker] = shotsToHorizontalHalfCourtMarkers([shot]);
  const expected = halfCourtPointToHorizontalSvg(
    percentToCourtPointM(shot.x, shot.y),
    true
  );

  assert(marker?.color === 'green', 'horizontal made → green');
  assert(approx(marker!.x, expected.x), 'horizontal x matches live entry');
  assert(approx(marker!.y, expected.y), 'horizontal y matches live entry');
  assert(approx(marker!.x, horizontalBasketLeftX()), 'rim shot at left basket x');
}

function testHorizontalMarkersAtHalfCourt(): void {
  const shot = makeShot({ x: 0, y: 0, made: false });
  const [marker] = shotsToHorizontalHalfCourtMarkers([shot]);
  const expected = halfCourtPointToHorizontalSvg(
    percentToCourtPointM(shot.x, shot.y),
    true
  );

  assert(marker?.color === 'red', 'miss → red');
  assert(approx(marker!.x, expected.x), 'half-court depth x');
  const half = percentToCourtPointM(shot.x, shot.y);
  assert(approx(half.yM, HALF_COURT_LENGTH_M), '0% y → half-court line');
}

function testPreservesOrder(): void {
  const markers = shotsToHorizontalHalfCourtMarkers([
    makeShot({ id: 'a', made: true }),
    makeShot({ id: 'b', made: false }),
  ]);
  assert(markers.length === 2, 'one marker per shot');
  assert(
    markers[0]?.color === 'green' && markers[1]?.color === 'red',
    'order preserved'
  );
}

function main(): void {
  testHalfCourtMarkers();
  testHorizontalMarkersAtRim();
  testHorizontalMarkersAtHalfCourt();
  testPreservesOrder();
  console.log('All shot-chart-display tests passed.');
}

main();
