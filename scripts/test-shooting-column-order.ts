/**
 * Run: npm run test:shooting-column-order
 */

import {
  COMPACT_LIVE_BOX_SCORE_COLUMN_LABELS,
  COMPACT_LIVE_SHOOTING_COLUMN_LABELS,
  STANDARD_SHOOTING_STAT_FIELDS,
} from '../src/utils/shootingStatColumns';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function testStandardShootingOrder(): void {
  assert(
    STANDARD_SHOOTING_STAT_FIELDS.join(',') ===
      'FGM,FGA,FG%,3PM,3PA,3P%,FTM,FTA,FT%',
    `standard shooting order: ${STANDARD_SHOOTING_STAT_FIELDS.join(',')}`
  );
}

function testCompactShootingOrder(): void {
  assert(
    COMPACT_LIVE_SHOOTING_COLUMN_LABELS.join(',') ===
      'FGM,FGA,FG%,3PM,3PA,3P%,FTM,FTA,FT%',
    `compact shooting order: ${COMPACT_LIVE_SHOOTING_COLUMN_LABELS.join(',')}`
  );
  assert(
    COMPACT_LIVE_SHOOTING_COLUMN_LABELS.at(-1) === 'FT%',
    'compact shooting block ends with FT%'
  );
}

function testCompactBoxScoreLabels(): void {
  const shootingSlice = COMPACT_LIVE_BOX_SCORE_COLUMN_LABELS.slice(1, 10);
  assert(
    shootingSlice.join(',') === COMPACT_LIVE_SHOOTING_COLUMN_LABELS.join(','),
    'compact box score keeps inline shooting block after PTS'
  );
  assert(
    COMPACT_LIVE_BOX_SCORE_COLUMN_LABELS.join(',') ===
      'PTS,FGM,FGA,FG%,3PM,3PA,3P%,FTM,FTA,FT%,REB,AST,STL,BLK,TO,PF',
    `compact box score labels: ${COMPACT_LIVE_BOX_SCORE_COLUMN_LABELS.join(',')}`
  );
}

function main(): void {
  testStandardShootingOrder();
  testCompactShootingOrder();
  testCompactBoxScoreLabels();
  console.log('test-shooting-column-order: all checks passed');
}

main();
