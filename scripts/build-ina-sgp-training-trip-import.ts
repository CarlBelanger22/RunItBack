/**
 * Indonesia Training Trip — INA NT vs SGP NT scrimmage (Dewa United Arena, 2026-08-14).
 *
 *   npx tsx scripts/build-ina-sgp-training-trip-import.ts
 *   npm run import:boxscore -- --file Importingboxscores/indonesia-training-trip/game-2026-08-14-ina-sgp.json --stats-only --add-new-players --dry-run
 *   npm run import:boxscore -- --file Importingboxscores/indonesia-training-trip/game-2026-08-14-ina-sgp.json --stats-only --add-new-players
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const TOURNAMENT_ID = 'tournament-1786724699692';
const SGP_ID = 'team-1786634408294';
const INA_ID = 'team-ina-mens-nt-2026';
const GAME_ID = 'game-2026-08-14-ina-sgp';
/** Existing ASG 2019 Indonesia player — do not mint a second identity. */
const YONGA = 'player-asg19-indonesia-hendrix-xavi-yonga';

const SGP = {
  tristan: 'player-1786634954834',
  louis: 'player-sunig-ntu-4',
  carl: 'player-sunig-ntu-22',
  lavin: 'player-1786719502718',
  zach: 'player-1786719611267',
  shabbir: 'player-1786716960993',
  sinnan: 'player-1786719659064',
  jay: 'player-1786719720297',
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

const inaPlayers = [
  { id: pid(2, 'wenas'), name: 'Abraham Wenas', number: 2, position: 'PG' },
  { id: pid(3, 'beane'), name: 'Anthony Beane', number: 3, position: 'SG' },
  { id: pid(5, 'daffa'), name: 'Daffa Dhoifullah', number: 5, position: 'SG' },
  { id: pid(8, 'saputera'), name: 'Yudha Saputera', number: 8, position: 'PG' },
  { id: pid(9, 'newell'), name: 'Jayden Newell', number: 9, position: 'SF' },
  { id: pid(10, 'disi'), name: 'Rio Disi', number: 10, position: 'SG' },
  { id: pid(11, 'wiguna'), name: 'Pandu Wiguna', number: 11, position: 'PF' },
  { id: pid(12, 'diagne'), name: 'Dame Diagne', number: 12, position: 'C' },
  { id: pid(13, 'bagir'), name: 'Ali Bagir', number: 13, position: 'SF' },
  { id: pid(14, 'sanyudy'), name: 'Argus Sanyudy', number: 14, position: 'PF' },
  { id: pid(17, 'firdhan'), name: 'Firdhan Guntara', number: 17, position: 'PF' },
  { id: pid(18, 'erga'), name: 'Antoni Erga', number: 18, position: 'PG' },
  { id: pid(19, 'reza'), name: 'Reza Guntara', number: 19, position: 'SF' },
  { id: YONGA, name: 'Hendrick Xavi Yonga', number: 21, position: 'PG' },
  { id: pid(22, 'sanjaya'), name: 'Kelvin Sanjaya', number: 22, position: 'C' },
  { id: pid(23, 'saputra'), name: 'Patrick Nikolas Saputra', number: 23, position: 'PF' },
];

const inaStats = [
  stat(pid(2, 'wenas'), '13:12', [0, 2], [0, 0], [5, 6], 0, 0, 3, 0, 2, 0, 1, 3, 22, 5),
  stat(pid(3, 'beane'), '18:34', [5, 9], [1, 3], [0, 0], 0, 1, 5, 2, 2, 0, 1, 1, 20, 11),
  stat(pid(5, 'daffa'), '11:54', [4, 7], [2, 4], [2, 3], 0, 2, 0, 1, 1, 0, 0, 2, 17, 12),
  stat(pid(8, 'saputera'), '15:12', [5, 6], [3, 3], [0, 0], 0, 1, 4, 0, 0, 0, 0, 0, 31, 13),
  stat(pid(9, 'newell'), '4:05', [1, 3], [0, 2], [0, 0], 1, 0, 0, 0, 0, 0, 0, 1, 1, 2),
  stat(pid(10, 'disi'), '9:32', [2, 4], [2, 4], [0, 0], 0, 0, 1, 1, 1, 0, 0, 1, 11, 6),
  stat(pid(11, 'wiguna'), '14:44', [2, 3], [0, 0], [1, 2], 2, 5, 2, 0, 1, 1, 0, 1, 34, 5),
  stat(pid(12, 'diagne'), '14:20', [3, 5], [0, 0], [0, 1], 1, 6, 0, 0, 1, 0, 1, 1, 14, 6),
  stat(pid(13, 'bagir'), '15:01', [1, 4], [1, 3], [0, 0], 1, 3, 2, 4, 1, 0, 1, 0, 14, 3),
  stat(pid(14, 'sanyudy'), '11:46', [1, 1], [0, 0], [0, 1], 1, 2, 0, 2, 1, 1, 3, 1, 8, 2),
  stat(pid(17, 'firdhan'), '10:27', [0, 0], [0, 0], [2, 3], 3, 3, 2, 0, 0, 0, 2, 1, 19, 2),
  stat(pid(18, 'erga'), '11:03', [1, 3], [1, 2], [0, 0], 0, 0, 3, 2, 1, 0, 4, 0, -5, 3),
  stat(pid(19, 'reza'), '10:19', [3, 4], [1, 2], [1, 1], 0, 3, 0, 2, 1, 0, 2, 1, 11, 8),
  stat(YONGA, '11:01', [2, 5], [0, 1], [0, 0], 0, 3, 1, 3, 3, 0, 0, 0, 14, 4),
  stat(pid(22, 'sanjaya'), '13:30', [2, 3], [0, 0], [1, 1], 2, 1, 0, 0, 0, 0, 0, 1, 6, 5),
  stat(pid(23, 'saputra'), '15:20', [2, 3], [0, 0], [0, 0], 1, 2, 3, 1, 2, 0, 1, 1, 23, 4),
];

const sgpStats = [
  stat(SGP.louis, '10:37', [0, 1], [0, 1], [2, 4], 1, 0, 1, 0, 0, 0, 1, 3, -17, 2),
  stat(SGP.tristan, '8:47', [1, 2], [0, 1], [0, 0], 0, 1, 1, 0, 1, 0, 1, 0, -4, 2),
  stat(SGP.carl, '18:05', [0, 4], [0, 0], [0, 0], 0, 1, 1, 1, 0, 0, 1, 0, -26, 0),
  stat(SGP.lavin, '13:55', [0, 1], [0, 0], [0, 0], 0, 2, 0, 0, 0, 0, 1, 0, -24, 0),
  stat(SGP.zach, '19:49', [4, 19], [3, 11], [0, 2], 4, 1, 2, 3, 1, 0, 0, 3, -21, 11),
  stat(SGP.shabbir, '10:22', [1, 4], [0, 1], [0, 0], 0, 1, 1, 3, 1, 0, 1, 1, -10, 2),
  stat(SGP.sinnan, '7:26', [0, 1], [0, 1], [0, 0], 0, 0, 0, 0, 1, 0, 2, 0, -10, 0),
  stat(SGP.jay, '22:30', [1, 8], [0, 6], [0, 0], 1, 3, 3, 4, 2, 0, 1, 1, -21, 2),
  stat(SGP.neel, '13:27', [2, 8], [1, 1], [2, 4], 2, 3, 0, 0, 1, 1, 2, 2, -12, 7),
  stat(SGP.kaining, '10:09', [0, 2], [0, 1], [0, 0], 0, 0, 0, 0, 0, 0, 0, 1, -14, 0),
  stat(SGP.john, '16:58', [0, 0], [0, 0], [0, 0], 0, 1, 1, 4, 2, 0, 1, 1, -33, 0),
  stat(SGP.minhan, '22:08', [3, 5], [1, 2], [0, 0], 2, 2, 1, 2, 0, 0, 3, 0, -26, 7),
  stat(SGP.gary, '9:14', [0, 1], [0, 0], [0, 0], 1, 1, 2, 0, 1, 0, 0, 2, -5, 0),
  stat(SGP.chengshan, '16:33', [5, 9], [0, 1], [0, 0], 1, 0, 1, 4, 0, 0, 1, 2, -17, 10),
];

function sum<K extends string>(rows: Array<Record<K, number>>, key: K): number {
  return rows.reduce((s, r) => s + r[key], 0);
}

function assertTotals(): void {
  const inaMin = Math.round(sum(inaStats, 'minutes_played') * 60);
  const sgpMin = Math.round(sum(sgpStats, 'minutes_played') * 60);
  if (inaMin !== 12000) throw new Error(`INA minutes ${inaMin}s !== 200:00`);
  if (sgpMin !== 12000) throw new Error(`SGP minutes ${sgpMin}s !== 200:00`);
  if (sum(inaStats, 'points') !== 91) throw new Error('INA PTS');
  if (sum(sgpStats, 'points') !== 43) throw new Error('SGP PTS');
  if (sum(inaStats, 'fg_made') !== 34 || sum(inaStats, 'fg_attempted') !== 62) {
    throw new Error('INA FG');
  }
  if (sum(sgpStats, 'fg_made') !== 17 || sum(sgpStats, 'fg_attempted') !== 65) {
    throw new Error('SGP FG');
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
    date: '2026-08-14',
    startTime: '13:45',
    currentPeriod: 4,
    currentGameTime: '00:00',
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 91, away: 43 },
    homeStarters: [
      pid(3, 'beane'),
      pid(8, 'saputera'),
      pid(11, 'wiguna'),
      pid(12, 'diagne'),
      pid(13, 'bagir'),
    ],
    awayStarters: [SGP.jay, SGP.minhan, SGP.zach, SGP.lavin, SGP.john],
    gameStats: [...inaStats, ...sgpStats],
    teamStats: {
      home: teamStats(INA_ID, [19, 31, 19, 22], {
        fg: [34, 62],
        three: [11, 24],
        ft: [12, 18],
        orb: 12,
        drb: 32,
        teamOrb: 0,
        teamDrb: 1,
        teamTo: 2,
        teamFouls: 0,
        assists: 26,
        steals: 17,
        blocks: 2,
        turnovers: 20,
        fouls: 16,
        pitp: 44,
        second: 7,
        fb: 18,
        bench: 53,
        lead: 48,
        run: 12,
        pto: 28,
      }),
      away: teamStats(SGP_ID, [10, 14, 6, 13], {
        fg: [17, 65],
        three: [5, 26],
        ft: [4, 10],
        orb: 12,
        drb: 16,
        teamOrb: 4,
        teamDrb: 2,
        teamTo: 2,
        teamFouls: 0,
        assists: 14,
        steals: 10,
        blocks: 1,
        turnovers: 23,
        fouls: 14,
        pitp: 12,
        second: 8,
        fb: 7,
        bench: 23,
        lead: 0,
        run: 5,
        pto: 9,
      }),
    },
    shots: [],
    events: [],
    lineupStints: [],
  },
};

const out = resolve(
  process.cwd(),
  'Importingboxscores/indonesia-training-trip/game-2026-08-14-ina-sgp.json'
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
console.log('Wrote', out);
console.log('INA', inaPlayers.length, 'players;', inaStats.length, 'stat rows');
console.log('SGP', sgpStats.length, 'stat rows (Reuben DNP omitted)');
