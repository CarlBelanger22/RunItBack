/**
 * LE-92 — Friendly game helpers, aggregate exclusion, Player Stats Friendlies row.
 * Run: npm run test:friendly-game
 */

import type { Game, Player, Team, Tournament } from '../src/App';
import {
  excludeFriendlyGames,
  FRIENDLIES_SCOPE_ID,
  FRIENDLIES_SCOPE_LABEL,
  FRIENDLY_GAME_LABEL,
  FRIENDLY_GAME_META,
  isCompetitiveGame,
  isFriendlyGame,
  onlyFriendlyGames,
  resolveGameListLabel,
  resolveGameMetaLabel,
  resolveCompletedGameTournamentId,
} from '../src/utils/friendlyGame';
import { reconcileTournamentRostersFromGames } from '../src/utils/tournamentRosters';
import {
  buildPlayerTournamentSeasonRows,
  filterPlayerSeasonRowsForTournamentSelection,
  filterTeamScopeGames,
} from '../src/utils/playerSeasonStats';
import { computeScopedTeamScoring } from '../src/utils/gameDisplay';
import { buildGameMetadataPatch } from '../src/utils/gameMetadata';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function baseGame(partial: Partial<Game> & Pick<Game, 'id'>): Game {
  return {
    homeTeam: { id: 'h', name: 'Home', abbreviation: 'HOM', players: [] },
    awayTeam: { id: 'a', name: 'Away', abbreviation: 'AWY', players: [] },
    homeTeamId: 'h',
    awayTeamId: 'a',
    date: '2026-08-01',
    gameStats: [],
    teamStats: {
      home: { teamId: 'h' } as Game['teamStats']['home'],
      away: { teamId: 'a' } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 80, away: 70 },
    tournamentId: 't1',
    ...partial,
  } as Game;
}

function testHelpers(): void {
  assert(FRIENDLY_GAME_LABEL === 'Friendly', 'label');
  assert(FRIENDLY_GAME_META === 'Friendly game', 'meta');
  assert(FRIENDLIES_SCOPE_LABEL === 'Friendlies', 'friendlies scope label');
  const friendly = baseGame({ id: 'g-f', isFriendly: true, tournamentId: undefined });
  const official = baseGame({ id: 'g-o', isFriendly: false });
  assert(isFriendlyGame(friendly) && !isFriendlyGame(official), 'isFriendlyGame');
  assert(isCompetitiveGame(official) && !isCompetitiveGame(friendly), 'isCompetitiveGame');
  assert(excludeFriendlyGames([friendly, official]).length === 1, 'exclude');
  assert(onlyFriendlyGames([friendly, official])[0].id === 'g-f', 'only friendly');
  assert(resolveGameListLabel(friendly) === 'Friendly', 'list label friendly');
  assert(resolveGameListLabel(official, 'IVP 2026') === 'IVP 2026', 'list label official');
  assert(resolveGameMetaLabel(friendly) === 'Friendly game', 'meta friendly');
  assert(resolveGameMetaLabel(official, 'IVP 2026') === 'IVP 2026', 'meta official');
}

function testFilterTeamScopeExcludesFriendly(): void {
  const games = [
    baseGame({ id: 'g1', tournamentId: 't1' }),
    baseGame({
      id: 'g2',
      isFriendly: true,
      tournamentId: undefined,
      finalScore: { home: 99, away: 10 },
    }),
  ];
  const scoped = filterTeamScopeGames(games, 'h', 'all');
  assert(scoped.length === 1 && scoped[0].id === 'g1', 'team scope excludes friendly');
  const scoring = computeScopedTeamScoring(scoped, 'h');
  assert(scoring.gamesWithScore === 1 && scoring.ppg === 80, 'PPG ignores friendly');
  // Direct scoring over mixed list also skips friendlies
  const mixedScoring = computeScopedTeamScoring(games, 'h');
  assert(mixedScoring.gamesWithScore === 1, 'computeScopedTeamScoring skips friendly');
}

