/**
 * Horizontal court layout ↔ FIBA zone alignment tests.
 * Run: npm run test:horizontal-court-layout
 */

import {
  HOOP_X_M,
  THREE_CORNER_INSET_M,
  resolveShotZone,
} from '../src/lib/fibaCourtGeometry';
import {
  halfCourtPointToHorizontalSvg,
  horizontalClickToHalfCourtPoint,
  resolveHorizontalShotZone,
} from '../src/lib/horizontalCourtClick';
import {
  HORIZONTAL_CORNER_Y_SVG,
  HORIZONTAL_COURT_VH,
  HORIZONTAL_INSET,
  HORIZONTAL_SVG_PER_METER_DEPTH,
  HORIZONTAL_SVG_PER_METER_WIDTH,
  HORIZONTAL_THREE_ARC_OUTWARD_M,
  HORIZONTAL_THREE_ARC_RADIUS_SVG,
  horizontalBasketLeftX,
  horizontalBaselineLeftX,
  horizontalThreeArcRadiusM,
} from '../src/lib/horizontalCourtLayout';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function approx(a: number, b: number, eps = 0.05): boolean {
  return Math.abs(a - b) <= eps;
}

function testThreeArcRadiusMatchesDrawAndClicks(): void {
  const basketX = horizontalBasketLeftX();
  const basketY = HORIZONTAL_COURT_VH / 2;

  const arcM = horizontalThreeArcRadiusM();
  const expectedSvg = arcM * HORIZONTAL_SVG_PER_METER_DEPTH;
  assert(
    approx(HORIZONTAL_THREE_ARC_RADIUS_SVG, expectedSvg),
    `HORIZONTAL_THREE_ARC_RADIUS_SVG ${HORIZONTAL_THREE_ARC_RADIUS_SVG} ≈ ${expectedSvg}`
  );
  assert(
    HORIZONTAL_THREE_ARC_OUTWARD_M >= 0.45,
    `outward nudge ${HORIZONTAL_THREE_ARC_OUTWARD_M} m must stay perceptible (≥ 0.45 m)`
  );

  const onArcM = { xM: HOOP_X_M, yM: arcM };
  const svg = halfCourtPointToHorizontalSvg(onArcM, true);
  const svgDist = Math.hypot(svg.x - basketX, svg.y - basketY);

  assert(
    approx(svgDist, HORIZONTAL_THREE_ARC_RADIUS_SVG),
    `center arc SVG distance ${svgDist} ≈ ${HORIZONTAL_THREE_ARC_RADIUS_SVG}`
  );

  const inside = resolveHorizontalShotZone({ xM: HOOP_X_M, yM: arcM - 0.05 });
  const outside = resolveHorizontalShotZone({ xM: HOOP_X_M, yM: arcM + 0.05 });
  assert(inside.shotValue === 2, 'just inside drawn arc is 2PT');
  assert(outside.shotValue === 3, 'just outside drawn arc is 3PT');

  const strictInside = resolveShotZone({ xM: HOOP_X_M, yM: arcM - 0.05 }, arcM);
  const strictOutside = resolveShotZone({ xM: HOOP_X_M, yM: arcM + 0.05 }, arcM);
  assert(strictInside.shotValue === 2, 'resolveShotZone boundary inside matches arcM');
  assert(strictOutside.shotValue === 3, 'resolveShotZone boundary outside matches arcM');
}

function testCornerInsetMatchesFiba(): void {
  const expected =
    HORIZONTAL_INSET + THREE_CORNER_INSET_M * HORIZONTAL_SVG_PER_METER_WIDTH;
  assert(
    approx(HORIZONTAL_CORNER_Y_SVG, expected),
    'corner straight Y derived from FIBA 0.9 m sideline inset'
  );
}

function testBaselineClickRegisters(): void {
  const rect = {
    left: 0,
    top: 0,
    width: 188,
    height: 100,
    right: 188,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;

  const homeId = 'home-team';
  const centerY = HORIZONTAL_COURT_VH / 2;

  const baselinePoint = horizontalClickToHalfCourtPoint(
    horizontalBaselineLeftX(),
    centerY,
    rect,
    homeId,
    homeId
  );
  assert(baselinePoint !== null, 'click on left baseline registers');
  assert(approx(baselinePoint!.yM, 0), 'left baseline maps to yM=0');

  const paintPoint = horizontalClickToHalfCourtPoint(
    horizontalBaselineLeftX() + 2,
    centerY,
    rect,
    homeId,
    homeId
  );
  assert(paintPoint !== null, 'click between baseline and rim registers');
  assert(approx(paintPoint!.yM, 0), 'behind-rim strip maps to yM=0');
}

function main(): void {
  testThreeArcRadiusMatchesDrawAndClicks();
  testCornerInsetMatchesFiba();
  testBaselineClickRegisters();
  console.log('All horizontalCourtLayout tests passed.');
}

main();
