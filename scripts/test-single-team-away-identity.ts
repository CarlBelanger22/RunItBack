/**
 * LE-91.7 Option A — single-team Opp identity helpers.
 * Run: npm run test:single-team-away-identity
 */

import type { Team } from '../src/App';
import {
  isOppIdentityReady,
  oppTournamentTeamsExcludingHome,
  toIdentityOnlyAwayTeam,
} from '../src/utils/singleTeamAwayIdentity';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function team(partial: Partial<Team> & Pick<Team, 'id' | 'name'>): Team {
  return {
    abbreviation: 'TMP',
    players: [],
    ...partial,
  };
}

function testStripsPlayersAndKeepsIdentity(): void {
  const full = team({
    id: 'team-lakers',
    name: 'Lakers',
    abbreviation: 'LAL',
    icon: '🏀',
    players: [
      {
        id: 'p1',
        name: 'A',
        number: 1,
        position: 'PG',
        height: '',
        weight: '',
        age: 0,
      },
    ],
  });
  const identity = toIdentityOnlyAwayTeam(full);
  assert(identity.id === 'team-lakers', 'keeps id');
  assert(identity.name === 'Lakers', 'keeps name');
  assert(identity.abbreviation === 'LAL', 'keeps abbrev');
  assert(identity.icon === '🏀', 'keeps icon');
  assert(identity.players.length === 0, 'strips players (Option A)');
}

function testOppIdentityReady(): void {
  assert(
    !isOppIdentityReady('none', team({ id: 'away', name: '' })),
    'none not ready'
  );
  assert(
    !isOppIdentityReady('create_new', team({ id: 'away', name: 'Opp', abbreviation: 'X' })),
    'abbrev too short not ready'
  );
  assert(
    isOppIdentityReady(
      'create_new',
      team({ id: 'away', name: 'Opp', abbreviation: 'OPP' })
    ),
    'create_new name+valid abbrev ready'
  );
  assert(
    isOppIdentityReady(
      'existing',
      team({ id: 'team-a', name: 'A', abbreviation: 'AAA', players: [] })
    ),
    'existing identity ready even with empty players'
  );
  assert(
    !isOppIdentityReady('existing', team({ id: 'away', name: 'Draft' })),
    'draft away id not ready'
  );
}

function testExcludeHomeFromOppList(): void {
  const a = team({ id: 'a', name: 'A' });
  const b = team({ id: 'b', name: 'B' });
  const all = [a, b];
  const filtered = oppTournamentTeamsExcludingHome(all, 'existing', 'a');
  assert(filtered.length === 1 && filtered[0].id === 'b', 'excludes home club');
  assert(
    oppTournamentTeamsExcludingHome(all, 'create_new', 'home').length === 2,
    'create_new home does not exclude'
  );
  assert(
    oppTournamentTeamsExcludingHome(all, 'none', undefined).length === 2,
    'no home selected keeps all'
  );
}

function main(): void {
  testStripsPlayersAndKeepsIdentity();
  testOppIdentityReady();
  testExcludeHomeFromOppList();
  console.log('PASS: test-single-team-away-identity');
}

main();
