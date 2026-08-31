/**
 * Team stats report model tests.
 * Run: npm run test:team-stats-report
 */

import type { GameStats, Player, Team, Tournament } from '../src/App';
import { generateTeamStatsReportPdf } from '../src/lib/teamStatsReportPdf';
import { getTeamStatsPdfGlossaryEntries } from '../src/utils/playerStatsGlossary';
import {
  TEAM_STATS_ADVANCED_COLUMN_COUNT,
  TEAM_STATS_STANDARD_COLUMN_COUNT,
  buildTeamStatsReportFilename,
  buildTeamStatsReportModel,
  buildTeamStatsTournamentFilenameScope,
} from '../src/utils/teamStatsReportModel';
import type { PlayerSeasonRow } from '../src/utils/playerSeasonStats';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function player(id: string, name: string, position: string): Player {
  return { id, name, number: 1, position };
}

function team(id: string, name: string, abbreviation: string, players: Player[]): Team {
  return { id, name, abbreviation, players };
}

function emptyStats(playerId: string, overrides: Partial<GameStats> = {}): GameStats {
  return {
    playerId,
    points: 0,
    fg_made: 0,
    fg_attempted: 0,
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
    minutes_played: 0,
    ...overrides,
  };
}

function seasonRow(
  player: Player,
  team: Team,
  gamesPlayed: number,
  points: number
): PlayerSeasonRow {
  return {
    player,
    team,
    gamesPlayed,
    totalStats: emptyStats(player.id, { points }),
    paintPointsTotal: 0,
    fastbreakPointsTotal: 0,
    gamesWithShotData: 0,
    foulsDrawnTotal: 0,
    gamesWithFoulsDrawnData: 0,
    plusMinusTotal: 0,
    gamesWithPlusMinusData: 0,
  };
}

const tournaments: Tournament[] = [
  {
    id: 't-1',
    name: 'IUBIT 2026',
    year: 2026,
    month: 'Jul',
    teams: [],
  },
  {
    id: 't-2',
    name: 'Summer League',
    year: 2026,
    month: 'Aug',
    teams: [],
  },
  {
    id: 't-3',
    name: 'Winter Classic',
    year: 2026,
    month: 'Dec',
    teams: [],
  },
];

const tournamentOptions = tournaments.map((tournament) => ({
  id: tournament.id,
  label: tournament.name,
  gameFormat: '5v5' as const,
}));

const allTeamTournamentIds = tournaments.map((tournament) => tournament.id);

assert(
  buildTeamStatsReportFilename('NTU', 'All-Tournaments') ===
    'NTU_All-Tournaments_stats.pdf',
  'filename uses team abbreviation and tournament scope'
);

assert(
  buildTeamStatsTournamentFilenameScope(null, allTeamTournamentIds, tournaments) ===
    'All-Tournaments',
  'all tournaments selected uses All-Tournaments slug'
);

assert(
  buildTeamStatsTournamentFilenameScope(
    new Set(['t-1']),
    allTeamTournamentIds,
    tournaments
  ) === 'iubit-2026',
  'single tournament uses slugified tournament name'
);

assert(
  buildTeamStatsTournamentFilenameScope(
    new Set(['t-1', 't-2']),
    allTeamTournamentIds,
    tournaments
  ) === 'iubit-2026_summer-league',
  'partial multi-tournament selection joins slugified names'
);

assert(
  buildTeamStatsTournamentFilenameScope(
    new Set(['t-1', 't-2', 't-3']),
    allTeamTournamentIds,
    tournaments
  ) === 'All-Tournaments',
  'explicit full tournament set collapses to All-Tournaments'
);

const alpha = player('p-alpha', 'Alpha Player', 'PG');
const bravo = player('p-bravo', 'Bravo Player', 'SG');
const club = team('team-1', 'Boston Celtics', 'BOS', [alpha, bravo]);

const model = buildTeamStatsReportModel({
  team: club,
  rows: [
    seasonRow(alpha, club, 5, 50),
    seasonRow(bravo, club, 5, 80),
    seasonRow(player('p-zero', 'Zero GP', 'C'), club, 0, 0),
  ],
  tournaments,
  selectedTournamentIds: null,
  allTeamTournamentIds,
  tournamentOptions,
  gameFormatScope: '5v5',
  exportedAt: new Date('2026-07-11T12:00:00Z'),
});

assert(model.playerCount === 2, 'rows with 0 GP are excluded');
assert(model.sortedRows[0]?.player.id === 'p-bravo', 'rows sort by PPG descending');
assert(model.sortedRows[1]?.player.id === 'p-alpha', 'second row follows PPG order');
assert(
  model.standardBody[0]?.[1] === 'Bravo Player',
  'standard table keeps same player order as sorted rows'
);
assert(
  model.advancedBody[0]?.[1] === 'Bravo Player',
  'advanced table keeps same player order as sorted rows'
);
assert(
  model.standardBody.every(
    (row) => row.length === TEAM_STATS_STANDARD_COLUMN_COUNT
  ),
  'every standard row has expected column count'
);
assert(
  model.advancedBody.every(
    (row) => row.length === TEAM_STATS_ADVANCED_COLUMN_COUNT
  ),
  'every advanced row has expected column count'
);
assert(
  model.standardHeaders.length === TEAM_STATS_STANDARD_COLUMN_COUNT,
  'standard header count matches body'
);
assert(
  model.advancedHeaders.length === TEAM_STATS_ADVANCED_COLUMN_COUNT,
  'advanced header count matches body'
);
assert(model.filename === 'BOS_All-Tournaments_stats.pdf', 'model filename');
assert(model.tournamentScopeLabel === 'All 5v5', 'tournament scope label');
assert(model.formatScopeLabel === '5v5', 'format scope label');
assert(model.exportedAt === 'July 11, 2026', 'export date formatting');

const pdfBlob = generateTeamStatsReportPdf(model);
assert(pdfBlob.size > 1000, 'PDF blob is non-trivial size');
assert(pdfBlob.type === 'application/pdf', 'PDF blob mime type');
assert(getTeamStatsPdfGlossaryEntries().length >= 30, 'glossary has stat entries');

console.log('PASS: team stats report model tests');
