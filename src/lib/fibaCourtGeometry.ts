/**
 * FIBA half-court geometry in meters (15 m wide × 14 m deep).
 * Basket at baseline center: (HOOP_X_M, HOOP_Y_M) with baseline y = 0.
 */

export const COURT_WIDTH_M = 15;
export const HALF_COURT_LENGTH_M = 14;

export const HOOP_X_M = COURT_WIDTH_M / 2;
export const HOOP_Y_M = 0;

/** Lane (paint): 4.9 m wide × 5.8 m deep from baseline. */
export const PAINT_WIDTH_M = 4.9;
export const PAINT_DEPTH_M = 5.8;
export const PAINT_LEFT_M = HOOP_X_M - PAINT_WIDTH_M / 2;
export const PAINT_RIGHT_M = HOOP_X_M + PAINT_WIDTH_M / 2;

/** FIBA three-point arc radius from basket center (6.75 m). */
export const THREE_ARC_RADIUS_M = 6.75;

/** Straight corner segments: 0.9 m from each sideline. */
export const THREE_CORNER_INSET_M = 0.9;
export const THREE_CORNER_LEFT_M = THREE_CORNER_INSET_M;
export const THREE_CORNER_RIGHT_M = COURT_WIDTH_M - THREE_CORNER_INSET_M;

/** Y where the arc meets the corner straight line (derived from geometry). */
export function threeArcBreakYM(threeArcRadiusM: number = THREE_ARC_RADIUS_M): number {
  return Math.sqrt(threeArcRadiusM ** 2 - (HOOP_X_M - THREE_CORNER_LEFT_M) ** 2);
}

export const THREE_ARC_BREAK_Y_M = threeArcBreakYM();

export type CourtPointM = { xM: number; yM: number };
export type ShotZone = 'paint' | 'two' | 'three';

export interface ResolvedShotZone {
  zone: ShotZone;
  isPaint: boolean;
  shotValue: 2 | 3;
  distanceFromHoopM: number;
}

export function distanceFromHoopM(p: CourtPointM): number {
  const dx = p.xM - HOOP_X_M;
  const dy = p.yM - HOOP_Y_M;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isInPaint(p: CourtPointM): boolean {
  return (
    p.xM >= PAINT_LEFT_M &&
    p.xM <= PAINT_RIGHT_M &&
    p.yM >= HOOP_Y_M &&
    p.yM <= PAINT_DEPTH_M
  );
}

/**
 * True when the shot is a three-pointer by FIBA arc + corner straight segments.
 * Paint is handled separately in {@link resolveShotZone}.
 */
export function isBeyondThreePointLine(
  p: CourtPointM,
  threeArcRadiusM: number = THREE_ARC_RADIUS_M
): boolean {
  const d = distanceFromHoopM(p);
  const breakY = threeArcBreakYM(threeArcRadiusM);

  const inCornerStraightBand =
    p.yM >= HOOP_Y_M &&
    p.yM <= breakY &&
    (p.xM <= THREE_CORNER_LEFT_M || p.xM >= THREE_CORNER_RIGHT_M);

  return d > threeArcRadiusM || inCornerStraightBand;
}

export function resolveShotZone(
  p: CourtPointM,
  threeArcRadiusM: number = THREE_ARC_RADIUS_M
): ResolvedShotZone {
  const distM = distanceFromHoopM(p);

  if (isInPaint(p)) {
    return {
      zone: 'paint',
      isPaint: true,
      shotValue: 2,
      distanceFromHoopM: distM,
    };
  }

  if (isBeyondThreePointLine(p, threeArcRadiusM)) {
    return {
      zone: 'three',
      isPaint: false,
      shotValue: 3,
      distanceFromHoopM: distM,
    };
  }

  return {
    zone: 'two',
    isPaint: false,
    shotValue: 2,
    distanceFromHoopM: distM,
  };
}

/** Clamp a court point to the half-court bounds. */
export function clampCourtPointM(p: CourtPointM): CourtPointM {
  return {
    xM: Math.min(COURT_WIDTH_M, Math.max(0, p.xM)),
    yM: Math.min(HALF_COURT_LENGTH_M, Math.max(0, p.yM)),
  };
}

/**
 * Map a DOM click to court meters.
 * Assumes baseline at the top of the element (yM = 0) and half-court line at the bottom.
 */
export function clickToCourtPointM(
  clientX: number,
  clientY: number,
  rect: DOMRect
): CourtPointM {
  if (rect.width <= 0 || rect.height <= 0) {
    return { xM: HOOP_X_M, yM: HOOP_Y_M };
  }

  const xM = ((clientX - rect.left) / rect.width) * COURT_WIDTH_M;
  const yM = ((clientY - rect.top) / rect.height) * HALF_COURT_LENGTH_M;

  return clampCourtPointM({ xM, yM });
}

/** Map a DOM click when the court is rendered with the basket at the bottom. */
export function clickToCourtPointMHoopBottom(
  clientX: number,
  clientY: number,
  rect: DOMRect
): CourtPointM {
  if (rect.width <= 0 || rect.height <= 0) {
    return { xM: HOOP_X_M, yM: HOOP_Y_M };
  }

  const xM = ((clientX - rect.left) / rect.width) * COURT_WIDTH_M;
  const yFromTop = ((clientY - rect.top) / rect.height) * HALF_COURT_LENGTH_M;
  const yM = HALF_COURT_LENGTH_M - yFromTop;

  return clampCourtPointM({ xM, yM });
}

/** SVG viewBox space: same meter scale, y increases downward (baseline at top). */
export function courtPointMToSvg(p: CourtPointM): { x: number; y: number } {
  return { x: p.xM, y: p.yM };
}

/** Legacy shot chart storage uses 0–100 percentages (baseline at bottom in LiveGameEntry). */
export function courtPointMToPercent(p: CourtPointM): { x: number; y: number } {
  return {
    x: (p.xM / COURT_WIDTH_M) * 100,
    y: ((HALF_COURT_LENGTH_M - p.yM) / HALF_COURT_LENGTH_M) * 100,
  };
}

export function percentToCourtPointM(x: number, y: number): CourtPointM {
  return {
    xM: (x / 100) * COURT_WIDTH_M,
    yM: HALF_COURT_LENGTH_M - (y / 100) * HALF_COURT_LENGTH_M,
  };
}
