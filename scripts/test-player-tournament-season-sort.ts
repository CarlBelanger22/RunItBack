/**
 * Player tournament-breakdown rows sort by most recent game date.
 * Run: npx tsx scripts/test-player-tournament-season-sort.ts
 */

import type { Game, Player, Team, Tournament } from '../src/App';
import {
  buildPlayerTournamentSeasonRows,
  sortPlayerSeasonRows,
} from '../src/utils/playerSeasonStats';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const PLAYER_ID = 'player-1';
const TEAM_ID = 'team-sgp';

const player: Player = {
  id: PLAYER_ID,
  name: 'Carl',
  number: 22,
  position: 'PF',
  height: '',
  weight: '',
  age: 24,
};

const team: Team = {
  id: TEAM_ID,
  name: 'Singapore',
  abbreviation: 'SGP',
  players: [player],
};

const tournaments: Tournament[] = [
  {
    id: 't-train',
    name: 'Indonesia Training Trip',
    month: 'August',
    year: 2026,
    teams: [TEAM_ID],
    games: [],
  },
  {
    id: 't-fiba',
    name: 'FIBA Asia Cup 2029 Pre-Qualifiers',
    month: 'August',
    year: 2026,
    teams: [TEAM_ID],
    games: [],
  },
];

function game(id: string, tournamentId: string, date: string): Game {
  return {
    id,
    tournamentId,
    homeTeamId: TEAM_ID,
    awayTeamId: 'team-opp',
    homeTeam: team,
    awayTeam: {
      id: 'team-opp',
      name: 'Opp',
      abbreviation: 'OPP',
      players: [],
    },
    date,
    isCompleted: true,
    gameStats: [
      {
        playerId: PLAYER_ID,
        points: 4,
        fg_made: 2,
        fg_attempted: 4,
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
        fouls: 1,
        minutes_played: 20,
      } as Game['gameStats'][0],
    ],
    teamStats: {
      home: { teamId: TEAM_ID } as Game['teamStats']['home'],
      away: { teamId: 'team-opp' } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
  } as Game;
}

const games: Game[] = [
  game('g-train-1', 't-train', '2026-08-14'),
  game('g-train-2', 't-train', '2026-08-15'),
  game('g-train-3', 't-train', '2026-08-16'),
  game('g-fiba-1', 't-fiba', '2026-08-28'),
  game('g-fiba-2', 't-fiba', '2026-08-31'),
];

function main(): void {
  const rows = buildPlayerTournamentSeasonRows(player, [team], games, tournaments, {
    includeAllTime: false,
  });
  const dataRows = rows.filter((r) => !r.isSummaryRow);
  assert(dataRows.length === 2, 'two tournament rows');
  assert(
    dataRows[0].scopeId === 't-fiba',
    `default order should put FIBA first, got ${dataRows[0].scopeLabel}`
  );
  assert(
    dataRows[1].scopeId === 't-train',
    `Training Trip should be second, got ${dataRows[1].scopeLabel}`
  );

  const sortedDesc = sortPlayerSeasonRows(dataRows, 'Scope', 'desc');
  assert(
    sortedDesc[0].scopeId === 't-fiba',
    'Scope desc sort should put FIBA above Training Trip'
  );

  console.log('All player tournament season sort tests passed.');
}

main();
