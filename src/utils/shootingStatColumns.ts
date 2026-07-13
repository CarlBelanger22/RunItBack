/** Standard per-game shooting columns: made → attempt → percentage. */

export const STANDARD_SHOOTING_STAT_FIELDS = [
  'FGM',
  'FGA',
  'FG%',
  '3PM',
  '3PA',
  '3P%',
  'FTM',
  'FTA',
  'FT%',
] as const;

export type StandardShootingStatField = (typeof STANDARD_SHOOTING_STAT_FIELDS)[number];

/** Compact live box score shooting block labels (inline after PTS). */
export const COMPACT_LIVE_SHOOTING_COLUMN_LABELS = [
  'FGM',
  'FGA',
  'FG%',
  '3PM',
  '3PA',
  '3P%',
  'FTM',
  'FTA',
  'FT%',
] as const;

export const COMPACT_LIVE_BOX_SCORE_COLUMN_LABELS = [
  'PTS',
  ...COMPACT_LIVE_SHOOTING_COLUMN_LABELS,
  'REB',
  'AST',
  'STL',
  'BLK',
  'TO',
  'PF',
] as const;
