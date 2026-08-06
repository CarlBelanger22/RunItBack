import type { Game, GameStats, Tournament } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import {
  orderBoxScorePlayers,
  type OrderedBoxScoreRow,
} from './boxScoreOrder';
import {
  formatGameLeader,
  getGameLeaders,
  getPersistedTeamStats,
  getPlayerFirstName,
  getTeamForSide,
  formatOptionalAdvancedTeamStat,
  hasAwayTeamContent,
  isScoreOnlyTeam,
  playerPlayedInGame,
  resolveSideScore,
  resolveTeamTotals,
  type TeamSide,
} from './gameDisplay';
import { gameRecordsStat } from './statRecordingCoverage';
import { buildTeamDisplayStats } from './teamDisplayStats';
import {
  deriveQuarterScoringRows,
  ensureGameQuarterStats,
  formatQuarterRowsForReport,
} from './quarterScoring';
import { resolveGameListLabel } from './friendlyGame';

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
  rows: GameReportBoxScoreRow[];
}

export interface GameReportComparisonRow {
  label: string;
  home: string;
  away: string;
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

export interface GameReportModel {
  filename: string;
  tournamentName: string | null;
  formattedDate: string;
  /** Page header: `University of Macau (UM)` */
  homeTeamLabel: string;
  awayTeamLabel: string;
  scoreLine: string;
  homeAbbr: string;
  awayAbbr: string;
  leaders: GameReportLeaderLine[];
  comparisonRows: GameReportComparisonRow[];
  quarterRows: GameReportQuarterRow[];
  boxScores: GameReportBoxScoreSection[];
  recordsFoulsDrawn: boolean;
  recordsPlusMinus: boolean;
}

interface PlayerBoxScoreRow extends GameStats {
  name: string;
  number: number;
}

const EM_DASH = '—';

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

export function formatPlayerDisplayName(fullName: string): string {
  return getPlayerFirstName(fullName);
}

export function buildGameReportFilename(game: Game): string {
  const date = game.date.slice(0, 10);
  const home = game.homeTeam.abbreviation || 'HOME';
  const away = game.awayTeam.abbreviation || 'AWAY';
  return `${date}_${home}-vs-${away}.pdf`;
}

function formatLeaderLine(
  label: string,
  suffix: string,
  decimals: number,
  game: Game,
  metric: 'points' | 'assists' | 'rebounds' | 'efficiency'
): GameReportLeaderLine {
  return {
    label,
    text: formatGameLeader(getGameLeaders(game, metric), suffix, decimals),
  };
}

function buildComparisonRows(game: Game): GameReportComparisonRow[] {
  const home = buildTeamDisplayStats(game, 'home');
  const away = buildTeamDisplayStats(game, 'away');
  const homeTotals = resolveTeamTotals(game, 'home');
  const awayTotals = resolveTeamTotals(game, 'away');

  const astTo = (stats: typeof home) =>
    stats.turnovers > 0
      ? stats.assistToTurnoverRatio.toFixed(1)
      : stats.assists > 0
        ? String(stats.assists)
        : '0';

  return [
    { label: 'PTS', home: String(home.points), away: String(away.points) },
    {
      label: 'FG',
      home: formatReportShootingLine(home.fg_made, home.fg_attempted),
      away: formatReportShootingLine(away.fg_made, away.fg_attempted),
    },
    {
      label: 'FG%',
      home: formatReportPct(home.fg_made, home.fg_attempted),
      away: formatReportPct(away.fg_made, away.fg_attempted),
    },
    {
      label: '3PT',
      home: formatReportShootingLine(home.three_made, home.three_attempted),
      away: formatReportShootingLine(away.three_made, away.three_attempted),
    },
    {
      label: '3PT%',
      home: formatReportPct(home.three_made, home.three_attempted),
      away: formatReportPct(away.three_made, away.three_attempted),
    },
    {
      label: 'FT',
      home: formatReportShootingLine(home.ft_made, home.ft_attempted),
      away: formatReportShootingLine(away.ft_made, away.ft_attempted),
    },
    {
      label: 'FT%',
      home: formatReportPct(home.ft_made, home.ft_attempted),
      away: formatReportPct(away.ft_made, away.ft_attempted),
    },
    { label: 'REB', home: String(home.rebounds), away: String(away.rebounds) },
    { label: 'AST', home: String(home.assists), away: String(away.assists) },
    { label: 'STL', home: String(home.steals), away: String(away.steals) },
    { label: 'BLK', home: String(home.blocks), away: String(away.blocks) },
    { label: 'TO', home: String(home.turnovers), away: String(away.turnovers) },
    {
      label: 'POT',
      home: formatOptionalAdvancedTeamStat(game, 'home', 'points_off_turnovers'),
      away: formatOptionalAdvancedTeamStat(game, 'away', 'points_off_turnovers'),
    },
    {
      label: 'FB PTS',
      home: formatOptionalAdvancedTeamStat(game, 'home', 'fastbreak_points'),
      away: formatOptionalAdvancedTeamStat(game, 'away', 'fastbreak_points'),
    },
    {
      label: 'PITP',
      home: formatOptionalAdvancedTeamStat(game, 'home', 'points_in_paint'),
      away: formatOptionalAdvancedTeamStat(game, 'away', 'points_in_paint'),
    },
    { label: 'ORB', home: String(homeTotals.orb), away: String(awayTotals.orb) },
    {
      label: '2nd Chance',
      home: formatOptionalAdvancedTeamStat(game, 'home', 'second_chance_points'),
      away: formatOptionalAdvancedTeamStat(game, 'away', 'second_chance_points'),
    },
    {
      label: 'Bench Pts',
      home: formatOptionalAdvancedTeamStat(game, 'home', 'bench_points'),
      away: formatOptionalAdvancedTeamStat(game, 'away', 'bench_points'),
    },
    { label: 'PF', home: String(home.fouls), away: String(away.fouls) },
    {
      label: 'eFG%',
      home:
        home.fg_attempted > 0
          ? `${home.effectiveFieldGoalPercentage.toFixed(1)}%`
          : '-',
      away:
        away.fg_attempted > 0
          ? `${away.effectiveFieldGoalPercentage.toFixed(1)}%`
          : '-',
    },
    {
      label: 'TS%',
      home:
        home.fg_attempted + 0.44 * home.ft_attempted > 0
          ? `${home.trueShootingPercentage.toFixed(1)}%`
          : '-',
      away:
        away.fg_attempted + 0.44 * away.ft_attempted > 0
          ? `${away.trueShootingPercentage.toFixed(1)}%`
          : '-',
    },
    { label: 'AST/TO', home: astTo(home), away: astTo(away) },
  ];
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
    player.number > 0 ? String(player.number) : '',
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
    rows,
  };
}

