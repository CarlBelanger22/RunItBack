import {
  COURT_WIDTH_M,
  HALF_COURT_LENGTH_M,
  clampCourtPointM,
  type CourtPointM,
} from './fibaCourtGeometry';
import {
  HORIZONTAL_COURT_VH,
  HORIZONTAL_COURT_VW,
  HORIZONTAL_INSET,
} from './figmaHorizontalCourtSvg';

const HALF_WIDTH_SVG = HORIZONTAL_COURT_VW / 2;

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

  const playableH = HORIZONTAL_COURT_VH - 2 * HORIZONTAL_INSET;
  const halfPlayableW = HALF_WIDTH_SVG - HORIZONTAL_INSET;
  const xM = ((ySvg - HORIZONTAL_INSET) / playableH) * COURT_WIDTH_M;

  if (homeAttacksLeft(homeTeamId, offenseTeamId)) {
    if (xSvg > HALF_WIDTH_SVG) return null;
    const depth = xSvg - HORIZONTAL_INSET;
    if (depth < 0 || depth > halfPlayableW) return null;
    const yM = (depth / halfPlayableW) * HALF_COURT_LENGTH_M;
    return clampCourtPointM({ xM, yM });
  }

  if (xSvg < HALF_WIDTH_SVG) return null;
  const depth = HORIZONTAL_COURT_VW - HORIZONTAL_INSET - xSvg;
  if (depth < 0 || depth > halfPlayableW) return null;
  const yM = (depth / halfPlayableW) * HALF_COURT_LENGTH_M;
  return clampCourtPointM({ xM, yM });
}

/** Display a half-court point on the horizontal SVG. */
export function halfCourtPointToHorizontalSvg(
  point: CourtPointM,
  attacksLeft: boolean
): { x: number; y: number } {
  const playableH = HORIZONTAL_COURT_VH - 2 * HORIZONTAL_INSET;
  const halfPlayableW = HALF_WIDTH_SVG - HORIZONTAL_INSET;
  const ySvg = HORIZONTAL_INSET + (point.xM / COURT_WIDTH_M) * playableH;

  if (attacksLeft) {
    const xSvg = HORIZONTAL_INSET + (point.yM / HALF_COURT_LENGTH_M) * halfPlayableW;
    return { x: xSvg, y: ySvg };
  }

  const xSvg =
    HORIZONTAL_COURT_VW - HORIZONTAL_INSET - (point.yM / HALF_COURT_LENGTH_M) * halfPlayableW;
  return { x: xSvg, y: ySvg };
}
