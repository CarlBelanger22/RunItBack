/**
 * Ensures game-setup baseline logic does not treat club-only players as setup adds.
 * Run: npm run test:game-setup-no-club-mutation
 */

import type { Player, Team } from '../src/App';
import { addedPlayersFromBaseline } from '../src/utils/activeGame';
import { mergeTeamRostersUnion } from '../src/utils/clubRosterIntegrity';

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

function testBaselineUsesSetupTeamNotClubCatalog(): void {
  const p1 = makePlayer('p1', 'One', 1);
  const p2 = makePlayer('p2', 'Two', 2);
  const p3 = makePlayer('p3', 'Three', 3);
  const p4 = makePlayer('p4', 'Four', 4);
  const p5 = makePlayer('p5', 'Five', 5);
  const clubOnly = makePlayer('p-club', 'Club Only', 99);

  const clubTeam: Team = {
    id: 'team-ntu',
    name: 'NTU',
    abbreviation: 'NTU',
    players: [p1, p2, p3, p4, p5, clubOnly],
  };

  const setupTeam: Team = {
    ...clubTeam,
    players: [p1, p2, p3, p4, p5],
  };

  const baseline = { 'team-ntu': [p1.id, p2.id, p3.id, p4.id, p5.id] };

  const wrongAdded = addedPlayersFromBaseline(clubTeam, baseline, [clubTeam]);
  assert(
    wrongAdded.includes('p-club'),
    'using club catalog incorrectly flags club-only player as setup add'
  );

  const correctAdded = addedPlayersFromBaseline(setupTeam, baseline, [clubTeam]);
  assert(correctAdded.length === 0, 'setup team with same baseline should add none');
}

function testSetupAddDetectsNewSetupPlayer(): void {
  const p1 = makePlayer('p1', 'One', 1);
  const setupAdded = makePlayer('home-player-123-9', 'New', 9);
  const team: Team = {
    id: 'team-kx',
    name: 'KX',
    abbreviation: 'KX',
    players: [p1, setupAdded],
  };
  const baseline = { 'team-kx': [p1.id] };
  const added = addedPlayersFromBaseline(team, baseline, [team]);
  assert(added.length === 1 && added[0] === setupAdded.id, 'detects setup-added player');
}

function testCloudUnionRestoresClubPlayers(): void {
  const full = [
    {
      id: 'team-ntu',
      name: 'NTU',
      abbreviation: 'NTU',
      players: [makePlayer('p1', 'A', 1), makePlayer('p2', 'B', 2), makePlayer('p3', 'C', 3)],
    },
  ];
  const truncated = [
    {
      id: 'team-ntu',
      name: 'NTU',
      abbreviation: 'NTU',
      players: [makePlayer('p1', 'A', 1)],
    },
  ];
  const merged = mergeTeamRostersUnion(truncated, full);
  assert(merged[0].players.length === 3, 'union restores full club from cloud');
}

function main(): void {
  testBaselineUsesSetupTeamNotClubCatalog();
  testSetupAddDetectsNewSetupPlayer();
  testCloudUnionRestoresClubPlayers();
  console.log('All game-setup club mutation tests passed.');
}

main();
