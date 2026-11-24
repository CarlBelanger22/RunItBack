import { describe, expect, it } from 'vitest';
import type { Game, Team, TeamStats } from '../App';
import {
  STANDINGS_SHOOTING_COVERAGE_MIN,
  withExtendedShootingStats,
  type StandingRow,
} from './tournamentStandings';

const emptyTeamStats = (): TeamStats =>
  ({
    total_points: 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    assists: 0,
  }) as TeamStats;

function makeTeam(id: string): Team {
  return {
    id,
    name: id,
    abbreviation: id.slice(0, 3).toUpperCase(),
    players: [],
  };
}

function makeGame(opts: {
  id: string;
  home: Team;
  away: Team;
  score: { home: number; away: number };
  /** When set, both sides get FGA>0 teamStats (tracked). Otherwise score-only. */
  tracked?: boolean;
}): Game {
  const homeStats = emptyTeamStats();
  const awayStats = emptyTeamStats();
  homeStats.total_points = opts.score.home;
  awayStats.total_points = opts.score.away;
  if (opts.tracked) {
    homeStats.fg_made = 20;
    homeStats.fg_attempted = 50;
    homeStats.three_made = 5;
    homeStats.three_attempted = 20;
    homeStats.ft_made = 10;
    homeStats.ft_attempted = 12;
    homeStats.orb = 5;
    homeStats.drb = 15;
    homeStats.assists = 12;
    awayStats.fg_made = 18;
    awayStats.fg_attempted = 48;
    awayStats.three_made = 4;
    awayStats.three_attempted = 18;
    awayStats.ft_made = 8;
    awayStats.ft_attempted = 10;
    awayStats.orb = 4;
    awayStats.drb = 14;
    awayStats.assists = 10;
  }
  return {
    id: opts.id,
    homeTeam: opts.home,
    awayTeam: opts.away,
    homeTeamId: opts.home.id,
    awayTeamId: opts.away.id,
    date: '2025-01-01',
    gameStats: [],
    teamStats: { home: homeStats, away: awayStats },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '00:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    finalScore: opts.score,
  } as Game;
}

function baseStanding(team: Team): StandingRow {
  return {
    team,
    wins: 1,
    losses: 0,
    gamesPlayed: 1,
    winPercentage: 100,
    pointsFor: 70,
    pointsAgainst: 60,
    pointsDiff: 10,
    ppg: 70,
    papg: 60,
  };
}

describe('withExtendedShootingStats coverage gate', () => {
  const teamA = makeTeam('team-a');
  const teamB = makeTeam('team-b');

  it('exposes a 75% minimum coverage constant', () => {
    expect(STANDINGS_SHOOTING_COVERAGE_MIN).toBe(0.75);
  });

  it('publishes % when all non-walkover games are tracked', () => {
    const games = [
      makeGame({
        id: 'g1',
        home: teamA,
        away: teamB,
        score: { home: 70, away: 60 },
        tracked: true,
      }),
    ];
    const [row] = withExtendedShootingStats([baseStanding(teamA)], games);
    expect(row.fgPct).toBeCloseTo(40, 5);
    expect(row.threePct).toBeCloseTo(25, 5);
    expect(row.ftPct).toBeCloseTo((10 / 12) * 100, 5);
    expect(row.rpg).toBeGreaterThan(0);
    expect(row.apg).toBeGreaterThan(0);
  });

  it('withholds % when coverage is under 75% (2 of 3)', () => {
    const games = [
      makeGame({
        id: 'g1',
        home: teamA,
        away: teamB,
        score: { home: 70, away: 60 },
        tracked: true,
      }),
      makeGame({
        id: 'g2',
        home: teamA,
        away: teamB,
        score: { home: 72, away: 68 },
        tracked: true,
      }),
      makeGame({
        id: 'g3',
        home: teamA,
        away: teamB,
        score: { home: 65, away: 70 },
        tracked: false,
      }),
    ];
    const standing = { ...baseStanding(teamA), gamesPlayed: 3 };
    const [row] = withExtendedShootingStats([standing], games);
    expect(row.fgPct).toBeNull();
    expect(row.threePct).toBeNull();
    expect(row.ftPct).toBeNull();
    expect(row.rpg).toBe(0);
    expect(row.apg).toBe(0);
  });

  it('publishes % from tracked games only when coverage is exactly 75% (3 of 4)', () => {
    const games = [
      makeGame({
        id: 'g1',
        home: teamA,
        away: teamB,
        score: { home: 70, away: 60 },
        tracked: true,
      }),
      makeGame({
        id: 'g2',
        home: teamA,
        away: teamB,
        score: { home: 72, away: 68 },
        tracked: true,
      }),
      makeGame({
        id: 'g3',
        home: teamA,
        away: teamB,
        score: { home: 66, away: 64 },
        tracked: true,
      }),
      makeGame({
        id: 'g4',
        home: teamA,
        away: teamB,
        score: { home: 80, away: 75 },
        tracked: false,
      }),
    ];
    const standing = { ...baseStanding(teamA), gamesPlayed: 4 };
    const [row] = withExtendedShootingStats([standing], games);
    // 3 tracked × 20/50 FG
    expect(row.fgPct).toBeCloseTo(40, 5);
    expect(row.threePct).toBeCloseTo(25, 5);
    expect(row.rpg).toBeCloseTo((3 * (5 + 15)) / 4, 5);
    expect(row.apg).toBeCloseTo((3 * 12) / 4, 5);
  });

  it('excludes walkovers from the coverage denominator', () => {
    const games = [
      makeGame({
        id: 'g1',
        home: teamA,
        away: teamB,
        score: { home: 70, away: 60 },
        tracked: true,
      }),
      makeGame({
        id: 'g2',
        home: teamA,
        away: teamB,
        score: { home: 70, away: 60 },
        tracked: true,
      }),
      makeGame({
        id: 'g3',
        home: teamA,
        away: teamB,
        score: { home: 70, away: 60 },
        tracked: false,
      }),
      // FIBA forfeit — must not count against coverage
      makeGame({
        id: 'wo',
        home: teamA,
        away: teamB,
        score: { home: 20, away: 0 },
        tracked: false,
      }),
    ];
    // Non-walkover sample = 3; tracked = 2 → 66.7% → withhold
    const standing = { ...baseStanding(teamA), gamesPlayed: 4 };
    const [row] = withExtendedShootingStats([standing], games);
    expect(row.fgPct).toBeNull();
  });
});
