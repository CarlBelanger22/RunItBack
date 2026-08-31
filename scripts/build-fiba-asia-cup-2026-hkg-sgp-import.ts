/**
 * FIBA Asia Cup 2029 Pre-Qualifiers — HKG 100–59 SGP (Arena Seremban, 2026-08-31 16:00).
 *
 *   npx tsx scripts/build-fiba-asia-cup-2026-hkg-sgp-import.ts
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-31-hkg-sgp.json --stats-only --dry-run
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-31-hkg-sgp.json --stats-only
 *
 * Reid + Jeryl DNP. FD imported. Club + tournament jersey #s unchanged.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const TOURNAMENT_ID = 'tournament-1787937458049';
const HKG_ID = 'team-hkg-mens-nt-2026';
const SGP_ID = 'team-1786634408294';
const GAME_ID = 'game-2026-08-31-fiba-hkg-sgp';

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

const SGP = {
  jay: 'player-1786719720297',
  zach: 'player-1786719611267',
  louis: 'player-sunig-ntu-4',
  bryant: 'player-1787024206829',
  chengshan: 'player-sunig-ntu-8',
  lavin: 'player-1786719502718',
  akash: 'player-1786804530745',
  jeryl: 'player-1787024264973',
  jackson: 'player-1787024297348',
  carl: 'player-sunig-ntu-22',
  john: 'player-1786720346120',
  minhan: 'player-1786719974252',
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
  foulsDrawn: number,
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
    fouls_drawn: foulsDrawn,
    blocks_received: 0,
    plus_minus: plusMinus,
    minutes_played: min(mmss),
  };
}

const hkgStats = [
  // FG, 3P, FT, OR, DR, AST, TO, ST, BLK, PF, FD, +/-, PTS
  stat(HKG.glen, '17:56', [3, 6], [1, 2], [2, 2], 0, 0, 3, 3, 0, 0, 3, 2, 7, 9),
  stat(HKG.yeung, '24:24', [4, 7], [2, 5], [1, 1], 1, 1, 6, 2, 1, 0, 3, 2, 20, 11),
  stat(HKG.xu, '16:37', [3, 7], [0, 2], [2, 2], 0, 0, 2, 1, 1, 0, 1, 2, 9, 8),
  stat(HKG.tsang, '16:10', [0, 8], [0, 3], [0, 0], 3, 1, 4, 2, 1, 0, 0, 0, 19, 0),
  stat(HKG.ricky, '18:44', [3, 8], [2, 4], [2, 2], 0, 2, 4, 1, 1, 0, 1, 1, 26, 10),
  stat(HKG.ng, '12:29', [3, 6], [3, 6], [0, 0], 0, 1, 3, 2, 0, 0, 1, 1, 15, 9),
  stat(HKG.pok, '15:43', [4, 7], [0, 0], [5, 6], 4, 6, 2, 0, 0, 0, 1, 3, 20, 13),
  stat(HKG.ma, '17:09', [3, 7], [0, 0], [0, 0], 4, 6, 0, 0, 1, 2, 0, 0, 14, 6),
  stat(HKG.leung, '21:16', [6, 8], [3, 4], [1, 1], 0, 1, 1, 0, 3, 0, 1, 1, 29, 16),
  stat(HKG.ivan, '23:10', [3, 8], [0, 2], [6, 6], 6, 7, 1, 2, 1, 1, 4, 3, 24, 12),
  // reid DNP
  stat(HKG.yip, '16:22', [1, 4], [1, 2], [3, 4], 1, 3, 1, 0, 2, 1, 0, 3, 22, 6),
];

const sgpStats = [
  stat(SGP.jay, '19:14', [2, 8], [1, 2], [0, 0], 1, 2, 3, 4, 0, 1, 4, 2, -11, 5),
  stat(SGP.zach, '22:55', [4, 6], [1, 1], [0, 0], 0, 3, 1, 0, 2, 2, 1, 0, -20, 9),
  stat(SGP.louis, '13:42', [1, 4], [0, 3], [0, 2], 0, 1, 1, 2, 1, 0, 2, 2, -33, 2),
  stat(SGP.bryant, '06:47', [0, 0], [0, 0], [0, 0], 0, 1, 1, 1, 1, 0, 2, 0, -4, 0),
  stat(SGP.chengshan, '16:16', [4, 8], [1, 1], [1, 2], 0, 1, 0, 0, 0, 0, 0, 3, -19, 10),
  stat(SGP.lavin, '13:43', [2, 5], [0, 0], [1, 2], 1, 1, 1, 0, 0, 0, 0, 1, -8, 5),
  stat(SGP.akash, '23:31', [1, 6], [0, 0], [2, 2], 1, 1, 3, 2, 1, 4, 3, 1, -34, 4),
  // jeryl DNP
  stat(SGP.jackson, '28:14', [3, 8], [1, 5], [1, 3], 0, 3, 4, 2, 1, 0, 1, 4, -17, 8),
  stat(SGP.carl, '22:28', [5, 7], [0, 1], [2, 2], 0, 1, 1, 1, 0, 1, 0, 2, -17, 12),
  stat(SGP.john, '14:33', [0, 2], [0, 0], [0, 0], 0, 3, 4, 2, 1, 0, 1, 0, -23, 0),
  stat(SGP.minhan, '18:37', [2, 6], [0, 0], [0, 0], 1, 1, 0, 2, 1, 0, 4, 0, -19, 4),
];

function sum<K extends keyof (typeof hkgStats)[0]>(
  rows: Array<(typeof hkgStats)[0]>,
  key: K
): number {
  return rows.reduce((s, r) => s + (r[key] as number), 0);
}

function assertTotals(): void {
  const hkgMin = Math.round(sum(hkgStats, 'minutes_played') * 60);
  const sgpMin = Math.round(sum(sgpStats, 'minutes_played') * 60);
  if (hkgMin !== 12000) throw new Error(`HKG minutes ${hkgMin}s !== 200:00`);
  if (sgpMin !== 12000) throw new Error(`SGP minutes ${sgpMin}s !== 200:00`);

  if (sum(hkgStats, 'points') !== 100) throw new Error(`HKG PTS ${sum(hkgStats, 'points')}`);
  if (sum(sgpStats, 'points') !== 59) throw new Error(`SGP PTS ${sum(sgpStats, 'points')}`);

  if (sum(hkgStats, 'fg_made') !== 33 || sum(hkgStats, 'fg_attempted') !== 76) {
    throw new Error(`HKG FG ${sum(hkgStats, 'fg_made')}/${sum(hkgStats, 'fg_attempted')}`);
  }
  if (sum(sgpStats, 'fg_made') !== 24 || sum(sgpStats, 'fg_attempted') !== 60) {
    throw new Error(`SGP FG ${sum(sgpStats, 'fg_made')}/${sum(sgpStats, 'fg_attempted')}`);
  }

  if (sum(hkgStats, 'three_made') !== 12 || sum(hkgStats, 'three_attempted') !== 30) {
    throw new Error(`HKG 3P ${sum(hkgStats, 'three_made')}/${sum(hkgStats, 'three_attempted')}`);
  }
  if (sum(sgpStats, 'three_made') !== 4 || sum(sgpStats, 'three_attempted') !== 13) {
    throw new Error(`SGP 3P ${sum(sgpStats, 'three_made')}/${sum(sgpStats, 'three_attempted')}`);
  }

  if (sum(hkgStats, 'ft_made') !== 22 || sum(hkgStats, 'ft_attempted') !== 24) {
    throw new Error(`HKG FT ${sum(hkgStats, 'ft_made')}/${sum(hkgStats, 'ft_attempted')}`);
  }
  if (sum(sgpStats, 'ft_made') !== 7 || sum(sgpStats, 'ft_attempted') !== 13) {
    throw new Error(`SGP FT ${sum(sgpStats, 'ft_made')}/${sum(sgpStats, 'ft_attempted')}`);
  }

  if (sum(hkgStats, 'orb') !== 19) throw new Error(`HKG player ORB ${sum(hkgStats, 'orb')}`);
  if (sum(hkgStats, 'drb') !== 28) throw new Error(`HKG player DRB ${sum(hkgStats, 'drb')}`);
  if (sum(sgpStats, 'orb') !== 4) throw new Error(`SGP player ORB ${sum(sgpStats, 'orb')}`);
  if (sum(sgpStats, 'drb') !== 18) throw new Error(`SGP player DRB ${sum(sgpStats, 'drb')}`);

  if (sum(hkgStats, 'assists') !== 27) throw new Error(`HKG AST ${sum(hkgStats, 'assists')}`);
  if (sum(sgpStats, 'assists') !== 19) throw new Error(`SGP AST ${sum(sgpStats, 'assists')}`);
  if (sum(hkgStats, 'turnovers') !== 13) {
    throw new Error(`HKG player TO ${sum(hkgStats, 'turnovers')}`);
  }
  if (sum(sgpStats, 'turnovers') !== 16) {
    throw new Error(`SGP player TO ${sum(sgpStats, 'turnovers')}`);
  }
  if (sum(hkgStats, 'steals') !== 11) throw new Error(`HKG ST ${sum(hkgStats, 'steals')}`);
  if (sum(sgpStats, 'steals') !== 8) throw new Error(`SGP ST ${sum(sgpStats, 'steals')}`);
  if (sum(hkgStats, 'blocks') !== 4) throw new Error(`HKG BLK ${sum(hkgStats, 'blocks')}`);
  if (sum(sgpStats, 'blocks') !== 8) throw new Error(`SGP BLK ${sum(sgpStats, 'blocks')}`);
  if (sum(hkgStats, 'fouls') !== 15) throw new Error(`HKG PF ${sum(hkgStats, 'fouls')}`);
  if (sum(sgpStats, 'fouls') !== 18) throw new Error(`SGP PF ${sum(sgpStats, 'fouls')}`);
  if (sum(hkgStats, 'fouls_drawn') !== 18) {
    throw new Error(`HKG FD ${sum(hkgStats, 'fouls_drawn')}`);
  }
  if (sum(sgpStats, 'fouls_drawn') !== 15) {
    throw new Error(`SGP FD ${sum(sgpStats, 'fouls_drawn')}`);
  }
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
    teamIds: [HKG_ID, SGP_ID],
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
      id: SGP_ID,
      name: 'Singapore',
      abbreviation: 'SGP',
      currentTournamentId: TOURNAMENT_ID,
      players: [],
    },
  ],
  game: {
    id: GAME_ID,
    homeTeamId: HKG_ID,
    awayTeamId: SGP_ID,
    tournamentId: TOURNAMENT_ID,
    date: '2026-08-31',
    startTime: '16:00',
    currentPeriod: 4,
    currentGameTime: '00:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 100, away: 59 },
    homeStarters: [HKG.glen, HKG.xu, HKG.ricky, HKG.pok, HKG.yip],
    awayStarters: [SGP.jay, SGP.zach, SGP.akash, SGP.jackson, SGP.minhan],
    gameStats: [...hkgStats, ...sgpStats],
    teamStats: {
      home: teamStats(HKG_ID, [28, 29, 21, 22], {
        fg: [33, 76],
        three: [12, 30],
        ft: [22, 24],
        orb: sum(hkgStats, 'orb'),
        drb: sum(hkgStats, 'drb'),
        teamOrb: 6,
        teamDrb: 3,
        teamTo: 0,
        teamFouls: 0,
        assists: 27,
        steals: sum(hkgStats, 'steals'),
        blocks: sum(hkgStats, 'blocks'),
        turnovers: sum(hkgStats, 'turnovers'),
        fouls: sum(hkgStats, 'fouls'),
        pitp: 38,
        second: 27,
        fb: 14,
        bench: 54,
        lead: 41,
        run: 17,
        pto: 27,
      }),
      away: teamStats(SGP_ID, [14, 15, 19, 11], {
        fg: [24, 60],
        three: [4, 13],
        ft: [7, 13],
        orb: sum(sgpStats, 'orb'),
        drb: sum(sgpStats, 'drb'),
        teamOrb: 5,
        teamDrb: 1,
        teamTo: 2,
        teamFouls: 0,
        assists: 19,
        steals: sum(sgpStats, 'steals'),
        blocks: sum(sgpStats, 'blocks'),
        turnovers: sum(sgpStats, 'turnovers'),
        fouls: sum(sgpStats, 'fouls'),
        pitp: 28,
        second: 7,
        fb: 12,
        bench: 29,
        lead: 1,
        run: 8,
        pto: 14,
      }),
    },
    shots: [],
    events: [],
    lineupStints: [],
  },
};

const out = resolve(
  process.cwd(),
  'Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-31-hkg-sgp.json'
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
console.log('Wrote', out);
console.log('HKG', hkgStats.length, 'stat rows (+ Reid DNP)');
console.log('SGP', sgpStats.length, 'stat rows (+ Jeryl DNP)');
