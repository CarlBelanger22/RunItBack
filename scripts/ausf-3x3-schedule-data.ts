/**
 * LE-128 — AUSF 3x3 (2026) score-only schedule.
 * Existing NTU box-score games are protected — never recreate/overwrite.
 * Home = left side of schedule card (user-confirmed).
 */

export const TOURNAMENT_ID = 'tournament-1782412204083';

/** Already in Supabase with box scores — do not overwrite. */
export const PROTECTED_GAME_IDS = [
  'game-ausf3x3-2026-06-12-ntu-macau',
  'game-ausf3x3-2026-06-12-ntu-moratuwa',
  'game-ausf3x3-2026-06-13-ntu-tribhuwan',
  'game-ausf3x3-2026-06-13-ntu-iau',
] as const;

export const EXISTING_TEAM = {
  um: 'team-1782412934842',
  umt: 'team-1782412977862',
  tu: 'team-1782413009033',
  iau: 'team-1782413061536',
  ntu: 'team-sunig-ntu',
  nus: 'team-sunig-nus',
  thu: 'team-1783524784552',
} as const;

export const NEW_TEAM = {
  gdut: 'team-ausf-3x3-gdut',
  hkmu: 'team-ausf-3x3-hkmu',
  swu: 'team-ausf-3x3-swu',
  ru: 'team-ausf-3x3-ru',
  cuhk: 'team-ausf-3x3-cuhk',
  toos: 'team-ausf-3x3-toos',
} as const;

export const TEAM = { ...EXISTING_TEAM, ...NEW_TEAM } as const;

export type AusfTeamId = (typeof TEAM)[keyof typeof TEAM];

export interface TeamMeta {
  id: AusfTeamId;
  name: string;
  abbreviation: string;
  isNew: boolean;
}

export const TEAM_META: Record<AusfTeamId, TeamMeta> = {
  [TEAM.um]: {
    id: TEAM.um,
    name: 'University of Macau',
    abbreviation: 'UM',
    isNew: false,
  },
  [TEAM.umt]: {
    id: TEAM.umt,
    name: 'University of Moratuwa',
    abbreviation: 'UMT',
    isNew: false,
  },
  [TEAM.tu]: {
    id: TEAM.tu,
    name: 'Tribhuwan University',
    abbreviation: 'TU',
    isNew: false,
  },
  [TEAM.iau]: {
    id: TEAM.iau,
    name: 'Islamic Azad University',
    abbreviation: 'IAU',
    isNew: false,
  },
  [TEAM.ntu]: {
    id: TEAM.ntu,
    name: 'Nanyang Technological University',
    abbreviation: 'NTU',
    isNew: false,
  },
  [TEAM.nus]: {
    id: TEAM.nus,
    name: 'National University of Singapore',
    abbreviation: 'NUS',
    isNew: false,
  },
  [TEAM.thu]: {
    id: TEAM.thu,
    name: 'Tsinghua University',
    abbreviation: 'THU',
    isNew: false,
  },
  [TEAM.gdut]: {
    id: TEAM.gdut,
    name: 'Guangdong University of Technology',
    abbreviation: 'GDUT',
    isNew: true,
  },
  [TEAM.hkmu]: {
    id: TEAM.hkmu,
    name: 'Hong Kong Metropolitan University',
    abbreviation: 'HKMU',
    isNew: true,
  },
  [TEAM.swu]: {
    id: TEAM.swu,
    name: 'Srinakharinwirot University',
    abbreviation: 'SWU',
    isNew: true,
  },
  [TEAM.ru]: {
    id: TEAM.ru,
    name: 'Royal University',
    abbreviation: 'RU',
    isNew: true,
  },
  [TEAM.cuhk]: {
    id: TEAM.cuhk,
    name: 'The Chinese University of Hong Kong',
    abbreviation: 'CUHK',
    isNew: true,
  },
  [TEAM.toos]: {
    id: TEAM.toos,
    name: 'Toos Institute',
    abbreviation: 'TOOS',
    isNew: true,
  },
};

export const ALL_TEAM_IDS: AusfTeamId[] = Object.values(TEAM);
export const NEW_TEAM_IDS: AusfTeamId[] = Object.values(NEW_TEAM);

