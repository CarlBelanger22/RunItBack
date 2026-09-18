import type { Game, GameStats, Tournament } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import {
  orderBoxScorePlayers,
  type OrderedBoxScoreRow,
} from './boxScoreOrder';
import {
  formatGameLeader,
  getGameLeaders,
  getTeamForSide,
  formatOptionalAdvancedTeamStat,
  hasAwayTeamContent,
  isScoreOnlyTeam,
  playerPlayedInGame,
  resolveSideScore,
  resolveTeamTotals,
  sortGamesByDateAsc,
  gameHasShotChartData,
  type TeamSide,
} from './gameDisplay';
import { formatGameFlowTeamDisplay, resolveGameFlowStats } from './gameFlowStats';
import { getTournamentGameFormat, type GameFormat } from './gameFormat';
import { gameRecordsStat } from './statRecordingCoverage';
import { buildTeamDisplayStats } from './teamDisplayStats';
import {
  deriveQuarterScoringRows,
  ensureGameQuarterStats,
  formatQuarterRowsForReport,
} from './quarterScoring';
import {
  FRIENDLY_GAME_LABEL,
  isFriendlyGame,
  resolveGameListLabel,
} from './friendlyGame';
import {
  findBracketSlot,
  findGroup,
  findStage,
} from './tournamentStructure';
import { resolveTeamIconSrc } from './teamIcon';

export const PDF_BOX_SCORE_HEADERS = [
  '#',
  'Player',
  'MIN',
  'PTS',
  'FG',
  'FG%',
  '3PT',
  '3PT%',
  'FT',
  'FT%',
  'REB',
  'DRB',
  'ORB',
  'AST',
  'BLK',
  'BA',
  'STL',
  'TO',
  'FLS',
  'FD',
  '+/-',
  'EFF',
  'GmSc',
] as const;

export const PDF_BOX_SCORE_COLUMN_COUNT = PDF_BOX_SCORE_HEADERS.length;

/** Index of Player name column in PDF_BOX_SCORE_HEADERS. */
export const PDF_BOX_SCORE_PLAYER_COL = 1;
/** Index of +/- column. */
export const PDF_BOX_SCORE_PLUS_MINUS_COL = 20;

export type GameReportBoxScoreRowKind =
  | 'player'
  | 'bench_divider'
  | 'team_coach'
  | 'team_total';

export interface GameReportBoxScoreRow {
  kind: GameReportBoxScoreRowKind;
  cells: string[];
}

export interface GameReportBoxScoreSection {
  teamName: string;
  abbreviation: string;
  score: number;
  scoreOnly: boolean;
  icon: string | null;
  rows: GameReportBoxScoreRow[];
}

export type GameReportComparisonWinner = 'home' | 'away' | 'tie';

export interface GameReportComparisonRow {
  label: string;
  home: string;
  away: string;
  /** Which side is better for this row (E3). */
  winner: GameReportComparisonWinner;
  /**
   * Game-level stat (not per-team) — PDF merges home+away into one cell.
   * `home` holds the displayed value; `away` is ignored when rendering.
   */
  sharedValue?: boolean;
}

export interface GameReportQuarterRow {
  label: string;
  home: string;
  away: string;
}

export interface GameReportLeaderLine {
  label: string;
  text: string;
}

export type GameReportExportMode = 'media' | 'full';

export interface GameReportExportOptions {
  mode: GameReportExportMode;
  /** Full report only — ignored for media one-pager. */
  includeShotChart: boolean;
  /** Full report only — H3/H4 coming-soon pages. */
  includeComingSoonPlaceholders: boolean;
}

export const DEFAULT_GAME_REPORT_EXPORT_OPTIONS: GameReportExportOptions = {
  mode: 'full',
  includeShotChart: false,
  includeComingSoonPlaceholders: false,
};

/**
 * Normalize dialog selections for download.
 * Media one-pager never includes shot chart or coming-soon pages.
 * Shot chart cannot be on when the game has no located shots.
 */
