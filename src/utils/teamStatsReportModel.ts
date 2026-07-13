import type { Team, Tournament } from '../App';
import { formatDecimalMinutes } from './formatMinutes';
import { gameFormatScopeLabel, type GameFormatScope } from './gameFormat';
import { slugify } from '../routing/slugs';
import {
  STANDARD_PLAYER_STATS_FIELDS,
  formatAdvancedPlayerStatsRow,
  formatStandardPlayerStatsRow,
} from './playerStatsDisplay';
import {
  sortPlayerSeasonRows,
  type FoulStatCoverage,
  type PlayerSeasonRow,
  type ShotDataCoverage,
} from './playerSeasonStats';
import {
  isAllTournamentsSelected,
  isNoTournamentsSelected,
  tournamentSelectionTriggerLabel,
  type TournamentIdSet,
  type TournamentSelectOption,
} from './tournamentSelection';

export const TEAM_STATS_COMMON_HEADERS = [
  '#',
  'Player',
  'Pos',
  'GP',
  'MPG',
] as const;

export const TEAM_STATS_STANDARD_HEADERS = [
  ...TEAM_STATS_COMMON_HEADERS,
  ...STANDARD_PLAYER_STATS_FIELDS,
] as const;

/** Display labels for advanced columns (BA/TF/UF match on-screen table). */
export const TEAM_STATS_ADVANCED_STAT_HEADERS = [
  'FG',
  '3PT',
  'FT',
  'ORPG',
  'FDPG',
  'Paint',
  'FB',
  'BA',
  'TF',
  'UF',
] as const;

export const TEAM_STATS_ADVANCED_HEADERS = [
  ...TEAM_STATS_COMMON_HEADERS,
  ...TEAM_STATS_ADVANCED_STAT_HEADERS,
] as const;

export const TEAM_STATS_STANDARD_COLUMN_COUNT = TEAM_STATS_STANDARD_HEADERS.length;
export const TEAM_STATS_ADVANCED_COLUMN_COUNT = TEAM_STATS_ADVANCED_HEADERS.length;

export interface TeamStatsReportModel {
  filename: string;
  teamName: string;
  tournamentScopeLabel: string;
  formatScopeLabel: string;
  playerCount: number;
  exportedAt: string;
  sortedRows: PlayerSeasonRow[];
  standardHeaders: string[];
  standardBody: string[][];
  advancedHeaders: string[];
  advancedBody: string[][];
  shotDataCoverage?: ShotDataCoverage;
  foulStatCoverage?: FoulStatCoverage;
}

export interface BuildTeamStatsReportModelInput {
  team: Team;
  rows: PlayerSeasonRow[];
  tournaments: Tournament[];
  selectedTournamentIds: TournamentIdSet;
  allTeamTournamentIds: readonly string[];
  tournamentOptions: TournamentSelectOption[];
  gameFormatScope: GameFormatScope;
  shotDataCoverage?: ShotDataCoverage;
  foulStatCoverage?: FoulStatCoverage;
  exportedAt?: Date;
}

export function formatTeamStatsExportDate(date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function buildTeamStatsReportFilename(
  teamAbbreviation: string,
  tournamentScopeSlug: string
): string {
  const teamSlug =
    teamAbbreviation
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'team';
  return `${teamSlug}_${tournamentScopeSlug}_stats.pdf`;
}

export function buildTeamStatsTournamentFilenameScope(
  selectedTournamentIds: TournamentIdSet,
  allTeamTournamentIds: readonly string[],
  tournaments: Tournament[]
): string {
  if (isNoTournamentsSelected(selectedTournamentIds)) {
    return 'No-Tournaments';
  }

  if (isAllTournamentsSelected(selectedTournamentIds, allTeamTournamentIds)) {
    return 'All-Tournaments';
  }

  const selectedIds =
    selectedTournamentIds === null
      ? [...allTeamTournamentIds]
      : [...selectedTournamentIds];

  const tournamentById = new Map(
    tournaments.map((tournament) => [tournament.id, tournament])
  );

  return selectedIds
    .sort((a, b) => {
      const aName = tournamentById.get(a)?.name ?? a;
      const bName = tournamentById.get(b)?.name ?? b;
      return aName.localeCompare(bName);
    })
    .map((id) => slugify(tournamentById.get(id)?.name ?? id))
    .join('_');
}

function buildCommonPlayerStatsCells(
  row: PlayerSeasonRow,
  rank: number
): string[] {
  const mpg =
    row.gamesPlayed > 0
      ? formatDecimalMinutes(row.totalStats.minutes_played / row.gamesPlayed)
      : '0:00';

  return [
    String(rank),
    row.player.name,
    row.player.position ?? '',
    String(row.gamesPlayed),
    mpg,
  ];
}

export function buildTeamStatsStandardRow(
  row: PlayerSeasonRow,
  rank: number
): string[] {
  return [
    ...buildCommonPlayerStatsCells(row, rank),
    ...formatStandardPlayerStatsRow(row),
  ];
}

export function buildTeamStatsAdvancedRow(
  row: PlayerSeasonRow,
  rank: number,
  foulStatCoverage?: FoulStatCoverage
): string[] {
  return [
    ...buildCommonPlayerStatsCells(row, rank),
    ...formatAdvancedPlayerStatsRow(row, foulStatCoverage),
  ];
}

export function buildTeamStatsReportModel(
  input: BuildTeamStatsReportModelInput
): TeamStatsReportModel {
  const {
    team,
    rows,
    tournaments,
    selectedTournamentIds,
    allTeamTournamentIds,
    tournamentOptions,
    gameFormatScope,
    shotDataCoverage,
    foulStatCoverage,
    exportedAt = new Date(),
  } = input;

  const playableRows = rows.filter((row) => row.gamesPlayed > 0);
  const sortedRows = sortPlayerSeasonRows(playableRows, 'PPG', 'desc');

  const standardHeaders = [...TEAM_STATS_STANDARD_HEADERS];
  const advancedHeaders = [...TEAM_STATS_ADVANCED_HEADERS];

  const standardBody = sortedRows.map((row, index) =>
    buildTeamStatsStandardRow(row, index + 1)
  );
  const advancedBody = sortedRows.map((row, index) =>
    buildTeamStatsAdvancedRow(row, index + 1, foulStatCoverage)
  );

  const tournamentScopeSlug = buildTeamStatsTournamentFilenameScope(
    selectedTournamentIds,
    allTeamTournamentIds,
    tournaments
  );

  return {
    filename: buildTeamStatsReportFilename(team.abbreviation, tournamentScopeSlug),
    teamName: team.name,
    tournamentScopeLabel: tournamentSelectionTriggerLabel(
      selectedTournamentIds,
      tournamentOptions,
      gameFormatScope
    ),
    formatScopeLabel: gameFormatScopeLabel(gameFormatScope),
    playerCount: sortedRows.length,
    exportedAt: formatTeamStatsExportDate(exportedAt),
    sortedRows,
    standardHeaders,
    standardBody,
    advancedHeaders,
    advancedBody,
    shotDataCoverage,
    foulStatCoverage,
  };
}
