/**
 * Team stats abbreviation display tests.
 * Run: npm run test:team-stats-abbreviation
 */

import { getTeamStatsAbbreviation } from '../src/utils/teamAbbreviation';
import type { Team } from '../src/App';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function team(id: string, name: string, abbreviation: string): Team {
  return { id, name, abbreviation, players: [] };
}

function testUniqueAbbrevUnchanged(): void {
  const league = [
    team('a', 'Fairfield', 'FMSS'),
    team('b', 'Nanyang Technological University', 'NTU'),
  ];
  assert(
    getTeamStatsAbbreviation(league[1], league) === 'NTU',
    'unique abbreviation kept'
  );
}

function testCollisionDerivesFromName(): void {
  const league = [
    team('kx', 'Kai Xuan', 'TST'),
    team('ntu', 'Nanyang Technological University', 'TST'),
    team('safsa', 'SAFSA', 'TST'),
  ];
  const ntu = getTeamStatsAbbreviation(league[1], league);
  const kx = getTeamStatsAbbreviation(league[0], league);
  assert(ntu !== 'TST', 'NTU row should not show generic TST');
  assert(kx !== 'TST', 'Kai Xuan row should not show generic TST');
  assert(ntu !== kx, 'distinct teams get distinct labels');
}

function main(): void {
  testUniqueAbbrevUnchanged();
  testCollisionDerivesFromName();
  console.log('All team stats abbreviation tests passed.');
}

main();
