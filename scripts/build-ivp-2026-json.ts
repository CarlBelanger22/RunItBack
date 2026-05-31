/**
 * Generate IVP 2026 box score JSON files from structured PDF data.
 * Run: npx tsx scripts/build-ivp-2026-json.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const TOURNAMENT = {
  id: 'tournament-1768327829049',
  name: 'IVP 2026',
  year: 2026,
  month: 'Jan',
  description: 'Institute-Polytechnic-Varsity Games',
  teamIds: [
    'team-sunig-ntu',
    'team-sunig-suss',
    'team-sunig-nus',
    'team-ivp-np',
    'team-ivp-ite',
    'team-ivp-sim',
  ],
};

const NTU = {
  id: 'team-sunig-ntu',
  name: 'Nanyang Technological University',
  abbreviation: 'NTU',
};

const NEW_PLAYERS = [
  { id: 'player-ivp-ntu-11', name: 'Glen Yeo', number: 11, position: 'PF', secondaryPosition: 'C' },
  { id: 'player-ivp-ntu-12', name: 'Haniel Muze', number: 12, position: 'SF', secondaryPosition: 'PF' },
  {
    id: 'player-ivp-ntu-23',
    name: 'Lucas Hoo',
    number: 23,
    position: 'SG',
    secondaryPosition: 'SF',
    height: '185',
    weight: '80',
    dateOfBirth: '2004-02-03',
  },
];

const OPPONENTS: Record<string, { id: string; name: string; abbreviation: string }> = {
  np: { id: 'team-ivp-np', name: 'Ngee Ann Polytechnic', abbreviation: 'NP' },
  suss: { id: 'team-sunig-suss', name: 'Singapore University of Social Sciences', abbreviation: 'SUSS' },
  ite: { id: 'team-ivp-ite', name: 'Institute of Technical Education', abbreviation: 'ITE' },
  sim: { id: 'team-ivp-sim', name: 'Singapore Institute of Management', abbreviation: 'SIM' },
};

const PID: Record<number, string> = {
  0: 'player-sunig-ntu-0',
  1: 'player-sunig-ntu-1',
  4: 'player-sunig-ntu-4',
  6: 'player-sunig-ntu-6',
  8: 'player-sunig-ntu-8',
  10: 'player-sunig-ntu-10',
  11: 'player-ivp-ntu-11',
  12: 'player-ivp-ntu-12',
  14: 'player-sunig-ntu-14',
  15: 'player-sunig-ntu-15',
  20: 'player-sunig-ntu-20',
  21: 'player-sunig-ntu-21',
  22: 'player-sunig-ntu-22',
  23: 'player-ivp-ntu-23',
  45: 'player-sunig-ntu-45',
};

function parseMin(min: string): number {
  if (min.includes(':')) {
    const [m, s] = min.split(':').map(Number);
    return m + s / 60;
  }
  return Number(min);
}

function parseMA(value: string): [number, number] {
  if (!value || value === '-') return [0, 0];
  const [a, b] = value.split('-').map(Number);
  return [a ?? 0, b ?? 0];
}

type RawLine = [
  number,
  string,
  number,
  string,
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

function line(
  num: number,
  min: string,
  pts: number,
  fg: string,
  three: string,
  ft: string,
  reb: number,
  drb: number,
  orb: number,
  ast: number,
  blk: number,
  stl: number,
  to: number,
  fls: number,
  fd: number,
  pm: number
): RawLine {
  return [num, min, pts, fg, three, ft, reb, drb, orb, ast, blk, stl, to, fls, fd, pm];
}

function toStat(raw: RawLine) {
  const [num, min, pts, fg, three, ft, reb, drb, orb, ast, blk, stl, to, fls, fd, pm] = raw;
  const [fgm, fga] = parseMA(fg);
  const [tpm, tpa] = parseMA(three);
  const [ftm, fta] = parseMA(ft);
  return {
    playerId: PID[num],
    points: pts,
    fg_made: fgm,
    fg_attempted: fga,
    three_made: tpm,
    three_attempted: tpa,
    ft_made: ftm,
    ft_attempted: fta,
    orb,
    drb,
    assists: ast,
    steals: stl,
    blocks: blk,
    turnovers: to,
    fouls: fls,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: fd,
    blocks_received: 0,
    plus_minus: pm,
    minutes_played: parseMin(min),
  };
}

function awayTeamStats(teamId: string, awayScore: number) {
  return {
    teamId,
    q1_points: 0,
    q2_points: 0,
    q3_points: 0,
    q4_points: 0,
    ot_points: 0,
    total_points: awayScore,
    fg_made: null,
    fg_attempted: null,
    three_made: null,
    three_attempted: null,
    two_made: null,
    two_attempted: null,
    ft_made: null,
    ft_attempted: null,
    orb: null,
    drb: null,
    team_rebounds: null,
    total_rebounds: null,
    assists: null,
    steals: null,
    blocks: null,
    turnovers: null,
    fouls: null,
    points_off_turnovers: null,
    points_in_paint: null,
    second_chance_points: null,
    fastbreak_points: null,
    bench_points: null,
    biggest_lead: null,
    biggest_scoring_run: null,
  };
}

function homeTeamStats(
  teamId: string,
  total: number,
  fg: string,
  three: string,
  ft: string,
  reb: number,
  drb: number,
  orb: number,
  ast: number,
  stl: number,
  blk: number,
  to: number,
  fls: number
) {
  const [fgm, fga] = parseMA(fg);
  const [tpm, tpa] = parseMA(three);
  const [ftm, fta] = parseMA(ft);
  return {
    teamId,
    q1_points: 0,
    q2_points: 0,
    q3_points: 0,
    q4_points: 0,
    ot_points: 0,
    total_points: total,
    fg_made: fgm,
    fg_attempted: fga,
    three_made: tpm,
    three_attempted: tpa,
    two_made: fgm - tpm,
    two_attempted: fga - tpa,
    ft_made: ftm,
    ft_attempted: fta,
    orb,
    drb,
    team_rebounds: 0,
    total_rebounds: reb,
    assists: ast,
    steals: stl,
    blocks: blk,
    turnovers: to,
    fouls: fls,
    points_off_turnovers: null,
    points_in_paint: null,
    second_chance_points: null,
    fastbreak_points: null,
    bench_points: null,
    biggest_lead: null,
    biggest_scoring_run: null,
  };
}

interface GameSpec {
  file: string;
  id: string;
  date: string;
  startTime: string;
  homeKey: keyof typeof OPPONENTS | 'ntu';
  awayKey: keyof typeof OPPONENTS | 'ntu';
  homeScore: number;
  awayScore: number;
  ntuStarters: number[];
  ntuIsHome: boolean;
  lines: RawLine[];
  teamTotals: { fg: string; three: string; ft: string; reb: number; drb: number; orb: number; ast: number; stl: number; blk: number; to: number; fls: number };
  includeNewPlayers: boolean;
  oppKey: keyof typeof OPPONENTS;
}

const GAMES: GameSpec[] = [
  {
    file: 'game-2026-01-13-ntu-np.json',
    id: 'game-ivp-2026-01-13-ntu-np',
    date: '2026-01-13',
    startTime: '19:15',
    homeKey: 'ntu',
    awayKey: 'np',
    homeScore: 80,
    awayScore: 70,
    ntuStarters: [1, 4, 20, 11, 22],
    ntuIsHome: true,
    oppKey: 'np',
    includeNewPlayers: true,
    teamTotals: { fg: '34-73', three: '3-12', ft: '9-24', reb: 50, drb: 31, orb: 19, ast: 23, stl: 4, blk: 2, to: 14, fls: 21 },
    lines: [
      line(22, '26:12', 17, '6-15', '0-2', '5-6', 13, 6, 7, 3, 0, 1, 1, 1, 4, 9),
      line(10, '21:54', 11, '4-6', '3-5', '0-0', 2, 1, 1, 3, 0, 1, 2, 2, 0, 6),
      line(11, '22:53', 11, '5-8', '0-0', '1-2', 8, 4, 4, 0, 0, 0, 1, 3, 0, 4),
      line(15, '19:35', 9, '4-7', '0-1', '1-6', 7, 5, 2, 2, 0, 0, 1, 4, 4, 5),
      line(14, '19:56', 8, '4-7', '0-1', '0-0', 2, 1, 1, 1, 2, 0, 1, 2, 0, 2),
      line(12, '18:05', 8, '4-10', '0-0', '0-0', 5, 3, 2, 2, 0, 0, 1, 2, 0, 1),
      line(20, '27:46', 6, '3-9', '0-1', '0-4', 7, 6, 1, 5, 0, 1, 2, 2, 0, 11),
      line(4, '12:13', 6, '3-6', '0-1', '0-2', 0, 0, 0, 1, 0, 0, 0, 3, 2, 3),
      line(1, '17:36', 2, '1-5', '0-1', '0-2', 4, 3, 1, 6, 0, 1, 4, 2, 2, 6),
      line(45, '07:19', 2, '0-0', '0-0', '2-2', 1, 1, 0, 0, 0, 0, 1, 0, 0, 2),
      line(0, '04:36', 0, '0-0', '0-0', '0-0', 1, 1, 0, 0, 0, 0, 0, 0, 0, 2),
      line(21, '1:55', 0, '0-0', '0-0', '0-0', 0, 0, 0, 0, 0, 0, 0, 0, 0, -1),
    ],
  },
  {
    file: 'game-2026-01-20-ntu-suss.json',
    id: 'game-ivp-2026-01-20-ntu-suss',
    date: '2026-01-20',
    startTime: '20:45',
    homeKey: 'ntu',
    awayKey: 'suss',
    homeScore: 96,
    awayScore: 49,
    ntuStarters: [20, 10, 12, 45, 21],
    ntuIsHome: true,
    oppKey: 'suss',
    includeNewPlayers: false,
    teamTotals: { fg: '37-90', three: '10-28', ft: '12-19', reb: 56, drb: 29, orb: 27, ast: 20, stl: 25, blk: 3, to: 16, fls: 16 },
    lines: [
      line(12, '19:47', 18, '8-14', '0-0', '2-4', 8, 2, 6, 1, 0, 3, 0, 2, 3, 35),
      line(10, '19:38', 15, '5-12', '5-11', '0-0', 1, 0, 1, 2, 0, 2, 0, 2, 0, 24),
      line(14, '16:53', 13, '5-6', '1-1', '2-2', 6, 3, 3, 0, 1, 4, 1, 1, 3, 21),
      line(8, '21:55', 11, '4-13', '1-2', '2-2', 8, 3, 5, 4, 0, 3, 2, 1, 1, 27),
      line(45, '20:14', 10, '4-8', '2-3', '0-0', 8, 4, 4, 3, 1, 3, 1, 0, 0, 28),
      line(23, '08:23', 7, '1-5', '1-4', '4-4', 2, 1, 1, 0, 0, 1, 1, 2, 1, 6),
      line(6, '17:13', 6, '3-8', '0-1', '0-1', 7, 4, 3, 0, 0, 2, 2, 2, 1, 12),
      line(11, '23:24', 4, '2-4', '0-0', '0-0', 5, 2, 3, 2, 1, 3, 1, 0, 2, 29),
      line(21, '10:56', 4, '2-5', '0-0', '0-2', 2, 1, 1, 1, 0, 0, 3, 4, 3, 10),
      line(20, '15:27', 3, '1-4', '0-2', '1-2', 5, 5, 0, 4, 0, 3, 1, 0, 1, 12),
      line(4, '13:18', 3, '1-8', '0-4', '1-2', 1, 1, 0, 1, 0, 0, 2, 0, 1, 11),
      line(15, '12:52', 2, '1-3', '0-0', '0-0', 3, 3, 0, 2, 0, 1, 2, 2, 0, 20),
    ],
  },
  {
    file: 'game-2026-01-23-ntu-ite.json',
    id: 'game-ivp-2026-01-23-ntu-ite',
    date: '2026-01-23',
    startTime: '20:45',
    homeKey: 'ntu',
    awayKey: 'ite',
    homeScore: 89,
    awayScore: 54,
    ntuStarters: [1, 8, 10, 14, 22],
    ntuIsHome: true,
    oppKey: 'ite',
    includeNewPlayers: false,
    teamTotals: { fg: '40-99', three: '7-27', ft: '2-9', reb: 68, drb: 41, orb: 27, ast: 32, stl: 10, blk: 4, to: 9, fls: 17 },
    lines: [
      line(8, '23:27', 18, '9-22', '0-0', '0-2', 8, 4, 4, 4, 0, 1, 0, 0, 1, 34),
      line(22, '18:21', 17, '8-11', '0-0', '1-3', 6, 2, 4, 1, 0, 1, 0, 1, 2, 22),
      line(10, '18:39', 15, '5-14', '5-13', '0-0', 7, 5, 2, 5, 0, 1, 0, 1, 0, 26),
      line(12, '17:16', 8, '4-7', '0-0', '0-2', 6, 4, 2, 1, 0, 2, 1, 2, 1, 0),
      line(14, '15:02', 8, '4-9', '0-0', '0-0', 10, 4, 6, 3, 0, 1, 0, 3, 0, 24),
      line(11, '20:19', 5, '2-6', '0-0', '1-2', 8, 5, 3, 1, 0, 0, 1, 0, 1, 28),
      line(6, '09:58', 5, '2-5', '1-4', '0-0', 5, 4, 1, 0, 1, 0, 1, 4, 0, -7),
      line(15, '14:30', 4, '2-7', '0-2', '0-0', 2, 2, 0, 5, 0, 0, 1, 1, 0, 21),
      line(20, '16:07', 4, '2-4', '0-2', '0-0', 4, 3, 1, 5, 1, 1, 1, 0, 1, 15),
      line(4, '12:43', 3, '1-6', '1-4', '0-0', 1, 0, 1, 0, 0, 0, 3, 3, 1, -3),
      line(1, '17:28', 2, '1-2', '0-0', '0-0', 7, 4, 3, 7, 0, 2, 1, 1, 1, 14),
      line(45, '16:10', 0, '0-6', '0-2', '0-0', 4, 4, 0, 0, 2, 1, 0, 1, 0, 1),
    ],
  },
  {
    file: 'game-2026-01-26-ntu-sim.json',
    id: 'game-ivp-2026-01-26-ntu-sim',
    date: '2026-01-26',
    startTime: '21:25',
    homeKey: 'sim',
    awayKey: 'ntu',
    homeScore: 51,
    awayScore: 74,
    ntuStarters: [1, 8, 20, 11, 22],
    ntuIsHome: false,
    oppKey: 'sim',
    includeNewPlayers: false,
    teamTotals: { fg: '29-70', three: '7-23', ft: '9-11', reb: 33, drb: 24, orb: 9, ast: 25, stl: 15, blk: 3, to: 14, fls: 18 },
    lines: [
      line(22, '23:10', 17, '6-11', '1-3', '4-5', 7, 6, 1, 1, 1, 1, 2, 1, 4, 7),
      line(8, '33:42', 10, '4-14', '1-4', '1-1', 4, 3, 1, 4, 0, 4, 2, 1, 0, 9),
      line(10, '23:55', 9, '3-8', '3-8', '0-0', 4, 2, 2, 4, 0, 2, 1, 2, 0, 22),
      line(11, '23:36', 8, '4-8', '0-0', '0-0', 1, 0, 1, 0, 0, 1, 2, 3, 2, 9),
      line(14, '13:46', 7, '3-5', '0-0', '1-2', 4, 3, 1, 2, 1, 2, 1, 2, 2, 6),
      line(12, '19:30', 6, '3-6', '0-0', '0-0', 4, 1, 3, 1, 1, 0, 0, 3, 0, 20),
      line(20, '14:45', 5, '2-2', '1-1', '0-0', 3, 3, 0, 3, 0, 1, 2, 3, 2, 9),
      line(45, '05:33', 5, '2-3', '0-1', '1-1', 1, 1, 0, 0, 0, 1, 1, 0, 1, 10),
      line(0, '07:55', 3, '1-3', '1-3', '0-0', 1, 1, 0, 1, 0, 0, 1, 1, 0, 11),
      line(1, '14:13', 2, '0-5', '0-3', '2-2', 0, 0, 0, 3, 0, 1, 1, 1, 3, 2),
      line(21, '02:18', 2, '1-1', '0-0', '0-0', 0, 0, 0, 0, 0, 0, 0, 0, 0, 4),
      line(15, '17:37', 0, '0-4', '0-0', '0-0', 4, 4, 0, 6, 0, 2, 1, 1, 1, 6),
    ],
  },
  {
    file: 'game-2026-01-28-ntu-np.json',
    id: 'game-ivp-2026-01-28-ntu-np',
    date: '2026-01-28',
    startTime: '20:45',
    homeKey: 'ntu',
    awayKey: 'np',
    homeScore: 90,
    awayScore: 69,
    ntuStarters: [1, 8, 15, 11, 22],
    ntuIsHome: true,
    oppKey: 'np',
    includeNewPlayers: false,
    teamTotals: { fg: '36-80', three: '7-16', ft: '11-16', reb: 49, drb: 26, orb: 23, ast: 23, stl: 7, blk: 0, to: 11, fls: 15 },
    lines: [
      line(8, '35:52', 33, '14-29', '2-3', '3-4', 6, 2, 4, 6, 0, 1, 1, 2, 6, 16),
      line(10, '28:53', 18, '7-16', '4-10', '0-1', 5, 3, 2, 1, 0, 0, 0, 1, 1, 31),
      line(22, '33:14', 14, '6-15', '1-2', '1-2', 16, 8, 8, 4, 0, 1, 1, 1, 4, 13),
      line(20, '25:37', 11, '4-10', '0-1', '3-4', 5, 3, 2, 4, 0, 2, 2, 4, 3, 12),
      line(12, '25:07', 10, '4-5', '0-0', '2-3', 8, 6, 2, 3, 0, 1, 2, 2, 2, 18),
      line(15, '14:23', 2, '0-1', '0-0', '2-2', 1, 1, 0, 1, 0, 1, 0, 2, 1, -5),
      line(1, '11:27', 2, '1-2', '0-0', '0-0', 1, 0, 1, 3, 0, 1, 2, 1, 0, 4),
      line(11, '18:41', 0, '0-2', '0-0', '0-0', 5, 3, 2, 1, 0, 0, 3, 0, 0, 8),
      line(14, '04:35', 0, '0-0', '0-0', '0-0', 2, 0, 2, 0, 0, 0, 0, 2, 0, 4),
      line(45, '02:11', 0, '0-0', '0-0', '0-0', 0, 0, 0, 0, 0, 0, 0, 0, 0, 4),
    ],
  },
];

function buildGame(spec: GameSpec) {
  const opp = OPPONENTS[spec.oppKey];
  const ntuTeam = {
    ...NTU,
    currentTournamentId: TOURNAMENT.id,
    players: spec.includeNewPlayers ? NEW_PLAYERS : [],
  };
  const oppTeam = {
    ...opp,
    currentTournamentId: TOURNAMENT.id,
    players: [] as unknown[],
  };

  const extraOppTeams = spec.includeNewPlayers
    ? (['np', 'ite', 'sim'] as const)
        .filter((k) => k !== spec.oppKey)
        .map((k) => ({
          ...OPPONENTS[k],
          currentTournamentId: TOURNAMENT.id,
          players: [] as unknown[],
        }))
    : [];

  const teams = [ntuTeam, oppTeam, ...extraOppTeams];

  const homeTeamId = spec.homeKey === 'ntu' ? NTU.id : opp.id;
  const awayTeamId = spec.awayKey === 'ntu' ? NTU.id : opp.id;
  const ntuScore = spec.ntuIsHome ? spec.homeScore : spec.awayScore;
  const ntuStats = homeTeamStats(
    NTU.id,
    ntuScore,
    spec.teamTotals.fg,
    spec.teamTotals.three,
    spec.teamTotals.ft,
    spec.teamTotals.reb,
    spec.teamTotals.drb,
    spec.teamTotals.orb,
    spec.teamTotals.ast,
    spec.teamTotals.stl,
    spec.teamTotals.blk,
    spec.teamTotals.to,
    spec.teamTotals.fls
  );
  const oppScore = spec.ntuIsHome ? spec.awayScore : spec.homeScore;
  const oppStats = awayTeamStats(opp.id, oppScore);

  const starterIds = spec.ntuStarters.map((n) => PID[n]);

  return {
    version: '1',
    tournament: TOURNAMENT,
    teams,
    game: {
      id: spec.id,
      homeTeamId,
      awayTeamId,
      tournamentId: TOURNAMENT.id,
      date: spec.date,
      startTime: spec.startTime,
      currentPeriod: 4,
      currentGameTime: '00:00',
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: spec.homeScore, away: spec.awayScore },
      homeStarters: spec.ntuIsHome ? starterIds : [],
      awayStarters: spec.ntuIsHome ? [] : starterIds,
      gameStats: spec.lines.map(toStat),
      teamStats: {
        home: spec.ntuIsHome ? ntuStats : oppStats,
        away: spec.ntuIsHome ? oppStats : ntuStats,
      },
      shots: [],
      events: [],
      lineupStints: [],
    },
  };
}

const outDir = resolve(process.cwd(), 'Importingboxscores/ivp 2026');
mkdirSync(outDir, { recursive: true });

for (const spec of GAMES) {
  const bundle = buildGame(spec);
  const path = resolve(outDir, spec.file);
  writeFileSync(path, JSON.stringify(bundle, null, 2) + '\n');
  console.log('Wrote', path);
}

console.log('Done ù 5 IVP 2026 game JSON files generated.');
