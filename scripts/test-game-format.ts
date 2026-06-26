/**
 * Run: npm run test:game-format
 */

import type { Game, Tournament } from '../src/App';
import {
  DEFAULT_GAME_FORMAT_SCOPE,
  filterGamesByFormatScope,
  getTournamentGameFormat,
  parseGameFormatScope,
  allTimeScopeLabel,
} from '../src/utils/gameFormat';
import { buildPlayerTournamentSeasonRows } from '../src/utils/playerSeasonStats';
import type { Player, Team } from '../src/App';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const AUSF_ID = 'tournament-1782412204083';
const IVP_ID = 'tournament-1768327829049';

function makeGame(id: string, tournamentId: string): Game {
  return {
    id,
    tournamentId,
    date: '2026-06-12',
    isCompleted: true,
    homeTeamId: 'team-sunig-ntu',
    awayTeamId: 'team-opp',
    gameStats: [{ playerId: 'player-sunig-ntu-22', points: 7 } as Game['gameStats'][0]],
    shots: [],
    finalScore: { home: 12, away: 19 },
  } as Game;
}

function testTournamentFormatDetection(): void {
  assert(getTournamentGameFormat(AUSF_ID) === '3x3', 'AUSF is 3x3');
  assert(getTournamentGameFormat(IVP_ID) === '5v5', 'IVP is 5v5');
  assert(getTournamentGameFormat(undefined) === '5v5', 'missing id defaults 5v5');
}

function testParseScope(): void {
  assert(parseGameFormatScope(null) === DEFAULT_GAME_FORMAT_SCOPE, 'null → 5v5');
  assert(parseGameFormatScope('3x3') === '3x3', '3x3');
  assert(parseGameFormatScope('combined') === 'combined', 'combined');
  assert(parseGameFormatScope('invalid') === '5v5', 'invalid → 5v5');
}

function testFilterGames(): void {
  const games = [
    makeGame('g-ausf', AUSF_ID),
    makeGame('g-ivp', IVP_ID),
  ];
  const tournaments = [
    { id: AUSF_ID, name: 'AUSF', year: 2026, month: 'Jun', teams: [], games: [], standings: [] },
    { id: IVP_ID, name: 'IVP', year: 2026, month: 'Jan', teams: [], games: [], standings: [] },
  ] as Tournament[];

  assert(
    filterGamesByFormatScope(games, '5v5', tournaments).length === 1,
    '5v5 scope keeps IVP only'
  );
  assert(
    filterGamesByFormatScope(games, '3x3', tournaments)[0]?.id === 'g-ausf',
    '3x3 scope keeps AUSF only'
  );
  assert(filterGamesByFormatScope(games, 'combined', tournaments).length === 2, 'combined keeps all');
}

function testAllTimeLabel(): void {
  assert(allTimeScopeLabel('5v5') === 'All Time (5v5)', '5v5 label');
  assert(allTimeScopeLabel('3x3') === 'All Time (3×3)', '3x3 label');
  assert(allTimeScopeLabel('combined') === 'All Time', 'combined label');
}

function testBuildPlayerRowsRespectsFormat(): void {
  const player: Player = {
    id: 'player-sunig-ntu-22',
    name: 'Carl',
    number: 22,
    position: 'SG',
    height: '',
    weight: '',
    age: 0,
  };
  const team: Team = {
    id: 'team-sunig-ntu',
    name: 'NTU',
    abbreviation: 'NTU',
    players: [player],
  };
  const tournaments = [
    { id: AUSF_ID, name: 'AUSF', year: 2026, month: 'Jun', teams: [], games: [], standings: [] },
    { id: IVP_ID, name: 'IVP', year: 2026, month: 'Jan', teams: [], games: [], standings: [] },
  ] as Tournament[];
  const games = [
    makeGame('g-ausf', AUSF_ID),
    makeGame('g-ivp', IVP_ID),
  ];

  const scoped5v5 = buildPlayerTournamentSeasonRows(player, [team], games, tournaments, {
    gameFormatScope: '5v5',
  });
  const dataRows5v5 = scoped5v5.filter((r) => !r.isSummaryRow);
  assert(dataRows5v5.length === 1, '5v5 scope shows one tournament row');
  assert(dataRows5v5[0]?.scopeId === IVP_ID, '5v5 row is IVP');

  const allTime5v5 = scoped5v5.find((r) => r.isSummaryRow);
  assert(allTime5v5?.scopeLabel === 'All Time (5v5)', '5v5 all-time label');
  assert(allTime5v5?.gamesPlayed === 1, '5v5 all-time is one game');

  const scoped3x3 = buildPlayerTournamentSeasonRows(player, [team], games, tournaments, {
    gameFormatScope: '3x3',
  });
  assert(
    scoped3x3.filter((r) => !r.isSummaryRow)[0]?.scopeId === AUSF_ID,
    '3x3 scope shows AUSF row'
  );
}

function main(): void {
  testTournamentFormatDetection();
  testParseScope();
  testFilterGames();
  testAllTimeLabel();
  testBuildPlayerRowsRespectsFormat();
  console.log('All game format tests passed.');
}

main();
