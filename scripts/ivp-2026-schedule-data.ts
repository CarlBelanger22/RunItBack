/**
 * LE-105 — IVP 2026 score-only schedule (missing group + KO games).
 * Existing NTU box-score games are protected — never recreate/overwrite.
 */

export const TOURNAMENT_ID = 'tournament-1768327829049';

/** Already in Supabase with box scores / KO — do not overwrite. */
export const PROTECTED_GAME_IDS = [
  'game-ivp-2026-01-13-ntu-np',
  'game-ivp-2026-01-20-ntu-suss',
  'game-ivp-2026-01-23-ntu-ite',
  'game-ivp-2026-01-26-ntu-sim',
  'game-ivp-2026-01-28-ntu-np',
] as const;

export const TEAM = {
  ntu: 'team-sunig-ntu',
  np: 'team-ivp-np',
  ite: 'team-ivp-ite',
  suss: 'team-sunig-suss',
  nus: 'team-sunig-nus',
  sim: 'team-ivp-sim',
  nyp: 'team-1786037426972',
  rp: 'team-1786037569175',
} as const;

export type IvpTeamId = (typeof TEAM)[keyof typeof TEAM];

export interface TeamMeta {
  id: IvpTeamId;
  name: string;
  abbreviation: string;
}

export const TEAM_META: Record<IvpTeamId, TeamMeta> = {
  [TEAM.ntu]: {
    id: TEAM.ntu,
    name: 'Nanyang Technological University',
    abbreviation: 'NTU',
  },
  [TEAM.np]: {
    id: TEAM.np,
    name: 'Ngee Ann Polytechnic',
    abbreviation: 'NP',
  },
  [TEAM.ite]: {
    id: TEAM.ite,
    name: 'Institute of Technical Education',
    abbreviation: 'ITE',
  },
  [TEAM.suss]: {
    id: TEAM.suss,
    name: 'Singapore University of Social Sciences',
    abbreviation: 'SUSS',
  },
  [TEAM.nus]: {
    id: TEAM.nus,
    name: 'National University of Singapore',
    abbreviation: 'NUS',
  },
  [TEAM.sim]: {
    id: TEAM.sim,
    name: 'Singapore Institute of Management',
    abbreviation: 'SIM',
  },
  [TEAM.nyp]: {
    id: TEAM.nyp,
    name: 'Nanyang Polytechnic',
    abbreviation: 'NYP',
  },
  [TEAM.rp]: {
    id: TEAM.rp,
    name: 'Republic Polytechnic',
    abbreviation: 'RP',
  },
};

export const ALL_TEAM_IDS: IvpTeamId[] = Object.values(TEAM);

export type IvpPhase = 'group' | 'knockout';

export interface IvpScoreOnlyGameDef {
  id: string;
  date: string;
  startTime: string;
  homeTeamId: IvpTeamId;
  awayTeamId: IvpTeamId;
  homeScore: number;
  awayScore: number;
  phase: IvpPhase;
  /** Optional note e.g. 3OT */
  note?: string;
}

/** Graphic left = home, right = away. Year 2026. */
export const SCORE_ONLY_GAMES: IvpScoreOnlyGameDef[] = [
  // Group B — 12 Jan
  {
    id: 'game-ivp-2026-01-12-nyp-nus',
    date: '2026-01-12',
    startTime: '19:15',
    homeTeamId: TEAM.nyp,
    awayTeamId: TEAM.nus,
    homeScore: 60,
    awayScore: 56,
    phase: 'group',
  },
  {
    id: 'game-ivp-2026-01-12-rp-sim',
    date: '2026-01-12',
    startTime: '20:45',
    homeTeamId: TEAM.rp,
    awayTeamId: TEAM.sim,
    homeScore: 64,
    awayScore: 70,
    phase: 'group',
  },
  // Group A — 13 Jan (NTU–NP already protected)
  {
    id: 'game-ivp-2026-01-13-ite-suss',
    date: '2026-01-13',
    startTime: '20:45',
    homeTeamId: TEAM.ite,
    awayTeamId: TEAM.suss,
    homeScore: 82,
    awayScore: 66,
    phase: 'group',
  },
  // Group B — 16 Jan
  {
    id: 'game-ivp-2026-01-16-sim-nus',
    date: '2026-01-16',
    startTime: '19:15',
    homeTeamId: TEAM.sim,
    awayTeamId: TEAM.nus,
    homeScore: 67,
    awayScore: 82,
    phase: 'group',
  },
  {
    id: 'game-ivp-2026-01-16-rp-nyp',
    date: '2026-01-16',
    startTime: '20:45',
    homeTeamId: TEAM.rp,
    awayTeamId: TEAM.nyp,
    homeScore: 51,
    awayScore: 106,
    phase: 'group',
  },
  // Group A — 20 Jan (NTU–SUSS protected)
  {
    id: 'game-ivp-2026-01-20-np-ite',
    date: '2026-01-20',
    startTime: '19:15',
    homeTeamId: TEAM.np,
    awayTeamId: TEAM.ite,
    homeScore: 78,
    awayScore: 68,
    phase: 'group',
  },
  // Group B — 21 Jan
  {
    id: 'game-ivp-2026-01-21-nus-rp',
    date: '2026-01-21',
    startTime: '19:15',
    homeTeamId: TEAM.nus,
    awayTeamId: TEAM.rp,
    homeScore: 77,
    awayScore: 73,
    phase: 'group',
  },
  {
    id: 'game-ivp-2026-01-21-nyp-sim',
    date: '2026-01-21',
    startTime: '20:45',
    homeTeamId: TEAM.nyp,
    awayTeamId: TEAM.sim,
    homeScore: 49,
    awayScore: 62,
    phase: 'group',
  },
  // Group A — 23 Jan (NTU–ITE protected)
  {
    id: 'game-ivp-2026-01-23-suss-np',
    date: '2026-01-23',
    startTime: '19:15',
    homeTeamId: TEAM.suss,
    awayTeamId: TEAM.np,
    homeScore: 57,
    awayScore: 96,
    phase: 'group',
  },
  // Knockout — 26 Jan (NTU–SIM semi protected)
  {
    id: 'game-ivp-2026-01-26-nus-np',
    date: '2026-01-26',
    startTime: '19:15',
    homeTeamId: TEAM.nus,
    awayTeamId: TEAM.np,
    homeScore: 79,
    awayScore: 81,
    phase: 'knockout',
    note: '3OT semi',
  },
  // Knockout — 28 Jan (NTU–NP final protected)
  {
    id: 'game-ivp-2026-01-28-nus-sim',
    date: '2026-01-28',
    startTime: '19:15',
    homeTeamId: TEAM.nus,
    awayTeamId: TEAM.sim,
    homeScore: 75,
    awayScore: 68,
    phase: 'knockout',
    note: '3rd place',
  },
];
