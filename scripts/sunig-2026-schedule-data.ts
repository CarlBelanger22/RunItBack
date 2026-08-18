/**
 * LE-146 / LE-147 — SUniG 2026 men's scheduled fixtures (Final PDF V5).
 */

export const TOURNAMENT_ID = 'tournament-1786255606272';

export const STAGE = {
  group: 'stage-msleh6i9-xbtcla',
  placing: 'stage-msleh6i9-placing57',
  finals: 'stage-mslehzid-6udw6i',
} as const;

export const GROUP = {
  a: 'group-msleh994-7pew34',
  b: 'group-mslehag2-cqbxpb',
  placing: 'group-msleh6i9-placing-pool',
} as const;

/** @deprecated Import from `src/utils/sunig2026BracketSchedule` */
export { SUNIG_2026_BRACKET_SCHEDULE as BRACKET_SLOT_SCHEDULE } from '../src/utils/sunig2026BracketSchedule';

export const TEAM = {
  sit: 'team-sunig-sit',
  sim: 'team-ivp-sim',
  ntu: 'team-sunig-ntu',
  nus: 'team-sunig-nus',
  smu: 'team-1786070574996',
  sutd: 'team-sunig-sutd',
  suss: 'team-sunig-suss',
} as const;

export type Sunig2026TeamId = (typeof TEAM)[keyof typeof TEAM];

export interface Sunig2026FixtureDef {
  id: string;
  date: string;
  startTime: string;
  homeTeamId: Sunig2026TeamId;
  awayTeamId: Sunig2026TeamId;
  stageId: string;
  groupId?: string;
}

/** Men's group stage — Team A = home per PDF. */
export const GROUP_FIXTURES: Sunig2026FixtureDef[] = [
  {
    id: 'game-sunig-2026-09-07-sit-sim',
    date: '2026-09-07',
    startTime: '19:15',
    homeTeamId: TEAM.sit,
    awayTeamId: TEAM.sim,
    stageId: STAGE.group,
    groupId: GROUP.a,
  },
  {
    id: 'game-sunig-2026-09-07-sutd-suss',
    date: '2026-09-07',
    startTime: '20:40',
    homeTeamId: TEAM.sutd,
    awayTeamId: TEAM.suss,
    stageId: STAGE.group,
    groupId: GROUP.b,
  },
  {
    id: 'game-sunig-2026-09-11-smu-nus',
    date: '2026-09-11',
    startTime: '19:15',
    homeTeamId: TEAM.smu,
    awayTeamId: TEAM.nus,
    stageId: STAGE.group,
    groupId: GROUP.b,
  },
  {
    id: 'game-sunig-2026-09-14-suss-nus',
    date: '2026-09-14',
    startTime: '19:15',
    homeTeamId: TEAM.suss,
    awayTeamId: TEAM.nus,
    stageId: STAGE.group,
    groupId: GROUP.b,
  },
  {
    id: 'game-sunig-2026-09-14-smu-sutd',
    date: '2026-09-14',
    startTime: '20:40',
    homeTeamId: TEAM.smu,
    awayTeamId: TEAM.sutd,
    stageId: STAGE.group,
    groupId: GROUP.b,
  },
  {
    id: 'game-sunig-2026-09-17-ntu-sit',
    date: '2026-09-17',
    startTime: '19:15',
    homeTeamId: TEAM.ntu,
    awayTeamId: TEAM.sit,
    stageId: STAGE.group,
    groupId: GROUP.a,
  },
  {
    id: 'game-sunig-2026-09-18-suss-smu',
    date: '2026-09-18',
    startTime: '19:15',
    homeTeamId: TEAM.suss,
    awayTeamId: TEAM.smu,
    stageId: STAGE.group,
    groupId: GROUP.b,
  },
  {
    id: 'game-sunig-2026-09-18-sutd-nus',
    date: '2026-09-18',
    startTime: '20:40',
    homeTeamId: TEAM.sutd,
    awayTeamId: TEAM.nus,
    stageId: STAGE.group,
    groupId: GROUP.b,
  },
  {
    id: 'game-sunig-2026-09-24-sim-ntu',
    date: '2026-09-24',
    startTime: '19:15',
    homeTeamId: TEAM.sim,
    awayTeamId: TEAM.ntu,
    stageId: STAGE.group,
    groupId: GROUP.a,
  },
];

/**
 * 5th–7th pool pairings (PDF order). home/away are placeholders until
 * finalize maps A3/B3/B4 — import uses seed order SIT/SUTD, SMU/SIT, SUTD/SMU
 * as stand-ins matching typical 2025-style pools; update after finalize if needed.
 */
export const PLACING_FIXTURES: Sunig2026FixtureDef[] = [
  {
    id: 'game-sunig-2026-09-28-a3-b4',
    date: '2026-09-28',
    startTime: '20:40',
    homeTeamId: TEAM.sit,
    awayTeamId: TEAM.sutd,
    stageId: STAGE.placing,
    groupId: GROUP.placing,
  },
  {
    id: 'game-sunig-2026-10-01-b3-a3',
    date: '2026-10-01',
    startTime: '20:00',
    homeTeamId: TEAM.smu,
    awayTeamId: TEAM.sit,
    stageId: STAGE.placing,
    groupId: GROUP.placing,
  },
  {
    id: 'game-sunig-2026-10-05-b4-b3',
    date: '2026-10-05',
    startTime: '20:40',
    homeTeamId: TEAM.sutd,
    awayTeamId: TEAM.smu,
    stageId: STAGE.placing,
    groupId: GROUP.placing,
  },
];
