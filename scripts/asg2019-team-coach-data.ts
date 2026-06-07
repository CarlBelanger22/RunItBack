/**
 * FIBA Team/Coach + official Totals (OR, DR, TO, PF) transcribed from ASG 2019 photos.
 * Invariant: players + team_coach === totals for these four fields.
 */

export type TeamCoachPatch = {
  orb: number;
  drb: number;
  turnovers: number;
  fouls: number;
};

export type SideTeamCoachPatch = {
  team_coach: TeamCoachPatch;
  orb: number;
  drb: number;
  turnovers: number;
  fouls: number;
};

export type GameTeamCoachPatch = {
  home: SideTeamCoachPatch;
  away: SideTeamCoachPatch;
};

/** PHOTO-2019-07-21-21-08-35.jpg — Jul 19 INA 86–43 SGP */
const JUL19: GameTeamCoachPatch = {
  home: {
    team_coach: { orb: 5, drb: 4, turnovers: 2, fouls: 0 },
    orb: 33,
    drb: 28,
    turnovers: 19,
    fouls: 16,
  },
  away: {
    team_coach: { orb: 4, drb: 2, turnovers: 3, fouls: 0 },
    orb: 16,
    drb: 28,
    turnovers: 39,
    fouls: 17,
  },
};

/** PHOTO-2019-07-21-21-08-56.jpg — Jul 21 SGP 31–105 PHI */
const JUL21: GameTeamCoachPatch = {
  home: {
    team_coach: { orb: 1, drb: 3, turnovers: 9, fouls: 0 },
    orb: 10,
    drb: 25,
    turnovers: 44,
    fouls: 2,
  },
  away: {
    team_coach: { orb: 1, drb: 3, turnovers: 2, fouls: 0 },
    orb: 23,
    drb: 33,
    turnovers: 17,
    fouls: 4,
  },
};

/** PHOTO-2019-07-22-14-19-54.jpg — Jul 22 SGP 71–60 VIE */
const JUL22: GameTeamCoachPatch = {
  home: {
    team_coach: { orb: 2, drb: 2, turnovers: 2, fouls: 3 },
    orb: 25,
    drb: 29,
    turnovers: 27,
    fouls: 18,
  },
  away: {
    team_coach: { orb: 1, drb: 2, turnovers: 4, fouls: 0 },
    orb: 16,
    drb: 26,
    turnovers: 27,
    fouls: 22,
  },
};

export const ASG2019_TEAM_COACH_PATCHES: Record<string, GameTeamCoachPatch> = {
  'game-asg19-2019-07-19-indonesia-singapore': JUL19,
  'game-asg19-2019-07-21-singapore-philippines': JUL21,
  'game-asg19-2019-07-22-singapore-vietnam': JUL22,
};

export const ASG2019_SCORE_ONLY_GAME_IDS = [
  'game-asg19-2019-07-19-thailand-vietnam',
  'game-asg19-2019-07-20-thailand-malaysia',
  'game-asg19-2019-07-20-philippines-indonesia',
  'game-asg19-2019-07-21-malaysia-vietnam',
  'game-asg19-2019-07-22-philippines-malaysia',
  'game-asg19-2019-07-22-thailand-indonesia',
  'game-asg19-2019-07-23-thailand-malaysia',
  'game-asg19-2019-07-23-philippines-indonesia',
];
