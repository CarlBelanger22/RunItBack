/**
 * Indonesia Training Trip — Game 3 INA vs SGP (Dewa United Arena, 2026-08-15).
 *
 *   npx tsx scripts/build-ina-sgp-training-trip-game3-import.ts
 *   npm run import:boxscore -- --file Importingboxscores/indonesia-training-trip/game-2026-08-15-ina-sgp.json --stats-only --add-new-players --dry-run
 *   npm run import:boxscore -- --file Importingboxscores/indonesia-training-trip/game-2026-08-15-ina-sgp.json --stats-only --add-new-players
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const TOURNAMENT_ID = 'tournament-1786724699692';
const SGP_ID = 'team-1786634408294';
const INA_ID = 'team-ina-mens-nt-2026';
const GAME_ID = 'game-2026-08-15-ina-sgp';
const YONGA = 'player-asg19-indonesia-hendrix-xavi-yonga';
const KELVIN = 'player-ina-nt-2026-22-sanjaya';

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

function pid(num: number, slug: string): string {
  return `player-ina-nt-2026-${String(num).padStart(2, '0')}-${slug}`;
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

const inaNewPlayers = [
  { id: pid(4, 'grahita'), name: 'Abraham Damar Grahita', number: 4, position: 'SG' },
  { id: pid(7, 'prastawa'), name: 'Andakara Prastawa', number: 7, position: 'PG' },
  { id: pid(15, 'kosasih'), name: 'Vincent Kosasih', number: 15, position: 'C' },
  { id: pid(25, 'prosper'), name: 'Lester Prosper', number: 25, position: 'C' },
];

/** Existing roster rows included so --add-new-players can attach new IDs; Kelvin #23. */
const inaPlayers = [
  { id: pid(3, 'beane'), name: 'Anthony Beane', number: 3, position: 'SG' },
  ...inaNewPlayers,
  { id: pid(8, 'saputera'), name: 'Yudha Saputera', number: 8, position: 'PG' },
  { id: pid(10, 'disi'), name: 'Rio Disi', number: 10, position: 'SG' },
  { id: pid(11, 'wiguna'), name: 'Pandu Wiguna', number: 11, position: 'PF' },
  { id: pid(12, 'diagne'), name: 'Dame Diagne', number: 12, position: 'C' },
  { id: pid(13, 'bagir'), name: 'Ali Bagir', number: 13, position: 'SF' },
  { id: pid(17, 'firdhan'), name: 'Firdhan Guntara', number: 17, position: 'PF' },
  { id: pid(18, 'erga'), name: 'Antoni Erga', number: 18, position: 'PG' },
  { id: pid(19, 'reza'), name: 'Reza Guntara', number: 19, position: 'SF' },
  { id: YONGA, name: 'Hendrick Xavi Yonga', number: 21, position: 'PG' },
  { id: KELVIN, name: 'Kelvin Sanjaya', number: 23, position: 'C' },
];

