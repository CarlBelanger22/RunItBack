/**
 * Shared horizontal full-court layout: FIBA meters ↔ Figma SVG viewBox.
 * Single source of truth for basket position, scale, and derived line art.
 */
import {
  COURT_WIDTH_M,
  HALF_COURT_LENGTH_M,
  PAINT_DEPTH_M,
  PAINT_WIDTH_M,
  THREE_ARC_RADIUS_M,
  THREE_CORNER_INSET_M,
} from './fibaCourtGeometry';

/** Figma horizontal full-court viewBox (landscape). */
export const HORIZONTAL_COURT_VW = 188;
export const HORIZONTAL_COURT_VH = 100;
export const HORIZONTAL_INSET = 1.5;
export const HORIZONTAL_COURT_ASPECT = HORIZONTAL_COURT_VW / HORIZONTAL_COURT_VH;
/** Tolerance for SVG boundary comparisons (float + sub-pixel clicks). */
export const HORIZONTAL_SVG_EPS = 1e-3;

/** Backboard line offset from baseline inside the playable inset. */
export const HORIZONTAL_BACKBOARD_INSET = 4.5;
/** Rim center distance from baseline along court depth (inside inset). */
export const HORIZONTAL_RIM_LEAD = 2.5;
export const HORIZONTAL_BASKET_X = HORIZONTAL_BACKBOARD_INSET + HORIZONTAL_RIM_LEAD;

export const HORIZONTAL_HALF_WIDTH_SVG = HORIZONTAL_COURT_VW / 2;
export const HORIZONTAL_HALF_PLAYABLE_W = HORIZONTAL_HALF_WIDTH_SVG - HORIZONTAL_INSET;
export const HORIZONTAL_PLAYABLE_H = HORIZONTAL_COURT_VH - 2 * HORIZONTAL_INSET;

/** Depth from basket to half-court line inside the playable half (SVG units). */
export const HORIZONTAL_USABLE_DEPTH_SVG = HORIZONTAL_HALF_PLAYABLE_W - HORIZONTAL_BASKET_X;

/** SVG units per meter along court depth (basket → half-court). */
export const HORIZONTAL_SVG_PER_METER_DEPTH = HORIZONTAL_USABLE_DEPTH_SVG / HALF_COURT_LENGTH_M;
/** SVG units per meter along court width (sideline → sideline). */
export const HORIZONTAL_SVG_PER_METER_WIDTH = HORIZONTAL_PLAYABLE_H / COURT_WIDTH_M;

/** Outward nudge so the arc reads correctly on wood (applies to draw + live clicks). */
export const HORIZONTAL_THREE_ARC_OUTWARD_M = 0.75;

export function horizontalThreeArcRadiusM(): number {
  return THREE_ARC_RADIUS_M + HORIZONTAL_THREE_ARC_OUTWARD_M;
}

/** Three-point arc radius in SVG depth units (matches live zone engine). */
export const HORIZONTAL_THREE_ARC_RADIUS_SVG =
  horizontalThreeArcRadiusM() * HORIZONTAL_SVG_PER_METER_DEPTH;

/** Corner-3 straight: sideline inset in SVG Y. */
export const HORIZONTAL_CORNER_Y_SVG =
  HORIZONTAL_INSET + THREE_CORNER_INSET_M * HORIZONTAL_SVG_PER_METER_WIDTH;

/** Paint lane depth from baseline and width in SVG units (FIBA 5.8 m × 4.9 m). */
export const HORIZONTAL_PAINT_DEPTH_SVG =
  HORIZONTAL_BASKET_X + PAINT_DEPTH_M * HORIZONTAL_SVG_PER_METER_DEPTH;
export const HORIZONTAL_PAINT_WIDTH_SVG = PAINT_WIDTH_M * HORIZONTAL_SVG_PER_METER_WIDTH;

export function horizontalBasketLeftX(): number {
  return HORIZONTAL_INSET + HORIZONTAL_BASKET_X;
}

export function horizontalBasketRightX(): number {
  return HORIZONTAL_COURT_VW - HORIZONTAL_INSET - HORIZONTAL_BASKET_X;
}

export function horizontalBackboardLeftX(): number {
  return HORIZONTAL_INSET + HORIZONTAL_BACKBOARD_INSET;
}

export function horizontalBackboardRightX(): number {
  return HORIZONTAL_COURT_VW - HORIZONTAL_INSET - HORIZONTAL_BACKBOARD_INSET;
}

export function horizontalBaselineLeftX(): number {
  return HORIZONTAL_INSET;
}

export function horizontalBaselineRightX(): number {
  return HORIZONTAL_COURT_VW - HORIZONTAL_INSET;
}

/** Half-court line X on the left offensive half (away from center). */
export function horizontalHalfCourtLeftX(): number {
  return HORIZONTAL_INSET + HORIZONTAL_HALF_PLAYABLE_W;
}

/** Half-court line X on the right offensive half. */
export function horizontalHalfCourtRightX(): number {
  return HORIZONTAL_COURT_VW - HORIZONTAL_INSET - HORIZONTAL_HALF_PLAYABLE_W;
}

/**
 * Map SVG depth along the offensive half to FIBA yM (meters from hoop plane).
 * Baseline → basket strip is yM=0; beyond basket scales linearly to half-court.
 */
export function horizontalSvgDepthToYMeters(
  xSvg: number,
  attacksLeft: boolean
): number | null {
  if (attacksLeft) {
    const baselineX = horizontalBaselineLeftX();
    const basketX = horizontalBasketLeftX();
    const halfCourtX = horizontalHalfCourtLeftX();
    if (xSvg < baselineX - HORIZONTAL_SVG_EPS || xSvg > halfCourtX + HORIZONTAL_SVG_EPS) {
      return null;
    }
    if (xSvg <= basketX + HORIZONTAL_SVG_EPS) return 0;
    return (xSvg - basketX) / HORIZONTAL_SVG_PER_METER_DEPTH;
  }

  const baselineX = horizontalBaselineRightX();
  const basketX = horizontalBasketRightX();
  const halfCourtX = horizontalHalfCourtRightX();
  if (xSvg > baselineX + HORIZONTAL_SVG_EPS || xSvg < halfCourtX - HORIZONTAL_SVG_EPS) {
    return null;
  }
  if (xSvg >= basketX - HORIZONTAL_SVG_EPS) return 0;
  return (basketX - xSvg) / HORIZONTAL_SVG_PER_METER_DEPTH;
}
