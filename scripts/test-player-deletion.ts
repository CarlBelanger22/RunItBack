/**
 * Player deletion evaluation helpers.
 *
 * Usage: npx tsx scripts/test-player-deletion.ts
 */

import type { Game, Player, Team } from '../src/App';
import {
  evaluatePlayerDeletion,
  playerDeletionBlockMessage,
  playerDeletionConfirmMessage,
} from '../src/utils/rosterPlayerRemoval';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const player: Player = {
  id: 'p1',
  name: 'Test Player',
  number: 7,
  position: 'PG',
};

const teamA: Team = {
  id: 'team-a',
  name: 'Team A',
  abbreviation: 'TMA',
  players: [player],
};

const teamB: Team = {
  id: 'team-b',
  name: 'Team B',
  abbreviation: 'TMB',
  players: [player],
};

function minimalGame(overrides: Partial<Game>): Game {
  const home = teamA;
  const away = {
    id: 'away',
    name: 'Away',
    abbreviation: 'AWY',
    players: [] as Player[],
  };
  return {
    id: 'g',
    date: '2026-01-01',
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    gameStats: [],
    teamStats: { home: {} as Game['teamStats']['home'], away: {} as Game['teamStats']['away'] },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: false,
    ...overrides,
  };
}

const statGame = minimalGame({
  id: 'g1',
  isCompleted: true,
  gameStats: [{ playerId: 'p1', points: 5 } as Game['gameStats'][number]],
});

const activeGame = minimalGame({
  id: 'g2',
  isActive: true,
  isCompleted: false,
  gameStats: [{ playerId: 'p1', points: 2 } as Game['gameStats'][number]],
});

const allowed = evaluatePlayerDeletion('p1', [], [teamA]);
assert(allowed.allowed === true, 'no games → allowed');
assert(allowed.teamIds.length === 1, 'one team');

const multi = evaluatePlayerDeletion('p1', [], [teamA, teamB]);
assert(multi.teamIds.length === 2, 'multi-team ids');

const blockedStats = evaluatePlayerDeletion('p1', [statGame], [teamA]);
assert(blockedStats.allowed === false, 'stats block delete');
assert(blockedStats.reason === 'has_games', 'has_games reason');
assert(
  playerDeletionBlockMessage(blockedStats, player.name).title ===
    'Cannot delete player',
  'block message title'
);

const blockedActive = evaluatePlayerDeletion('p1', [activeGame], [teamA]);
assert(blockedActive.allowed === false, 'active game blocks delete');
assert(blockedActive.reason === 'active_game', 'active_game reason');

const confirm = playerDeletionConfirmMessage(player.name, 2);
assert(confirm.title.includes(player.name), 'confirm title has name');
assert(confirm.description.includes('2 teams'), 'confirm mentions team count');

console.log('test-player-deletion: PASS');
