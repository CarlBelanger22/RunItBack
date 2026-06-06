/**
 * Tournament enrollment from import bundles.
 * Run: npm run test:tournament-enrollment
 */

import {
  buildTournamentTeamEnrollmentIds,
  buildTournamentTeamRows,
} from '../src/utils/tournamentEnrollment';

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

function main(): void {
  testAutoEnrollGameTeams();
  testKaiXuanNbl2023Case();
  testDedupes();
  console.log('All tournament enrollment tests passed.');
}

main();