export function buildGameReportModel(
  game: Game,
  tournaments: Tournament[] = []
): GameReportModel {
  const gameWithQuarters = ensureGameQuarterStats(game);
  const tournament = tournaments.find((t) => t.id === gameWithQuarters.tournamentId);
  const recordsFd = gameRecordsStat(gameWithQuarters, 'fouls_drawn');
  const recordsPm = gameRecordsStat(gameWithQuarters, 'plus_minus');

  const gameDate = new Date(gameWithQuarters.date);
  const formattedDate = gameDate.toLocaleDateString('en-US', {
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

  const boxScores: GameReportBoxScoreSection[] = [
    buildBoxScoreSection(gameWithQuarters, 'home', recordsFd, recordsPm),
  ];
  if (hasAwayTeamContent(gameWithQuarters)) {
    boxScores.push(buildBoxScoreSection(gameWithQuarters, 'away', recordsFd, recordsPm));
  }

  return {
    filename: buildGameReportFilename(gameWithQuarters),
    tournamentName:
      resolveGameListLabel(gameWithQuarters, tournament?.name) ?? null,
    formattedDate,
    homeTeamLabel,
    awayTeamLabel,
    scoreLine: `${homeAbbr} ${homeScore} - ${awayScore} ${awayAbbr}`,
    homeAbbr,
    awayAbbr,
    leaders: [
      formatLeaderLine('Leading Scorer', ' pts', 0, gameWithQuarters, 'points'),
      formatLeaderLine('Most Assists', '', 0, gameWithQuarters, 'assists'),
      formatLeaderLine('Most Rebounds', '', 0, gameWithQuarters, 'rebounds'),
      formatLeaderLine('Best Efficiency', '', 0, gameWithQuarters, 'efficiency'),
    ],
    comparisonRows: buildComparisonRows(gameWithQuarters),
    quarterRows: formatQuarterRowsForReport(
      deriveQuarterScoringRows(gameWithQuarters)
    ),
    boxScores,
    recordsFoulsDrawn: recordsFd,
    recordsPlusMinus: recordsPm,
  };
}
