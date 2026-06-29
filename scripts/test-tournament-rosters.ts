/**
 * Unit tests for tournament roster helpers.
 * Run: npm run test:tournament-rosters
 */

import type { Game, Player, Team } from '../src/App';
import {
  buildTournamentRostersFromGames,
  dedupeTournamentRostersForDb,
  getPlayersForTeamInTournament,
  isPlayerOnTournamentRoster,
  mergeTournamentRosters,
  reconcileTournamentRostersFromGames,
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

function makeActiveGame(
  id: string,
  tournamentId: string,
  home: Team,
  away: Team
): Game {
  return {
    id,
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    tournamentId,
    date: '2026-06-28',
    gameStats: [],
    teamStats: { home: {} as never, away: {} as never },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: home.players.slice(0, 5).map((p) => p.id),
    awayStarters: away.players.slice(0, 5).map((p) => p.id),
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
}

function manualRosterEntry(
  tournamentId: string,
  teamId: string,
  player: Player
) {
  return {
    tournamentId,
    teamId,
    playerId: player.id,
    number: player.number,
    position: player.position,
  };
}

/** Mirrors autosave after handleGameStart — must not drop manual enrollments. */
function testGameStartPreservesManualRosters(): void {
  const tournamentId = 't-nba-finals';
  const lakersPlayers = [1, 2, 3, 4, 5].map((n) =>
    makePlayer(`laker-${n}`, `Laker ${n}`, n)
  );
  const celticsPlayers = [1, 2, 3, 4, 5].map((n) =>
    makePlayer(`celtic-${n}`, `Celtic ${n}`, n)
  );
  const lakers = makeTeam('team-lakers', 'Lakers', lakersPlayers);
  const celtics = makeTeam('team-celtics', 'Celtics', celticsPlayers);
  const teams = [lakers, celtics];

  const manualRosters = [
    ...lakersPlayers.map((p) => manualRosterEntry(tournamentId, lakers.id, p)),
    ...celticsPlayers.map((p) => manualRosterEntry(tournamentId, celtics.id, p)),
  ];

  const activeGame = makeActiveGame('game-new', tournamentId, lakers, celtics);
  const afterStart = reconcileTournamentRostersFromGames(
    [activeGame],
    teams,
    manualRosters
  );

  assert(afterStart.length === 10, 'game start reconcile keeps all 10 manual rows');
  for (const p of lakersPlayers) {
    assert(
      isPlayerOnTournamentRoster(p.id, tournamentId, lakers.id, afterStart),
      `Laker ${p.name} still on tournament roster after game start`
    );
  }
  for (const p of celticsPlayers) {
    assert(
      isPlayerOnTournamentRoster(p.id, tournamentId, celtics.id, afterStart),
      `Celtic ${p.name} still on tournament roster after game start`
    );
  }
}

/** Mirrors handleDeleteActiveGame — reconcile must keep manual rows; game-only rebuild must not. */
function testGameDeletePreservesManualRosters(): void {
  const tournamentId = 't-nba-finals';
  const lakersPlayers = [1, 2, 3, 4, 5].map((n) =>
    makePlayer(`laker-${n}`, `Laker ${n}`, n)
  );
  const celticsPlayers = [1, 2, 3, 4, 5].map((n) =>
    makePlayer(`celtic-${n}`, `Celtic ${n}`, n)
  );
  const lakers = makeTeam('team-lakers', 'Lakers', lakersPlayers);
  const celtics = makeTeam('team-celtics', 'Celtics', celticsPlayers);
  const teams = [lakers, celtics];

  const manualRosters = [
    ...lakersPlayers.map((p) => manualRosterEntry(tournamentId, lakers.id, p)),
    ...celticsPlayers.map((p) => manualRosterEntry(tournamentId, celtics.id, p)),
  ];

  const activeGame = makeActiveGame('game-delete-me', tournamentId, lakers, celtics);
  const gamesWithActive = [activeGame];
  const gamesAfterDelete: Game[] = [];

  const buggy = buildTournamentRostersFromGames(gamesAfterDelete, teams).entries;
  assert(buggy.length === 0, 'sanity: game-only rebuild wipes manual rosters on delete');

  const fixed = reconcileTournamentRostersFromGames(
    gamesAfterDelete,
    teams,
    manualRosters
  );
  assert(fixed.length === 10, 'reconcile after delete keeps all 10 manual rows');
  for (const p of lakersPlayers) {
    assert(
      isPlayerOnTournamentRoster(p.id, tournamentId, lakers.id, fixed),
      `Laker ${p.name} still on tournament roster after delete`
    );
  }
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

function testMergeTournamentRosters(): void {
  const ram = makePlayer(RAM_SUNDA_PUTRA_PLAYER_ID, 'Ram', 9);
  const bench = makePlayer('player-bench', 'Bench');
  const kx = makeTeam('team-kx', 'Kai Xuan', [ram, bench]);
  const opp = makeTeam('team-opp', 'Opponent', []);
  const nblGame = makeCompletedGame('g-nbl', 't-nbl-2024', kx, opp, [ram.id]);
  const { entries: fromGames } = buildTournamentRostersFromGames([nblGame], [kx, opp]);

  const manualOnly = [
    {
      tournamentId: 't-u21',
      teamId: kx.id,
      playerId: bench.id,
      number: 12,
      position: 'C',
    },
  ];
  const merged = mergeTournamentRosters(manualOnly, fromGames);

  assert(
    isPlayerOnTournamentRoster(ram.id, 't-nbl-2024', kx.id, merged),
    'merge includes game-derived Ram on NBL'
  );
  assert(
    isPlayerOnTournamentRoster(bench.id, 't-u21', kx.id, merged),
    'merge keeps manual-only bench on U21'
  );
  assert(merged.length === 2, 'merge has game row plus manual row');

  const storedJersey = [
    {
      tournamentId: 't-nbl-2024',
      teamId: kx.id,
      playerId: ram.id,
      number: 3,
      position: 'SG',
    },
  ];
  const withJersey = mergeTournamentRosters(storedJersey, fromGames);
  const ramRow = withJersey.find((r) => r.playerId === ram.id);
  assert(ramRow?.number === 3, 'stored jersey overlays game-derived row');
}

function testDedupeTournamentRosterConflicts(): void {
  const shared = makePlayer('player-shared', 'Shared');
  const teamA = makeTeam('team-a', 'Team A', [shared]);
  const teamB = makeTeam('team-b', 'Team B', [shared]);
  const opp = makeTeam('team-opp', 'Opponent', [makePlayer('player-opp', 'Opp')]);

  const gameOnA = makeCompletedGame('g-a', 't-conflict', teamA, opp, [shared.id]);
  const gameOnB = makeCompletedGame('g-b', 't-conflict', opp, teamB, [shared.id]);

  const { entries, conflicts } = buildTournamentRostersFromGames(
    [gameOnA, gameOnB],
    [teamA, teamB, opp]
  );
  assert(conflicts.length === 1, 'builder reports multi-team conflict');
  assert(entries.length === 2, 'builder keeps both team rows before dedupe');

  const deduped = dedupeTournamentRostersForDb(entries, [gameOnA, gameOnB], [
    teamA,
    teamB,
    opp,
  ]);
  assert(deduped.length === 1, 'dedupe keeps one row per player per tournament');
  assert(
    deduped[0].teamId === teamA.id || deduped[0].teamId === teamB.id,
    'dedupe keeps a team assignment'
  );

  const reconciled = reconcileTournamentRostersFromGames(
    [gameOnA, gameOnB],
    [teamA, teamB, opp],
    []
  );
  assert(reconciled.length === 1, 'reconcile dedupes before save');
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
  testMergeTournamentRosters();
  testDedupeTournamentRosterConflicts();
  testGetPlayersForTeamInTournament();
  testGameStartPreservesManualRosters();
  testGameDeletePreservesManualRosters();
  console.log('All tournament roster tests passed.');
}

main();
