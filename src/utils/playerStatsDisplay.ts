import { MetricsCalculator } from '../components/MetricsCalculator';
import {
  foulsDrawnPerGameForRow,
  plusMinusPerGameForRow,
  type FoulStatCoverage,
  type PlayerSeasonRow,
  type PlayerStatsSortField,
} from './playerSeasonStats';
import { STANDARD_SHOOTING_STAT_FIELDS } from './shootingStatColumns';

export const NO_STAT_RECORDED_VALUE = '-';

export const STANDARD_PLAYER_STATS_FIELDS = [
  'PPG',
  'RPG',
  'APG',
  'SPG',
  'BPG',
  ...STANDARD_SHOOTING_STAT_FIELDS,
  'TOPG',
  'FPG',
  '+/-',
  'GmSc',
  'EFF',
] as const satisfies readonly PlayerStatsSortField[];

export const ADVANCED_PLAYER_STATS_FIELDS = [
  'FG',
  '3PT',
  'FT',
  'ORPG',
  'FDPG',
  'Paint',
  'FB',
  'BlocksAgainst',
  'TFPG',
  'UFPG',
] as const satisfies readonly PlayerStatsSortField[];

export type StandardPlayerStatsField =
  (typeof STANDARD_PLAYER_STATS_FIELDS)[number];

export type AdvancedPlayerStatsField =
  (typeof ADVANCED_PLAYER_STATS_FIELDS)[number];

function perGame(total: number, gamesPlayed: number): number {
  return gamesPlayed > 0 ? total / gamesPlayed : 0;
}

function percentage(made: number, attempted: number): number {
  return attempted > 0 ? (made / attempted) * 100 : 0;
}

function madeAttempted(made: number, attempted: number): string {
  return `${made}/${attempted}`;
}

export function formatOptionalPlayerStat(
  value: number | null,
  decimals = 1
): string {
  return value === null ? NO_STAT_RECORDED_VALUE : value.toFixed(decimals);
}

export function formatStandardPlayerStatsRow(
  row: PlayerSeasonRow
): string[] {
  const { totalStats, gamesPlayed } = row;
  const eff = MetricsCalculator.calculateEfficiency(totalStats);
  const gameSc = MetricsCalculator.calculateGameScore(totalStats);
  const plusMinusPg = plusMinusPerGameForRow(row);

  const values: Record<StandardPlayerStatsField, string> = {
    PPG: perGame(totalStats.points, gamesPlayed).toFixed(1),
    RPG: perGame(totalStats.orb + totalStats.drb, gamesPlayed).toFixed(1),
    APG: perGame(totalStats.assists, gamesPlayed).toFixed(1),
    SPG: perGame(totalStats.steals, gamesPlayed).toFixed(1),
    BPG: perGame(totalStats.blocks, gamesPlayed).toFixed(1),
    FGM: perGame(totalStats.fg_made, gamesPlayed).toFixed(1),
    FGA: perGame(totalStats.fg_attempted, gamesPlayed).toFixed(1),
    'FG%': `${percentage(totalStats.fg_made, totalStats.fg_attempted).toFixed(1)}%`,
    '3PM': perGame(totalStats.three_made, gamesPlayed).toFixed(1),
    '3PA': perGame(totalStats.three_attempted, gamesPlayed).toFixed(1),
    '3P%': `${percentage(totalStats.three_made, totalStats.three_attempted).toFixed(1)}%`,
    FTM: perGame(totalStats.ft_made, gamesPlayed).toFixed(1),
    FTA: perGame(totalStats.ft_attempted, gamesPlayed).toFixed(1),
    'FT%': `${percentage(totalStats.ft_made, totalStats.ft_attempted).toFixed(1)}%`,
    TOPG: perGame(totalStats.turnovers, gamesPlayed).toFixed(1),
    FPG: perGame(totalStats.fouls, gamesPlayed).toFixed(1),
    '+/-':
      plusMinusPg === null
        ? NO_STAT_RECORDED_VALUE
        : `${plusMinusPg >= 0 ? '+' : ''}${plusMinusPg.toFixed(1)}`,
    GmSc: perGame(gameSc, gamesPlayed).toFixed(1),
    EFF: perGame(eff, gamesPlayed).toFixed(1),
  };

  return STANDARD_PLAYER_STATS_FIELDS.map((field) => values[field]);
}

export function formatAdvancedPlayerStatsRow(
  row: PlayerSeasonRow,
  foulStatCoverage?: FoulStatCoverage
): string[] {
  const { totalStats, gamesPlayed } = row;
  const paintPg =
    row.gamesWithShotData > 0
      ? row.paintPointsTotal / row.gamesWithShotData
      : null;
  const fastbreakPg =
    row.gamesWithShotData > 0
      ? row.fastbreakPointsTotal / row.gamesWithShotData
      : null;
  const blocksAgainstPg =
    foulStatCoverage?.blocksAgainst && gamesPlayed > 0
      ? totalStats.blocks_received / gamesPlayed
      : null;
  const technicalFoulsPg =
    foulStatCoverage?.techFouls && gamesPlayed > 0
      ? totalStats.tech_fouls / gamesPlayed
      : null;
  const unsportsmanlikeFoulsPg =
    foulStatCoverage?.unsportsmanlikeFouls && gamesPlayed > 0
      ? totalStats.unsportsmanlike_fouls / gamesPlayed
      : null;

  const values: Record<AdvancedPlayerStatsField, string> = {
    FG: madeAttempted(totalStats.fg_made, totalStats.fg_attempted),
    '3PT': madeAttempted(totalStats.three_made, totalStats.three_attempted),
    FT: madeAttempted(totalStats.ft_made, totalStats.ft_attempted),
    ORPG: perGame(totalStats.orb, gamesPlayed).toFixed(1),
    FDPG: formatOptionalPlayerStat(foulsDrawnPerGameForRow(row)),
    Paint: formatOptionalPlayerStat(paintPg),
    FB: formatOptionalPlayerStat(fastbreakPg),
    BlocksAgainst: formatOptionalPlayerStat(blocksAgainstPg),
    TFPG: formatOptionalPlayerStat(technicalFoulsPg),
    UFPG: formatOptionalPlayerStat(unsportsmanlikeFoulsPg),
  };

  return ADVANCED_PLAYER_STATS_FIELDS.map((field) => values[field]);
}
