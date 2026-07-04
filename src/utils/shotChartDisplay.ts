import type { Shot } from '../App';
import type { CourtMarker } from '../lib/fibaCourtSvg';
import type { HorizontalCourtMarker } from '../lib/figmaHorizontalCourtSvg';
import { percentToCourtPointM } from '../lib/fibaCourtGeometry';
import { halfCourtPointToHorizontalSvg } from '../lib/horizontalCourtClick';

/** @deprecated Use {@link shotsToHorizontalHalfCourtMarkers} for game-summary charts. */
export function shotsToHalfCourtMarkers(shots: Shot[]): CourtMarker[] {
  return shots.map((shot) => ({
    point: percentToCourtPointM(shot.x, shot.y),
    color: shot.made ? 'green' : 'red',
  }));
}

/**
 * Map persisted shots to horizontal half-court SVG coords (live-entry pipeline).
 * All shots use left-basket offense-relative display (`attacksLeft: true`).
 */
export function shotsToHorizontalHalfCourtMarkers(
  shots: Shot[]
): HorizontalCourtMarker[] {
  return shots.map((shot) => {
    const half = percentToCourtPointM(shot.x, shot.y);
    const { x, y } = halfCourtPointToHorizontalSvg(half, true);
    return {
      x,
      y,
      color: shot.made ? 'green' : 'red',
    };
  });
}
