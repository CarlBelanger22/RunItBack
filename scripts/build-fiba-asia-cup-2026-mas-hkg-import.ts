/**
 * FIBA Asia Cup 2029 Pre-Qualifiers — MAS 54–77 HKG (Arena Seremban, 2026-08-28 19:00).
 *
 *   npx tsx scripts/build-fiba-asia-cup-2026-mas-hkg-import.ts
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-28-mas-hkg.json --add-new-players --dry-run
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-28-mas-hkg.json --add-new-players
 *
 * Note: full import (no --stats-only) so new teams + all players are created.
 * Duncan Reid is on the roster but has no game_stats row (DNP).
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const TOURNAMENT_ID = 'tournament-1787937458049';
const MAS_ID = 'team-mas-mens-nt-2026';
const HKG_ID = 'team-hkg-mens-nt-2026';
const GAME_ID = 'game-2026-08-28-fiba-mas-hkg';

const MAS = {
  hiew: 'player-mas-nt-2026-01-hiew',
  tiong: 'player-mas-nt-2026-03-tiong',
  mahadevan: 'player-mas-nt-2026-05-mahadevan',
  jayson: 'player-mas-nt-2026-09-lee',
  munnesvicky: 'player-mas-nt-2026-10-munnesvicky',
  wong: 'player-mas-nt-2026-11-wong',
  bosango: 'player-mas-nt-2026-12-bosango',
  chin: 'player-mas-nt-2026-15-chin',
  jingHung: 'player-mas-nt-2026-18-lee',
  tan: 'player-mas-nt-2026-24-tan',
  ting: 'player-mas-nt-2026-27-ting',
  ong: 'player-mas-nt-2026-71-ong',
} as const;

const HKG = {
  glen: 'player-hkg-nt-2026-00-yang',
  yeung: 'player-hkg-nt-2026-01-yeung',
  xu: 'player-hkg-nt-2026-08-xu',
  tsang: 'player-hkg-nt-2026-09-tsang',
  ricky: 'player-hkg-nt-2026-10-yang',
  ng: 'player-hkg-nt-2026-11-ng',
  pok: 'player-hkg-nt-2026-13-pok',
  ma: 'player-hkg-nt-2026-21-ma',
  leung: 'player-hkg-nt-2026-23-leung',
  ivan: 'player-hkg-nt-2026-32-yang',
  reid: 'player-hkg-nt-2026-33-reid',
  yip: 'player-hkg-nt-2026-35-yip',
} as const;

type PlayerDef = {
  id: string;
  name: string;
  number: number;
  position: string;
  secondaryPosition?: string;
  height: string;
  dateOfBirth: string;
};

function min(mmss: string): number {
  const [m, s] = mmss.split(':').map(Number);
  return m + s / 60;
}

function stat(
  playerId: string,
  mmss: string,
  fg: [number, number],
  three: [number, number],
  ft: [number, number],
  orb: number,
  drb: number,
  assists: number,
  turnovers: number,
  steals: number,
  blocks: number,
  fouls: number,
  plusMinus: number,
  points: number
) {
  return {
    playerId,
    points,
    fg_made: fg[0],
    fg_attempted: fg[1],
    three_made: three[0],
    three_attempted: three[1],
    ft_made: ft[0],
    ft_attempted: ft[1],
    orb,
    drb,
    assists,
    steals,
    blocks,
    turnovers,
    fouls,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: 0,
    blocks_received: 0,
    plus_minus: plusMinus,
    minutes_played: min(mmss),
  };
}

const masPlayers: PlayerDef[] = [
  {
    id: MAS.hiew,
    name: 'Jia Hao Hiew',
    number: 1,
    position: 'SG',
    secondaryPosition: 'PG',
    height: '173',
    dateOfBirth: '2001-07-17',
  },
  {
    id: MAS.tiong,
    name: 'Ing Kun Tiong',
    number: 3,
    position: 'SG',
    secondaryPosition: 'PG',
    height: '183',
    dateOfBirth: '2000-09-17',
  },
  {
    id: MAS.mahadevan,
    name: 'Maegen M. S. Mahadevan',
    number: 5,
    position: 'C',
    height: '195',
    dateOfBirth: '2000-07-05',
  },
  {
    id: MAS.jayson,
    name: 'Shu Wen, Jayson Lee',
    number: 9,
    position: 'SG',
    height: '177',
    dateOfBirth: '1999-04-17',
  },
  {
    id: MAS.munnesvicky,
    name: 'Michael Munnesvicky',
    number: 10,
    position: 'F',
    height: '185',
    dateOfBirth: '2002-11-27',
  },
  {
    id: MAS.wong,
    name: 'Yi Hou Wong',
    number: 11,
    position: 'F',
    height: '191',
    dateOfBirth: '1996-07-05',
  },
  {
    id: MAS.bosango,
    name: 'Tychique Bosango',
    number: 12,
    position: 'SF',
    height: '188',
    dateOfBirth: '2001-05-20',
  },
  {
    id: MAS.chin,
    name: 'Jin Yen Chin',
    number: 15,
    position: 'C',
    height: '190',
    dateOfBirth: '1999-05-03',
  },
  {
    id: MAS.jingHung,
    name: 'Jing Hung Lee',
    number: 18,
    position: 'PF',
    height: '195',
    dateOfBirth: '2001-01-29',
  },
  {
    id: MAS.tan,
    name: 'Chee Wey Tan',
    number: 24,
    position: 'SF',
    height: '187',
    dateOfBirth: '2001-01-27',
  },
  {
    id: MAS.ting,
    name: 'Chun Hong Ting',
    number: 27,
    position: 'F',
    height: '191',
    dateOfBirth: '1996-05-08',
  },
  {
    id: MAS.ong,
    name: 'Wei Yong Ong',
    number: 71,
    position: 'PG',
    height: '180',
    dateOfBirth: '1993-09-12',
  },
];

const hkgPlayers: PlayerDef[] = [
  {
    id: HKG.glen,
    name: 'Glen Robertson Yang',
    number: 0,
    position: 'SG',
    height: '184',
    dateOfBirth: '1996-08-30',
  },
  {
    id: HKG.yeung,
    name: 'Sui Hung Yeung',
    number: 1,
    position: 'SG',
    height: '186',
    dateOfBirth: '1997-12-22',
  },
  {
    id: HKG.xu,
    name: 'Oliver Xu',
    number: 8,
    position: 'PG',
    height: '185',
    dateOfBirth: '1996-12-19',
  },
  {
    id: HKG.tsang,
    name: 'Cham Yuen TSANG',
    number: 9,
    position: 'SG',
    height: '183',
    dateOfBirth: '2000-03-31',
  },
  {
    id: HKG.ricky,
    name: 'Ricky Yang',
    number: 10,
    position: 'PG',
    height: '178',
    dateOfBirth: '1998-12-28',
  },
  {
    id: HKG.ng,
    name: 'Chung Tsun Ng',
    number: 11,
    position: 'PG',
    height: '181',
    dateOfBirth: '1996-09-02',
  },
  {
    id: HKG.pok,
    name: 'Yuet Yeung Pok',
    number: 13,
    position: 'C',
    height: '199',
    dateOfBirth: '2000-06-07',
  },
  {
    id: HKG.ma,
    name: 'Kong San Ma',
    number: 21,
    position: 'C',
    height: '202',
    dateOfBirth: '2000-08-17',
  },
  {
    id: HKG.leung,
    name: 'Ka Hin Marco Leung',
    number: 23,
    position: 'SF',
    height: '193',
    dateOfBirth: '2000-02-01',
  },
  {
    id: HKG.ivan,
    name: 'Bo Wen Ivan Yang',
    number: 32,
    position: 'F',
    height: '188',
    dateOfBirth: '2003-06-16',
  },
  {
    id: HKG.reid,
    name: 'Duncan Overbeck Reid',
    number: 33,
    position: 'C',
    height: '204',
    dateOfBirth: '1989-09-28',
  },
  {
    id: HKG.yip,
    name: 'Yiu Pong Yip',
    number: 35,
    position: 'PF',
    height: '191',
    dateOfBirth: '1999-01-18',
  },
];

const masStats = [
  // playerId, MIN, FG, 3P, FT, OR, DR, AST, TO, ST, BLK, PF, +/-, PTS
  stat(MAS.hiew, '20:53', [1, 4], [0, 1], [0, 0], 1, 0, 3, 2, 1, 0, 2, -12, 2),
  stat(MAS.tiong, '12:03', [1, 4], [1, 4], [0, 0], 1, 0, 0, 0, 0, 0, 1, -14, 3),
  stat(MAS.mahadevan, '15:58', [2, 5], [0, 0], [1, 2], 2, 0, 0, 0, 0, 1, 2, -4, 5),
  stat(MAS.jayson, '06:04', [0, 2], [0, 2], [0, 0], 0, 1, 0, 0, 0, 0, 0, -12, 0),
  stat(MAS.munnesvicky, '15:42', [3, 7], [2, 5], [0, 0], 1, 0, 1, 1, 0, 0, 3, -11, 8),
  stat(MAS.wong, '19:05', [3, 11], [1, 4], [1, 2], 0, 4, 1, 2, 1, 1, 1, -4, 8),
  stat(MAS.bosango, '33:24', [4, 12], [1, 5], [2, 2], 1, 6, 1, 2, 2, 0, 0, -26, 11),
  stat(MAS.chin, '07:52', [0, 1], [0, 0], [0, 0], 0, 2, 1, 1, 0, 1, 2, -3, 0),
  stat(MAS.jingHung, '17:56', [1, 3], [0, 0], [1, 2], 2, 2, 1, 0, 0, 0, 2, -14, 3),
  stat(MAS.tan, '10:20', [0, 1], [0, 0], [0, 0], 0, 0, 0, 0, 0, 0, 0, -12, 0),
  stat(MAS.ting, '26:18', [4, 10], [3, 7], [2, 2], 0, 4, 2, 1, 1, 1, 2, 1, 13),
  stat(MAS.ong, '14:25', [0, 1], [0, 0], [1, 2], 0, 3, 1, 1, 0, 0, 2, -4, 1),
];

const hkgStats = [
  stat(HKG.glen, '31:26', [7, 16], [3, 4], [2, 2], 0, 1, 3, 1, 2, 0, 2, 18, 19),
  stat(HKG.yeung, '16:18', [3, 5], [2, 3], [0, 0], 1, 2, 3, 2, 0, 0, 2, 8, 8),
  stat(HKG.xu, '25:06', [4, 11], [2, 6], [2, 2], 4, 5, 0, 0, 0, 0, 2, 15, 12),
  stat(HKG.tsang, '25:04', [5, 12], [0, 4], [1, 2], 2, 1, 3, 1, 0, 0, 1, 18, 11),
  stat(HKG.ricky, '13:33', [0, 5], [0, 3], [0, 0], 0, 2, 0, 2, 2, 0, 2, 0, 0),
  stat(HKG.ng, '04:06', [0, 0], [0, 0], [0, 0], 0, 1, 0, 0, 0, 0, 1, 6, 0),
  stat(HKG.pok, '29:28', [6, 8], [0, 0], [1, 4], 2, 6, 2, 4, 1, 2, 3, 20, 13),
  stat(HKG.ma, '08:15', [0, 2], [0, 0], [0, 2], 2, 0, 1, 0, 0, 1, 0, 0, 0),
  stat(HKG.leung, '04:27', [1, 1], [1, 1], [0, 0], 0, 0, 1, 0, 0, 0, 0, 4, 3),
  stat(HKG.ivan, '13:53', [1, 4], [1, 1], [4, 4], 3, 3, 1, 0, 0, 0, 0, 0, 7),
  // Reid DNP — no stat row
  stat(HKG.yip, '28:24', [1, 6], [0, 0], [2, 2], 1, 5, 2, 1, 0, 1, 0, 26, 4),
];

function sum<K extends keyof (typeof masStats)[0]>(
  rows: Array<(typeof masStats)[0]>,
  key: K
): number {
  return rows.reduce((s, r) => s + (r[key] as number), 0);
}

function assertTotals(): void {
  const masMin = Math.round(sum(masStats, 'minutes_played') * 60);
  const hkgMin = Math.round(sum(hkgStats, 'minutes_played') * 60);
  if (masMin !== 12000) throw new Error(`MAS minutes ${masMin}s !== 200:00`);
  if (hkgMin !== 12000) throw new Error(`HKG minutes ${hkgMin}s !== 200:00`);

  if (sum(masStats, 'points') !== 54) {
    throw new Error(`MAS PTS ${sum(masStats, 'points')}`);
  }
  if (sum(hkgStats, 'points') !== 77) {
    throw new Error(`HKG PTS ${sum(hkgStats, 'points')}`);
  }

  if (sum(masStats, 'fg_made') !== 19 || sum(masStats, 'fg_attempted') !== 61) {
    throw new Error(`MAS FG ${sum(masStats, 'fg_made')}/${sum(masStats, 'fg_attempted')}`);
  }
  if (sum(hkgStats, 'fg_made') !== 28 || sum(hkgStats, 'fg_attempted') !== 70) {
    throw new Error(`HKG FG ${sum(hkgStats, 'fg_made')}/${sum(hkgStats, 'fg_attempted')}`);
  }

  if (sum(masStats, 'three_made') !== 8 || sum(masStats, 'three_attempted') !== 28) {
    throw new Error(
      `MAS 3P ${sum(masStats, 'three_made')}/${sum(masStats, 'three_attempted')}`
    );
  }
  if (sum(hkgStats, 'three_made') !== 9 || sum(hkgStats, 'three_attempted') !== 22) {
    throw new Error(
      `HKG 3P ${sum(hkgStats, 'three_made')}/${sum(hkgStats, 'three_attempted')}`
    );
  }

  if (sum(masStats, 'ft_made') !== 8 || sum(masStats, 'ft_attempted') !== 12) {
    throw new Error(`MAS FT ${sum(masStats, 'ft_made')}/${sum(masStats, 'ft_attempted')}`);
  }
  if (sum(hkgStats, 'ft_made') !== 12 || sum(hkgStats, 'ft_attempted') !== 18) {
    throw new Error(`HKG FT ${sum(hkgStats, 'ft_made')}/${sum(hkgStats, 'ft_attempted')}`);
  }

  if (sum(masStats, 'orb') !== 8) throw new Error(`MAS player ORB ${sum(masStats, 'orb')}`);
  if (sum(masStats, 'drb') !== 22) throw new Error(`MAS player DRB ${sum(masStats, 'drb')}`);
  if (sum(hkgStats, 'orb') !== 15) throw new Error(`HKG player ORB ${sum(hkgStats, 'orb')}`);
  if (sum(hkgStats, 'drb') !== 26) throw new Error(`HKG player DRB ${sum(hkgStats, 'drb')}`);

  if (sum(masStats, 'assists') !== 11) throw new Error(`MAS AST ${sum(masStats, 'assists')}`);
  if (sum(hkgStats, 'assists') !== 16) throw new Error(`HKG AST ${sum(hkgStats, 'assists')}`);
  if (sum(masStats, 'turnovers') !== 10) {
    throw new Error(`MAS player TO ${sum(masStats, 'turnovers')}`);
  }
  if (sum(hkgStats, 'turnovers') !== 11) {
    throw new Error(`HKG player TO ${sum(hkgStats, 'turnovers')}`);
  }
  if (sum(masStats, 'steals') !== 5) throw new Error(`MAS ST ${sum(masStats, 'steals')}`);
  if (sum(hkgStats, 'steals') !== 5) throw new Error(`HKG ST ${sum(hkgStats, 'steals')}`);
  if (sum(masStats, 'blocks') !== 4) throw new Error(`MAS BLK ${sum(masStats, 'blocks')}`);
  if (sum(hkgStats, 'blocks') !== 4) throw new Error(`HKG BLK ${sum(hkgStats, 'blocks')}`);
  if (sum(masStats, 'fouls') !== 17) throw new Error(`MAS PF ${sum(masStats, 'fouls')}`);
  if (sum(hkgStats, 'fouls') !== 13) throw new Error(`HKG PF ${sum(hkgStats, 'fouls')}`);
}

function teamStats(
  teamId: string,
  q: [number, number, number, number],
  totals: {
    fg: [number, number];
    three: [number, number];
    ft: [number, number];
    orb: number;
    drb: number;
    teamOrb: number;
    teamDrb: number;
    teamTo: number;
    teamFouls: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fouls: number;
    pitp: number;
    second: number;
    fb: number;
    bench: number;
    lead: number;
    run: number;
    pto: number;
  }
) {
  const twoMade = totals.fg[0] - totals.three[0];
  const twoAtt = totals.fg[1] - totals.three[1];
  return {
    teamId,
    q1_points: q[0],
    q2_points: q[1],
    q3_points: q[2],
    q4_points: q[3],
    ot_points: 0,
    total_points: q[0] + q[1] + q[2] + q[3],
    fg_made: totals.fg[0],
    fg_attempted: totals.fg[1],
    three_made: totals.three[0],
    three_attempted: totals.three[1],
    two_made: twoMade,
    two_attempted: twoAtt,
    ft_made: totals.ft[0],
    ft_attempted: totals.ft[1],
    orb: totals.orb,
    drb: totals.drb,
    team_rebounds: totals.teamOrb + totals.teamDrb,
    total_rebounds: totals.orb + totals.drb + totals.teamOrb + totals.teamDrb,
    assists: totals.assists,
    steals: totals.steals,
    blocks: totals.blocks,
    turnovers: totals.turnovers,
    fouls: totals.fouls,
    points_off_turnovers: totals.pto,
    points_in_paint: totals.pitp,
    second_chance_points: totals.second,
    fastbreak_points: totals.fb,
    bench_points: totals.bench,
    biggest_lead: totals.lead,
    biggest_scoring_run: totals.run,
    team_coach: {
      orb: totals.teamOrb,
      drb: totals.teamDrb,
      turnovers: totals.teamTo,
      fouls: totals.teamFouls,
    },
  };
}

function toBundlePlayer(p: PlayerDef) {
  return {
    id: p.id,
    name: p.name,
    number: p.number,
    position: p.position,
    ...(p.secondaryPosition ? { secondaryPosition: p.secondaryPosition } : {}),
    height: p.height,
    weight: '',
    age: 0,
    dateOfBirth: p.dateOfBirth,
  };
}

assertTotals();

const bundle = {
  version: '1',
  tournament: {
    id: TOURNAMENT_ID,
    name: 'FIBA Asia Cup 2029 Pre-Qualifiers',
    year: 2026,
    month: 'Aug',
    teamIds: [MAS_ID, HKG_ID],
  },
  teams: [
    {
      id: MAS_ID,
      name: 'Malaysia',
      abbreviation: 'MAS',
      description: 'Malaysia Mens National Team 2026',
      currentTournamentId: TOURNAMENT_ID,
      players: masPlayers.map(toBundlePlayer),
    },
    {
      id: HKG_ID,
      name: 'Hong Kong, China',
      abbreviation: 'HKG',
      description: 'Hong Kong, China Mens National Team 2026',
      currentTournamentId: TOURNAMENT_ID,
      players: hkgPlayers.map(toBundlePlayer),
    },
  ],
  game: {
    id: GAME_ID,
    homeTeamId: MAS_ID,
    awayTeamId: HKG_ID,
    tournamentId: TOURNAMENT_ID,
    date: '2026-08-28',
    startTime: '19:00',
    currentPeriod: 4,
    currentGameTime: '00:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 54, away: 77 },
    homeStarters: [MAS.bosango, MAS.chin, MAS.jingHung, MAS.ting, MAS.ong],
    awayStarters: [HKG.glen, HKG.xu, HKG.ricky, HKG.pok, HKG.yip],
    gameStats: [...masStats, ...hkgStats],
    teamStats: {
      home: teamStats(MAS_ID, [14, 15, 23, 2], {
        fg: [19, 61],
        three: [8, 28],
        ft: [8, 12],
        orb: sum(masStats, 'orb'),
        drb: sum(masStats, 'drb'),
        teamOrb: 1,
        teamDrb: 1,
        teamTo: 2,
        teamFouls: 2,
        assists: 11,
        steals: sum(masStats, 'steals'),
        blocks: sum(masStats, 'blocks'),
        turnovers: sum(masStats, 'turnovers'),
        fouls: sum(masStats, 'fouls'),
        pitp: 22,
        second: 7,
        fb: 0,
        bench: 26,
        lead: 0,
        run: 0,
        pto: 6,
      }),
      away: teamStats(HKG_ID, [18, 17, 16, 26], {
        fg: [28, 70],
        three: [9, 22],
        ft: [12, 18],
        orb: sum(hkgStats, 'orb'),
        drb: sum(hkgStats, 'drb'),
        teamOrb: 5,
        teamDrb: 4,
        teamTo: 2,
        teamFouls: 2,
        assists: 16,
        steals: sum(hkgStats, 'steals'),
        blocks: sum(hkgStats, 'blocks'),
        turnovers: sum(hkgStats, 'turnovers'),
        fouls: sum(hkgStats, 'fouls'),
        pitp: 36,
        second: 18,
        fb: 5,
        bench: 29,
        lead: 0,
        run: 0,
        pto: 22,
      }),
    },
    shots: [],
    events: [],
    lineupStints: [],
  },
};

const out = resolve(
  process.cwd(),
  'Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-28-mas-hkg.json'
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
console.log('Wrote', out);
console.log('MAS', masStats.length, 'stat rows;', masPlayers.length, 'roster players');
console.log(
  'HKG',
  hkgStats.length,
  'stat rows;',
  hkgPlayers.length,
  'roster players (incl. DNP Reid)'
);
