import { describe, expect, it } from 'vitest';
import {
  NBL_D1_2025_DEMOTED_TEAM_ID,
  NBL_D1_2025_STANDINGS_FOOTNOTE,
  NBL_D1_2025_TOURNAMENT_ID,
  applyNbl2025StandingsOrder,
  isNbl2025DemotedTeam,
  nbl2025StandingsFootnote,
} from './nbl2025StandingsOverrides';

describe('nbl2025StandingsOverrides', () => {
  const rows = [
    { team: { id: NBL_D1_2025_DEMOTED_TEAM_ID }, wins: 8 },
    { team: { id: 'team-nbl-d1-2025-siglap' }, wins: 7 },
    { team: { id: 'team-nbl-d1-2025-hornets' }, wins: 9 },
  ];

  it('pins Adroit to the bottom for NBL Div 1 2025 only', () => {
    const ordered = applyNbl2025StandingsOrder(NBL_D1_2025_TOURNAMENT_ID, rows);
    expect(ordered.map((r) => r.team.id)).toEqual([
      'team-nbl-d1-2025-siglap',
      'team-nbl-d1-2025-hornets',
      NBL_D1_2025_DEMOTED_TEAM_ID,
    ]);
    expect(ordered[2].wins).toBe(8);
  });

  it('leaves other tournaments unchanged', () => {
    expect(
      applyNbl2025StandingsOrder('tournament-nbl-d1-2026', rows)
    ).toBe(rows);
  });

  it('exposes footnote and demoted flag for NBL Div 1 2025', () => {
    expect(nbl2025StandingsFootnote(NBL_D1_2025_TOURNAMENT_ID)).toBe(
      NBL_D1_2025_STANDINGS_FOOTNOTE
    );
    expect(
      isNbl2025DemotedTeam(
        NBL_D1_2025_TOURNAMENT_ID,
        NBL_D1_2025_DEMOTED_TEAM_ID
      )
    ).toBe(true);
    expect(
      isNbl2025DemotedTeam(NBL_D1_2025_TOURNAMENT_ID, 'team-nbl-d1-2025-siglap')
    ).toBe(false);
    expect(nbl2025StandingsFootnote('tournament-rekt-s3-2026')).toBeNull();
  });
});
