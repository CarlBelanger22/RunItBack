/**
 * Unit tests for FIBA half-court zone resolution.
 * Run: npm run test:fiba-court-geometry
 */

import {
  COURT_WIDTH_M,
  HALF_COURT_LENGTH_M,
  HOOP_X_M,
  PAINT_DEPTH_M,
  PAINT_LEFT_M,
  PAINT_RIGHT_M,
  PAINT_WIDTH_M,
  THREE_ARC_RADIUS_M,
  THREE_ARC_BREAK_Y_M,
  THREE_CORNER_LEFT_M,
  clickToCourtPointM,
  courtPointMToPercent,
  courtPointMToSvg,
  distanceFromHoopM,
  isBeyondThreePointLine,
  isInPaint,
  percentToCourtPointM,
  resolveShotZone,
} from '../src/lib/fibaCourtGeometry';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function approx(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps;
}

function testPaintZone(): void {
  assert(isInPaint({ xM: HOOP_X_M, yM: 0 }), 'rim center in paint');
  assert(isInPaint({ xM: HOOP_X_M, yM: PAINT_DEPTH_M }), 'paint back edge');
  assert(isInPaint({ xM: PAINT_LEFT_M, yM: 2 }), 'paint left edge');
  assert(isInPaint({ xM: PAINT_RIGHT_M, yM: 2 }), 'paint right edge');
  assert(!isInPaint({ xM: PAINT_LEFT_M - 0.01, yM: 2 }), 'just left of paint');
  assert(!isInPaint({ xM: HOOP_X_M, yM: PAINT_DEPTH_M + 0.01 }), 'just beyond paint depth');

  const paint = resolveShotZone({ xM: HOOP_X_M, yM: 2.9 });
  assert(paint.zone === 'paint', 'paint center resolves paint');
  assert(paint.isPaint && paint.shotValue === 2, 'paint is 2PT');
}

function testTwoPointZone(): void {
  const mid = resolveShotZone({ xM: 4, yM: 4 });
  assert(mid.zone === 'two', 'short midrange is 2PT');
  assert(!mid.isPaint && mid.shotValue === 2, 'midrange value');

  const topKey = resolveShotZone({ xM: HOOP_X_M, yM: 6.5 });
  assert(topKey.zone === 'two', 'top of key inside arc is 2PT');
  assert(approx(topKey.distanceFromHoopM, 6.5), 'top key distance');
}

function testThreePointArc(): void {
  const onArc = resolveShotZone({ xM: HOOP_X_M, yM: THREE_ARC_RADIUS_M + 0.05 });
  assert(onArc.zone === 'three', 'just outside arc at center is 3PT');

  const insideArc = resolveShotZone({ xM: HOOP_X_M, yM: THREE_ARC_RADIUS_M - 0.05 });
  assert(insideArc.zone === 'two', 'just inside arc at center is 2PT');

  assert(
    approx(distanceFromHoopM({ xM: HOOP_X_M, yM: THREE_ARC_RADIUS_M }), THREE_ARC_RADIUS_M),
    'arc boundary distance'
  );
}

function testCornerThree(): void {
  assert(
    isBeyondThreePointLine({ xM: 0.5, yM: THREE_ARC_BREAK_Y_M - 0.1 }),
    'deep corner inside straight band is beyond 3PT line'
  );

  const corner = resolveShotZone({ xM: 0.5, yM: 0.5 });
  assert(corner.zone === 'three', 'left corner short shot is 3PT');
  assert(corner.shotValue === 3, 'corner value');

  const rightCorner = resolveShotZone({ xM: COURT_WIDTH_M - 0.5, yM: 0.5 });
  assert(rightCorner.zone === 'three', 'right corner short shot is 3PT');
}

function testClickMapping(): void {
  const rect = {
    left: 0,
    top: 0,
    width: 300,
    height: 280,
    right: 300,
    bottom: 280,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;

  const hoop = clickToCourtPointM(150, 0, rect);
  assert(approx(hoop.xM, HOOP_X_M), 'click center-top → hoop x');
  assert(approx(hoop.yM, 0), 'click top → baseline y=0');

  const halfCourt = clickToCourtPointM(0, 280, rect);
  assert(approx(halfCourt.yM, HALF_COURT_LENGTH_M), 'click bottom → half-court line');
  assert(approx(halfCourt.xM, 0), 'click bottom-left → x=0');
}

function testPercentRoundTrip(): void {
  const original = { xM: 7.5, yM: 3.2 };
  const pct = courtPointMToPercent(original);
  const back = percentToCourtPointM(pct.x, pct.y);
  assert(approx(back.xM, original.xM), 'percent round-trip x');
  assert(approx(back.yM, original.yM), 'percent round-trip y');
}

function testSvgMapping(): void {
  const svg = courtPointMToSvg({ xM: 7.5, yM: 5 });
  assert(svg.x === 7.5 && svg.y === 5, 'svg uses 1:1 meter coords');
}

function testConstants(): void {
  assert(THREE_CORNER_LEFT_M === 0.9, 'corner inset 0.9 m');
  assert(approx(THREE_ARC_BREAK_Y_M, 1.415, 0.01), 'arc break y ~1.415 m');
  assert(PAINT_LEFT_M + PAINT_WIDTH_M === PAINT_RIGHT_M, 'paint width 4.9 m');
}

function main(): void {
  testConstants();
  testPaintZone();
  testTwoPointZone();
  testThreePointArc();
  testCornerThree();
  testClickMapping();
  testPercentRoundTrip();
  testSvgMapping();
  console.log('All fibaCourtGeometry tests passed.');
}

main();
