/**
 * Ghost team partition helpers.
 *
 * Usage: npx tsx scripts/test-ghost-teams.ts
 */

import type { Team } from '../src/App';
import {
  countGhostTeams,
  countRealTeams,
  isGhostTeam,
  partitionTeams,
  sortTeamsByPlayerCountDesc,
} from '../src/utils/ghostTeams';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function team(id: string, playerCount: number): Team {
  return {
    id,
    name: id,
    abbreviation: id.slice(0, 3).toUpperCase(),
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `${id}-p${i}`,
      name: `Player ${i}`,
      number: i + 1,
      position: 'PG',
    })),
  };
}

assert(isGhostTeam(team('empty', 0)), '0 players is ghost');
assert(!isGhostTeam(team('full', 3)), '3 players is not ghost');

const mixed = [team('a', 0), team('b', 5), team('c', 0), team('d', 1)];
const { realTeams, ghostTeams } = partitionTeams(mixed);
assert(realTeams.length === 2, 'two real teams');
assert(ghostTeams.length === 2, 'two ghost teams');
assert(countRealTeams(mixed) === 2, 'countRealTeams');
assert(countGhostTeams(mixed) === 2, 'countGhostTeams');

const sorted = sortTeamsByPlayerCountDesc(mixed);
assert(sorted[0].players.length === 5, 'largest roster first');
assert(sorted[sorted.length - 1].players.length === 0, 'smallest roster last');

console.log('test-ghost-teams: PASS');
