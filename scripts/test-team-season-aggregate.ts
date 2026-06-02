/**
 * Verifies team season steals average ≠ sum of player steal averages (alternating DNP).
 * Run: npx tsx scripts/test-team-season-aggregate.ts
 */
import type { Game, GameStats, Player, Team } from '../src/App';
import {
  aggregateTeamSeasonAverages,
  computeScopedTeamScoring,
  computeTeamSeasonDerived,
} from '../src/utils/gameDisplay';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function baseStat(playerId: string, overrides: Partial<GameStats> = {}): GameStats {
  return {
    playerId,
    points: 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: 0,
    blocks_received: 0,
    plus_minus: 0,
    minutes_played: 12,
    ...overrides,
  };
}

function makePlayer(id: string, name: string): Player {
  return {
    id,
    name,
    number: 1,
    position: 'PG',
    height: '180',
    weight: '75',
    age: 20,
  };
}

function makeGame(id: string, home: Team, away: Team, stats: GameStats[]): Game {
  return {
    id,
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    date: '2024-06-01',
    gameStats: stats,
    teamStats: {
      home: {
        teamId: home.id,
        q1_points: 0,
        q2_points: 0,
        q3_points: 0,
        q4_points: 0,
        ot_points: 0,
        total_points: 0,
        fg_made: 0,
        fg_attempted: 0,
        three_made: 0,
        three_attempted: 0,
        two_made: 0,
        two_attempted: 0,
        ft_made: 0,
        ft_attempted: 0,
        orb: 0,
        drb: 0,
        team_rebounds: 0,
        total_rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
        points_off_turnovers: null,
        points_in_paint: null,
        second_chance_points: null,
        fastbreak_points: null,
        bench_points: null,
        biggest_lead: null,
        biggest_scoring_run: null,
      },
      away: {
        teamId: away.id,
        q1_points: 0,
        q2_points: 0,
        q3_points: 0,
        q4_points: 0,
        ot_points: 0,
        total_points: 0,
        fg_made: 0,
        fg_attempted: 0,
        three_made: 0,
        three_attempted: 0,
        two_made: 0,
        two_attempted: 0,
        ft_made: 0,
        ft_attempted: 0,
        orb: 0,
        drb: 0,
        team_rebounds: 0,
        total_rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
        points_off_turnovers: null,
        points_in_paint: null,
        second_chance_points: null,
        fastbreak_points: null,
        bench_points: null,
        biggest_lead: null,
        biggest_scoring_run: null,
      },
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '0:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
  };
}

const playerA = makePlayer('p-a', 'Player A');
const playerB = makePlayer('p-b', 'Player B');
const team: Team = {
  id: 'team-test',
  name: 'Test Team',
  abbreviation: 'TST',
  players: [playerA, playerB],
};
const opponent: Team = {
  id: 'team-opp',
  name: 'Opponent',
  abbreviation: 'OPP',
  players: [],
};

const games = [
  makeGame('g1', team, opponent, [
    baseStat('p-a', {
      points: 35,
      steals: 5,
      assists: 8,
      turnovers: 4,
      fg_made: 14,
      fg_attempted: 28,
      ft_attempted: 4,
    }),
  ]),
  makeGame('g2', team, opponent, [
    baseStat('p-b', {
      points: 32,
      steals: 5,
      assists: 4,
      turnovers: 2,
      fg_made: 12,
      fg_attempted: 24,
      ft_attempted: 6,
    }),
  ]),
];
games[0].finalScore = { home: 70, away: 60 };
games[1].finalScore = { home: 65, away: 55 };

const agg = aggregateTeamSeasonAverages(games, team);
assert(agg.gamesInSample === 2, `expected 2 games in sample, got ${agg.gamesInSample}`);
assert(agg.perGame.steals === 5, `team SPG should be 5, got ${agg.perGame.steals}`);

const playerASpg = 5 / 1;
const playerBSpg = 5 / 1;
const inflatedSum = playerASpg + playerBSpg;
assert(
  inflatedSum === 10 && agg.perGame.steals !== inflatedSum,
  'sum of player SPG (10) must not equal team SPG (5)'
);

// Walkover: completed game with no box score should not inflate denominator
const walkover = makeGame('g-walk', team, opponent, []);
walkover.isCompleted = true;
const withWalkover = aggregateTeamSeasonAverages([...games, walkover], team);
assert(
  withWalkover.gamesInSample === 2,
  `walkover should be excluded from sample, got ${withWalkover.gamesInSample}`
);
assert(
  withWalkover.perGame.steals === 5,
  `steals after walkover should stay 5, got ${withWalkover.perGame.steals}`
);

const scoring = computeScopedTeamScoring(games, team.id);
const derived = computeTeamSeasonDerived(agg.totals, agg.perGame, scoring);
assert(derived.apg === 6, `APG should be 6, got ${derived.apg}`);
assert(derived.topg === 3, `TOPG should be 3, got ${derived.topg}`);
assert(derived.astTo === 2, `AST/TO should be 2, got ${derived.astTo}`);
assert(scoring.ppg === 67.5, `PPG should be 67.5, got ${scoring.ppg}`);
assert(
  derived.tsPct != null && Number.isFinite(derived.tsPct),
  `TS% should be finite, got ${derived.tsPct}`
);

console.log('OK: aggregateTeamSeasonAverages (team SPG=5, inflated player sum=10)');
console.log('OK: derived APG/TOPG/TS% finite');
