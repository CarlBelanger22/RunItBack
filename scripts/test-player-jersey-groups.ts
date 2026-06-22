/**
 * Unit tests for grouping player jersey entries by number.
 * Run: npm run test:player-jersey-groups
 */

import type { Team } from '../src/App';
import {
  groupJerseyEntriesByNumber,
  jerseyGroupAriaLabel,
} from '../src/utils/playerJerseyGroups';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function team(id: string, name: string): Team {
  return { id, name, abbreviation: id, players: [] };
}

function testCarlFiveTeamsSameNumber(): void {
  const entries = [
    { team: team('team-ntu', 'NTU'), number: 22 },
    { team: team('team-kx', 'Kai Xuan'), number: 22 },
    { team: team('team-safsa', 'SAFSA'), number: 22 },
    { team: team('team-sg', 'Singapore'), number: 22 },
    { team: team('team-acjc', 'ACJC'), number: 22 },
  ];

  const groups = groupJerseyEntriesByNumber(entries);
  assert(groups.length === 1, 'Carl should show one jersey group');
  assert(groups[0].number === 22, 'group number is 22');
  assert(groups[0].teams.length === 5, 'group lists five teams');
  assert(groups[0].teams[0].id === 'team-ntu', 'NTU first (recency preserved)');
  assert(groups[0].teams[4].id === 'team-acjc', 'ACJC last');
}

function testMixedNumbers(): void {
  const entries = [
    { team: team('team-ntu', 'NTU'), number: 7 },
    { team: team('team-kx', 'Kai Xuan'), number: 22 },
    { team: team('team-safsa', 'SAFSA'), number: 22 },
  ];

  const groups = groupJerseyEntriesByNumber(entries);
  assert(groups.length === 2, 'two distinct jersey numbers');
  assert(groups[0].number === 7, 'first group is #7');
  assert(groups[1].number === 22, 'second group is #22');
  assert(groups[1].teams.length === 2, '#22 has two teams');
}

function testSingleTeamUnchanged(): void {
  const entries = [{ team: team('team-ntu', 'NTU'), number: 22 }];
  const groups = groupJerseyEntriesByNumber(entries);
  assert(groups.length === 1, 'single team one group');
  assert(
    jerseyGroupAriaLabel(groups[0]).includes('NTU'),
    'aria label includes team name'
  );
}

function main(): void {
  testCarlFiveTeamsSameNumber();
  testMixedNumbers();
  testSingleTeamUnchanged();
  console.log('All player jersey group tests passed.');
}

main();
