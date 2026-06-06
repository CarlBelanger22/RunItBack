/**
 * Unit tests for deduped league player search.
 * Run: npm run test:search-league-players
 */

import type { Player, Team } from '../src/App';
import { searchLeaguePlayers } from '../src/utils/rosterPlayers';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function makePlayer(id: string, name: string, number = 22): Player {
  return {
    id,
    name,
    number,
    position: 'C',
    height: '',
    weight: '',
    age: 0,
  };
}

function makeTeam(id: string, name: string, players: Player[]): Team {
  return {
    id,
    name,
    abbreviation: name.slice(0, 3).toUpperCase(),
    players,
  };
}

function testMultiTeamPlayerDeduped(): void {
  const carl = makePlayer('player-sunig-ntu-22', 'Carl Belanger');
  const teams = [
    makeTeam('team-safsa', 'SAFSA Arion', [carl]),
    makeTeam('team-ntu', 'Nanyang Technological University', [carl]),
    makeTeam('team-kx', 'Kai Xuan', [carl]),
  ];

  const results = searchLeaguePlayers(teams, 'carl');
  assert(results.length === 1, 'Carl should appear once');
  assert(results[0].player.id === carl.id, 'Carl id');
  assert(results[0].teamNames.length === 3, 'Carl has three teams');
}

function testDuplicateTeamIdIgnored(): void {
  const carl = makePlayer('player-sunig-ntu-22', 'Carl Belanger');
  const teams = [
    makeTeam('team-safsa', 'SAFSA Arion', [carl]),
    makeTeam('team-safsa', 'SAFSA Arion', [carl]),
    makeTeam('team-ntu', 'NTU', [carl]),
  ];

  const results = searchLeaguePlayers(teams, 'carl');
  assert(results.length === 1, 'one player row');
  assert(results[0].teamNames.length === 2, 'duplicate team id not listed twice');
}

function testTwoPlayersMatching(): void {
  const carl = makePlayer('player-1', 'Carl Belanger');
  const carla = makePlayer('player-2', 'Carla Smith', 10);
  const teams = [makeTeam('team-a', 'Team A', [carl, carla])];

  const results = searchLeaguePlayers(teams, 'car');
  assert(results.length === 2, 'Carl and Carla match');
}

function testOrphanIncluded(): void {
  const orphan = makePlayer('player-orphan', 'Carlos Ruiz', 7);
  const results = searchLeaguePlayers([], 'carlos', { orphanPlayers: [orphan] });
  assert(results.length === 1, 'orphan player found');
  assert(results[0].teamNames[0] === 'No team', 'orphan label');
}

function main(): void {
  testMultiTeamPlayerDeduped();
  testDuplicateTeamIdIgnored();
  testTwoPlayersMatching();
  testOrphanIncluded();
  console.log('All searchLeaguePlayers tests passed.');
}

main();
