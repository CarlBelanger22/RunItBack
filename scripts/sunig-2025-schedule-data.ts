/**
 * LE-110 — SUniG 2025 score-only schedule (missing men's games from SGBALL cards).
 * Existing NTU box-score games are protected — never recreate/overwrite.
 * Women games are intentionally omitted from this file.
 */

export const TOURNAMENT_ID = 'tournament-sunig-2025';

/** Already in Supabase with box scores — do not overwrite. */
export const PROTECTED_GAME_IDS = [
  'game-sunig-2025-09-19-ntu-sutd',
  'game-sunig-2025-09-22-ntu-sit',
  'game-sunig-2025-09-26-nus-ntu',
  'game-sunig-2025-09-29-ntu-suss',
  'game-sunig-2025-10-03-nus-ntu',
] as const;

export const TEAM = {
  ntu: 'team-sunig-ntu',
  nus: 'team-sunig-nus',
  sit: 'team-sunig-sit',
  suss: 'team-sunig-suss',
  sutd: 'team-sunig-sutd',
  sim: 'team-ivp-sim',
  smu: 'team-1786070574996',
} as const;

export type SunigTeamId = (typeof TEAM)[keyof typeof TEAM];

export interface TeamMeta {
  id: SunigTeamId;
  name: string;
  abbreviation: string;
}

export const TEAM_META: Record<SunigTeamId, TeamMeta> = {
  [TEAM.ntu]: {
    id: TEAM.ntu,
    name: 'Nanyang Technological University',
    abbreviation: 'NTU',
  },
  [TEAM.nus]: {
    id: TEAM.nus,
    name: 'National University of Singapore',
    abbreviation: 'NUS',
  },
  [TEAM.sit]: {
    id: TEAM.sit,
    name: 'Singapore Institute of Technology',
    abbreviation: 'SIT',
  },
  [TEAM.suss]: {
    id: TEAM.suss,
    name: 'Singapore University of Social Sciences',
    abbreviation: 'SUSS',
  },
  [TEAM.sutd]: {
    id: TEAM.sutd,
    name: 'Singapore University of Technology and Design',
    abbreviation: 'SUTD',
  },
  [TEAM.sim]: {
    id: TEAM.sim,
    name: 'Singapore Institute of Management',
    abbreviation: 'SIM',
  },
  [TEAM.smu]: {
    id: TEAM.smu,
    name: 'Singapore Management University',
    abbreviation: 'SMU',
  },
};

export const ALL_TEAM_IDS: SunigTeamId[] = Object.values(TEAM);

export type SunigPhase =
  | 'group'
  | 'semi'
  | 'placing'
  | 'classification'
  | 'final';

export interface SunigScoreOnlyGameDef {
  id: string;
  date: string;
  startTime: string;
  homeTeamId: SunigTeamId;
  awayTeamId: SunigTeamId;
  homeScore: number;
  awayScore: number;
  phase: SunigPhase;
  note?: string;
}

/** Graphic left = home, right = away. Men's games only. Year 2025. */
export const SCORE_ONLY_GAMES: SunigScoreOnlyGameDef[] = [
  {
    id: 'game-sunig-2025-09-15-sim-suss',
    date: '2025-09-15',
    startTime: '19:15',
    homeTeamId: TEAM.sim,
    awayTeamId: TEAM.suss,
    homeScore: 82,
    awayScore: 75,
    phase: 'group',
    note: 'MEN GROUP A',
  },
  {
    id: 'game-sunig-2025-09-15-nus-sit',
    date: '2025-09-15',
    startTime: '20:40',
    homeTeamId: TEAM.nus,
    awayTeamId: TEAM.sit,
    homeScore: 70,
    awayScore: 55,
    phase: 'group',
    note: 'MEN GROUP B',
  },
  {
    id: 'game-sunig-2025-09-17-smu-sim',
    date: '2025-09-17',
    startTime: '19:15',
    homeTeamId: TEAM.smu,
    awayTeamId: TEAM.sim,
    homeScore: 75,
    awayScore: 82,
    phase: 'group',
    note: 'MEN GROUP A',
  },
  {
    id: 'game-sunig-2025-09-19-suss-smu',
    date: '2025-09-19',
    startTime: '20:40',
    homeTeamId: TEAM.suss,
    awayTeamId: TEAM.smu,
    homeScore: 54,
    awayScore: 50,
    phase: 'group',
    note: 'MEN GROUP A',
  },
  {
    id: 'game-sunig-2025-09-22-sutd-nus',
    date: '2025-09-22',
    startTime: '20:40',
    homeTeamId: TEAM.sutd,
    awayTeamId: TEAM.nus,
    homeScore: 34,
    awayScore: 98,
    phase: 'group',
    note: 'MEN GROUP B',
  },
  {
    id: 'game-sunig-2025-09-26-sit-sutd',
    date: '2025-09-26',
    startTime: '20:40',
    homeTeamId: TEAM.sit,
    awayTeamId: TEAM.sutd,
    homeScore: 85,
    awayScore: 44,
    phase: 'group',
    note: 'MEN GROUP B',
  },
  {
    id: 'game-sunig-2025-09-29-sim-nus',
    date: '2025-09-29',
    startTime: '19:15',
    homeTeamId: TEAM.sim,
    awayTeamId: TEAM.nus,
    homeScore: 64,
    awayScore: 72,
    phase: 'semi',
    note: 'MEN SEMI',
  },
  {
    id: 'game-sunig-2025-10-01-sit-sutd',
    date: '2025-10-01',
    startTime: '20:40',
    homeTeamId: TEAM.sit,
    awayTeamId: TEAM.sutd,
    homeScore: 80,
    awayScore: 48,
    phase: 'classification',
    note: 'MEN 5th-7th',
  },
  {
    id: 'game-sunig-2025-10-03-sutd-smu',
    date: '2025-10-03',
    startTime: '19:15',
    homeTeamId: TEAM.sutd,
    awayTeamId: TEAM.smu,
    homeScore: 41,
    awayScore: 93,
    phase: 'classification',
    note: 'MEN 5th-7th',
  },
  {
    id: 'game-sunig-2025-10-03-sim-suss',
    date: '2025-10-03',
    startTime: '19:15',
    homeTeamId: TEAM.sim,
    awayTeamId: TEAM.suss,
    homeScore: 58,
    awayScore: 64,
    phase: 'placing',
    note: 'MEN PLACING',
  },
];
