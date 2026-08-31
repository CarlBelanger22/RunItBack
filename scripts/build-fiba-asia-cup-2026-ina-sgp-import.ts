/**
 * FIBA Asia Cup 2029 Pre-Qualifiers — INA 80–54 SGP (Arena Seremban, 2026-08-28).
 *
 *   npx tsx scripts/build-fiba-asia-cup-2026-ina-sgp-import.ts
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-28-ina-sgp.json --stats-only --add-new-players --dry-run
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-28-ina-sgp.json --stats-only --add-new-players
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const TOURNAMENT_ID = 'tournament-1787937458049';
const INA_ID = 'team-ina-mens-nt-2026';
const SGP_ID = 'team-1786634408294';
const GAME_ID = 'game-2026-08-28-fiba-ina-sgp';
const YONGA = 'player-asg19-indonesia-hendrix-xavi-yonga';
const MAULANA = 'player-ina-nt-2026-77-maulana';

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
  maulana: MAULANA,
  beane: 'player-ina-nt-2026-03-beane',
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

const inaStats = [
  stat(INA.erga, '09:18', [0, 0], [0, 0], [0, 0], 0, 2, 1, 1, 0, 0, 2, 0, 6, 0),
  stat(INA.bagir, '17:52', [1, 5], [1, 2], [0, 0], 0, 5, 1, 1, 0, 1, 0, 1, 1, 3),
  stat(INA.saputera, '22:58', [5, 11], [3, 7], [3, 5], 1, 0, 3, 3, 1, 0, 1, 3, 13, 16),
  stat(INA.disi, '20:43', [5, 9], [3, 4], [2, 2], 1, 3, 4, 2, 1, 1, 1, 2, 17, 15),
  stat(INA.sanyudy, '11:18', [2, 3], [0, 0], [2, 2], 3, 0, 1, 2, 0, 0, 2, 1, 5, 6),
  stat(INA.reza, '18:05', [1, 4], [1, 2], [0, 0], 0, 2, 2, 1, 0, 0, 0, 1, 14, 3),
  stat(INA.yonga, '12:28', [2, 3], [1, 1], [0, 0], 0, 0, 1, 1, 0, 0, 1, 0, 17, 5),
  stat(INA.sanjaya, '10:12', [1, 2], [0, 0], [4, 4], 0, 3, 1, 0, 0, 1, 2, 3, 13, 6),
  stat(INA.diagne, '19:16', [4, 6], [1, 2], [0, 2], 1, 1, 0, 0, 1, 0, 4, 1, 14, 9),
  stat(INA.wiguna, '17:41', [1, 2], [0, 0], [0, 0], 1, 2, 1, 0, 1, 1, 1, 0, 8, 2),
  stat(INA.maulana, '13:58', [0, 2], [0, 0], [2, 2], 2, 4, 2, 1, 1, 0, 2, 3, 14, 2),
  stat(INA.beane, '26:11', [5, 12], [0, 5], [3, 4], 1, 7, 4, 1, 2, 0, 0, 6, 8, 13),
];

const sgpStats = [
  stat(SGP.jay, '33:03', [6, 17], [4, 10], [3, 4], 1, 4, 0, 4, 1, 0, 3, 7, -16, 19),
  stat(SGP.zach, '26:20', [4, 12], [1, 4], [0, 0], 0, 3, 3, 4, 1, 0, 0, 2, -14, 9),
  stat(SGP.louis, '07:10', [0, 0], [0, 0], [0, 0], 2, 1, 2, 0, 0, 0, 0, 1, -9, 0),
  stat(SGP.bryant, '04:09', [0, 2], [0, 2], [0, 0], 1, 0, 0, 0, 0, 0, 0, 1, -1, 0),
  stat(SGP.chengshan, '16:00', [1, 6], [1, 3], [0, 0], 0, 0, 0, 1, 0, 1, 0, 0, -18, 3),
  stat(SGP.lavin, '08:24', [0, 2], [0, 0], [0, 0], 1, 2, 0, 1, 0, 0, 3, 0, -13, 0),
  stat(SGP.akash, '20:53', [1, 2], [0, 0], [0, 0], 1, 1, 0, 2, 1, 0, 3, 0, -9, 2),
  stat(SGP.jeryl, '05:40', [0, 1], [0, 0], [0, 0], 0, 0, 1, 0, 0, 0, 0, 0, -13, 0),
  stat(SGP.jackson, '20:40', [3, 8], [2, 7], [0, 0], 0, 2, 3, 1, 1, 1, 4, 0, 2, 8),
  stat(SGP.carl, '25:12', [3, 7], [0, 1], [0, 1], 0, 2, 1, 1, 1, 0, 2, 3, -20, 6),
  stat(SGP.john, '08:13', [0, 0], [0, 0], [0, 0], 0, 0, 0, 0, 0, 0, 3, 0, -14, 0),
  stat(SGP.minhan, '24:16', [3, 5], [0, 1], [1, 5], 2, 6, 4, 3, 0, 1, 4, 3, -5, 7),
];

function sum<K extends keyof (typeof inaStats)[0]>(
  rows: Array<(typeof inaStats)[0]>,
  key: K
): number {
  return rows.reduce((s, r) => s + (r[key] as number), 0);
}

function assertTotals(): void {
  const inaMin = Math.round(sum(inaStats, 'minutes_played') * 60);
  const sgpMin = Math.round(sum(sgpStats, 'minutes_played') * 60);
  if (inaMin !== 12000) throw new Error(`INA minutes ${inaMin}s !== 200:00`);
  if (sgpMin !== 12000) throw new Error(`SGP minutes ${sgpMin}s !== 200:00`);

  if (sum(inaStats, 'points') !== 80) throw new Error(`INA PTS ${sum(inaStats, 'points')}`);
  if (sum(sgpStats, 'points') !== 54) throw new Error(`SGP PTS ${sum(sgpStats, 'points')}`);

  if (sum(inaStats, 'fg_made') !== 27 || sum(inaStats, 'fg_attempted') !== 59) {
    throw new Error(`INA FG ${sum(inaStats, 'fg_made')}/${sum(inaStats, 'fg_attempted')}`);
  }
  if (sum(sgpStats, 'fg_made') !== 21 || sum(sgpStats, 'fg_attempted') !== 62) {
    throw new Error(`SGP FG ${sum(sgpStats, 'fg_made')}/${sum(sgpStats, 'fg_attempted')}`);
  }

  if (sum(inaStats, 'three_made') !== 10 || sum(inaStats, 'three_attempted') !== 23) {
    throw new Error('INA 3P');
  }
  if (sum(sgpStats, 'three_made') !== 8 || sum(sgpStats, 'three_attempted') !== 28) {
    throw new Error('SGP 3P');
  }

  if (sum(inaStats, 'ft_made') !== 16 || sum(inaStats, 'ft_attempted') !== 21) {
    throw new Error(`INA player FT ${sum(inaStats, 'ft_made')}/${sum(inaStats, 'ft_attempted')}`);
  }
  if (sum(sgpStats, 'ft_made') !== 4 || sum(sgpStats, 'ft_attempted') !== 10) {
    throw new Error('SGP FT');
  }

  if (sum(inaStats, 'orb') !== 10) throw new Error(`INA player ORB ${sum(inaStats, 'orb')}`);
  if (sum(inaStats, 'drb') !== 29) throw new Error(`INA player DRB ${sum(inaStats, 'drb')}`);
  if (sum(sgpStats, 'orb') !== 8) throw new Error(`SGP player ORB ${sum(sgpStats, 'orb')}`);
  if (sum(sgpStats, 'drb') !== 21) throw new Error(`SGP player DRB ${sum(sgpStats, 'drb')}`);

  if (sum(inaStats, 'assists') !== 21) throw new Error(`INA AST ${sum(inaStats, 'assists')}`);
  if (sum(sgpStats, 'assists') !== 14) throw new Error(`SGP AST ${sum(sgpStats, 'assists')}`);
  if (sum(inaStats, 'turnovers') !== 13) throw new Error(`INA player TO ${sum(inaStats, 'turnovers')}`);
  if (sum(sgpStats, 'turnovers') !== 17) throw new Error(`SGP TO ${sum(sgpStats, 'turnovers')}`);
  if (sum(inaStats, 'steals') !== 7) throw new Error(`INA ST ${sum(inaStats, 'steals')}`);
  if (sum(sgpStats, 'steals') !== 5) throw new Error(`SGP ST ${sum(sgpStats, 'steals')}`);
  if (sum(inaStats, 'blocks') !== 4) throw new Error(`INA BLK ${sum(inaStats, 'blocks')}`);
  if (sum(sgpStats, 'blocks') !== 3) throw new Error(`SGP BLK ${sum(sgpStats, 'blocks')}`);
  if (sum(inaStats, 'fouls') !== 16) throw new Error(`INA PF ${sum(inaStats, 'fouls')}`);
  if (sum(sgpStats, 'fouls') !== 22) throw new Error(`SGP PF ${sum(sgpStats, 'fouls')}`);
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

const inaNewPlayers = [
  {
    id: MAULANA,
    name: 'Muhammad Maulana',
    number: 77,
    position: 'SF',
    height: '180',
    weight: '',
    age: 0,
    dateOfBirth: '1998-02-09',
  },
];

const bundle = {
  version: '1',
  tournament: {
    id: TOURNAMENT_ID,
    name: 'FIBA Asia Cup 2029 Pre-Qualifiers',
    year: 2026,
    month: 'Aug',
    teamIds: [INA_ID, SGP_ID],
  },
  teams: [
    {
      id: INA_ID,
      name: 'Indonesia',
      abbreviation: 'INA',
      description: 'Indonesia Mens National Team 2026',
      currentTournamentId: TOURNAMENT_ID,
      players: inaNewPlayers,
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
    homeTeamId: INA_ID,
    awayTeamId: SGP_ID,
    tournamentId: TOURNAMENT_ID,
    date: '2026-08-28',
    startTime: '16:00',
    currentPeriod: 4,
    currentGameTime: '00:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 80, away: 54 },
    homeStarters: [INA.bagir, INA.saputera, INA.diagne, INA.wiguna, INA.beane],
    awayStarters: [SGP.jay, SGP.zach, SGP.akash, SGP.jackson, SGP.minhan],
    gameStats: [...inaStats, ...sgpStats],
    teamStats: {
      home: teamStats(INA_ID, [18, 22, 17, 23], {
        fg: [27, 59],
        three: [10, 23],
        ft: [16, 23],
        orb: sum(inaStats, 'orb'),
        drb: sum(inaStats, 'drb'),
        teamOrb: 1,
        teamDrb: 4,
        teamTo: 1,
        teamFouls: 0,
        assists: 21,
        steals: sum(inaStats, 'steals'),
        blocks: sum(inaStats, 'blocks'),
        turnovers: sum(inaStats, 'turnovers'),
        fouls: sum(inaStats, 'fouls'),
        pitp: 32,
        second: 6,
        fb: 13,
        bench: 37,
        lead: 36,
        run: 13,
        pto: 13,
      }),
      away: teamStats(SGP_ID, [6, 8, 14, 26], {
        fg: [21, 62],
        three: [8, 28],
        ft: [4, 10],
        orb: sum(sgpStats, 'orb'),
        drb: sum(sgpStats, 'drb'),
        teamOrb: 3,
        teamDrb: 1,
        teamTo: 0,
        teamFouls: 0,
        assists: 14,
        steals: sum(sgpStats, 'steals'),
        blocks: sum(sgpStats, 'blocks'),
        turnovers: sum(sgpStats, 'turnovers'),
        fouls: sum(sgpStats, 'fouls'),
        pitp: 18,
        second: 9,
        fb: 6,
        bench: 9,
        lead: 2,
        run: 6,
        pto: 12,
      }),
    },
    shots: [],
    events: [],
    lineupStints: [],
  },
};

const out = resolve(
  process.cwd(),
  'Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-28-ina-sgp.json'
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
console.log('Wrote', out);
console.log('INA', inaStats.length, 'stat rows; new players:', inaNewPlayers.length);
console.log('SGP', sgpStats.length, 'stat rows');
