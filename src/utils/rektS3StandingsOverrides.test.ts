import { describe, expect, it } from 'vitest';
import {
  REKT_GLEAGUE_S3_DEMOTED_TEAM_ID,
  REKT_GLEAGUE_S3_STANDINGS_FOOTNOTE,
  REKT_GLEAGUE_S3_TOURNAMENT_ID,
  REKT_S3_DEMOTED_TEAM_ID,
  REKT_S3_STANDINGS_FOOTNOTE,
  REKT_S3_TOURNAMENT_ID,
  applyRektS3StandingsOrder,
  isRektS3DemotedTeam,
  rektS3StandingsFootnote,
} from './rektS3StandingsOverrides';

describe('rektS3StandingsOverrides', () => {
  const rows = [
    { team: { id: REKT_S3_DEMOTED_TEAM_ID }, wins: 1 },
    { team: { id: 'team-rekt-s3-maskex' }, wins: 5 },
    { team: { id: 'team-rekt-s3-zenith' }, wins: 5 },
  ];

  it('pins SGKR to the bottom for S3 only', () => {
    const ordered = applyRektS3StandingsOrder(REKT_S3_TOURNAMENT_ID, rows);
    expect(ordered.map((r) => r.team.id)).toEqual([
      'team-rekt-s3-maskex',
      'team-rekt-s3-zenith',
      REKT_S3_DEMOTED_TEAM_ID,
    ]);
    expect(ordered[2].wins).toBe(1);
  });

  it('pins SGKR (G-league) to the bottom for G-League S3', () => {
    const glRows = [
      { team: { id: REKT_GLEAGUE_S3_DEMOTED_TEAM_ID }, wins: 0 },
      { team: { id: 'team-rekt-s1-apex' }, wins: 3 },
      { team: { id: 'team-rekt-gl-s1-fourth-arcs' }, wins: 4 },
    ];
    const ordered = applyRektS3StandingsOrder(
      REKT_GLEAGUE_S3_TOURNAMENT_ID,
      glRows
    );
    expect(ordered.map((r) => r.team.id)).toEqual([
      'team-rekt-s1-apex',
      'team-rekt-gl-s1-fourth-arcs',
      REKT_GLEAGUE_S3_DEMOTED_TEAM_ID,
    ]);
  });

  it('leaves other tournaments unchanged', () => {
    expect(applyRektS3StandingsOrder('tournament-rekt-cup-2026', rows)).toBe(
      rows
    );
  });

  it('exposes footnote and demoted flag for S3 and G-League S3', () => {
    expect(rektS3StandingsFootnote(REKT_S3_TOURNAMENT_ID)).toBe(
      REKT_S3_STANDINGS_FOOTNOTE
    );
    expect(
      isRektS3DemotedTeam(REKT_S3_TOURNAMENT_ID, REKT_S3_DEMOTED_TEAM_ID)
    ).toBe(true);
    expect(isRektS3DemotedTeam(REKT_S3_TOURNAMENT_ID, 'team-rekt-s3-maskex')).toBe(
      false
    );

    expect(rektS3StandingsFootnote(REKT_GLEAGUE_S3_TOURNAMENT_ID)).toBe(
      REKT_GLEAGUE_S3_STANDINGS_FOOTNOTE
    );
    expect(
      isRektS3DemotedTeam(
        REKT_GLEAGUE_S3_TOURNAMENT_ID,
        REKT_GLEAGUE_S3_DEMOTED_TEAM_ID
      )
    ).toBe(true);
  });
});