/** Official pools (standings order = seed place 1…n). */
export const AUSF_2026_GROUPS: {
  id: string;
  name: string;
  teamIds: AusfTeamId[];
}[] = [
  {
    id: 'ausf-g-a',
    name: 'Group A',
    teamIds: [TEAM.gdut, TEAM.iau, TEAM.hkmu],
  },
  {
    id: 'ausf-g-b',
    name: 'Group B',
    teamIds: [TEAM.thu, TEAM.nus, TEAM.swu],
  },
  {
    id: 'ausf-g-c',
    name: 'Group C',
    teamIds: [TEAM.ru, TEAM.cuhk, TEAM.toos],
  },
  {
    id: 'ausf-g-d',
    name: 'Group D',
    teamIds: [TEAM.tu, TEAM.um, TEAM.ntu, TEAM.umt],
  },
];

export type AusfPhase = 'group' | 'knockout';

export interface AusfScoreOnlyGameDef {
  id: string;
  date: string;
  startTime: string;
  homeTeamId: AusfTeamId;
  awayTeamId: AusfTeamId;
  homeScore: number;
  awayScore: number;
  phase: AusfPhase;
  note?: string;
}

/** 23 score-only games. Home = left on schedule card. Year 2026. */
export const SCORE_ONLY_GAMES: AusfScoreOnlyGameDef[] = [
  // ——— Jun 12 pool ———
  {
    id: 'game-ausf3x3-2026-06-12-tu-umt',
    date: '2026-06-12',
    startTime: '13:00',
    homeTeamId: TEAM.tu,
    awayTeamId: TEAM.umt,
    homeScore: 21,
    awayScore: 2,
    phase: 'group',
    note: 'Pool D',
  },
  {
    id: 'game-ausf3x3-2026-06-12-ru-cuhk',
    date: '2026-06-12',
    startTime: '14:20',
    homeTeamId: TEAM.ru,
    awayTeamId: TEAM.cuhk,
    homeScore: 21,
    awayScore: 12,
    phase: 'group',
    note: 'Pool C',
  },
  {
    id: 'game-ausf3x3-2026-06-12-toos-cuhk',
    date: '2026-06-12',
    startTime: '16:00',
    homeTeamId: TEAM.toos,
    awayTeamId: TEAM.cuhk,
    homeScore: 11,
    awayScore: 19,
    phase: 'group',
    note: 'Pool C',
  },
  {
    id: 'game-ausf3x3-2026-06-12-thu-swu',
    date: '2026-06-12',
    startTime: '16:20',
    homeTeamId: TEAM.thu,
    awayTeamId: TEAM.swu,
    homeScore: 21,
    awayScore: 11,
    phase: 'group',
    note: 'Pool B',
  },
  {
    id: 'game-ausf3x3-2026-06-12-iau-hkmu',
    date: '2026-06-12',
    startTime: '17:20',
    homeTeamId: TEAM.iau,
    awayTeamId: TEAM.hkmu,
    homeScore: 21,
    awayScore: 18,
    phase: 'group',
    note: 'Pool A',
  },
  {
    id: 'game-ausf3x3-2026-06-12-gdut-hkmu',
    date: '2026-06-12',
    startTime: '19:40',
    homeTeamId: TEAM.gdut,
    awayTeamId: TEAM.hkmu,
    homeScore: 21,
    awayScore: 10,
    phase: 'group',
    note: 'Pool A',
  },
  {
    id: 'game-ausf3x3-2026-06-12-nus-swu',
    date: '2026-06-12',
    startTime: '20:00',
    homeTeamId: TEAM.nus,
    awayTeamId: TEAM.swu,
    homeScore: 15,
    awayScore: 13,
    phase: 'group',
    note: 'Pool B',
  },

  // ——— Jun 13 pool ———
  {
    id: 'game-ausf3x3-2026-06-13-gdut-iau',
    date: '2026-06-13',
    startTime: '13:00',
    homeTeamId: TEAM.gdut,
    awayTeamId: TEAM.iau,
    homeScore: 19,
    awayScore: 17,
    phase: 'group',
    note: 'Pool A',
  },
  {
    id: 'game-ausf3x3-2026-06-13-thu-nus',
    date: '2026-06-13',
    startTime: '13:20',
    homeTeamId: TEAM.thu,
    awayTeamId: TEAM.nus,
    homeScore: 21,
    awayScore: 10,
    phase: 'group',
    note: 'Pool B',
  },
  {
    id: 'game-ausf3x3-2026-06-13-ru-toos',
    date: '2026-06-13',
    startTime: '14:20',
    homeTeamId: TEAM.ru,
    awayTeamId: TEAM.toos,
    homeScore: 21,
    awayScore: 16,
    phase: 'group',
    note: 'Pool C',
  },
  {
    id: 'game-ausf3x3-2026-06-13-tu-um',
    date: '2026-06-13',
    startTime: '14:40',
    homeTeamId: TEAM.tu,
    awayTeamId: TEAM.um,
    homeScore: 17,
    awayScore: 13,
    phase: 'group',
    note: 'Pool D',
  },
  {
    id: 'game-ausf3x3-2026-06-13-um-umt',
    date: '2026-06-13',
    startTime: '16:40',
    homeTeamId: TEAM.um,
    awayTeamId: TEAM.umt,
    homeScore: 21,
    awayScore: 14,
    phase: 'group',
    note: 'Pool D',
  },

  // ——— Jun 13 Last 16 ———
  {
    id: 'game-ausf3x3-2026-06-13-cuhk-swu',
    date: '2026-06-13',
    startTime: '18:30',
    homeTeamId: TEAM.cuhk,
    awayTeamId: TEAM.swu,
    homeScore: 18,
    awayScore: 15,
    phase: 'knockout',
    note: 'Last 16',
  },
  {
    id: 'game-ausf3x3-2026-06-13-nus-toos',
    date: '2026-06-13',
    startTime: '18:55',
    homeTeamId: TEAM.nus,
    awayTeamId: TEAM.toos,
    homeScore: 15,
    awayScore: 19,
    phase: 'knockout',
    note: 'Last 16',
  },
  {
    id: 'game-ausf3x3-2026-06-13-um-hkmu',
    date: '2026-06-13',
    startTime: '19:45',
    homeTeamId: TEAM.um,
    awayTeamId: TEAM.hkmu,
    homeScore: 16,
    awayScore: 21,
    phase: 'knockout',
    note: 'Last 16',
  },

  // ——— Jun 14 Quarters ———
  {
    id: 'game-ausf3x3-2026-06-14-gdut-cuhk',
    date: '2026-06-14',
    startTime: '13:50',
    homeTeamId: TEAM.gdut,
    awayTeamId: TEAM.cuhk,
    homeScore: 22,
    awayScore: 10,
    phase: 'knockout',
    note: 'Quarter-Final',
  },
  {
    id: 'game-ausf3x3-2026-06-14-toos-tu',
    date: '2026-06-14',
    startTime: '14:15',
    homeTeamId: TEAM.toos,
    awayTeamId: TEAM.tu,
    homeScore: 21,
    awayScore: 14,
    phase: 'knockout',
    note: 'Quarter-Final',
  },
  {
    id: 'game-ausf3x3-2026-06-14-ru-iau',
    date: '2026-06-14',
    startTime: '14:40',
    homeTeamId: TEAM.ru,
    awayTeamId: TEAM.iau,
    homeScore: 21,
    awayScore: 13,
    phase: 'knockout',
    note: 'Quarter-Final',
  },
  {
    id: 'game-ausf3x3-2026-06-14-hkmu-thu',
    date: '2026-06-14',
    startTime: '15:05',
    homeTeamId: TEAM.hkmu,
    awayTeamId: TEAM.thu,
    homeScore: 13,
    awayScore: 21,
    phase: 'knockout',
    note: 'Quarter-Final',
  },

  // ——— Jun 14 Semis / 3rd / Final ———
  {
    id: 'game-ausf3x3-2026-06-14-gdut-toos',
    date: '2026-06-14',
    startTime: '16:40',
    homeTeamId: TEAM.gdut,
    awayTeamId: TEAM.toos,
    homeScore: 21,
    awayScore: 12,
    phase: 'knockout',
    note: 'Semi-Final',
  },
  {
    id: 'game-ausf3x3-2026-06-14-ru-thu',
    date: '2026-06-14',
    startTime: '17:05',
    homeTeamId: TEAM.ru,
    awayTeamId: TEAM.thu,
    homeScore: 15,
    awayScore: 17,
    phase: 'knockout',
    note: 'Semi-Final',
  },
  {
    id: 'game-ausf3x3-2026-06-14-toos-ru',
    date: '2026-06-14',
    startTime: '17:55',
    homeTeamId: TEAM.toos,
    awayTeamId: TEAM.ru,
    homeScore: 17,
    awayScore: 21,
    phase: 'knockout',
    note: '3rd Place',
  },
  {
    id: 'game-ausf3x3-2026-06-14-gdut-thu',
    date: '2026-06-14',
    startTime: '19:30',
    homeTeamId: TEAM.gdut,
    awayTeamId: TEAM.thu,
    homeScore: 22,
    awayScore: 21,
    phase: 'knockout',
    note: 'Final',
  },
];
