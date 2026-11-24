import { describe, expect, it } from 'vitest';
import type { Player, Team } from '../App';
import type { PlayerSeasonRow } from './playerSeasonStats';
import {
  filterPlayerSeasonRows,
  normalizePlayerStatsPosition,
  toggleIdInSet,
} from './filterPlayerSeasonRows';

function stubRow(
  playerId: string,
  teamId: string,
  position: string
): PlayerSeasonRow {
  return {
    player: {
      id: playerId,
      name: playerId,
      position,
    } as Player,
    team: { id: teamId, name: teamId, abbreviation: 'X', players: [] } as Team,
    totalStats: {} as PlayerSeasonRow['totalStats'],
    gamesPlayed: 1,
    paintPointsTotal: 0,
    fastbreakPointsTotal: 0,
    gamesWithShotData: 0,
    foulsDrawnTotal: 0,
    gamesWithFoulsDrawnData: 0,
    plusMinusTotal: 0,
    gamesWithPlusMinusData: 0,
    personalFoulsTotal: 0,
    gamesWithPersonalFoulsData: 0,
    blocksReceivedTotal: 0,
    gamesWithBlocksReceivedData: 0,
  };
}

describe('filterPlayerSeasonRows', () => {
  const rows = [
    stubRow('p1', 'team-a', 'PG'),
    stubRow('p2', 'team-a', 'SG'),
    stubRow('p3', 'team-b', 'PG'),
    stubRow('p4', 'team-b', ''),
    stubRow('p5', 'team-c', ' sf '),
  ];

  it('normalizes position for matching', () => {
    expect(normalizePlayerStatsPosition(' pg ')).toBe('PG');
    expect(normalizePlayerStatsPosition('')).toBe('');
    expect(normalizePlayerStatsPosition(null)).toBe('');
  });

  it('returns all rows when filters empty', () => {
    expect(filterPlayerSeasonRows(rows, {})).toEqual(rows);
    expect(filterPlayerSeasonRows(rows, { teamIds: new Set(), positions: new Set() })).toEqual(
      rows
    );
  });

  it('filters by a single team', () => {
    const out = filterPlayerSeasonRows(rows, { teamIds: new Set(['team-a']) });
    expect(out.map((r) => r.player.id)).toEqual(['p1', 'p2']);
  });

  it('filters by multiple teams', () => {
    const out = filterPlayerSeasonRows(rows, {
      teamIds: new Set(['team-a', 'team-c']),
    });
    expect(out.map((r) => r.player.id)).toEqual(['p1', 'p2', 'p5']);
  });

  it('filters by a single position (primary, normalized)', () => {
    const out = filterPlayerSeasonRows(rows, { positions: new Set(['PG']) });
    expect(out.map((r) => r.player.id)).toEqual(['p1', 'p3']);
  });

  it('filters by multiple positions', () => {
    const out = filterPlayerSeasonRows(rows, {
      positions: new Set(['SG', 'SF']),
    });
    expect(out.map((r) => r.player.id)).toEqual(['p2', 'p5']);
  });

  it('ANDs team and position when both set', () => {
    const out = filterPlayerSeasonRows(rows, {
      teamIds: new Set(['team-a', 'team-b']),
      positions: new Set(['PG']),
    });
    expect(out.map((r) => r.player.id)).toEqual(['p1', 'p3']);
  });

  it('excludes blank positions when a position filter is active', () => {
    const out = filterPlayerSeasonRows(rows, { positions: new Set(['PG']) });
    expect(out.map((r) => r.player.id)).not.toContain('p4');
  });

  it('toggleIdInSet adds and removes', () => {
    const a = toggleIdInSet(new Set(['x']), 'y', true);
    expect([...a].sort()).toEqual(['x', 'y']);
    const b = toggleIdInSet(a, 'x', false);
    expect([...b]).toEqual(['y']);
  });
});
