import { describe, expect, it } from 'vitest';
import {
  meetsTournamentLeaderGamesFloor,
  meetsTournamentMajorAwardGamesFloor,
} from './tournamentLeaders';

describe('tournamentLeaders games floor', () => {
  it('rejects 1-game players even when they played 100% of a 1-game team', () => {
    expect(meetsTournamentLeaderGamesFloor(1, 1)).toBe(false);
    expect(meetsTournamentMajorAwardGamesFloor(1, 1)).toBe(false);
  });

  it('accepts 2+ GP when team fraction is met', () => {
    expect(meetsTournamentLeaderGamesFloor(2, 4)).toBe(true); // 50%
    expect(meetsTournamentLeaderGamesFloor(2, 5)).toBe(false); // 40%
    expect(meetsTournamentMajorAwardGamesFloor(3, 5)).toBe(true); // 60% > 55%
    expect(meetsTournamentMajorAwardGamesFloor(2, 5)).toBe(false); // 40%
  });

  it('majors @55%: includes 4/7 and 5/9, excludes 4/8 and 7/13', () => {
    expect(meetsTournamentMajorAwardGamesFloor(4, 7)).toBe(true); // ~57%
    expect(meetsTournamentMajorAwardGamesFloor(5, 9)).toBe(true); // ~56%
    expect(meetsTournamentMajorAwardGamesFloor(4, 8)).toBe(false); // 50%
    expect(meetsTournamentMajorAwardGamesFloor(7, 13)).toBe(false); // ~54%
  });
});
