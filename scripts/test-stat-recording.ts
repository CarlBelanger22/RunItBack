/**
 * Unit tests for tournament-scoped stat recording coverage.
 * Run: npm run test:stat-recording
 */

import type { Game, GameStats, Player, Team } from '../src/App';
import {
  tournamentRecordsStat,
  gameRecordsStat,
  TOURNAMENTS_WITHOUT_FOULS_DRAWN_AND_PLUS_MINUS,
  perGameAverageOrNull,
} from '../src/utils/statRecordingCoverage';
import {
  aggregateSinglePlayerSeasonStats,
  plusMinusPerGameForRow,
  getPlusMinusCoverage,
  getFoulsDrawnCoverage,
} from '../src/utils/playerSeasonStats';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function testExcludedTournaments(): void {
  for (const id of TOURNAMENTS_WITHOUT_FOULS_DRAWN_AND_PLUS_MINUS) {
    assert(!tournamentRecordsStat(id, 'fouls_drawn'), `${id} excludes fouls_drawn`);
    assert(!tournamentRecordsStat(id, 'plus_minus'), `${id} excludes plus_minus`);
  }
}

function testRecordedTournaments(): void {
  assert(tournamentRecordsStat('tournament-1768327829049', 'fouls_drawn'), 'IVP 2026');
  assert(tournamentRecordsStat('tournament-sunig-2025', 'plus_minus'), 'Sunig 2025');
}

function testGameRecordsStat(): void {
  const withoutId = 'tournament-1780425044074'; // NBL Div 2 2023 (in the "without" set)

  // Imported game (empty event log) in a "without" tournament → still gated off.
  const imported = { tournamentId: withoutId, events: [] };
  assert(!gameRecordsStat(imported, 'plus_minus'), 'imported game gates +/- off');
  assert(!gameRecordsStat(imported, 'fouls_drawn'), 'imported game gates FD off');

  // Live-entered game (non-empty event log) in the SAME tournament → records everything.
  const live = { tournamentId: withoutId, events: [{ id: 'e1' }] };
  assert(gameRecordsStat(live, 'plus_minus'), 'live game records +/- despite tournament flag');
  assert(gameRecordsStat(live, 'fouls_drawn'), 'live game records FD despite tournament flag');

  // Missing/undefined events behaves like an imported game.
  const noEvents = { tournamentId: withoutId };
  assert(!gameRecordsStat(noEvents, 'plus_minus'), 'undefined events gates +/- off');

  // No tournament, or a recorded tournament → always true.
  assert(gameRecordsStat({ events: [] }, 'plus_minus'), 'no tournament records +/-');
  assert(
    gameRecordsStat({ tournamentId: 'tournament-1768327829049', events: [] }, 'fouls_drawn'),
    'recorded tournament imported game still records FD'
  );
}

function testPerGameAverageOrNull(): void {
  assert(perGameAverageOrNull(10, 0) === null, 'zero games null');
  assert(perGameAverageOrNull(18, 9) === 2, 'average');
}

function makeStat(playerId: string, plusMinus: number): GameStats {
  return {
    playerId,
    minutes_played: 20,
    points: 10,
    fg_made: 4,
    fg_attempted: 8,
    three_made: 1,
    three_attempted: 3,
    ft_made: 1,
    ft_attempted: 2,
    orb: 1,
    drb: 3,
    assists: 2,
    steals: 1,
    blocks: 0,
    turnovers: 1,
    fouls: 2,
    fouls_drawn: 1,
    plus_minus: plusMinus,
    blocks_received: 0,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
  };
}

function testAggregationExcludesUnrecordedTournaments(): void {
  const player: Player = {
    id: 'player-carl',
    name: 'Carl Belanger',
    position: 'SG',
    jerseyNumber: 7,
  };
  const team: Team = {
    id: 'team-safsa',
    name: 'SAFSA',
    abbreviation: 'SAF',
    players: [player],
  };

  const nbl2023Game: Game = {
    id: 'g-nbl23',
    date: '2023-03-22',
    isCompleted: true,
    tournamentId: 'tournament-1780425044074',
    homeTeamId: team.id,
    awayTeamId: 'team-opp',
    homeTeam: team,
    awayTeam: { id: 'team-opp', name: 'Opp', abbreviation: 'OPP', players: [] },
    gameStats: [makeStat(player.id, 5)],
    shots: [],
    finalScore: { home: 70, away: 60 },
  };

  const ivpGame: Game = {
    id: 'g-ivp',
    date: '2026-01-10',
    isCompleted: true,
    tournamentId: 'tournament-1768327829049',
    homeTeamId: team.id,
    awayTeamId: 'team-opp2',
    homeTeam: team,
    awayTeam: { id: 'team-opp2', name: 'Opp2', abbreviation: 'OP2', players: [] },
    gameStats: [makeStat(player.id, 8)],
    shots: [],
    finalScore: { home: 72, away: 68 },
  };

  const nblRow = aggregateSinglePlayerSeasonStats(player, team, [nbl2023Game]);
  assert(
    nblRow.gamesWithPlusMinusData === 0,
    'NBL 2023 should not count +/- games'
  );
  assert(plusMinusPerGameForRow(nblRow) === null, 'NBL 2023 +/- avg null');

  const allRow = aggregateSinglePlayerSeasonStats(player, team, [
    nbl2023Game,
    ivpGame,
  ]);
  assert(
    allRow.gamesWithPlusMinusData === 1,
    'All Time should count only IVP +/- game'
  );
  assert(
    plusMinusPerGameForRow(allRow) === 8,
    `All Time +/- should be 8, got ${plusMinusPerGameForRow(allRow)}`
  );

  const shenggongGame: Game = {
    id: 'g-shenggong',
    date: '2019-11-19',
    isCompleted: true,
    tournamentId: 'tournament-1780771500232',
    homeTeamId: team.id,
    awayTeamId: 'team-opp3',
    homeTeam: team,
    awayTeam: { id: 'team-opp3', name: 'Opp3', abbreviation: 'OP3', players: [] },
    gameStats: [makeStat(player.id, 12)],
    shots: [],
    finalScore: { home: 51, away: 79 },
  };

  const shenggongRow = aggregateSinglePlayerSeasonStats(player, team, [shenggongGame]);
  assert(
    shenggongRow.gamesWithPlusMinusData === 0,
    'Shenggong 2019 should not count +/- games'
  );
  assert(plusMinusPerGameForRow(shenggongRow) === null, 'Shenggong 2019 +/- avg null');
}

