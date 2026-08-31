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

function testDuplicateAbbrevShowsStored(): void {
  const league = [
    team('asg-sgp', 'Singapore', 'SGP'),
    team('trip-sgp', 'Singapore', 'SGP'),
    team('ntu', 'Nanyang Technological University', 'NTU'),
  ];
  assert(
    getTeamStatsAbbreviation(league[0], league) === 'SGP',
    'ASG Singapore shows SGP'
  );
  assert(
    getTeamStatsAbbreviation(league[1], league) === 'SGP',
    'Training Trip Singapore shows SGP'
  );
}

function testSharedAbbrevStillShowsStored(): void {
  const league = [
    team('kx', 'Kai Xuan', 'TST'),
    team('ntu', 'Nanyang Technological University', 'TST'),
    team('safsa', 'SAFSA', 'TST'),
  ];
  assert(
    getTeamStatsAbbreviation(league[1], league) === 'TST',
    'stored abbrev shown even when shared'
  );
  assert(
    getTeamStatsAbbreviation(league[0], league) === 'TST',
    'Kai Xuan stored abbrev shown'
  );
}

function testMissingAbbrevFallback(): void {
  const league = [team('ntu', 'Nanyang Technological University', 'NTU')];
  const noAbbrev = { id: 'kx', name: 'Kai Xuan', players: [] };
  assert(
    getTeamStatsAbbreviation(noAbbrev, league) === 'KX',
    'missing abbrev derives from name'
  );
}

function main(): void {
  testUniqueAbbrevUnchanged();
  testDuplicateAbbrevShowsStored();
  testSharedAbbrevStillShowsStored();
  testMissingAbbrevFallback();
  console.log('All team stats abbreviation tests passed.');
}

main();