export function resolveGameReportExportOptions(args: {
  mode: GameReportExportMode;
  includeShotChart: boolean;
  includeComingSoonPlaceholders: boolean;
  hasShotChartData: boolean;
}): GameReportExportOptions {
  if (args.mode === 'media') {
    return {
      mode: 'media',
      includeShotChart: false,
      includeComingSoonPlaceholders: false,
    };
  }
  return {
    mode: 'full',
    includeShotChart: args.hasShotChartData && args.includeShotChart,
    includeComingSoonPlaceholders: args.includeComingSoonPlaceholders,
  };
}

export function initialGameReportExportDialogState(_hasShotChartData: boolean): {
  mode: GameReportExportMode;
  includeShotChart: boolean;
  includeComingSoonPlaceholders: boolean;
} {
  return {
    mode: 'full',
    includeShotChart: false,
    includeComingSoonPlaceholders: false,
  };
}

export interface GameReportModel {
  filename: string;
  gameId: string;
  shortGameId: string;
  tournamentName: string | null;
  tournamentIcon: string | null;
  seasonYear: number | null;
  formattedDate: string;
  /** e.g. Friday, September 17, 2026 */
  formattedDateWithWeekday: string;
  startTime: string | null;
  gameFormat: GameFormat;
  isFriendly: boolean;
  stageLabel: string | null;
  groupLabel: string | null;
  bracketSlotLabel: string | null;
  /** 1-based index within tournament schedule when computable. */
  gameNumber: number | null;
  /** Page header: `University of Macau (UM)` */
  homeTeamLabel: string;
  awayTeamLabel: string;
  homeTeamName: string;
  awayTeamName: string;
  homeIcon: string | null;
  awayIcon: string | null;
  homeScore: number;
  awayScore: number;
  scoreLine: string;
  homeAbbr: string;
  awayAbbr: string;
  hasOvertime: boolean;
  overtimeLabel: string | null;
  /** Compact period strip: `Q1 8-4 · Q2 6-3 · …` */
  periodStrip: string;
  leaders: GameReportLeaderLine[];
  /** Flat concat of all three comparison sections (legacy / tests). */
  comparisonRows: GameReportComparisonRow[];
  /** @deprecated Prefer shootingComparisonRows */
  basicComparisonRows: GameReportComparisonRow[];
  /** @deprecated Prefer scoringContextComparisonRows */
  advancedComparisonRows: GameReportComparisonRow[];
  shootingComparisonRows: GameReportComparisonRow[];
  teamStatComparisonRows: GameReportComparisonRow[];
  scoringContextComparisonRows: GameReportComparisonRow[];
  quarterRows: GameReportQuarterRow[];
  boxScores: GameReportBoxScoreSection[];
  recordsFoulsDrawn: boolean;
  recordsPlusMinus: boolean;
  hasShotChartData: boolean;
  /** Located shots for PDF chart (percent coords). */
  shotMarkers: GameReportShotMarker[];
}

export interface GameReportShotMarker {
  x: number;
  y: number;
  made: boolean;
}

export interface BuildGameReportModelOptions {
  /** League games — used for tournament game number (B5). */
  leagueGames?: Game[];
}

interface PlayerBoxScoreRow extends GameStats {
  name: string;
  number: number;
}

const EM_DASH = '—';

/** Per-team placeholders until event derivation ships. */
export const GAME_FLOW_TEAM_PLACEHOLDER_LABELS = [
  'Biggest lead',
  'Biggest scoring run',
] as const;

/** Game-level placeholders (single value across both teams). */
export const GAME_FLOW_SHARED_PLACEHOLDER_LABELS = [
  'Lead changes',
  'Times tied',
] as const;

export const GAME_FLOW_PLACEHOLDER_LABELS = [
  ...GAME_FLOW_TEAM_PLACEHOLDER_LABELS,
  ...GAME_FLOW_SHARED_PLACEHOLDER_LABELS,
] as const;

