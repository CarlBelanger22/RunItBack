/**
 * Tournament-scoped team season rows for the Team Stats table.
 * Box averages via aggregateTeamSeasonAverages; W-L / DIFF / Opp PPG from final scores.
 */
import type { Game, Team } from '../App';
import {
  aggregateTeamSeasonAverages,
  computeScopedTeamScoring,
  computeTeamSeasonDerived,
  type TeamSeasonDerivedStats,
  type TeamSeasonStatBucket,
} from './gameDisplay';
import { calculateTeamStandings } from './tournamentStandings';

export const STANDARD_TOURNAMENT_TEAM_STATS_FIELDS = [
  'GP',
  'W-L',
  'PPG',
  'Opp PPG',
  'DIFF',
  'RPG',
  'APG',
  'SPG',
  'BPG',
  'FG%',
  '3P%',
  'FT%',
  'TOPG',
  'FPG',
  'AST/TO',
] as const;

export const ADVANCED_TOURNAMENT_TEAM_STATS_FIELDS = [
  'FG',
  '3PT',
  'FT',
  'ORPG',
  'DRPG',
  'FDPG',
  'PITP',
  'FB',
  '2nd Chance',
  'POT',
  'Bench PPG',
  'TS%',
  'eFG%',
  '2P%',
] as const;

export type StandardTournamentTeamStatsField =
  (typeof STANDARD_TOURNAMENT_TEAM_STATS_FIELDS)[number];

export type AdvancedTournamentTeamStatsField =
  (typeof ADVANCED_TOURNAMENT_TEAM_STATS_FIELDS)[number];

export type TournamentTeamStatsSortField =
  | 'Team'
  | StandardTournamentTeamStatsField
  | AdvancedTournamentTeamStatsField;

export interface TournamentTeamSeasonRow {
  team: Team;
  wins: number;
  losses: number;
  /** Completed scored games (W+L). */
  gamesPlayed: number;
  /** Games with box-score sample (may differ from gamesPlayed for score-only). */
  gamesInSample: number;
  pointsDiff: number;
  ppg: number;
  papg: number;
  totals: TeamSeasonStatBucket;
  perGame: TeamSeasonStatBucket;
  derived: TeamSeasonDerivedStats;
}

export function aggregateTournamentTeamSeasonStats(
  teams: Team[],
  games: Game[]
): TournamentTeamSeasonRow[] {
  const standings = calculateTeamStandings(teams, games);
  const byId = new Map(standings.map((s) => [s.team.id, s]));

  return teams.map((team) => {
    const standing = byId.get(team.id);
    const agg = aggregateTeamSeasonAverages(games, team);
    const scoring = computeScopedTeamScoring(games, team.id);
    const derived = computeTeamSeasonDerived(
      agg.totals,
      agg.perGame,
      scoring,
      {
        total: agg.foulsDrawnTotal,
        games: agg.gamesWithFoulsDrawnData,
      },
      {
        total: agg.personalFoulsTotal,
        games: agg.gamesWithPersonalFoulsData,
      }
    );

    return {
      team,
      wins: standing?.wins ?? 0,
      losses: standing?.losses ?? 0,
      gamesPlayed: standing?.gamesPlayed ?? 0,
      gamesInSample: agg.gamesInSample,
      pointsDiff: standing?.pointsDiff ?? 0,
      ppg: standing?.ppg ?? scoring.ppg,
      papg: standing?.papg ?? scoring.papg,
      totals: agg.totals,
      perGame: agg.perGame,
      derived,
    };
  });
}

export function defaultSortOrderForTeamField(
  field: TournamentTeamStatsSortField
): 'asc' | 'desc' {
  if (field === 'Team') return 'asc';
  // W-L sorts by win% — default best records first
  return 'desc';
}

function pct(made: number, attempted: number): number | null {
  return attempted > 0 ? (made / attempted) * 100 : null;
}

function sortValue(
  row: TournamentTeamSeasonRow,
  field: TournamentTeamStatsSortField
): number | string | null {
  const { totals, derived, perGame } = row;
  switch (field) {
    case 'Team':
      return row.team.name.toLowerCase();
    case 'GP':
      return row.gamesPlayed;
    case 'W-L':
      return row.gamesPlayed > 0
        ? row.wins / row.gamesPlayed + row.wins * 0.0001
        : -1;
    case 'PPG':
      return row.ppg;
    case 'Opp PPG':
      return row.papg;
    case 'DIFF':
      return row.pointsDiff;
    case 'RPG':
      return derived.rpg;
    case 'APG':
      return derived.apg;
    case 'SPG':
      return derived.spg;
    case 'BPG':
      return derived.bpg;
    case 'FG%':
      return pct(totals.fg_made, totals.fg_attempted);
    case '3P%':
      return pct(totals.three_made, totals.three_attempted);
    case 'FT%':
      return pct(totals.ft_made, totals.ft_attempted);
    case 'TOPG':
      return derived.topg;
    case 'FPG':
      return derived.fpg;
    case 'AST/TO':
      return derived.astTo;
    case 'FG':
      return totals.fg_made;
    case '3PT':
      return totals.three_made;
    case 'FT':
      return totals.ft_made;
    case 'ORPG':
      return perGame.orb;
    case 'DRPG':
      return perGame.drb;
    case 'FDPG':
      return derived.fdpg;
    case 'PITP':
      return derived.paintPpg;
    case 'FB':
      return derived.fastbreakPpg;
    case '2nd Chance':
      return derived.secondChancePpg;
    case 'POT':
      return derived.pointsOffTurnoversPpg;
    case 'Bench PPG':
      return perGame.bench_points;
    case 'TS%':
      return derived.tsPct;
    case 'eFG%':
      return derived.efgPct;
    case '2P%':
      return derived.twoPtPct;
    default:
      return null;
  }
}