// FG/3P/FT/PTS locked to team totals. Rebounds: player ORB 12; player DRB 28 + team DRB 3 = 31.
const inaStats = [
  stat(pid(3, 'beane'), '15:14', [4, 5], [2, 3], [2, 2], 0, 1, 1, 2, 1, 0, 0, 2, 10, 12),
  stat(pid(4, 'grahita'), '19:26', [4, 11], [1, 7], [0, 0], 3, 1, 4, 2, 0, 0, 3, 0, 17, 9),
  stat(pid(7, 'prastawa'), '15:04', [2, 5], [2, 4], [2, 2], 0, 1, 3, 1, 0, 0, 1, 1, 26, 8),
  stat(pid(8, 'saputera'), '17:35', [1, 3], [0, 1], [1, 2], 0, 2, 5, 1, 2, 0, 0, 1, 22, 3),
  stat(pid(10, 'disi'), '10:08', [1, 1], [1, 1], [0, 0], 0, 1, 3, 1, 1, 0, 0, 0, 9, 3),
  stat(pid(11, 'wiguna'), '16:08', [2, 2], [0, 0], [2, 3], 0, 1, 1, 2, 1, 0, 1, 2, 19, 6),
  stat(pid(12, 'diagne'), '20:18', [1, 3], [0, 1], [1, 2], 1, 4, 0, 1, 1, 0, 1, 2, 17, 3),
  stat(pid(13, 'bagir'), '13:00', [4, 7], [3, 5], [3, 4], 0, 3, 0, 0, 0, 1, 0, 2, 24, 14),
  stat(pid(15, 'kosasih'), '14:06', [2, 5], [1, 3], [4, 5], 2, 6, 1, 0, 1, 0, 1, 3, 10, 9),
  stat(pid(17, 'firdhan'), '09:35', [0, 0], [0, 0], [0, 0], 1, 2, 0, 0, 0, 0, 1, 0, 23, 0),
  stat(pid(18, 'erga'), '10:55', [0, 0], [0, 0], [0, 0], 2, 0, 2, 2, 1, 1, 0, 0, 2, 0),
  stat(pid(19, 'reza'), '13:36', [0, 0], [0, 0], [0, 2], 0, 2, 2, 1, 1, 1, 1, 2, 29, 0),
  stat(YONGA, '09:03', [2, 6], [0, 2], [1, 2], 2, 0, 1, 1, 2, 2, 0, 1, -1, 5),
  stat(KELVIN, '04:22', [0, 1], [0, 0], [0, 0], 0, 0, 0, 1, 0, 0, 3, 0, -2, 0),
  stat(pid(25, 'prosper'), '11:30', [5, 7], [1, 1], [6, 7], 1, 2, 0, 2, 2, 0, 0, 5, 16, 17),
];

// Helzer 11 PTS (5 FG / 1 3P, 0 FT) so team PTS=45 and FT=2/8 (Shabbir+John+Tristan).
const sgpStats = [
  stat(SGP.jay, '21:53', [4, 8], [1, 2], [0, 0], 0, 3, 1, 1, 1, 0, 2, 0, -25, 9),
  stat(SGP.louis, '11:17', [1, 1], [0, 0], [0, 0], 0, 0, 1, 5, 0, 0, 2, 0, -10, 2),
  stat(SGP.carl, '13:44', [1, 1], [0, 0], [0, 0], 0, 2, 0, 2, 0, 0, 3, 2, -18, 2),
  stat(SGP.akash, '14:51', [3, 4], [1, 1], [0, 0], 0, 0, 0, 0, 0, 0, 1, 2, -10, 7),
  stat(SGP.lavin, '12:53', [0, 1], [0, 0], [0, 0], 0, 0, 1, 0, 0, 0, 4, 0, -17, 0),
  stat(SGP.zach, '20:46', [5, 14], [1, 10], [0, 0], 2, 3, 6, 2, 2, 0, 0, 2, -16, 11),
  stat(SGP.shabbir, '09:12', [0, 3], [0, 2], [1, 2], 0, 1, 0, 1, 0, 0, 1, 1, -17, 1),
  stat(SGP.sinnan, '05:59', [2, 2], [0, 0], [0, 0], 0, 0, 0, 0, 0, 0, 3, 0, -5, 4),
  stat(SGP.reuben, '07:23', [0, 1], [0, 1], [0, 0], 0, 0, 0, 0, 0, 0, 0, 0, -8, 0),
  stat(SGP.neel, '10:19', [0, 2], [0, 0], [0, 0], 0, 2, 1, 3, 1, 0, 2, 1, -17, 0),
  stat(SGP.kaining, '07:59', [0, 1], [0, 0], [0, 0], 0, 0, 1, 0, 1, 0, 1, 0, -9, 0),
  stat(SGP.minhan, '15:31', [1, 5], [0, 1], [0, 0], 1, 1, 0, 4, 2, 0, 4, 0, -16, 2),
  stat(SGP.gary, '09:35', [0, 1], [0, 0], [0, 0], 1, 2, 0, 0, 0, 0, 1, 0, -4, 0),
  stat(SGP.chengshan, '19:40', [2, 6], [0, 1], [0, 0], 0, 1, 0, 0, 0, 2, 0, 2, -17, 4),
  stat(SGP.tristan, '06:07', [1, 2], [0, 0], [0, 2], 2, 1, 0, 0, 1, 0, 3, 1, -12, 2),
  stat(SGP.john, '12:51', [0, 5], [0, 1], [1, 4], 1, 2, 1, 1, 2, 0, 0, 2, -19, 1),
];

