/** Shared stat abbreviations for player stats table tooltips and PDF legend. */

export const PLAYER_STATS_COLUMN_TOOLTIPS: Record<string, string> = {
  '#': 'Row number for the current sort order',
  Tournament: 'Tournament name',
  Scope: 'Tournament or summary scope',
  Player: 'Player name',
  Team: 'Team abbreviation',
  Age: 'Age during this tournament season (month and year)',
  Pos: 'Primary position',
  Position: 'Primary position',
  GP: 'Games played',
  MPG: 'Minutes per game (MM:SS)',
  PPG: 'Points per game',
  RPG: 'Rebounds per game',
  APG: 'Assists per game',
  SPG: 'Steals per game',
  BPG: 'Blocks per game',
  'FG%': 'Field goal percentage',
  FGM: 'Field goals made per game',
  FGA: 'Field goal attempts per game',
  '3P%': 'Three-point percentage',
  '3PM': 'Three-pointers made per game',
  '3PA': 'Three-point attempts per game',
  'FT%': 'Free throw percentage',
  FTM: 'Free throws made per game',
  FTA: 'Free throw attempts per game',
  TOPG: 'Turnovers per game',
  FPG: 'Personal fouls per game',
  '+/-': 'Plus/minus per game',
  GmSc: 'Game score per game (Hollinger formula)',
  EFF: 'Efficiency rating per game',
  FG: 'Total field goals made/attempted (season)',
  '3PT': 'Total three-pointers made/attempted (season)',
  FT: 'Total free throws made/attempted (season)',
  ORPG: 'Offensive rebounds per game',
  FDPG: 'Fouls drawn per game',
  PITP: 'Points in the paint per game',
  'FB PTS': 'Fast break points per game',
  BA: 'Blocks against per game',
  BlocksAgainst: 'Blocks against per game',
  TF: 'Technical fouls per game',
  TFPG: 'Technical fouls per game',
  UF: 'Unsportsmanlike fouls per game',
  UFPG: 'Unsportsmanlike fouls per game',
};

/** Order used in team stats PDF legend (roster table columns). */
export const TEAM_STATS_PDF_GLOSSARY_ABBREVS = [
  'GP',
  'MPG',
  'PPG',
  'RPG',
  'APG',
  'SPG',
  'BPG',
  'FGM',
  'FGA',
  'FG%',
  '3PM',
  '3PA',
  '3P%',
  'FTM',
  'FTA',
  'FT%',
  'TOPG',
  'FPG',
  '+/-',
  'GmSc',
  'EFF',
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

export const TEAM_STATS_PDF_GLOSSARY_NOTE =
  '— (dash) means the stat was not recorded for games in this view.';

export function getTeamStatsPdfGlossaryEntries(): Array<{
  abbrev: string;
  description: string;
}> {
  return TEAM_STATS_PDF_GLOSSARY_ABBREVS.map((abbrev) => ({
    abbrev,
    description: PLAYER_STATS_COLUMN_TOOLTIPS[abbrev] ?? abbrev,
  }));
}