function testPlayerStatsFriendliesRow(): void {
  const player: Player = {
    id: 'p1',
    name: 'Test Player',
    number: '1',
    position: 'PG',
  } as Player;
  const team: Team = {
    id: 'h',
    name: 'Home',
    abbreviation: 'HOM',
    players: [player],
  };
  const tournaments: Tournament[] = [
    {
      id: 't1',
      name: 'IVP 2026',
      year: 2026,
      month: 'Jan',
      teams: ['h'],
      games: [],
      standings: [],
    } as Tournament,
  ];

  const official = baseGame({
    id: 'g-o',
    tournamentId: 't1',
    homeTeam: { ...team, players: [player] },
    gameStats: [{ playerId: 'p1', points: 10 } as Game['gameStats'][0]],
  });
  const friendly = baseGame({
    id: 'g-f',
    isFriendly: true,
    tournamentId: undefined,
    homeTeam: { ...team, players: [player] },
    gameStats: [{ playerId: 'p1', points: 22 } as Game['gameStats'][0]],
    finalScore: { home: 22, away: 18 },
  });

  const rows = buildPlayerTournamentSeasonRows(player, [team], [official, friendly], tournaments, {
    gameFormatScope: '5v5',
  });

  const allTime = rows.find((r) => r.scopeId === 'all-time');
  const friendlies = rows.find((r) => r.scopeId === FRIENDLIES_SCOPE_ID);
  assert(!!allTime, 'all-time row present');
  assert(allTime!.gamesPlayed === 1, 'all-time excludes friendly');
  assert(!!friendlies, 'friendlies row present');
  assert(friendlies!.scopeLabel === FRIENDLIES_SCOPE_LABEL, 'friendlies label');
  assert(friendlies!.isSummaryRow === true, 'friendlies is summary');
  assert(friendlies!.gamesPlayed === 1, 'friendlies one game');
  assert(friendlies!.totalStats.points === 22, 'friendlies points');

  const allView = filterPlayerSeasonRowsForTournamentSelection(
    rows,
    null,
    ['t1'],
    null
  );
  assert(
    allView.some((r) => r.scopeId === FRIENDLIES_SCOPE_ID),
    'full view keeps Friendlies'
  );

  const filtered = filterPlayerSeasonRowsForTournamentSelection(
    rows,
    new Set(['t1']),
    ['t1', 't2'],
    null
  );
  assert(
    !filtered.some((r) => r.scopeId === FRIENDLIES_SCOPE_ID),
    'tournament filter hides Friendlies'
  );
  assert(
    !filtered.some((r) => r.scopeId === 'all-time'),
    'tournament filter hides All Time'
  );

  const merged = buildPlayerTournamentSeasonRows(
    player,
    [team],
    [official, friendly],
    tournaments,
    { gameFormatScope: '5v5', includeFriendliesInAllTime: true }
  );
  const mergedAllTime = merged.find((r) => r.scopeId === 'all-time');
  assert(!!mergedAllTime, 'merged all-time row');
  assert(mergedAllTime!.gamesPlayed === 2, 'all-time includes friendly when opted in');
  assert(mergedAllTime!.totalStats.points === 32, 'all-time sums official + friendly');
  assert(
    !merged.some((r) => r.scopeId === FRIENDLIES_SCOPE_ID),
    'no separate Friendlies row when merged'
  );
}

function testFriendlyMetadataPatchAllowsCourtFlip(): void {
  const friendly = baseGame({
    id: 'g-f-edit',
    isFriendly: true,
    tournamentId: undefined,
    courtSidesFlipped: false,
  });
  const patched = buildGameMetadataPatch(friendly, {
    date: '2026-06-25',
    startTime: '19:30',
    courtSidesFlipped: true,
  });
  assert(patched.courtSidesFlipped === true, 'court flip saves on friendly');
  assert(patched.isFriendly === true, 'stays friendly');
  assert(patched.tournamentId === undefined, 'no tournament assigned');
}

function testFriendlyCompleteKeepsNoTournament(): void {
  const friendly = baseGame({
    id: 'g-f-done',
    isFriendly: true,
    tournamentId: undefined,
    isCompleted: true,
    gameStats: [{ playerId: 'p1', points: 5 } as Game['gameStats'][0]],
  });
  assert(
    resolveCompletedGameTournamentId(friendly) === undefined,
    'friendly completion keeps no tournament'
  );
  assert(
    resolveCompletedGameTournamentId(baseGame({ id: 'g-o', isFriendly: false, tournamentId: undefined })) ===
      'tournament-summer-2024',
    'official game still defaults tournament'
  );
  const rosters = reconcileTournamentRostersFromGames(
    [friendly],
    [{ id: 'h', name: 'Home', abbreviation: 'HOM', players: [{ id: 'p1', name: 'P', number: 1, position: 'PG', height: '', weight: '', age: 0 }] }],
    []
  );
  assert(rosters.length === 0, 'completed friendly without tournament adds no roster rows');
}

function main(): void {
  testHelpers();
  testFilterTeamScopeExcludesFriendly();
  testPlayerStatsFriendliesRow();
  testFriendlyMetadataPatchAllowsCourtFlip();
  testFriendlyCompleteKeepsNoTournament();
  console.log('PASS: test-friendly-game');
}

main();
