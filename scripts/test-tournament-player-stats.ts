/**
 * Tournament Player Stats — roster-only rows on tournament pages.
 * Run: npm run test:tournament-player-stats
 */

import type { Game, Player, Team } from '../src/App';
import { aggregatePlayerSeasonStats } from '../src/utils/playerSeasonStats';
import type { TournamentRosterEntry } from '../src/utils/tournamentRosters';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function makePlayer(id: string, name: string): Player {
  return {
    id,
    name,
    number: 22,
    position: 'C',
    height: '',
    weight: '',
    age: 0,
  };
}

function makeTeam(id: string, name: string, players: Player[]): Team {
  return {
    id,
    name,
    abbreviation: id.slice(-3).toUpperCase(),
    players,
  };
}

function makeCarlOnlyGame(
  id: string,
  tournamentId: string,
  home: Team,
  away: Team,
  playerId: string
): Game {
  return {
    id,
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    tournamentId,
    date: '2019-11-19',
    gameStats: [
      {
        playerId,
        points: 7,
        fg_made: 3,
        fg_attempted: 3,
        three_made: 0,
        three_attempted: 0,
        ft_made: 1,
        ft_attempted: 1,
        orb: 2,
        drb: 3,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 1,
        tech_fouls: 0,
        unsportsmanlike_fouls: 0,
        fouls_drawn: 0,
        blocks_received: 0,
        plus_minus: 0,
        minutes_played: 22,
      },
    ],
    teamStats: { home: {} as never, away: {} as never },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '00:00',
    homeStarters: [playerId],
    awayStarters: [],
    trackBothTeams: false,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 51, away: 79 },
  };
}

function testTournamentRosterOnlyRows(): void {
  const carl = makePlayer('player-carl', 'Carl Belanger');
  const benchA = makePlayer('player-bench-a', 'Bench A');
  const benchB = makePlayer('player-bench-b', 'Bench B');

  const kx = makeTeam('team-kx', 'Kai Xuan', [carl, benchA]);
  const safsa = makeTeam('team-safsa', 'SAFSA', [benchB, makePlayer('player-safsa-2', 'SAFSA Two')]);
  const opp = makeTeam('team-opp', 'Novu Blaze', []);

  const tournamentId = 't-shenggong';
  const games = [makeCarlOnlyGame('g1', tournamentId, kx, opp, carl.id)];

  const tournamentRosters: TournamentRosterEntry[] = [
    {
      tournamentId,
      teamId: kx.id,
      playerId: carl.id,
      number: 22,
      position: 'C',
    },
  ];

  const withoutRosterFilter = aggregatePlayerSeasonStats(games, [kx, safsa]);
  assert(
    withoutRosterFilter.length >= 3,
    'club-roster mode still includes bench players with 0 GP'
  );

  const rows = aggregatePlayerSeasonStats(games, [kx, safsa], {
    tournamentId,
    tournamentRosters,
  });

  assert(rows.length === 1, `expected 1 tournament-roster row, got ${rows.length}`);
  assert(rows[0].player.id === carl.id, 'only Carl on tournament roster');
  assert(rows[0].gamesPlayed === 1, 'Carl has 1 GP');
}

function testRosterZeroGpPlayerIncluded(): void {
  const carl = makePlayer('player-carl', 'Carl Belanger');
  const dnp = makePlayer('player-dnp', 'DNP Player');
  const kx = makeTeam('team-kx', 'Kai Xuan', [carl, dnp]);
  const tournamentId = 't-test';

  const tournamentRosters: TournamentRosterEntry[] = [
    { tournamentId, teamId: kx.id, playerId: carl.id, number: 22, position: 'C' },
    { tournamentId, teamId: kx.id, playerId: dnp.id, number: 11, position: 'PG' },
  ];

  const rows = aggregatePlayerSeasonStats([], [kx], {
    tournamentId,
    tournamentRosters,
  });

  assert(rows.length === 2, 'rostered DNP player included with 0 GP');
  const dnpRow = rows.find((r) => r.player.id === dnp.id);
  assert(dnpRow?.gamesPlayed === 0, 'DNP player has 0 GP');
}

function main(): void {
  testTournamentRosterOnlyRows();
  testRosterZeroGpPlayerIncluded();
  console.log('All tournament player stats tests passed.');
}

main();
