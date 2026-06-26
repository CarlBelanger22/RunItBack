/**
 * Run: npm run test:player-jersey-resolution
 */

import type { Game, Team, Tournament } from '../src/App';
import type { TournamentRosterEntry } from '../src/utils/tournamentRosters';
import {
  buildPlayerJerseyEditorGroups,
  buildPlayerJerseyScopeEntries,
  resolveLatestJerseyNumber,
} from '../src/utils/playerJerseyResolution';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const PLAYER = 'player-1';
const TEAM_NTU = 'team-ntu';

function team(id: string, name: string, players: Team['players'] = []): Team {
  return { id, name, abbreviation: id, players };
}

function tournament(id: string, name: string, month: string, year: number): Tournament {
  return {
    id,
    name,
    month,
    year,
    teams: [TEAM_NTU],
    games: [],
  };
}

const teams: Team[] = [
  team(TEAM_NTU, 'NTU', [
    {
      id: PLAYER,
      name: 'Kovan',
      number: 21,
      position: 'C',
      height: '',
      weight: '',
      age: 22,
    },
  ]),
];

const tournaments: Tournament[] = [
  tournament('t-sunig', 'Sunig 2025', 'December', 2025),
  tournament('t-ivp', 'IVP 2026', 'June', 2026),
];

const rosters: TournamentRosterEntry[] = [
  {
    tournamentId: 't-sunig',
    teamId: TEAM_NTU,
    playerId: PLAYER,
    number: 21,
    position: 'C',
  },
  {
    tournamentId: 't-ivp',
    teamId: TEAM_NTU,
    playerId: PLAYER,
    number: 4,
    position: 'C',
  },
];

const games: Game[] = [
  {
    id: 'g1',
    tournamentId: 't-sunig',
    homeTeamId: TEAM_NTU,
    awayTeamId: 'team-away',
    isCompleted: true,
    gameStats: [{ playerId: PLAYER } as Game['gameStats'][0]],
  } as Game,
  {
    id: 'g2',
    tournamentId: 't-ivp',
    homeTeamId: TEAM_NTU,
    awayTeamId: 'team-away',
    isCompleted: true,
    gameStats: [{ playerId: PLAYER } as Game['gameStats'][0]],
  } as Game,
];

function testLatestJersey(): void {
  const latest = resolveLatestJerseyNumber(
    TEAM_NTU,
    PLAYER,
    rosters,
    tournaments,
    games,
    teams,
    21
  );
  assert(latest === 4, 'latest tournament jersey is IVP #4');
}

function testScopeEntriesTwoIcons(): void {
  const entries = buildPlayerJerseyScopeEntries(PLAYER, teams, games, rosters);
  assert(entries.length === 2, 'two distinct numbers → two scope entries');
  assert(
    entries.some((e) => e.number === 21 && e.team.id === TEAM_NTU),
    'includes #21 NTU'
  );
  assert(
    entries.some((e) => e.number === 4 && e.team.id === TEAM_NTU),
    'includes #4 NTU'
  );
}

function testEditorGroups(): void {
  const groups = buildPlayerJerseyEditorGroups(
    PLAYER,
    teams,
    tournaments,
    games,
    rosters
  );
  assert(groups.length === 1, 'one team group');
  assert(groups[0].clubNumber === 21, 'club number from team_players');
  assert(groups[0].tournaments.length === 2, 'two tournament sub-rows');
}

function main(): void {
  testLatestJersey();
  testScopeEntriesTwoIcons();
  testEditorGroups();
  console.log('All player jersey resolution tests passed.');
}

main();
