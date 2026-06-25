/**
 * Snapshot icon metadata tests.
 * Run: npm run test:snapshot-icons
 */

import {
  APP_DATA_SNAPSHOT_VERSION,
  mergeTeamIconMetadata,
} from '../src/lib/appDataSnapshot';
import type { Team } from '../src/App';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function testSnapshotVersion(): void {
  assert(APP_DATA_SNAPSHOT_VERSION === 7, 'snapshot version is 7');
}

function testMergeTeamIconMetadata(): void {
  const incoming: Team[] = [
    { id: 'team-a', name: 'A', abbreviation: 'A', players: [] },
  ];
  const fallback: Team[] = [
    {
      id: 'team-a',
      name: 'A',
      abbreviation: 'A',
      icon: 'https://example.com/icon.png',
      players: [],
    },
  ];
  const merged = mergeTeamIconMetadata(incoming, fallback);
  assert(merged[0].icon === 'https://example.com/icon.png', 'preserves icon from fallback');
}

function main(): void {
  testSnapshotVersion();
  testMergeTeamIconMetadata();
  console.log('All snapshot icon tests passed.');
}

main();
