/**
 * Tournament enrollment from import bundles.
 * Run: npm run test:tournament-enrollment
 */

import {
  buildTournamentTeamEnrollmentIds,
  buildTournamentTeamRows,
  reconcileTournamentsFromGames,
  tournamentTeamIdsFromGames,
  filterGamesForTournament,
} from '../src/utils/tournamentEnrollment';
import type { Game, Tournament } from '../src/App';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function testAutoEnrollGameTeams(): void {
  const ids = buildTournamentTeamEnrollmentIds(
    ['team-a', 'team-b', 'team-c'],
    'team-home',
    'team-away'
  );
  assert(ids.length === 5, 'merges bundle teamIds with home/away');
  assert(ids.includes('team-home'), 'includes home');
  assert(ids.includes('team-away'), 'includes away');
}

function testKaiXuanNbl2023Case(): void {
  const bundleTeamIds = [
    'team-kts',
    'team-police',
    'team-kx-div2-safsa',
    'team-mob',
    'team-tungsan',
    'team-clementi',
    'team-skc',
    'team-macpherson',
    'team-sba',
    'team-chong-ghee',
  ];
  const rows = buildTournamentTeamRows(
    'tournament-1780425044074',
    bundleTeamIds,
    'team-kx-div2-safsa',
    'team-1780252086140'
  );
  assert(rows.length === 11, `expected 11 enrollment rows, got ${rows.length}`);
  assert(
    rows.some((r) => r.team_id === 'team-1780252086140'),
    'Kai Xuan in tournament_teams rows'
  );
}

function testDedupes(): void {
  const ids = buildTournamentTeamEnrollmentIds(
    ['team-a', 'team-b'],
    'team-a',
    'team-b'
  );
  assert(ids.length === 2, 'no duplicate ids');
}

function testReconcileTournamentsFromGames(): void {
  const tournaments: Tournament[] = [
    {
      id: 'tournament-1',
      name: 'T1',
      year: 2018,
      month: 'Jan',
      teams: ['team-fairfield'],
      games: [],
      standings: [],
    },
  ];
  const games: Game[] = [
    {
      id: 'game-1',
      homeTeamId: 'team-fairfield',
      awayTeamId: 'team-opp',
      tournamentId: 'tournament-1',
      date: '2018-01-01',
      gameStats: [],
      isActive: false,
      isCompleted: true,
    },
  ];

  const reconciled = reconcileTournamentsFromGames(tournaments, games);
  assert(reconciled[0].teams.length === 2, 'enrolls home and away from games');
  assert(reconciled[0].teams.includes('team-opp'), 'includes opponent');
  assert(reconciled[0].games.length === 1, 'syncs game ids');
  assert(
    tournamentTeamIdsFromGames('tournament-1', games, ['team-extra']).includes(
      'team-extra'
    ),
    'preserves manual enrollment not yet in games'
  );
  assert(
    filterGamesForTournament(reconciled[0], games).length === 1,
    'filterGamesForTournament by tournamentId'
  );
}

function main(): void {
  testAutoEnrollGameTeams();
  testKaiXuanNbl2023Case();
  testDedupes();
  testReconcileTournamentsFromGames();
  console.log('All tournament enrollment tests passed.');
}

main();
