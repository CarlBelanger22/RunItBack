import type { Game, GameEvent, TeamStats } from '../App';
import { getPersistedTeamStats, resolveSideScore } from './gameDisplay';

export interface QuarterScoringRow {
  label: string;
  home: number;
  away: number;
}

export interface SnapshotQuarterStats {
  teamId: string;
  q1_points: number;
  q2_points: number;
  q3_points: number;
  q4_points: number;
  ot_points: number;
  total_points: number;
}

export function snapshotQuarterStatsFromTeamStats(
  stats: TeamStats
): SnapshotQuarterStats {
  return {
    teamId: stats.teamId,
    q1_points: stats.q1_points,
    q2_points: stats.q2_points,
    q3_points: stats.q3_points,
    q4_points: stats.q4_points,
    ot_points: stats.ot_points,
    total_points: stats.total_points,
  };
}

export function applySnapshotQuarterStats(
  base: TeamStats,
  snapshot: SnapshotQuarterStats
): TeamStats {
  return {
    ...base,
    teamId: snapshot.teamId,
    q1_points: snapshot.q1_points,
    q2_points: snapshot.q2_points,
    q3_points: snapshot.q3_points,
    q4_points: snapshot.q4_points,
    ot_points: snapshot.ot_points,
    total_points: snapshot.total_points || base.total_points,
  };
}

function quarterLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  return `OT${period - 4}`;
}

function freeThrowEventPoints(details: Record<string, unknown>): number {
  if (typeof details.made === 'boolean') return details.made ? 1 : 0;
  const attempts = details.attempts as boolean[] | undefined;
  return attempts?.filter(Boolean).length ?? 0;
}

function deriveFromPeriodEndEvents(game: Game): QuarterScoringRow[] | null {
  const periodEnds = (game.events ?? [])
    .filter((e) => e.type === 'period_end')
    .sort((a, b) => a.period - b.period || a.timestamp - b.timestamp);

  if (periodEnds.length === 0) return null;

  const byPeriod = new Map<number, GameEvent>();
  for (const event of periodEnds) {
    byPeriod.set(event.period, event);
  }
  const uniqueEnds = [...byPeriod.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, event]) => event);

  let prevHome = 0;
  let prevAway = 0;
  const rows: QuarterScoringRow[] = [];

  for (const event of uniqueEnds) {
    const home = event.homeScore ?? 0;
    const away = event.awayScore ?? 0;
    const homeQ = home - prevHome;
    const awayQ = away - prevAway;
    if (homeQ === 0 && awayQ === 0 && rows.length > 0) {
      continue;
    }
    rows.push({
      label: quarterLabel(event.period),
      home: homeQ,
      away: awayQ,
    });
    prevHome = home;
    prevAway = away;
  }

  return rows.length > 0 ? rows : null;
}

function addScoringToBuckets(
  game: Game,
  buckets: Map<number, { home: number; away: number }>,
  period: number,
  teamId: string,
  points: number
): void {
  if (points <= 0) return;
  const bucket = buckets.get(period) ?? { home: 0, away: 0 };
  if (teamId === game.homeTeamId) bucket.home += points;
  else bucket.away += points;
  buckets.set(period, bucket);
}

function deriveFromScoringEvents(game: Game): QuarterScoringRow[] | null {
  const buckets = new Map<number, { home: number; away: number }>();

  for (const event of game.events ?? []) {
    let points = 0;
    if (event.type === 'shot_attempt' && event.details.made) {
      points = event.details.isThree ? 3 : 2;
    } else if (event.type === 'free_throw') {
      points = freeThrowEventPoints(event.details);
    } else {
      continue;
    }
    addScoringToBuckets(game, buckets, event.period || 1, event.teamId, points);
  }

  if (buckets.size === 0) return null;

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([period, scores]) => ({
      label: quarterLabel(period),
      home: scores.home,
      away: scores.away,
    }));
}

function deriveFromShots(game: Game): QuarterScoringRow[] | null {
  const buckets = new Map<number, { home: number; away: number }>();

  for (const shot of game.shots ?? []) {
    if (!shot.made) continue;
    const playerTeamId =
      game.homeTeam.players.some((p) => p.id === shot.playerId)
        ? game.homeTeamId
        : game.awayTeam.players.some((p) => p.id === shot.playerId)
          ? game.awayTeamId
          : null;
    if (!playerTeamId) continue;
    const points = shot.isThree ? 3 : 2;
    addScoringToBuckets(game, buckets, shot.period || 1, playerTeamId, points);
  }

  if (buckets.size === 0) return null;

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([period, scores]) => ({
      label: quarterLabel(period),
      home: scores.home,
      away: scores.away,
    }));
}

