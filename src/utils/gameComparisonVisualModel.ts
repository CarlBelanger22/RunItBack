import type { Game } from '../App';
import {
  resolveOptionalAdvancedTeamStat,
  resolveTeamTotals,
  type OptionalAdvancedTeamStatKey,
  type TeamSide,
} from './gameDisplay';
import { buildTeamDisplayStats } from './teamDisplayStats';

export interface ShootingSideStats {
  made: number;
  attempted: number;
  pct: number | null;
  line: string;
  scoreOnly: boolean;
}

export interface ShootingComparisonRow {
  key: string;
  label: string;
  home: ShootingSideStats;
  away: ShootingSideStats;
}

export interface ComparisonSideValue {
  value: number | null;
  display: string;
}

export interface MinorComparisonRow {
  key: string;
  label: string;
  home: ComparisonSideValue;
  away: ComparisonSideValue;
  major?: boolean;
}

export interface MajorComparisonGroup {
  key: string;
  label: string;
  home: ComparisonSideValue;
  away: ComparisonSideValue;
  minors: MinorComparisonRow[];
}

export interface GameComparisonVisualModel {
  homeAbbr: string;
  awayAbbr: string;
  shooting: ShootingComparisonRow[];
  majorGroups: MajorComparisonGroup[];
  minorRows: MinorComparisonRow[];
  advancedRows: MinorComparisonRow[];
}

function shootingPct(made: number, attempted: number): number | null {
  if (attempted <= 0) return null;
  return Math.round((made / attempted) * 100);
}

function shootingLine(made: number, attempted: number, scoreOnly: boolean): string {
  if (scoreOnly) return '—';
  if (attempted <= 0) return '0/0';
  return `${made}/${attempted}`;
}

function buildShootingSide(
  made: number,
  attempted: number,
  scoreOnly: boolean
): ShootingSideStats {
  return {
    made,
    attempted,
    pct: scoreOnly ? null : shootingPct(made, attempted),
    line: shootingLine(made, attempted, scoreOnly),
    scoreOnly,
  };
}

function buildShootingRow(
  key: string,
  label: string,
  homeMade: number,
  homeAttempted: number,
  awayMade: number,
  awayAttempted: number,
  homeScoreOnly: boolean,
  awayScoreOnly: boolean
): ShootingComparisonRow {
  return {
    key,
    label,
    home: buildShootingSide(homeMade, homeAttempted, homeScoreOnly),
    away: buildShootingSide(awayMade, awayAttempted, awayScoreOnly),
  };
}

function numericValue(value: number, scoreOnly: boolean): ComparisonSideValue {
  if (scoreOnly) {
    return { value: null, display: '—' };
  }
  return { value, display: String(value) };
}

function optionalValue(
  game: Game,
  side: TeamSide,
  key: OptionalAdvancedTeamStatKey
): ComparisonSideValue {
  const value = resolveOptionalAdvancedTeamStat(game, side, key);
  if (value === null) {
    return { value: null, display: '—' };
  }
  return { value, display: String(value) };
}

export function splitBarPercents(
  home: number | null,
  away: number | null
): { homePct: number; awayPct: number } {
  const homeVal = home ?? 0;
  const awayVal = away ?? 0;
  const total = homeVal + awayVal;
  if (total <= 0) {
    return { homePct: 50, awayPct: 50 };
  }
  return {
    homePct: (homeVal / total) * 100,
    awayPct: (awayVal / total) * 100,
  };
}

export function minorBarPercents(
  home: number | null,
  away: number | null
): { homePct: number; awayPct: number } {
  const homeVal = home ?? 0;
  const awayVal = away ?? 0;
  const max = Math.max(homeVal, awayVal, 1);
  return {
    homePct: (homeVal / max) * 100,
    awayPct: (awayVal / max) * 100,
  };
}

