/**
 * Snapshot icon metadata + LE-107 cache-bust tests.
 * Run: npm run test:snapshot-icons
 */

import {
  APP_DATA_SNAPSHOT_VERSION,
  mergeTeamIconMetadata,
  mergeTournamentIconMetadata,
} from '../src/lib/appDataSnapshot';
import type { Team, Tournament } from '../src/App';
import { withIconCacheBust } from '../src/utils/teamAssetStorage';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function testSnapshotVersion(): void {
  assert(APP_DATA_SNAPSHOT_VERSION === 8, 'snapshot version is 8');
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

function testMergeKeepsLocalDataUrl(): void {
  const local: Team[] = [
    {
      id: 'team-a',
      name: 'A',
      abbreviation: 'A',
      icon: 'data:image/png;base64,abc',
      players: [],
    },
  ];
  const fallback: Team[] = [
    {
      id: 'team-a',
      name: 'A',
      abbreviation: 'A',
      icon: 'https://example.com/old.png',
      players: [],
    },
  ];
  const merged = mergeTeamIconMetadata(local, fallback);
  assert(
    merged[0].icon === 'data:image/png;base64,abc',
    'LE-107: keeps in-flight data URL over fallback'
  );
}

function testMergeKeepsVersionedUrl(): void {
  const local: Team[] = [
    {
      id: 'team-a',
      name: 'A',
      abbreviation: 'A',
      icon: 'https://cdn.example.com/teams/a.png?v=99',
      players: [],
    },
  ];
  const fallback: Team[] = [
    {
      id: 'team-a',
      name: 'A',
      abbreviation: 'A',
      icon: 'https://cdn.example.com/teams/a.png',
      players: [],
    },
  ];
  const merged = mergeTeamIconMetadata(local, fallback);
  assert(
    merged[0].icon === 'https://cdn.example.com/teams/a.png?v=99',
    'LE-107: keeps versioned local URL'
  );
}

function testMergeTournamentKeepsLocal(): void {
  const local: Tournament[] = [
    {
      id: 't1',
      name: 'T',
      year: 2026,
      month: 'Jan',
      teams: [],
      games: [],
      standings: [],
      icon: 'data:image/png;base64,xyz',
    },
  ];
  const fallback: Tournament[] = [
    {
      id: 't1',
      name: 'T',
      year: 2026,
      month: 'Jan',
      teams: [],
      games: [],
      standings: [],
      icon: 'https://example.com/t.png',
    },
  ];
  const merged = mergeTournamentIconMetadata(local, fallback);
  assert(
    merged[0].icon === 'data:image/png;base64,xyz',
    'tournament merge keeps data URL'
  );
}

function testWithIconCacheBust(): void {
  const busted = withIconCacheBust(
    'https://nwdx.supabase.co/storage/v1/object/public/team-assets/teams/x.png',
    1700000000000
  );
  assert(
    busted ===
      'https://nwdx.supabase.co/storage/v1/object/public/team-assets/teams/x.png?v=1700000000000',
    `cache-bust append: ${busted}`
  );
  const replaced = withIconCacheBust(
    'https://example.com/a.png?v=1&other=2',
    9
  );
  assert(replaced.includes('v=9'), 'replaces existing v');
  assert(replaced.includes('other=2'), 'keeps other params');
  const relative = withIconCacheBust('/team-logos/x.png', 3);
  assert(relative === '/team-logos/x.png?v=3', `relative bust: ${relative}`);
}

function main(): void {
  testSnapshotVersion();
  testMergeTeamIconMetadata();
  testMergeKeepsLocalDataUrl();
  testMergeKeepsVersionedUrl();
  testMergeTournamentKeepsLocal();
  testWithIconCacheBust();
  console.log('All snapshot icon tests passed.');
}

main();
