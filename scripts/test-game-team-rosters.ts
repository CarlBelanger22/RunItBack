/**
 * Game team roster normalization tests (LE-64).
 * Run: npm run test:game-team-rosters
 */

import type { Game, Player, Team } from '../src/App';
import type { TournamentRosterEntry } from '../src/utils/tournamentRosters';
import {
  collectParticipantPlayerIdsForTeam,
  normalizeGameTeamRosters,
} from '../src/utils/gameTeamRosters';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function player(id: string, name: string, number: number): Player {
  return { id, name, number, position: 'G' };
}

function makeTeam(id: string, players: Player[]): Team {
  return { id, name: id, abbreviation: id.toUpperCase(), players };
}

function bloatedGameFromDb(
  tournamentId: string,
  homeClub: Team,
  awayClub: Team,
  tournamentRosters: TournamentRosterEntry[]
): Game {
  const game: Game = {
    id: 'g-live',
    homeTeamId: homeClub.id,
    awayTeamId: awayClub.id,
    homeTeam: { ...homeClub },
    awayTeam: { ...awayClub },
    tournamentId,
    date: '2026-07-10',
    homeStarters: ['h1', 'h2', 'h3', 'h4', 'h5'],
    awayStarters: ['a1', 'a2', 'a3', 'a4', 'a5'],
    gameStats: [
      {
        playerId: 'h1',
        points: 4,
        fg_made: 2,
        fg_attempted: 3,
        three_made: 0,
        three_attempted: 0,
        ft_made: 0,
        ft_attempted: 0,
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
      },
    ],
    teamStats: {
      home: { teamId: homeClub.id, total_points: 4 } as Game['teamStats']['home'],
      away: { teamId: awayClub.id, total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events: [{ id: 'e1', type: 'substitution', teamId: homeClub.id, details: { playersIn: ['h6'], playersOut: ['h5'] }, timestamp: 1, period: 1, gameTime: '9:00', homeScore: 0, awayScore: 0 }],
    lineupStints: [],
    currentPeriod: 3,
    currentGameTime: '10:00',
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
  void tournamentRosters;
  return game;
}

function testNormalizeTournamentGameAfterClubHydration(): void {
  const homeClub = makeTeam('ntu', [
    player('h1', 'Starter 1', 1),
    player('h2', 'Starter 2', 4),
    player('h3', 'Starter 3', 14),
    player('h4', 'Starter 4', 15),
    player('h5', 'Starter 5', 22),
    player('h6', 'Bench 6', 30),
    player('h7', 'Club only 7', 0),
    player('h8', 'Club only 8', 1),
    player('h9', 'Club only 9', 6),
    player('h10', 'Club only 10', 8),
    player('h11', 'Club only 11', 10),
    player('h12', 'Club only 12', 11),
    player('h13', 'Club only 13', 12),
    player('h14', 'Club only 14', 13),
    player('h15', 'Club only 15', 20),
    player('h16', 'Club only 16', 21),
  ]);
  const awayClub = makeTeam('snu', [
    player('a1', 'Away 1', 1),
    player('a2', 'Away 2', 5),
    player('a3', 'Away 3', 13),
    player('a4', 'Away 4', 23),
    player('a5', 'Away 5', 77),
    player('a6', 'Away bench', 99),
  ]);
  const teams = [homeClub, awayClub];
  const tournamentId = 't-ivp';
  const tournamentRosters: TournamentRosterEntry[] = [
    ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((id, i) => ({
      tournamentId,
      teamId: 'ntu',
      playerId: id,
      number: [1, 4, 14, 15, 22, 30][i]!,
      position: 'G',
    })),
    ...['a1', 'a2', 'a3', 'a4', 'a5'].map((id, i) => ({
      tournamentId,
      teamId: 'snu',
      playerId: id,
      number: [1, 5, 13, 23, 77][i]!,
      position: 'G',
    })),
  ];

  const game = bloatedGameFromDb(tournamentId, homeClub, awayClub, tournamentRosters);
  assert(game.homeTeam.players.length === 16, 'precondition: full club on game');

  const normalized = normalizeGameTeamRosters(game, teams, tournamentRosters);
  assert(normalized.homeTeam.players.length === 6, 'NTU tournament roster size');
  assert(
    !normalized.homeTeam.players.some((p) => p.id === 'h7'),
    'club-only player excluded'
  );
  assert(
    normalized.homeTeam.players.some((p) => p.id === 'h6'),
    'tournament bench included'
  );
  assert(normalized.awayTeam.players.length === 5, 'SNU tournament roster size');
}

function testParticipantUnionKeepsActiveSub(): void {
  const homeClub = makeTeam('home', [
    player('h1', 'One', 1),
    player('h2', 'Two', 2),
    player('h99', 'Legacy sub', 99),
  ]);
  const awayClub = makeTeam('away', [player('a1', 'A', 3)]);
  const teams = [homeClub, awayClub];
  const tournamentId = 't1';
  const tournamentRosters: TournamentRosterEntry[] = [
    { tournamentId, teamId: 'home', playerId: 'h1', number: 1, position: 'G' },
    { tournamentId, teamId: 'home', playerId: 'h2', number: 2, position: 'G' },
  ];

  const game: Game = {
    id: 'g2',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: { ...homeClub },
    awayTeam: { ...awayClub },
    tournamentId,
    date: '2026-01-01',
    homeStarters: ['h1'],
    awayStarters: ['a1'],
    gameStats: [
      {
        playerId: 'h99',
        points: 2,
        fg_made: 1,
        fg_attempted: 1,
        three_made: 0,
        three_attempted: 0,
        ft_made: 0,
        ft_attempted: 0,
        orb: 0,
        drb: 0,
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
        minutes_played: 1,
      },
    ],
    teamStats: {
      home: { teamId: 'home', total_points: 2 } as Game['teamStats']['home'],
      away: { teamId: 'away', total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };

  const ids = collectParticipantPlayerIdsForTeam(game, 'home', teams);
  assert(ids.includes('h99'), 'participant from game stats');

  const normalized = normalizeGameTeamRosters(game, teams, tournamentRosters);
  assert(
    normalized.homeTeam.players.some((p) => p.id === 'h99'),
    'active participant kept even if not on tournament roster rows'
  );
}

function testSetupSnapshotPreservedWithoutTournament(): void {
  const club = makeTeam('home', [
    player('h1', 'One', 1),
    player('h2', 'Two', 2),
    player('h3', 'Three', 3),
    player('h4', 'Four', 4),
    player('h5', 'Five', 5),
    player('h6', 'Six', 6),
  ]);
  const away = makeTeam('away', [player('a1', 'A', 1)]);
  const setupSnapshot = makeTeam('home', [
    player('h1', 'One', 1),
    player('h2', 'Two', 2),
    player('h3', 'Three', 3),
    player('h4', 'Four', 4),
    player('h5', 'Five', 5),
  ]);

  const game: Game = {
    id: 'g3',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: setupSnapshot,
    awayTeam: away,
    date: '2026-01-01',
    homeStarters: ['h1', 'h2', 'h3', 'h4', 'h5'],
    awayStarters: ['a1'],
    gameStats: [],
    teamStats: {
      home: { teamId: 'home', total_points: 0 } as Game['teamStats']['home'],
      away: { teamId: 'away', total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };

  const normalized = normalizeGameTeamRosters(game, [club, away], []);
  assert(normalized.homeTeam.players.length === 5, 'setup snapshot smaller than club');
}

function testFriendlyUsesEmbeddedActiveRosterForSubs(): void {
  const club = makeTeam('home', [
    player('h1', 'One', 1),
    player('h2', 'Two', 2),
    player('h3', 'Three', 3),
    player('h4', 'Four', 4),
    player('h5', 'Five', 5),
    player('h6', 'Six', 6),
    player('h7', 'Seven', 7),
    player('h8', 'Eight', 8),
    player('h9', 'Nine', 9),
  ]);
  const away = makeTeam('away', [player('a1', 'A', 1)]);
  // Setup embedded Starters+Bench only (Inactive h8/h9 never on game).
  const gameDayActive = makeTeam('home', [
    player('h1', 'One', 1),
    player('h2', 'Two', 2),
    player('h3', 'Three', 3),
    player('h4', 'Four', 4),
    player('h5', 'Five', 5),
    player('h6', 'Six', 6),
    player('h7', 'Seven', 7),
  ]);

  const game: Game = {
    id: 'g-friendly',
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeTeam: gameDayActive,
    awayTeam: away,
    isFriendly: true,
    date: '2026-08-04',
    homeStarters: ['h1', 'h2', 'h3', 'h4', 'h5'],
    awayStarters: [],
    gameStats: [
      {
        playerId: 'h1',
        points: 8,
        fg_made: 3,
        fg_attempted: 5,
        three_made: 1,
        three_attempted: 2,
        ft_made: 1,
        ft_attempted: 1,
        orb: 0,
        drb: 0,
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
        minutes_played: 0,
      },
    ],
    teamStats: {
      home: { teamId: 'home', total_points: 8 } as Game['teamStats']['home'],
      away: { teamId: 'away', total_points: 0 } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '15:00',
    trackBothTeams: false,
    isActive: true,
    isCompleted: false,
  };

  const normalized = normalizeGameTeamRosters(game, [club, away], []);
  assert(normalized.homeTeam.players.length === 7, 'friendly keeps setup active roster');
  assert(
    normalized.homeTeam.players.some((p) => p.id === 'h6') &&
      normalized.homeTeam.players.some((p) => p.id === 'h7'),
    'bench players available for sub In'
  );
  assert(
    !normalized.homeTeam.players.some((p) => p.id === 'h8') &&
      !normalized.homeTeam.players.some((p) => p.id === 'h9'),
    'inactive club players stay off game roster'
  );
}

function main(): void {
  testNormalizeTournamentGameAfterClubHydration();
  testParticipantUnionKeepsActiveSub();
  testSetupSnapshotPreservedWithoutTournament();
  testFriendlyUsesEmbeddedActiveRosterForSubs();
  console.log('All game-team-rosters tests passed.');
}

main();