export function sortTournamentTeamSeasonRows(
  rows: TournamentTeamSeasonRow[],
  field: TournamentTeamStatsSortField,
  order: 'asc' | 'desc'
): TournamentTeamSeasonRow[] {
  const dir = order === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, field);
    const vb = sortValue(b, field);
    if (va == null && vb == null) {
      return a.team.name.localeCompare(b.team.name);
    }
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string' && typeof vb === 'string') {
      return va.localeCompare(vb) * dir;
    }
    const na = Number(va);
    const nb = Number(vb);
    if (na !== nb) return (na - nb) * dir;
    return a.team.name.localeCompare(b.team.name);
  });
}

const NO_STAT = '-';

function fmt(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return NO_STAT;
  return value.toFixed(decimals);
}

function fmtPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return NO_STAT;
  return value.toFixed(1);
}

export function formatStandardTournamentTeamStatsRow(
  row: TournamentTeamSeasonRow
): string[] {
  const { totals, derived } = row;
  return [
    String(row.gamesPlayed),
    `${row.wins}-${row.losses}`,
    fmt(row.ppg),
    fmt(row.papg),
    row.gamesPlayed > 0
      ? `${row.pointsDiff >= 0 ? '+' : ''}${row.pointsDiff}`
      : NO_STAT,
    fmt(derived.rpg),
    fmt(derived.apg),
    fmt(derived.spg),
    fmt(derived.bpg),
    fmtPct(pct(totals.fg_made, totals.fg_attempted)),
    fmtPct(pct(totals.three_made, totals.three_attempted)),
    fmtPct(pct(totals.ft_made, totals.ft_attempted)),
    fmt(derived.topg),
    fmt(derived.fpg),
    fmt(derived.astTo),
  ];
}

export function formatAdvancedTournamentTeamStatsRow(
  row: TournamentTeamSeasonRow
): string[] {
  const { totals, perGame, derived } = row;
  return [
    `${totals.fg_made}/${totals.fg_attempted}`,
    `${totals.three_made}/${totals.three_attempted}`,
    `${totals.ft_made}/${totals.ft_attempted}`,
    fmt(perGame.orb),
    fmt(perGame.drb),
    fmt(derived.fdpg),
    fmt(derived.paintPpg),
    fmt(derived.fastbreakPpg),
    fmt(derived.secondChancePpg),
    fmt(derived.pointsOffTurnoversPpg),
    fmt(perGame.bench_points),
    fmtPct(derived.tsPct),
    fmtPct(derived.efgPct),
    fmtPct(derived.twoPtPct),
  ];
}

/** Equal-weight mean of finite numbers; nulls/NaN skipped. */
function meanOf(values: Array<number | null | undefined>): number | null {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
    count += 1;
  }
  return count === 0 ? null : sum / count;
}

/** Sum of finite numbers; nulls/NaN skipped. */
function sumOf(values: Array<number | null | undefined>): number {
  let sum = 0;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
  }
  return sum;
}

/** NBA/FIBA-style league %: Σ made ÷ Σ attempted (null if no attempts). */
function volumePct(
  madeValues: Array<number | null | undefined>,
  attemptedValues: Array<number | null | undefined>
): number | null {
  const made = sumOf(madeValues);
  const attempted = sumOf(attemptedValues);
  return attempted > 0 ? (made / attempted) * 100 : null;
}

function fmtSignedDiff(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return NO_STAT;
  const n = Number(value.toFixed(1));
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
}

function fmtMakesAttempts(
  made: number | null,
  attempted: number | null
): string {
  if (made == null || attempted == null) return NO_STAT;
  return `${fmt(made)}/${fmt(attempted)}`;
}

/** Teams with at least one completed scored game (zeros do not dilute league means). */
function teamsWithGames(rows: TournamentTeamSeasonRow[]): TournamentTeamSeasonRow[] {
  return rows.filter((r) => r.gamesPlayed > 0);
}

/**
 * League average cells for Standard Team Stats (equal weight per team with GP > 0).
 * GP and W-L are always `—`. Shooting % = Σ made ÷ Σ attempted (NBA/FIBA volume-weighted).
 */
