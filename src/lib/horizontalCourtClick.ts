import {
  COURT_WIDTH_M,
  clampCourtPointM,
  resolveShotZone,
  type CourtPointM,
} from './fibaCourtGeometry';
import {
  HORIZONTAL_COURT_VH,
  HORIZONTAL_COURT_VW,
  HORIZONTAL_HALF_WIDTH_SVG,
  HORIZONTAL_INSET,
  HORIZONTAL_PLAYABLE_H,
  HORIZONTAL_SVG_EPS,
  HORIZONTAL_SVG_PER_METER_DEPTH,
  horizontalBasketLeftX,
  horizontalBasketRightX,
  horizontalSvgDepthToYMeters,
  horizontalThreeArcRadiusM,
} from './horizontalCourtLayout';

/** Home attacks the left basket; away attacks the right basket. */
export function homeAttacksLeft(homeTeamId: string, offenseTeamId: string): boolean {
  return offenseTeamId === homeTeamId;
}

/**
 * Map a click on the horizontal full-court canvas to half-court meters.
 * Returns null when the click is outside the active offensive half.
 */
export function horizontalClickToHalfCourtPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  homeTeamId: string,
  offenseTeamId: string
): CourtPointM | null {
  if (rect.width <= 0 || rect.height <= 0) return null;

  const xSvg = ((clientX - rect.left) / rect.width) * HORIZONTAL_COURT_VW;
  const ySvg = ((clientY - rect.top) / rect.height) * HORIZONTAL_COURT_VH;

  if (ySvg < HORIZONTAL_INSET - HORIZONTAL_SVG_EPS || ySvg > HORIZONTAL_COURT_VH - HORIZONTAL_INSET + HORIZONTAL_SVG_EPS) {
    return null;
  }

  const xM = ((ySvg - HORIZONTAL_INSET) / HORIZONTAL_PLAYABLE_H) * COURT_WIDTH_M;
  const attacksLeft = homeAttacksLeft(homeTeamId, offenseTeamId);

  if (attacksLeft) {
    if (xSvg > HORIZONTAL_HALF_WIDTH_SVG) return null;
  } else if (xSvg < HORIZONTAL_HALF_WIDTH_SVG) {
    return null;
  }

  const yM = horizontalSvgDepthToYMeters(xSvg, attacksLeft);
  if (yM === null) return null;

  return clampCourtPointM({ xM, yM });
}

/** Shot zone for horizontal live court (drawn arc includes {@link horizontalThreeArcRadiusM}). */
export function resolveHorizontalShotZone(point: CourtPointM) {
  return resolveShotZone(point, horizontalThreeArcRadiusM());
}

/** Display a half-court point on the horizontal SVG. */
export function halfCourtPointToHorizontalSvg(
  point: CourtPointM,
  attacksLeft: boolean
): { x: number; y: number } {
  const ySvg = HORIZONTAL_INSET + (point.xM / COURT_WIDTH_M) * HORIZONTAL_PLAYABLE_H;

  if (attacksLeft) {
    const xSvg = horizontalBasketLeftX() + point.yM * HORIZONTAL_SVG_PER_METER_DEPTH;
    return { x: xSvg, y: ySvg };
  }

  const xSvg = horizontalBasketRightX() - point.yM * HORIZONTAL_SVG_PER_METER_DEPTH;
  return { x: xSvg, y: ySvg };
}
