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
  type ScopedStatCoverage,
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
  'PITP',
  'FB PTS',
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
  teamIcon?: string;
  tournamentScopeLabel: string;
  formatScopeLabel: string;
  playerCount: number;
  sortedRows: PlayerSeasonRow[];
  standardHeaders: string[];
  standardBody: string[][];
  advancedHeaders: string[];
  advancedBody: string[][];
  shotDataCoverage?: ShotDataCoverage;
  foulStatCoverage?: FoulStatCoverage;
  plusMinusCoverage?: ScopedStatCoverage;
  foulsDrawnCoverage?: ScopedStatCoverage;
  personalFoulsCoverage?: ScopedStatCoverage;
  blocksAgainstCoverage?: ScopedStatCoverage;
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
  plusMinusCoverage?: ScopedStatCoverage;
  foulsDrawnCoverage?: ScopedStatCoverage;
  personalFoulsCoverage?: ScopedStatCoverage;
  blocksAgainstCoverage?: ScopedStatCoverage;
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

/** Jersey # for PDF/export; `-` when missing. `0` is a valid number. */
export function formatTeamStatsJerseyNumber(
  number: number | null | undefined
): string {
  if (number == null || Number.isNaN(number)) return '-';
  return String(number);
}

function buildCommonPlayerStatsCells(row: PlayerSeasonRow): string[] {
  const mpg =
    row.gamesPlayed > 0
      ? formatDecimalMinutes(row.totalStats.minutes_played / row.gamesPlayed)
      : '-';

  return [
    formatTeamStatsJerseyNumber(row.player.number),
    row.player.name,
    row.player.position ?? '',
    String(row.gamesPlayed),
    mpg,
  ];
}

export function buildTeamStatsStandardRow(row: PlayerSeasonRow): string[] {
  return [
    ...buildCommonPlayerStatsCells(row),
    ...formatStandardPlayerStatsRow(row),
  ];
}

export function buildTeamStatsAdvancedRow(
  row: PlayerSeasonRow,
  foulStatCoverage?: FoulStatCoverage
): string[] {
  return [
    ...buildCommonPlayerStatsCells(row),
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
    plusMinusCoverage,
    foulsDrawnCoverage,
    personalFoulsCoverage,
    blocksAgainstCoverage,
  } = input;

  const playableRows = rows.filter((row) => row.gamesPlayed > 0);
  const sortedRows = sortPlayerSeasonRows(playableRows, 'PPG', 'desc');

  const standardHeaders = [...TEAM_STATS_STANDARD_HEADERS];
  const advancedHeaders = [...TEAM_STATS_ADVANCED_HEADERS];

  const standardBody = sortedRows.map((row) => buildTeamStatsStandardRow(row));
  const advancedBody = sortedRows.map((row) =>
    buildTeamStatsAdvancedRow(row, foulStatCoverage)
  );

  const tournamentScopeSlug = buildTeamStatsTournamentFilenameScope(
    selectedTournamentIds,
    allTeamTournamentIds,
    tournaments
  );

  return {
    filename: buildTeamStatsReportFilename(team.abbreviation, tournamentScopeSlug),
    teamName: team.name,
    teamIcon: team.icon,
    tournamentScopeLabel: tournamentSelectionTriggerLabel(
      selectedTournamentIds,
      tournamentOptions,
      gameFormatScope
    ),
    formatScopeLabel: gameFormatScopeLabel(gameFormatScope),
    playerCount: sortedRows.length,
    sortedRows,
    standardHeaders,
    standardBody,
    advancedHeaders,
    advancedBody,
    shotDataCoverage,
    foulStatCoverage,
    plusMinusCoverage,
    foulsDrawnCoverage,
    personalFoulsCoverage,
    blocksAgainstCoverage,
  };
}
