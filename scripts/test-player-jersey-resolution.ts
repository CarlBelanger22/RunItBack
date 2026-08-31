/**
 * Run: npm run test:player-jersey-resolution
 */

import type { Game, Team, Tournament } from '../src/App';
import type { TournamentRosterEntry } from '../src/utils/tournamentRosters';
import {
  buildPlayerJerseyEditorGroups,
  buildPlayerJerseyScopeEntries,
  resolveClubJerseyByTeamId,
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
const TEAM_SGP = 'team-sgp';

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

function roster(
  tournamentId: string,
  teamId: string,
  number: number
): TournamentRosterEntry {
  return {
    tournamentId,
    teamId,
    playerId: PLAYER,
    number,
    position: 'C',
  };
}

function completedGame(
  id: string,
  tournamentId: string,
  teamId: string,
  date: string
): Game {
  return {
    id,
    tournamentId,
    homeTeamId: teamId,
    awayTeamId: 'team-away',
    date,
    isCompleted: true,
    gameStats: [{ playerId: PLAYER } as Game['gameStats'][0]],
  } as Game;
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
  roster('t-sunig', TEAM_NTU, 21),
  roster('t-ivp', TEAM_NTU, 4),
];

const games: Game[] = [
  completedGame('g1', 't-sunig', TEAM_NTU, '2025-12-01'),
  completedGame('g2', 't-ivp', TEAM_NTU, '2026-06-15'),
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

function testEditorGroupsNewestFirstAndClubFromLatest(): void {
  const groups = buildPlayerJerseyEditorGroups(
    PLAYER,
    teams,
    tournaments,
    games,
    rosters
  );
  assert(groups.length === 1, 'one team group');
  assert(groups[0].tournaments.length === 2, 'two tournament sub-rows');
  assert(
    groups[0].tournaments[0].tournamentId === 't-ivp',
    'newest tournament listed first'
  );
  assert(
    groups[0].tournaments[1].tournamentId === 't-sunig',
    'older tournament listed second'
  );
  assert(groups[0].clubNumber === 4, 'club number defaults to latest tournament #');
}

function testSameSeasonUsesMostRecentGameDate(): void {
  const sgpTeams: Team[] = [
    team(TEAM_SGP, 'Singapore', [
      {
        id: PLAYER,
        name: 'Louis',
        number: 10,
        position: 'PG',
        height: '',
        weight: '',
        age: 23,
      },
    ]),
  ];
  const sgpTournaments: Tournament[] = [
    tournament('t-train', 'Indonesia Training Trip', 'August', 2026),
    tournament('t-fiba', 'FIBA Asia Cup 2029 Pre-Qualifiers', 'August', 2026),
  ];
  // Training Trip has MORE games but earlier dates — FIBA must still win via game date.
  const sgpGames: Game[] = [
    completedGame('gt1', 't-train', TEAM_SGP, '2026-08-14'),
    completedGame('gt2', 't-train', TEAM_SGP, '2026-08-15'),
    completedGame('gt3', 't-train', TEAM_SGP, '2026-08-16'),
    completedGame('gf1', 't-fiba', TEAM_SGP, '2026-08-28'),
    completedGame('gf2', 't-fiba', TEAM_SGP, '2026-08-31'),
  ];
  const sgpRosters: TournamentRosterEntry[] = [
    roster('t-train', TEAM_SGP, 10),
    roster('t-fiba', TEAM_SGP, 4),
  ];

  const groups = buildPlayerJerseyEditorGroups(
    PLAYER,
    sgpTeams,
    sgpTournaments,
    sgpGames,
    sgpRosters
  );
  assert(groups[0].tournaments[0].tournamentId === 't-fiba', 'FIBA above Training Trip');
  assert(groups[0].tournaments[0].number === 4, 'FIBA jersey on top');
  assert(groups[0].clubNumber === 4, 'club mirrors FIBA via latest game date');

  const latest = resolveLatestJerseyNumber(
    TEAM_SGP,
    PLAYER,
    sgpRosters,
    sgpTournaments,
    sgpGames,
    sgpTeams,
    10
  );
  assert(latest === 4, 'resolveLatestJerseyNumber prefers later game date');
}

function testSaveClubIgnoresDraftWhenTournamentsExist(): void {
  const groups = buildPlayerJerseyEditorGroups(
    PLAYER,
    teams,
    tournaments,
    games,
    rosters
  );
  const club = resolveClubJerseyByTeamId(
    groups,
    { [TEAM_NTU]: '99' },
    {
      [`${TEAM_NTU}:t-ivp`]: '4',
      [`${TEAM_NTU}:t-sunig`]: '21',
    }
  );
  assert(club[TEAM_NTU] === 4, 'save uses latest tournament draft, not club draft 99');
}

function testSaveClubUsesDraftWhenNoTournaments(): void {
  const bareTeams: Team[] = [
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
  const groups = buildPlayerJerseyEditorGroups(
    PLAYER,
    bareTeams,
    [],
    [],
    []
  );
  assert(groups[0].tournaments.length === 0, 'no tournament rows');
  const club = resolveClubJerseyByTeamId(groups, { [TEAM_NTU]: '7' }, {});
  assert(club[TEAM_NTU] === 7, 'no tournaments → club draft wins');
}

function main(): void {
  testLatestJersey();
  testScopeEntriesTwoIcons();
  testEditorGroupsNewestFirstAndClubFromLatest();
  testSameSeasonUsesMostRecentGameDate();
  testSaveClubIgnoresDraftWhenTournamentsExist();
  testSaveClubUsesDraftWhenNoTournaments();
  console.log('All player jersey resolution tests passed.');
}

main();
