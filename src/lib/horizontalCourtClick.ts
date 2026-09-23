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

/** Home's offensive half is the left basket (unless court sides are flipped). */
export function homeAttacksLeft(
  homeTeamId: string,
  offenseTeamId: string,
  courtSidesFlipped = false
): boolean {
  const homeIsOffense = offenseTeamId === homeTeamId;
  return courtSidesFlipped ? !homeIsOffense : homeIsOffense;
}

/** Whether a home-team shooter maps to the left basket under the current orientation. */
export function shooterAttacksLeft(
  isHomeShooter: boolean,
  courtSidesFlipped = false
): boolean {
  return courtSidesFlipped ? !isHomeShooter : isHomeShooter;
}

/**
 * Court-sides flag that was in effect when a shot was taken.
 *
 * Live entry toggles `courtSidesFlipped` once at end of Q2 (and optionally at tip-off).
 * Prefer `tipOffFlipped` when known (persisted tip-off orientation).
 * Existing markers must use capture-time orientation so they stay on the absolute basket
 * where they were taken — not remapped with the *current* flag alone.
 *
 * When tip-off is unknown and `gameCompletedOrFlipUnknown` is true, assume tip-off
 * was unflipped and half toggled once: P1–P2 → false, P3+ → true.
 */
export function courtSidesFlippedWhenShotTaken(options: {
  shotPeriod: number;
  currentPeriod: number;
  currentFlipped: boolean;
  /** Tip-off orientation when known (survives game complete). */
  tipOffFlipped?: boolean | null;
  gameCompletedOrFlipUnknown?: boolean;
}): boolean {
  const shotInFirstHalf = options.shotPeriod <= 2;
  if (options.tipOffFlipped === true || options.tipOffFlipped === false) {
    return shotInFirstHalf ? options.tipOffFlipped : !options.tipOffFlipped;
  }
  if (options.gameCompletedOrFlipUnknown) {
    return !shotInFirstHalf;
  }
  const nowInFirstHalf = options.currentPeriod <= 2;
  return shotInFirstHalf === nowInFirstHalf
    ? options.currentFlipped
    : !options.currentFlipped;
}

/** Which basket a stored shot should use on the live horizontal full court. */
export function shotAttacksLeftOnFullCourt(options: {
  isHomeShooter: boolean;
  shotPeriod: number;
  currentPeriod: number;
  currentFlipped: boolean;
  tipOffFlipped?: boolean | null;
  gameCompletedOrFlipUnknown?: boolean;
}): boolean {
  const flippedAtShot = courtSidesFlippedWhenShotTaken(options);
  return shooterAttacksLeft(options.isHomeShooter, flippedAtShot);
}

/**
 * Map a click on the horizontal full-court canvas to half-court meters.
 * Returns null when the click is outside the active offensive half.
 *
 * Lateral axis is stored offense-relative: the same “left corner” yields the same
 * `xM` whether attacking the left or right basket (right-basket clicks are mirrored).
 */
export function horizontalClickToHalfCourtPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  homeTeamId: string,
  offenseTeamId: string,
  courtSidesFlipped = false
): CourtPointM | null {
  if (rect.width <= 0 || rect.height <= 0) return null;

  const xSvg = ((clientX - rect.left) / rect.width) * HORIZONTAL_COURT_VW;
  const ySvg = ((clientY - rect.top) / rect.height) * HORIZONTAL_COURT_VH;

  if (ySvg < HORIZONTAL_INSET - HORIZONTAL_SVG_EPS || ySvg > HORIZONTAL_COURT_VH - HORIZONTAL_INSET + HORIZONTAL_SVG_EPS) {
    return null;
  }

  let xM = ((ySvg - HORIZONTAL_INSET) / HORIZONTAL_PLAYABLE_H) * COURT_WIDTH_M;
  const attacksLeft = homeAttacksLeft(homeTeamId, offenseTeamId, courtSidesFlipped);

  if (attacksLeft) {
    if (xSvg > HORIZONTAL_HALF_WIDTH_SVG) return null;
  } else if (xSvg < HORIZONTAL_HALF_WIDTH_SVG) {
    return null;
  }

  const yM = horizontalSvgDepthToYMeters(xSvg, attacksLeft);
  if (yM === null) return null;

  // Canonicalize: facing the right basket, screen-top is offense-left; flip lateral
  // so stored xM matches left-basket offense-relative space.
  if (!attacksLeft) {
    xM = COURT_WIDTH_M - xM;
  }

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
  // Inverse of click canonicalize when placing on the right basket.
  const xMScreen = attacksLeft ? point.xM : COURT_WIDTH_M - point.xM;
  const ySvg = HORIZONTAL_INSET + (xMScreen / COURT_WIDTH_M) * HORIZONTAL_PLAYABLE_H;

  if (attacksLeft) {
    const xSvg = horizontalBasketLeftX() + point.yM * HORIZONTAL_SVG_PER_METER_DEPTH;
    return { x: xSvg, y: ySvg };
  }

  const xSvg = horizontalBasketRightX() - point.yM * HORIZONTAL_SVG_PER_METER_DEPTH;
  return { x: xSvg, y: ySvg };
}

/**
 * Tip-off camera orientation for live full-court drawing.
 * Falls back to current flip when tip-off was never stamped (early first half).
 */
export function resolveTipOffFlipped(options: {
  courtSidesFlipped?: boolean;
  courtSidesFlippedAtTip?: boolean | null;
}): boolean {
  if (options.courtSidesFlippedAtTip === true) return true;
  if (options.courtSidesFlippedAtTip === false) return false;
  return !!options.courtSidesFlipped;
}

/**
 * Live entry: after half (or manual flip ≠ tip), spin the tip-frame court 180°.
 * Completed / inactive games never rotate — markers stay in absolute tip frame only.
 */
export function liveCourtNeedsHalfRotate(options: {
  isActive?: boolean;
  isCompleted?: boolean;
  courtSidesFlipped?: boolean;
  courtSidesFlippedAtTip?: boolean | null;
}): boolean {
  if (!options.isActive || options.isCompleted) return false;
  if (
    options.courtSidesFlippedAtTip !== true &&
    options.courtSidesFlippedAtTip !== false
  ) {
    return false;
  }
  return !!options.courtSidesFlipped !== options.courtSidesFlippedAtTip;
}

/** Map a click on a 180°-CSS-rotated court box back to pre-rotate client coords. */
export function invertClientPointAroundRectCenter(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): { clientX: number; clientY: number } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return {
    clientX: 2 * cx - clientX,
    clientY: 2 * cy - clientY,
  };
}
