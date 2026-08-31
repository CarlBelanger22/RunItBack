/**
 * FIBA Asia Cup 2029 Pre-Qualifiers — HKG 71–60 INA (Arena Seremban, 2026-08-30 16:00).
 *
 *   npx tsx scripts/build-fiba-asia-cup-2026-hkg-ina-import.ts
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-30-hkg-ina.json --stats-only --dry-run
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-30-hkg-ina.json --stats-only
 *
 * Reid DNP — no game_stats. FD = 0. Biggest lead/run = 0. Tournament jersey #s unchanged.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const TOURNAMENT_ID = 'tournament-1787937458049';
const HKG_ID = 'team-hkg-mens-nt-2026';
const INA_ID = 'team-ina-mens-nt-2026';
const GAME_ID = 'game-2026-08-30-fiba-hkg-ina';
const YONGA = 'player-asg19-indonesia-hendrix-xavi-yonga';

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

const INA = {
  erga: 'player-ina-nt-2026-18-erga',
  bagir: 'player-ina-nt-2026-13-bagir',
  saputera: 'player-ina-nt-2026-08-saputera',
  disi: 'player-ina-nt-2026-10-disi',
  sanyudy: 'player-ina-nt-2026-14-sanyudy',
  reza: 'player-ina-nt-2026-19-reza',
  yonga: YONGA,
  sanjaya: 'player-ina-nt-2026-22-sanjaya',
  diagne: 'player-ina-nt-2026-12-diagne',
  wiguna: 'player-ina-nt-2026-11-wiguna',
  maulana: 'player-ina-nt-2026-77-maulana',
  beane: 'player-ina-nt-2026-03-beane',
} as const;

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

const hkgStats = [
  // FG, 3P, FT, OR, DR, AST, TO, ST, BLK, PF, +/-, PTS
  stat(HKG.glen, '35:36', [4, 13], [3, 6], [2, 4], 0, 1, 2, 3, 0, 0, 2, 6, 13),
  stat(HKG.yeung, '07:55', [0, 4], [0, 2], [0, 0], 1, 2, 0, 0, 0, 0, 1, 4, 0),
  stat(HKG.xu, '26:45', [3, 7], [1, 5], [4, 4], 1, 5, 2, 2, 1, 0, 5, 9, 11),
  stat(HKG.tsang, '26:40', [9, 15], [3, 7], [1, 4], 0, 2, 5, 4, 4, 0, 1, 15, 22),
  stat(HKG.ricky, '09:26', [1, 4], [1, 4], [0, 0], 0, 2, 0, 2, 0, 0, 2, -3, 3),
  stat(HKG.ng, '07:31', [0, 0], [0, 0], [0, 0], 0, 0, 0, 0, 0, 0, 4, 3, 0),
  stat(HKG.pok, '30:53', [2, 3], [0, 0], [0, 0], 0, 6, 1, 1, 0, 0, 1, 4, 4),
  stat(HKG.ma, '09:07', [0, 1], [0, 0], [1, 2], 3, 1, 0, 1, 0, 0, 0, 7, 1),
  stat(HKG.leung, '06:07', [0, 1], [0, 1], [2, 2], 0, 0, 0, 1, 1, 0, 0, -1, 2),
  stat(HKG.ivan, '15:49', [3, 4], [1, 2], [0, 0], 2, 0, 1, 1, 1, 0, 2, 7, 7),
  // reid DNP
  stat(HKG.yip, '24:11', [3, 8], [0, 0], [2, 4], 1, 8, 2, 0, 1, 1, 2, 4, 8),
];

const inaStats = [
  stat(INA.erga, '01:44', [0, 2], [0, 0], [0, 0], 1, 0, 0, 0, 0, 0, 0, 1, 0),
  stat(INA.bagir, '29:21', [3, 9], [3, 8], [0, 0], 0, 4, 0, 1, 1, 0, 1, -4, 9),
  stat(INA.saputera, '30:32', [5, 14], [1, 8], [1, 2], 2, 1, 4, 4, 0, 0, 2, -5, 12),
  stat(INA.disi, '13:23', [1, 3], [1, 2], [1, 2], 1, 0, 0, 1, 0, 0, 3, -5, 4),
  stat(INA.sanyudy, '01:53', [0, 0], [0, 0], [0, 0], 0, 0, 0, 0, 0, 0, 0, -1, 0),
  stat(INA.reza, '09:04', [1, 2], [1, 2], [0, 0], 0, 0, 0, 0, 2, 0, 1, -8, 3),
  stat(INA.yonga, '07:10', [1, 2], [0, 1], [0, 0], 0, 0, 1, 1, 0, 1, 1, -2, 2),
  stat(INA.sanjaya, '12:53', [0, 1], [0, 0], [0, 0], 0, 2, 0, 2, 0, 2, 0, -7, 0),
  stat(INA.diagne, '29:12', [4, 9], [0, 0], [3, 5], 3, 8, 0, 2, 1, 1, 5, -3, 11),
  stat(INA.wiguna, '24:10', [2, 5], [0, 0], [0, 0], 3, 1, 2, 1, 1, 0, 4, -1, 4),
  stat(INA.maulana, '05:15', [0, 0], [0, 0], [1, 2], 1, 1, 1, 2, 0, 0, 4, -7, 1),
  stat(INA.beane, '35:23', [5, 17], [1, 4], [3, 4], 0, 9, 4, 1, 4, 0, 0, -13, 14),
];

function sum<K extends keyof (typeof hkgStats)[0]>(
  rows: Array<(typeof hkgStats)[0]>,
  key: K
): number {
  return rows.reduce((s, r) => s + (r[key] as number), 0);
}

function assertTotals(): void {
  const hkgMin = Math.round(sum(hkgStats, 'minutes_played') * 60);
  const inaMin = Math.round(sum(inaStats, 'minutes_played') * 60);
  if (hkgMin !== 12000) throw new Error(`HKG minutes ${hkgMin}s !== 200:00`);
  if (inaMin !== 12000) throw new Error(`INA minutes ${inaMin}s !== 200:00`);

  if (sum(hkgStats, 'points') !== 71) throw new Error(`HKG PTS ${sum(hkgStats, 'points')}`);
  if (sum(inaStats, 'points') !== 60) throw new Error(`INA PTS ${sum(inaStats, 'points')}`);

  if (sum(hkgStats, 'fg_made') !== 25 || sum(hkgStats, 'fg_attempted') !== 60) {
    throw new Error(`HKG FG ${sum(hkgStats, 'fg_made')}/${sum(hkgStats, 'fg_attempted')}`);
  }
  if (sum(inaStats, 'fg_made') !== 22 || sum(inaStats, 'fg_attempted') !== 64) {
    throw new Error(`INA FG ${sum(inaStats, 'fg_made')}/${sum(inaStats, 'fg_attempted')}`);
  }

  if (sum(hkgStats, 'three_made') !== 9 || sum(hkgStats, 'three_attempted') !== 27) {
    throw new Error(`HKG 3P ${sum(hkgStats, 'three_made')}/${sum(hkgStats, 'three_attempted')}`);
  }
  if (sum(inaStats, 'three_made') !== 7 || sum(inaStats, 'three_attempted') !== 25) {
    throw new Error(`INA 3P ${sum(inaStats, 'three_made')}/${sum(inaStats, 'three_attempted')}`);
  }

  if (sum(hkgStats, 'ft_made') !== 12 || sum(hkgStats, 'ft_attempted') !== 20) {
    throw new Error(`HKG FT ${sum(hkgStats, 'ft_made')}/${sum(hkgStats, 'ft_attempted')}`);
  }
  if (sum(inaStats, 'ft_made') !== 9 || sum(inaStats, 'ft_attempted') !== 15) {
    throw new Error(`INA FT ${sum(inaStats, 'ft_made')}/${sum(inaStats, 'ft_attempted')}`);
  }

  if (sum(hkgStats, 'orb') !== 8) throw new Error(`HKG player ORB ${sum(hkgStats, 'orb')}`);
  if (sum(hkgStats, 'drb') !== 27) throw new Error(`HKG player DRB ${sum(hkgStats, 'drb')}`);
  if (sum(inaStats, 'orb') !== 11) throw new Error(`INA player ORB ${sum(inaStats, 'orb')}`);
  if (sum(inaStats, 'drb') !== 26) throw new Error(`INA player DRB ${sum(inaStats, 'drb')}`);

  if (sum(hkgStats, 'assists') !== 13) throw new Error(`HKG AST ${sum(hkgStats, 'assists')}`);
  if (sum(inaStats, 'assists') !== 12) throw new Error(`INA AST ${sum(inaStats, 'assists')}`);
  if (sum(hkgStats, 'turnovers') !== 15) {
    throw new Error(`HKG player TO ${sum(hkgStats, 'turnovers')}`);
  }
  if (sum(inaStats, 'turnovers') !== 15) {
    throw new Error(`INA player TO ${sum(inaStats, 'turnovers')}`);
  }
  if (sum(hkgStats, 'steals') !== 8) throw new Error(`HKG ST ${sum(hkgStats, 'steals')}`);
  if (sum(inaStats, 'steals') !== 9) throw new Error(`INA ST ${sum(inaStats, 'steals')}`);
  if (sum(hkgStats, 'blocks') !== 1) throw new Error(`HKG BLK ${sum(hkgStats, 'blocks')}`);
  if (sum(inaStats, 'blocks') !== 4) throw new Error(`INA BLK ${sum(inaStats, 'blocks')}`);
  if (sum(hkgStats, 'fouls') !== 20) throw new Error(`HKG PF ${sum(hkgStats, 'fouls')}`);
  if (sum(inaStats, 'fouls') !== 21) throw new Error(`INA PF ${sum(inaStats, 'fouls')}`);
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

assertTotals();

const bundle = {
  version: '1',
  tournament: {
    id: TOURNAMENT_ID,
    name: 'FIBA Asia Cup 2029 Pre-Qualifiers',
    year: 2026,
    month: 'Aug',
    teamIds: [HKG_ID, INA_ID],
  },
  teams: [
    {
      id: HKG_ID,
      name: 'Hong Kong, China',
      abbreviation: 'HKG',
      currentTournamentId: TOURNAMENT_ID,
      players: [],
    },
    {
      id: INA_ID,
      name: 'Indonesia',
      abbreviation: 'INA',
      currentTournamentId: TOURNAMENT_ID,
      players: [],
    },
  ],
  game: {
    id: GAME_ID,
    homeTeamId: HKG_ID,
    awayTeamId: INA_ID,
    tournamentId: TOURNAMENT_ID,
    date: '2026-08-30',
    startTime: '16:00',
    currentPeriod: 4,
    currentGameTime: '00:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 71, away: 60 },
    homeStarters: [HKG.glen, HKG.xu, HKG.ricky, HKG.pok, HKG.yip],
    awayStarters: [INA.bagir, INA.saputera, INA.diagne, INA.wiguna, INA.beane],
    gameStats: [...hkgStats, ...inaStats],
    teamStats: {
      home: teamStats(HKG_ID, [19, 21, 10, 21], {
        fg: [25, 60],
        three: [9, 27],
        ft: [12, 20],
        orb: sum(hkgStats, 'orb'),
        drb: sum(hkgStats, 'drb'),
        teamOrb: 3,
        teamDrb: 4,
        teamTo: 1,
        teamFouls: 1,
        assists: 13,
        steals: sum(hkgStats, 'steals'),
        blocks: sum(hkgStats, 'blocks'),
        turnovers: sum(hkgStats, 'turnovers'),
        fouls: sum(hkgStats, 'fouls'),
        pitp: 32,
        second: 10,
        fb: 13,
        bench: 32,
        lead: 0,
        run: 0,
        pto: 21,
      }),
      away: teamStats(INA_ID, [11, 13, 19, 17], {
        fg: [22, 64],
        three: [7, 25],
        ft: [9, 15],
        orb: sum(inaStats, 'orb'),
        drb: sum(inaStats, 'drb'),
        teamOrb: 1,
        teamDrb: 2,
        teamTo: 1,
        teamFouls: 1,
        assists: 12,
        steals: sum(inaStats, 'steals'),
        blocks: sum(inaStats, 'blocks'),
        turnovers: sum(inaStats, 'turnovers'),
        fouls: sum(inaStats, 'fouls'),
        pitp: 20,
        second: 11,
        fb: 6,
        bench: 10,
        lead: 0,
        run: 0,
        pto: 16,
      }),
    },
    shots: [],
    events: [],
    lineupStints: [],
  },
};

const out = resolve(
  process.cwd(),
  'Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-30-hkg-ina.json'
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
console.log('Wrote', out);
console.log('HKG', hkgStats.length, 'stat rows (+ Reid DNP)');
console.log('INA', inaStats.length, 'stat rows');
