import {
  COURT_WIDTH_M,
  HALF_COURT_LENGTH_M,
  clampCourtPointM,
  type CourtPointM,
} from './fibaCourtGeometry';

export const FULL_COURT_LENGTH_M = HALF_COURT_LENGTH_M * 2;

/** Home attacks the bottom basket; away attacks the top basket. */
export function offenseAttacksBottom(homeTeamId: string, offenseTeamId: string): boolean {
  return offenseTeamId === homeTeamId;
}

/**
 * Map a click on the full-court canvas to half-court meters (offensive basket at y=0).
 * Returns null when the click is outside the active offensive half.
 */
export function fullCourtClickToHalfCourtPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  homeTeamId: string,
  offenseTeamId: string
): CourtPointM | null {
  if (rect.width <= 0 || rect.height <= 0) return null;

  const xM = ((clientX - rect.left) / rect.width) * COURT_WIDTH_M;
  const yFull = ((clientY - rect.top) / rect.height) * FULL_COURT_LENGTH_M;

  if (offenseAttacksBottom(homeTeamId, offenseTeamId)) {
    if (yFull <= HALF_COURT_LENGTH_M) return null;
    const yM = FULL_COURT_LENGTH_M - yFull;
    return clampCourtPointM({ xM, yM });
  }

  if (yFull >= HALF_COURT_LENGTH_M) return null;
  return clampCourtPointM({ xM, yM: yFull });
}

/** Display a half-court shot point on the full-court SVG. */
export function halfCourtPointToFullCourtM(
  point: CourtPointM,
  homeTeamId: string,
  offenseTeamIdWhenShot: string
): CourtPointM {
  const yFull = offenseAttacksBottom(homeTeamId, offenseTeamIdWhenShot)
    ? FULL_COURT_LENGTH_M - point.yM
    : point.yM;
  return { xM: point.xM, yM: yFull };
}
