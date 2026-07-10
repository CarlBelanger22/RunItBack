/**
 * Run: npm run test:tournament-sort
 */

import type { Tournament } from '../src/App';
import { getParticipatedTournaments } from '../src/utils/teamTournaments';
import { sortTournamentsByDateDesc } from '../src/utils/tournamentSort';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function makeTournament(
  id: string,
  name: string,
  year: number,
  month: string
): Tournament {
  return {
    id,
    name,
    year,
    month,
    teams: [],
    games: [],
    standings: [],
  };
}

function testSortTournamentsByDateDesc(): void {
  const tournaments = [
    makeTournament('t-sunig', 'Sunig 2025', 2025, 'Sep'),
    makeTournament('t-ivp', 'IVP 2026', 2026, 'Jan'),
    makeTournament('t-iubit', 'IUBIT 2026', 2026, 'Jul'),
    makeTournament('t-ausf', 'AUSF 3x3', 2026, 'Jun'),
  ];

  const sorted = sortTournamentsByDateDesc(tournaments);
  assert(
    sorted.map((t) => t.id).join(',') === 't-iubit,t-ausf,t-ivp,t-sunig',
    `latest season first: got ${sorted.map((t) => t.id).join(',')}`
  );
}

function testParticipatedTournamentsPreserveSort(): void {
  const tournaments = [
    makeTournament('t-sunig', 'Sunig 2025', 2025, 'Sep'),
    makeTournament('t-ivp', 'IVP 2026', 2026, 'Jan'),
    makeTournament('t-iubit', 'IUBIT 2026', 2026, 'Jul'),
    makeTournament('t-ausf', 'AUSF 3x3', 2026, 'Jun'),
  ];
  const teamId = 'team-sunig-ntu';

  for (const tournament of tournaments) {
    tournament.teams = [teamId];
  }

  const participated = getParticipatedTournaments(teamId, [], tournaments);
  assert(
    participated.map((t) => t.id).join(',') === 't-iubit,t-ausf,t-ivp,t-sunig',
    `team filter options order: got ${participated.map((t) => t.id).join(',')}`
  );
}

function main(): void {
  testSortTournamentsByDateDesc();
  testParticipatedTournamentsPreserveSort();
  console.log('test-tournament-sort: all checks passed');
}

main();
