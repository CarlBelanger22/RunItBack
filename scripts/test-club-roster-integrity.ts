/**
 * Unit tests for club roster rebuild logic.
 * Run: npm run test:club-roster-integrity
 */

import type { Game } from '../src/App';
import {
  buildClubRosterLinksFromGames,
  mergeClubRosterLinks,
  verifyClubRosters,
} from '../src/utils/clubRosterIntegrity';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const SAFSA_ID = 'team-kx-div2-safsa';
const NTU_ID = 'team-sunig-ntu';
const CARL = 'player-sunig-ntu-22';

function makeGame(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  playerIds: string[],
  homeStarters: string[] = playerIds
): Game {
  return {
    id,
    date: '2023-04-02',
    isCompleted: true,
    tournamentId: 'tournament-test',
    homeTeamId,
    awayTeamId,
    homeTeam: { id: homeTeamId, name: 'H', abbreviation: 'H', players: [] },
    awayTeam: { id: awayTeamId, name: 'A', abbreviation: 'A', players: [] },
    homeStarters,
    awayStarters: [],
    gameStats: playerIds.map((playerId) => ({
      playerId,
      points: 1,
      fg_made: 0,
      fg_attempted: 1,
      three_made: 0,
      three_attempted: 0,
      ft_made: 0,
      ft_attempted: 0,
      orb: 0,
      drb: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      fouls_drawn: 0,
      plus_minus: 0,
      minutes_played: 1,
    })),
    shots: [],
    finalScore: { home: 70, away: 60 },
  };
}

function testSafsaGameLinksCarl(): void {
  const games = [
    makeGame('g1', SAFSA_ID, 'team-opp', [CARL, 'player-safsa-2']),
  ];
  const links = buildClubRosterLinksFromGames(games);
  const safsa = links.filter((l) => l.teamId === SAFSA_ID);
  assert(safsa.length === 2, 'SAFSA should have 2 players from game');
  assert(
    safsa.some((l) => l.playerId === CARL),
    'Carl on SAFSA game side'
  );
}

function testCarlMultiTeam(): void {
  const games = [
    makeGame('g-safsa', SAFSA_ID, 'team-opp', [CARL]),
    makeGame('g-ntu', NTU_ID, 'team-opp2', [CARL]),
  ];
  const links = buildClubRosterLinksFromGames(games);
  const teams = new Set(links.filter((l) => l.playerId === CARL).map((l) => l.teamId));
  assert(teams.has(SAFSA_ID), 'Carl on SAFSA');
  assert(teams.has(NTU_ID), 'Carl on NTU');
}

function testMergeNeverDropsDerived(): void {
  const derived = buildClubRosterLinksFromGames([
    makeGame('g1', SAFSA_ID, 'team-opp', [CARL]),
  ]);
  const merged = mergeClubRosterLinks(derived, {
    existingTeams: [],
    tournamentRosters: [],
    importJerseys: new Map(),
  });
  assert(merged.length === 1, 'merged keeps derived link');
}

function testVerifyPasses(): void {
  const games = [makeGame('g1', SAFSA_ID, 'team-opp', [CARL])];
  const links = mergeClubRosterLinks(buildClubRosterLinksFromGames(games), {
    existingTeams: [],
    tournamentRosters: [],
    importJerseys: new Map(),
  });
  const teams = [
    {
      id: SAFSA_ID,
      name: 'SAFSA',
      abbreviation: 'SAF',
      players: [
        {
          id: CARL,
          name: 'Carl',
          number: 22,
          position: 'C',
          height: '',
          weight: '',
          age: 0,
        },
      ],
    },
  ];
  assert(verifyClubRosters(games, teams).length === 0, 'verify passes');
}

function main(): void {
  testSafsaGameLinksCarl();
  testCarlMultiTeam();
  testMergeNeverDropsDerived();
  testVerifyPasses();
  console.log('All club roster integrity tests passed.');
}

main();
