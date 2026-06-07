/**
 * Team/Coach aggregation tests.
 * Run: npx tsx scripts/test-team-coach-stats.ts
 */

import type { Game, GameStats, Player, Team } from '../src/App';
import {
  aggregateTeamSeasonAverages,
  resolveTeamTotals,
} from '../src/utils/gameDisplay';
import { EMPTY_TEAM_COACH } from '../src/utils/teamCoachStats';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function baseStat(playerId: string, overrides: Partial<GameStats> = {}): GameStats {
  return {
    playerId,
    points: 10,
    fg_made: 4,
    fg_attempted: 8,
    three_made: 1,
    three_attempted: 2,
    ft_made: 1,
    ft_attempted: 2,
    orb: 2,
    drb: 4,
    assists: 1,
    steals: 0,
    blocks: 0,
    turnovers: 1,
    fouls: 2,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: 0,
    blocks_received: 0,
    plus_minus: 0,
    minutes_played: 20,
    ...overrides,
  };
}

function makeTeam(id: string, players: Player[]): Team {
  return { id, name: id, abbreviation: id, players };
}

function makeGame(home: Team, away: Team, stats: GameStats[], teamCoachHome = EMPTY_TEAM_COACH): Game {
  return {
    id: 'g1',
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    date: '2019-07-19',
    trackBothTeams: true,
    isCompleted: true,
    gameStats: stats,
    teamStats: {
      home: {
        teamId: home.id,
        q1_points: 10,
        q2_points: 10,
        q3_points: 10,
        q4_points: 10,
        ot_points: 0,
        total_points: 40,
        fg_made: 4,
        fg_attempted: 8,
        three_made: 1,
        three_attempted: 2,
        two_made: 3,
        two_attempted: 6,
        ft_made: 1,
        ft_attempted: 2,
        orb: 6,
        drb: 8,
        team_rebounds: 0,
        total_rebounds: 14,
        assists: 1,
        steals: 0,
        blocks: 0,
        turnovers: 3,
        fouls: 5,
        points_off_turnovers: null,
        points_in_paint: null,
        second_chance_points: null,
        fastbreak_points: null,
        bench_points: null,
        biggest_lead: null,
        biggest_scoring_run: null,
        team_coach: teamCoachHome,
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
        team_coach: { ...EMPTY_TEAM_COACH },
      },
    },
  };
}

const home = makeTeam('home', [
  { id: 'p1', name: 'A', number: 1, position: 'PG', height: '', weight: '', age: 20 },
]);
const away = makeTeam('away', []);

// Zero coach — player-only totals
const gameZero = makeGame(home, away, [baseStat('p1')]);
const zeroTotals = resolveTeamTotals(gameZero, 'home');
assert(zeroTotals.orb === 2 && zeroTotals.drb === 4, 'zero coach: player reb');
assert(zeroTotals.turnovers === 1 && zeroTotals.fouls === 2, 'zero coach: player to/pf');

// Non-zero coach
const coach = { orb: 4, drb: 2, turnovers: 3, fouls: 1 };
const gameCoach = makeGame(home, away, [baseStat('p1')], coach);
const coachTotals = resolveTeamTotals(gameCoach, 'home');
assert(coachTotals.orb === 6 && coachTotals.drb === 6, 'coach adds to reb');
assert(coachTotals.turnovers === 4 && coachTotals.fouls === 3, 'coach adds to to/pf');
assert(
  coachTotals.teamCoach.orb === 4 && coachTotals.teamCoach.drb === 2,
  'teamCoach exposed on totals'
);

const season = aggregateTeamSeasonAverages([gameCoach], home);
assert(season.perGame.orb + season.perGame.drb === 12, 'team page RPG includes coach reb');
assert(season.perGame.turnovers === 4, 'team page TOPG includes coach TO');
assert(season.perGame.fouls === 3, 'team page FPG includes coach PF');

console.log('All team coach stats tests passed.');