function deriveFromPersistedTeamStats(game: Game): QuarterScoringRow[] {
  const homeStats = getPersistedTeamStats(game, 'home');
  const awayStats = getPersistedTeamStats(game, 'away');

  const rows: QuarterScoringRow[] = [
    {
      label: 'Q1',
      home: homeStats?.q1_points ?? 0,
      away: awayStats?.q1_points ?? 0,
    },
    {
      label: 'Q2',
      home: homeStats?.q2_points ?? 0,
      away: awayStats?.q2_points ?? 0,
    },
    {
      label: 'Q3',
      home: homeStats?.q3_points ?? 0,
      away: awayStats?.q3_points ?? 0,
    },
    {
      label: 'Q4',
      home: homeStats?.q4_points ?? 0,
      away: awayStats?.q4_points ?? 0,
    },
  ];

  const homeOt = homeStats?.ot_points ?? 0;
  const awayOt = awayStats?.ot_points ?? 0;
  if (homeOt > 0 || awayOt > 0) {
    rows.push({ label: 'OT', home: homeOt, away: awayOt });
  }

  return rows;
}

function quarterRowsTotal(rows: QuarterScoringRow[], side: 'home' | 'away'): number {
  return rows.reduce((sum, row) => sum + row[side], 0);
}

export function isHealthyQuarterRows(
  rows: QuarterScoringRow[],
  homeFinal: number,
  awayFinal: number
): boolean {
  if (rows.length === 0) return false;

  const homeSum = quarterRowsTotal(rows, 'home');
  const awaySum = quarterRowsTotal(rows, 'away');
  if (homeSum !== homeFinal || awaySum !== awayFinal) return false;

  const nonZeroQuarters = rows.filter(
    (row) => row.home !== 0 || row.away !== 0
  ).length;
  if (nonZeroQuarters <= 1 && homeFinal + awayFinal > 0) return false;

  return true;
}

export function deriveQuarterScoringRows(game: Game): QuarterScoringRow[] | null {
  const homeFinal = resolveSideScore(game, 'home');
  const awayFinal = resolveSideScore(game, 'away');

  const candidates: (QuarterScoringRow[] | null)[] = [
    deriveFromScoringEvents(game),
    deriveFromShots(game),
    deriveFromPeriodEndEvents(game),
    deriveFromPersistedTeamStats(game),
  ];

  for (const rows of candidates) {
    if (rows && isHealthyQuarterRows(rows, homeFinal, awayFinal)) {
      return rows;
    }
  }

  for (const rows of candidates) {
    if (rows && rows.some((r) => r.home > 0 || r.away > 0)) {
      return rows;
    }
  }

  return null;
}

export function stampQuarterPointsOnTeamStats(game: Game): Game {
  const rows = deriveQuarterScoringRows(game);
  if (!rows) return game;

  const home = { ...game.teamStats.home };
  const away = { ...game.teamStats.away };

  home.q1_points = 0;
  home.q2_points = 0;
  home.q3_points = 0;
  home.q4_points = 0;
  home.ot_points = 0;
  away.q1_points = 0;
  away.q2_points = 0;
  away.q3_points = 0;
  away.q4_points = 0;
  away.ot_points = 0;

  for (const row of rows) {
    switch (row.label) {
      case 'Q1':
        home.q1_points = row.home;
        away.q1_points = row.away;
        break;
      case 'Q2':
        home.q2_points = row.home;
        away.q2_points = row.away;
        break;
      case 'Q3':
        home.q3_points = row.home;
        away.q3_points = row.away;
        break;
      case 'Q4':
        home.q4_points = row.home;
        away.q4_points = row.away;
        break;
      default:
        if (row.label.startsWith('OT')) {
          home.ot_points += row.home;
          away.ot_points += row.away;
        }
        break;
    }
  }

  return {
    ...game,
    teamStats: { home, away },
  };
}

export function ensureGameQuarterStats(game: Game): Game {
  const homeFinal = resolveSideScore(game, 'home');
  const awayFinal = resolveSideScore(game, 'away');
  const persisted = deriveFromPersistedTeamStats(game);

  if (isHealthyQuarterRows(persisted, homeFinal, awayFinal)) {
    return game;
  }

  return stampQuarterPointsOnTeamStats(game);
}

export function formatQuarterRowsForReport(
  rows: QuarterScoringRow[] | null
): { label: string; home: string; away: string }[] {
  if (!rows) {
    return ['Q1', 'Q2', 'Q3', 'Q4'].map((label) => ({
      label,
      home: '—',
      away: '—',
    }));
  }

  return rows.map((row) => ({
    label: row.label,
    home: String(row.home),
    away: String(row.away),
  }));
}
