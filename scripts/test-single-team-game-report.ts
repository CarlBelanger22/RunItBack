/**
 * Single-team Opp unit stats on completed game report surfaces.
 * Run: npm run test:single-team-game-report
 */

import type { Game } from '../src/App';
import { buildGameComparisonVisualModel } from '../src/utils/gameComparisonVisualModel';
import {
  isScoreOnlyTeam,
  teamHasPersistedBoxScoreStats,
} from '../src/utils/gameDisplay';
import { buildTeamDisplayStats } from '../src/utils/teamDisplayStats';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function emptyTeamStats(teamId: string): Game['teamStats']['home'] {
  return {
    teamId,
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
  };
}

function singleTeamCompletedGame(): Game {
  return {
    id: 'g-ntu-moe',
    homeTeamId: 'ntu',
    awayTeamId: 'moe',
    homeTeam: {
      id: 'ntu',
      name: 'Nanyang Technological University',
      abbreviation: 'NTU',
      players: [{ id: 'p1', name: 'Jingjie Lim', number: 1, position: 'PG' }],
    },
    awayTeam: {
      id: 'moe',
      name: 'Ministry Of Education',
      abbreviation: 'MOE',
      players: [],
    },
    date: '2026-06-25',
    gameStats: [
      {
        playerId: 'p1',
        points: 14,
        fg_made: 6,
        fg_attempted: 12,
        three_made: 2,
        three_attempted: 5,
        ft_made: 0,
        ft_attempted: 0,
        orb: 2,
        drb: 12,
        assists: 2,
        steals: 2,
        blocks: 1,
        turnovers: 1,
        fouls: 2,
        tech_fouls: 0,
        unsportsmanlike_fouls: 0,
        fouls_drawn: 1,
        blocks_received: 0,
        plus_minus: 5,
        minutes_played: 32,
      },
    ],
    teamStats: {
      home: {
        ...emptyTeamStats('ntu'),
        q1_points: 28,
        q2_points: 21,
        q3_points: 26,
        q4_points: 30,
        total_points: 105,
        fg_made: 27,
        fg_attempted: 53,
        three_made: 8,
        three_attempted: 22,
        ft_made: 15,
        ft_attempted: 20,
        orb: 18,
        drb: 58,
        total_rebounds: 76,
        assists: 32,
        steals: 10,
        blocks: 4,
        turnovers: 12,
        fouls: 18,
      },
      away: {
        ...emptyTeamStats('moe'),
        q1_points: 14,
        q2_points: 30,
        q3_points: 27,
        q4_points: 23,
        total_points: 94,
        fg_made: 20,
        fg_attempted: 48,
        three_made: 5,
        three_attempted: 15,
        ft_made: 9,
        ft_attempted: 12,
        orb: 8,
        drb: 22,
        total_rebounds: 30,
        turnovers: 14,
        fouls: 20,
      },
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '0:00',
    homeStarters: ['p1'],
    awayStarters: [],
    trackBothTeams: false,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 105, away: 94 },
  };
}

function scoreOnlyImportedGame(): Game {
  const home = {
    id: 'home',
    name: 'Home',
    abbreviation: 'HOM',
    players: [],
  };
  const away = {
    id: 'away',
    name: 'Away',
    abbreviation: 'AWY',
    players: [],
  };
  return {
    id: 'g-score-only',
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    date: '2026-01-01',
    gameStats: [],
    teamStats: {
      home: { ...emptyTeamStats(home.id), total_points: 70 },
      away: { ...emptyTeamStats(away.id), total_points: 65 },
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
    finalScore: { home: 70, away: 65 },
  };
}

function testTeamHasPersistedBoxScoreStats(): void {
  assert(
    !teamHasPersistedBoxScoreStats(emptyTeamStats('x')),
    'empty stats are not box score'
  );
  assert(
    !teamHasPersistedBoxScoreStats({
      ...emptyTeamStats('x'),
      total_points: 50,
    }),
    'score-only import — only total_points is not box score'
  );
  assert(
    teamHasPersistedBoxScoreStats({
      ...emptyTeamStats('x'),
      total_points: 50,
      fg_attempted: 1,
    }),
    'fg_attempted counts as box score'
  );
}

function testSingleTeamOppNotScoreOnly(): void {
  const game = singleTeamCompletedGame();
  assert(!isScoreOnlyTeam(game, 'away'), 'Opp unit away is not score-only');
  assert(!isScoreOnlyTeam(game, 'home'), 'home with player box is not score-only');
}

function testImportedScoreOnlyStillScoreOnly(): void {
  const game = scoreOnlyImportedGame();
  assert(isScoreOnlyTeam(game, 'home'), 'import home score-only');
  assert(isScoreOnlyTeam(game, 'away'), 'import away score-only');
}

function testComparisonVisualShowsOppStats(): void {
  const model = buildGameComparisonVisualModel(singleTeamCompletedGame());
  const fg = model.shooting.find((r) => r.key === 'fg')!;
  assert(fg.away.line === '20/48', 'Opp FG line from teamStats.away');
  assert(fg.away.pct === 42, 'Opp FG pct');
  assert(!fg.away.scoreOnly, 'Opp not score-only in shooting');

  const rebounds = model.majorGroups.find((g) => g.key === 'rebounds')!;
  assert(rebounds.away.display === '30', 'Opp rebounds total');

  const turnovers = model.minorRows.find((r) => r.key === 'turnovers')!;
  assert(turnovers.away.display === '14', 'Opp turnovers');
}

function testTeamDisplayStatsForOpp(): void {
  const stats = buildTeamDisplayStats(singleTeamCompletedGame(), 'away');
  assert(!stats.scoreOnly, 'buildTeamDisplayStats away not score-only');
  assert(stats.fg_attempted === 48, 'Opp FG att');
  assert(stats.rebounds === 30, 'Opp rebounds');
  assert(stats.turnovers === 14, 'Opp TO');
}

function testTeamReboundsNotDoubleCounted(): void {
  const game = singleTeamCompletedGame();
  game.teamStats.away = {
    ...game.teamStats.away,
    orb: 16,
    drb: 56,
    team_rebounds: 72,
    total_rebounds: 144,
  };
  const stats = buildTeamDisplayStats(game, 'away');
  assert(stats.rebounds === 72, 'Opp TRB = ORB + DRB, not inflated total_rebounds');

  const model = buildGameComparisonVisualModel(game);
  const rebounds = model.majorGroups.find((g) => g.key === 'rebounds')!;
  assert(rebounds.away.display === '72', 'comparison TRB matches ORB + DRB');
}

function main(): void {
  testTeamHasPersistedBoxScoreStats();
  testSingleTeamOppNotScoreOnly();
  testImportedScoreOnlyStillScoreOnly();
  testComparisonVisualShowsOppStats();
  testTeamDisplayStatsForOpp();
  testTeamReboundsNotDoubleCounted();
  console.log('All single-team game report tests passed.');
}

main();
