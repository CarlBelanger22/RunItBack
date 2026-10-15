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
    expect(meetsTournamentMajorAwardGamesFloor(3, 5)).toBe(true); // 60%
    expect(meetsTournamentMajorAwardGamesFloor(2, 5)).toBe(false); // 40%
  });
});
