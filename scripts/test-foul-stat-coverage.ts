/**
 * Foul subtype stat coverage tests (TF / UF / BA).
 * Run: npm run test:foul-stat-coverage
 */

import type { Game, GameStats, Player, Team } from '../src/App';
import { getFoulStatCoverage } from '../src/utils/playerSeasonStats';
import { formatAdvancedPlayerStatsRow } from '../src/utils/playerStatsDisplay';
import type { PlayerSeasonRow } from '../src/utils/playerSeasonStats';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function player(id: string): Player {
  return { id, name: id, number: 1, position: 'G' };
}

function team(id: string, players: Player[]): Team {
  return { id, name: id, abbreviation: 'TST', players };
}

function stat(playerId: string, overrides: Partial<GameStats> = {}): GameStats {
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
    minutes_played: 10,
    ...overrides,
  };
}

function emptyTeamStats(teamId: string) {
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

function makeGame(options: {
  teamId: string;
  gameStats?: GameStats[];
  events?: Game['events'];
  awayPlayers?: Player[];
  finalScore?: { home: number; away: number };
}): Game {
  const homePlayers = [player('p1')];
  const awayPlayers = options.awayPlayers ?? [player('a1')];
  const home = team(options.teamId, homePlayers);
  const away = team('away', awayPlayers);

  return {
    id: 'g-test',
    homeTeam: home,
    awayTeam: away,
    homeTeamId: options.teamId,
    awayTeamId: 'away',
    date: '2026-01-01',
    gameStats: options.gameStats ?? [stat('p1')],
    teamStats: {
      home: emptyTeamStats(options.teamId),
      away: emptyTeamStats('away'),
    },
    shots: [],
    events: options.events ?? [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '0:00',
    homeStarters: ['p1'],
    awayStarters: awayPlayers.map((p) => p.id),
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: options.finalScore,
  };
}

const teamId = 'team-1';

const fullBoxScoreGame = makeGame({
  teamId,
  gameStats: [stat('p1', { tech_fouls: 0 })],
});

const liveEntryGame = makeGame({
  teamId,
  gameStats: [stat('p1', { tech_fouls: 0 })],
  events: [
    {
      id: 'e1',
      type: 'foul',
      timestamp: 1,
      period: 1,
      gameTime: '9:00',
      teamId,
      playerId: 'p1',
      details: { foulType: 'technical' },
      homeScore: 0,
      awayScore: 0,
    },
  ],
});

const scoreOnlyGame = makeGame({
  teamId,
  gameStats: [],
  awayPlayers: [],
  finalScore: { home: 70, away: 65 },
});

assert(
  getFoulStatCoverage([fullBoxScoreGame], teamId).techFouls === true,
  'full box score game tracks TF even when all zeros'
);

assert(
  getFoulStatCoverage([liveEntryGame], teamId).techFouls === true,
  'live entry game tracks TF'
);

assert(
  getFoulStatCoverage([scoreOnlyGame], teamId).techFouls === false,
  'score-only game does not track TF'
);

const seasonRow: PlayerSeasonRow = {
  player: player('p1'),
  team: team(teamId, [player('p1')]),
  gamesPlayed: 2,
  totalStats: stat('p1', { tech_fouls: 0 }),
  paintPointsTotal: 0,
  fastbreakPointsTotal: 0,
  gamesWithShotData: 0,
  foulsDrawnTotal: 0,
  gamesWithFoulsDrawnData: 0,
  plusMinusTotal: 0,
  gamesWithPlusMinusData: 0,
};

const advancedValues = formatAdvancedPlayerStatsRow(seasonRow, {
  blocksAgainst: true,
  techFouls: true,
  unsportsmanlikeFouls: true,
});

const tfIndex = 8;
assert(
  advancedValues[tfIndex] === '0.0',
  'TF displays 0.0 when tracked and total is zero'
);

assert(
  formatAdvancedPlayerStatsRow(seasonRow, {
    blocksAgainst: false,
    techFouls: false,
    unsportsmanlikeFouls: false,
  })[tfIndex] === '-',
  'TF displays dash when not tracked'
);

console.log('PASS: foul stat coverage tests');
