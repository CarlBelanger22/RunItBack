/**
 * Unit tests for game setup roster filtering (tournament-only players).
 * Run: npm run test:game-setup-roster
 */

import type { Player, Team } from '../src/App';
import { getPlayersForTeamInTournament } from '../src/utils/tournamentRosters';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function makePlayer(id: string, name: string, number: number): Player {
  return {
    id,
    name,
    number,
    position: 'PG',
    height: '',
    weight: '',
    age: 0,
  };
}

function testTournamentRosterStrictFilter(): void {
  const onRoster = makePlayer('p1', 'Starter One', 1);
  const onRoster2 = makePlayer('p2', 'Starter Two', 2);
  const clubOnly = makePlayer('p-club', 'Club Only', 99);
  const team: Team = {
    id: 'team-kx',
    name: 'Kai Xuan',
    abbreviation: 'KX',
    players: [onRoster, onRoster2, clubOnly],
  };

  const tournamentRosters = [
    { tournamentId: 't-ivp', teamId: team.id, playerId: onRoster.id, number: 1, position: 'PG' },
    { tournamentId: 't-ivp', teamId: team.id, playerId: onRoster2.id, number: 2, position: 'SG' },
  ];

  const filtered = getPlayersForTeamInTournament(
    team.id,
    't-ivp',
    [team],
    tournamentRosters
  );

  assert(filtered.length === 2, 'only tournament-registered players returned');
  assert(
    !filtered.some((p) => p.id === clubOnly.id),
    'club-only player excluded'
  );
}

function testEmptyTournamentRoster(): void {
  const team: Team = {
    id: 'team-empty',
    name: 'Empty',
    abbreviation: 'EMP',
    players: [makePlayer('p1', 'A', 1)],
  };

  const filtered = getPlayersForTeamInTournament(
    team.id,
    't-none',
    [team],
    []
  );

  assert(filtered.length === 0, 'empty roster returns no players (blocks start)');
}

function testStarterOrderFromSortedRoster(): void {
  const players = [
    makePlayer('p10', 'Ten', 10),
    makePlayer('p3', 'Three', 3),
    makePlayer('p7', 'Seven', 7),
  ];
  const sorted = [...players].sort(
    (a, b) => a.number - b.number || a.name.localeCompare(b.name)
  );
  const starters = sorted.slice(0, 5).map((p) => p.id);
  assert(starters[0] === 'p3', 'first starter is lowest jersey');
  assert(starters.length === 3, 'fewer than 5 when roster small');
}

function main(): void {
  testTournamentRosterStrictFilter();
  testEmptyTournamentRoster();
  testStarterOrderFromSortedRoster();
  console.log('All game setup roster tests passed.');
}

main();
