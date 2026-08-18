/**
 * Indonesia Training Trip — SGP vs Damon Ballers (Aim High Stadium, 2026-08-16).
 *
 *   npx tsx scripts/build-sgp-damon-training-trip-import.ts
 *   npm run import:boxscore -- --file Importingboxscores/indonesia-training-trip/game-2026-08-16-sgp-dmn.json --stats-only --add-new-players --dry-run
 *   npm run import:boxscore -- --file Importingboxscores/indonesia-training-trip/game-2026-08-16-sgp-dmn.json --stats-only --add-new-players
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const TOURNAMENT_ID = 'tournament-1786724699692';
const SGP_ID = 'team-1786634408294';
const DMN_ID = 'team-damon-ballers-2026';
const GAME_ID = 'game-2026-08-16-sgp-dmn';

const SGP = {
  tristan: 'player-1786634954834',
  louis: 'player-sunig-ntu-4',
  carl: 'player-sunig-ntu-22',
  akash: 'player-1786804530745',
  lavin: 'player-1786719502718',
  zach: 'player-1786719611267',
  shabbir: 'player-1786716960993',
  sinnan: 'player-1786719659064',
  jay: 'player-1786719720297',
  reuben: 'player-1781194731488',
  neel: 'player-1786719856546',
  kaining: 'player-1786719899898',
  john: 'player-1786720346120',
  minhan: 'player-1786719974252',
  gary: 'player-1786719993962',
  chengshan: 'player-sunig-ntu-8',
} as const;

function dmnPid(num: number, slug: string): string {
  return `player-dmn-2026-${String(num).padStart(2, '0')}-${slug}`;
}

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

const dmnPlayers = [
  { id: dmnPid(3, 'hafizh'), name: 'Muhamad Hafizh', number: 3, position: 'PG' },
  { id: dmnPid(5, 'teemo'), name: 'Teemo Tan', number: 5, position: 'SG' },
  { id: dmnPid(6, 'rehan'), name: 'Oktora Rehan', number: 6, position: 'SG' },
  { id: dmnPid(7, 'calvin'), name: 'Calvin Chrissler', number: 7, position: 'PG' },
  { id: dmnPid(9, 'fathur'), name: 'Fathur Rahman', number: 9, position: 'PG' },
  { id: dmnPid(10, 'azka'), name: 'Azka Nuafal', number: 10, position: 'SF' },
  { id: dmnPid(11, 'sulthan'), name: 'Sulthan M Fauzan', number: 11, position: 'SF' },
  { id: dmnPid(12, 'chandra'), name: 'Chandra Irawan', number: 12, position: 'SG' },
  { id: dmnPid(13, 'andrew'), name: 'Andrew Lensun', number: 13, position: 'PF' },
  { id: dmnPid(14, 'christiant'), name: 'Christiant Tuwaidan', number: 14, position: 'PF' },
  { id: dmnPid(15, 'rizky'), name: 'Rizky Ari Daffa', number: 15, position: 'C' },
  { id: dmnPid(16, 'adhitya'), name: 'Adhitya Saputra', number: 16, position: 'PF' },
];

const sgpStats = [
  stat(SGP.tristan, '09:57', [0, 3], [0, 0], [0, 0], 2, 0, 1, 1, 0, 0, 0, 0, -9, 0),
  stat(SGP.louis, '16:29', [0, 2], [0, 1], [0, 0], 0, 1, 1, 2, 1, 0, 2, 1, -4, 0),
  stat(SGP.carl, '10:16', [2, 5], [1, 1], [2, 2], 0, 1, 0, 0, 0, 0, 0, 1, -2, 7),
  stat(SGP.akash, '13:55', [3, 4], [1, 1], [0, 0], 2, 1, 1, 3, 1, 2, 5, 1, 7, 7),
  stat(SGP.lavin, '14:14', [0, 3], [0, 0], [0, 0], 0, 3, 1, 1, 0, 0, 5, 2, -16, 0),
  stat(SGP.zach, '19:56', [5, 11], [1, 5], [1, 2], 0, 3, 5, 2, 2, 0, 0, 1, 4, 12),
  stat(SGP.shabbir, '10:42', [1, 2], [0, 0], [1, 2], 0, 0, 1, 1, 0, 1, 1, 1, -17, 3),
  stat(SGP.sinnan, '04:37', [0, 0], [0, 0], [0, 0], 0, 3, 0, 1, 1, 0, 1, 0, -5, 0),
  stat(SGP.jay, '12:14', [1, 5], [0, 1], [0, 2], 2, 2, 2, 2, 2, 0, 1, 1, 4, 2),
  stat(SGP.reuben, '07:04', [0, 3], [0, 2], [0, 0], 0, 0, 1, 0, 0, 0, 0, 0, -7, 0),
  stat(SGP.neel, '12:10', [4, 9], [2, 4], [0, 0], 2, 4, 0, 0, 0, 1, 3, 0, -7, 10),
  stat(SGP.kaining, '06:56', [0, 1], [0, 0], [0, 0], 0, 0, 0, 1, 1, 0, 2, 0, -7, 0),
  stat(SGP.john, '13:20', [0, 0], [0, 0], [2, 4], 1, 2, 4, 2, 1, 0, 3, 2, -8, 2),
  stat(SGP.minhan, '13:56', [1, 3], [0, 0], [0, 0], 0, 4, 1, 1, 1, 0, 4, 0, 18, 2),
  stat(SGP.gary, '10:52', [0, 1], [0, 0], [2, 2], 2, 2, 0, 1, 2, 0, 1, 3, -21, 2),
  stat(SGP.chengshan, '23:22', [6, 12], [1, 1], [0, 0], 1, 3, 0, 1, 0, 0, 1, 3, 5, 13),
];

const dmnStats = [
  stat(dmnPid(3, 'hafizh'), '22:33', [1, 3], [0, 0], [2, 2], 0, 2, 4, 3, 0, 0, 3, 3, 15, 4),
  stat(dmnPid(5, 'teemo'), '18:08', [2, 8], [1, 3], [1, 5], 0, 4, 1, 2, 1, 0, 1, 4, -11, 6),
  stat(dmnPid(6, 'rehan'), '08:52', [2, 4], [2, 4], [0, 0], 0, 0, 0, 2, 1, 0, 2, 1, 11, 6),
  stat(dmnPid(7, 'calvin'), '15:45', [2, 3], [2, 3], [0, 0], 0, 2, 1, 1, 1, 0, 0, 0, -2, 6),
  stat(dmnPid(9, 'fathur'), '17:34', [2, 7], [1, 4], [2, 4], 0, 1, 5, 1, 3, 0, 1, 3, 24, 7),
  stat(dmnPid(10, 'azka'), '07:19', [0, 1], [0, 0], [0, 0], 0, 2, 0, 1, 0, 0, 0, 2, 2, 0),
  stat(dmnPid(11, 'sulthan'), '20:09', [3, 8], [3, 7], [3, 3], 3, 2, 1, 1, 1, 1, 2, 3, -13, 12),
  stat(dmnPid(12, 'chandra'), '20:34', [2, 3], [2, 2], [1, 2], 0, 2, 1, 1, 0, 0, 2, 1, 5, 7),
  stat(dmnPid(13, 'andrew'), '25:47', [6, 9], [1, 2], [4, 6], 3, 2, 7, 1, 1, 0, 0, 3, 32, 17),
  stat(dmnPid(14, 'christiant'), '11:10', [0, 1], [0, 0], [0, 0], 0, 1, 1, 1, 2, 0, 1, 1, -1, 0),
  stat(dmnPid(15, 'rizky'), '18:11', [2, 3], [0, 0], [1, 4], 1, 2, 0, 1, 1, 1, 4, 3, 0, 5),
  stat(dmnPid(16, 'adhitya'), '13:58', [1, 4], [1, 3], [0, 4], 1, 3, 0, 4, 0, 2, 0, 5, 3, 3),
];

function sum<K extends string>(rows: Array<Record<K, number>>, key: K): number {
  return rows.reduce((s, r) => s + r[key], 0);
}

function assertTotals(): void {
  const sgpMin = Math.round(sum(sgpStats, 'minutes_played') * 60);
  const dmnMin = Math.round(sum(dmnStats, 'minutes_played') * 60);
  if (sgpMin !== 12000) throw new Error(`SGP minutes ${sgpMin}s !== 200:00`);
  if (dmnMin !== 12000) throw new Error(`DMN minutes ${dmnMin}s !== 200:00`);
  if (sum(sgpStats, 'points') !== 60) throw new Error(`SGP PTS ${sum(sgpStats, 'points')}`);
  if (sum(dmnStats, 'points') !== 73) throw new Error(`DMN PTS ${sum(dmnStats, 'points')}`);
  if (sum(sgpStats, 'fg_made') !== 23 || sum(sgpStats, 'fg_attempted') !== 64) {
    throw new Error(`SGP FG ${sum(sgpStats, 'fg_made')}/${sum(sgpStats, 'fg_attempted')}`);
  }
  if (sum(dmnStats, 'fg_made') !== 23 || sum(dmnStats, 'fg_attempted') !== 54) {
    throw new Error(`DMN FG ${sum(dmnStats, 'fg_made')}/${sum(dmnStats, 'fg_attempted')}`);
  }
  if (sum(sgpStats, 'three_made') !== 6 || sum(sgpStats, 'three_attempted') !== 16) {
    throw new Error('SGP 3P');
  }
  if (sum(dmnStats, 'three_made') !== 13 || sum(dmnStats, 'three_attempted') !== 28) {
    throw new Error('DMN 3P');
  }
  if (sum(sgpStats, 'ft_made') !== 8 || sum(sgpStats, 'ft_attempted') !== 14) {
    throw new Error('SGP FT');
  }
  if (sum(dmnStats, 'ft_made') !== 14 || sum(dmnStats, 'ft_attempted') !== 30) {
    throw new Error('DMN FT');
  }
  if (sum(sgpStats, 'assists') !== 18) throw new Error(`SGP AST ${sum(sgpStats, 'assists')}`);
  if (sum(dmnStats, 'assists') !== 21) throw new Error(`DMN AST ${sum(dmnStats, 'assists')}`);
  if (sum(sgpStats, 'orb') !== 12) throw new Error(`SGP ORB ${sum(sgpStats, 'orb')}`);
  if (sum(dmnStats, 'orb') !== 8) throw new Error(`DMN ORB ${sum(dmnStats, 'orb')}`);
  if (sum(sgpStats, 'steals') !== 12) throw new Error(`SGP ST ${sum(sgpStats, 'steals')}`);
  if (sum(sgpStats, 'blocks') !== 4) throw new Error(`SGP BLK ${sum(sgpStats, 'blocks')}`);
  if (sum(sgpStats, 'fouls') !== 29) throw new Error(`SGP PF ${sum(sgpStats, 'fouls')}`);
  if (sum(dmnStats, 'steals') !== 11) throw new Error(`DMN ST ${sum(dmnStats, 'steals')}`);
  if (sum(dmnStats, 'blocks') !== 4) throw new Error(`DMN BLK ${sum(dmnStats, 'blocks')}`);
  if (sum(dmnStats, 'fouls') !== 16) throw new Error(`DMN PF ${sum(dmnStats, 'fouls')}`);
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
    pto: number | null;
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
    name: 'Indonesia Training Trip',
    year: 2026,
    month: 'Aug',
    teamIds: [SGP_ID, DMN_ID],
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
      id: DMN_ID,
      name: 'Damon Ballers',
      abbreviation: 'DMN',
      currentTournamentId: TOURNAMENT_ID,
      players: dmnPlayers,
    },
  ],
  game: {
    id: GAME_ID,
    homeTeamId: SGP_ID,
    awayTeamId: DMN_ID,
    tournamentId: TOURNAMENT_ID,
    date: '2026-08-16',
    startTime: '10:00',
    currentPeriod: 4,
    currentGameTime: '00:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 60, away: 73 },
    homeStarters: [SGP.akash, SGP.zach, SGP.jay, SGP.minhan, SGP.chengshan],
    awayStarters: [
      dmnPid(5, 'teemo'),
      dmnPid(7, 'calvin'),
      dmnPid(11, 'sulthan'),
      dmnPid(14, 'christiant'),
      dmnPid(15, 'rizky'),
    ],
    gameStats: [...sgpStats, ...dmnStats],
    teamStats: {
      home: teamStats(SGP_ID, [22, 12, 19, 7], {
        fg: [23, 64],
        three: [6, 16],
        ft: [8, 14],
        orb: 12,
        drb: 29,
        teamOrb: 3,
        teamDrb: 0,
        teamTo: 3,
        teamFouls: 0,
        assists: 18,
        steals: 12,
        blocks: 4,
        turnovers: sum(sgpStats, 'turnovers') + 3,
        fouls: 29,
        pitp: 26,
        second: 9,
        fb: 17,
        bench: 24,
        lead: 14,
        run: 14,
        pto: 15,
      }),
      away: teamStats(DMN_ID, [18, 10, 18, 27], {
        fg: [23, 54],
        three: [13, 28],
        ft: [14, 30],
        orb: 8,
        drb: 23,
        teamOrb: 2,
        teamDrb: 4,
        teamTo: 0,
        teamFouls: 0,
        assists: 21,
        steals: 11,
        blocks: 4,
        turnovers: sum(dmnStats, 'turnovers'),
        fouls: 16,
        pitp: 20,
        second: 14,
        fb: 13,
        bench: 44,
        lead: 13,
        run: 8,
        pto: 20,
      }),
    },
    shots: [],
    events: [],
    lineupStints: [],
  },
};

const out = resolve(
  process.cwd(),
  'Importingboxscores/indonesia-training-trip/game-2026-08-16-sgp-dmn.json'
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
console.log('Wrote', out);
console.log('DMN', dmnPlayers.length, 'new players;', dmnStats.length, 'stat rows');
console.log('SGP', sgpStats.length, 'stat rows (existing IDs; Reuben included; John club # unchanged)');
console.log(
  'SGP AST/TO/ST/BLK/PF',
  sum(sgpStats, 'assists'),
  sum(sgpStats, 'turnovers'),
  sum(sgpStats, 'steals'),
  sum(sgpStats, 'blocks'),
  sum(sgpStats, 'fouls')
);
console.log(
  'DMN AST/TO/ST/BLK/PF',
  sum(dmnStats, 'assists'),
  sum(dmnStats, 'turnovers'),
  sum(dmnStats, 'steals'),
  sum(dmnStats, 'blocks'),
  sum(dmnStats, 'fouls')
);
