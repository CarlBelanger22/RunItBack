/**
 * Unit tests for tournament-scoped stat recording coverage.
 * Run: npm run test:stat-recording
 */

import type { Game, GameStats, Player, Team } from '../src/App';
import {
  tournamentRecordsStat,
  TOURNAMENTS_WITHOUT_FOULS_DRAWN_AND_PLUS_MINUS,
  perGameAverageOrNull,
} from '../src/utils/statRecordingCoverage';
import {
  aggregateSinglePlayerSeasonStats,
  plusMinusPerGameForRow,
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

function main(): void {
  testExcludedTournaments();
  testRecordedTournaments();
  testPerGameAverageOrNull();
  testAggregationExcludesUnrecordedTournaments();
  console.log('All stat recording tests passed.');
}

main();
