/**
 * Unit tests for tournament roster helpers.
 * Run: npm run test:tournament-rosters
 */

import type { Game, Player, Team } from '../src/App';
import {
  buildTournamentRostersFromGames,
  getPlayersForTeamInTournament,
  isPlayerOnTournamentRoster,
  resolvePlayerTeamSideInGame,
  RAM_SUNDA_PUTRA_PLAYER_ID,
} from '../src/utils/tournamentRosters';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function makePlayer(id: string, name: string, number = 7): Player {
  return {
    id,
    name,
    number,
    position: 'PG',
    height: '180',
    weight: '75',
    age: 22,
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

function makeCompletedGame(
  id: string,
  tournamentId: string,
  home: Team,
  away: Team,
  statPlayerIds: string[]
): Game {
  return {
    id,
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    tournamentId,
    date: '2024-05-01',
    gameStats: statPlayerIds.map((playerId) => ({
      playerId,
      points: 5,
      fg_made: 2,
      fg_attempted: 4,
      three_made: 0,
      three_attempted: 0,
      ft_made: 1,
      ft_attempted: 1,
      orb: 0,
      drb: 1,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      tech_fouls: 0,
      unsportsmanlike_fouls: 0,
      fouls_drawn: 0,
      blocks_received: 0,
      plus_minus: 0,
      minutes_played: 10,
    })),
    teamStats: { home: {} as never, away: {} as never },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '0:00',
    homeStarters: statPlayerIds.slice(0, 1),
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home: 70, away: 65 },
  };
}

function testResolveSide(): void {
  const ram = makePlayer(RAM_SUNDA_PUTRA_PLAYER_ID, 'Ram');
  const other = makePlayer('player-other', 'Other');
  const kx = makeTeam('team-kx', 'Kai Xuan', [ram, other]);
  const opp = makeTeam('team-opp', 'Opponent', [makePlayer('player-opp', 'Opp')]);
  const game = makeCompletedGame('g1', 't-nbl', kx, opp, [ram.id]);

  assert(
    resolvePlayerTeamSideInGame(ram.id, game) === kx.id,
    'Ram resolves to home Kai Xuan'
  );
}

function testGameStatsOnlyMembership(): void {
  const ram = makePlayer(RAM_SUNDA_PUTRA_PLAYER_ID, 'Ram');
  const bench = makePlayer('player-bench', 'Bench');
  const kx = makeTeam('team-kx', 'Kai Xuan', [ram, bench]);
  const opp = makeTeam('team-opp', 'Opponent', []);

  const nblGame = makeCompletedGame('g-nbl', 't-nbl-2024', kx, opp, [ram.id]);
  const u21Game = makeCompletedGame('g-u21', 't-u21', kx, opp, [bench.id]);

  const { entries } = buildTournamentRostersFromGames([nblGame, u21Game], [kx, opp]);

  assert(
    isPlayerOnTournamentRoster(ram.id, 't-nbl-2024', kx.id, entries),
    'Ram on NBL tournament roster after playing'
  );
  assert(
    !isPlayerOnTournamentRoster(ram.id, 't-u21', kx.id, entries),
    'Ram not on U21 roster without games'
  );
  assert(
    isPlayerOnTournamentRoster(bench.id, 't-u21', kx.id, entries),
    'Bench player on U21 after playing'
  );
  assert(
    !isPlayerOnTournamentRoster(bench.id, 't-nbl-2024', kx.id, entries),
    'Bench not on NBL without games'
  );
}

function testGetPlayersForTeamInTournament(): void {
  const ram = makePlayer(RAM_SUNDA_PUTRA_PLAYER_ID, 'Ram', 9);
  const kx = makeTeam('team-kx', 'Kai Xuan', [ram]);
  const rosters = [
    {
      tournamentId: 't-nbl',
      teamId: kx.id,
      playerId: ram.id,
      number: 3,
      position: 'SG',
    },
  ];

  const players = getPlayersForTeamInTournament(kx.id, 't-nbl', [kx], rosters);
  assert(players.length === 1, 'one player returned');
  assert(players[0].number === 3, 'tournament jersey overrides template');
}

function main(): void {
  testResolveSide();
  testGameStatsOnlyMembership();
  testGetPlayersForTeamInTournament();
  console.log('All tournament roster tests passed.');
}

main();
