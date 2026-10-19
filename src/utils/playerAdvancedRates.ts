/**
 * Player advanced rate stats from scoped box-score totals.
 * Formulas align with team helpers in teamDisplayStats where applicable.
 */
import type { GameStats } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';

export type PlayerAdvancedRates = {
  trueShootingPct: number | null;
  effectiveFgPct: number | null;
  twoPointPct: number | null;
  assistToTurnover: number | null;
  freeThrowRatePct: number | null;
  threePointRatePct: number | null;
  stocksPerGame: number | null;
};

/** TS% = PTS / (2 × (FGA + 0.44 × FTA)) × 100 */
export function trueShootingPercentage(totals: GameStats): number | null {
  const denom = 2 * (totals.fg_attempted + 0.44 * totals.ft_attempted);
  if (denom <= 0) return null;
  return (totals.points / denom) * 100;
}

/** eFG% = (FGM + 0.5 × 3PM) / FGA × 100 */
export function effectiveFieldGoalPercentage(totals: GameStats): number | null {
  if (totals.fg_attempted <= 0) return null;
  return ((totals.fg_made + 0.5 * totals.three_made) / totals.fg_attempted) * 100;
}

/** 2P% from derived 2PM/2PA */
export function twoPointPercentage(totals: GameStats): number | null {
  const att = MetricsCalculator.getTwoPointAttempted(totals);
  if (att <= 0) return null;
  return (MetricsCalculator.getTwoPointMade(totals) / att) * 100;
}

/**
 * AST/TO. When TO = 0, matches team helper: return assists (not ∞).
 * Null only when both AST and TO are 0.
 */
export function assistToTurnoverRatio(totals: GameStats): number | null {
  if (totals.turnovers > 0) return totals.assists / totals.turnovers;
  if (totals.assists <= 0) return null;
  return totals.assists;
}

/** FTr = FTA / FGA × 100 */
export function freeThrowRatePct(totals: GameStats): number | null {
  if (totals.fg_attempted <= 0) return null;
  return (totals.ft_attempted / totals.fg_attempted) * 100;
}

/** 3PAr = 3PA / FGA × 100 */
export function threePointRatePct(totals: GameStats): number | null {
  if (totals.fg_attempted <= 0) return null;
  return (totals.three_attempted / totals.fg_attempted) * 100;
}

export function stocksPerGame(
  totals: GameStats,
  gamesPlayed: number
): number | null {
  if (gamesPlayed <= 0) return null;
  return (totals.steals + totals.blocks) / gamesPlayed;
}

export function computePlayerAdvancedRates(
  totals: GameStats,
  gamesPlayed: number
): PlayerAdvancedRates {
  return {
    trueShootingPct: trueShootingPercentage(totals),
    effectiveFgPct: effectiveFieldGoalPercentage(totals),
    twoPointPct: twoPointPercentage(totals),
    assistToTurnover: assistToTurnoverRatio(totals),
    freeThrowRatePct: freeThrowRatePct(totals),
    threePointRatePct: threePointRatePct(totals),
    stocksPerGame: stocksPerGame(totals, gamesPlayed),
  };
}
