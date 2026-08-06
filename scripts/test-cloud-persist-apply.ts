/**
 * LE-101 — rapid-edit / in-flight save divergence.
 * Run: npm run test:cloud-persist-apply
 */
import { localPersistSliceDiverged } from '../src/lib/cloudPersistApply';
import type { Team, Tournament } from '../src/App';
import type { TournamentRosterEntry } from '../src/utils/tournamentRosters';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function team(id: string): Team {
  return { id, name: id, abbreviation: id, players: [] };
}

function tournament(
  id: string,
  structure?: Tournament['structure']
): Tournament {
  return {
    id,
    name: id,
    year: 2026,
    month: 'July',
    teams: [],
    games: [],
    structure,
  };
}

function main(): void {
  const tSaved = tournament('ivp', {
    stages: [
      {
        id: 's1',
        name: 'Groups',
        kind: 'round_robin',
        order: 1,
        groups: [{ id: 'g1', name: 'A', teamIds: ['ntu'] }],
      },
    ],
  });
  const tLocal = tournament('ivp', {
    stages: [
      {
        id: 's1',
        name: 'Groups',
        kind: 'round_robin',
        order: 1,
        groups: [{ id: 'g1', name: 'A', teamIds: ['ntu', 'ite'] }],
      },
    ],
  });

  assert(
    localPersistSliceDiverged({
      savedTeams: [team('ntu')],
      savedTournaments: [tSaved],
      savedRosters: [],
      localTeams: [team('ntu')],
      localTournaments: [tLocal],
      localRosters: [],
    }),
    'structure edit during save diverges'
  );

  assert(
    !localPersistSliceDiverged({
      savedTeams: [team('ntu')],
      savedTournaments: [tSaved],
      savedRosters: [],
      localTeams: [team('ntu')],
      localTournaments: [tSaved],
      localRosters: [],
    }),
    'identical slices do not diverge'
  );

  const rosterSaved: TournamentRosterEntry[] = [
    {
      tournamentId: 'ivp',
      teamId: 'ntu',
      playerId: 'p1',
      number: 1,
      position: 'G',
    },
  ];
  const rosterLocal: TournamentRosterEntry[] = [
    ...rosterSaved,
    {
      tournamentId: 'ivp',
      teamId: 'ntu',
      playerId: 'p2',
      number: 2,
      position: 'F',
    },
  ];

  assert(
    localPersistSliceDiverged({
      savedTeams: [team('ntu')],
      savedTournaments: [tSaved],
      savedRosters: rosterSaved,
      localTeams: [team('ntu')],
      localTournaments: [tSaved],
      localRosters: rosterLocal,
    }),
    'roster add during save diverges'
  );

  console.log('PASS: test-cloud-persist-apply');
}

main();
