/** IUBIT 2026 tournament schedule — score-only games to import (LE-66). */

export const TOURNAMENT_ID = 'tournament-1782834922443';

/** Existing stat-tracked games — never create or overwrite. */
export const PROTECTED_GAME_IDS = [
  'game-1783096810514', // M1
  'game-1783236868293', // M13
  'game-1783660236146', // M19
  'game-1783679512743', // M27
] as const;

export const EXISTING_TEAM = {
  um: 'team-1782412934842',
  sjtu: 'team-1783230853062',
  snu: 'team-1783311543013',
  thu: 'team-1783524784552',
  ntu: 'team-sunig-ntu',
} as const;

export const NEW_TEAM = {
  chula: 'team-iubit-2026-chula',
  fdu: 'team-iubit-2026-fdu',
  hit: 'team-iubit-2026-hit',
  nju: 'team-iubit-2026-nju',
  pku: 'team-iubit-2026-pku',
  usyd: 'team-iubit-2026-usyd',
  cam: 'team-iubit-2026-cam',
  ustc: 'team-iubit-2026-ustc',
  xjtu: 'team-iubit-2026-xjtu',
} as const;

export const TEAM = { ...EXISTING_TEAM, ...NEW_TEAM } as const;

export type IubitTeamId = (typeof TEAM)[keyof typeof TEAM];

export interface TeamMeta {
  id: IubitTeamId;
  name: string;
  abbreviation: string;
  isNew: boolean;
}

export const TEAM_META: Record<IubitTeamId, TeamMeta> = {
  [TEAM.um]: {
    id: TEAM.um,
    name: 'University of Macau',
    abbreviation: 'UM',
    isNew: false,
  },
  [TEAM.sjtu]: {
    id: TEAM.sjtu,
    name: 'Shanghai Jiao Tong University',
    abbreviation: 'SJTU',
    isNew: false,
  },
  [TEAM.snu]: {
    id: TEAM.snu,
    name: 'Seoul National University',
    abbreviation: 'SNU',
    isNew: false,
  },
  [TEAM.thu]: {
    id: TEAM.thu,
    name: 'Tsinghua University',
    abbreviation: 'THU',
    isNew: false,
  },
  [TEAM.ntu]: {
    id: TEAM.ntu,
    name: 'Nanyang Technological University',
    abbreviation: 'NTU',
    isNew: false,
  },
  [TEAM.chula]: {
    id: TEAM.chula,
    name: 'Chulalongkorn University',
    abbreviation: 'CHULA',
    isNew: true,
  },
  [TEAM.fdu]: {
    id: TEAM.fdu,
    name: 'Fudan University',
    abbreviation: 'FDU',
    isNew: true,
  },
  [TEAM.hit]: {
    id: TEAM.hit,
    name: 'Harbin Institute of Technology',
    abbreviation: 'HIT',
    isNew: true,
  },
  [TEAM.nju]: {
    id: TEAM.nju,
    name: 'Nanjing University',
    abbreviation: 'NJU',
    isNew: true,
  },
  [TEAM.pku]: {
    id: TEAM.pku,
    name: 'Peking University',
    abbreviation: 'PKU',
    isNew: true,
  },
  [TEAM.usyd]: {
    id: TEAM.usyd,
    name: 'The University of Sydney',
    abbreviation: 'USYD',
    isNew: true,
  },
  [TEAM.cam]: {
    id: TEAM.cam,
    name: 'University of Cambridge',
    abbreviation: 'CAM',
    isNew: true,
  },
  [TEAM.ustc]: {
    id: TEAM.ustc,
    name: 'University of Science and Technology of China',
    abbreviation: 'USTC',
    isNew: true,
  },
  [TEAM.xjtu]: {
    id: TEAM.xjtu,
    name: "Xi'an Jiaotong University",
    abbreviation: 'XJTU',
    isNew: true,
  },
};

export const ALL_TEAM_IDS = Object.values(TEAM);

export const NEW_TEAM_IDS = Object.values(NEW_TEAM);

export interface IubitScoreOnlyGameDef {
  matchNo: number;
  id: string;
  date: string;
  startTime: string;
  homeTeamId: IubitTeamId;
  awayTeamId: IubitTeamId;
  homeScore: number;
  awayScore: number;
}