export const SHOOTING_COMPARISON_LABELS = [
  'PTS',
  'FG',
  'FG%',
  '3PT',
  '3PT%',
  'FT',
  'FT%',
  'eFG%',
  'TS%',
] as const;

export const TEAM_STAT_COMPARISON_LABELS = [
  'REB',
  'ORB',
  'AST',
  'STL',
  'BLK',
  'TO',
  'PF',
] as const;

export const SCORING_CONTEXT_COMPARISON_LABELS = [
  'POT',
  'PITP',
  '2nd Chance',
  'FB PTS',
  'Bench Pts',
  ...GAME_FLOW_PLACEHOLDER_LABELS,
] as const;

export function formatReportMinutes(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatReportShootingLine(made: number, attempted: number): string {
  if (attempted <= 0) return '-';
  return `${made}-${attempted}`;
}

export function formatReportPct(made: number, attempted: number): string {
  if (attempted <= 0) return '-';
  return `${Math.round((made / attempted) * 100)}%`;
}

export function formatReportPlusMinus(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function formatReportDecimal(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}

/** EFF / GmSc and other metrics that may be negative — never clamp to zero. */
export function formatSignedDecimal(value: number, decimals = 1): string {
  return formatReportDecimal(value, decimals);
}

/** Full display name for official PDF box scores (F1). */
export function formatPlayerDisplayName(fullName: string): string {
  const trimmed = fullName.trim();
  return trimmed || 'Unknown';
}

/** Jersey column for PDF box score — keep valid 0 (do not treat as empty). */
export function formatReportJerseyNumber(number: number): string {
  if (!Number.isFinite(number) || number < 0) return '';
  return String(number);
}

export function slugifyReportToken(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'game';
}

export function buildGameReportFilename(
  game: Game,
  tournamentName?: string | null
): string {
  const date = game.date.slice(0, 10);
  const home = game.homeTeam.abbreviation || 'HOME';
  const away = game.awayTeam.abbreviation || 'AWAY';
  const tournamentSlug = isFriendlyGame(game)
    ? 'friendly'
    : slugifyReportToken(tournamentName || 'tournament');
  return `${date}_${tournamentSlug}_${home}-vs-${away}.pdf`;
}

export function shortGameIdFromFull(gameId: string): string {
  const trimmed = gameId.trim();
  if (trimmed.length <= 10) return trimmed;
  return trimmed.slice(-8);
}

export function computeTournamentGameNumber(
  game: Game,
  leagueGames: Game[] | undefined
): number | null {
  if (!game.tournamentId || !leagueGames?.length) return null;
  const peers = sortGamesByDateAsc(
    leagueGames.filter((g) => g.tournamentId === game.tournamentId)
  );
  const index = peers.findIndex((g) => g.id === game.id);
  return index >= 0 ? index + 1 : null;
}

export function comparisonWinnerFromDisplays(
  home: string,
  away: string,
  higherIsBetter = true
): GameReportComparisonWinner {
  const homeNum = parseComparisonNumeric(home);
  const awayNum = parseComparisonNumeric(away);
  if (homeNum == null || awayNum == null) return 'tie';
  if (homeNum === awayNum) return 'tie';
  if (higherIsBetter) return homeNum > awayNum ? 'home' : 'away';
  return homeNum < awayNum ? 'home' : 'away';
}

function parseComparisonNumeric(raw: string): number | null {
  const text = raw.trim();
  if (!text || text === '-' || text === EM_DASH) return null;

  if (text.endsWith('%')) {
    const pct = Number.parseFloat(text.slice(0, -1));
    return Number.isFinite(pct) ? pct : null;
  }

  const shooting = text.match(/^(-?\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (shooting) {
    const made = Number(shooting[1]);
    const attempted = Number(shooting[2]);
    if (!Number.isFinite(made) || !Number.isFinite(attempted) || attempted <= 0) {
      return Number.isFinite(made) ? made : null;
    }
    return made + made / (attempted + 1);
  }

  const plain = Number.parseFloat(text);
  return Number.isFinite(plain) ? plain : null;
}

function withWinner(
  label: string,
  home: string,
  away: string,
  higherIsBetter = true
): GameReportComparisonRow {
  return {
    label,
    home,
    away,
    winner: comparisonWinnerFromDisplays(home, away, higherIsBetter),
  };
}

function formatLeaderLine(
  label: string,
  suffix: string,
  decimals: number,
  game: Game,
  metric: 'points' | 'assists' | 'rebounds' | 'gameScore'
): GameReportLeaderLine {
  return {
    label,
    text: formatGameLeader(getGameLeaders(game, metric), suffix, decimals),
  };
}

function blankComparisonRow(
  label: string,
  sharedValue = false
): GameReportComparisonRow {
  return {
    label,
    home: EM_DASH,
    away: sharedValue ? '' : EM_DASH,
    winner: 'tie',
    sharedValue: sharedValue || undefined,
  };
}

function gameFlowComparisonRows(game: Game): GameReportComparisonRow[] {
  const flow = resolveGameFlowStats(game);
  const teamRow = (
    label: string,
    homeValue: number | null,
    homeScore: { home: number; away: number } | null,
    awayValue: number | null,
    awayScore: { home: number; away: number } | null
  ): GameReportComparisonRow => {
    if (homeValue === null && awayValue === null) {
      return blankComparisonRow(label, false);
    }
    return withWinner(
      label,
      formatGameFlowTeamDisplay(homeValue, homeScore),
      formatGameFlowTeamDisplay(awayValue, awayScore)
    );
  };
  const sharedRow = (
    label: string,
    value: number | null
  ): GameReportComparisonRow => {
    if (value === null) return blankComparisonRow(label, true);
    return {
      label,
      home: String(value),
      away: '',
      winner: 'tie',
      sharedValue: true,
    };
  };

  return [
    teamRow(
      'Biggest lead',
      flow.home.biggestLead,
      flow.home.biggestLeadScore,
      flow.away.biggestLead,
      flow.away.biggestLeadScore
    ),
    teamRow(
      'Biggest scoring run',
      flow.home.biggestScoringRun,
      flow.home.biggestScoringRunScore,
      flow.away.biggestScoringRun,
      flow.away.biggestScoringRunScore
    ),
    sharedRow('Lead changes', flow.leadChanges),
    sharedRow('Times tied', flow.timesTied),
  ];
}

export function buildComparisonSections(game: Game): {
  shooting: GameReportComparisonRow[];
  teamStats: GameReportComparisonRow[];
  scoringContext: GameReportComparisonRow[];
} {
  const home = buildTeamDisplayStats(game, 'home');
  const away = buildTeamDisplayStats(game, 'away');
  const homeTotals = resolveTeamTotals(game, 'home');
  const awayTotals = resolveTeamTotals(game, 'away');

  const shooting: GameReportComparisonRow[] = [
    withWinner('PTS', String(home.points), String(away.points)),
    withWinner(
      'FG',
      formatReportShootingLine(home.fg_made, home.fg_attempted),
      formatReportShootingLine(away.fg_made, away.fg_attempted)
    ),
    withWinner(
      'FG%',
      formatReportPct(home.fg_made, home.fg_attempted),
      formatReportPct(away.fg_made, away.fg_attempted)
    ),
    withWinner(
      '3PT',
      formatReportShootingLine(home.three_made, home.three_attempted),
      formatReportShootingLine(away.three_made, away.three_attempted)
    ),
    withWinner(
      '3PT%',
      formatReportPct(home.three_made, home.three_attempted),
      formatReportPct(away.three_made, away.three_attempted)
    ),
    withWinner(
      'FT',
      formatReportShootingLine(home.ft_made, home.ft_attempted),
      formatReportShootingLine(away.ft_made, away.ft_attempted)
    ),
    withWinner(
      'FT%',
      formatReportPct(home.ft_made, home.ft_attempted),
      formatReportPct(away.ft_made, away.ft_attempted)
    ),
    withWinner(
      'eFG%',
      home.fg_attempted > 0
        ? `${home.effectiveFieldGoalPercentage.toFixed(1)}%`
        : '-',
      away.fg_attempted > 0
        ? `${away.effectiveFieldGoalPercentage.toFixed(1)}%`
        : '-'
    ),
    withWinner(
      'TS%',
      home.fg_attempted + 0.44 * home.ft_attempted > 0
        ? `${home.trueShootingPercentage.toFixed(1)}%`
        : '-',
      away.fg_attempted + 0.44 * away.ft_attempted > 0
        ? `${away.trueShootingPercentage.toFixed(1)}%`
        : '-'
    ),
  ];

  const teamStats: GameReportComparisonRow[] = [
    withWinner('REB', String(home.rebounds), String(away.rebounds)),
    withWinner('ORB', String(homeTotals.orb), String(awayTotals.orb)),
    withWinner('AST', String(home.assists), String(away.assists)),
    withWinner('STL', String(home.steals), String(away.steals)),
    withWinner('BLK', String(home.blocks), String(away.blocks)),
    withWinner('TO', String(home.turnovers), String(away.turnovers), false),
    withWinner('PF', String(home.fouls), String(away.fouls), false),
  ];

  const scoringContext: GameReportComparisonRow[] = [
    withWinner(
      'POT',
      formatOptionalAdvancedTeamStat(game, 'home', 'points_off_turnovers'),
      formatOptionalAdvancedTeamStat(game, 'away', 'points_off_turnovers')
    ),
    withWinner(
      'PITP',
      formatOptionalAdvancedTeamStat(game, 'home', 'points_in_paint'),
      formatOptionalAdvancedTeamStat(game, 'away', 'points_in_paint')
    ),
    withWinner(
      '2nd Chance',
      formatOptionalAdvancedTeamStat(game, 'home', 'second_chance_points'),
      formatOptionalAdvancedTeamStat(game, 'away', 'second_chance_points')
    ),
    withWinner(
      'FB PTS',
      formatOptionalAdvancedTeamStat(game, 'home', 'fastbreak_points'),
      formatOptionalAdvancedTeamStat(game, 'away', 'fastbreak_points')
    ),
    withWinner(
      'Bench Pts',
      formatOptionalAdvancedTeamStat(game, 'home', 'bench_points'),
      formatOptionalAdvancedTeamStat(game, 'away', 'bench_points')
    ),
    ...gameFlowComparisonRows(game),
  ];

  return { shooting, teamStats, scoringContext };
}

/** @deprecated Prefer buildComparisonSections — kept for splitComparisonRows tests. */
export function splitComparisonRows(rows: GameReportComparisonRow[]): {
  basic: GameReportComparisonRow[];
  advanced: GameReportComparisonRow[];
} {
  const shooting = new Set<string>(SHOOTING_COMPARISON_LABELS);
  const team = new Set<string>(TEAM_STAT_COMPARISON_LABELS);
  const basic: GameReportComparisonRow[] = [];
  const advanced: GameReportComparisonRow[] = [];
  for (const row of rows) {
    if (shooting.has(row.label) || team.has(row.label)) basic.push(row);
    else advanced.push(row);
  }
  return { basic, advanced };
}

export function buildPeriodStrip(quarterRows: GameReportQuarterRow[]): string {
  return quarterRows
    .map((row) => `${row.label} ${row.home}-${row.away}`)
    .join(' · ');
}

export function resolveOvertimeLabel(
  quarterRows: GameReportQuarterRow[]
): string | null {
  const otRows = quarterRows.filter((row) => row.label.startsWith('OT'));
  if (otRows.length === 0) return null;
  if (otRows.length === 1 && otRows[0]!.label === 'OT') return 'OT';
  return `${otRows.length}OT`;
}

function resolveStructureLabels(
  game: Game,
  tournament: Tournament | undefined
): {
  stageLabel: string | null;
  groupLabel: string | null;
  bracketSlotLabel: string | null;
} {
  const structure = tournament?.structure;
  const stage = findStage(structure, game.stageId);
  const group = findGroup(structure, game.groupId);
  const slot = findBracketSlot(structure, game.bracketSlotId);

  return {
    stageLabel: stage?.name ?? null,
    groupLabel: group?.name ?? null,
    bracketSlotLabel: slot?.label ?? (game.bracketSlotId ? game.bracketSlotId : null),
  };
}

function emptyBoxScoreCells(): string[] {
  return Array.from({ length: PDF_BOX_SCORE_COLUMN_COUNT }, () => EM_DASH);
}

function formatPlayerCells(
  player: PlayerBoxScoreRow,
  recordsFd: boolean,
  recordsPm: boolean
): string[] {
  const adv = MetricsCalculator.calculateAdvancedMetrics(player);
  const reb = player.orb + player.drb;

  return [
    formatReportJerseyNumber(player.number),
    formatPlayerDisplayName(player.name),
    formatReportMinutes(player.minutes_played),
    String(player.points),
    formatReportShootingLine(player.fg_made, player.fg_attempted),
    formatReportPct(player.fg_made, player.fg_attempted),
    formatReportShootingLine(player.three_made, player.three_attempted),
    formatReportPct(player.three_made, player.three_attempted),
    formatReportShootingLine(player.ft_made, player.ft_attempted),
    formatReportPct(player.ft_made, player.ft_attempted),
    String(reb),
    String(player.drb),
    String(player.orb),
    String(player.assists),
    String(player.blocks),
    String(player.blocks_received),
    String(player.steals),
    String(player.turnovers),
    String(player.fouls),
    recordsFd ? String(player.fouls_drawn) : EM_DASH,
    recordsPm ? formatReportPlusMinus(player.plus_minus) : EM_DASH,
    formatReportDecimal(adv.efficiency, 1),
    formatReportDecimal(adv.gameScore, 1),
  ];
}

function formatTeamCoachCells(
  orb: number,
  drb: number,
  turnovers: number,
  fouls: number
): string[] {
  const cells = emptyBoxScoreCells();
  cells[1] = 'Team/Coach';
  cells[10] = String(orb + drb);
  cells[11] = String(drb);
  cells[12] = String(orb);
  cells[17] = String(turnovers);
  cells[18] = String(fouls);
  return cells;
}

function formatTeamTotalCells(
  totals: ReturnType<typeof resolveTeamTotals>,
  sumEff: number,
  sumGmSc: number,
  recordsFd: boolean
): string[] {
  const reb = totals.orb + totals.drb;
  return [
    '',
    'TEAM',
    formatReportMinutes(totals.minutes_played),
    String(totals.points),
    formatReportShootingLine(totals.fg_made, totals.fg_attempted),
    formatReportPct(totals.fg_made, totals.fg_attempted),
    formatReportShootingLine(totals.three_made, totals.three_attempted),
    formatReportPct(totals.three_made, totals.three_attempted),
    formatReportShootingLine(totals.ft_made, totals.ft_attempted),
    formatReportPct(totals.ft_made, totals.ft_attempted),
    String(reb),
    String(totals.drb),
    String(totals.orb),
    String(totals.assists),
    String(totals.blocks),
    String(totals.blocks_received),
    String(totals.steals),
    String(totals.turnovers),
    String(totals.fouls),
    recordsFd ? String(totals.fouls_drawn) : EM_DASH,
    EM_DASH,
    formatReportDecimal(sumEff, 1),
    formatReportDecimal(sumGmSc, 1),
  ];
}

function getTeamPlayerBoxScore(
  game: Game,
  side: TeamSide
): OrderedBoxScoreRow<PlayerBoxScoreRow>[] {
  const team = getTeamForSide(game, side);
  const players: PlayerBoxScoreRow[] = team.players
    .filter((player) => playerPlayedInGame(game, player.id, team.id))
    .map((player) => {
      const stats =
        game.gameStats.find((s) => s.playerId === player.id) ??
        MetricsCalculator.getEmptyStats(player.id);
      return {
        ...stats,
        name: player.name,
        number: player.number,
      };
    });

  const starterIds =
    side === 'home' ? (game.homeStarters ?? []) : (game.awayStarters ?? []);
  return orderBoxScorePlayers(players, starterIds);
}

function buildBoxScoreSection(
  game: Game,
  side: TeamSide,
  recordsFd: boolean,
  recordsPm: boolean
): GameReportBoxScoreSection {
  const team = getTeamForSide(game, side);
  const totals = resolveTeamTotals(game, side);
  const scoreOnly = isScoreOnlyTeam(game, side);
  const rows: GameReportBoxScoreRow[] = [];
  let sumEff = 0;
  let sumGmSc = 0;

  if (!scoreOnly) {
    const ordered = getTeamPlayerBoxScore(game, side);

    for (const row of ordered) {
      if (row.kind === 'divider') {
        const dividerCells = emptyBoxScoreCells();
        dividerCells[1] = 'Bench';
        rows.push({ kind: 'bench_divider', cells: dividerCells });
        continue;
      }

      const player = row.player!;
      const adv = MetricsCalculator.calculateAdvancedMetrics(player);
      sumEff += adv.efficiency;
      sumGmSc += adv.gameScore;
      rows.push({
        kind: 'player',
        cells: formatPlayerCells(player, recordsFd, recordsPm),
      });
    }

    const tc = totals.teamCoach;
    rows.push({
      kind: 'team_coach',
      cells: formatTeamCoachCells(tc.orb, tc.drb, tc.turnovers, tc.fouls),
    });
  }

  rows.push({
    kind: 'team_total',
    cells: formatTeamTotalCells(
      totals,
      scoreOnly ? 0 : sumEff,
      scoreOnly ? 0 : sumGmSc,
      recordsFd
    ),
  });

  return {
    teamName: team.name,
    abbreviation: team.abbreviation,
    score: resolveSideScore(game, side),
    scoreOnly,
    icon:
      resolveTeamIconSrc(team.icon, team.id) ?? null,
    rows,
  };
}

export function buildGameReportModel(
  game: Game,
  tournaments: Tournament[] = [],
  options: BuildGameReportModelOptions = {}
): GameReportModel {
  const gameWithQuarters = ensureGameQuarterStats(game);
  const tournament = tournaments.find((t) => t.id === gameWithQuarters.tournamentId);
  const recordsFd = gameRecordsStat(gameWithQuarters, 'fouls_drawn');
  const recordsPm = gameRecordsStat(gameWithQuarters, 'plus_minus');
  const friendly = isFriendlyGame(gameWithQuarters);

  const gameDate = new Date(gameWithQuarters.date);
  const formattedDate = gameDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedDateWithWeekday = gameDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const homeAbbr = gameWithQuarters.homeTeam.abbreviation || gameWithQuarters.homeTeam.name;
  const awayAbbr = gameWithQuarters.awayTeam.abbreviation || gameWithQuarters.awayTeam.name;
  const homeTeamLabel = `${gameWithQuarters.homeTeam.name} (${homeAbbr})`;
  const awayTeamLabel = `${gameWithQuarters.awayTeam.name} (${awayAbbr})`;
  const homeScore = resolveSideScore(gameWithQuarters, 'home');
  const awayScore = resolveSideScore(gameWithQuarters, 'away');

  const tournamentName =
    resolveGameListLabel(gameWithQuarters, tournament?.name) ?? null;
  const structureLabels = resolveStructureLabels(gameWithQuarters, tournament);
  const comparisonSections = buildComparisonSections(gameWithQuarters);
  const comparisonRows = [
    ...comparisonSections.shooting,
    ...comparisonSections.teamStats,
    ...comparisonSections.scoringContext,
  ];
  const { basic, advanced } = splitComparisonRows(comparisonRows);
  const quarterRows = formatQuarterRowsForReport(
    deriveQuarterScoringRows(gameWithQuarters)
  );
  const overtimeLabel = resolveOvertimeLabel(quarterRows);

  const boxScores: GameReportBoxScoreSection[] = [
    buildBoxScoreSection(gameWithQuarters, 'home', recordsFd, recordsPm),
  ];
  if (hasAwayTeamContent(gameWithQuarters)) {
    boxScores.push(buildBoxScoreSection(gameWithQuarters, 'away', recordsFd, recordsPm));
  }

  return {
    filename: buildGameReportFilename(gameWithQuarters, tournamentName),
    gameId: gameWithQuarters.id,
    shortGameId: shortGameIdFromFull(gameWithQuarters.id),
    tournamentName,
    tournamentIcon: tournament?.icon?.trim() || null,
    seasonYear: tournament?.year ?? null,
    formattedDate,
    formattedDateWithWeekday,
    startTime: gameWithQuarters.startTime?.trim() || null,
    gameFormat: getTournamentGameFormat(gameWithQuarters.tournamentId, tournament),
    isFriendly: friendly,
    stageLabel: structureLabels.stageLabel,
    groupLabel: structureLabels.groupLabel,
    bracketSlotLabel: structureLabels.bracketSlotLabel,
    gameNumber: computeTournamentGameNumber(
      gameWithQuarters,
      options.leagueGames
    ),
    homeTeamLabel,
    awayTeamLabel,
    homeTeamName: gameWithQuarters.homeTeam.name,
    awayTeamName: gameWithQuarters.awayTeam.name,
    homeIcon:
      resolveTeamIconSrc(
        gameWithQuarters.homeTeam.icon,
        gameWithQuarters.homeTeam.id
      ) ?? null,
    awayIcon:
      resolveTeamIconSrc(
        gameWithQuarters.awayTeam.icon,
        gameWithQuarters.awayTeam.id
      ) ?? null,
    homeScore,
    awayScore,
    scoreLine: `${homeAbbr} ${homeScore} - ${awayScore} ${awayAbbr}`,
    homeAbbr,
    awayAbbr,
    hasOvertime: overtimeLabel != null,
    overtimeLabel,
    periodStrip: buildPeriodStrip(quarterRows),
    leaders: [
      formatLeaderLine('Leading Scorer', ' pts', 0, gameWithQuarters, 'points'),
      formatLeaderLine('Most Assists', '', 0, gameWithQuarters, 'assists'),
      formatLeaderLine('Most Rebounds', '', 0, gameWithQuarters, 'rebounds'),
      formatLeaderLine('Best GmSc', '', 1, gameWithQuarters, 'gameScore'),
    ],
    comparisonRows,
    basicComparisonRows: basic,
    advancedComparisonRows: advanced,
    shootingComparisonRows: comparisonSections.shooting,
    teamStatComparisonRows: comparisonSections.teamStats,
    scoringContextComparisonRows: comparisonSections.scoringContext,
    quarterRows,
    boxScores,
    recordsFoulsDrawn: recordsFd,
    recordsPlusMinus: recordsPm,
    hasShotChartData: gameHasShotChartData(gameWithQuarters),
    shotMarkers: (gameWithQuarters.shots ?? []).map((shot) => ({
      x: shot.x,
      y: shot.y,
      made: shot.made,
    })),
  };
}

export const LINEUP_STINTS_COMING_SOON_COPY =
  'On-court lineup stints and lineup +/- — Coming soon.';

/** @deprecated Game flow fields live in scoring context with blank values. */
export const GAME_FLOW_COMING_SOON_COPY =
  'Detailed lead changes, scoring runs, and largest lead — Coming soon.';
