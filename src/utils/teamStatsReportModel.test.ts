import { describe, expect, it } from 'vitest';
import type { Player, PlayerStats, Team } from '../App';
import type { PlayerSeasonRow } from './playerSeasonStats';
import {
  buildTeamStatsAdvancedRow,
  buildTeamStatsStandardRow,
  formatTeamStatsJerseyNumber,
} from './teamStatsReportModel';

function emptyStats(playerId: string): PlayerStats {
  return {
    playerId,
    minutes_played: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    offensive_rebounds: 0,
    defensive_rebounds: 0,
    plus_minus: 0,
    technical_fouls: 0,
    unsportsmanlike_fouls: 0,
    blocks_received: 0,
  };
}

function makeRow(number: number, name = 'Test Player'): PlayerSeasonRow {
  const player: Player = {
    id: 'p1',
    name,
    number,
    position: 'PG',
  };
  const team: Team = {
    id: 't1',
    name: 'Test Team',
    abbreviation: 'TST',
    players: [player],
  };
  return {
    player,
    team,
    gamesPlayed: 2,
    totalStats: emptyStats(player.id),
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

describe('teamStatsReportModel jersey column', () => {
  it('formats jersey numbers and treats 0 as valid', () => {
    expect(formatTeamStatsJerseyNumber(22)).toBe('22');
    expect(formatTeamStatsJerseyNumber(0)).toBe('0');
    expect(formatTeamStatsJerseyNumber(null)).toBe('-');
    expect(formatTeamStatsJerseyNumber(undefined)).toBe('-');
    expect(formatTeamStatsJerseyNumber(Number.NaN)).toBe('-');
  });

  it('puts jersey in the first common cell, not sort rank', () => {
    const row = makeRow(22);
    const standard = buildTeamStatsStandardRow(row);
    const advanced = buildTeamStatsAdvancedRow(row);

    expect(standard[0]).toBe('22');
    expect(standard[1]).toBe('Test Player');
    expect(advanced[0]).toBe('22');
    expect(advanced[1]).toBe('Test Player');
  });
});
