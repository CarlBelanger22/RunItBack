/**
 * Player profile badge ordering: latest activity left to right.
 * Run: npm run test:player-participation-sort
 */

import type { Game, Team, Tournament } from '../App';
import { sortPlayerTeamsByRecencyDesc } from '../src/utils/rosterPlayers';
import { getPlayerParticipatedTournaments } from '../src/utils/teamTournaments';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const playerId = 'player-carl';

const teams: Team[] = [
  { id: 'team-acjc', name: 'ACJC', abbreviation: 'ACJC', players: [{ id: playerId, name: 'Carl', number: 22, position: 'C' }] },
  { id: 'team-ntu', name: 'NTU', abbreviation: 'NTU', players: [{ id: playerId, name: 'Carl', number: 22, position: 'C' }] },
  { id: 'team-sg', name: 'Singapore', abbreviation: 'SG', players: [{ id: playerId, name: 'Carl', number: 22, position: 'C' }] },
];

const tournaments: Tournament[] = [
  { id: 't-ivp-2026', name: 'IVP 2026', year: 2026, month: 'January', teams: [] },
  { id: 't-adiv-2019', name: 'A Division 2019', year: 2019, month: 'April', teams: [] },
];

const games: Game[] = [
  {
    id: 'g-adiv',
    date: '2019-05-13',
    isCompleted: true,
    tournamentId: 't-adiv-2019',
    homeTeamId: 'team-acjc',
    awayTeamId: 'team-opp',
    homeTeam: teams[0],
    awayTeam: { id: 'team-opp', name: 'Opp', abbreviation: 'OPP', players: [] },
    gameStats: [{ playerId, minutes_played: 20, points: 6, fg_made: 3, fg_attempted: 6, three_made: 0, three_attempted: 0, ft_made: 0, ft_attempted: 2, orb: 3, drb: 8, assists: 0, steals: 0, blocks: 2, turnovers: 1, fouls: 1, fouls_drawn: 0, plus_minus: 0, blocks_received: 0, tech_fouls: 0, unsportsmanlike_fouls: 0 }],
    shots: [],
    finalScore: { home: 38, away: 28 },
  },
  {
    id: 'g-ivp',
    date: '2026-02-01',
    isCompleted: true,
    tournamentId: 't-ivp-2026',
    homeTeamId: 'team-ntu',
    awayTeamId: 'team-opp2',
    homeTeam: teams[1],
    awayTeam: { id: 'team-opp2', name: 'Opp2', abbreviation: 'OP2', players: [] },
    gameStats: [{ playerId, minutes_played: 20, points: 10, fg_made: 4, fg_attempted: 8, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 2, orb: 1, drb: 4, assists: 1, steals: 0, blocks: 0, turnovers: 0, fouls: 2, fouls_drawn: 0, plus_minus: 0, blocks_received: 0, tech_fouls: 0, unsportsmanlike_fouls: 0 }],
    shots: [],
    finalScore: { home: 70, away: 60 },
  },
];

function testTeamOrder(): void {
  const ordered = sortPlayerTeamsByRecencyDesc(playerId, teams, games);
  assert(ordered[0].id === 'team-ntu', 'latest team (NTU) should be first');
  assert(ordered[1].id === 'team-acjc', 'ACJC should be second');
  assert(ordered[2].id === 'team-sg', 'team with no games should be last');
}

function testTournamentOrder(): void {
  const ordered = getPlayerParticipatedTournaments(playerId, games, tournaments);
  assert(ordered[0].id === 't-ivp-2026', 'latest tournament should be first');
  assert(ordered[1].id === 't-adiv-2019', 'oldest tournament should be last');
}

function main(): void {
  testTeamOrder();
  testTournamentOrder();
  console.log('All player participation sort tests passed.');
}

main();