function testAggregationCountsLiveGamesInUnrecordedTournament(): void {
  const player: Player = {
    id: 'player-carl',
    name: 'Carl Belanger',
    position: 'SG',
    jerseyNumber: 7,
  };
  const team: Team = {
    id: 'team-safsa',
    name: 'SAFSA',
    abbreviation: 'SAF',
    players: [player],
  };

  // Same "without" tournament as testAggregation..., but this game was entered
  // LIVE (non-empty event log) → its +/- and FD must be counted.
  const liveNblGame: Game = {
    id: 'g-nbl23-live',
    date: '2023-03-25',
    isCompleted: true,
    tournamentId: 'tournament-1780425044074', // NBL Div 2 2023 (in the "without" set)
    homeTeamId: team.id,
    awayTeamId: 'team-opp',
    homeTeam: team,
    awayTeam: { id: 'team-opp', name: 'Opp', abbreviation: 'OPP', players: [] },
    gameStats: [makeStat(player.id, 6)],
    shots: [],
    events: [{ id: 'e1' } as unknown as Game['events'][number]],
    finalScore: { home: 80, away: 70 },
  } as Game;

  const row = aggregateSinglePlayerSeasonStats(player, team, [liveNblGame]);
  assert(
    row.gamesWithPlusMinusData === 1,
    'live game in a "without" tournament counts toward +/- games'
  );
  assert(
    plusMinusPerGameForRow(row) === 6,
    `live +/- should be 6, got ${plusMinusPerGameForRow(row)}`
  );
  assert(
    row.gamesWithFoulsDrawnData === 1,
    'live game in a "without" tournament counts toward FD games'
  );
}

function makeCoverageGame(
  id: string,
  tournamentId: string | undefined,
  live: boolean
): Game {
  return {
    id,
    date: '2024-01-01',
    isCompleted: true,
    tournamentId,
    homeTeamId: 'team-a',
    awayTeamId: 'team-b',
    homeTeam: { id: 'team-a', name: 'A', abbreviation: 'A', players: [] },
    awayTeam: { id: 'team-b', name: 'B', abbreviation: 'B', players: [] },
    gameStats: [],
    shots: [],
    events: live ? [{ id: 'e1' } as unknown as Game['events'][number]] : [],
    finalScore: { home: 1, away: 0 },
  } as Game;
}

function testScopedStatCoverage(): void {
  const withoutId = 'tournament-1780425044074'; // in the "without" set
  const recordedId = 'tournament-1768327829049'; // records everything

  // Mixed: one imported (untracked) + one live (tracked) in a "without" tournament.
  const mixed = [
    makeCoverageGame('imp', withoutId, false),
    makeCoverageGame('live', withoutId, true),
  ];
  const pmMixed = getPlusMinusCoverage(mixed);
  assert(pmMixed.isPartial, 'mixed scope +/- coverage is partial');
  assert(pmMixed.gamesWithData === 1 && pmMixed.gamesTotal === 2, 'mixed +/- 1 of 2');
  const fdMixed = getFoulsDrawnCoverage(mixed);
  assert(fdMixed.isPartial, 'mixed scope FD coverage is partial');

  // All tracked (recorded tournament) → not partial.
  const allTracked = [makeCoverageGame('g1', recordedId, false)];
  assert(!getPlusMinusCoverage(allTracked).isPartial, 'all-tracked not partial');

  // All untracked (imported "without") → not partial (fully missing → dash, not ⚠).
  const allUntracked = [makeCoverageGame('g1', withoutId, false)];
  const pmNone = getPlusMinusCoverage(allUntracked);
  assert(!pmNone.isPartial && pmNone.gamesWithData === 0, 'all-untracked not partial');
}

function main(): void {
  testExcludedTournaments();
  testRecordedTournaments();
  testGameRecordsStat();
  testScopedStatCoverage();
  testAggregationCountsLiveGamesInUnrecordedTournament();
  testPerGameAverageOrNull();
  testAggregationExcludesUnrecordedTournaments();
  console.log('All stat recording tests passed.');
}

main();
