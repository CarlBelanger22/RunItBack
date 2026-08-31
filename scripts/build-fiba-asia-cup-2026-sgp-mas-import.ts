/**
 * FIBA Asia Cup 2029 Pre-Qualifiers — SGP 56–100 MAS (Arena Seremban, 2026-08-30 19:00).
 *
 *   npx tsx scripts/build-fiba-asia-cup-2026-sgp-mas-import.ts
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-30-sgp-mas.json --stats-only --dry-run
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-30-sgp-mas.json --stats-only
 *
 * Jeryl Gan (#14) is DNP — on roster, no game_stats row.
 * Club jersey numbers unchanged; FIBA # applied via tournament_rosters seed after import.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const TOURNAMENT_ID = 'tournament-1787937458049';
const SGP_ID = 'team-1786634408294';
const MAS_ID = 'team-mas-mens-nt-2026';
const GAME_ID = 'game-2026-08-30-fiba-sgp-mas';

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

// FG, 3P, FT, OR, DR, AST, TO, ST, BLK, PF, FD, +/-, PTS
const sgpStats = [
  stat(SGP.jay, '26:05', [1, 5], [0, 2], [2, 2], 0, 2, 5, 5, 0, 0, 2, 4, -40, 4),
  stat(SGP.zach, '25:35', [8, 14], [4, 9], [3, 3], 0, 4, 1, 2, 1, 1, 3, 4, -31, 23),
  stat(SGP.louis, '08:27', [0, 2], [0, 2], [0, 0], 0, 2, 0, 1, 0, 0, 1, 0, -8, 0),
  stat(SGP.bryant, '09:41', [0, 2], [0, 1], [2, 2], 0, 3, 0, 2, 0, 0, 1, 1, -4, 2),
  stat(SGP.chengshan, '21:25', [3, 7], [0, 2], [4, 5], 0, 0, 3, 2, 0, 0, 0, 6, -7, 10),
  stat(SGP.lavin, '09:47', [0, 2], [0, 0], [0, 0], 0, 2, 0, 0, 0, 0, 0, 0, -21, 0),
  stat(SGP.akash, '21:44', [1, 2], [0, 0], [3, 4], 1, 0, 2, 1, 1, 2, 4, 3, -11, 5),
  // jeryl DNP
  stat(SGP.jackson, '20:45', [1, 8], [1, 4], [0, 0], 4, 1, 0, 4, 1, 1, 4, 0, -21, 3),
  stat(SGP.carl, '19:20', [2, 4], [0, 1], [0, 0], 0, 3, 2, 3, 1, 0, 2, 1, -35, 4),
  stat(SGP.john, '16:01', [1, 2], [0, 0], [2, 2], 2, 2, 1, 4, 1, 1, 2, 2, -20, 4),
  stat(SGP.minhan, '21:10', [0, 4], [0, 1], [1, 2], 0, 4, 0, 3, 2, 0, 3, 2, -22, 1),
];

const masStats = [
  stat(MAS.hiew, '22:49', [1, 2], [1, 2], [0, 0], 0, 1, 2, 2, 1, 0, 0, 1, 18, 3),
  stat(MAS.tiong, '20:38', [11, 14], [9, 12], [2, 2], 0, 1, 1, 0, 0, 0, 2, 2, 28, 33),
  stat(MAS.mahadevan, '14:01', [1, 2], [0, 0], [2, 4], 3, 4, 0, 1, 3, 0, 3, 3, 18, 4),
  stat(MAS.jayson, '14:04', [1, 3], [1, 2], [0, 0], 0, 2, 1, 1, 0, 0, 5, 1, 16, 3),
  stat(MAS.munnesvicky, '16:03', [0, 6], [0, 4], [0, 0], 1, 3, 3, 1, 1, 0, 1, 0, 12, 0),
  stat(MAS.wong, '17:23', [5, 12], [1, 4], [4, 5], 2, 0, 3, 3, 1, 0, 2, 5, 20, 15),
  stat(MAS.bosango, '17:46', [5, 8], [1, 3], [1, 1], 0, 4, 4, 0, 4, 0, 1, 1, 20, 12),
  stat(MAS.chin, '11:21', [1, 1], [0, 0], [1, 2], 0, 1, 0, 0, 1, 1, 2, 2, 18, 3),
  stat(MAS.jingHung, '14:38', [3, 5], [0, 0], [2, 2], 1, 3, 1, 0, 0, 0, 3, 1, 8, 8),
  stat(MAS.tan, '12:30', [2, 4], [1, 3], [3, 3], 0, 1, 3, 0, 0, 0, 2, 3, 10, 8),
  stat(MAS.ting, '19:40', [1, 7], [1, 3], [2, 2], 2, 4, 4, 0, 4, 0, 2, 2, 18, 5),
  stat(MAS.ong, '19:07', [2, 5], [1, 2], [1, 2], 1, 2, 4, 3, 3, 0, 0, 1, 34, 6),
];

function sum<K extends keyof (typeof sgpStats)[0]>(
  rows: Array<(typeof sgpStats)[0]>,
  key: K
): number {
  return rows.reduce((s, r) => s + (r[key] as number), 0);
}

function assertTotals(): void {
  const sgpMin = Math.round(sum(sgpStats, 'minutes_played') * 60);
  const masMin = Math.round(sum(masStats, 'minutes_played') * 60);
  if (sgpMin !== 12000) throw new Error(`SGP minutes ${sgpMin}s !== 200:00`);
  if (masMin !== 12000) throw new Error(`MAS minutes ${masMin}s !== 200:00`);

  if (sum(sgpStats, 'points') !== 56) throw new Error(`SGP PTS ${sum(sgpStats, 'points')}`);
  if (sum(masStats, 'points') !== 100) throw new Error(`MAS PTS ${sum(masStats, 'points')}`);

  if (sum(sgpStats, 'fg_made') !== 17 || sum(sgpStats, 'fg_attempted') !== 52) {
    throw new Error(`SGP FG ${sum(sgpStats, 'fg_made')}/${sum(sgpStats, 'fg_attempted')}`);
  }
  if (sum(masStats, 'fg_made') !== 33 || sum(masStats, 'fg_attempted') !== 69) {
    throw new Error(`MAS FG ${sum(masStats, 'fg_made')}/${sum(masStats, 'fg_attempted')}`);
  }

  if (sum(sgpStats, 'three_made') !== 5 || sum(sgpStats, 'three_attempted') !== 22) {
    throw new Error(`SGP 3P ${sum(sgpStats, 'three_made')}/${sum(sgpStats, 'three_attempted')}`);
  }
  if (sum(masStats, 'three_made') !== 16 || sum(masStats, 'three_attempted') !== 35) {
    throw new Error(`MAS 3P ${sum(masStats, 'three_made')}/${sum(masStats, 'three_attempted')}`);
  }

  if (sum(sgpStats, 'ft_made') !== 17 || sum(sgpStats, 'ft_attempted') !== 20) {
    throw new Error(`SGP FT ${sum(sgpStats, 'ft_made')}/${sum(sgpStats, 'ft_attempted')}`);
  }
  if (sum(masStats, 'ft_made') !== 18 || sum(masStats, 'ft_attempted') !== 23) {
    throw new Error(`MAS FT ${sum(masStats, 'ft_made')}/${sum(masStats, 'ft_attempted')}`);
  }

  if (sum(sgpStats, 'orb') !== 7) throw new Error(`SGP player ORB ${sum(sgpStats, 'orb')}`);
  if (sum(sgpStats, 'drb') !== 23) throw new Error(`SGP player DRB ${sum(sgpStats, 'drb')}`);
  if (sum(masStats, 'orb') !== 10) throw new Error(`MAS player ORB ${sum(masStats, 'orb')}`);
  if (sum(masStats, 'drb') !== 26) throw new Error(`MAS player DRB ${sum(masStats, 'drb')}`);

  if (sum(sgpStats, 'assists') !== 14) throw new Error(`SGP AST ${sum(sgpStats, 'assists')}`);
  if (sum(masStats, 'assists') !== 26) throw new Error(`MAS AST ${sum(masStats, 'assists')}`);
  if (sum(sgpStats, 'turnovers') !== 27) {
    throw new Error(`SGP player TO ${sum(sgpStats, 'turnovers')}`);
  }
  if (sum(masStats, 'turnovers') !== 11) {
    throw new Error(`MAS player TO ${sum(masStats, 'turnovers')}`);
  }
  if (sum(sgpStats, 'steals') !== 7) throw new Error(`SGP ST ${sum(sgpStats, 'steals')}`);
  if (sum(masStats, 'steals') !== 18) throw new Error(`MAS ST ${sum(masStats, 'steals')}`);
  if (sum(sgpStats, 'blocks') !== 5) throw new Error(`SGP BLK ${sum(sgpStats, 'blocks')}`);
  if (sum(masStats, 'blocks') !== 1) throw new Error(`MAS BLK ${sum(masStats, 'blocks')}`);
  if (sum(sgpStats, 'fouls') !== 22) throw new Error(`SGP PF ${sum(sgpStats, 'fouls')}`);
  if (sum(masStats, 'fouls') !== 23) throw new Error(`MAS PF ${sum(masStats, 'fouls')}`);
  if (sum(sgpStats, 'fouls_drawn') !== 23) {
    throw new Error(`SGP FD ${sum(sgpStats, 'fouls_drawn')}`);
  }
  if (sum(masStats, 'fouls_drawn') !== 22) {
    throw new Error(`MAS FD ${sum(masStats, 'fouls_drawn')}`);
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
    teamIds: [SGP_ID, MAS_ID],
  },
  teams: [
    {
      id: SGP_ID,
      name: 'Singapore',
      abbreviation: 'SGP',
      currentTournamentId: TOURNAMENT_ID,
      players: [],
    },
    {
      id: MAS_ID,
      name: 'Malaysia',
      abbreviation: 'MAS',
      description: 'Malaysia Mens National Team 2026',
      currentTournamentId: TOURNAMENT_ID,
      players: [],
    },
  ],
  game: {
    id: GAME_ID,
    homeTeamId: SGP_ID,
    awayTeamId: MAS_ID,
    tournamentId: TOURNAMENT_ID,
    date: '2026-08-30',
    startTime: '19:00',
    currentPeriod: 4,
    currentGameTime: '00:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 56, away: 100 },
    homeStarters: [SGP.jay, SGP.zach, SGP.jackson, SGP.carl, SGP.minhan],
    awayStarters: [MAS.mahadevan, MAS.jayson, MAS.bosango, MAS.ting, MAS.ong],
    gameStats: [...sgpStats, ...masStats],
    teamStats: {
      home: teamStats(SGP_ID, [10, 16, 19, 11], {
        fg: [17, 52],
        three: [5, 22],
        ft: [17, 20],
        orb: sum(sgpStats, 'orb'),
        drb: sum(sgpStats, 'drb'),
        teamOrb: 2,
        teamDrb: 4,
        teamTo: 1,
        teamFouls: 0,
        assists: 14,
        steals: sum(sgpStats, 'steals'),
        blocks: sum(sgpStats, 'blocks'),
        turnovers: sum(sgpStats, 'turnovers'),
        fouls: sum(sgpStats, 'fouls'),
        pitp: 20,
        second: 2,
        fb: 13,
        bench: 21,
        lead: 0,
        run: 8,
        pto: 9,
      }),
      away: teamStats(MAS_ID, [17, 34, 28, 21], {
        fg: [33, 69],
        three: [16, 35],
        ft: [18, 23],
        orb: sum(masStats, 'orb'),
        drb: sum(masStats, 'drb'),
        teamOrb: 2,
        teamDrb: 1,
        teamTo: 0,
        teamFouls: 0,
        assists: 26,
        steals: sum(masStats, 'steals'),
        blocks: sum(masStats, 'blocks'),
        turnovers: sum(masStats, 'turnovers'),
        fouls: sum(masStats, 'fouls'),
        pitp: 26,
        second: 10,
        fb: 8,
        bench: 70,
        lead: 52,
        run: 15,
        pto: 37,
      }),
    },
    shots: [],
    events: [],
    lineupStints: [],
  },
};

const out = resolve(
  process.cwd(),
  'Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-30-sgp-mas.json'
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
console.log('Wrote', out);
console.log('SGP', sgpStats.length, 'stat rows (+ Jeryl DNP)');
console.log('MAS', masStats.length, 'stat rows');