export function formatStandardLeagueAverageTournamentTeamStatsRow(
  rows: TournamentTeamSeasonRow[]
): string[] {
  const sample = teamsWithGames(rows);
  if (sample.length === 0) {
    return STANDARD_TOURNAMENT_TEAM_STATS_FIELDS.map(() => NO_STAT);
  }

  return [
    NO_STAT, // GP — no meaningful league average
    NO_STAT, // W-L
    fmt(meanOf(sample.map((r) => r.ppg))),
    fmt(meanOf(sample.map((r) => r.papg))),
    fmtSignedDiff(meanOf(sample.map((r) => r.pointsDiff))),
    fmt(meanOf(sample.map((r) => r.derived.rpg))),
    fmt(meanOf(sample.map((r) => r.derived.apg))),
    fmt(meanOf(sample.map((r) => r.derived.spg))),
    fmt(meanOf(sample.map((r) => r.derived.bpg))),
    fmtPct(
      volumePct(
        sample.map((r) => r.totals.fg_made),
        sample.map((r) => r.totals.fg_attempted)
      )
    ),
    fmtPct(
      volumePct(
        sample.map((r) => r.totals.three_made),
        sample.map((r) => r.totals.three_attempted)
      )
    ),
    fmtPct(
      volumePct(
        sample.map((r) => r.totals.ft_made),
        sample.map((r) => r.totals.ft_attempted)
      )
    ),
    fmt(meanOf(sample.map((r) => r.derived.topg))),
    fmt(meanOf(sample.map((r) => r.derived.fpg))),
    fmt(meanOf(sample.map((r) => r.derived.astTo))),
  ];
}

/** Points for TS% pooling: prefer scored PPG × GP, else box totals. */
function teamScoringPointsForLeagueAvg(row: TournamentTeamSeasonRow): number {
  if (row.derived.gamesWithScore > 0) {
    return row.ppg * row.derived.gamesWithScore;
  }
  if (row.gamesPlayed > 0) {
    return row.ppg * row.gamesPlayed;
  }
  return row.totals.points;
}

/**
 * League average cells for Advanced Team Stats (equal weight per team with GP > 0).
 * FG/3PT/FT = mean makes / mean attempts (ratio ≡ Σ/Σ).
 * TS% / eFG% / 2P% = volume-weighted from summed team totals.
 */
export function formatAdvancedLeagueAverageTournamentTeamStatsRow(
  rows: TournamentTeamSeasonRow[]
): string[] {
  const sample = teamsWithGames(rows);
  if (sample.length === 0) {
    return ADVANCED_TOURNAMENT_TEAM_STATS_FIELDS.map(() => NO_STAT);
  }

  const fgMade = sumOf(sample.map((r) => r.totals.fg_made));
  const fgAttempted = sumOf(sample.map((r) => r.totals.fg_attempted));
  const threeMade = sumOf(sample.map((r) => r.totals.three_made));
  const threeAttempted = sumOf(sample.map((r) => r.totals.three_attempted));
  const ftAttempted = sumOf(sample.map((r) => r.totals.ft_attempted));
  const twoMade = fgMade - threeMade;
  const twoAttempted = fgAttempted - threeAttempted;
  const scoringPoints = sumOf(sample.map(teamScoringPointsForLeagueAvg));
  const tsDenom = fgAttempted + 0.44 * ftAttempted;

  const efgPct =
    fgAttempted > 0
      ? ((fgMade + 0.5 * threeMade) / fgAttempted) * 100
      : null;
  const twoPtPct = twoAttempted > 0 ? (twoMade / twoAttempted) * 100 : null;
  const tsPct =
    tsDenom > 0 && scoringPoints > 0
      ? (scoringPoints / (2 * tsDenom)) * 100
      : tsDenom > 0 && scoringPoints === 0
        ? 0
        : null;

  return [
    fmtMakesAttempts(
      meanOf(sample.map((r) => r.totals.fg_made)),
      meanOf(sample.map((r) => r.totals.fg_attempted))
    ),
    fmtMakesAttempts(
      meanOf(sample.map((r) => r.totals.three_made)),
      meanOf(sample.map((r) => r.totals.three_attempted))
    ),
    fmtMakesAttempts(
      meanOf(sample.map((r) => r.totals.ft_made)),
      meanOf(sample.map((r) => r.totals.ft_attempted))
    ),
    fmt(meanOf(sample.map((r) => r.perGame.orb))),
    fmt(meanOf(sample.map((r) => r.perGame.drb))),
    fmt(meanOf(sample.map((r) => r.derived.fdpg))),
    fmt(meanOf(sample.map((r) => r.derived.paintPpg))),
    fmt(meanOf(sample.map((r) => r.derived.fastbreakPpg))),
    fmt(meanOf(sample.map((r) => r.derived.secondChancePpg))),
    fmt(meanOf(sample.map((r) => r.derived.pointsOffTurnoversPpg))),
    fmt(meanOf(sample.map((r) => r.perGame.bench_points))),
    fmtPct(tsPct),
    fmtPct(efgPct),
    fmtPct(twoPtPct),
  ];
}

export const TOURNAMENT_TEAM_STATS_NO_VALUE = NO_STAT;