function sum<K extends string>(rows: Array<Record<K, number>>, key: K): number {
  return rows.reduce((s, r) => s + r[key], 0);
}

function assertTotals(): void {
  const inaMin = Math.round(sum(inaStats, 'minutes_played') * 60);
  const sgpMin = Math.round(sum(sgpStats, 'minutes_played') * 60);
  if (inaMin !== 12000) throw new Error(`INA minutes ${inaMin}s !== 200:00`);
  if (sgpMin !== 12000) throw new Error(`SGP minutes ${sgpMin}s !== 200:00`);
  if (sum(inaStats, 'points') !== 89) throw new Error(`INA PTS ${sum(inaStats, 'points')}`);
  if (sum(sgpStats, 'points') !== 45) throw new Error(`SGP PTS ${sum(sgpStats, 'points')}`);
  if (sum(inaStats, 'fg_made') !== 28 || sum(inaStats, 'fg_attempted') !== 56) {
    throw new Error(`INA FG ${sum(inaStats, 'fg_made')}/${sum(inaStats, 'fg_attempted')}`);
  }
  if (sum(sgpStats, 'fg_made') !== 20 || sum(sgpStats, 'fg_attempted') !== 57) {
    throw new Error(`SGP FG ${sum(sgpStats, 'fg_made')}/${sum(sgpStats, 'fg_attempted')}`);
  }
  if (sum(inaStats, 'three_made') !== 11 || sum(inaStats, 'three_attempted') !== 28) {
    throw new Error('INA 3P');
  }
  if (sum(sgpStats, 'three_made') !== 3 || sum(sgpStats, 'three_attempted') !== 19) {
    throw new Error(
      `SGP 3P ${sum(sgpStats, 'three_made')}/${sum(sgpStats, 'three_attempted')}`
    );
  }
  if (sum(inaStats, 'ft_made') !== 22 || sum(inaStats, 'ft_attempted') !== 31) {
    throw new Error('INA FT');
  }
  if (sum(sgpStats, 'ft_made') !== 2 || sum(sgpStats, 'ft_attempted') !== 8) {
    throw new Error(`SGP FT ${sum(sgpStats, 'ft_made')}/${sum(sgpStats, 'ft_attempted')}`);
  }
  if (sum(inaStats, 'assists') !== 23) throw new Error(`INA AST ${sum(inaStats, 'assists')}`);
  if (sum(sgpStats, 'assists') !== 12) throw new Error(`SGP AST ${sum(sgpStats, 'assists')}`);
  if (sum(inaStats, 'orb') !== 12) throw new Error(`INA ORB ${sum(inaStats, 'orb')}`);
  // Sheet ORB total 8 includes team/coach; players sum to 7 after John 1/2/3 fix.
  if (sum(sgpStats, 'orb') !== 7) throw new Error(`SGP player ORB ${sum(sgpStats, 'orb')}`);
  if (sum(inaStats, 'turnovers') !== 17) throw new Error(`INA TO ${sum(inaStats, 'turnovers')}`);
  if (sum(inaStats, 'blocks') !== 5) throw new Error(`INA BLK ${sum(inaStats, 'blocks')}`);
  if (sum(sgpStats, 'steals') !== 10) throw new Error(`SGP ST ${sum(sgpStats, 'steals')}`);
  if (sum(sgpStats, 'fouls') !== 27) throw new Error(`SGP PF ${sum(sgpStats, 'fouls')}`);
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

const inaPlayerDrb = sum(inaStats, 'drb');
const inaPlayerOrb = sum(inaStats, 'orb');
const inaTeamDrb = 31 - inaPlayerDrb;
const sgpPlayerDrb = sum(sgpStats, 'drb');
const sgpPlayerOrb = sum(sgpStats, 'orb');
const sgpTeamDrb = Math.max(0, 19 - sgpPlayerDrb);
const sgpTeamOrb = Math.max(0, 8 - sgpPlayerOrb);

const bundle = {
  version: '1',
  tournament: {
    id: TOURNAMENT_ID,
    name: 'Indonesia Training Trip',
    year: 2026,
    month: 'Aug',
    teamIds: [SGP_ID, INA_ID],
  },
  teams: [
    {
      id: INA_ID,
      name: 'Indonesia',
      abbreviation: 'INA',
      description: 'Indonesia Mens National Team 2026',
      currentTournamentId: TOURNAMENT_ID,
      players: inaPlayers,
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
    date: '2026-08-15',
    startTime: '12:00',
    currentPeriod: 4,
    currentGameTime: '00:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 89, away: 45 },
    homeStarters: [
      pid(3, 'beane'),
      pid(8, 'saputera'),
      pid(11, 'wiguna'),
      pid(12, 'diagne'),
      pid(13, 'bagir'),
    ],
    awayStarters: [SGP.jay, SGP.lavin, SGP.zach, SGP.neel, SGP.john],
    gameStats: [...inaStats, ...sgpStats],
    teamStats: {
      home: teamStats(INA_ID, [34, 9, 17, 29], {
        fg: [28, 56],
        three: [11, 28],
        ft: [22, 31],
        orb: inaPlayerOrb,
        drb: inaPlayerDrb,
        teamOrb: 0,
        teamDrb: inaTeamDrb,
        teamTo: Math.max(0, 17 - sum(inaStats, 'turnovers')),
        teamFouls: 0,
        assists: 23,
        steals: sum(inaStats, 'steals'),
        blocks: sum(inaStats, 'blocks'),
        turnovers: sum(inaStats, 'turnovers'),
        fouls: sum(inaStats, 'fouls'),
        pitp: 32,
        second: 7,
        fb: 14,
        bench: 51,
        lead: 46,
        run: 14,
        pto: 30,
      }),
      away: teamStats(SGP_ID, [8, 15, 13, 9], {
        fg: [20, 57],
        three: [3, 19],
        ft: [2, 8],
        orb: sgpPlayerOrb,
        drb: sgpPlayerDrb,
        teamOrb: sgpTeamOrb,
        teamDrb: sgpTeamDrb,
        teamTo: Math.max(0, 20 - sum(sgpStats, 'turnovers')),
        teamFouls: 0,
        assists: 12,
        steals: sum(sgpStats, 'steals'),
        blocks: sum(sgpStats, 'blocks'),
        turnovers: sum(sgpStats, 'turnovers'),
        fouls: sum(sgpStats, 'fouls'),
        pitp: 28,
        second: 2,
        fb: 10,
        bench: 19,
        lead: 0,
        run: 6,
        pto: 11,
      }),
    },
    shots: [],
    events: [],
    lineupStints: [],
  },
};

const out = resolve(
  process.cwd(),
  'Importingboxscores/indonesia-training-trip/game-2026-08-15-ina-sgp.json'
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
console.log('Wrote', out);
console.log('INA', inaPlayers.length, 'roster rows;', inaStats.length, 'stat rows; new', inaNewPlayers.length);
console.log('SGP', sgpStats.length, 'stat rows (Reuben included)');
console.log('INA DRB players', inaPlayerDrb, '+ team', inaTeamDrb, '= 31');
console.log('SGP ORB/DRB players', sgpPlayerOrb, sgpPlayerDrb, 'team', sgpTeamOrb, sgpTeamDrb);
console.log(
  'INA AST/TO/ST/BLK/PF',
  sum(inaStats, 'assists'),
  sum(inaStats, 'turnovers'),
  sum(inaStats, 'steals'),
  sum(inaStats, 'blocks'),
  sum(inaStats, 'fouls')
);
console.log(
  'SGP AST/TO/ST/BLK/PF',
  sum(sgpStats, 'assists'),
  sum(sgpStats, 'turnovers'),
  sum(sgpStats, 'steals'),
  sum(sgpStats, 'blocks'),
  sum(sgpStats, 'fouls')
);