/** 27 score-only games (M2–12, 14–18, 20–26, 28–31). Home = left team on schedule. */
export const SCORE_ONLY_GAMES: IubitScoreOnlyGameDef[] = [
  {
    matchNo: 2,
    id: 'game-iubit-2026-m02-usyd-thu',
    date: '2026-07-01',
    startTime: '12:00',
    homeTeamId: TEAM.usyd,
    awayTeamId: TEAM.thu,
    homeScore: 100,
    awayScore: 56,
  },
  {
    matchNo: 3,
    id: 'game-iubit-2026-m03-chula-ustc',
    date: '2026-07-01',
    startTime: '14:00',
    homeTeamId: TEAM.chula,
    awayTeamId: TEAM.ustc,
    homeScore: 64,
    awayScore: 57,
  },
  {
    matchNo: 4,
    id: 'game-iubit-2026-m04-cam-pku',
    date: '2026-07-01',
    startTime: '14:00',
    homeTeamId: TEAM.cam,
    awayTeamId: TEAM.pku,
    homeScore: 43,
    awayScore: 49,
  },
  {
    matchNo: 5,
    id: 'game-iubit-2026-m05-snu-nju',
    date: '2026-07-01',
    startTime: '16:00',
    homeTeamId: TEAM.snu,
    awayTeamId: TEAM.nju,
    homeScore: 69,
    awayScore: 87,
  },
  {
    matchNo: 6,
    id: 'game-iubit-2026-m06-fdu-hit',
    date: '2026-07-01',
    startTime: '16:00',
    homeTeamId: TEAM.fdu,
    awayTeamId: TEAM.hit,
    homeScore: 58,
    awayScore: 79,
  },
  {
    matchNo: 7,
    id: 'game-iubit-2026-m07-sjtu-um',
    date: '2026-07-02',
    startTime: '11:00',
    homeTeamId: TEAM.sjtu,
    awayTeamId: TEAM.um,
    homeScore: 82,
    awayScore: 79,
  },
  {
    matchNo: 8,
    id: 'game-iubit-2026-m08-xjtu-usyd',
    date: '2026-07-02',
    startTime: '11:00',
    homeTeamId: TEAM.xjtu,
    awayTeamId: TEAM.usyd,
    homeScore: 56,
    awayScore: 66,
  },
  {
    matchNo: 9,
    id: 'game-iubit-2026-m09-ustc-cam',
    date: '2026-07-02',
    startTime: '13:00',
    homeTeamId: TEAM.ustc,
    awayTeamId: TEAM.cam,
    homeScore: 49,
    awayScore: 44,
  },
  {
    matchNo: 10,
    id: 'game-iubit-2026-m10-pku-chula',
    date: '2026-07-02',
    startTime: '13:00',
    homeTeamId: TEAM.pku,
    awayTeamId: TEAM.chula,
    homeScore: 62,
    awayScore: 61,
  },
  {
    matchNo: 11,
    id: 'game-iubit-2026-m11-nju-fdu',
    date: '2026-07-02',
    startTime: '15:00',
    homeTeamId: TEAM.nju,
    awayTeamId: TEAM.fdu,
    homeScore: 60,
    awayScore: 40,
  },
  {
    matchNo: 12,
    id: 'game-iubit-2026-m12-hit-snu',
    date: '2026-07-02',
    startTime: '15:00',
    homeTeamId: TEAM.hit,
    awayTeamId: TEAM.snu,
    homeScore: 87,
    awayScore: 43,
  },
  {
    matchNo: 14,
    id: 'game-iubit-2026-m14-thu-xjtu',
    date: '2026-07-03',
    startTime: '11:00',
    homeTeamId: TEAM.thu,
    awayTeamId: TEAM.xjtu,
    homeScore: 53,
    awayScore: 86,
  },
  {
    matchNo: 15,
    id: 'game-iubit-2026-m15-chula-cam',
    date: '2026-07-03',
    startTime: '13:00',
    homeTeamId: TEAM.chula,
    awayTeamId: TEAM.cam,
    homeScore: 41,
    awayScore: 65,
  },
  {
    matchNo: 16,
    id: 'game-iubit-2026-m16-ustc-pku',
    date: '2026-07-03',
    startTime: '13:00',
    homeTeamId: TEAM.ustc,
    awayTeamId: TEAM.pku,
    homeScore: 65,
    awayScore: 79,
  },
  {
    matchNo: 17,
    id: 'game-iubit-2026-m17-snu-fdu',
    date: '2026-07-03',
    startTime: '15:00',
    homeTeamId: TEAM.snu,
    awayTeamId: TEAM.fdu,
    homeScore: 69,
    awayScore: 58,
  },
  {
    matchNo: 18,
    id: 'game-iubit-2026-m18-nju-hit',
    date: '2026-07-03',
    startTime: '15:00',
    homeTeamId: TEAM.nju,
    awayTeamId: TEAM.hit,
    homeScore: 52,
    awayScore: 66,
  },
  {
    matchNo: 20,
    id: 'game-iubit-2026-m20-thu-ustc',
    date: '2026-07-04',
    startTime: '11:00',
    homeTeamId: TEAM.thu,
    awayTeamId: TEAM.ustc,
    homeScore: 65,
    awayScore: 63,
  },
  {
    matchNo: 21,
    id: 'game-iubit-2026-m21-um-nju',
    date: '2026-07-04',
    startTime: '13:00',
    homeTeamId: TEAM.um,
    awayTeamId: TEAM.nju,
    homeScore: 68,
    awayScore: 63,
  },
  {
    matchNo: 22,
    id: 'game-iubit-2026-m22-xjtu-cam',
    date: '2026-07-04',
    startTime: '13:00',
    homeTeamId: TEAM.xjtu,
    awayTeamId: TEAM.cam,
    homeScore: 62,
    awayScore: 39,
  },
  {
    matchNo: 23,
    id: 'game-iubit-2026-m23-sjtu-hit',
    date: '2026-07-04',
    startTime: '15:00',
    homeTeamId: TEAM.sjtu,
    awayTeamId: TEAM.hit,
    homeScore: 56,
    awayScore: 62,
  },
  {
    matchNo: 24,
    id: 'game-iubit-2026-m24-usyd-pku',
    date: '2026-07-04',
    startTime: '15:00',
    homeTeamId: TEAM.usyd,
    awayTeamId: TEAM.pku,
    homeScore: 105,
    awayScore: 43,
  },
  {
    matchNo: 25,
    id: 'game-iubit-2026-m25-chula-fdu',
    date: '2026-07-05',
    startTime: '09:00',
    homeTeamId: TEAM.chula,
    awayTeamId: TEAM.fdu,
    homeScore: 52,
    awayScore: 59,
  },
  {
    matchNo: 26,
    id: 'game-iubit-2026-m26-snu-ustc',
    date: '2026-07-05',
    startTime: '11:00',
    homeTeamId: TEAM.snu,
    awayTeamId: TEAM.ustc,
    homeScore: 56,
    awayScore: 52,
  },
  {
    matchNo: 28,
    id: 'game-iubit-2026-m28-nju-cam',
    date: '2026-07-05',
    startTime: '13:00',
    homeTeamId: TEAM.nju,
    awayTeamId: TEAM.cam,
    homeScore: 67,
    awayScore: 69,
  },
  {
    matchNo: 29,
    id: 'game-iubit-2026-m29-um-xjtu',
    date: '2026-07-05',
    startTime: '13:00',
    homeTeamId: TEAM.um,
    awayTeamId: TEAM.xjtu,
    homeScore: 74,
    awayScore: 88,
  },
  {
    matchNo: 30,
    id: 'game-iubit-2026-m30-sjtu-pku',
    date: '2026-07-05',
    startTime: '15:00',
    homeTeamId: TEAM.sjtu,
    awayTeamId: TEAM.pku,
    homeScore: 82,
    awayScore: 51,
  },
  {
    matchNo: 31,
    id: 'game-iubit-2026-m31-hit-usyd',
    date: '2026-07-05',
    startTime: '17:00',
    homeTeamId: TEAM.hit,
    awayTeamId: TEAM.usyd,
    homeScore: 62,
    awayScore: 96,
  },
];