export function buildGameComparisonVisualModel(game: Game): GameComparisonVisualModel {
  const homeStats = buildTeamDisplayStats(game, 'home');
  const awayStats = buildTeamDisplayStats(game, 'away');
  const homeTotals = resolveTeamTotals(game, 'home');
  const awayTotals = resolveTeamTotals(game, 'away');

  const homeTwoMade = homeStats.fg_made - homeStats.three_made;
  const homeTwoAttempted = homeStats.fg_attempted - homeStats.three_attempted;
  const awayTwoMade = awayStats.fg_made - awayStats.three_made;
  const awayTwoAttempted = awayStats.fg_attempted - awayStats.three_attempted;

  const shooting: ShootingComparisonRow[] = [
    buildShootingRow(
      'two',
      '2 pointers',
      homeTwoMade,
      homeTwoAttempted,
      awayTwoMade,
      awayTwoAttempted,
      homeStats.scoreOnly,
      awayStats.scoreOnly
    ),
    buildShootingRow(
      'three',
      '3 pointers',
      homeStats.three_made,
      homeStats.three_attempted,
      awayStats.three_made,
      awayStats.three_attempted,
      homeStats.scoreOnly,
      awayStats.scoreOnly
    ),
    buildShootingRow(
      'fg',
      'Field goals',
      homeStats.fg_made,
      homeStats.fg_attempted,
      awayStats.fg_made,
      awayStats.fg_attempted,
      homeStats.scoreOnly,
      awayStats.scoreOnly
    ),
    buildShootingRow(
      'ft',
      'Free throws',
      homeStats.ft_made,
      homeStats.ft_attempted,
      awayStats.ft_made,
      awayStats.ft_attempted,
      homeStats.scoreOnly,
      awayStats.scoreOnly
    ),
  ];

  const majorGroups: MajorComparisonGroup[] = [
    {
      key: 'rebounds',
      label: 'Rebounds',
      home: numericValue(homeStats.rebounds, homeStats.scoreOnly),
      away: numericValue(awayStats.rebounds, awayStats.scoreOnly),
      minors: [
        {
          key: 'drb',
          label: 'Defensive rebounds',
          home: numericValue(homeStats.drb, homeStats.scoreOnly),
          away: numericValue(awayStats.drb, awayStats.scoreOnly),
        },
        {
          key: 'orb',
          label: 'Offensive rebounds',
          home: numericValue(homeTotals.orb, homeStats.scoreOnly),
          away: numericValue(awayTotals.orb, awayStats.scoreOnly),
        },
      ],
    },
  ];

  const minorRows: MinorComparisonRow[] = [
    {
      key: 'assists',
      label: 'Assists',
      home: numericValue(homeStats.assists, homeStats.scoreOnly),
      away: numericValue(awayStats.assists, awayStats.scoreOnly),
      major: true,
    },
    {
      key: 'steals',
      label: 'Steals',
      home: numericValue(homeStats.steals, homeStats.scoreOnly),
      away: numericValue(awayStats.steals, awayStats.scoreOnly),
    },
    {
      key: 'blocks',
      label: 'Blocks',
      home: numericValue(homeStats.blocks, homeStats.scoreOnly),
      away: numericValue(awayStats.blocks, awayStats.scoreOnly),
    },
    {
      key: 'fouls',
      label: 'Fouls',
      home: numericValue(homeStats.fouls, homeStats.scoreOnly),
      away: numericValue(awayStats.fouls, awayStats.scoreOnly),
    },
    {
      key: 'turnovers',
      label: 'Turnovers',
      home: numericValue(homeStats.turnovers, homeStats.scoreOnly),
      away: numericValue(awayStats.turnovers, awayStats.scoreOnly),
    },
  ];

  const advancedRows: MinorComparisonRow[] = [
    {
      key: 'pts_off_to',
      label: 'Pts off TO',
      home: optionalValue(game, 'home', 'points_off_turnovers'),
      away: optionalValue(game, 'away', 'points_off_turnovers'),
    },
    {
      key: 'paint',
      label: 'Pts in Paint',
      home: optionalValue(game, 'home', 'points_in_paint'),
      away: optionalValue(game, 'away', 'points_in_paint'),
    },
    {
      key: 'fastbreak',
      label: 'Fast Break',
      home: optionalValue(game, 'home', 'fastbreak_points'),
      away: optionalValue(game, 'away', 'fastbreak_points'),
    },
    {
      key: 'second_chance',
      label: '2nd Chance',
      home: optionalValue(game, 'home', 'second_chance_points'),
      away: optionalValue(game, 'away', 'second_chance_points'),
    },
    {
      key: 'bench',
      label: 'Bench Pts',
      home: optionalValue(game, 'home', 'bench_points'),
      away: optionalValue(game, 'away', 'bench_points'),
    },
  ];

  return {
    homeAbbr: game.homeTeam.abbreviation || game.homeTeam.name,
    awayAbbr: game.awayTeam.abbreviation || game.awayTeam.name,
    shooting,
    majorGroups,
    minorRows,
    advancedRows,
  };
}
