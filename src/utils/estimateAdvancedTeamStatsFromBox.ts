/**
 * Heuristic advanced team stats from a finished box (no PBP).
 * Used only for recovery fills — not a substitute for live tagging.
 */

export interface TeamBoxForAdvancedEstimate {
  twoMade: number;
  threeMade: number;
  orb: number;
  /** Own turnovers — unused for own-side POT; opp TO is passed separately. */
  turnovers: number;
  totalPoints: number;
}

export interface EstimatedAdvancedTeamStats {
  points_in_paint: number;
  fastbreak_points: number;
  second_chance_points: number;
  points_off_turnovers: number;
}

function nonNegInt(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

function cap(value: number, max: number): number {
  return Math.min(value, Math.max(0, max));
}

/** FG points from makes: 2×2PM + 3×3PM (FTs excluded). */
export function fgPointsFromMakes(twoMade: number, threeMade: number): number {
  return 2 * nonNegInt(twoMade) + 3 * nonNegInt(threeMade);
}

/**
 * Locked recovery formulas (2026-10-31):
 * - PITP: 2 × round(0.8 × 2PM)
 * - FB: round(0.15 × FG points)
 * - 2nd: round(1.1 × ORB)
 * - POT: round(0.5 × opponent TO)
 * Each capped at team total points.
 */
export function estimateAdvancedTeamStatsFromBox(
  own: TeamBoxForAdvancedEstimate,
  opponentTurnovers: number
): EstimatedAdvancedTeamStats {
  const twoMade = nonNegInt(own.twoMade);
  const threeMade = nonNegInt(own.threeMade);
  const orb = nonNegInt(own.orb);
  const oppTo = nonNegInt(opponentTurnovers);
  const totalPoints = nonNegInt(own.totalPoints);

  const pitp = 2 * Math.round(0.8 * twoMade);
  const fb = Math.round(0.15 * fgPointsFromMakes(twoMade, threeMade));
  const second = Math.round(1.1 * orb);
  const pot = Math.round(0.5 * oppTo);

  return {
    points_in_paint: cap(pitp, totalPoints),
    fastbreak_points: cap(fb, totalPoints),
    second_chance_points: cap(second, totalPoints),
    points_off_turnovers: cap(pot, totalPoints),
  };
}

export interface PlayerBoxRow {
  playerId: string;
  points?: number | null;
  fg_made?: number | null;
  fg_attempted?: number | null;
  three_made?: number | null;
  three_attempted?: number | null;
  orb?: number | null;
  turnovers?: number | null;
}

/** Aggregate player rows for one team into estimator inputs. */
export function aggregateTeamBoxForAdvancedEstimate(
  rows: PlayerBoxRow[],
  teamPlayerIds: ReadonlySet<string>
): TeamBoxForAdvancedEstimate {
  let fgMade = 0;
  let threeMade = 0;
  let orb = 0;
  let turnovers = 0;
  let totalPoints = 0;

  for (const row of rows) {
    if (!teamPlayerIds.has(row.playerId)) continue;
    fgMade += row.fg_made ?? 0;
    threeMade += row.three_made ?? 0;
    orb += row.orb ?? 0;
    turnovers += row.turnovers ?? 0;
    totalPoints += row.points ?? 0;
  }

  const twoMade = Math.max(0, fgMade - threeMade);

  return {
    twoMade,
    threeMade,
    orb,
    turnovers,
    totalPoints,
  };
}
