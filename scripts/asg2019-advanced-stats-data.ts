/**
 * FIBA extra team stats transcribed from ASG 2019 full box score photos.
 * Points totals only (UI shows integer points, not paint FGM/FGA/%).
 */

export type SideAdvancedStatsPatch = {
  points_off_turnovers: number;
  points_in_paint: number;
  second_chance_points: number;
  fastbreak_points: number;
  bench_points: number;
};

export type GameAdvancedStatsPatch = {
  home: SideAdvancedStatsPatch;
  away: SideAdvancedStatsPatch;
};

/** PHOTO-2019-07-21-21-08-35.jpg — Jul 19 INA 86–43 SGP */
const JUL19: GameAdvancedStatsPatch = {
  home: {
    points_off_turnovers: 41,
    points_in_paint: 50,
    second_chance_points: 21,
    fastbreak_points: 19,
    bench_points: 50,
  },
  away: {
    points_off_turnovers: 4,
    points_in_paint: 22,
    second_chance_points: 15,
    fastbreak_points: 3,
    bench_points: 11,
  },
};

/** PHOTO-2019-07-21-21-08-56.jpg — Jul 21 SGP 31–105 PHI */
const JUL21: GameAdvancedStatsPatch = {
  home: {
    points_off_turnovers: 8,
    points_in_paint: 18,
    second_chance_points: 9,
    fastbreak_points: 0,
    bench_points: 15,
  },
  away: {
    points_off_turnovers: 57,
    points_in_paint: 78,
    second_chance_points: 15,
    fastbreak_points: 50,
    bench_points: 69,
  },
};

/** PHOTO-2019-07-22-14-19-54.jpg — Jul 22 SGP 71–60 VIE */
const JUL22: GameAdvancedStatsPatch = {
  home: {
    points_off_turnovers: 31,
    points_in_paint: 40,
    second_chance_points: 17,
    fastbreak_points: 2,
    bench_points: 24,
  },
  away: {
    points_off_turnovers: 19,
    points_in_paint: 32,
    second_chance_points: 9,
    fastbreak_points: 5,
    bench_points: 21,
  },
};

export const ASG2019_ADVANCED_STATS_PATCHES: Record<string, GameAdvancedStatsPatch> = {
  'game-asg19-2019-07-19-indonesia-singapore': JUL19,
  'game-asg19-2019-07-21-singapore-philippines': JUL21,
  'game-asg19-2019-07-22-singapore-vietnam': JUL22,
};

export const ASG2019_FULL_GAME_IDS = Object.keys(ASG2019_ADVANCED_STATS_PATCHES);

export function mergeAdvancedStatsSide<T extends Record<string, unknown>>(
  side: T,
  patch: SideAdvancedStatsPatch
): T & SideAdvancedStatsPatch {
  return { ...side, ...patch };
}
