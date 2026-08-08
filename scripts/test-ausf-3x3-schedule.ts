/**
 * LE-128 — AUSF 3x3 schedule data sanity checks.
 * Run: npm run test:ausf-3x3-schedule
 */
import {
  ALL_TEAM_IDS,
  AUSF_2026_GROUPS,
  NEW_TEAM_IDS,
  PROTECTED_GAME_IDS,
  SCORE_ONLY_GAMES,
  TEAM,
  TEAM_META,
  TOURNAMENT_ID,
} from './ausf-3x3-schedule-data';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main(): void {
  assert(TOURNAMENT_ID === 'tournament-1782412204083', 'tournament id');
  assert(PROTECTED_GAME_IDS.length === 4, '4 protected NTU box scores');
  assert(SCORE_ONLY_GAMES.length === 23, '23 score-only games');
  assert(NEW_TEAM_IDS.length === 6, '6 new teams');
  assert(ALL_TEAM_IDS.length === 13, '13 total teams');
  assert(AUSF_2026_GROUPS.length === 4, '4 groups');
  assert(AUSF_2026_GROUPS[0].name === 'Group A', 'Group A');
  assert(AUSF_2026_GROUPS[0].teamIds[0] === TEAM.gdut, 'A1 GDUT');
  assert(AUSF_2026_GROUPS[3].teamIds.length === 4, 'Group D has 4');
  assert(
    AUSF_2026_GROUPS.flatMap((g) => g.teamIds).length === 13,
    'all 13 in groups'
  );

  assert(TEAM_META[TEAM.gdut].abbreviation === 'GDUT', 'GDUT abbr');
  assert(TEAM_META[TEAM.hkmu].abbreviation === 'HKMU', 'HKMU abbr');
  assert(TEAM_META[TEAM.swu].abbreviation === 'SWU', 'SWU abbr');
  assert(TEAM_META[TEAM.ru].abbreviation === 'RU', 'RU abbr');
  assert(TEAM_META[TEAM.cuhk].abbreviation === 'CUHK', 'CUHK abbr');
  assert(TEAM_META[TEAM.toos].abbreviation === 'TOOS', 'TOOS abbr');
  assert(TEAM_META[TEAM.nus].isNew === false, 'reuse NUS');
  assert(TEAM_META[TEAM.thu].isNew === false, 'reuse THU');

  const ids = new Set(SCORE_ONLY_GAMES.map((g) => g.id));
  assert(ids.size === SCORE_ONLY_GAMES.length, 'unique game ids');
  for (const id of PROTECTED_GAME_IDS) {
    assert(!ids.has(id), `score-only must not include protected ${id}`);
  }

  const group = SCORE_ONLY_GAMES.filter((g) => g.phase === 'group');
  const ko = SCORE_ONLY_GAMES.filter((g) => g.phase === 'knockout');
  assert(group.length === 12, '12 group score-only (15 pool - 3 protected pool)');
  // Pool: 15 total, 3 protected pool (macau, moratuwa, tribhuwan) = 12 score-only group
  // Wait: protected are macau, moratuwa, tribhuwan (pool) + iau (L16) = 3 pool + 1 L16
  // Pool games total: Jun12 9 + Jun13 6 = 15, protected pool 3 → 12 group score-only ✓
  // L16: 4 total, 1 protected → 3 L16 score-only
  // QF+SF+3rd+Final: 8
  // KO score-only: 3+8 = 11
  assert(ko.length === 11, '11 knockout score-only');

  const final = SCORE_ONLY_GAMES.find((g) => g.id.endsWith('gdut-thu'));
  assert(final?.homeScore === 22 && final?.awayScore === 21, 'Final 22-21');
  assert(final?.note === 'Final', 'Final note');

  const l16Cuhk = SCORE_ONLY_GAMES.find((g) => g.id.includes('cuhk-swu'));
  assert(l16Cuhk?.homeScore === 18 && l16Cuhk?.awayScore === 15, 'L16 CUHK-SWU');

  console.log('PASS: test-ausf-3x3-schedule');
}

main();
