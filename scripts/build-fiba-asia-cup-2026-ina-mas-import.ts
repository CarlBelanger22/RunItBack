/**
 * FIBA Asia Cup 2029 Pre-Qualifiers — INA 63–77 MAS (Arena Seremban, 2026-08-31 19:00).
 *
 *   npx tsx scripts/build-fiba-asia-cup-2026-ina-mas-import.ts
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-31-ina-mas.json --stats-only --dry-run
 *   npm run import:boxscore -- --file Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-31-ina-mas.json --stats-only
 *
 * MAS #10 Munnesvicky + #24 Tan DNP. FD = 0. Biggest lead/run = 0. Jersey #s unchanged.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const TOURNAMENT_ID = 'tournament-1787937458049';
const INA_ID = 'team-ina-mens-nt-2026';
const MAS_ID = 'team-mas-mens-nt-2026';
const GAME_ID = 'game-2026-08-31-fiba-ina-mas';
const YONGA = 'player-asg19-indonesia-hendrix-xavi-yonga';

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

const inaStats = [
  // FG, 3P, FT, OR, DR, AST, TO, ST, BLK, PF, +/-, PTS
  stat(INA.erga, '01:21', [0, 0], [0, 0], [0, 0], 0, 0, 0, 1, 0, 0, 0, -2, 0),
  stat(INA.bagir, '15:24', [0, 2], [0, 0], [0, 0], 0, 1, 0, 0, 1, 0, 4, -16, 0),
  stat(INA.saputera, '33:40', [3, 8], [1, 5], [0, 0], 0, 4, 2, 5, 1, 0, 1, 1, 7),
  stat(INA.disi, '04:45', [0, 0], [0, 0], [0, 0], 0, 0, 0, 1, 0, 0, 0, -13, 0),
  stat(INA.sanyudy, '02:03', [0, 0], [0, 0], [0, 0], 0, 0, 0, 1, 0, 0, 0, 0, 0),
  stat(INA.reza, '20:01', [1, 4], [0, 3], [6, 8], 0, 2, 2, 3, 1, 2, 2, -14, 8),
  stat(INA.yonga, '21:45', [1, 2], [0, 1], [2, 2], 1, 3, 3, 2, 1, 0, 1, 0, 4),
  stat(INA.sanjaya, '00:48', [0, 0], [0, 0], [0, 0], 0, 1, 0, 0, 0, 0, 0, -2, 0),
  stat(INA.diagne, '27:49', [7, 10], [1, 2], [1, 3], 1, 5, 1, 3, 0, 4, 0, -17, 16),
  stat(INA.wiguna, '11:01', [0, 1], [0, 0], [1, 2], 0, 0, 0, 1, 0, 0, 2, -4, 1),
  stat(INA.maulana, '23:40', [1, 2], [0, 0], [2, 3], 0, 4, 1, 2, 1, 0, 4, 9, 4),
  stat(INA.beane, '37:43', [8, 19], [1, 7], [6, 9], 0, 4, 0, 3, 2, 0, 4, -12, 23),
];

const masStats = [
  stat(MAS.hiew, '21:39', [3, 6], [1, 2], [0, 0], 2, 0, 1, 3, 1, 0, 4, 11, 7),
  stat(MAS.tiong, '06:38', [0, 1], [0, 1], [0, 0], 0, 0, 0, 0, 1, 0, 0, 2, 0),
  stat(MAS.mahadevan, '15:27', [3, 8], [0, 0], [0, 0], 5, 3, 1, 1, 1, 0, 4, 17, 6),
  stat(MAS.jayson, '18:26', [0, 5], [0, 3], [3, 4], 0, 1, 4, 0, 1, 0, 3, -10, 3),
  // munnesvicky DNP
  stat(MAS.wong, '12:33', [2, 6], [0, 1], [2, 2], 2, 0, 0, 1, 1, 0, 3, -11, 6),
  stat(MAS.bosango, '37:44', [6, 13], [1, 2], [2, 3], 4, 10, 3, 2, 1, 1, 3, 18, 15),
  stat(MAS.chin, '12:42', [1, 2], [0, 0], [0, 0], 1, 2, 0, 0, 1, 0, 2, 6, 2),
  stat(MAS.jingHung, '11:51', [2, 6], [0, 0], [0, 2], 0, 2, 0, 0, 0, 0, 1, -9, 4),
  // tan DNP
  stat(MAS.ting, '34:46', [7, 17], [4, 9], [3, 7], 2, 5, 1, 4, 1, 0, 3, 22, 21),
  stat(MAS.ong, '28:14', [6, 6], [1, 1], [0, 0], 1, 1, 3, 4, 5, 0, 2, 24, 13),
];

function sum<K extends keyof (typeof inaStats)[0]>(
  rows: Array<(typeof inaStats)[0]>,
  key: K
): number {
  return rows.reduce((s, r) => s + (r[key] as number), 0);
}

function assertTotals(): void {
  const inaMin = Math.round(sum(inaStats, 'minutes_played') * 60);
  const masMin = Math.round(sum(masStats, 'minutes_played') * 60);
  if (inaMin !== 12000) throw new Error(`INA minutes ${inaMin}s !== 200:00`);
  if (masMin !== 12000) throw new Error(`MAS minutes ${masMin}s !== 200:00`);

  if (sum(inaStats, 'points') !== 63) throw new Error(`INA PTS ${sum(inaStats, 'points')}`);
  if (sum(masStats, 'points') !== 77) throw new Error(`MAS PTS ${sum(masStats, 'points')}`);

  if (sum(inaStats, 'fg_made') !== 21 || sum(inaStats, 'fg_attempted') !== 48) {
    throw new Error(`INA FG ${sum(inaStats, 'fg_made')}/${sum(inaStats, 'fg_attempted')}`);
  }
  if (sum(masStats, 'fg_made') !== 30 || sum(masStats, 'fg_attempted') !== 70) {
    throw new Error(`MAS FG ${sum(masStats, 'fg_made')}/${sum(masStats, 'fg_attempted')}`);
  }

  if (sum(inaStats, 'three_made') !== 3 || sum(inaStats, 'three_attempted') !== 18) {
    throw new Error(`INA 3P ${sum(inaStats, 'three_made')}/${sum(inaStats, 'three_attempted')}`);
  }
  if (sum(masStats, 'three_made') !== 7 || sum(masStats, 'three_attempted') !== 19) {
    throw new Error(`MAS 3P ${sum(masStats, 'three_made')}/${sum(masStats, 'three_attempted')}`);
  }

  if (sum(inaStats, 'ft_made') !== 18 || sum(inaStats, 'ft_attempted') !== 27) {
    throw new Error(`INA FT ${sum(inaStats, 'ft_made')}/${sum(inaStats, 'ft_attempted')}`);
  }
  if (sum(masStats, 'ft_made') !== 10 || sum(masStats, 'ft_attempted') !== 18) {
    throw new Error(`MAS FT ${sum(masStats, 'ft_made')}/${sum(masStats, 'ft_attempted')}`);
  }

  if (sum(inaStats, 'orb') !== 2) throw new Error(`INA player ORB ${sum(inaStats, 'orb')}`);
  if (sum(inaStats, 'drb') !== 24) throw new Error(`INA player DRB ${sum(inaStats, 'drb')}`);
  if (sum(masStats, 'orb') !== 17) throw new Error(`MAS player ORB ${sum(masStats, 'orb')}`);
  if (sum(masStats, 'drb') !== 24) throw new Error(`MAS player DRB ${sum(masStats, 'drb')}`);

  if (sum(inaStats, 'assists') !== 9) throw new Error(`INA AST ${sum(inaStats, 'assists')}`);
  if (sum(masStats, 'assists') !== 13) throw new Error(`MAS AST ${sum(masStats, 'assists')}`);
  if (sum(inaStats, 'turnovers') !== 22) {
    throw new Error(`INA player TO ${sum(inaStats, 'turnovers')}`);
  }
  if (sum(masStats, 'turnovers') !== 15) {
    throw new Error(`MAS player TO ${sum(masStats, 'turnovers')}`);
  }
  if (sum(inaStats, 'steals') !== 7) throw new Error(`INA ST ${sum(inaStats, 'steals')}`);
  if (sum(masStats, 'steals') !== 13) throw new Error(`MAS ST ${sum(masStats, 'steals')}`);
  if (sum(inaStats, 'blocks') !== 6) throw new Error(`INA BLK ${sum(inaStats, 'blocks')}`);
  if (sum(masStats, 'blocks') !== 1) throw new Error(`MAS BLK ${sum(masStats, 'blocks')}`);
  if (sum(inaStats, 'fouls') !== 18) throw new Error(`INA PF ${sum(inaStats, 'fouls')}`);
  if (sum(masStats, 'fouls') !== 25) throw new Error(`MAS PF ${sum(masStats, 'fouls')}`);
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
    teamIds: [INA_ID, MAS_ID],
  },
  teams: [
    {
      id: INA_ID,
      name: 'Indonesia',
      abbreviation: 'INA',
      currentTournamentId: TOURNAMENT_ID,
      players: [],
    },
    {
      id: MAS_ID,
      name: 'Malaysia',
      abbreviation: 'MAS',
      currentTournamentId: TOURNAMENT_ID,
      players: [],
    },
  ],
  game: {
    id: GAME_ID,
    homeTeamId: INA_ID,
    awayTeamId: MAS_ID,
    tournamentId: TOURNAMENT_ID,
    date: '2026-08-31',
    startTime: '19:00',
    currentPeriod: 4,
    currentGameTime: '00:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 63, away: 77 },
    homeStarters: [INA.bagir, INA.saputera, INA.diagne, INA.wiguna, INA.beane],
    awayStarters: [MAS.mahadevan, MAS.jayson, MAS.bosango, MAS.ting, MAS.ong],
    gameStats: [...inaStats, ...masStats],
    teamStats: {
      home: teamStats(INA_ID, [11, 20, 17, 15], {
        fg: [21, 48],
        three: [3, 18],
        ft: [18, 27],
        orb: sum(inaStats, 'orb'),
        drb: sum(inaStats, 'drb'),
        teamOrb: 3,
        teamDrb: 0,
        teamTo: 0,
        teamFouls: 1,
        assists: 9,
        steals: sum(inaStats, 'steals'),
        blocks: sum(inaStats, 'blocks'),
        turnovers: sum(inaStats, 'turnovers'),
        fouls: sum(inaStats, 'fouls'),
        pitp: 34,
        second: 3,
        fb: 17,
        bench: 16,
        lead: 0,
        run: 0,
        pto: 9,
      }),
      away: teamStats(MAS_ID, [21, 16, 20, 20], {
        fg: [30, 70],
        three: [7, 19],
        ft: [10, 18],
        orb: sum(masStats, 'orb'),
        drb: sum(masStats, 'drb'),
        teamOrb: 0,
        teamDrb: 1,
        teamTo: 1,
        teamFouls: 1,
        assists: 13,
        steals: sum(masStats, 'steals'),
        blocks: sum(masStats, 'blocks'),
        turnovers: sum(masStats, 'turnovers'),
        fouls: sum(masStats, 'fouls'),
        pitp: 44,
        second: 22,
        fb: 17,
        bench: 19,
        lead: 0,
        run: 0,
        pto: 28,
      }),
    },
    shots: [],
    events: [],
    lineupStints: [],
  },
};

const out = resolve(
  process.cwd(),
  'Importingboxscores/fiba-asia-cup-2029-pre-qualifiers/game-2026-08-31-ina-mas.json'
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
console.log('Wrote', out);
console.log('INA', inaStats.length, 'stat rows');
console.log('MAS', masStats.length, 'stat rows (+ Munnesvicky & Tan DNP)');
